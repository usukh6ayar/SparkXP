/** Just the ioredis surface PhoneVerificationService uses. TTLs are ignored. */
export class FakeRedis {
  store = new Map<string, string>();

  async get(k: string) { return this.store.get(k) ?? null; }
  async set(k: string, v: string) { this.store.set(k, v); return 'OK'; }
  async del(...ks: string[]) { let n = 0; for (const k of ks) if (this.store.delete(k)) n++; return n; }
  async exists(k: string) { return this.store.has(k) ? 1 : 0; }
  async getdel(k: string) { const v = this.store.get(k) ?? null; this.store.delete(k); return v; }
  async incr(k: string) { const n = Number(this.store.get(k) ?? 0) + 1; this.store.set(k, String(n)); return n; }
  async expire() { return 1; }
}
