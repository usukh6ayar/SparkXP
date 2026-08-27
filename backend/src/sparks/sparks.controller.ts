import {
  Controller,
  Post,
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
 *
 * `GET /lessons/:id/access` used to live here too. It moved to
 * `LessonsController` (2026-08-19) when access stopped being a Sparks question:
 * a subscription, teacher homework, and the free-lesson quota all decide it now,
 * and Sparks is only one of four routes in.
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
}
