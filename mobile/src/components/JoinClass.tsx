import { useEffect, useRef, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../auth/AuthContext';
import { requestJoinClass } from '../api/classes';
import { ApiError } from '../api/client';
import { parseJoinCode } from '../lib/joinLink';
import { t } from '../i18n';
import { AppText } from './Text';
import { TextField } from './TextField';
import { Button } from './Button';
import { spacing, radius, type AppColors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/**
 * Student "join a class" flow: type the code or scan the class QR. Either way
 * it sends a join request that the teacher must approve (pending state shown).
 * `initialCode` is set when opened via a deep link (`englishxp://join/CODE`).
 */
export function JoinClass({ initialCode }: { initialCode?: string }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? '');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // class name once requested
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const lock = useRef(false); // stop a QR firing onBarcodeScanned repeatedly

  async function submit(raw: string) {
    const c = raw.trim().toUpperCase();
    if (!token || !c || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await requestJoinClass(c, token);
      setPending(res.className);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  // Deep-link entry: auto-submit the code from the URL.
  useEffect(() => {
    if (initialCode) submit(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function onScanned(value: string) {
    if (lock.current) return;
    lock.current = true;
    setScanning(false);
    const parsed = parseJoinCode(value);
    if (!parsed) {
      setError(t('invalidCode'));
      lock.current = false;
      return;
    }
    setCode(parsed);
    submit(parsed).finally(() => (lock.current = false));
  }

  async function openScanner() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setError(null);
    setScanning(true);
  }

  // ── Pending (request sent) ──────────────────────────────────────────────
  if (pending) {
    return (
      <View style={styles.center}>
        <Ionicons name="hourglass-outline" size={64} color={colors.primary} />
        <AppText variant="h2" center style={{ marginTop: spacing.lg }}>
          {t('joinPending')}
        </AppText>
        <AppText variant="bodyStrong" center color={colors.textSecondary}>
          {pending}
        </AppText>
        <AppText variant="caption" center style={{ marginTop: 4 }}>
          {t('joinPendingHint')}
        </AppText>
        <Button label={t('back')} onPress={() => router.back()} style={styles.stretch} />
      </View>
    );
  }

  // ── Scanner ─────────────────────────────────────────────────────────────
  if (scanning) {
    return (
      <View style={styles.scanner}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onScanned(data)}
        />
        <View style={styles.frame} />
        <AppText variant="bodyStrong" color={colors.white} style={styles.scanHint}>
          {t('scanHint')}
        </AppText>
        <Pressable style={styles.cancelBtn} onPress={() => setScanning(false)}>
          <AppText variant="bodyStrong" color={colors.white}>
            {t('cancel')}
          </AppText>
        </Pressable>
      </View>
    );
  }

  // ── Manual code entry ───────────────────────────────────────────────────
  return (
    <View style={styles.body}>
      <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {t('joinClassSubtitle')}
      </AppText>
      <TextField
        label={t('enterCode')}
        placeholder={t('enterCodePlaceholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger} style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <Button label={t('joinBtn')} onPress={() => submit(code)} loading={busy} disabled={!code.trim()} />

      <View style={styles.divider}>
        <View style={styles.line} />
        <AppText variant="caption" color={colors.textMuted}>{t('orDivider')}</AppText>
        <View style={styles.line} />
      </View>
      <Button label={t('scanQr')} variant="secondary" icon="qr-code-outline" onPress={openScanner} />
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  subtitle: { marginBottom: spacing.lg },
  error: { marginBottom: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  stretch: { marginTop: spacing.xl, alignSelf: 'stretch' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  // Scanner
  scanner: { flex: 1, backgroundColor: '#000' },
  frame: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.white,
  },
  scanHint: { position: 'absolute', alignSelf: 'center', top: '64%', textAlign: 'center' },
  cancelBtn: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 48,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.full,
  },
});
