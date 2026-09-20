import { TurnTimer } from './buddy.service';

/**
 * `TurnTimer` is the instrument every latency claim in this repo rests on —
 * the Phase 1–5 numbers, `scripts/buddy-latency.sql`, and the acceptance
 * targets are all just readings taken from it. An instrument nobody checks is
 * how a measurement bug survives for months, which is exactly what happened:
 * the timer used to be constructed *after* `audioTurn`'s pre-checks, so their
 * round trips were silently charged to `upload_ms` and the network looked
 * slower than it was (fixed 2026-09-19).
 *
 * These tests pin the meaning of each field, not its value.
 */
describe('TurnTimer', () => {
  const at = (ms: number) => jest.spyOn(Date, 'now').mockReturnValue(ms);

  afterEach(() => jest.restoreAllMocks());

  it('measures upload as t0 → the moment the timer starts', () => {
    at(1_000);
    const timer = new TurnTimer(600);
    expect(timer.snapshot().upload_ms).toBe(400);
  });

  it('omits upload when the client sent no t0', () => {
    at(1_000);
    expect(new TurnTimer().snapshot().upload_ms).toBeUndefined();
  });

  it('ignores a client clock that runs ahead of the server', () => {
    // t0 is the phone's epoch and phones lie. A negative upload would poison
    // every percentile it lands in, so it is dropped rather than clamped.
    at(1_000);
    expect(new TurnTimer(5_000).snapshot().upload_ms).toBeUndefined();
  });

  it('charges each stage only the time since the previous one', () => {
    at(1_000);
    const timer = new TurnTimer();
    at(1_300);
    timer.mark('precheck');
    at(2_500);
    timer.mark('stt');
    const stages = timer.snapshot();
    // The whole point: `stt` is 1200, not 1500. A stage that accumulated the
    // ones before it would make every later stage look like the slow one.
    expect(stages.precheck_ms).toBe(300);
    expect(stages.stt_ms).toBe(1200);
  });

  it('records an out-of-band measurement without disturbing the stage chain', () => {
    // `set` exists for things that happen INSIDE a stage — the provider's
    // time-to-first-byte, say — so it must not move the cursor `mark` uses.
    at(1_000);
    const timer = new TurnTimer();
    at(1_500);
    timer.set('tts_first_chunk_provider', 298);
    timer.mark('tts');
    const stages = timer.snapshot();
    expect(stages.tts_first_chunk_provider_ms).toBe(298);
    expect(stages.tts_ms).toBe(500);
  });

  it('drops a negative out-of-band measurement rather than reporting it', () => {
    at(1_000);
    const timer = new TurnTimer();
    timer.set('tts_first_chunk_provider', -5);
    expect(timer.snapshot().tts_first_chunk_provider_ms).toBeUndefined();
  });

  it('reports t0 → response only when t0 is known', () => {
    at(1_000);
    const withT0 = new TurnTimer(600); // upload 400
    at(3_000);
    expect(withT0.snapshot()).toMatchObject({
      server_total_ms: 2_000,
      t0_to_response_ms: 2_400, // upload + server time
    });

    at(1_000);
    const withoutT0 = new TurnTimer();
    at(3_000);
    expect(withoutT0.snapshot().t0_to_response_ms).toBeUndefined();
  });

  it('reports whether a stage has been seen, so only the FIRST is recorded', () => {
    // The streaming path calls `set('llm_first_token')` on every delta; without
    // `has` the field would keep being overwritten and end up meaning "last
    // token", which is a completely different number.
    at(1_000);
    const timer = new TurnTimer();
    expect(timer.has('llm_first_token')).toBe(false);
    timer.set('llm_first_token', 120);
    expect(timer.has('llm_first_token')).toBe(true);
  });

  it('carries one id so the server stages and the client marks join up', () => {
    at(1_000);
    const timer = new TurnTimer();
    expect(timer.snapshot().turn_id).toBe(timer.turnId);
    expect(timer.turnId).toHaveLength(8);
  });
});
