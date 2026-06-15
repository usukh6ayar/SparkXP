import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryOrganizationsDto } from './dto/query-organizations.dto';

/** A page of organizations plus the total count, for the list endpoint. */
export interface PaginatedOrganizations {
  items: Organization[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  create(dto: CreateOrganizationDto): Promise<Organization> {
    const org = this.organizations.create(dto);
    return this.organizations.save(org);
  }

  /** List organizations with an optional type filter and pagination. */
  async findAll(query: QueryOrganizationsDto): Promise<PaginatedOrganizations> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {};
    if (query.type) where.type = query.type;

    const [items, total] = await this.organizations.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  /** Get one organization or throw 404. */
  async findOne(id: string): Promise<Organization> {
    const org = await this.organizations.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('Байгууллага олдсонгүй');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.findOne(id); // throws if missing
    Object.assign(org, dto);
    return this.organizations.save(org);
  }

  async remove(id: string): Promise<void> {
    const org = await this.findOne(id); // throws if missing
    await this.organizations.remove(org);
  }
}
