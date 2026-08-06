import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';

/**
 * Home events (Daily · Weekly challenge · Double XP).
 *
 * Admin authors them; students read only what is live. "Live" = `isActive` AND
 * `startsAt <= now <= endsAt`. The `double_xp` multiplier is applied in
 * `XpService.award` (this service only stores/serves the schedule).
 */
@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
  ) {}

  /** Events live right now, soonest-ending first (so the UI can prioritise). */
  activeNow(): Promise<Event[]> {
    const now = new Date();
    return this.events
      .createQueryBuilder('e')
      .where('e.is_active = true')
      .andWhere('e.starts_at <= :now', { now })
      .andWhere('e.ends_at >= :now', { now })
      .orderBy('e.ends_at', 'ASC')
      .getMany();
  }

  /** Admin: every event, newest first. */
  findAll(): Promise<Event[]> {
    return this.events.find({ order: { startsAt: 'DESC' } });
  }

  async create(dto: CreateEventDto): Promise<Event> {
    const event = this.events.create({
      type: dto.type,
      title: dto.title,
      description: dto.description ?? null,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      rewardXp: dto.rewardXp ?? null,
      xpMultiplier: dto.xpMultiplier != null ? String(dto.xpMultiplier) : null,
      isActive: dto.isActive ?? true,
    });
    return this.events.save(event);
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.events.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event олдсонгүй');
    if (dto.type !== undefined) event.type = dto.type;
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.startsAt !== undefined) event.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) event.endsAt = new Date(dto.endsAt);
    if (dto.rewardXp !== undefined) event.rewardXp = dto.rewardXp;
    if (dto.xpMultiplier !== undefined) event.xpMultiplier = String(dto.xpMultiplier);
    if (dto.isActive !== undefined) event.isActive = dto.isActive;
    return this.events.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.events.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event олдсонгүй');
    await this.events.remove(event);
  }
}
