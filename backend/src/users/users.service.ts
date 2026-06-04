import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * Data-access for users. Kept thin and reusable so other modules (Auth now,
 * profiles/admin later) share one place that touches the User table.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Look up by email (used for login + duplicate checks). Null if not found. */
  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  /** Look up by id (used to resolve the JWT subject). Null if not found. */
  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /**
   * Create and save a user. Caller passes an already-hashed password — this
   * service never hashes, so the hashing rule stays in one place (AuthService).
   */
  create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
  }): Promise<User> {
    const user = this.users.create(data);
    return this.users.save(user);
  }
}
