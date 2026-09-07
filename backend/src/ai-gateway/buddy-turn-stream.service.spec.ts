import { BuddyTurnStreamService } from './buddy-turn-stream.service';

/**
 * The registry that lets the phone hear a reply before the turn request
 * returns. Its whole value rests on three behaviours, each of which broke at
 * least once while it was being built:
 *
 *  - the client's first chunk request routinely arrives BEFORE the turn is
 *    opened (the turn starts behind STT), and returning "unknown turn" there
 *    silently disables the entire feature;
 *  - a waiter must be woken the moment its chunk is published, not on a poll;
 *  - barge-in must release waiters instead of leaving them hanging.
 */
describe('BuddyTurnStreamService', () => {
  const USER = 'user-1';
  const OTHER = 'user-2';
  const TURN = 'turn-1';
  const chunk = (index: number, last = false) => ({
    index,
    text: `piece ${index}`,
    mimeType: 'audio/mpeg',
    durationMs: 100,
    visemes: null,
    emotion: null,
    last,
  });

  let svc: BuddyTurnStreamService;
  beforeEach(() => {
    svc = new BuddyTurnStreamService();
  });

  it('lets a waiter arrive before the turn is opened', async () => {
    // The real ordering: the app long-polls chunk 0 while the upload is still
    // in flight, and `open()` only runs once STT has finished.
    const waiting = svc.waitFor(TURN, 0, USER);
    svc.open(TURN, USER);
    svc.publish(TURN, chunk(0, true), Buffer.from('a'));
    await expect(waiting).resolves.toEqual({ chunk: chunk(0, true), aborted: false });
  });

  it('does not discard an early waiter when the turn is opened', async () => {
    // `open()` used to replace the entry wholesale, orphaning the waiter.
    const waiting = svc.waitFor(TURN, 0, USER);
    svc.open(TURN, USER);
    svc.open(TURN, USER); // a retry must not orphan it either
    svc.publish(TURN, chunk(0, true), Buffer.from('a'));
    await expect(waiting).resolves.toMatchObject({ aborted: false });
  });

  it('returns an already-published chunk immediately', async () => {
    svc.open(TURN, USER);
    svc.publish(TURN, chunk(0), Buffer.from('a'));
    await expect(svc.waitFor(TURN, 0, USER)).resolves.toMatchObject({
      chunk: chunk(0),
    });
  });

  it('reports no chunk once the turn finished without one', async () => {
    svc.open(TURN, USER);
    const waiting = svc.waitFor(TURN, 3, USER);
    svc.finish(TURN);
    await expect(waiting).resolves.toEqual({ chunk: null, aborted: false });
  });

  it('releases waiters on barge-in and reports it', async () => {
    svc.open(TURN, USER);
    const waiting = svc.waitFor(TURN, 0, USER);
    svc.abort(TURN, USER);
    await expect(waiting).resolves.toEqual({ chunk: null, aborted: true });
    expect(svc.isAborted(TURN)).toBe(true);
  });

  it('ignores a barge-in from another user', () => {
    svc.open(TURN, USER);
    svc.abort(TURN, OTHER);
    expect(svc.isAborted(TURN)).toBe(false);
  });

  it('drops chunks published after a barge-in', () => {
    svc.open(TURN, USER);
    svc.abort(TURN, USER);
    svc.publish(TURN, chunk(0), Buffer.from('a'));
    expect(svc.audioFor(TURN, 0, USER)).toBeNull();
  });

  it('never hands audio to another user', () => {
    svc.open(TURN, USER);
    svc.publish(TURN, chunk(0), Buffer.from('a'));
    expect(svc.audioFor(TURN, 0, OTHER)).toBeNull();
    expect(svc.audioFor(TURN, 0, USER)).toEqual(Buffer.from('a'));
  });

  it('reports the chunk\'s own content type, not a hardcoded one', () => {
    // The route used to answer `audio/mpeg` for every chunk. Azure returns mp3
    // so it looked right, but Gemini returns WAV — and a WAV announced as mp3
    // is a turn the phone cannot decode at all.
    svc.open(TURN, USER);
    svc.publish(
      TURN,
      { ...chunk(0), mimeType: 'audio/wav' },
      Buffer.from('a'),
    );
    expect(svc.mimeFor(TURN, 0, USER)).toBe('audio/wav');
    expect(svc.mimeFor(TURN, 0, OTHER)).toBeNull(); // never across users
    expect(svc.mimeFor(TURN, 1, USER)).toBeNull(); // no such chunk yet
  });

  it('keeps chunks addressable by index, so order cannot be lost', () => {
    svc.open(TURN, USER);
    // Publishing out of order is possible if a later synthesis wins the race;
    // the index, not arrival order, decides what the client plays when.
    svc.publish(TURN, chunk(1, true), Buffer.from('b'));
    svc.publish(TURN, chunk(0), Buffer.from('a'));
    expect(svc.audioFor(TURN, 0, USER)).toEqual(Buffer.from('a'));
    expect(svc.audioFor(TURN, 1, USER)).toEqual(Buffer.from('b'));
  });
});
