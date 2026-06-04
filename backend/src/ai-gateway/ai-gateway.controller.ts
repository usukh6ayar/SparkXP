import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Patch,
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
}
