import { HttpException } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';
import { VerifyMnConflictError, type VerifyMnClient } from './verify-mn.client';
import { FakeRedis } from './test/fake-redis';

const session = (id = 'vm-1') => ({
  sessionId: id,
  smsUri: 'sms:144773?body=123456',
  displayInstruction: 'Та өөрийн 99112233 дугаараас …',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
});

function setup() {
  const redis = new FakeRedis();
  const vm = {
    createSession: jest.fn().mockResolvedValue(session()),
    getStatus: jest.fn().mockResolvedValue('PENDING'),
  };
  const svc = new PhoneVerificationService(vm as unknown as VerifyMnClient, redis as never);
  return { svc, vm, redis };
}

const codeOf = (err: unknown) => ((err as HttpException).getResponse() as { code: string }).code;

describe('PhoneVerificationService', () => {
  it('start() returns OUR id, never the verify.mn session id', async () => {
    const { svc } = setup();
    const r = await svc.start('99112233', 'register');
    expect(r.verificationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(r)).not.toContain('vm-1');
    expect(r).toMatchObject({ smsUri: 'sms:144773?body=123456' });
  });

  it('sends a fresh 6-digit code each time', async () => {
    const { svc, vm } = setup();
    await svc.start('99112233', 'register');
    await svc.start('99112233', 'register');
    const [a, b] = vm.createSession.mock.calls.map((c) => c[1]);
    expect(a).toMatch(/^\d{6}$/);
    expect(b).toMatch(/^\d{6}$/);
  });

  it('retries once with a new code on verify.mn 409', async () => {
    const { svc, vm } = setup();
    vm.createSession.mockRejectedValueOnce(new VerifyMnConflictError()).mockResolvedValueOnce(session());
    await svc.start('99112233', 'register');
    expect(vm.createSession).toHaveBeenCalledTimes(2);
  });

  it('allows 3 sessions per phone, then 429', async () => {
    const { svc } = setup();
    for (let i = 0; i < 3; i++) await svc.start('99112233', 'login');
    const err = await svc.start('99112233', 'login').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(codeOf(err)).toBe('TOO_MANY_REQUESTS');
  });

  it('status: pending → verified, and stays verified on re-poll', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'register');
    expect(await svc.status(verificationId)).toEqual({ status: 'pending' });
    vm.getStatus.mockResolvedValue('VERIFIED');
    expect(await svc.status(verificationId)).toEqual({ status: 'verified' });
    expect(await svc.status(verificationId)).toEqual({ status: 'verified' });
    expect(vm.getStatus).toHaveBeenCalledTimes(2); // the 3rd poll is answered from Redis
  });

  it('status: EXPIRED and unknown ids are "expired"', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'register');
    vm.getStatus.mockResolvedValue('EXPIRED');
    expect(await svc.status(verificationId)).toEqual({ status: 'expired' });
    expect(await svc.status('00000000-0000-0000-0000-000000000000')).toEqual({ status: 'expired' });
  });

  it('consume() returns the proof exactly once', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'register');
    vm.getStatus.mockResolvedValue('VERIFIED');
    await svc.status(verificationId);

    await expect(svc.consume(verificationId, 'register')).resolves.toEqual({
      phone: '99112233',
      purpose: 'register',
      userId: null,
    });
    const again = await svc.consume(verificationId, 'register').catch((e) => e);
    expect(codeOf(again)).toBe('VERIFICATION_EXPIRED');
  });

  it('a register proof cannot be spent as a reset proof', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'register');
    vm.getStatus.mockResolvedValue('VERIFIED');
    await svc.status(verificationId);
    const err = await svc.consume(verificationId, 'reset').catch((e) => e);
    expect(codeOf(err)).toBe('VERIFICATION_INVALID');
  });

  it('consume() before the SMS arrived is VERIFICATION_INVALID', async () => {
    const { svc } = setup();
    const { verificationId } = await svc.start('99112233', 'login');
    const err = await svc.consume(verificationId, 'login').catch((e) => e);
    expect(codeOf(err)).toBe('VERIFICATION_INVALID');
  });

  it('link proofs carry the user id they were started for', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'link', 'user-1');
    vm.getStatus.mockResolvedValue('VERIFIED');
    await svc.status(verificationId);
    await expect(svc.consume(verificationId, 'link')).resolves.toMatchObject({ userId: 'user-1' });
  });
});
