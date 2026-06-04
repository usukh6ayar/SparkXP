import {
  Controller,
  Post,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { SparksService } from './sparks.service';

/**
 * Sparks-related operations on lessons.
 * Route prefix "lessons" so URLs match ROADMAP spec:
 *   POST /api/lessons/:id/unlock
 *   GET  /api/lessons/:id/access
 */
@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class SparksController {
  constructor(private readonly sparksService: SparksService) {}

  /** Buy access to a paid lesson with Sparks. */
  @Post(':id/unlock')
  unlock(
    @Param('id', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: User,
  ) {
    return this.sparksService.unlockLesson(user.id, lessonId);
  }

  /** Check if the current user has access to a lesson (free or unlocked). */
  @Get(':id/access')
  async checkAccess(
    @Param('id', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: User,
  ) {
    const hasAccess = await this.sparksService.hasAccess(user.id, lessonId);
    return { hasAccess };
  }
}
