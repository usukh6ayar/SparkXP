import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { ProgressService } from './progress.service';

/** Teacher-only read views over student progress. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class TeacherController {
  constructor(private readonly progress: ProgressService) {}

  @Get('classes/:id/students/:studentId/progress')
  studentProgress(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.progress.studentProgress(id, studentId, user);
  }

  @Get('classes/:id/overview')
  classOverview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.progress.classOverview(id, user);
  }

  @Get('teacher/dashboard')
  dashboard(@CurrentUser() user: User) {
    return this.progress.dashboard(user);
  }
}
