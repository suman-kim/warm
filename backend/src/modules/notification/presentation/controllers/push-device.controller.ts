import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { RegisterPushDeviceUseCase } from '../../application/use-cases/register-push-device.use-case.js';
import { UnregisterPushDeviceUseCase } from '../../application/use-cases/unregister-push-device.use-case.js';
import { RegisterPushDeviceRequest } from '../dto/register-push-device.request.js';

/** 푸시 기기 컨트롤러. `/push-devices` 경로. 고객 앱과 기사 앱이 함께 쓴다. */
@ApiTags('push')
@ApiBearerAuth()
@Controller('push-devices')
export class PushDeviceController {
  constructor(
    private readonly registerPushDeviceUseCase: RegisterPushDeviceUseCase,
    private readonly unregisterPushDeviceUseCase: UnregisterPushDeviceUseCase,
  ) {}

  /** 이 기기를 내 푸시 수신 기기로 등록. 로그인 직후와 토큰이 바뀔 때마다 부른다. */
  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterPushDeviceRequest,
  ): Promise<void> {
    return this.registerPushDeviceUseCase.execute(
      user.id,
      body.token,
      body.platform,
    );
  }

  /** 이 기기의 푸시 수신 해제. 로그아웃하기 전에 부른다. */
  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ): Promise<void> {
    return this.unregisterPushDeviceUseCase.execute(user.id, token);
  }
}
