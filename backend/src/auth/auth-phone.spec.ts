import { HttpException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

const codeOf = (e: unknown) =>
  ((e as HttpException).getResponse() as { code?: string }).code;

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u-1',
    email: null,
    username: 'bataa_07',
    fullName: 'Батбаяр',
    role: 'student',
    xp: 0,
    sparks: 0,
    emailVerified: false,
    avatarUrl: null,
    level: null,
    province: null,
    district: null,
    phone: '99112233',
    phoneVerifiedAt: new Date(),
    passwordHash: null,
    ...over,
  };
}

function setup() {
  const usersService = {
    findByUsernameOrEmail: jest.fn().mockResolvedValue(null),
    findByVerifiedPhone: jest.fn().mockResolvedValue(null),
    isPhoneTaken: jest.fn().mockResolvedValue(false),
    findByEmail: jest.fn().mockResolvedValue(null),
    assertUsernameFree: jest.fn(),
    create: jest.fn(async (d) => userRow({ ...d, id: 'new' })),
    setPasswordHash: jest.fn(),
    setVerifiedPhone: jest.fn(),
    findById: jest.fn(async () => userRow()),
  };
  const phone = { consume: jest.fn() };
  const referrals = { applyReferralOnVerify: jest.fn() };
  const xp = {
    awardOnce: jest.fn(),
    rewards: jest.fn().mockResolvedValue({ onboarding: 10 }),
  };
  const identities = { count: jest.fn().mockResolvedValue(0) };
  const jwt = { sign: jest.fn().mockReturnValue('jwt') };
  const svc = new AuthService(
    usersService as never,
    jwt as never,
    {} as never,
    referrals as never,
    xp as never,
    {} as never /* redis — unused by phone flows */,
    identities as never,
    phone as never,
  );
  return { svc, usersService, phone, referrals, xp };
}

describe('AuthService — phone flows', () => {
  it('registerWithPhone creates a verified-phone account and logs in', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'register',
      userId: null,
    });

    const res = await svc.registerWithPhone({
      verificationId: 'v',
      username: 'bataa_07',
      password: 'secret1',
      fullName: 'Батбаяр',
    });

    expect(phone.consume).toHaveBeenCalledWith('v', 'register');
    const created = usersService.create.mock.calls[0][0];
    expect(created).toMatchObject({
      phone: '99112233',
      email: null,
      emailVerified: false,
    });
    expect(created.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(res.accessToken).toBe('jwt');
    expect(res.user.needsPhone).toBe(false);
  });

  it('registerWithPhone grants referral + onboarding XP once', async () => {
    const { svc, phone, referrals, xp } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'register',
      userId: null,
    });
    await svc.registerWithPhone({
      verificationId: 'v',
      username: 'bataa_07',
      password: 'secret1',
      fullName: 'Б',
      referralCode: 'SPARK-7K2Q',
      tasteCompleted: true,
    });
    expect(referrals.applyReferralOnVerify).toHaveBeenCalledWith(
      expect.anything(),
      'SPARK-7K2Q',
    );
    expect(xp.awardOnce).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10 }),
    );
  });

  it('registerWithPhone → 409 PHONE_TAKEN when the number has an account', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'register',
      userId: null,
    });
    usersService.isPhoneTaken.mockResolvedValue(true);
    const err = await svc
      .registerWithPhone({
        verificationId: 'v',
        username: 'x_1',
        password: 'secret1',
        fullName: 'Б',
      })
      .catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(codeOf(err)).toBe('PHONE_TAKEN');
  });

  it('registerWithPhone → 409 PHONE_TAKEN when the unique index loses a race', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'register',
      userId: null,
    });
    usersService.create.mockRejectedValue(
      Object.assign(new Error('dup'), {
        code: '23505',
        detail: 'Key (phone)=(99112233)',
      }),
    );
    const err = await svc
      .registerWithPhone({
        verificationId: 'v',
        username: 'x_1',
        password: 'secret1',
        fullName: 'Б',
      })
      .catch((e) => e);
    expect(codeOf(err)).toBe('PHONE_TAKEN');
  });

  it('registerWithPhone → 409 EMAIL_TAKEN when the optional email is used', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'register',
      userId: null,
    });
    usersService.findByEmail.mockResolvedValue(userRow({ id: 'other' }));
    const err = await svc
      .registerWithPhone({
        verificationId: 'v',
        username: 'x_1',
        password: 'secret1',
        fullName: 'Б',
        email: 'a@b.mn',
      })
      .catch((e) => e);
    expect(codeOf(err)).toBe('EMAIL_TAKEN');
  });

  it('loginWithPhone logs into the account with that verified phone', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'login',
      userId: null,
    });
    usersService.findByVerifiedPhone.mockResolvedValue(userRow());
    const res = await svc.loginWithPhone('v');
    expect(res.user.id).toBe('u-1');
  });

  it('resetWithPhone sets the new password and logs in', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'reset',
      userId: null,
    });
    usersService.findByVerifiedPhone.mockResolvedValue(userRow());
    await svc.resetWithPhone('v', 'newpass1');
    const [id, hash] = usersService.setPasswordHash.mock.calls[0];
    expect(id).toBe('u-1');
    expect(await bcrypt.compare('newpass1', hash)).toBe(true);
  });

  it('linkPhone refuses a proof started by another user', async () => {
    const { svc, phone } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'link',
      userId: 'someone-else',
    });
    const err = await svc
      .linkPhone(userRow({ id: 'u-1', phoneVerifiedAt: null }) as never, 'v')
      .catch((e) => e);
    expect(codeOf(err)).toBe('VERIFICATION_INVALID');
  });

  it('linkPhone attaches the number to the caller', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({
      phone: '99112233',
      purpose: 'link',
      userId: 'u-1',
    });
    await svc.linkPhone(
      userRow({ id: 'u-1', phoneVerifiedAt: null }) as never,
      'v',
    );
    expect(usersService.setVerifiedPhone).toHaveBeenCalledWith(
      'u-1',
      '99112233',
    );
  });

  it('login accepts a verified phone as identifier', async () => {
    const { svc, usersService } = setup();
    const hash = await bcrypt.hash('secret1', 4);
    usersService.findByVerifiedPhone.mockResolvedValue(
      userRow({ passwordHash: hash }),
    );
    const res = await svc.login({
      identifier: '9911 2233',
      password: 'secret1',
    });
    expect(usersService.findByVerifiedPhone).toHaveBeenCalledWith('99112233');
    expect(res.user.id).toBe('u-1');
  });

  it('a phone-registered account without a verified email is NOT blocked by EMAIL_NOT_VERIFIED', async () => {
    const { svc, usersService } = setup();
    const hash = await bcrypt.hash('secret1', 4);
    usersService.findByUsernameOrEmail.mockResolvedValue(
      userRow({ passwordHash: hash }),
    );
    await expect(
      svc.login({ identifier: 'bataa_07', password: 'secret1' }),
    ).resolves.toBeDefined();
  });

  it('an account with neither a verified email nor a phone signs in and is sent to the phone gate', async () => {
    const { svc, usersService } = setup();
    const hash = await bcrypt.hash('secret1', 4);
    usersService.findByUsernameOrEmail.mockResolvedValue(
      userRow({ passwordHash: hash, email: 'old@x.mn', emailVerified: false, phone: null, phoneVerifiedAt: null }),
    );
    const res = await svc.login({ identifier: 'old@x.mn', password: 'secret1' });
    expect(res.accessToken).toBe('jwt');
    expect(res.user.needsPhone).toBe(true);
  });
});
