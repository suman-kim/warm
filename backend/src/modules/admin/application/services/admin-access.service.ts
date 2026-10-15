import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError } from '../../../../common/domain/domain-error.js';
import { AdminArea } from '../../domain/admin-role.js';
import { AdminAccount } from '../../domain/entities/admin-account.entity.js';
import {
  ADMIN_ACCOUNT_REPOSITORY,
  type AdminAccountRepository,
} from '../../domain/repositories/admin-account.repository.js';

/** 운영자가 지금 이 일을 할 수 있는지 확인한다. 운영자 API를 부를 때마다 가드가 쓴다. */
@Injectable()
export class AdminAccessService {
  constructor(
    @Inject(ADMIN_ACCOUNT_REPOSITORY)
    private readonly accountRepository: AdminAccountRepository,
  ) {}

  /**
   * 활성 상태인 운영자인지, [area]를 주면 그 영역의 권한이 있는지 확인한다.
   * 요청마다 현재 값을 읽으므로 비활성화나 권한 변경이 바로 적용된다.
   */
  async authorize(
    userId: string,
    area: AdminArea | null,
  ): Promise<AdminAccount> {
    const account = await this.accountRepository.findById(userId);
    if (!account?.isActive) {
      throw new ForbiddenError(
        'ADMIN_INACTIVE',
        '비활성화된 계정이에요. 최고 관리자에게 문의해 주세요.',
      );
    }
    if (area && !account.can(area)) {
      throw new ForbiddenError(
        'ADMIN_AREA_NOT_PERMITTED',
        '이 메뉴를 쓸 권한이 없어요.',
      );
    }
    return account;
  }
}
