import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_ANSWERS,
  loadAnswers,
  saveAnswers,
  type OnboardingAnswers,
} from '../../lib/onboardingAnswers';

interface AnswersState {
  answers: OnboardingAnswers;
  /** Merge a partial answer set; persists to the device on every change. */
  update: (patch: Partial<OnboardingAnswers>) => void;
}

const Ctx = createContext<AnswersState | undefined>(undefined);

/**
 * Holds the onboarding answers for the whole flow.
 *
 * It lives in the flow's `_layout`, not in the screens: onboarding is a route
 * stack, so every step UNMOUNTS when the user moves on and re-mounts when they
 * press back. Step-local state would silently forget the earlier picks, which
 * is exactly what "Back button дарахад өмнөх сонголт хадгалагдана" forbids.
 *
 * Answers are mirrored to AsyncStorage so registration can read them after the
 * flow's routes are gone (and so a mid-flow app kill isn't a total loss).
 */
export function OnboardingAnswersProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULT_ANSWERS);

  // Mirror of the latest value, so `update` never has to close over state (and
  // so its identity stays stable across renders).
  const latest = useRef(answers);
  // Set as soon as the user picks anything. The restore below must not
  // overwrite a fresh choice made while the read was still in flight.
  const touched = useRef(false);

  useEffect(() => {
    loadAnswers().then((stored) => {
      if (touched.current) return;
      latest.current = stored;
      setAnswers(stored);
    });
  }, []);

  const update = useCallback((patch: Partial<OnboardingAnswers>) => {
    touched.current = true;
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setAnswers(next);
    saveAnswers(next);
  }, []);

  return <Ctx.Provider value={{ answers, update }}>{children}</Ctx.Provider>;
}

/** Read/write the onboarding answers. Throws outside the onboarding flow. */
export function useOnboardingAnswers(): AnswersState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useOnboardingAnswers must be used within <OnboardingAnswersProvider>');
  }
  return ctx;
}
