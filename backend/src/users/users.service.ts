import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { sanitizeUser, SafeUser } from '../common/utils/sanitize-user';
import { UserRole } from '../common/enums';

// Re-export so existing imports of SafeUser from this module keep working.
export { SafeUser };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Strip the password hash before a user is returned over the API. */
  private sanitize(user: User): SafeUser {
    return sanitizeUser(user);
  }

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

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<SafeUser> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    Object.assign(user, dto);
    const saved = await this.users.save(user);
    return this.sanitize(saved);
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
