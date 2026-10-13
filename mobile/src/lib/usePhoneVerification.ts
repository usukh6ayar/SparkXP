import { useCallback, useEffect, useRef, useState } from 'react';
import { getPhoneStatus, type PhoneSession } from '../api/phone';
import { ApiError } from '../api/client';

export type VerifyState = 'idle' | 'starting' | 'waiting' | 'verified' | 'expired';

/** verify.mn asks for ≥3 s between polls — SMS delivery is not sub-second. */
const POLL_MS = 3_000;

/**
 * One phone verification: start it with any `start*` API call, then this polls
 * our backend until verified / expired. Stops polling the moment it is verified
 * (every extra SMS costs the user 150₮) and on unmount.
 *
 *   const v = usePhoneVerification();
 *   await v.start(() => startPhoneVerification(phone, 'login'));
 *   useEffect(() => { if (v.state === 'verified') loginWithPhone(v.verificationId!) }, [v.state]);
 */
export function usePhoneVerification() {
  const [session, setSession] = useState<PhoneSession | null>(null);
  const [state, setState] = useState<VerifyState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const alive = useRef(true);

  // Re-armed on mount so React's dev double-mount doesn't leave it false.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const start = useCallback(async (begin: () => Promise<PhoneSession>) => {
    setError(null);
    setState('starting');
    try {
      const s = await begin();
      if (!alive.current) return;
      setSession(s);
      setState('waiting');
    } catch (e) {
      if (!alive.current) return;
      setState('idle');
      setError(e instanceof ApiError ? e : new ApiError(0, String(e)));
      throw e;
    }
  }, []);

  // Poll + countdown while waiting.
  useEffect(() => {
    if (state !== 'waiting' || !session) return;
    const deadline = Date.parse(session.expiresAt);
    const tick = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const clock = setInterval(tick, 1_000);
    const poll = setInterval(async () => {
      if (Date.now() >= deadline) {
        setState('expired');
        return;
      }
      try {
        const { status } = await getPhoneStatus(session.verificationId);
        if (!alive.current) return;
        if (status === 'verified') setState('verified');
        else if (status === 'expired') setState('expired');
      } catch {
        // Network blip: keep polling until the deadline — no error on screen.
      }
    }, POLL_MS);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [state, session]);

  const reset = useCallback(() => {
    setSession(null);
    setState('idle');
    setError(null);
  }, []);

  return {
    state,
    session,
    verificationId: session?.verificationId ?? null,
    secondsLeft,
    error,
    start,
    reset,
  };
}

export type PhoneVerification = ReturnType<typeof usePhoneVerification>;
