import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/domain/domain-error.js';
import { PhoneNumber } from '../../../../common/domain/phone-number.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/repositories/user.repository.js';
import { toUserResult, UserResult } from '../dto/user.result.js';

export interface UpdateProfileCommand {
  name?: string;
  phone?: string;
  marketingAgreed?: boolean;
}

/** 내 정보 수정 유스케이스. 보낸 항목만 바꾼다. */
@Injectable()
export class UpdateMyProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    userId: string,
    command: UpdateProfileCommand,
  ): Promise<UserResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', '회원을 찾을 수 없어요.');
    }
    user.updateProfile(
      {
        name: command.name,
        phone:
          command.phone === undefined
            ? undefined
            : PhoneNumber.of(command.phone),
        marketingAgreed: command.marketingAgreed,
      },
      new Date(),
    );
    await this.userRepository.save(user);
    return toUserResult(user);
  }
}
