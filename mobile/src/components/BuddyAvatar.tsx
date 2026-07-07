import { useEffect, useRef, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { toByteArray } from 'base64-js';
import { decode as decodeJpeg } from 'jpeg-js';
import UPNG from 'upng-js';

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
  style?: ViewStyle;
}

interface Loaded {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export function BuddyAvatar({ assetUrl, emotion, gesture, emotionMap, isSpeaking, style }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(null);
    if (!assetUrl) return;
    loadGlb(assetUrl)
      .then((res) => { if (alive) setLoaded(res); })
      .catch(() => { if (alive) setLoaded(null); }); // parent shows 2D fallback
    return () => { alive = false; };
  }, [assetUrl]);

  if (!loaded) return null;

  return (
    <View style={style} pointerEvents="none">
      <Canvas
        camera={{ position: [0, 0.2, 2.6], fov: 32 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        // Cap pixel ratio so hi-DPI phones don't render a huge buffer (FPS/heat).
        dpr={[1, 2]}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} />
        <BuddyModel
          scene={loaded.scene}
          animations={loaded.animations}
          emotion={emotion}
          gesture={gesture}
          emotionMap={emotionMap}
          isSpeaking={isSpeaking}
        />
      </Canvas>
    </View>
  );
}

function BuddyModel({
  scene, animations, emotion, gesture, emotionMap, isSpeaking,
}: Loaded & Pick<Props, 'emotion' | 'gesture' | 'emotionMap' | 'isSpeaking'>) {
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const current = useRef<THREE.AnimationAction | null>(null);
  const mouths = useRef<{ mesh: THREE.Mesh; index: number }[]>([]);
  const jaw = useRef<THREE.Bone | null>(null);
  const mouthValue = useRef(0);
  const jabberT = useRef(0);

  // One-time setup: center/scale the model, wire the mixer, find mouth targets.
  useEffect(() => {
    // Fit: center the model at origin and normalize height to ~1.6 units.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = size.y > 0 ? 1.6 / size.y : 1;
    scene.scale.setScalar(scale);
    scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const mx = new THREE.AnimationMixer(scene);
    mixer.current = mx;
    mouths.current = [];
    scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
          if (/mouth|open|jaw|aa|viseme/i.test(name)) mouths.current.push({ mesh, index: idx as number });
        }
      }
      if ((obj as THREE.Bone).isBone && /jaw/i.test(obj.name)) jaw.current = obj as THREE.Bone;
    });

    // When a one-shot emotion/gesture clip ends, settle back to the idle loop.
    const onFinished = () => playClip(pickClip(animations, 'idle'), true);
    mx.addEventListener('finished', onFinished);

    playClip(pickClip(animations, 'idle'), true);

    return () => {
      mx.removeEventListener('finished', onFinished);
      mx.stopAllAction();
      // Free GPU memory so switching buddies doesn't leak (low-end Android).
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mm) => {
          const std = mm as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.dispose?.();
        });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

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

    // Procedural lip-sync: open/close the mouth while audio plays.
    jabberT.current += delta;
    const target = isSpeaking ? mouthCurve(jabberT.current) : 0;
    mouthValue.current += (target - mouthValue.current) * Math.min(1, delta * 18); // smooth
    const v = mouthValue.current;
    for (const m of mouths.current) {
      if (m.mesh.morphTargetInfluences) m.mesh.morphTargetInfluences[m.index] = v;
    }
    if (jaw.current) jaw.current.rotation.x = v * 0.3; // fallback if no morph
  });

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

/** Talking-mouth openness 0–1 from two out-of-phase sines (natural-ish jabber). */
function mouthCurve(t: number): number {
  const a = Math.sin(t * 11) * 0.5 + 0.5;
  const b = Math.sin(t * 19 + 1.3) * 0.5 + 0.5;
  return Math.min(1, a * 0.6 + b * 0.4) * 0.85;
}

/** Fetch + parse a remote GLB into a scene + clips, then decode its textures. */
async function loadGlb(url: string): Promise<Loaded> {
  const buffer = await (await fetch(url)).arrayBuffer();
  const gltf = await new Promise<GLTFResult>((resolve, reject) => {
    new GLTFLoader().parse(buffer, '', resolve as (g: unknown) => void, reject);
  });
  // RN three.js can't decode embedded base64 textures (no DOM image decoder), so
  // GLTFLoader leaves the mesh untextured. Decode them ourselves — best-effort:
  // on any failure the avatar just stays untextured (never crashes).
  try {
    applyEmbeddedTextures(gltf);
  } catch {
    /* keep untextured */
  }
  return { scene: gltf.scene as unknown as THREE.Group, animations: gltf.animations };
}

/** Minimal shape of what we read off the parsed glTF (parser.json + associations). */
interface GLTFResult {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  parser?: {
    json?: {
      images?: { uri?: string }[];
      textures?: { source?: number }[];
      materials?: { pbrMetallicRoughness?: { baseColorTexture?: { index?: number } } }[];
    };
    associations?: Map<object, { materials?: number }>;
  };
}

/** Exact-size ArrayBuffer from a Uint8Array (avoids passing a larger backing buffer). */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Decode a `data:image/(jpeg|png);base64,…` URI into a GPU-uploadable DataTexture.
 *  RN has no DOM image decoder, so we decode in pure JS: jpeg-js for JPEG, UPNG
 *  for PNG (Meshy commonly exports PNG base-colour maps). Other formats → null. */
function dataUriToTexture(uri: string): THREE.Texture | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(uri);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  try {
    const bytes = toByteArray(m[2]);
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
    tex.needsUpdate = true;
    return tex;
  } catch {
    return null;
  }
}

/** Decode every embedded image and assign it back to the right material's map. */
function applyEmbeddedTextures(gltf: GLTFResult): void {
  const json = gltf.parser?.json;
  const images = json?.images ?? [];
  if (!images.length) return;

  // image index → decoded texture (null for non-data-URI / non-JPEG / failures).
  const texByImage = images.map((img) => (img?.uri ? dataUriToTexture(img.uri) : null));
  const decoded = texByImage.filter(Boolean) as THREE.Texture[];
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
