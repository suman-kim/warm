import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { persistAggregate } from '../../../../common/infrastructure/persistence/persist-aggregate.js';
import { User } from '../../domain/entities/user.entity.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserOrmEntity } from '../entities/user.orm-entity.js';
import { UserMapper } from '../mappers/user.mapper.js';

/** 회원 저장소 TypeORM 구현체. */
@Injectable()
export class UserTypeormRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
  ) {}

  async save(user: User): Promise<void> {
    await persistAggregate(this.repository, user, UserMapper.toOrm(user));
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.repository.find({ where: { id: In(ids) } });
    return rows.map((row) => UserMapper.toDomain(row));
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repository.findOne({ where: { email } });
    return row ? UserMapper.toDomain(row) : null;
  }
}
