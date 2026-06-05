import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
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

  /** Student enrolls into a class with its join code. */
  @Post('join')
  join(@CurrentUser() user: User, @Body() dto: JoinClassDto) {
    return this.classesService.join(dto.joinCode, user);
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
