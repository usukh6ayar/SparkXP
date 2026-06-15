import { IsOptional, IsInt, Min } from 'class-validator';

export class UpdateLimitsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  dailyMessageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyTokenLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxContextMessages?: number;
}
