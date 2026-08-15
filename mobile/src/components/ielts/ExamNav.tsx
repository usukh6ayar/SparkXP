import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { useColors } from '../../settings/SettingsContext';
import { haptics } from '../../lib/haptics';
import type { ExamSection } from '../../constants/ielts';
import { tf } from '../../i18n';
import { spacing, radius, type AppColors } from '../../theme/theme';

/**
 * The two things a test taker asks constantly: *which part am I in* and *which
 * questions have I done*. This answers both without leaving the page.
 *
 * The parts sit as one segmented row rather than a scrolling strip — a paper has
 * at most four, they always fit, and a row you cannot scroll past is a row you
 * can read at a glance. Each tab carries a dot per question, so an unfinished
 * part is visible while you are standing in a different one; that is the whole
 * reason the progress lives on the tab and not in a summary somewhere.
 *
 * Below it is the answer sheet for the open part: filled = answered, ringed =
 * where you are, hollow = not yet. Tapping any number jumps to it.
 */
export function ExamNav<Q>({
  sections,
  partLabel,
  activeSection,
  onSelectSection,
  isAnswered,
  currentIndex,
  onJump,
}: {
  sections: ExamSection<Q>[];
  /** Section · Passage · Task · Part — what this module calls its parts. */
  partLabel: string;
  /** Part NUMBER currently shown (not its position in the array). */
  activeSection: number;
  onSelectSection: (sectionNumber: number) => void;
  /** Has this flat question index been answered? */
  isAnswered: (index: number) => boolean;
  /** Question the page is scrolled to, for the ring. */
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const current = sections.find((s) => s.number === activeSection) ?? sections[0];
  if (!current) return null;

  const doneHere = current.items.filter((i) => isAnswered(i.index)).length;

  return (
    <View style={styles.wrap}>
      {/* Part tabs — hidden for a single-part set, where they would say nothing.
          The module's own word for a part is a heading rather than a label on
          every tab: four columns on a phone cannot hold "Section 1" four times,
          and the numbers alone read fine underneath it. */}
      {sections.length > 1 ? (
        <>
          <AppText variant="overline" color={c.textMuted}>{partLabel}</AppText>
          <View style={styles.tabs}>
          {sections.map((section) => (
            <PartTab
              key={section.number}
              section={section}
              active={section.number === activeSection}
              isAnswered={isAnswered}
              onPress={() => {
                haptics.select();
                onSelectSection(section.number);
              }}
              styles={styles}
              c={c}
            />
          ))}
          </View>
        </>
      ) : null}

      <View style={styles.rangeRow}>
        <AppText variant="caption" color={c.textSecondary}>
          {tf('ieltsQuestionsRange', { from: current.from, to: current.to })}
        </AppText>
        <AppText variant="caption" color={doneHere === current.items.length ? c.success : c.textMuted}>
          {doneHere}/{current.items.length}
        </AppText>
      </View>

      {/* Answer sheet for the current part. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.numbers}
      >
        {current.items.map(({ index }) => {
          const answered = isAnswered(index);
          const here = index === currentIndex;
          return (
            <Pressable
              key={index}
              onPress={() => {
                haptics.tap();
                onJump(index);
              }}
              style={[
                styles.num,
                answered && styles.numDone,
                here && { borderColor: c.primary, borderWidth: 2 },
              ]}
            >
              <AppText
                variant="caption"
                color={answered ? c.white : here ? c.primary : c.textSecondary}
                style={styles.numText}
              >
                {index + 1}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * One part, with a dot per question. The dots are the honest version of a
 * progress bar at this size: four questions is four dots, and "three filled"
 * needs no percentage to read.
 */
function PartTab<Q>({
  section, active, isAnswered, onPress, styles, c,
}: {
  section: ExamSection<Q>;
  active: boolean;
  isAnswered: (index: number) => boolean;
  onPress: () => void;
  styles: Styles;
  c: AppColors;
}) {
  const done = section.items.filter((i) => isAnswered(i.index)).length;
  const complete = done === section.items.length && section.items.length > 0;

  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabOn]}>
      <View style={styles.tabHead}>
        <AppText
          variant="caption"
          color={active ? c.white : c.textSecondary}
          numberOfLines={1}
          style={styles.tabLabel}
        >
          {section.number}
        </AppText>
        {complete ? (
          <Ionicons name="checkmark-circle" size={13} color={active ? c.white : c.success} />
        ) : null}
      </View>

      <View style={styles.dots}>
        {section.items.map(({ index }) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: isAnswered(index)
                  ? active ? c.white : c.primary
                  : active ? 'rgba(255,255,255,0.35)' : c.border,
              },
            ]}
          />
        ))}
      </View>
    </Pressable>
  );
}

const SIZE = 36;

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    // Equal columns: a paper has at most 4 parts, so they always fit a phone.
    tabs: { flexDirection: 'row', gap: spacing.xs },
    tab: {
      flex: 1,
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
      borderRadius: radius.md,
      backgroundColor: c.surfaceAlt,
    },
    tabOn: { backgroundColor: c.primary },
    tabHead: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    tabLabel: { fontWeight: '700' },
    dots: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
    dot: { width: 5, height: 5, borderRadius: radius.full },
    rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    numbers: { gap: spacing.xs, paddingVertical: 2 },
    num: {
      width: SIZE,
      height: SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    numDone: { backgroundColor: c.primary, borderColor: c.primary },
    numText: { fontWeight: '700' },
  });
