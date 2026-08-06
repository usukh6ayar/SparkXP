import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { StarsService } from './stars.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { LessonResultDto } from './dto/lesson-result.dto';

/**
 * Lesson stars (Task 2). Reuses `StarsService` — the detailed per-lesson stars
 * (`GET /lesson-stars`) and a direct result endpoint (`POST /lesson-result`)
 * for lessons whose completion isn't already reported through a quiz submit.
 * (The lightweight `{lessonId: stars}` map stays at `GET /gamification/stars`.)
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class LessonStarsController {
  constructor(private readonly stars: StarsService) {}

  @Get('lesson-stars')
  getStars(@CurrentUser() user: User) {
    return this.stars.getLessonStarsDetailed(user.id);
  }

  @Post('lesson-result')
  recordResult(@Body() dto: LessonResultDto, @CurrentUser() user: User) {
    return this.stars.recordLessonResult(user.id, dto.lessonId, dto.score);
  }
}
