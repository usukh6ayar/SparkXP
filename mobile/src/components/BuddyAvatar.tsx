import { useEffect, useRef, useState } from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, SkeletonUtils } from 'three-stdlib';
import { toByteArray } from 'base64-js';
import { decode as decodeJpeg } from 'jpeg-js';
import UPNG from 'upng-js';
import {
  ARKIT_52, EMOTION_POSES, GESTURE_POSES, blend, blinkPose, composeFace, estimateSpeechMs,
  missingArkitShapes, textToVisemes, visemePoseAt, type Pose, type Viseme,
} from './buddyFace';
import { azurePoseAt, type VisemeCue } from './azureVisemes';

/**
 * 3D AI Buddy avatar (Meshy-generated GLB rendered with three.js on expo-gl).
 *
 * - Loads the GLB from `assetUrl` (set per-buddy in admin → `avatarAssetUrl`).
 * - Plays the `idle` animation on loop; on each turn the parent passes the
 *   LLM `emotion`/`gesture` and we crossfade to the mapped animation clip.
 * - **Lip-sync:** two sources, best first.
 *   1. `visemes` — real `(VisemeId, AudioOffset)` cues from the TTS provider
 *      (Azure HD Voice). Timing comes from the engine that made the audio, so
 *      the mouth matches the voice exactly.
 *   2. `speechText` — no cues from the provider, so the shapes are derived from
 *      the reply text and stretched over the audio's length. Approximate, but
 *      every syllable still lands on a plausible shape.
 *   Either way the timeline is read with the **audio player's own clock**
 *   (`speechPositionMs`), never a local timer — see docs/AZURE_VISEME_PLAN.md.
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
  /**
   * Timed mouth-shape cues from the TTS provider. When present these replace the
   * text-derived guess entirely. Empty/absent = fall back to `speechText`.
   */
  visemes?: VisemeCue[] | null;
  /**
   * Where the reply audio actually is, in ms (expo-audio `currentTime` × 1000).
   * This is the master clock: status updates are coarse, so the avatar advances
   * its own clock between them and re-syncs to this value every time it changes.
   * Without it the mouth free-runs and drifts from the voice.
   */
  speechPositionMs?: number | null;
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
 * How much of the frame the model fills — as a fraction of whichever axis runs
 * out first (a "contain" fit).
 *
 * Two things were tried and both were wrong:
 *   - fitting by HEIGHT alone to a fixed 1.3 world units, which ignored how big
 *     the canvas actually was and left the buddy reading small;
 *   - fitting by WIDTH, which put the ears at the screen edges but made the
 *     model far taller than the frame, so the body ran off the bottom and only
 *     a head was left.
 *
 * Taking the smaller of the two scales is a "contain" fit — the largest the
 * character can be while entirely on screen. Side margins are then just the
 * model's own aspect ratio: a bust is narrower than it is tall.
 *
 * Kept a hair above 1 so the character meets the frame edges instead of sitting
 * in a visible margin — but only a hair. It was 1.12 for a while and the extra
 * came out of the bottom of the torso, which is the buddy's body: growth has to
 * come from giving the frame more HEIGHT (see BUBBLE_SLOT_H), never from
 * cropping. Whatever little does overflow is pushed to the bottom, so the head
 * is never clipped.
 */
const FIT_FILL = 1.02;

/** Avatar render rate. Half of 60 fps is imperceptible here and frees JS time. */
const AVATAR_FPS = 30;

/** Frame rate while a turn is being processed — just enough to not look frozen. */
const LOW_POWER_FPS = 8;

/**
 * How long a gesture is held, in ms. Long enough to be seen and understood,
 * short enough that the buddy is back to its emotion before the next turn.
 */
const GESTURE_MS = 1400;

/** How far the head pitches on `small_nod`, in radians. */
const NOD_ANGLE = 0.13;

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
  visemes, speechPositionMs, lowPower, onReady, style,
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
          visemes={visemes}
          speechPositionMs={speechPositionMs}
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
  visemes, speechPositionMs,
}: Loaded &
  Pick<Props,
    | 'emotion' | 'gesture' | 'emotionMap' | 'isSpeaking'
    | 'speechText' | 'speechDurationMs' | 'visemes' | 'speechPositionMs'>) {
  // Canvas size in PIXELS and the camera, from which the visible area is derived
  // below. Deliberately not `state.viewport`: that is already in world units, so
  // reading it hides the aspect maths — and its identity does not reliably change
  // on resize, which left the model fitted for a stale canvas. `size` does.
  const size3d = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const current = useRef<THREE.AnimationAction | null>(null);
  /** lowercased blendshape name → every (mesh, morph index) that carries it. */
  const shapes = useRef(new Map<string, { mesh: THREE.Mesh; index: number }[]>());
  const jaw = useRef<THREE.Bone | null>(null);
  /** Current on-screen weights, eased towards the target pose each frame. */
  const live = useRef<Pose>({});
  const idleT = useRef(0);
  const baseY = useRef(0);
  // Lip-sync state. `cues` is the provider's real timeline when we have one;
  // `textVisemes` is the text-derived fallback. `speechT` is the playback clock.
  const cues = useRef<VisemeCue[]>([]);
  const textVisemes = useRef<Viseme[]>([]);
  const speechT = useRef(0);
  const speechMs = useRef(0);
  // Gesture state: ms into the current gesture, or -1 when none is playing.
  const gestureT = useRef(-1);
  const gestureTag = useRef<string | null>(null);
  // Blink state: seconds until the next blink, then how far through it we are.
  const nextBlink = useRef(2 + Math.random() * 3);
  const blinkT = useRef(-1);

  // One-time setup: center/scale the model, wire the mixer, find mouth targets.
  useEffect(() => {
    // What the camera can see at z = 0, in world units. The vertical FOV is
    // fixed, so the visible HEIGHT never changes with the canvas — only the
    // width does, through the aspect ratio. Fitting has to account for that or
    // a taller canvas silently shrinks the model.
    const cam = camera as THREE.PerspectiveCamera;
    const frameH = 2 * Math.tan(((cam.fov ?? 32) * Math.PI) / 360) * Math.abs(cam.position.z);
    const frameW = frameH * (size3d.height > 0 ? size3d.width / size3d.height : 1);

    // Fit INSIDE that frame and centre it.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = Math.min(
      size.x > 0 ? (frameW * FIT_FILL) / size.x : 1,
      size.y > 0 ? (frameH * FIT_FILL) / size.y : 1,
    );
    scene.scale.setScalar(scale);
    // Centred, then pushed down by however much taller than the frame it ended
    // up — so the top of the head lands on the frame's top edge and everything
    // that doesn't fit is lost from the bottom of the torso instead.
    const overflowY = Math.max(0, size.y * scale - frameH);
    scene.position.set(
      -center.x * scale,
      -center.y * scale - overflowY / 2,
      -center.z * scale,
    );
    baseY.current = scene.position.y;

    if (__DEV__) {
      console.log(
        `[BuddyAvatar] fit: canvas ${size3d.width}×${size3d.height}px · ` +
        `frame ${frameW.toFixed(2)}×${frameH.toFixed(2)} · ` +
        `model ${(size.x / size.y).toFixed(2)} w/h · ` +
        `fills ${((size.x * scale) / frameW * 100).toFixed(0)}% wide, ` +
        `${((size.y * scale) / frameH * 100).toFixed(0)}% tall`,
      );
    }

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

    // Rig check (Azure brief §5). A missing shape is silent — the weight is
    // written nowhere — so say it out loud in dev rather than leaving someone
    // to wonder why this buddy never closes its lips.
    if (__DEV__) {
      const missing = missingArkitShapes(byName.keys());
      let meshes = 0;
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
      console.log(
        `[BuddyAvatar] rig: ${byName.size} morph targets ` +
        `(${ARKIT_52.length - missing.length}/52 ARKit), ${meshes} meshes, ` +
        `${animations.length} clips` +
        (missing.length ? `\n  missing: ${missing.join(', ')}` : ''),
      );
    }

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
  }, [scene, size3d.width, size3d.height]);

  // A new reply → build its mouth-shape sequence and restart the lip-sync clock.
  // Rebuilt on text change (not on `isSpeaking`) so replaying the same audio
  // reuses the same timeline.
  useEffect(() => {
    const text = speechText?.trim() ?? '';
    textVisemes.current = text ? textToVisemes(text) : [];
    speechMs.current = speechDurationMs && speechDurationMs > 0
      ? speechDurationMs
      : estimateSpeechMs(text);
    speechT.current = 0;
  }, [speechText, speechDurationMs]);

  // Restart the clock whenever the audio starts, so shapes line up with the voice.
  useEffect(() => { if (isSpeaking) speechT.current = 0; }, [isSpeaking]);

  // The provider's timed cues for the current reply. Held in a ref: only the
  // frame loop reads them, so a new timeline must not re-render the canvas.
  useEffect(() => { cues.current = visemes ?? []; }, [visemes]);

  // Re-sync to the audio player's clock — playback is the master clock, not us.
  // expo-audio reports its position on its own cadence, so the frame loop keeps
  // counting between reports and this snaps it back whenever truth arrives.
  // That is also the whole frame-drop story: a late frame just reads a later
  // position and picks the shape belonging to *now* instead of replaying.
  useEffect(() => {
    if (speechPositionMs != null && speechPositionMs >= 0) speechT.current = speechPositionMs;
  }, [speechPositionMs]);

  // React to a new emotion/gesture.
  //
  // Two paths, and the second one is the one that actually fires today: a rig
  // WITH animation clips crossfades to the matching clip, and a rig without —
  // which is every buddy currently shipped — plays the gesture on the face and
  // head instead. Before this, a gesture on a clipless rig did nothing at all,
  // so every `wave` / `thumbs_up` / `small_nod` the LLM asked for was silently
  // dropped.
  useEffect(() => {
    const tag = emotionMap?.[gesture ?? ''] ?? emotionMap?.[emotion ?? ''] ?? gesture ?? emotion;
    if (!tag || tag === 'idle' || tag === 'calm') { playClip(pickClip(animations, 'idle'), true); return; }
    const clip = pickClip(animations, tag);
    if (clip) { playClip(clip, false); return; }
    if (gesture && GESTURE_POSES[gesture] && gesture !== 'idle') {
      gestureTag.current = gesture;
      gestureT.current = 0;
    }
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

    // These avatars ship with no animation clips. They used to be given a slow
    // turn and a bob to look alive; at the size the buddy is drawn now that read
    // as the character drifting and swaying on its own, which is worse than
    // stillness. What is left is a breath — small enough to be felt rather than
    // watched — and NO rotation: a body that turns by itself is the part the eye
    // actually catches. The blink and the face are what carry the life.
    if (!animations.length) {
      idleT.current += delta;
      scene.position.y = baseY.current + Math.sin(idleT.current * 0.9) * 0.005;
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
    if (isSpeaking) {
      speechT.current += delta * 1000;
      mouth = cues.current.length
        // Real cues from the TTS engine — exact timing, no stretching needed.
        ? azurePoseAt(cues.current, speechT.current)
        // No cues: shapes guessed from the text, stretched over the audio length.
        : visemePoseAt(textVisemes.current, speechT.current, speechMs.current);
    }

    // Gesture layer: a bell curve over GESTURE_MS, blended over the emotion so
    // the face eases into the gesture and back out instead of snapping.
    let expression = EMOTION_POSES[emotion ?? 'calm'] ?? EMOTION_POSES.calm;
    if (gestureT.current >= 0) {
      gestureT.current += delta * 1000;
      const p = gestureT.current / GESTURE_MS;
      if (p >= 1) {
        gestureT.current = -1;
        gestureTag.current = null;
        if (!animations.length) scene.rotation.x = 0;
      } else {
        const weight = Math.sin(p * Math.PI); // 0 → 1 → 0
        const pose = GESTURE_POSES[gestureTag.current ?? ''] ?? {};
        expression = blend(expression, pose, weight);
        // A nod is the one gesture the face can't carry on its own.
        if (gestureTag.current === 'small_nod' && !animations.length) {
          scene.rotation.x = Math.sin(p * Math.PI * 4) * NOD_ANGLE * weight;
        }
      }
    }
    // Layered, not merged: speech owns the mouth, emotion owns eyes and brows,
    // the blink rides on top of both. See `composeFace`.
    applyPose(composeFace(expression, mouth, blinkPose(blinkProgress), !!isSpeaking), delta);
  });

  /** Ease the live weights towards `target` and push them into the meshes. */
  function applyPose(target: Pose, delta: number) {
    const rig = shapes.current;
    if (!rig.size) {
      // Rigs without blendshapes (e.g. the police model) still get a moving jaw.
      // This has to run BEFORE the return — it used to sit at the end of the
      // function behind the same `!rig.size` check, so it never ran at all.
      if (jaw.current) jaw.current.rotation.x = (target.jawOpen ?? 0) * 0.3;
      return;
    }
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
  // Name the file. When a rig turns out to have fewer blendshapes than the one
  // that was commissioned, the first question is always "is the app even
  // loading that file?" — and admin can point a buddy at an older upload.
  if (__DEV__) console.log(`[BuddyAvatar] loading ${mb.toFixed(2)} MB — ${url}`);
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
