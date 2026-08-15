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
  searchWord,
  toggleDictionarySave,
  type WordLookup,
} from '../../api/dictionary';
import { ApiError } from '../../api/client';
import { forgetSavedWords } from '../../lib/newWords';
import { t } from '../../i18n';

/** Read English aloud with the device voice (audio fallback + examples). */
export function speakEnglish(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 0.9 });
}

/**
 * Process-lifetime cache of resolved lookups, so re-opening a word (swipe back →
 * search it again, or tapping a recent) is instant instead of another round
 * trip. Keyed by mode + word because the two surfaces ask for different shapes
 * (the panel's 4-sense result vs the popover's short gloss). Dictionary entries
 * are immutable server-side, so a cached hit never goes stale.
 */
const lookupCache = new Map<string, WordLookup>();
const cacheKey = (word: string, detailed: boolean) => `${detailed ? 'd' : 's'}:${word}`;

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

/**
 * @param detailed  The dictionary panel passes `true` to get the full 4-sense
 *                  result (`GET /dictionary/search/:word`). The reader popover
 *                  leaves it off and keeps the single short gloss.
 */
export function useWordLookup({ detailed = false } = {}): WordLookupState {
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
      // Same normalisation as the server's `normaliseWord`, whitespace collapse
      // included — the panel takes typed text, which can carry double spaces.
      const clean = raw.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!clean || !token) return;
      begin(clean, false);

      // Instant hit from a previous lookup — no spinner, no request.
      const cached = lookupCache.get(cacheKey(clean, detailed));
      if (cached) {
        setResult(cached);
        setLoading(false);
        return;
      }

      try {
        let res: WordLookup;
        if (detailed) {
          // Dictionary panel: the word's own meaning + the full 4-sense result.
          // It carries no audioUrl — speak() fetches that lazily from
          // /:word/audio, which is unchanged.
          const { translation, senses } = await searchWord(token, clean);
          res = {
            word: clean,
            // '' (not null) so the panel's `translation ? ...` checks stay
            // simple — an empty string means "no meaning line".
            translation: translation ?? '',
            audioUrl: null,
            cached: false,
            meanings: senses,
          };
        } else {
          // Reader popover: deliberately still one short gloss, so a tap while
          // reading stays fast and small.
          res = await lookupWord(token, clean);
        }
        lookupCache.set(cacheKey(clean, detailed), res);
        setResult(res);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('notFoundShort'));
      } finally {
        setLoading(false);
      }
    },
    [token, detailed],
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

  /**
   * Toggle ⭐ for this word. Writes to `user_dictionary_saves` — unlike the old
   * endpoint it replaces, it never creates a row in the curated word bank.
   * Pressing again un-saves, so there is no `saved` guard here.
   */
  const save = useCallback(async () => {
    if (!word || !token || saveBusy) return;
    setSaveBusy(true);
    try {
      const { saved: isSaved } = await toggleDictionarySave(token, word);
      setSaved(isSaved);
      forgetSavedWords(); // the reading list's "шинэ үг" counts just changed
      if (isSaved) haptics.success();
    } catch {
      // ignore — leave the icon as it was so the user can retry
    } finally {
      setSaveBusy(false);
    }
  }, [word, token, saveBusy]);

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
