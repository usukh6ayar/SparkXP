import { IsString, IsInt, IsOptional, IsBoolean, IsArray, Min, MinLength } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  slug: string;

  @IsInt()
  @Min(0)
  priceAmount: number;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
