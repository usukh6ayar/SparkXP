import AsyncStorage from '@react-native-async-storage/async-storage';

/** The lesson the student most recently opened — drives Home "Continue". */
export interface LastLesson {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  type?: string;
  level?: string;
}

const KEY = 'last_lesson';

export async function getLastLesson(): Promise<LastLesson | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LastLesson) : null;
  } catch {
    return null;
  }
}

export async function setLastLesson(lesson: LastLesson): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(lesson));
  } catch {
    // non-critical
  }
}
