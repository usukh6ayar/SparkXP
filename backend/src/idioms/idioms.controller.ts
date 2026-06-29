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
  BadRequestException,
} from '@nestjs/common';
import { IdiomsService } from './idioms.service';
import { CreateIdiomDto } from './dto/create-idiom.dto';
import { UpdateIdiomDto } from './dto/update-idiom.dto';
import { QueryIdiomDto } from './dto/query-idiom.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

/**
 * Idiom endpoints under /api/idioms.
 * - Reads (GET) open to any logged-in user; students get published only.
 * - Writes + AI are content-team only (admin/moderator).
 */
@Controller('idioms')
export class IdiomsController {
  constructor(private readonly idiomsService: IdiomsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: QueryIdiomDto) {
    return this.idiomsService.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateIdiomDto) {
    return this.idiomsService.create(dto);
  }

  /** AI-fill an idiom's fields from its phrase. Before `:id`. */
  @Post('ai-fill')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  aiFill(@Body('phrase') phrase: string) {
    if (!phrase?.trim()) throw new BadRequestException('phrase оруулна уу');
    return this.idiomsService.aiFill(phrase.trim());
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.idiomsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIdiomDto) {
    return this.idiomsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.idiomsService.remove(id);
  }

  /** Generate pronunciation audio (ElevenLabs) for an idiom. */
  @Post(':id/generate-audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  generateAudio(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.idiomsService.generateAudio(id, user.id);
  }
}
