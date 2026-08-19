import { useEffect, useRef, useState } from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, SkeletonUtils } from 'three-stdlib';
import { toByteArray } from 'base64-js';
import { decode as decodeJpeg } from 'jpeg-js';
import UPNG from 'upng-js';
import {
  EMOTION_POSES, blinkPose, estimateSpeechMs, maxPose, textToVisemes, visemePoseAt,
  type Pose, type Viseme,
} from './buddyFace';

/**
 * 3D AI Buddy avatar (Meshy-generated GLB rendered with three.js on expo-gl).
 *
 * - Loads the GLB from `assetUrl` (set per-buddy in admin → `avatarAssetUrl`).
 * - Plays the `idle` animation on loop; on each turn the parent passes the
 *   LLM `emotion`/`gesture` and we crossfade to the mapped animation clip.
 * - **Lip-sync (MVP):** expo-audio does NOT expose playback amplitude, so while
 *   `isSpeaking` we drive a `mouth_open` morph target (or a jaw bone) with a
 *   procedural "jabber" curve — a talking-mouth approximation. Upgrade path:
 *   ElevenLabs `with-timestamps` → real visemes (see docs/AI_BUDDY_PLAN.md).
 *
 * If `assetUrl` is missing/failed, renders nothing — the parent keeps showing
 * the 2D image fallback, so the feature degrades gracefully.
 */
interface Props {
  assetUrl?: string | null;
  emotion?: string;
  gesture?: string;
  /** tag → animation clip name (from GET /ai/buddies). */
  emotionMap?: Record<string, string>;
  /** True while the reply audio is playing → animate the mouth. */
  isSpeaking?: boolean;
  /** What the buddy is saying — the mouth shapes are derived from this text. */
  speechText?: string | null;
  /** Real length of the reply audio, so the mouth keeps pace with the voice. */
  speechDurationMs?: number | null;
  /** True while a turn is in flight → render at a trickle, leaving the JS
   *  thread and GPU to the request, the audio and the UI. */
  lowPower?: boolean;
  /** Fired once the GLB is parsed and on screen, so the parent can drop the 2D art. */
  onReady?: (ready: boolean) => void;
  style?: ViewStyle;
}

/** Above this, loading the model is likely to OOM the phone (see loadGlb). */
const MAX_GLB_MB = 20;

/**
 * Model height in world units after fitting. The camera below (fov 32 at z 2.6)
 * sees 2 · 2.6 · tan(16°) ≈ 1.49 units of height, so anything above that gets
 * cropped — 1.3 keeps the whole character on screen with a small margin.
 */
const FIT_HEIGHT = 1.3;

/** Avatar render rate. Half of 60 fps is imperceptible here and frees JS time. */
const AVATAR_FPS = 30;

/** Frame rate while a turn is being processed — just enough to not look frozen. */
const LOW_POWER_FPS = 8;

/** How long one blink takes, eyes closing and opening again. */
const BLINK_MS = 140;

/** Blendshape easing speed — high enough to keep up with speech, low enough to glide. */
const FACE_EASE = 14;

/**
 * url → parsed model, kept for the whole app session. Downloading, parsing and
 * JS-decoding the textures costs seconds on a phone, and the same buddy is
 * mounted again on every carousel swipe and when its chat screen opens — without
 * this the user waits for that work every single time.
 */
const modelCache = new Map<string, Promise<Loaded>>();

function loadGlbCached(url: string): Promise<Loaded> {
  let entry = modelCache.get(url);
  if (!entry) {
    entry = loadGlb(url).catch((err) => {
      modelCache.delete(url); // don't cache a failure — a retry should re-fetch
      throw err;
    });
    modelCache.set(url, entry);
  }
  return entry;
}

interface Loaded {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export function BuddyAvatar({
  assetUrl, emotion, gesture, emotionMap, isSpeaking, speechText, speechDurationMs,
  lowPower, onReady, style,
}: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(null);
    setError(null);
    if (!assetUrl) return;
    loadGlbCached(assetUrl)
      .then((res) => {
        if (!alive) return;
        // Clone per mount: an Object3D can only live in one scene, and the cache
        // hands the same one to every mount. SkeletonUtils keeps skin/bone links
        // intact (a plain .clone() would break skinning); geometry and textures
        // stay shared, so the clone is cheap.
        setLoaded({ scene: SkeletonUtils.clone(res.scene) as THREE.Group, animations: res.animations });
        onReady?.(true);
      })
      .catch((err) => {
        // Loud on purpose: a silent catch here looks identical to "no 3D asset",
        // so the 2D fallback hid every real load/parse failure (Draco, CORS, 404).
        const reason = String(err?.message ?? err);
        console.warn('[BuddyAvatar] GLB load failed:', assetUrl, reason);
        if (!alive) return;
        setError(reason);
        setLoaded(null);
        onReady?.(false); // parent keeps the 2D fallback
      });
    return () => { alive = false; onReady?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetUrl]);

  // In DEV, say WHY the 3D avatar is missing right on the card. Without this the
  // 2D fallback looks identical whether the GLB 404'd, failed to parse, or was
  // never set — which is exactly how this bug stayed invisible.
  if (!loaded) {
    if (__DEV__ && error) {
      return (
        <View style={[style, { justifyContent: 'flex-end', padding: 6 }]} pointerEvents="none">
          <Text style={{ color: '#FF5A5A', fontSize: 10 }} numberOfLines={4}>3D: {error}</Text>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={style} pointerEvents="none">
      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 32 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.15; // slightly brighter than default
          muteUnsupportedPixelStore(gl.getContext());
        }}
        // Cap pixel ratio so hi-DPI phones don't render a huge buffer (FPS/heat).
        dpr={[1, 2]}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        {/* Three-point studio setup: a warm key from front-right shapes the face,
            a cool fill lifts the shadow side, and a brand-purple rim from behind
            separates the character from the dark stage. The hemisphere light is
            the soft daylight ambient (sky above, stage colour bouncing up). */}
        <hemisphereLight args={['#FFF4E2', '#3A2A63', 0.75]} />
        <FrameLimiter fps={lowPower ? LOW_POWER_FPS : AVATAR_FPS} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[2.5, 3.5, 3]} intensity={1.7} color="#FFF1D8" />
        <directionalLight position={[-3, 1.5, 2]} intensity={0.55} color="#BFD4FF" />
        <directionalLight position={[0, 2.2, -3]} intensity={1.2} color="#B79BFF" />
        <BuddyModel
          scene={loaded.scene}
          animations={loaded.animations}
          emotion={emotion}
          gesture={gesture}
          emotionMap={emotionMap}
          isSpeaking={isSpeaking}
          speechText={speechText}
          speechDurationMs={speechDurationMs}
        />
      </Canvas>
    </View>
  );
}

/** Drives the `frameloop="demand"` canvas at a fixed, phone-friendly rate. */
function FrameLimiter({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const id = setInterval(invalidate, 1000 / fps);
    return () => clearInterval(id);
  }, [invalidate, fps]);
  return null;
}

/**
 * expo-gl implements a subset of `pixelStorei`, and three sets four of them
 * before every texture upload. The unsupported ones cost a JS→native call plus
 * a console line each (thousands per minute — it visibly starves the JS thread),
 * and they only affect DOM-image uploads anyway: our textures are raw RGBA
 * typed arrays, which the flags do not apply to. So drop all but UNPACK_ALIGNMENT.
 */
function muteUnsupportedPixelStore(gl: WebGLRenderingContext | null): void {
  if (!gl || (gl as { __sparkxpPatched?: boolean }).__sparkxpPatched) return;
  const original = gl.pixelStorei.bind(gl);
  gl.pixelStorei = (pname: number, param: number) => {
    if (pname === gl.UNPACK_ALIGNMENT) original(pname, param);
  };
  (gl as { __sparkxpPatched?: boolean }).__sparkxpPatched = true;
}

function BuddyModel({
  scene, animations, emotion, gesture, emotionMap, isSpeaking, speechText, speechDurationMs,
}: Loaded &
  Pick<Props, 'emotion' | 'gesture' | 'emotionMap' | 'isSpeaking' | 'speechText' | 'speechDurationMs'>) {
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const current = useRef<THREE.AnimationAction | null>(null);
  /** lowercased blendshape name → every (mesh, morph index) that carries it. */
  const shapes = useRef(new Map<string, { mesh: THREE.Mesh; index: number }[]>());
  const jaw = useRef<THREE.Bone | null>(null);
  /** Current on-screen weights, eased towards the target pose each frame. */
  const live = useRef<Pose>({});
  const idleT = useRef(0);
  const baseY = useRef(0);
  // Lip-sync state: the shape sequence for the current reply and where we are in it.
  const visemes = useRef<Viseme[]>([]);
  const speechT = useRef(0);
  const speechMs = useRef(0);
  // Blink state: seconds until the next blink, then how far through it we are.
  const nextBlink = useRef(2 + Math.random() * 3);
  const blinkT = useRef(-1);

  // One-time setup: center/scale the model, wire the mixer, find mouth targets.
  useEffect(() => {
    // Fit: center the model at origin and normalize its height to FIT_HEIGHT.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = size.y > 0 ? FIT_HEIGHT / size.y : 1;
    scene.scale.setScalar(scale);
    scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    baseY.current = scene.position.y;

    const mx = new THREE.AnimationMixer(scene);
    mixer.current = mx;
    // Index every blendshape by name so the face driver can address them
    // individually (`jawOpen`, `browInnerUp`, …). A rig may split the face over
    // several meshes, so one name can map to more than one target.
    const byName = new Map<string, { mesh: THREE.Mesh; index: number }[]>();
    scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
          const key = name.toLowerCase();
          const list = byName.get(key) ?? [];
          list.push({ mesh, index: idx as number });
          byName.set(key, list);
        }
      }
      if ((obj as THREE.Bone).isBone && /jaw/i.test(obj.name)) jaw.current = obj as THREE.Bone;
    });
    shapes.current = byName;
    live.current = {};

    // When a one-shot emotion/gesture clip ends, settle back to the idle loop.
    const onFinished = () => playClip(pickClip(animations, 'idle'), true);
    mx.addEventListener('finished', onFinished);

    playClip(pickClip(animations, 'idle'), true);

    return () => {
      mx.removeEventListener('finished', onFinished);
      mx.stopAllAction();
      // NOTE: geometry/materials/textures are NOT disposed here — they belong to
      // the cached model and are shared with every other mount of this buddy.
      // Disposing them would blank the avatar the next time it is shown.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // A new reply → build its mouth-shape sequence and restart the lip-sync clock.
  // Rebuilt on text change (not on `isSpeaking`) so replaying the same audio
  // reuses the same timeline.
  useEffect(() => {
    const text = speechText?.trim() ?? '';
    visemes.current = text ? textToVisemes(text) : [];
    speechMs.current = speechDurationMs && speechDurationMs > 0
      ? speechDurationMs
      : estimateSpeechMs(text);
    speechT.current = 0;
  }, [speechText, speechDurationMs]);

  // Restart the clock whenever the audio starts, so shapes line up with the voice.
  useEffect(() => { if (isSpeaking) speechT.current = 0; }, [isSpeaking]);

  // React to a new emotion/gesture: play that clip once, then settle to idle.
  useEffect(() => {
    const tag = emotionMap?.[gesture ?? ''] ?? emotionMap?.[emotion ?? ''] ?? gesture ?? emotion;
    if (!tag || tag === 'idle' || tag === 'calm') { playClip(pickClip(animations, 'idle'), true); return; }
    const clip = pickClip(animations, tag);
    if (clip) playClip(clip, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotion, gesture]);

  function playClip(clip: THREE.AnimationClip | null, loop: boolean) {
    if (!clip || !mixer.current) return;
    const next = mixer.current.clipAction(clip);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.fadeIn(0.3).play();
    current.current?.fadeOut(0.3);
    current.current = next;
  }

  useFrame((_, delta) => {
    mixer.current?.update(delta);

    // These avatars ship with no animation clips, so without this they are a
    // frozen statue. A slow breath + a small turn reads as "alive" and, unlike
    // animating the native view around the canvas, it stays perfectly smooth.
    if (!animations.length) {
      idleT.current += delta;
      const t = idleT.current;
      scene.position.y = baseY.current + Math.sin(t * 1.1) * 0.018;
      scene.rotation.y = Math.sin(t * 0.42) * 0.09;
      scene.rotation.z = Math.sin(t * 0.31) * 0.012;
    }

    // --- Face: expression + lip-sync + blink, merged into one target pose ---
    // Blink on a random rhythm — the single cheapest cue that a face is alive.
    if (blinkT.current >= 0) {
      blinkT.current += delta;
      if (blinkT.current > BLINK_MS / 1000) { blinkT.current = -1; nextBlink.current = 2 + Math.random() * 4; }
    } else {
      nextBlink.current -= delta;
      if (nextBlink.current <= 0) blinkT.current = 0;
    }
    // Triangle curve: eyes shut halfway through the blink, open again by the end.
    const blinkProgress = blinkT.current < 0 ? 0 : 1 - Math.abs(blinkT.current / (BLINK_MS / 2000) - 1);

    let mouth: Pose = {};
    if (isSpeaking && visemes.current.length) {
      speechT.current += delta * 1000;
      mouth = visemePoseAt(visemes.current, speechT.current, speechMs.current);
    }

    const expression = EMOTION_POSES[emotion ?? 'calm'] ?? EMOTION_POSES.calm;
    // Speech wins over expression on shared shapes (a smile must not hold the
    // jaw shut mid-word), and the blink is always on top.
    applyPose(maxPose(expression, mouth, blinkPose(blinkProgress)), delta);
  });

  /** Ease the live weights towards `target` and push them into the meshes. */
  function applyPose(target: Pose, delta: number) {
    const rig = shapes.current;
    if (!rig.size) return;
    const ease = Math.min(1, delta * FACE_EASE);
    const names = new Set([...Object.keys(live.current), ...Object.keys(target)]);

    for (const name of names) {
      const want = target[name] ?? 0;
      let value = (live.current[name] ?? 0) + (want - (live.current[name] ?? 0)) * ease;
      if (value < 0.002 && want === 0) value = 0; // settle instead of creeping
      if (value === 0) delete live.current[name];
      else live.current[name] = value;

      for (const hit of rig.get(name.toLowerCase()) ?? []) {
        if (hit.mesh.morphTargetInfluences) hit.mesh.morphTargetInfluences[hit.index] = value;
      }
    }
    // Rigs without blendshapes (e.g. the police model) still get a moving jaw.
    if (!rig.size && jaw.current) jaw.current.rotation.x = (target.jawOpen ?? 0) * 0.3;
  }

  return <primitive object={scene} />;
}

/** Pick an animation clip whose name matches `tag` (case-insensitive), else null. */
function pickClip(clips: THREE.AnimationClip[], tag: string): THREE.AnimationClip | null {
  if (!clips.length) return null;
  const low = tag.toLowerCase();
  return (
    clips.find((c) => c.name.toLowerCase() === low) ??
    clips.find((c) => c.name.toLowerCase().includes(low)) ??
    (low === 'idle' ? clips[0] : null)
  );
}

/** Fetch + parse a remote GLB into a scene + clips, then decode its textures. */
async function loadGlb(url: string): Promise<Loaded> {
  const buffer = await fetchArrayBuffer(url);
  // RN's fetch reads a response body through a base64 data URL, so a big GLB
  // costs ~1.4× its size as a JS string before it is even parsed — a 100 MB
  // model runs the phone out of memory. Keep avatars small (see docs below).
  const mb = buffer.byteLength / 1048576;
  if (mb > MAX_GLB_MB) console.warn(`[BuddyAvatar] GLB is ${mb.toFixed(1)} MB — too big for phones, optimize it (target < ${MAX_GLB_MB} MB)`);
  const gltf = await new Promise<GLTFResult>((resolve, reject) => {
    new GLTFLoader().parse(buffer, '', resolve as (g: unknown) => void, (e) =>
      reject(new Error(`GLTFLoader.parse: ${(e as unknown as Error)?.message ?? String(e)}`)),
    );
  });
  // RN three.js can't decode embedded base64 textures (no DOM image decoder), so
  // GLTFLoader leaves the mesh untextured. Decode them ourselves — best-effort:
  // on any failure the avatar just stays untextured (never crashes).
  try {
    await applyEmbeddedTextures(gltf);
  } catch (e) {
    console.warn('[BuddyAvatar] texture decode failed (model stays untextured):', e);
  }
  return { scene: gltf.scene as unknown as THREE.Group, animations: gltf.animations };
}

/**
 * Download binary data. Uses XHR, NOT fetch: React Native's fetch reads a
 * response body by converting it to a base64 data URL first, so a 4 MB GLB
 * becomes a ~5.5 MB JS string that then has to be decoded — seconds of jank.
 * XHR with `responseType: 'arraybuffer'` takes the native binary path instead.
 */
function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.response as ArrayBuffer)
        : reject(new Error(`HTTP ${xhr.status} fetching GLB`));
    xhr.onerror = () => reject(new Error('network error fetching GLB'));
    xhr.send();
  });
}

/** Minimal shape of what we read off the parsed glTF (parser.json + associations). */
interface GLTFResult {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  parser?: {
    json?: {
      images?: { uri?: string; bufferView?: number; mimeType?: string }[];
      textures?: { source?: number }[];
      materials?: { pbrMetallicRoughness?: { baseColorTexture?: { index?: number } } }[];
    };
    associations?: Map<object, { materials?: number }>;
    getDependency?: (type: string, index: number) => Promise<unknown>;
  };
}

/** Exact-size ArrayBuffer from a Uint8Array (avoids passing a larger backing buffer). */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Decode a `data:image/(jpeg|png);base64,…` URI into a GPU-uploadable DataTexture. */
function dataUriToTexture(uri: string): THREE.Texture | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(uri);
  if (!m) return null;
  try {
    return bytesToTexture(toByteArray(m[2]), m[1]);
  } catch {
    return null;
  }
}

/** Decode raw PNG/JPEG bytes into a GPU-uploadable DataTexture.
 *  RN has no DOM image decoder, so we decode in pure JS: jpeg-js for JPEG, UPNG
 *  for PNG. Other formats (WebP, KTX2, …) → null, i.e. the mesh stays untextured. */
function bytesToTexture(bytes: Uint8Array, mimeType: string): THREE.Texture | null {
  const mime = mimeType.toLowerCase();
  try {
    let width: number, height: number, data: Uint8Array<ArrayBuffer>;
    if (mime.includes('png')) {
      const img = UPNG.decode(toArrayBuffer(bytes));
      const rgba = UPNG.toRGBA8(img)[0]; // first (only) frame → RGBA bytes
      width = img.width; height = img.height; data = new Uint8Array(rgba);
    } else if (mime.includes('jpeg') || mime.includes('jpg')) {
      const dec = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
      width = dec.width; height = dec.height; data = new Uint8Array(dec.data);
    } else {
      return null; // unsupported format → stay untextured
    }
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false; // glTF texture convention
    // Mipmaps would be generated level by level on upload — pure cost for an
    // avatar that never shrinks below ~200px, and the source of the
    // "EXGL: gl.pixelStorei() doesn't support this parameter yet!" log flood.
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  } catch {
    return null;
  }
}

/** Decode every embedded image and assign it back to the right material's map. */
async function applyEmbeddedTextures(gltf: GLTFResult): Promise<void> {
  const json = gltf.parser?.json;
  const images = json?.images ?? [];
  if (!images.length) return;

  // image index → decoded texture (null for unsupported formats / failures).
  // Two ways a glTF can carry an image, and a GLB uses the second one:
  //   • `uri`        — a base64 data URI (embedded .gltf, e.g. Meshy exports)
  //   • `bufferView` — bytes inside the GLB's binary chunk (any Blender export)
  // Handling only `uri` left every real GLB untextured (a gray silhouette).
  const texByImage = await Promise.all(
    images.map(async (img) => {
      if (img?.uri) return dataUriToTexture(img.uri);
      if (img?.bufferView != null && gltf.parser?.getDependency) {
        const view = (await gltf.parser.getDependency('bufferView', img.bufferView)) as ArrayBuffer;
        return bytesToTexture(new Uint8Array(view), img.mimeType ?? '');
      }
      return null;
    }),
  );
  const decoded = texByImage.filter(Boolean) as THREE.Texture[];
  if (decoded.length < images.length) {
    console.warn(`[BuddyAvatar] decoded ${decoded.length}/${images.length} textures — unsupported format? (only PNG/JPEG)`);
  }
  if (!decoded.length) return;
  // A single-texture avatar (the common Meshy case) → apply it everywhere.
  const single = decoded.length === 1 ? decoded[0] : null;

  const textures = json?.textures ?? [];
  const materials = json?.materials ?? [];
  const assoc = gltf.parser?.associations;

  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) continue; // already textured
      let tex: THREE.Texture | null = null;
      // Exact mapping: material → baseColorTexture → source image.
      const matIndex = assoc?.get(mat)?.materials;
      if (matIndex != null) {
        const texIndex = materials[matIndex]?.pbrMetallicRoughness?.baseColorTexture?.index;
        const src = texIndex != null ? textures[texIndex]?.source : undefined;
        if (src != null) tex = texByImage[src] ?? null;
      }
      tex = tex ?? single;
      if (tex) {
        std.map = tex;
        std.needsUpdate = true;
      }
    }
  });
}
