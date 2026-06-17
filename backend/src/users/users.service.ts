import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { sanitizeUser, SafeUser } from '../common/utils/sanitize-user';
import { UserRole } from '../common/enums';

// Re-export so existing imports of SafeUser from this module keep working.
export { SafeUser };

/** The user's plan + current usage, for the profile "plan / limit" card. */
export interface PlanInfo {
  isFree: boolean;
  planName: string;
  expiresAt: Date | null;
  limits: {
    voiceMinutes: number | null;
    sttMinutes: number | null;
    dictionaryAi: number | null;
    aiTextTokensK: number | null;
    memoryMb: number | null;
  } | null;
  usage: {
    voiceMinutes: number;
    sttMinutes: number;
    dictionaryAi: number;
    memoryMb: number;
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
  ) {}

  /** Current plan + usage for the logged-in user (Free if no active plan). */
  async getPlanInfo(user: User): Promise<PlanInfo> {
    const plan = user.planId
      ? await this.plans.findOne({ where: { id: user.planId } })
      : null;
    return {
      isFree: !plan,
      planName: plan?.name ?? 'Үнэгүй',
      expiresAt: user.planExpiresAt,
      limits: plan
        ? {
            voiceMinutes: plan.voiceMinutesLimit,
            sttMinutes: plan.sttMinutesLimit,
            dictionaryAi: plan.dictionaryAiLimit,
            aiTextTokensK: plan.aiTextTokensLimit,
            memoryMb: plan.memoryMbLimit,
          }
        : null,
      usage: {
        voiceMinutes: Math.round(user.voiceSecondsUsed / 60),
        sttMinutes: Math.round(user.sttSecondsUsed / 60),
        dictionaryAi: user.dictionaryAiCount,
        memoryMb: Math.round(user.memoryStorageMb),
      },
    };
  }

  /** Strip the password hash before a user is returned over the API. */
  private sanitize(user: User): SafeUser {
    return sanitizeUser(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOne({ where: { username } });
  }

  /** Find by username or email (case used by login: one field, either kind). */
  findByUsernameOrEmail(identifier: string): Promise<User | null> {
    return this.users.findOne({
      where: [{ username: identifier }, { email: identifier }],
    });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    username?: string | null;
    phone?: string | null;
    role?: UserRole;
    emailVerified?: boolean;
    level?: string | null;
    englishName?: string | null;
    province?: string | null;
    district?: string | null;
  }): Promise<User> {
    const user = this.users.create(data);
    return this.users.save(user);
  }

  /** Mark a user's email as verified (after a correct OTP). */
  async markEmailVerified(id: string): Promise<void> {
    await this.users.update(id, { emailVerified: true });
  }

  /** Set a new password hash (password reset). */
  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update(id, { passwordHash });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    Object.assign(user, dto);
    const saved = await this.users.save(user);
    return this.sanitize(saved);
  }

  /** Set the user's avatar (uploaded URL or default key) and return them. */
  async setAvatar(id: string, avatarUrl: string): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    user.avatarUrl = avatarUrl;
    return this.sanitize(await this.users.save(user));
  }

  getStats(user: User): { xp: number; sparks: number } {
    return { xp: user.xp, sparks: user.sparks };
  }

  /** Admin: paginated user list (password hashes stripped). */
  async findAll(page = 1, limit = 20): Promise<[SafeUser[], number]> {
    const [users, total] = await this.users.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return [users.map((user) => this.sanitize(user)), total];
  }

  async remove(id: string): Promise<void> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    await this.users.remove(user);
  }

  /** Super-admin: change a user's role. */
  async updateRole(id: string, role: UserRole): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    user.role = role;
    const saved = await this.users.save(user);
    return this.sanitize(saved);
  }
}
