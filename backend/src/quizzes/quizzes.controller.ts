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
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { HeartsService } from '../hearts/hearts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QuizzesService } from './quizzes.service';
import { XpService } from '../xp/xp.service';
import { StarsService } from '../xp/stars.service';
import { XpSource, UserRole, AssignmentType } from '../common/enums';
import { AiGenerateQuizDto } from './dto/ai-generate-quiz.dto';
import { BulkGenerateQuizDto } from './dto/bulk-generate-quiz.dto';
import { IeltsPaperDto } from './dto/ielts-paper.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { IELTS_OBJECTIVE_CATEGORIES, ieltsBand } from './ielts';
import { canSeeAnswers, canSeeAssignmentBank, stripAnswers } from './sanitize';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QueryQuizzesDto } from './dto/query-quizzes.dto';
import { SubmitQuizDto, CheckAnswerDto } from './dto/submit-quiz.dto';
import { User } from '../entities/user.entity';
import { ProgressService } from '../teacher/progress.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { subsetQuiz } from '../assignments/question-subset';
import { Quiz } from '../entities/quiz.entity';
import { Assignment } from '../entities/assignment.entity';

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

  /**
   * Админ: бичсэн агуулгаас AI-аар асуултын ноорог үүсгэнэ (Дасгал · Quiz ·
   * IELTS гурвуулаа энэ нэг endpoint-ыг ашиглана).
   *
   * Хадгалахгүй — зөвхөн ноорог буцаана. Админ preview дээр засаад `POST
   * /quizzes`-ээр өөрөө үүсгэнэ.
   */
  @Post('ai-generate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  aiGenerate(@Body() dto: AiGenerateQuizDto) {
    return this.quizzesService.aiGenerate(dto);
  }

  /**
   * Админ: агуулга бичихгүйгээр **бүхэл түвшний** контент үүсгэнэ — төрөл тус
   * бүрт N дасгал, аль хэдийн байгаа контенттой давхцуулахгүйгээр.
   *
   * ⚠️ `ai-generate`-ээс ялгаатай нь энэ нь шууд хадгална (40 дасгалыг preview
   * дээр нэг бүрчлэн шалгах боломжгүй). Урт ажил тул background-д явж `jobId`
   * буцаана — `GET /quizzes/bulk-generate/:jobId`-ээр явцыг хараарай.
   */
  @Post('bulk-generate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  bulkGenerate(@Body() dto: BulkGenerateQuizDto) {
    const { jobId, total } = this.quizzesService.startBulkGenerate(dto);
    return { started: true, background: true, jobId, total };
  }

  /**
   * **Бүтэн IELTS шалгалт үүсгэх** — Listening 4 Section × 10 асуулт, эсвэл
   * Reading 3 Passage (13+13+14) = нийт 40, НЭГ дасгал болгож.
   *
   * Хэсгийн тоог админ сонгохгүй: тэр нь шалгалтын албан ёсны бүтэц.
   * Background-д явна — `GET /quizzes/bulk-generate/:jobId`-ээр явцыг харна.
   */
  @Post('ielts-paper')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  ieltsPaper(@Body() dto: IeltsPaperDto) {
    const { jobId, total } = this.quizzesService.startIeltsPaper(dto);
    return { started: true, background: true, jobId, total };
  }

  /** Явц татах. `:id`-аас ӨМНӨ байх ёстой, эс бөгөөс route нь тэр рүү унана. */
  @Get('bulk-generate/:jobId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  bulkGenerateStatus(@Param('jobId') jobId: string) {
    return (
      this.quizzesService.getBulkJob(jobId) ?? { done: true, expired: true }
    );
  }

  /** "Зогсоох" — ажиллаж буй дуудлагууд дуусаад шинэ нь эхлэхгүй. */
  @Post('bulk-generate/:jobId/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  cancelBulkGenerate(@Param('jobId') jobId: string) {
    return { canceled: this.quizzesService.cancelBulkJob(jobId) };
  }

  /**
   * List quizzes with optional filters.
   *
   * ⚠️ Хариултын түлхүүр зөвхөн контент засдаг дүрд очно — сурагчид
   * `correct`/`answer` явуулбал дасгал бүрийг сүлжээний хариунаас уншиж
   * болно (`sanitize.ts`).
   */
  @Get()
  async findAll(@Query() query: QueryQuizzesDto, @CurrentUser() user: User) {
    const page = await this.quizzesService.findAll(
      query,
      canSeeAssignmentBank(user?.role),
    );
    if (canSeeAnswers(user?.role)) return page;
    return { ...page, items: page.items.map(stripAnswers) };
  }

  /**
   * Админ: **чанарын тайлан** — хариулах боломжгүй / эргэлзээтэй дасгалуудыг
   * бүхэлд нь олж жагсаана.
   *
   * ⚠️ `:id` route-аас ӨМНӨ байрлана, эс бөгөөс "quality-report" нь id гэж
   * ойлгогдоод `ParseUUIDPipe` уначихна.
   */
  @Get('quality-report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  qualityReport(@Query('category') category?: string) {
    return this.quizzesService.qualityReport(category);
  }

  /**
   * Get a single quiz by id.
   *
   * `assignmentId` нь багшийн даалгавар гүйцэтгэж байгаа сурагчийнх — сервер
   * түүгээр нь **сонгогдсон асуултуудыг** л буцаана (`question-subset.ts`).
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    // ⚠️ `optional: true`-тэй ParseUUIDPipe заавал: түүхий мөр Postgres руу
    // очвол `invalid input syntax for type uuid` гэж 500 өгнө.
    @Query('assignmentId', new ParseUUIDPipe({ optional: true }))
    assignmentId?: string,
  ) {
    const { quiz: scoped } = await this.scopeToAssignment(
      await this.quizzesService.findOne(id),
      user,
      assignmentId,
    );
    // Аппын хувилбар: `fill_blank` бүрд яг 4 сонголт бэлдэнэ. Дэд олонлогийн
    // ДАРАА хийгдэх ёстой — үгийн сан зөвхөн хийх асуултуудынх байхын тулд.
    const quiz = this.quizzesService.toStudentQuiz(scoped);
    // ⚠️ Сонголт/үгийн санг бэлдсэний ДАРАА хасна — тэдгээр нь хариултаас
    // тооцоологддог (аль хэдийн холигдсон тул түлхүүрээ задлахгүй).
    return canSeeAnswers(user?.role) ? quiz : stripAnswers(quiz);
  }

  /**
   * Сурагч энэ quiz-ийг үзэх эрхтэй эсэхийг шалгаад, даалгавраар оноогдсон
   * асуултуудаар нь шүүнэ. **Гурван зам (нээх · шалгах · илгээх) бүгд үүгээр
   * дамжина** — эс бөгөөс нэг нь шүүгдэж, нөгөө нь шүүгдэхгүй үлдэж, индекс
   * зөрөх болно.
   *
   * Зардал: даалгаврын сангийн БИШ quiz дээр `assignmentId` ирээгүй бол ямар
   * ч нэмэлт query хийхгүй — ердийн дасгалын урсгал урьдын адил хурдан.
   */
  private async scopeToAssignment(
    quiz: Quiz,
    user: User,
    assignmentId?: string,
  ): Promise<{ quiz: Quiz; assignment: Assignment | null }> {
    const staff = canSeeAssignmentBank(user?.role);
    if ((!assignmentId && !quiz.assignOnly) || (staff && !assignmentId)) {
      return { quiz, assignment: null };
    }

    const assignment = await this.assignments.findStudentAssignment(
      user.id,
      AssignmentType.QUIZ,
      quiz.id,
      assignmentId,
    );

    // Даалгаврын сан = зөвхөн багшаас ирсэн даалгавраар нээгдэнэ.
    if (quiz.assignOnly && !assignment && !staff) {
      throw new ForbiddenException(
        'Энэ дасгалыг багш даалгавар болгож өгсний дараа үзнэ',
      );
    }
    return {
      quiz: subsetQuiz(quiz, assignment?.questionIndexes ?? null),
      assignment,
    };
  }

  /**
   * Админ: **сонсох яриа үүсгэх** — асуулт нь байгаа мөртлөө сонсох зүйлгүй
   * үлдсэн сонсголын дасгалыг амилуулна (ийм мөр аппад огт харагддаггүй).
   */
  @Post(':id/generate-script')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  generateScript(@Param('id', ParseUUIDPipe) id: string) {
    return this.quizzesService.generateListeningScript(id);
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
    // Даалгаврын дэд олонлогийг ЭНД мөн хэрэглэнэ — эс бөгөөс сурагч 5
    // асуулт хараад, оноо нь 15 асуултаас бодогдоно.
    const { quiz, assignment } = await this.scopeToAssignment(
      await this.quizzesService.findOne(id),
      user,
      dto.assignmentId,
    );
    const result = this.quizzesService.scoreSubmission(quiz, dto);

    // IELTS objective modules (listening/reading): report an approximate band,
    // computed from the number of correct QUESTIONS (not points).
    if (quiz.category && IELTS_OBJECTIVE_CATEGORIES.includes(quiz.category)) {
      const correctCount = result.breakdown.filter((b) => b.correct).length;
      // Ангиллыг дамжуулна: Listening ба Academic Reading хоёр өөр
      // албан ёсны хүснэгттэй.
      result.band = ieltsBand(
        correctCount,
        result.breakdown.length,
        quiz.category,
      );
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
        metadata: {
          score: result.score,
          total: result.total,
          percentage: result.percentage,
        },
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
      assignmentId: assignment?.id ?? null,
      // Зөв эсэх нь `breakdown`-д, харин ЮУ гэж хариулсан нь зөвхөн `dto`-д
      // байдаг — багш алдааг харахын тулд хоёулаа хэрэгтэй.
      answers: result.breakdown.map((b) => ({
        i: b.questionIndex,
        a:
          dto.answers.find((x) => x.questionIndex === b.questionIndex)
            ?.answer ?? null,
        ok: b.correct,
      })),
    });

    // ⚠️ `dto.assignmentId`-г ШУУД бичихгүй — `scopeToAssignment` түүнийг
    // «энэ сурагчийнх мөн үү, энэ quiz руу заасан уу» гэж шалгасны дараа
    // л `assignment` болж ирнэ. Эс бөгөөс сурагч өөр ангийн даалгаврын id
    // хавчуулж тэнд гүйцэтгэлийн мөр үүсгэж чадна.
    if (assignment) {
      await this.assignments.recordSubmission(
        assignment.id,
        user.id,
        result.percentage,
      );
    }

    // A lesson's test permanently sets that lesson's star rating (0–3, best
    // kept). Drives the stars under lesson cards and the star-gated castle
    // unlocks. Homework still counts — stars are the learner's own progress.
    if (quiz.lessonId) {
      const starsEarned = await this.stars.awardFromScore(
        user.id,
        quiz.lessonId,
        result.percentage,
      );
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
    @Body() dto: CheckAnswerDto,
    @CurrentUser() user: User,
  ) {
    // Шүүгдсэн quiz дээр шалгана — сурагчийн 3 дахь асуулт нь эх тестийн 3
    // дахь асуулт биш байж болно (`question-subset.ts`).
    const { quiz } = await this.scopeToAssignment(
      await this.quizzesService.findOne(id),
      user,
      dto.assignmentId,
    );
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
    dto: CheckAnswerDto,
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
