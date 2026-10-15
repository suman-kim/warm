import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

/**
 * 앱 런타임의 TypeORM 설정.
 * 스키마는 마이그레이션으로만 바꾼다(synchronize 끔) — CLI 설정은 src/database/data-source.ts.
 */
export const typeOrmModuleOptions: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_DATABASE'),
    ssl: config.get<string>('DB_SSL') === 'true',
    // 각 모듈이 TypeOrmModule.forFeature로 등록한 ORM 엔티티를 모은다.
    autoLoadEntities: true,
    synchronize: false,
  }),
};
