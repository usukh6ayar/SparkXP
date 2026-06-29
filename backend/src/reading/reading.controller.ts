import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { ReadingService } from './reading.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingDto } from './dto/update-reading.dto';
import { QueryReadingDto } from './dto/query-reading.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

/**
 * Reading passage endpoints under /api/reading (Reading feature, M7).
 *
 * - Reads (GET) are open to any logged-in user; students get published passages
 *   only (the service gates on isPublished unless `all=true` is passed).
 * - Writes (POST/PATCH/DELETE) are content-team only — authored from the admin
 *   panel, never by students.
 */
@Controller('reading')
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: QueryReadingDto) {
    return this.readingService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.readingService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateReadingDto) {
    return this.readingService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReadingDto) {
    return this.readingService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.readingService.remove(id);
  }
}
