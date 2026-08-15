/**
 * The reader's bookmark: load where this passage was left off, and keep that
 * point up to date on the server as the pages turn.
 *
 * Writes are debounced because a bookmark is worth exactly one request per
 * pause, not one per page turn — someone flicking through eight pages should
 * cost one PUT, and the last position is the only one that matters. A pending
 * write is flushed on unmount, so leaving the screen right after a page turn
 * still records where you stopped.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getReadingProgress, saveReadingProgress } from '../api/reading';

/** Quiet time after the last page turn before the bookmark is written. */
const SAVE_DELAY = 1200;

export function useReadingBookmark(id: string | undefined, token: string | null) {
  /** Sentence to resume at; null until the server has answered. */
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last index actually written, so an unchanged position costs nothing. */
  const savedRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const write = useCallback(
    (index: number) => {
      if (!id || !token || index === savedRef.current) return;
      savedRef.current = index;
      pendingRef.current = null;
      saveReadingProgress(id, index, token).catch(() => {
        // Best-effort: a lost bookmark must never interrupt reading. Clearing
        // the mark lets the next page turn retry the same position.
        savedRef.current = null;
      });
    },
    [id, token],
  );

  // Load the bookmark once per passage. A finished passage resumes at the top:
  // re-reading it is a fresh read, not a continuation.
  useEffect(() => {
    let active = true;
    if (!id || !token) {
      setResumeIndex(0);
      return;
    }
    setResumeIndex(null);
    getReadingProgress(token)
      .then((rows) => {
        if (!active) return;
        const row = rows.find((r) => r.passageId === id);
        const at = row && !row.completedAt ? row.sentenceIndex ?? 0 : 0;
        savedRef.current = at;
        setResumeIndex(at);
      })
      .catch(() => {
        if (active) setResumeIndex(0); // no bookmark beats a stuck reader
      });
    return () => {
      active = false;
    };
  }, [id, token]);

  /** Called as the reader moves — records the sentence they are now on. */
  const mark = useCallback(
    (index: number) => {
      if (index < 0) return;
      pendingRef.current = index;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => write(index), SAVE_DELAY);
    },
    [write],
  );

  // Flush on unmount (and on passage change) — see the note at the top.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      const pending = pendingRef.current;
      if (pending != null) write(pending);
    };
  }, [write]);

  return { resumeIndex, mark };
}
