import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Quiz } from '../entities/quiz.entity';
import { CreateQuizDto, QuestionDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QueryQuizzesDto } from './dto/query-quizzes.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

/** Shape we accept and store for a multiple-choice question. */
interface McQuestion {
  type: 'multiple_choice';
  question: string;
  options: string[];
  correct: number;
  points: number;
  imageUrl?: string; // IELTS: picture / Writing-Task-1 chart (optional)
}

/** Shape we accept and store for a fill-in-the-blank question. */
interface FbQuestion {
  type: 'fill_blank';
  question: string;
  answer: string;
  points: number;
}

/** Shape we accept and store for a word-matching question. */
interface WmQuestion {
  type: 'word_match';
  pairs: { left: string; right: string }[];
  points: number;
}

/** Open written/spoken response (IELTS Writing/Speaking) — self-study, not graded. */
interface OrQuestion {
  type: 'open_response';
  prompt: string;
  modelAnswer: string;
  imageUrl?: string; // Writing Task 1 chart/graph
  bandNote?: string; // band descriptor / guidance
  points: 0;
}

type StoredQuestion = McQuestion | FbQuestion | WmQuestion | OrQuestion;

export interface QuizResult {
  score: number;       // correct points earned
  total: number;       // max possible points
  percentage: number;  // 0–100
  passed: boolean;     // >= 50%
  xpEarned: number;
  breakdown: { questionIndex: number; correct: boolean; points: number }[];
  /** Approximate IELTS band (0–9) — set only for ielts_listening/reading. */
  band?: number;
}

/** Per-question instant feedback (C2). Reveals the correct answer ONLY when the
 *  user was wrong, and only for that single question — never the whole quiz. */
export interface CheckAnswerResult {
  correct: boolean;
  correctAnswer?: number | string | { left: string; right: string }[];
}

export interface PaginatedQuizzes {
  items: Quiz[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizzes: Repository<Quiz>,
  ) {}

  /** Validate that every question has a supported type and required fields. */
  private validateQuestions(raw: QuestionDto[]): StoredQuestion[] {
    return raw.map((q, i) => {
      if (q.type === 'multiple_choice') {
        const mc = q as Partial<McQuestion>;
        if (
          typeof mc.question !== 'string' ||
          !Array.isArray(mc.options) ||
          mc.options.length < 2 ||
          typeof mc.correct !== 'number' ||
          mc.correct < 0 ||
          mc.correct >= mc.options.length ||
          typeof mc.points !== 'number' ||
          mc.points < 1
        ) {
          throw new BadRequestException(
            `questions[${i}]: multiple_choice requires question, options (≥2), correct index, points (≥1)`,
          );
        }
        return {
          type: 'multiple_choice' as const,
          question: mc.question,
          options: mc.options as string[],
          correct: mc.correct,
          points: mc.points,
          ...(typeof mc.imageUrl === 'string' ? { imageUrl: mc.imageUrl } : {}),
        };
      }

      if (q.type === 'fill_blank') {
        const fb = q as Partial<FbQuestion>;
        if (
          typeof fb.question !== 'string' ||
          typeof fb.answer !== 'string' ||
          !fb.answer.trim() ||
          typeof fb.points !== 'number' ||
          fb.points < 1
        ) {
          throw new BadRequestException(
            `questions[${i}]: fill_blank requires question, answer, points (≥1)`,
          );
        }
        return {
          type: 'fill_blank' as const,
          question: fb.question,
          answer: fb.answer,
          points: fb.points,
        };
      }

      if (q.type === 'word_match') {
        const wm = q as Partial<WmQuestion>;
        if (
          !Array.isArray(wm.pairs) ||
          wm.pairs.length < 2 ||
          typeof wm.points !== 'number' ||
          wm.points < 1
        ) {
          throw new BadRequestException(
            `questions[${i}]: word_match requires pairs (≥2 pairs) and points (≥1)`,
          );
        }
        return {
          type: 'word_match' as const,
          pairs: wm.pairs as { left: string; right: string }[],
          points: wm.points,
        };
      }

      if ((q as { type?: string }).type === 'open_response') {
        const or = q as Partial<OrQuestion>;
        if (
          typeof or.prompt !== 'string' ||
          !or.prompt.trim() ||
          typeof or.modelAnswer !== 'string'
        ) {
          throw new BadRequestException(
            `questions[${i}]: open_response requires prompt and modelAnswer`,
          );
        }
        return {
          type: 'open_response' as const,
          prompt: or.prompt,
          modelAnswer: or.modelAnswer,
          points: 0 as const,
          ...(typeof or.imageUrl === 'string' ? { imageUrl: or.imageUrl } : {}),
          ...(typeof or.bandNote === 'string' ? { bandNote: or.bandNote } : {}),
        };
      }

      throw new BadRequestException(
        `questions[${i}]: unknown type "${String((q as { type?: unknown }).type)}" — use multiple_choice, fill_blank, word_match, or open_response`,
      );
    });
  }

  create(dto: CreateQuizDto): Promise<Quiz> {
    const validatedQuestions = this.validateQuestions(dto.questions);
    const quiz = this.quizzes.create({ ...dto, questions: validatedQuestions });
    return this.quizzes.save(quiz);
  }

  async findAll(query: QueryQuizzesDto): Promise<PaginatedQuizzes> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (query.level) where.level = query.level;
    if (query.isPublished !== undefined) where.isPublished = query.isPublished;
    if (query.lessonId) where.lessonId = query.lessonId;
    if (query.category) where.category = query.category;
    if (query.topic) where.topic = query.topic;
    // Standalone "Дасгал" = quizzes not attached to any lesson.
    if (query.standalone) where.lessonId = IsNull();

    const [items, total] = await this.quizzes.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Quiz> {
    const quiz = await this.quizzes.findOne({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz олдсонгүй');
    return quiz;
  }

  async update(id: string, dto: UpdateQuizDto): Promise<Quiz> {
    const quiz = await this.findOne(id);
    if (dto.questions) {
      const validated = this.validateQuestions(dto.questions);
      Object.assign(quiz, { ...dto, questions: validated });
    } else {
      Object.assign(quiz, dto);
    }
    return this.quizzes.save(quiz);
  }

  async remove(id: string): Promise<void> {
    const quiz = await this.findOne(id);
    await this.quizzes.remove(quiz);
  }

  /**
   * Score a submission.
   * - Answers are matched by questionIndex.
   * - Anti-abuse: at least one answer required; XP is proportional to correct points.
   * - Returns the scoring result; actual XP award is done by the caller (XpService).
   */
  scoreSubmission(quiz: Quiz, dto: SubmitQuizDto): QuizResult {
    if (!dto.answers.length) {
      throw new BadRequestException('Хариулт илгээгдээгүй байна');
    }

    const questions = quiz.questions as StoredQuestion[];
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);
    if (totalPoints === 0) {
      throw new BadRequestException('Quiz-д оноогүй асуулт байна');
    }

    // Build answer lookup by questionIndex
    const answerMap = new Map<number, number | string>();
    for (const a of dto.answers) {
      answerMap.set(a.questionIndex, a.answer);
    }

    let earned = 0;
    const breakdown = questions.map((q, i) => {
      const correct = this.gradeQuestion(q, answerMap.get(i));
      if (correct) earned += q.points;
      return { questionIndex: i, correct, points: correct ? q.points : 0 };
    });

    const percentage = Math.round((earned / totalPoints) * 100);
    const passed = percentage >= 50;
    // XP is proportional: full xpReward for 100%, scaled linearly, 0 for no correct answers.
    const xpEarned = earned > 0 ? Math.floor(quiz.xpReward * (earned / totalPoints)) : 0;

    return { score: earned, total: totalPoints, percentage, passed, xpEarned, breakdown };
  }

  /**
   * Grade ONE answered question against its stored correct answer.
   * Single source of truth for correctness — used by both scoreSubmission
   * (whole quiz) and checkAnswer (per-question instant feedback).
   */
  private gradeQuestion(
    q: StoredQuestion,
    userAnswer: number | string | undefined,
  ): boolean {
    if (q.type === 'multiple_choice') {
      return userAnswer === q.correct;
    }
    if (q.type === 'fill_blank') {
      return (
        typeof userAnswer === 'string' &&
        userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase()
      );
    }
    if (q.type === 'word_match') {
      // Mobile sends matched pairs as JSON string; full match = correct.
      try {
        const submitted = typeof userAnswer === 'string' ? JSON.parse(userAnswer) : userAnswer;
        if (Array.isArray(submitted)) {
          return q.pairs.every((pair) =>
            submitted.some((s: { left: string; right: string }) =>
              s.left === pair.left && s.right === pair.right,
            ),
          );
        }
      } catch { return false; }
    }
    // open_response (Writing/Speaking) is self-study only → never auto-correct.
    return false;
  }

  /** The correct answer to reveal for a single question (mc → index,
   *  fill_blank → string, word_match → pairs). */
  private correctAnswerOf(q: StoredQuestion): CheckAnswerResult['correctAnswer'] {
    if (q.type === 'multiple_choice') return q.correct;
    if (q.type === 'fill_blank') return q.answer;
    if (q.type === 'word_match') return q.pairs;
    return q.modelAnswer; // open_response — self-study; modelAnswer is a string
  }

  /**
   * C2: check a single answer for instant feedback (no XP, no scoring).
   * Reveals the correct answer only when the user was wrong, and only for
   * that one question — the full answer key is never sent up front.
   */
  checkAnswer(
    quiz: Quiz,
    questionIndex: number,
    answer: number | string,
  ): CheckAnswerResult {
    const questions = quiz.questions as StoredQuestion[];
    const q = questions[questionIndex];
    if (!q) {
      throw new BadRequestException(`questionIndex ${questionIndex} нь quiz-д байхгүй`);
    }
    const correct = this.gradeQuestion(q, answer);
    return correct
      ? { correct: true }
      : { correct: false, correctAnswer: this.correctAnswerOf(q) };
  }
}
