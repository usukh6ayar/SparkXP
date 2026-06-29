import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const AVATAR_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const AVATAR_MAX = 5 * 1024 * 1024; // 5 MB

const avatarStorage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) =>
    cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
});

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Current user: update their own profile. */
  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  /** Current user: get XP and Sparks balance. */
  @Get('me/stats')
  getStats(@CurrentUser() user: User) {
    return this.usersService.getStats(user);
  }

  /** Current user: subscription plan + usage (for the profile plan card). */
  @Get('me/plan')
  getPlan(@CurrentUser() user: User) {
    return this.usersService.getPlanInfo(user);
  }

  /** Current user: upload a custom avatar image (jpg/png/webp, ≤5 MB). */
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', { storage: avatarStorage, limits: { fileSize: AVATAR_MAX } }),
  )
  uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Зураг илгээгдээгүй байна');
    if (!AVATAR_EXT.includes(extname(file.filename).toLowerCase())) {
      throw new BadRequestException('Зөвхөн зураг (jpg/png/webp) оруулна уу');
    }
    const host = req.get('host') ?? 'localhost:3000';
    const url = `${req.protocol}://${host}/uploads/${file.filename}`;
    return this.usersService.setAvatar(user.id, url);
  }

  /** Admin: list all users with pagination. */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const [items, total] = await this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
    return { items, total };
  }

  /**
   * Super-admin: change a user's role.
   * Only super_admin can assign moderator/admin roles.
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: UserRole,
    @CurrentUser() caller: User,
  ) {
    if (id === caller.id) throw new ForbiddenException('Өөрийн роль өөрчлөх боломжгүй');
    return this.usersService.updateRole(id, role);
  }

  /** Admin: delete a user. */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
