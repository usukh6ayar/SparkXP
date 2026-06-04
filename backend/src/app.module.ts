import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WordsModule } from './words/words.module';
import { LessonsModule } from './lessons/lessons.module';

/**
 * Root module. Wires up the three foundations:
 *  - ConfigModule  — loads .env, available everywhere.
 *  - TypeOrmModule — PostgreSQL connection + all entities.
 *  - RedisModule   — shared Redis client (cache/queue).
 *
 * Feature modules (auth, vocabulary, AI gateway, ...) get added here later.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    RedisModule,
    UsersModule,
    AuthModule,
    WordsModule,
    LessonsModule,
  ],
})
export class AppModule {}
