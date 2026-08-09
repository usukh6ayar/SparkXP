import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as authApi from '../api/auth';
import { useAuth } from './AuthContext';
import {
  SocialCancelled,
  isAppleAvailable,
  signInWithApple,
  signInWithGoogle,
} from './socialProviders';

/**
 * Drives the whole Google / Apple flow from a button press.
 *
 * native SDK → `POST /auth/social` → either a session (done) or a pause on the
 * username screen for a first-time user. The pause exists because a SparkXP
 * username is public on leaderboards, so it is the user's to choose rather than
 * something derived from their email.
 */
export function useSocialSignIn() {
  const { applySession } = useAuth();
  const router = useRouter();

  const [busy, setBusy] = useState<authApi.SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which buttons to show: the server decides (config), and Apple additionally
  // needs iOS 13+. Both default to hidden — never offer a button that can't work.
  const [available, setAvailable] = useState({ google: false, apple: false });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [providers, appleOk] = await Promise.all([
        authApi.getSocialProviders(),
        isAppleAvailable(),
      ]);
      if (alive) {
        setAvailable({ google: providers.google, apple: providers.apple && appleOk });
      }
    })();
    return () => { alive = false; };
  }, []);

  const start = useCallback(
    async (provider: authApi.SocialProvider) => {
      setError(null);
      setBusy(provider);
      try {
        // Apple hands over the display name once, on the very first
        // authorisation — carry it to the sign-up screen or it is lost.
        let idToken: string;
        let appleName: string | null = null;
        if (provider === 'apple') {
          const res = await signInWithApple();
          idToken = res.idToken;
          appleName = res.fullName;
        } else {
          idToken = await signInWithGoogle();
        }

        const result = await authApi.socialSignIn(provider, idToken);
        if (result.needsUsername) {
          router.push({
            pathname: '/(auth)/choose-username',
            params: {
              ticket: result.ticket,
              email: result.email,
              suggested: result.suggestedUsername,
              fullName: appleName ?? result.fullName ?? '',
            },
          });
          return;
        }
        await applySession(result); // the auth gate redirects from here
      } catch (e) {
        // Backing out is not a failure — leave the screen exactly as it was.
        if (e instanceof SocialCancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [applySession, router],
  );

  return { available, busy, error, setError, start };
}
