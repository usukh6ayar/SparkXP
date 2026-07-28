import { IsIn, IsInt } from 'class-validator';
import { DAILY_GOAL_CHOICES } from '../xp.service';

export class SetDailyGoalDto {
  /** Constrained to the three goals the UI offers — not a free-form number. */
  @IsInt()
  @IsIn(DAILY_GOAL_CHOICES as unknown as number[], {
    message: `dailyGoalXp нь ${DAILY_GOAL_CHOICES.join(' / ')}-ийн аль нэг байх ёстой`,
  })
  dailyGoalXp: number;
}
