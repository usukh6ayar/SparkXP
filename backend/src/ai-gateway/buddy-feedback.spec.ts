import { NotFoundException } from '@nestjs/common';
import { BuddyService } from './buddy.service';
import { MessageRole } from '../common/enums';

/**
 * `submitFeedback` — and specifically the `report` branch.
 *
 * Why this exists: reporting an offensive AI reply is what Google Play's
 * Generative AI policy requires an app to offer, and the visible half (a flag
 * on the bubble) is worthless if the server quietly drops it. The regression to
 * catch is someone later "simplifying" the method back to a metadata write, so
 * reports stop reaching the admin safety log with no compile error to show it.
 *
 * The method only touches two repositories, so it is exercised through
 * `Function.call` with fakes instead of booting the DI container — the same
 * spirit as the other specs here, which test logic rather than wiring.
 */
describe('BuddyService.submitFeedback', () => {
  const USER = 'user-1';
  const MESSAGE_ID = '11111111-1111-4111-8111-111111111111';

  function harness(message: Record<string, unknown> | null) {
    const saved: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    return {
      saved,
      events,
      ctx: {
        messages: {
          findOne: jest.fn().mockResolvedValue(message),
          save: jest.fn(async (m: Record<string, unknown>) => { saved.push(m); return m; }),
        },
        safetyEvents: {
          create: jest.fn((e: Record<string, unknown>) => e),
          save: jest.fn(async (e: Record<string, unknown>) => { events.push(e); return e; }),
        },
      },
    };
  }

  const call = (
    ctx: unknown,
    rating: 'up' | 'down' | 'report',
    reason?: string,
  ) => BuddyService.prototype.submitFeedback.call(ctx, USER, MESSAGE_ID, rating, reason);

  const assistantMessage = () => ({
    id: MESSAGE_ID,
    sessionId: 'session-9',
    content: 'Some reply the user objected to',
    metadata: { latency: { total_ms: 900 } },
  });

  it('records a thumbs-down on the message without raising a safety event', async () => {
    const h = harness(assistantMessage());

    await expect(call(h.ctx, 'down', 'too fast')).resolves.toEqual({ ok: true });

    expect(h.saved).toHaveLength(1);
    expect(h.saved[0].metadata).toMatchObject({
      feedback: { rating: 'down', reason: 'too fast' },
      // Pre-existing metadata must survive — the turn's latency numbers are read
      // back out of here for the p50/p95 query.
      latency: { total_ms: 900 },
    });
    expect(h.events).toHaveLength(0);
  });

  it('raises a high-severity safety event when the reply is reported', async () => {
    const h = harness(assistantMessage());

    await expect(call(h.ctx, 'report', 'rude')).resolves.toEqual({ ok: true });

    expect(h.events).toHaveLength(1);
    expect(h.events[0]).toMatchObject({
      userId: USER,
      sessionId: 'session-9',
      eventType: 'user_report',
      severity: 'high',
      details: {
        messageId: MESSAGE_ID,
        reason: 'rude',
        // The admin must be able to judge the report without going and
        // fetching the message themselves.
        replyText: 'Some reply the user objected to',
      },
    });
    // The rating is still written to the message, so the two views agree.
    expect(h.saved[0].metadata).toMatchObject({ feedback: { rating: 'report' } });
  });

  it('reports a reply that has no session (typed chat) with a null sessionId', async () => {
    const h = harness({ ...assistantMessage(), sessionId: null });

    await call(h.ctx, 'report');

    expect(h.events[0]).toMatchObject({ sessionId: null, details: { reason: null } });
  });

  it('rejects a message that is not the caller’s assistant reply', async () => {
    const h = harness(null);

    await expect(call(h.ctx, 'report')).rejects.toBeInstanceOf(NotFoundException);
    expect(h.events).toHaveLength(0);
    expect(h.saved).toHaveLength(0);
  });

  it('scopes the lookup to the caller and to assistant messages', async () => {
    const h = harness(assistantMessage());

    await call(h.ctx, 'up');

    // Ownership is enforced in the query, not after the fact: without `userId`
    // here anyone holding a message id could report someone else's chat.
    expect(h.ctx.messages.findOne).toHaveBeenCalledWith({
      where: { id: MESSAGE_ID, userId: USER, role: MessageRole.ASSISTANT },
    });
  });
});
