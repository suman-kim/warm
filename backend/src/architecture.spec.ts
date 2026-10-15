import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// 계층 의존 규칙을 지키는지 import 문을 읽어 검사한다.
//
//   presentation ─┐
//                 ├─▶ application ─▶ domain
//   infrastructure┘
//
// 안쪽 계층은 바깥 계층과 프레임워크를 모른다. 규칙을 어기는 import를 추가하면 이 테스트가 깨진다.

const SRC = import.meta.dirname;
type Layer = 'domain' | 'application' | 'infrastructure' | 'presentation';

const RULES: Record<
  Layer,
  { layers: Layer[]; packages: (name: string) => boolean }
> = {
  // 도메인은 순수 TypeScript다.
  domain: {
    layers: ['domain'],
    packages: (name) => name.startsWith('node:'),
  },
  // 애플리케이션은 DI 데코레이터(@Injectable, @Inject)만 프레임워크에서 빌린다.
  application: {
    layers: ['domain', 'application'],
    packages: (name) => name.startsWith('node:') || name === '@nestjs/common',
  },
  infrastructure: {
    layers: ['domain', 'application', 'infrastructure'],
    packages: () => true,
  },
  // 프레젠테이션은 유스케이스를 부른다. 저장소 구현이나 ORM을 직접 쓰지 않는다.
  presentation: {
    layers: ['domain', 'application', 'presentation'],
    packages: (name) => name !== 'typeorm' && name !== '@nestjs/typeorm',
  },
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /(?<!\.spec)\.ts$/.test(entry.name) ? [path] : [];
  });
}

function layerOf(path: string): Layer | null {
  const match =
    /(?:^|\/)(domain|application|infrastructure|presentation)\//.exec(
      relative(SRC, path),
    );
  return match ? (match[1] as Layer) : null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/\bfrom\s+'([^']+)'/g)].map((match) => match[1]);
}

describe('계층 의존 규칙', () => {
  const violations = sourceFiles(SRC).flatMap((file) => {
    const layer = layerOf(file);
    if (!layer) return [];
    const rule = RULES[layer];
    return importsOf(file)
      .filter((specifier) => {
        if (!specifier.startsWith('.')) return !rule.packages(specifier);
        const target = layerOf(join(file, '..', specifier));
        return target !== null && !rule.layers.includes(target);
      })
      .map((specifier) => `${relative(SRC, file)} → ${specifier}`);
  });

  it('계층에 속한 파일을 찾았다', () => {
    const layered = sourceFiles(SRC).filter((file) => layerOf(file));
    expect(layered.length).toBeGreaterThan(50);
  });

  it('안쪽 계층이 바깥 계층이나 프레임워크를 import하지 않는다', () => {
    expect(violations).toEqual([]);
  });
});
