import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}

/** Shape we accept and store for a fill-in-the-blank question. */
interface FbQuestion {
  type: 'fill_blank';
  question: string;
  answer: string;
  points: number;
}

type StoredQuestion = McQuestion | FbQuestion;

export interface QuizResult {
  score: number;       // correct points earned
  total: number;       // max possible points
  percentage: number;  // 0–100
  passed: boolean;     // >= 50%
  xpEarned: number;
  breakdown: { questionIndex: number; correct: boolean; points: number }[];
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

      throw new BadRequestException(
        `questions[${i}]: unknown type "${String((q as { type?: unknown }).type)}" — use multiple_choice or fill_blank`,
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
      const userAnswer = answerMap.get(i);
      let correct = false;

      if (q.type === 'multiple_choice') {
        correct = userAnswer === q.correct;
      } else if (q.type === 'fill_blank') {
        correct =
          typeof userAnswer === 'string' &&
          userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
      }

      if (correct) earned += q.points;
      return { questionIndex: i, correct, points: correct ? q.points : 0 };
    });

    const percentage = Math.round((earned / totalPoints) * 100);
    const passed = percentage >= 50;
    // XP is proportional: full xpReward for 100%, scaled linearly, 0 for no correct answers.
    const xpEarned = earned > 0 ? Math.floor(quiz.xpReward * (earned / totalPoints)) : 0;

    return { score: earned, total: totalPoints, percentage, passed, xpEarned, breakdown };
  }
}
