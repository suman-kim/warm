import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import {
  NotificationPageResult,
  NotificationSettingResult,
  UnreadCountResult,
} from '../../application/dto/notification.result.js';
import { NotificationInboxUseCase } from '../../application/use-cases/notification-inbox.use-case.js';
import { UpdateNotificationSettingRequest } from '../dto/notification-setting.request.js';

/** 알림함 컨트롤러. `/notifications` 경로. 고객 앱과 기사 앱이 함께 쓴다. */
@ApiTags('push')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly inboxUseCase: NotificationInboxUseCase) {}

  /** 받은 알림 목록 (최근 것부터). 안 읽은 수를 함께 준다. */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryRequest,
  ): Promise<NotificationPageResult> {
    return this.inboxUseCase.list(user.id, query);
  }

  /** 안 읽은 알림 수. 홈의 알림 배지에 쓴다. */
  @Get('unread-count')
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountResult> {
    return this.inboxUseCase.unreadCount(user.id);
  }

  /** 알림 설정 */
  @Get('settings')
  setting(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationSettingResult> {
    return this.inboxUseCase.setting(user.id);
  }

  /** 알림 설정 변경 (고객 앱의 배송 알림, 기사 앱의 콜 알림) */
  @Patch('settings')
  updateSetting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateNotificationSettingRequest,
  ): Promise<NotificationSettingResult> {
    return this.inboxUseCase.updateSetting(user.id, body.pushEnabled);
  }

  /** 모두 읽음으로 표시 */
  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.inboxUseCase.markAllRead(user.id);
  }

  /** 알림 하나를 읽음으로 표시 */
  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.inboxUseCase.markRead(user.id, id);
  }
}
