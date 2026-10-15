import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/presentation/decorators/public.decorator.js';

/** 헬스 체크 컨트롤러. `/health` 경로. 로드밸런서·모니터링이 부른다. */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /** 서버와 DB 연결이 살아 있으면 200 */
  @Get()
  async check(): Promise<{ status: 'ok' }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
