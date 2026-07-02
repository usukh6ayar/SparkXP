import { useState, useMemo } from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import * as authApi from '../../src/api/auth';
import type { AuthResult } from '../../src/api/auth';
import { t } from '../../src/i18n';
import { spacing, radius, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';
import { MN_PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { FormError } from '../../src/components/FormError';
import { AuthFooter } from '../../src/components/AuthFooter';

const mapFox = require('../../assets/onboarding/map-fox.png');
const successFox = require('../../assets/onboarding/success-fox.png');

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

// Placement levels (CEFR) with a short Mongolian hint.
const LEVELS: { value: string; label: string; desc: string }[] = [
  { value: 'a1', label: 'A1 — Анхан', desc: 'Шинээр эхэлж байна' },
  { value: 'a2', label: 'A2 — Бага', desc: 'Энгийн өгүүлбэр ойлгоно' },
  { value: 'b1', label: 'B1 — Дунд', desc: 'Өдөр тутмын яриа' },
  { value: 'b2', label: 'B2 — Ахисан', desc: 'Чөлөөтэй харилцана' },
  { value: 'c1', label: 'C1 — Гүнзгий', desc: 'Бараг төгс' },
];

// Suggested English names (student can reshuffle / keep blank).
const ENGLISH_NAMES = [
  'Alex', 'Bella', 'Chris', 'Daisy', 'Ethan', 'Grace', 'Henry', 'Ivy',
  'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia', 'Ryan', 'Sophia', 'Tom', 'Zoe',
];

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

  type Step = 'info' | 'location' | 'placement' | 'otp' | 'success';
  const [step, setStep] = useState<Step>('info'); // info → location → placement → otp → success
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [province, setProvince] = useState<string | undefined>();
  const [district, setDistrict] = useState<string | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [englishName, setEnglishName] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<AuthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isUB = province === 'Улаанбаатар';
  const passOk = rules.minLen(password) && rules.letterCase(password) && rules.number(password);
  const usernameOk = /^[a-zA-Z0-9_]{3,30}$/.test(username.trim());
  const infoValid = usernameOk && fullName.trim() && email.trim() && passOk && confirm === password;

  function onProvinceChange(value: string) {
    setProvince(value);
    if (value !== 'Улаанбаатар') setDistrict(undefined);
  }

  function goInfoNext() {
    setError(null);
    if (!passOk) return setError(t('required'));
    if (confirm !== password) return setError(t('passwordMismatch'));
    setStep('location');
  }

  // Placement → create the (unverified) account; backend emails an OTP.
  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await authApi.register({
        username: username.trim(),
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        level,
        englishName: englishName.trim() || undefined,
        province,
        district: isUB ? district : undefined,
      });
      setStep('otp');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  // OTP → verify the email, get a session, then show success.
  async function verify() {
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.verifyOtp(email.trim(), code.trim());
      setResult(res);
      setStep('success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
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

  function suggestName() {
    setEnglishName(ENGLISH_NAMES[Math.floor(Math.random() * ENGLISH_NAMES.length)]);
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

      {step === 'info' ? (
        <>
          <AppText variant="h1" center style={styles.title}>
            {t('register')}
          </AppText>
          <AppText variant="body" center color={colors.textSecondary} style={styles.subtitle}>
            {t('registerSubtitle')}
          </AppText>

          <TextField
            leftIcon="at-outline"
            placeholder={t('username')}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <TextField
            leftIcon="person-outline"
            placeholder={t('fullName')}
            value={fullName}
            onChangeText={setFullName}
          />
          <TextField
            leftIcon="mail-outline"
            placeholder={t('email')}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            leftIcon="lock-closed-outline"
            placeholder={t('password')}
            secureToggle
            value={password}
            onChangeText={setPassword}
          />
          <TextField
            leftIcon="lock-closed-outline"
            placeholder={t('confirmPassword')}
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
                  <AppText variant="bodyStrong" color={active ? colors.primary : colors.text}>{lv.label}</AppText>
                  <AppText variant="caption">{lv.desc}</AppText>
                </View>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={active ? colors.primary : colors.borderStrong}
                />
              </Pressable>
            );
          })}

          {/* English name (optional, with suggest) */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <TextField
                leftIcon="happy-outline"
                label={t('englishName')}
                placeholder="Alex"
                autoCapitalize="words"
                value={englishName}
                onChangeText={setEnglishName}
              />
            </View>
            <Pressable style={styles.diceBtn} onPress={suggestName}>
              <Ionicons name="dice" size={20} color={colors.primary} />
            </Pressable>
          </View>

          <FormError message={error} />
          <Button
            label={t('register')}
            iconRight="arrow-forward"
            onPress={submit}
            loading={busy}
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
            placeholder={t('otpCode')}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />

          <FormError message={error} />
          <Button
            label={t('verify')}
            iconRight="checkmark"
            onPress={verify}
            loading={busy}
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
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resend: { alignSelf: 'center', marginTop: spacing.lg },

  // Placement
  levelRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  levelRowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  nameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  diceBtn: {
    width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },

  // Location
  mapFox: { width: 150, height: 150, alignSelf: 'center', marginVertical: spacing.md },
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
  successArt: { width: 220, height: 200, alignItems: 'center', justifyContent: 'center' },
  successFox: { width: 180, height: 180 },
  confetti: { position: 'absolute', width: 10, height: 10, borderRadius: 3 },
});
