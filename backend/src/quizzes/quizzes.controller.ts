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
  Inject,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { HeartsService } from '../hearts/hearts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { QuizzesService } from './quizzes.service';
import { XpService } from '../xp/xp.service';
import { StarsService } from '../xp/stars.service';
import { XpSource } from '../common/enums';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { IELTS_OBJECTIVE_CATEGORIES, ieltsBand } from './ielts';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QueryQuizzesDto } from './dto/query-quizzes.dto';
import { SubmitQuizDto, AnswerItemDto } from './dto/submit-quiz.dto';
import { User } from '../entities/user.entity';
import { ProgressService } from '../teacher/progress.service';
import { AssignmentsService } from '../assignments/assignments.service';

@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  constructor(
    private readonly quizzesService: QuizzesService,
    private readonly xpService: XpService,
    private readonly stars: StarsService,
    private readonly progress: ProgressService,
    private readonly assignments: AssignmentsService,
    private readonly hearts: HeartsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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
   * Anti-abuse: XP is granted **once per quiz per user** (awardOnce) so a quiz
   * can't be farmed by re-submitting — especially now that the mobile flow lets
   * users retry until every answer is correct. A repeat attempt returns
   * `xpEarned: 0`.
   */
  @Post(':id/submit')
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: User,
  ) {
    const quiz = await this.quizzesService.findOne(id);
    const result = this.quizzesService.scoreSubmission(quiz, dto);

    // IELTS objective modules (listening/reading): report an approximate band,
    // computed from the number of correct QUESTIONS (not points).
    if (quiz.category && IELTS_OBJECTIVE_CATEGORIES.includes(quiz.category)) {
      const correctCount = result.breakdown.filter((b) => b.correct).length;
      result.band = ieltsBand(correctCount, result.breakdown.length);
    }

    // Teacher-set homework earns no XP — it's schoolwork, not the game loop
    // (see assignments.service.ts `isAssignedWork`). The submission below is
    // still recorded, so the teacher's dashboard is unaffected.
    const homework = await this.assignments.isAssignedWork(user.id, quiz.id);
    if (homework) result.xpEarned = 0;

    if (result.xpEarned > 0) {
      const log = await this.xpService.awardOnce({
        userId: user.id,
        amount: result.xpEarned,
        source: XpSource.QUIZ,
        referenceId: quiz.id,
        metadata: { score: result.score, total: result.total, percentage: result.percentage },
      });
      // Already earned XP for this quiz before → reflect 0 in the response so the
      // result screen doesn't promise XP that wasn't granted.
      if (!log) result.xpEarned = 0;
    }

    await this.progress.recordAttempt({
      userId: user.id,
      quiz,
      correctCount: result.breakdown.filter((b) => b.correct).length,
      totalCount: result.breakdown.length,
      scorePct: result.percentage,
      assignmentId: dto.assignmentId ?? null,
    });

    if (dto.assignmentId) {
      await this.assignments.recordSubmission(dto.assignmentId, user.id, result.percentage);
    }

    // A lesson's test permanently sets that lesson's star rating (0–3, best
    // kept). Drives the stars under lesson cards and the star-gated castle
    // unlocks. Homework still counts — stars are the learner's own progress.
    if (quiz.lessonId) {
      const starsEarned = await this.stars.awardFromScore(user.id, quiz.lessonId, result.percentage);
      return { ...result, starsEarned };
    }

    return result;
  }

  /**
   * Student: check ONE answer for instant per-question feedback (C2).
   * No XP and no answer-key leak — grading here is a preview; `/submit` stays
   * authoritative for scoring. Returns `{ correct, correctAnswer? }` where
   * `correctAnswer` is present only when the answer was wrong.
   *
   * A wrong answer also costs a heart. This is the ONLY place hearts are spent:
   * it is the one point where the server decides right/wrong, so the client
   * can't skip the cost by not calling an endpoint. The response carries the
   * resulting `hearts` state so the client never has to track it locally.
   *
   * Exception: teacher-set homework never costs a heart. Running out mid-way
   * would block a student from finishing work their teacher required, so
   * assigned quizzes sit outside the gamification loop entirely.
   */
  @Post(':id/check')
  @HttpCode(HttpStatus.OK)
  async check(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerItemDto,
    @CurrentUser() user: User,
  ) {
    const quiz = await this.quizzesService.findOne(id);
    const result = this.quizzesService.checkAnswer(
      quiz,
      dto.questionIndex,
      dto.answer,
    );

    // Charge a heart per mistake — but only once per distinct submission, so a
    // double-tap or a client retry after a network blip can't cost two. A
    // genuinely new wrong answer to the same question (e.g. when it comes back
    // around in the re-queue) is a different submission and does cost again.
    // Homework is exempt (see the doc comment above).
    const free =
      result.correct ||
      (await this.assignments.isAssignedWork(user.id, id)) ||
      (await this.wasJustCharged(user.id, id, dto));
    const hearts = free
      ? await this.hearts.get(user.id)
      : await this.hearts.lose(user.id);

    return { ...result, hearts };
  }

  /**
   * Retry guard for heart spending: remembers (user, quiz, question, answer)
   * for a short window and reports whether we've already charged for exactly
   * this submission. Redis is the right home — it's per-attempt, disposable
   * state that must expire on its own.
   *
   * Fails OPEN (returns true → no charge) if Redis is unavailable: losing a
   * heart we should have taken is far better than taking one twice.
   */
  private async wasJustCharged(
    userId: string,
    quizId: string,
    dto: AnswerItemDto,
  ): Promise<boolean> {
    const key = `quizcheck:${userId}:${quizId}:${dto.questionIndex}:${createHash(
      'sha1',
    )
      .update(String(dto.answer))
      .digest('hex')
      .slice(0, 16)}`;
    try {
      // SET NX → "true" only for the FIRST caller; later ones find it present.
      const claimed = await this.redis.set(key, '1', 'EX', 90, 'NX');
      return claimed === null; // null = key already existed = already charged
    } catch {
      return true;
    }
  }
}
