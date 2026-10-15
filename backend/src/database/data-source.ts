import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

// TypeORM CLI(마이그레이션 생성·실행·되돌리기) 전용 DataSource.
// 컴파일된 dist에서 돈다(package.json의 typeorm 스크립트가 먼저 빌드한다) —
// 그래서 엔티티와 마이그레이션을 .js로 찾는다.
// 앱과 같은 규칙으로 .env.<APP_ENV>를 읽고, 없는 값은 .env에서 채운다.
loadEnv({ path: `.env.${process.env.APP_ENV ?? 'local'}`, quiet: true });
loadEnv({ quiet: true });

const SRC = join(import.meta.dirname, '..');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: process.env.DB_SSL === 'true',
  entities: [join(SRC, 'modules/**/infrastructure/entities/*.orm-entity.js')],
  migrations: [join(SRC, 'database/migrations/*.js')],
  synchronize: false,
});
