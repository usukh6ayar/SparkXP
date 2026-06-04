import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

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
  }): Promise<User> {
    const user = this.users.create(data);
    return this.users.save(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    Object.assign(user, dto);
    return this.users.save(user);
  }

  getStats(user: User): { xp: number; sparks: number } {
    return { xp: user.xp, sparks: user.sparks };
  }

  /** Admin: paginated user list. */
  findAll(page = 1, limit = 20): Promise<[User[], number]> {
    return this.users.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async remove(id: string): Promise<void> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    await this.users.remove(user);
  }
}
