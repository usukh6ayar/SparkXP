import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BuddyBackground } from '../entities/buddy-background.entity';
import { UserBuddyBackground } from '../entities/user-buddy-background.entity';
import { User } from '../entities/user.entity';
import { SparksService } from '../sparks/sparks.service';
import { SparksSource } from '../common/enums';
import { CreateBackgroundDto, UpdateBackgroundDto } from './dto/background.dto';

/** One shop row as the app sees it: catalog fields + this user's state. */
export interface BackgroundView {
  id: string;
  name: string;
  imageUrl: string;
  priceSparks: number;
  isPremium: boolean;
  seasonal: boolean;
  owned: boolean;
  equipped: boolean;
  /** Purchasable right now (active · in season · premium ok · not owned). */
  purchasable: boolean;
  /** Premium-only and the user has no active plan. */
  premiumLocked: boolean;
}

@Injectable()
export class BuddyBackgroundsService {
  constructor(
    @InjectRepository(BuddyBackground)
    private readonly backgrounds: Repository<BuddyBackground>,
    @InjectRepository(UserBuddyBackground)
    private readonly owned: Repository<UserBuddyBackground>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly sparks: SparksService,
    private readonly dataSource: DataSource,
  ) {}

  /** Whether the user has an active (non-expired) paid plan → premium content. */
  private async isPremiumUser(userId: string): Promise<boolean> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { plan: true },
      select: { id: true, planExpiresAt: true },
    });
    const plan = user?.plan;
    return (
      !!plan &&
      (!user?.planExpiresAt || user.planExpiresAt.getTime() > Date.now())
    );
  }

  /** Is a background live in the shop right now (active + inside its season)? */
  private inSeason(bg: BuddyBackground, now = new Date()): boolean {
    if (!bg.isActive) return false;
    if (bg.seasonalStart && bg.seasonalStart > now) return false;
    if (bg.seasonalEnd && bg.seasonalEnd < now) return false;
    return true;
  }

  /** The whole shop with this user's owned/equipped/lock state. */
  async list(userId: string): Promise<BackgroundView[]> {
    const now = new Date();
    const [all, mine, premium] = await Promise.all([
      this.backgrounds.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } }),
      this.owned.find({ where: { userId } }),
      this.isPremiumUser(userId),
    ]);
    const ownedMap = new Map(mine.map((o) => [o.backgroundId, o]));

    return (
      all
        // Hidden (inactive/out-of-season) rows still show if already owned, so a
        // user never "loses" a background they bought when its season ends.
        .filter((bg) => this.inSeason(bg, now) || ownedMap.has(bg.id))
        .map((bg) => {
          const own = ownedMap.get(bg.id);
          const premiumLocked = bg.isPremium && !premium;
          const live = this.inSeason(bg, now);
          return {
            id: bg.id,
            name: bg.name,
            imageUrl: bg.imageUrl,
            priceSparks: bg.priceSparks,
            isPremium: bg.isPremium,
            seasonal: !!(bg.seasonalStart || bg.seasonalEnd),
            owned: !!own,
            equipped: !!own?.equipped,
            purchasable: !own && live && !premiumLocked,
            premiumLocked,
          };
        })
    );
  }

  /** The user's currently-equipped background (or null). Shown behind the buddy. */
  async equipped(userId: string): Promise<BuddyBackground | null> {
    const row = await this.owned.findOne({
      where: { userId, equipped: true },
      relations: { background: true },
    });
    return row?.background ?? null;
  }

  /** Buy a background with Sparks. Validates availability, ownership, premium
   *  and balance, then deducts + records ownership in one transaction. */
  async buy(
    userId: string,
    backgroundId: string,
  ): Promise<{ owned: true; equipped: boolean; sparksSpent: number }> {
    const bg = await this.backgrounds.findOne({ where: { id: backgroundId } });
    if (!bg) throw new NotFoundException('Background олдсонгүй');
    if (!this.inSeason(bg))
      throw new BadRequestException(
        'Энэ background одоо худалдаанд байхгүй байна',
      );

    const existing = await this.owned.findOne({
      where: { userId, backgroundId },
    });
    if (existing) throw new BadRequestException('Аль хэдийн эзэмшсэн байна');

    if (bg.isPremium && !(await this.isPremiumUser(userId))) {
      throw new ForbiddenException('Premium background — багц шаардлагатай');
    }

    if (bg.priceSparks > 0) {
      const user = await this.users.findOne({
        where: { id: userId },
        select: { id: true, sparks: true },
      });
      if ((user?.sparks ?? 0) < bg.priceSparks)
        throw new BadRequestException('Sparks хүрэлцэхгүй байна');
    }

    // One transaction: record ownership FIRST (the unique constraint makes a
    // concurrent double-buy fail here → the whole tx rolls back, so Sparks are
    // never deducted without granting the item), then deduct Sparks through the
    // shared ledger on the same manager so both commit together.
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.insert(UserBuddyBackground, {
          userId,
          backgroundId,
          equipped: false,
        });
        if (bg.priceSparks > 0) {
          await this.sparks.change(
            {
              userId,
              amount: -bg.priceSparks,
              source: SparksSource.STORE_PURCHASE,
              metadata: { item: 'buddy_background', backgroundId },
            },
            manager,
          );
        }
      });
    } catch (e) {
      // Lost the race — another request already registered ownership.
      if ((e as { code?: string })?.code === '23505') {
        throw new BadRequestException('Аль хэдийн эзэмшсэн байна');
      }
      throw e;
    }

    return { owned: true, equipped: false, sparksSpent: bg.priceSparks };
  }

  /** Equip an owned background (unequips the others — one at a time). */
  async equip(
    userId: string,
    backgroundId: string,
  ): Promise<{ equipped: string }> {
    const own = await this.owned.findOne({ where: { userId, backgroundId } });
    if (!own) throw new BadRequestException('Эзэмшээгүй background');

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        UserBuddyBackground,
        { userId, equipped: true },
        { equipped: false },
      );
      await manager.update(
        UserBuddyBackground,
        { userId, backgroundId },
        { equipped: true },
      );
    });
    return { equipped: backgroundId };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  findAll(): Promise<BuddyBackground[]> {
    return this.backgrounds.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  create(dto: CreateBackgroundDto): Promise<BuddyBackground> {
    return this.backgrounds.save(
      this.backgrounds.create({
        name: dto.name,
        imageUrl: dto.imageUrl,
        priceSparks: dto.priceSparks ?? 0,
        isPremium: dto.isPremium ?? false,
        seasonalStart: dto.seasonalStart ? new Date(dto.seasonalStart) : null,
        seasonalEnd: dto.seasonalEnd ? new Date(dto.seasonalEnd) : null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async update(id: string, dto: UpdateBackgroundDto): Promise<BuddyBackground> {
    const bg = await this.backgrounds.findOne({ where: { id } });
    if (!bg) throw new NotFoundException('Background олдсонгүй');
    if (dto.name !== undefined) bg.name = dto.name;
    if (dto.imageUrl !== undefined) bg.imageUrl = dto.imageUrl;
    if (dto.priceSparks !== undefined) bg.priceSparks = dto.priceSparks;
    if (dto.isPremium !== undefined) bg.isPremium = dto.isPremium;
    if (dto.seasonalStart !== undefined)
      bg.seasonalStart = dto.seasonalStart ? new Date(dto.seasonalStart) : null;
    if (dto.seasonalEnd !== undefined)
      bg.seasonalEnd = dto.seasonalEnd ? new Date(dto.seasonalEnd) : null;
    if (dto.isActive !== undefined) bg.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) bg.sortOrder = dto.sortOrder;
    return this.backgrounds.save(bg);
  }

  async remove(id: string): Promise<void> {
    const bg = await this.backgrounds.findOne({ where: { id } });
    if (!bg) throw new NotFoundException('Background олдсонгүй');
    await this.backgrounds.remove(bg);
  }
}
