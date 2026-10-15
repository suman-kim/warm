import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 공지사항 ORM 엔티티. */
@Entity({ name: 'notices', comment: '공지사항' })
@Index('idx_notices_audience_published', ['audience', 'publishedAt'])
export class NoticeOrmEntity {
  @PrimaryColumn('uuid', { comment: '공지 ID' })
  id: string;

  @Column('varchar', { length: 100, comment: '제목' })
  title: string;

  @Column('text', { comment: '본문' })
  body: string;

  @Column('varchar', { length: 20, comment: 'ALL | CUSTOMER | DRIVER' })
  audience: string;

  @Column('timestamptz', { name: 'published_at', comment: '게시한 시각' })
  publishedAt: Date;

  @Column('uuid', {
    name: 'author_id',
    nullable: true,
    comment: '올린 운영자 (users.id)',
  })
  authorId: string | null;

  @Column('timestamptz', {
    name: 'removed_at',
    nullable: true,
    comment: '내린 시각. 게시 중이면 NULL',
  })
  removedAt: Date | null;
}
