import { SocialAuthService } from './social-auth.service';
import { AuthProvider } from '../../common/enums';

/**
 * An address typed at sign-up is no longer verified (phone sign-up keeps email
 * optional and unverified). If Google/Apple sign-in still linked to ANY account
 * with that address, an attacker could pre-register with the victim's email and
 * receive the victim's later Google sign-in. Only verified addresses may link.
 */
function setup(byEmail: { id: string; emailVerified: boolean } | null) {
  const identities = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };
  const tokens = {
    verify: jest.fn().mockResolvedValue({
      provider: AuthProvider.GOOGLE,
      sub: 'g-1',
      email: 'victim@gmail.com',
      emailVerified: true,
      fullName: 'Victim',
    }),
  };
  const usersService = {
    findByEmail: jest.fn().mockResolvedValue(byEmail),
    markEmailVerified: jest.fn(),
    assertUsernameFree: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const authService = {
    buildAuthResult: jest
      .fn()
      .mockResolvedValue({ accessToken: 't', user: {} }),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('ticket'),
    verify: jest.fn(),
  };
  const svc = new SocialAuthService(
    identities as never,
    tokens as never,
    usersService as never,
    authService as never,
    jwtService as never,
  );
  return { svc, identities, usersService, authService };
}

describe('SocialAuthService — linking by email', () => {
  it('links to an account whose email IS verified', async () => {
    const { svc, identities } = setup({ id: 'u-1', emailVerified: true });
    const res = await svc.signIn(AuthProvider.GOOGLE, 'id-token');
    expect(res).toMatchObject({ needsUsername: false });
    expect(identities.save).toHaveBeenCalled();
  });

  it('does NOT link to (or verify) an account whose email is unverified', async () => {
    const { svc, identities, usersService } = setup({
      id: 'attacker',
      emailVerified: false,
    });
    const res = await svc.signIn(AuthProvider.GOOGLE, 'id-token');
    expect(res).toMatchObject({ needsUsername: true });
    expect(identities.save).not.toHaveBeenCalled();
    expect(usersService.markEmailVerified).not.toHaveBeenCalled();
  });
});
