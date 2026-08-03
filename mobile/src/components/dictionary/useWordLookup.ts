/**
 * One word (or sentence) lookup: the request, its pronunciation and its save
 * button. Shared by the two dictionary surfaces — the small reader popover and
 * the full search panel — so they behave identically without sharing state:
 * each surface owns its own instance, and looking a word up in one never
 * disturbs the other.
 */
import { useCallback, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useAuth } from '../../auth/AuthContext';
import { haptics } from '../../lib/haptics';
import {
  lookupWord,
  translateSentence,
  getWordAudio,
  saveWord,
  type WordLookup,
} from '../../api/dictionary';
import { ApiError } from '../../api/client';
import { t } from '../../i18n';

/** Read English aloud with the device voice (audio fallback + examples). */
export function speakEnglish(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 0.9 });
}

export interface WordLookupState {
  /** The word/sentence being shown, or null when nothing is loaded. */
  word: string | null;
  /** True when `word` is a whole sentence (translation, not a dictionary entry). */
  isPhrase: boolean;
  loading: boolean;
  result: WordLookup | null;
  error: string | null;
  audioBusy: boolean;
  saved: boolean;
  saveBusy: boolean;
  lookup: (word: string) => void;
  translate: (text: string) => void;
  speak: () => void;
  save: () => void;
  reset: () => void;
}

export function useWordLookup(): WordLookupState {
  const { token } = useAuth();
  const player = useAudioPlayer();

  const [word, setWord] = useState<string | null>(null);
  const [isPhrase, setIsPhrase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WordLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  /** Clear everything back to "nothing looked up". */
  const reset = useCallback(() => {
    Speech.stop();
    setWord(null);
    setResult(null);
    setError(null);
    setSaved(false);
    setLoading(false);
    setIsPhrase(false);
  }, []);

  /** Put a request in flight and show its subject immediately. */
  const begin = (text: string, phrase: boolean) => {
    setIsPhrase(phrase);
    setWord(text);
    setResult(null);
    setError(null);
    setSaved(false);
    setLoading(true);
    haptics.select();
  };

  const lookup = useCallback(
    async (raw: string) => {
      const clean = raw.trim().toLowerCase();
      if (!clean || !token) return;
      begin(clean, false);
      try {
        setResult(await lookupWord(token, clean));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('notFoundShort'));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const translate = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || !token) return;
      begin(text, true);
      try {
        const { translation } = await translateSentence(token, text);
        setResult({ word: text, translation, audioUrl: null, cached: false });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('notFoundShort'));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // Prefer the ElevenLabs clip (generated + cached on the backend), fall back
  // to the device voice so it always says something.
  const speak = useCallback(async () => {
    if (!word) return;
    if (isPhrase) return speakEnglish(word); // no per-sentence ElevenLabs

    const playUrl = (uri: string) => {
      try {
        player.replace({ uri });
        player.play();
        return true;
      } catch {
        return false;
      }
    };
    if (result?.audioUrl && playUrl(result.audioUrl)) return;
    if (token) {
      setAudioBusy(true);
      try {
        const { audioUrl } = await getWordAudio(token, word);
        setResult((r) => (r ? { ...r, audioUrl } : r));
        if (playUrl(audioUrl)) return;
      } catch {
        // fall through to device TTS
      } finally {
        setAudioBusy(false);
      }
    }
    speakEnglish(word);
  }, [word, result, token, player, isPhrase]);

  /** Add the word (+ its translation) to the user's saved vocabulary. */
  const save = useCallback(async () => {
    if (!word || !token || saved || saveBusy) return;
    setSaveBusy(true);
    try {
      await saveWord(token, word);
      setSaved(true);
      haptics.success();
    } catch {
      // ignore — keep the icon un-saved so the user can retry
    } finally {
      setSaveBusy(false);
    }
  }, [word, token, saved, saveBusy]);

  return {
    word,
    isPhrase,
    loading,
    result,
    error,
    audioBusy,
    saved,
    saveBusy,
    lookup,
    translate,
    speak,
    save,
    reset,
  };
}
