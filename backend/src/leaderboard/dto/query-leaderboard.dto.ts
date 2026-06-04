import { Type } from 'class-transformer';
import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { LeaderboardPeriod, LeaderboardScope } from '../../common/enums';

/** Query params for GET /api/leaderboard. */
export class QueryLeaderboardDto {
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod = LeaderboardPeriod.WEEKLY;

  @IsOptional()
  @IsEnum(LeaderboardScope)
  scope: LeaderboardScope = LeaderboardScope.GLOBAL;

  /** Required when scope = class. */
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
