import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

/**
 * Class endpoints under /api/classes.
 *
 * - Teachers create classes and view their rosters.
 * - Students enroll with a join code and see the classes they belong to.
 */
@Controller('classes')
@UseGuards(JwtAuthGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /** Teacher (or admin) creates a class. */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@CurrentUser() user: User, @Body() dto: CreateClassDto) {
    return this.classesService.create(dto, user);
  }

  /** Student requests to join a class with its join code (needs teacher approval). */
  @Post('join')
  join(@CurrentUser() user: User, @Body() dto: JoinClassDto) {
    return this.classesService.join(dto.joinCode, user);
  }

  /** Pending join requests of a class (teacher of the class / admin only). */
  @Get(':id/requests')
  getRequests(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.getJoinRequests(id, user);
  }

  /** Approve a pending request — enroll the student (teacher / admin). */
  @Post(':id/requests/:studentId/approve')
  approve(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.classesService.approveRequest(id, studentId, user);
  }

  /** Reject a pending request (teacher / admin). */
  @Delete(':id/requests/:studentId')
  @HttpCode(204)
  reject(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.classesService.rejectRequest(id, studentId, user);
  }

  /** Admin: all classes with teacher info and student count. */
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  findAll() {
    return this.classesService.findAll();
  }

  /** Classes relevant to the current user (teaching + enrolled). */
  @Get()
  findMine(@CurrentUser() user: User) {
    return this.classesService.findForUser(user);
  }

  /** One class with its roster (teacher, enrolled student, or admin). */
  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.findOneWithAccess(id, user);
  }

  /** The student roster of a class (teacher of the class / admin only). */
  @Get(':id/students')
  getStudents(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.classesService.getStudents(id, user);
  }
}
