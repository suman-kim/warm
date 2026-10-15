import { globSync, readFileSync } from 'node:fs';
import { AppDataSource } from '../src/database/data-source.js';
import { createHarness, Harness } from './support/harness.js';

// 앱은 모듈이 등록한 엔티티를 쓰고(autoLoadEntities), 마이그레이션 CLI는 파일 이름 규칙으로
// 엔티티를 찾는다. 규칙에 맞지 않는 이름으로 엔티티를 만들면 그 테이블이 마이그레이션에서 빠지고,
// migration:check도 "바뀐 것 없음"이라고 답한다 — 서버를 띄워야 드러난다.
describe('마이그레이션이 보는 엔티티 (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  it('앱이 쓰는 테이블을 마이그레이션 CLI도 모두 찾는다', () => {
    const [pattern] = AppDataSource.options.entities as string[];
    const tablesSeenByCli = globSync(pattern.replace(/\.js$/, '.ts')).flatMap(
      (file) =>
        [
          ...readFileSync(file, 'utf8').matchAll(
            /@Entity\(\{\s*name: '(\w+)'/g,
          ),
        ].map((match) => match[1]),
    );
    const tablesUsedByApp = h.dataSource.entityMetadatas.map(
      (metadata) => metadata.tableName,
    );

    expect(tablesUsedByApp.length).toBeGreaterThan(10);
    expect(tablesSeenByCli.sort()).toEqual(tablesUsedByApp.sort());
  });

  // DB만 보고도 뜻을 알 수 있게 모든 테이블과 컬럼에 설명을 단다 — 엔티티의 comment 옵션.
  it('모든 테이블과 컬럼에 설명(comment)이 있다', () => {
    const missing = h.dataSource.entityMetadatas.flatMap((metadata) => [
      ...(metadata.comment ? [] : [metadata.tableName]),
      ...metadata.columns
        .filter((column) => !column.comment)
        .map((column) => `${metadata.tableName}.${column.databaseName}`),
    ]);
    expect(missing).toEqual([]);
  });
});
