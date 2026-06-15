import { User } from '../../entities/user.entity';

/** A User with its secret fields removed, safe to return over the API. */
export type SafeUser = Omit<User, 'passwordHash'>;

/**
 * Strip the password hash off a User before it goes out over the API.
 *
 * Use this anywhere a User (or a list/relation of Users) is returned to a
 * client — e.g. the admin user list, a class's student roster. Keeping it in
 * one place means we never accidentally leak the hash from a new endpoint.
 */
export function sanitizeUser(user: User): SafeUser {
  const { passwordHash, ...rest } = user;
  return rest;
}
