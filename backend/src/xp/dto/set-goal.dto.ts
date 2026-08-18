import { IsIn, IsInt } from 'class-validator';
import { DAILY_GOAL_CHOICES, LEGACY_DAILY_GOALS } from '../xp.service';

/**
 * Every goal the API will store: the three the picker offers, plus the values
 * older app builds still send. Old bundles are live (OTA / Expo Go), and
 * rejecting their goal picker with a 400 would be a worse bug than accepting a
 * retired number.
 */
const ACCEPTED_GOALS: number[] = [...DAILY_GOAL_CHOICES, ...LEGACY_DAILY_GOALS];

export class SetDailyGoalDto {
  /** Constrained to the goals the app offers — not a free-form number. */
  @IsInt()
  @IsIn(ACCEPTED_GOALS, {
    message: `dailyGoalXp нь ${DAILY_GOAL_CHOICES.join(' / ')}-ийн аль нэг байх ёстой`,
  })
  dailyGoalXp: number;
}
