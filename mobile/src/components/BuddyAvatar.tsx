import { useEffect, useRef, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

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
        gl={{ alpha: true }}
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

    mixer.current = new THREE.AnimationMixer(scene);
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

    playClip(pickClip(animations, 'idle'), true);
    return () => { mixer.current?.stopAllAction(); };
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

/** Fetch + parse a remote GLB into a scene + clips (embedded textures decoded by three). */
async function loadGlb(url: string): Promise<Loaded> {
  const buffer = await (await fetch(url)).arrayBuffer();
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      buffer,
      '',
      (gltf) => resolve({ scene: gltf.scene as unknown as THREE.Group, animations: gltf.animations }),
      reject,
    );
  });
}
