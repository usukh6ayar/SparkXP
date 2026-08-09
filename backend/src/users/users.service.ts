import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
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

  /**
   * Find by email, ignoring letter case.
   *
   * Email addresses are not case-sensitive in practice, but we store them as
   * typed. Matching exactly meant `Bataa@Gmail.com` and `bataa@gmail.com` were
   * two different accounts on sign-up, and a password reset typed in the "wrong"
   * case simply found nobody.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.byLower('email', email);
  }

  /**
   * Find by username OR email, ignoring letter case — the login lookup, where
   * one field accepts either kind of handle.
   *
   * `assertUsernameFree` has always compared case-insensitively, so the app
   * promised that `Bataa` and `bataa` are the same person; login then demanded
   * the exact case and locked that person out. Both ends agree now.
   */
  findByUsernameOrEmail(identifier: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .where('LOWER(u.username) = LOWER(:id) OR LOWER(u.email) = LOWER(:id)', {
        id: identifier,
      })
      // Rows predating the case-insensitive check can still collide (the unique
      // index is on the raw value). Whoever typed their handle exactly as
      // registered keeps getting their own account, i.e. no existing login
      // changes meaning — see the migration on `LOWER(username)`.
      .orderBy('CASE WHEN u.username = :id OR u.email = :id THEN 0 ELSE 1 END', 'ASC')
      .getOne();
  }

  /**
   * `WHERE LOWER(col) = LOWER(:value)`, which is what the `LOWER(...)`
   * expression indexes from `AddLowerUsernameEmailIndexes` are built for.
   * `LOWER(...) =` rather than `ILike`: `_` and `%` are legal in an email local
   * part and `_` in a username, and both are wildcards to LIKE.
   */
  private byLower(column: 'email' | 'username', value: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .where(`LOWER(u.${column}) = LOWER(:value)`, { value })
      .orderBy(`CASE WHEN u.${column} = :value THEN 0 ELSE 1 END`, 'ASC')
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  create(data: {
    email: string;
    /** `null` for a Google/Apple account — it signs in without a password. */
    passwordHash: string | null;
    fullName: string;
    username?: string | null;
    phone?: string | null;
    role?: UserRole;
    emailVerified?: boolean;
    level?: string | null;
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

  /**
   * Throw 409 unless `username` is free. Used by sign-up and by profile edit,
   * so both answer the same way.
   *
   * The comparison is case-insensitive: login matches the handle exactly, so
   * letting `Bataa` and `bataa` both exist would be two accounts that look like
   * one person. `LOWER(...) =` (not `ILike`) because `_` is a legal username
   * character but a single-character wildcard in LIKE.
   */
  async assertUsernameFree(username: string, excludeUserId?: string): Promise<void> {
    const query = this.users
      .createQueryBuilder('u')
      .where('LOWER(u.username) = LOWER(:username)', { username });
    // Keeping your own handle is never a clash. Excluded in SQL (not by reading
    // one row and comparing ids) so the answer stays the same even if the table
    // already holds case-variants of one name — the unique index is on the raw
    // value, so `Bataa` + `bataa` can both pre-date this check.
    if (excludeUserId) query.andWhere('u.id != :excludeUserId', { excludeUserId });
    if (await query.getCount()) {
      throw new ConflictException('Энэ username аль хэдийн бүртгэлтэй байна');
    }
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    // The username is the login handle → it must stay unique. Skipped when it
    // didn't change, so re-saving your own profile is never a conflict.
    if (dto.username && dto.username !== user.username) {
      await this.assertUsernameFree(dto.username, id);
    }
    Object.assign(user, dto);
    try {
      const saved = await this.users.save(user);
      return this.sanitize(saved);
    } catch (err) {
      // Two people can pass the check above at the same moment; the unique index
      // is the real referee. Its 23505 must still read as 409, not a 500.
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('Энэ username аль хэдийн бүртгэлтэй байна');
      }
      throw err;
    }
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
  async findAll(
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<[SafeUser[], number]> {
    // Case-insensitive search across email / full name / username / phone.
    const where = search?.trim()
      ? [
          { email: ILike(`%${search.trim()}%`) },
          { fullName: ILike(`%${search.trim()}%`) },
          { username: ILike(`%${search.trim()}%`) },
          { phone: ILike(`%${search.trim()}%`) },
        ]
      : undefined;
    const [users, total] = await this.users.findAndCount({
      where,
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
