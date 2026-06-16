import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WordsModule } from './words/words.module';
import { LessonsModule } from './lessons/lessons.module';
import { ReviewsModule } from './reviews/reviews.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { XpModule } from './xp/xp.module';
import { SparksModule } from './sparks/sparks.module';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ClassesModule } from './classes/classes.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { PaymentsModule } from './payments/payments.module';
import { UploadModule } from './upload/upload.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    RedisModule,
    MailModule,
    UsersModule,
    AuthModule,
    WordsModule,
    LessonsModule,
    ReviewsModule,
    LeaderboardModule,
    QuizzesModule,
    XpModule,
    SparksModule,
    AiGatewayModule,
    HealthModule,
    OrganizationsModule,
    ClassesModule,
    AssignmentsModule,
    PaymentsModule,
    UploadModule,
    NotificationsModule,
  ],
})
export class AppModule {}
