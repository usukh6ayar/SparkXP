import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuddyMemory } from '../entities/buddy-memory.entity';
import { User } from '../entities/user.entity';
import { BuddyMemoryType } from '../common/enums';

const MIN_VALUE_LEN = 10;
const MAX_VALUE_LEN = 300;
/** Two memories are "the same" above this normalized-overlap ratio. */
const DEDUPE_RATIO = 0.8;

export interface MemorySuggestion {
  memoryType: BuddyMemoryType;
  value: string;
  sourceMessageId?: string;
}

/**
 * Long-term AI Buddy memory: the LLM *suggests* facts (memory_update); the
 * backend decides what to actually keep (docx §8) — filter trivial/duplicate
 * lines, cap per-user storage by plan.memoryMbLimit, and let the user wipe it.
 */
@Injectable()
export class BuddyMemoryService {
  private readonly logger = new Logger(BuddyMemoryService.name);

  constructor(
    @InjectRepository(BuddyMemory)
    private readonly memories: Repository<BuddyMemory>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Memories for the system prompt: most important + recent first. */
  async getContextMemories(userId: string, limit = 10): Promise<BuddyMemory[]> {
    return this.memories.find({
      where: { userId },
      order: { importance: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Plain values for the mobile "what the buddy remembers" screen. */
  async list(userId: string): Promise<BuddyMemory[]> {
    return this.memories.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async clear(userId: string): Promise<void> {
    await this.memories.delete({ userId });
  }

  /**
   * Apply the backend write filter to one LLM suggestion. Returns the saved row
   * or null if rejected (too short/long, or a near-duplicate of an existing one).
   */
  async maybeSave(
    userId: string,
    suggestion: MemorySuggestion,
  ): Promise<BuddyMemory | null> {
    const value = suggestion.value.trim();
    if (value.length < MIN_VALUE_LEN || value.length > MAX_VALUE_LEN) return null;

    const existing = await this.memories.find({ where: { userId } });
    if (existing.some((m) => overlap(m.value, value) >= DEDUPE_RATIO)) return null;

    const saved = await this.memories.save(
      this.memories.create({
        userId,
        memoryType: suggestion.memoryType,
        value,
        importance: suggestion.memoryType === BuddyMemoryType.MISTAKE_PATTERN ? 3 : 1,
        sourceMessageId: suggestion.sourceMessageId ?? null,
      }),
    );

    await this.enforceCap(userId);
    return saved;
  }

  /** Evict oldest, least-important memories until under the plan's byte cap. */
  private async enforceCap(userId: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId }, relations: ['plan'] });
    const capMb = user?.plan?.memoryMbLimit ?? null;
    if (capMb === null) return; // unlimited
    const capBytes = capMb * 1024 * 1024;

    const rows = await this.memories.find({
      where: { userId },
      order: { importance: 'ASC', createdAt: 'ASC' },
    });
    let total = rows.reduce((sum, r) => sum + Buffer.byteLength(r.value), 0);
    for (const row of rows) {
      if (total <= capBytes) break;
      await this.memories.delete({ id: row.id });
      total -= Buffer.byteLength(row.value);
    }
  }
}

/** Word-overlap ratio (0–1) between two lowercased strings — cheap dedupe. */
function overlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}
