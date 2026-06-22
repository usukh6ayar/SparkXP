import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { QuizzesService } from './quizzes.service';
import { XpService } from '../xp/xp.service';
import { XpSource } from '../common/enums';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QueryQuizzesDto } from './dto/query-quizzes.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { User } from '../entities/user.entity';

@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  constructor(
    private readonly quizzesService: QuizzesService,
    private readonly xpService: XpService,
  ) {}

  /** Admin: create a new quiz. */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateQuizDto) {
    return this.quizzesService.create(dto);
  }

  /** List quizzes with optional filters. */
  @Get()
  findAll(@Query() query: QueryQuizzesDto) {
    return this.quizzesService.findAll(query);
  }

  /** Get a single quiz by id. */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.quizzesService.findOne(id);
  }

  /** Admin: update a quiz. */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuizDto) {
    return this.quizzesService.update(id, dto);
  }

  /** Admin: delete a quiz. */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.quizzesService.remove(id);
  }

  /**
   * Student: submit answers for a quiz.
   * Scores the submission and awards XP proportional to correct answers.
   * Anti-abuse: XP is only awarded if at least one answer is correct.
   */
  @Post(':id/submit')
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: User,
  ) {
    const quiz = await this.quizzesService.findOne(id);
    const result = this.quizzesService.scoreSubmission(quiz, dto);

    if (result.xpEarned > 0) {
      await this.xpService.award({
        userId: user.id,
        amount: result.xpEarned,
        source: XpSource.QUIZ,
        referenceId: quiz.id,
        metadata: { score: result.score, total: result.total, percentage: result.percentage },
      });
    }

    return result;
  }
}
