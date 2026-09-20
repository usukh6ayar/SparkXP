import { Platform } from 'react-native';
import * as Device from 'expo-device';

/**
 * 3D GLB avatars (BuddyAvatar.tsx, three.js/expo-gl) are on.
 *
 * Both BuddySelector.tsx (buddy carousel) and BuddyVoiceStage.tsx (the voice
 * screen) read this single flag, so there is one place to turn 3D off, not two.
 */
const ENABLED = true;

/**
 * expo-gl draws NOTHING on the iOS Simulator: the GL view mounts, the GLB
 * parses, `onReady(true)` fires — and the surface stays empty. Verified on
 * 2026-09-20 against a buddy that has both a `.glb` and a thumbnail, where the
 * stage showed neither the loading spinner nor the model.
 *
 * That silent success is the problem: `BuddyAvatar` only falls back to the 2D
 * picture when the GLB fails to LOAD, which on the simulator it never does. So
 * the check belongs here, before `has3d` is decided — otherwise every developer
 * on a simulator sees an empty room and has to hand-edit this file to work on
 * the screen (and risks committing the edit).
 *
 * Scoped to the iOS simulator on purpose: Android emulators do render GL.
 */
const IOS_SIMULATOR = Platform.OS === 'ios' && !Device.isDevice;

/** True when the 3D avatar can actually be drawn on this device. */
export const SHOW_3D_AVATAR = ENABLED && !IOS_SIMULATOR;
