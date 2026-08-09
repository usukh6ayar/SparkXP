import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserIdentity } from '../entities/user-identity.entity';
import { SocialAuthService } from './social/social-auth.service';
import { SocialTokenService } from './social/social-token.service';
import { UsersModule } from '../users/users.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { XpModule } from '../xp/xp.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { resolveJwtSecret } from './jwt-secret';

/**
 * Wires up JWT auth. JwtModule is configured async so the secret and expiry
 * come from .env (configurable per environment, no code change).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserIdentity]),
    UsersModule,
    ReferralsModule,
    XpModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SocialTokenService, SocialAuthService],
})
export class AuthModule {}
