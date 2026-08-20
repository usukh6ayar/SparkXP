import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

/**
 * Assignment endpoints under /api/assignments — a teacher points a class at a
 * lesson or quiz with an optional due date.
 */
@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /** Teacher (or admin) assigns a lesson/quiz to a class. */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@CurrentUser() user: User, @Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto, user);
  }

  /** Assignments across the classes the current user is enrolled in. */
  @Get('mine')
  findMine(@CurrentUser() user: User) {
    return this.assignmentsService.findForStudent(user);
  }

  /** Assignments of a class (any member of that class, or an admin). */
  @Get()
  findForClass(
    @CurrentUser() user: User,
    @Query('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.assignmentsService.findForClass(classId, user);
  }

  /** Student marks an assignment as completed (idempotent). */
  @Post(':id/complete')
  @HttpCode(204)
  complete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignmentsService.complete(id, user.id);
  }

  /** Teacher (or admin): every student's submission row for one assignment. */
  @Get(':id/submissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  submissions(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.submissionsFor(id, user);
  }

  /**
   * Багш **юун дээр алдсаныг** харах — нэг сурагчийн сүүлийн илгээлт,
   * асуулт тус бүрээр. Зөв хариулт нь энд ил (багш дүн тавьдаг хүн).
   */
  @Get(':id/students/:studentId/answers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  answers(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.assignmentsService.answersFor(id, studentId, user);
  }

  /**
   * Даалгаврын **хүрээг засах** — шинэ сурагч нэмэх / буруу сонголт залруулах.
   * Багц даалгаварт багц бүрд нь дуудна.
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.updateTargets(id, dto, user);
  }

  /** Teacher (or admin) removes an assignment. */
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignmentsService.remove(id, user);
  }
}
