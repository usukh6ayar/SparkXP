import { useState, useMemo, useEffect } from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '../../src/components/AppIcon';
import { useAuth } from '../../src/auth/AuthContext';
import { haptics } from '../../src/lib/haptics';
import { isValidUsername } from '../../src/lib/username';
import { shake, useReduceMotion } from '../../src/lib/motion';
import * as authApi from '../../src/api/auth';
import { peekPendingReferral, clearPendingReferral } from '../../src/lib/referralLink';
import { peekTasteCompleted, clearTasteCompleted } from '../../src/lib/tasteTask';
import {
  loadAnswers,
  clearAnswers,
  levelForRegister,
  MINUTES_TO_DAILY_XP,
  type OnboardingAnswers,
} from '../../src/lib/onboardingAnswers';
import { setDailyGoal } from '../../src/api/gamification';
import type { AuthResult } from '../../src/api/auth';
import { t } from '../../src/i18n';
import { spacing, radius, type AppColors } from '../../src/theme/theme';
import { ms } from '../../src/theme/responsive';
import { useColors } from '../../src/settings/SettingsContext';
import { MN_PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { CEFR_LEVELS } from '../../src/constants/levels';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { ActionButton } from '../../src/components/ActionButton';
import { FormError } from '../../src/components/FormError';
import { AuthFooter } from '../../src/components/AuthFooter';

const mapFox = require('../../assets/onboarding/map-fox.webp');
const successFox = require('../../assets/onboarding/success-fox.webp');

// A few confetti dots scattered behind the success mascot (decorative,
// brand/semantic colors — identical in both themes).
const CONFETTI = [
  { top: 0, left: 30, color: '#6C3BFF' }, // primary
  { top: 20, right: 24, color: '#FFC93C' }, // xp
  { top: 70, left: 8, color: '#4FC3F7' }, // sparks
  { top: 60, right: 6, color: '#34D399' }, // success
  { top: 110, left: 40, color: '#FF8A3D' }, // streak
  { top: 120, right: 36, color: '#5A28F0' }, // primaryDark
];

// Placement levels (CEFR) — shared with the edit-profile form.
const LEVELS = CEFR_LEVELS;

// Password requirement checks (mirrored in the rules card).
const rules = {
  minLen: (p: string) => p.length >= 8,
  letterCase: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  number: (p: string) => /[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p),
};

/** One password-requirement row that turns green once satisfied. */
function Rule({ ok, label }: { ok: boolean; label: string }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.ruleRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={ok ? colors.success : colors.textMuted}
      />
      <AppText variant="caption" color={ok ? colors.text : colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

export default function RegisterScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { applySession } = useAuth();
  const router = useRouter();

  /**
   * `?verifyEmail=<address>` drops the user straight onto the OTP step.
   *
   * Sign-in uses this: an account that never entered its code is refused by the
   * backend with `EMAIL_NOT_VERIFIED`, and finishing that code is the only way
   * forward — so the user is sent here rather than left on a login form that
   * will keep failing. The rest of the wizard's state stays empty; the OTP step
   * only needs the address.
   */
  const { verifyEmail } = useLocalSearchParams<{ verifyEmail?: string }>();
  const resumingVerification = typeof verifyEmail === 'string' && verifyEmail.length > 0;

  type Step = 'info' | 'location' | 'placement' | 'otp' | 'success';
  const [step, setStep] = useState<Step>(resumingVerification ? 'otp' : 'info');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(resumingVerification ? verifyEmail : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [province, setProvince] = useState<string | undefined>();
  const [district, setDistrict] = useState<string | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [referral, setReferral] = useState<string | null>(null);
  // Guest finished the pre-signup taste-task → claim its one-time XP bonus (C4).
  const [tasteDone, setTasteDone] = useState(false);
  // Answers from the onboarding flow — used to pre-select the level and to set
  // the daily goal once the new account has a session.
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [result, setResult] = useState<AuthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReduceMotion();

  // Shake the form + error haptic on any validation / submit failure.
  const shakeX = useSharedValue(0);
  const formStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const fail = (msg: string) => {
    setError(msg);
    haptics.error();
    if (!reduce) shakeX.value = shake();
  };

  // Pick up a referral code captured from an `sparkxp://invite/CODE` deep link
  // (stashed while the user was logged out). Applied when the account is created.
  useEffect(() => {
    peekPendingReferral().then(setReferral);
    peekTasteCompleted().then(setTasteDone);
    // Pre-select the level the user already told onboarding about, so the
    // placement step confirms a choice instead of re-asking it. "Түвшнээ
    // мэдэхгүй" resolves to undefined — that user must still pick a real one.
    loadAnswers().then((a) => {
      setAnswers(a);
      setLevel((current) => current ?? levelForRegister(a.level));
    });
  }, []);

  const isUB = province === 'Улаанбаатар';
  const passOk = rules.minLen(password) && rules.letterCase(password) && rules.number(password);
  const usernameOk = isValidUsername(username);
  const infoValid = usernameOk && fullName.trim() && email.trim() && passOk && confirm === password;

  function onProvinceChange(value: string) {
    setProvince(value);
    if (value !== 'Улаанбаатар') setDistrict(undefined);
  }

  function goInfoNext() {
    setError(null);
    if (!passOk) return fail(t('required'));
    if (confirm !== password) return fail(t('passwordMismatch'));
    setStep('location');
  }

  // Placement → create the (unverified) account; backend emails an OTP.
  async function submit() {
    setError(null);
    await authApi.register({
      username: username.trim(),
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      level,
      province,
      district: isUB ? district : undefined,
      referralCode: referral ?? undefined,
      tasteCompleted: tasteDone || undefined,
    });
    // Account created — the referral code has been handed to the backend, so
    // clear the stash to avoid re-applying it to a later sign-up on this device.
    if (referral) clearPendingReferral();
    if (tasteDone) clearTasteCompleted();
  }

  /**
   * Carry the onboarding daily-goal choice onto the brand-new account.
   *
   * Called only right after the first verification of a NEW account — never on
   * login — so a returning user who happens to walk the flow can't have their
   * existing goal silently overwritten. Best-effort: the sign-up has already
   * succeeded by this point and must not fail over a preference.
   */
  async function applyOnboardingGoal(accessToken: string) {
    if (!answers) return;
    try {
      await setDailyGoal(MINUTES_TO_DAILY_XP[answers.dailyMinutes], accessToken);
    } catch {
      // Changeable any time from Home — not worth surfacing an error here.
    }
    clearAnswers();
  }

  // OTP → verify the email, get a session, then show success.
  async function verify() {
    setError(null);
    const res = await authApi.verifyOtp(email.trim(), code.trim());
    await applyOnboardingGoal(res.accessToken);
    setResult(res);
  }

  async function resend() {
    setError(null);
    try {
      await authApi.resendOtp(email.trim());
      setError(t('otpResent'));
    } catch {
      // ignore — backend always returns ok
    }
  }

  function back() {
    setError(null);
    if (step === 'otp') setStep('placement');
    else if (step === 'placement') setStep('location');
    else if (step === 'location') setStep('info');
    else router.replace('/(auth)/login');
  }

  // ---- success ----
  if (step === 'success') {
    return (
      <Screen centered>
        <View style={styles.center}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={34} color={colors.white} />
          </View>
          <View style={styles.successArt}>
            {CONFETTI.map(({ color, ...pos }, i) => (
              <View key={i} style={[styles.confetti, pos, { backgroundColor: color }]} />
            ))}
            <Image source={successFox} style={styles.successFox} resizeMode="contain" />
          </View>
          <AppText variant="display" center color={colors.primary} style={styles.successTitle}>
            {t('successTitle')}
          </AppText>
          <AppText variant="body" center color={colors.textSecondary}>
            {t('successBody')}
          </AppText>
        </View>
        <Button
          label={t('onbStart')}
          iconRight="arrow-forward"
          onPress={() => result && applySession(result)}
          style={styles.button}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable style={styles.back} onPress={back} hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>

      <Animated.View style={formStyle}>
      {step === 'info' ? (
        <>
          <AppText variant="h1" center style={styles.title}>
            {t('register')}
          </AppText>
          <AppText variant="body" center color={colors.textSecondary} style={styles.subtitle}>
            {t('registerSubtitle')}
          </AppText>

          {referral ? (
            <View style={styles.referralChip}>
              <AppIcon name="gift" size={16} />
              <AppText variant="caption" color={colors.text} style={{ flex: 1 }}>
                {t('invitedByCode')}: <AppText variant="label" color={colors.primary}>{referral}</AppText>
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>{t('inviteRewardHint')}</AppText>
            </View>
          ) : null}

          {/* NOT "at-outline": an @ reads as an email address, and testers were
              typing their email into the username box. The two person icons
              stay distinct — filled circle for the handle, outline for the
              real name. */}
          <TextField
            leftIcon="person-circle-outline"
            label={t('username')}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <TextField
            leftIcon="person-outline"
            label={t('fullName')}
            value={fullName}
            onChangeText={setFullName}
          />
          <TextField
            leftIcon="mail-outline"
            label={t('email')}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            leftIcon="lock-closed-outline"
            label={t('password')}
            secureToggle
            value={password}
            onChangeText={setPassword}
          />
          <TextField
            leftIcon="lock-closed-outline"
            label={t('confirmPassword')}
            secureToggle
            value={confirm}
            onChangeText={setConfirm}
          />

          <View style={styles.rulesCard}>
            <AppText variant="label" style={styles.rulesTitle}>
              {t('passwordRules')}
            </AppText>
            <Rule ok={rules.minLen(password)} label={t('ruleMinLen')} />
            <Rule ok={rules.letterCase(password)} label={t('ruleCase')} />
            <Rule ok={rules.number(password)} label={t('ruleNumber')} />
          </View>

          <FormError message={error} />
          <Button
            label={t('continue')}
            iconRight="arrow-forward"
            onPress={goInfoNext}
            disabled={!infoValid}
            style={styles.button}
          />
          <AuthFooter
            prompt={t('haveAccount')}
            linkLabel={t('login')}
            href={{ pathname: '/(auth)/login', params: { signin: '1' } }}
          />
        </>
      ) : step === 'location' ? (
        <>
          <AppText variant="h1" center style={styles.title}>
            {t('locationTitle')}
          </AppText>
          <AppText variant="body" center color={colors.textSecondary} style={styles.subtitle}>
            {t('locationSubtitle')}
          </AppText>

          <SelectField
            label={t('province')}
            placeholder={t('selectProvince')}
            value={province}
            options={MN_PROVINCES}
            onSelect={onProvinceChange}
          />
          {isUB ? (
            <SelectField
              label={t('district')}
              placeholder={t('selectDistrict')}
              value={district}
              options={UB_DISTRICTS}
              onSelect={setDistrict}
            />
          ) : null}

          <Image source={mapFox} style={styles.mapFox} resizeMode="contain" />

          <FormError message={error} />
          <Button
            label={t('continue')}
            iconRight="arrow-forward"
            onPress={() => setStep('placement')}
            style={styles.button}
          />
        </>
      ) : step === 'placement' ? (
        <>
          <AppText variant="h1" center style={styles.title}>{t('placementTitle')}</AppText>
          <AppText variant="body" center color={colors.textSecondary} style={styles.subtitle}>
            {t('placementSubtitle')}
          </AppText>

          {LEVELS.map((lv) => {
            const active = level === lv.value;
            return (
              <Pressable
                key={lv.value}
                style={[styles.levelRow, active && styles.levelRowOn]}
                onPress={() => setLevel(lv.value)}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" color={active ? colors.primary : colors.text}>{lv.code} — {t(lv.labelKey)}</AppText>
                  <AppText variant="caption">{t(lv.descKey)}</AppText>
                </View>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={active ? colors.primary : colors.borderStrong}
                />
              </Pressable>
            );
          })}

          <FormError message={error} />
          {/* `haptic={false}`: `fail()` already buzzes, and it also shakes the
              form — a second buzz on top would read as a stutter. */}
          <ActionButton
            label={t('register')}
            iconRight="arrow-forward"
            action={submit}
            onSuccess={() => setStep('otp')}
            onError={fail}
            haptic={false}
            disabled={!level}
            style={styles.button}
          />
        </>
      ) : (
        <>
          <AppText variant="h1" center style={styles.title}>
            {t('otpTitle')}
          </AppText>
          <AppText variant="body" center color={colors.textSecondary} style={styles.subtitle}>
            {t('otpSentTo')} {email}
          </AppText>

          <TextField
            leftIcon="key-outline"
            label={t('otpCode')}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />

          <FormError message={error} />
          <ActionButton
            label={t('verify')}
            iconRight="checkmark"
            action={verify}
            onSuccess={() => setStep('success')}
            onError={fail}
            haptic={false}
            disabled={code.trim().length !== 6}
            style={styles.button}
          />
          <Pressable onPress={resend} hitSlop={6} style={styles.resend}>
            <AppText variant="bodyStrong" color={colors.primary}>
              {t('resendOtp')}
            </AppText>
          </Pressable>
        </>
      )}
      </Animated.View>
    </Screen>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  back: { alignSelf: 'flex-start', padding: spacing.xs, marginBottom: spacing.sm },
  title: { marginTop: spacing.sm },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.xl },
  button: { marginTop: spacing.sm },

  // Password rules card
  rulesCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rulesTitle: { marginBottom: spacing.xs },
  referralChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resend: { alignSelf: 'center', marginTop: spacing.lg },

  // Placement
  levelRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  levelRowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },

  // Location
  mapFox: { width: ms(150), height: ms(150), alignSelf: 'center', marginVertical: spacing.md },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  stepItem: { alignItems: 'center', gap: spacing.xs },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.borderStrong,
  },
  stepDotOn: { backgroundColor: colors.primary },

  // Success
  center: { alignItems: 'center', gap: spacing.md },
  successTitle: { marginTop: spacing.sm },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successArt: { width: ms(220), height: ms(200), alignItems: 'center', justifyContent: 'center' },
  successFox: { width: ms(180), height: ms(180) },
  confetti: { position: 'absolute', width: 10, height: 10, borderRadius: 3 },
});
