import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';

/** User without the password hash — safe to return to clients. */
export type PublicUser = Omit<User, 'passwordHash'>;

export interface PaginatedUsers {
  items: PublicUser[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Data-access + operations for users. Shared by Auth (lookup/create) and the
 * profile/admin endpoints here.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  // --- Used by AuthService ---

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    province?: string | null;
    district?: string | null;
  }): Promise<User> {
    const user = this.users.create(data);
    return this.users.save(user);
  }

  // --- Self-service (the logged-in user acting on themselves) ---

  /** Update the caller's own profile (name + location). */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const user = await this.getOrThrow(userId);
    Object.assign(user, dto);
    const saved = await this.users.save(user);
    return this.sanitize(saved);
  }

  /** The caller's gamification balances. */
  async getStats(userId: string): Promise<{ xp: number; sparks: number }> {
    const user = await this.getOrThrow(userId);
    return { xp: user.xp, sparks: user.sparks };
  }

  // --- Admin ---

  /** List users with optional role filter + email/name search + pagination. */
  async findAll(query: QueryUsersDto): Promise<PaginatedUsers> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.users.createQueryBuilder('u');
    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    if (query.search) {
      qb.andWhere('(u.email ILIKE :s OR u.fullName ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    qb.orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map((u) => this.sanitize(u)), total, page, limit };
  }

  async findOnePublic(id: string): Promise<PublicUser> {
    return this.sanitize(await this.getOrThrow(id));
  }

  /** Admin edit of another user (can change role, org, location). */
  async adminUpdate(id: string, dto: AdminUpdateUserDto): Promise<PublicUser> {
    const user = await this.getOrThrow(id);
    Object.assign(user, dto);
    const saved = await this.users.save(user);
    return this.sanitize(saved);
  }

  async remove(id: string): Promise<void> {
    const user = await this.getOrThrow(id);
    await this.users.remove(user);
  }

  // --- Helpers ---

  private async getOrThrow(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }
    return user;
  }

  /** Strip the password hash before returning a user to a client. */
  private sanitize(user: User): PublicUser {
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }
}
