import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/** Cost factor for bcrypt. 10 is a good default for an MVP. */
const BCRYPT_ROUNDS = 10;

/** What the API returns on successful register/login. */
export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

/** User fields safe to send to the client (never the password hash). */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  xp: number;
  sparks: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Create a new account, then return a token so the user is logged in. */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      province: dto.province ?? null,
      district: dto.district ?? null,
    });

    return this.buildAuthResult(user);
  }

  /** Verify credentials and return a fresh token. */
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    // Same error whether email or password is wrong — don't leak which.
    if (!user) {
      throw new UnauthorizedException('Имэйл эсвэл нууц үг буруу байна');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Имэйл эсвэл нууц үг буруу байна');
    }

    return this.buildAuthResult(user);
  }

  /** Signs a JWT and strips the user down to client-safe fields. */
  private buildAuthResult(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  /** Maps a User entity to the public shape (drops passwordHash, relations). */
  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      xp: user.xp,
      sparks: user.sparks,
    };
  }
}
