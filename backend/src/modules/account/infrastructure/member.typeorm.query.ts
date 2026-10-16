import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Paged, PageRequest } from '../../../common/domain/pagination.js';
import {
  MemberFilter,
  MemberQuery,
  MemberRole,
  MemberRow,
} from '../application/member.query.js';

interface RawRow {
  id: string;
  role: MemberRole;
  name: string;
  email: string;
  phone: string;
  joined_at: Date;
  use_count: string;
  last_used_at: Date | null;
  active_deliveries: string;
}

// 사장님은 가게가 요청한 배달, 라이더는 자기가 맡은 배달, 손님은 주문앱에서 결제한 주문을 본다.
const MEMBER_COLUMNS = `
  u.id, u.role, u.name, u.email, u.phone, u.created_at AS joined_at,
  CASE u.role
    WHEN 'DRIVER' THEN (SELECT COUNT(*) FROM orders o WHERE o.driver_id = d.id AND o.status = 'DELIVERED')
    WHEN 'CONSUMER' THEN (SELECT COUNT(*) FROM food_orders f WHERE f.consumer_user_id = u.id AND f.paid_at IS NOT NULL)
    ELSE (SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id AND o.status <> 'CANCELLED')
  END AS use_count,
  CASE u.role
    WHEN 'DRIVER' THEN (SELECT MAX(o.delivered_at) FROM orders o WHERE o.driver_id = d.id)
    WHEN 'CONSUMER' THEN (SELECT MAX(f.paid_at) FROM food_orders f WHERE f.consumer_user_id = u.id)
    ELSE (SELECT MAX(o.requested_at) FROM orders o WHERE o.customer_id = u.id)
  END AS last_used_at,
  CASE u.role
    WHEN 'DRIVER' THEN (SELECT COUNT(*) FROM orders o WHERE o.driver_id = d.id AND o.status IN ('ASSIGNED', 'DEPARTED', 'ARRIVED', 'PICKED_UP'))
    WHEN 'CONSUMER' THEN (SELECT COUNT(*) FROM food_orders f WHERE f.consumer_user_id = u.id AND f.status IN ('PLACED', 'ACCEPTED', 'PICKED_UP'))
    ELSE (SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id AND o.status IN ('REQUESTED', 'ASSIGNED', 'DEPARTED', 'ARRIVED', 'PICKED_UP'))
  END AS active_deliveries
`;
const MEMBER_SOURCE = `
  FROM users u
  LEFT JOIN drivers d ON d.user_id = u.id
  WHERE u.status <> 'WITHDRAWN'
`;
const SUSPENDED_NOW = `(u.status = 'SUSPENDED' AND (u.suspended_until IS NULL OR u.suspended_until > $NOW))`;

/** 회원 조회 TypeORM 구현체. */
@Injectable()
export class MemberTypeormQuery implements MemberQuery {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async find(
    filter: MemberFilter,
    page: PageRequest,
    now: Date,
  ): Promise<Paged<MemberRow>> {
    const params: unknown[] = [filter.role];
    const bind = (value: unknown) => `$${params.push(value)}`;
    let where = ` AND u.role = $1`;
    if (filter.suspended !== undefined) {
      const suspendedNow = SUSPENDED_NOW.replace('$NOW', bind(now));
      where += filter.suspended
        ? ` AND ${suspendedNow}`
        : ` AND NOT ${suspendedNow}`;
    }
    const keyword = filter.q?.trim();
    if (keyword) {
      const like = bind(contains(keyword));
      // 휴대폰 번호는 숫자만 저장한다 — 검색어의 하이픈과 공백을 뺀다.
      const digits = bind(contains(keyword.replace(/[-\s]/g, '')));
      where += ` AND (u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.phone LIKE ${digits})`;
    }
    const [{ count }] = await this.dataSource.query<[{ count: string }]>(
      `SELECT COUNT(*) AS count ${MEMBER_SOURCE} ${where}`,
      params,
    );
    const rows = await this.dataSource.query<RawRow[]>(
      `SELECT ${MEMBER_COLUMNS} ${MEMBER_SOURCE} ${where}
       ORDER BY u.created_at DESC, u.id ASC
       LIMIT ${bind(page.limit)} OFFSET ${bind(page.offset)}`,
      params,
    );
    return { items: rows.map(toRow), total: Number(count) };
  }

  async findOne(userId: string): Promise<MemberRow | null> {
    const rows = await this.dataSource.query<RawRow[]>(
      `SELECT ${MEMBER_COLUMNS} ${MEMBER_SOURCE}
         AND u.id = $1 AND u.role IN ('CUSTOMER', 'DRIVER', 'CONSUMER')`,
      [userId],
    );
    return rows[0] ? toRow(rows[0]) : null;
  }

  async countByRole(): Promise<Record<MemberRole, number>> {
    const rows = await this.dataSource.query<
      { role: MemberRole; count: string }[]
    >(
      `SELECT u.role, COUNT(*) AS count FROM users u
       WHERE u.status <> 'WITHDRAWN' AND u.role IN ('CUSTOMER', 'DRIVER', 'CONSUMER')
       GROUP BY u.role`,
    );
    const counts = { CUSTOMER: 0, DRIVER: 0, CONSUMER: 0 };
    for (const row of rows) {
      counts[row.role] = Number(row.count);
    }
    return counts;
  }
}

function toRow(row: RawRow): MemberRow {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    phone: row.phone,
    joinedAt: row.joined_at,
    useCount: Number(row.use_count),
    lastUsedAt: row.last_used_at,
    activeDeliveries: Number(row.active_deliveries),
  };
}

/** LIKE 패턴으로 쓸 수 있게 %, _, \ 를 글자 그대로 찾도록 바꾼다. */
function contains(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}
