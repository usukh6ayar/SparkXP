import {
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { EventType } from '../../common/enums';

/** Admin: create a Home event (Daily / Weekly challenge / Double XP). */
export class CreateEventDto {
  @IsEnum(EventType)
  type: EventType;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardXp?: number;

  /** Only meaningful for `double_xp` (e.g. 2). */
  @IsOptional()
  @IsNumber()
  @Min(1)
  xpMultiplier?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Admin: partial update — every field optional. */
export class UpdateEventDto {
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardXp?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  xpMultiplier?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
