import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { AiGatewayService } from './ai-gateway.service';
import { ChatDto } from './dto/chat.dto';
import { UpdateLimitsDto } from './dto/update-limits.dto';
import { CreateBuddyDto, UpdateBuddyDto } from './dto/create-buddy.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiGatewayController {
  constructor(private readonly aiGateway: AiGatewayService) {}

  /** Send a message to the AI English buddy. */
  @Post('chat')
  chat(@Body() dto: ChatDto, @CurrentUser() user: User) {
    return this.aiGateway.chat(user.id, dto.message, dto.conversationId);
  }

  /** Get message history for a conversation thread. */
  @Get('conversations/:conversationId')
  getHistory(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: User,
  ) {
    return this.aiGateway.getHistory(user.id, conversationId);
  }

  /** Admin: update plan limits without an app restart. */
  @Patch('limits')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateLimits(@Body() dto: UpdateLimitsDto) {
    return this.aiGateway.updateLimits(dto);
  }

  /** List all active AI buddy characters (auto-seeds from buddies.ts if DB is empty). */
  @Get('buddies')
  getBuddies() {
    return this.aiGateway.findAllBuddies();
  }

  /** Admin: create a new AI buddy. */
  @Post('buddies')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createBuddy(@Body() dto: CreateBuddyDto) {
    return this.aiGateway.createBuddy(dto);
  }

  /** Admin: update an existing AI buddy by slug. */
  @Patch('buddies/:slug')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateBuddy(@Param('slug') slug: string, @Body() dto: UpdateBuddyDto) {
    return this.aiGateway.updateBuddy(slug, dto);
  }

  /** Admin: delete an AI buddy by slug. */
  @Delete('buddies/:slug')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  removeBuddy(@Param('slug') slug: string) {
    return this.aiGateway.removeBuddy(slug);
  }

  /** Admin: usage stats per AI buddy (message count, tokens, cost). */
  @Get('buddy-stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  getBuddyStats() {
    return this.aiGateway.getBuddyStats();
  }
}
