import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { HeartsService } from './hearts.service';

/**
 * Quiz "lives". Hearts are only ever SPENT server-side (inside
 * `POST /quizzes/:id/check`, where the answer is actually graded) — there is
 * deliberately no `POST /hearts/lose`, because a client-callable endpoint for
 * losing a heart is also a client-skippable one.
 */
@Controller('hearts')
@UseGuards(JwtAuthGuard)
export class HeartsController {
  constructor(private readonly hearts: HeartsService) {}

  /** Current hearts + when the next one regenerates. */
  @Get()
  get(@CurrentUser() user: User) {
    return this.hearts.get(user.id);
  }

  /** Refill to full by spending Sparks. 400 if already full or short on Sparks. */
  @Post('refill')
  @HttpCode(HttpStatus.OK)
  refill(@CurrentUser() user: User) {
    return this.hearts.refill(user.id);
  }
}
