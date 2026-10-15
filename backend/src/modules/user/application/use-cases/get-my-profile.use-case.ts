import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/repositories/user.repository.js';
import { toUserResult, UserResult } from '../dto/user.result.js';

/** 내 정보 조회 유스케이스. */
@Injectable()
export class GetMyProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string): Promise<UserResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', '회원을 찾을 수 없어요.');
    }
    return toUserResult(user);
  }
}
