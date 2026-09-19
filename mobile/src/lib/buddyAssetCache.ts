import { Directory, File, Paths } from 'expo-file-system';

/**
 * Persistent on-device cache for Buddy 3D avatar files (GLB).
 *
 * The avatars are downloadable game resources, not API responses: tens of
 * megabytes each, immutable once uploaded, and needed again every single time
 * the student opens the buddy. Without this the app re-downloaded the whole
 * file on every cold start — minutes of waiting on a Mongolian mobile
 * connection, paid over and over for bytes that never change.
 *
 *   first use     remote → this cache → parse → render
 *   next launch   this cache → parse → render          (no network at all)
 *   same session  BuddyAvatar's RAM modelCache          (no disk, no parse)
 *
 * The three layers solve different problems and none replaces another. This one
 * only owns "the bytes are on the device".
 *
 * **The downloaded bytes are never touched.** No compression, no re-encoding,
 * no processing of any kind — a byte-for-byte copy of what the CDN served. The
 * avatar rig (blendshapes, skeleton, animations, textures) is immutable.
 */

/** Everything this module owns lives here, and it never looks outside it. */
const DIR_NAME = 'buddy-assets';

/**
 * Anything smaller than this is not a model — it is a truncated download or an
 * error page that happened to arrive with a 200. Cheap, and it costs nothing on
 * a cache hit (the size is already in the directory entry).
 */
const MIN_VALID_BYTES = 1024;

/**
 * How many avatar files are kept.
 *
 * This is a **storage budget**, not a guess: avatars run ~25 MB each, so three
 * is roughly 75 MB of a student's phone — and these files live in the document
 * directory, which iOS includes in iCloud backups. Raising it costs real
 * storage on devices that often do not have much.
 *
 * Three covers the realistic pattern: the buddy warmed while browsing, the one
 * actually chosen, and one change of mind — without re-downloading 25 MB for
 * switching back. It also stops superseded versions accumulating: re-uploading
 * an avatar in admin produces a NEW url (`buddy/models/<uuid>.glb`), so the old
 * file would otherwise sit there until the app is uninstalled.
 */
const MAX_ASSETS = 3;

/** A part-finished download older than this was abandoned by a previous run. */
const STALE_TMP_MS = 60 * 60 * 1000; // 1 hour

/**
 * url → the download that is already running for it.
 *
 * Two components asking for the same uncached buddy in the same tick (the voice
 * stage mounting while the preloader is still working, say) must share one
 * 25 MB download, not start two. Same idea as `inflight` in `api/client.ts`.
 */
const inflight = new Map<string, Promise<string>>();

/**
 * The cache directory, created once per app run.
 *
 * `create()` is a synchronous native call and this runs on the render path
 * (`cachedBuddyAssetUri` decides which wait the stage shows), so doing it on
 * every lookup would put a filesystem round trip in front of a render for a
 * directory that cannot disappear while the app is running.
 */
let ensured = false;

function assetDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!ensured) {
    dir.create({ intermediates: true, idempotent: true });
    ensured = true;
  }
  return dir;
}

/**
 * A short, filesystem-safe, deterministic name for a url.
 *
 * The raw url can never be the filename — it carries `/` and `:` — and a
 * *sanitized* url is both unbounded in length and lossy. Two independent
 * FNV-1a passes (forwards and backwards) give 16 hex characters, which is
 * plenty to keep a handful of avatars apart while staying stable across app
 * launches: the same url always resolves to the same file.
 */
function assetCacheKey(url: string): string {
  return `${fnv1a(url)}${fnv1a(reverse(url))}`;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, kept in range with Math.imul.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const reverse = (s: string) => s.split('').reverse().join('');

/** `.glb` / `.gltf` from the url, defaulting to `.glb`. */
function extensionOf(url: string): string {
  const match = /\.(glb|gltf)(\?|#|$)/i.exec(url);
  return match ? `.${match[1].toLowerCase()}` : '.glb';
}

function assetFile(url: string): File {
  return new File(assetDir(), `${assetCacheKey(url)}${extensionOf(url)}`);
}

function tempFile(url: string): File {
  return new File(assetDir(), `${assetCacheKey(url)}.tmp`);
}

/** Is this file a complete, usable asset? */
function isUsable(file: File): boolean {
  try {
    return file.exists && file.size >= MIN_VALID_BYTES;
  } catch {
    // Unreadable (permissions, a directory in its place) — treat as absent.
    return false;
  }
}

/**
 * The local uri for `url` if it is already on the device, else `null`.
 *
 * Synchronous and cheap, so a caller can decide "do I have this now?" without
 * starting any work — which is what lets the avatar skip its loading state on
 * every launch after the first.
 */
export function cachedBuddyAssetUri(url: string): string | null {
  try {
    const file = assetFile(url);
    return isUsable(file) ? file.uri : null;
  } catch {
    return null;
  }
}

/**
 * Get `url` onto the device and return its local `file://` uri.
 *
 * Downloads only when it has to, never twice at once, and never leaves a
 * half-written file behind that a later run would mistake for a complete one.
 * Rejects if the download fails — the caller falls back to the remote url, so a
 * cache problem degrades to today's behavior instead of breaking the buddy.
 */
export function resolveBuddyAsset(url: string): Promise<string> {
  const ready = cachedBuddyAssetUri(url);
  if (ready) return Promise.resolve(ready);

  const running = inflight.get(url);
  if (running) return running;

  const download = downloadAsset(url).finally(() => {
    // Always clear the slot, success or failure — a failed download must stay
    // retryable rather than handing every later caller the same rejection.
    inflight.delete(url);
  });
  inflight.set(url, download);
  return download;
}

/**
 * Download into a temporary name and only then move it into place.
 *
 * The move is what makes the cache safe: a file under the real name is always
 * a finished download. Downloading straight to the final name would leave a
 * plausible-looking partial file behind whenever the connection dropped, and
 * the next launch would happily hand those bytes to the parser.
 */
async function downloadAsset(url: string): Promise<string> {
  const target = assetFile(url);
  const temp = tempFile(url);
  try {
    if (temp.exists) temp.delete(); // a previous attempt that never finished
    await File.downloadFileAsync(url, temp, { idempotent: true });
    if (!isUsable(temp)) throw new Error('downloaded avatar is too small');
    if (target.exists) target.delete(); // replace, e.g. after an invalidate
    temp.move(target);
  } catch (err) {
    try {
      if (temp.exists) temp.delete();
    } catch {
      // best-effort cleanup — never mask the real failure below
    }
    throw err;
  }
  // Outside the try on purpose: housekeeping must not be able to send a
  // finished download down the failure path, which would delete it again.
  pruneOldAssets(target.uri);
  return target.uri;
}

/**
 * Read a cached asset's bytes off the disk.
 *
 * `file.bytes()` is a **direct binary read** — the platform hands over a
 * `Uint8Array` with no base64 string in between, which on a 25 MB model is the
 * difference between a readable file and a ~34 MB JS string that then has to be
 * decoded. Same reason the network path uses XHR rather than `fetch`.
 *
 * Takes the local uri from `resolveBuddyAsset` rather than the remote url, so
 * the caller can time the download and the disk read separately — they differ
 * by three orders of magnitude and only one of them is worth optimising.
 */
export function readLocalAssetBytes(localUri: string): Promise<Uint8Array> {
  return new File(localUri).bytes();
}

/**
 * Drop a cached file — for when the bytes turn out to be unparseable.
 *
 * A corrupt cache entry is worse than no cache: it fails identically on every
 * launch and the buddy never appears again. Deleting it makes the next attempt
 * a fresh download.
 */
export function invalidateBuddyAsset(url: string): void {
  try {
    const file = assetFile(url);
    if (file.exists) file.delete();
  } catch {
    // Nothing useful to do; the asset just stays and the caller falls back.
  }
}

/**
 * Keep the cache bounded. Only ever touches files inside the buddy-asset
 * directory, and never the asset that was just resolved.
 *
 * Retention is by download time, not by last use: reading a file does not
 * update its timestamp, and writing one on every cache hit would be churn for
 * no benefit at this size.
 */
function pruneOldAssets(keepUri: string): void {
  try {
    const now = Date.now();
    const assets: File[] = [];
    for (const entry of assetDir().list()) {
      if (!(entry instanceof File)) continue;
      if (entry.uri.endsWith('.tmp')) {
        // An abandoned part-download from a previous run.
        const age = now - (entry.modificationTime ?? now);
        if (age > STALE_TMP_MS) entry.delete();
        continue;
      }
      if (entry.uri !== keepUri) assets.push(entry);
    }
    if (assets.length < MAX_ASSETS) return;
    assets
      .sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0))
      .slice(MAX_ASSETS - 1) // −1: the kept asset holds one of the slots
      .forEach((file) => file.delete());
  } catch {
    // Cleanup is housekeeping. A failure here must never fail a download.
  }
}
