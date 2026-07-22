import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { Lesson } from '../entities/lesson.entity';
import { Quiz } from '../entities/quiz.entity';
import { resolveSkill } from './skill';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
  ) {}

  /**
   * Persist one graded quiz submission. Called from POST /quizzes/:id/submit.
   * Resolves the skill from the quiz category, falling back to the parent
   * lesson's type only when the category is not itself a skill key.
   */
  async recordAttempt(params: {
    userId: string;
    quiz: Quiz;
    correctCount: number;
    totalCount: number;
    scorePct: number;
    assignmentId?: string | null;
  }): Promise<QuizAttempt> {
    let lessonType = null as Lesson['type'] | null;
    // Only pay for the lookup when the category can't answer it on its own.
    if (params.quiz.lessonId) {
      const lesson = await this.lessons.findOne({
        where: { id: params.quiz.lessonId },
        select: { id: true, type: true },
      });
      lessonType = lesson?.type ?? null;
    }
    const skill = resolveSkill(params.quiz.category, lessonType);
    const attempt = this.attempts.create({
      userId: params.userId,
      quizId: params.quiz.id,
      skill,
      correctCount: params.correctCount,
      totalCount: params.totalCount,
      scorePct: params.scorePct,
      assignmentId: params.assignmentId ?? null,
    });
    return this.attempts.save(attempt);
  }
}
