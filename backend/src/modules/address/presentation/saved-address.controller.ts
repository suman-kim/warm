import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../common/application/authenticated-user.js';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator.js';
import { SavedAddressResult } from '../application/saved-address.result.js';
import { SavedAddressesUseCase } from '../application/saved-addresses.use-case.js';
import { SavedAddressRequest } from './saved-address.request.js';

/** 자주 쓰는 주소 컨트롤러. `/saved-addresses` 경로. */
@ApiTags('addresses')
@ApiBearerAuth()
@Controller('saved-addresses')
export class SavedAddressController {
  constructor(private readonly savedAddressesUseCase: SavedAddressesUseCase) {}

  /** 내가 저장한 주소 목록 */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<SavedAddressResult[]> {
    return this.savedAddressesUseCase.list(user.id);
  }

  /** 주소 저장 (20곳까지) */
  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SavedAddressRequest,
  ): Promise<SavedAddressResult> {
    return this.savedAddressesUseCase.add(user.id, body);
  }

  /** 저장한 주소 수정 (내용을 통째로 바꾼다) */
  @Put(':id')
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SavedAddressRequest,
  ): Promise<SavedAddressResult> {
    return this.savedAddressesUseCase.replace(user.id, id, body);
  }

  /** 저장한 주소 삭제 */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.savedAddressesUseCase.remove(user.id, id);
  }
}
