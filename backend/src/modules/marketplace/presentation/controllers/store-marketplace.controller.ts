import {
  BadRequestException,
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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import {
  FoodOrderDetailResult,
  FoodOrderSummaryResult,
  MenuCategoryResult,
  MenuItemResult,
  MyStorefrontResult,
  Page,
  StorePayoutResult,
  StoreSettlementAccountResult,
  StoreSettlementEntryResult,
  StoreSettlementSummaryResult,
} from '../../application/dto/marketplace.result.js';
import { MAX_IMAGE_BYTES } from '../../application/services/marketplace-images.js';
import { MyMenuUseCase } from '../../application/use-cases/my-menu.use-case.js';
import { MyStorefrontUseCase } from '../../application/use-cases/my-storefront.use-case.js';
import {
  StoreFoodOrdersUseCase,
  StoreFoodOrderTab,
} from '../../application/use-cases/store-food-orders.use-case.js';
import { StoreSettlementsUseCase } from '../../application/use-cases/store-settlements.use-case.js';
import { MenuItemDetails } from '../../domain/entities/menu.entity.js';
import {
  AcceptFoodOrderRequest,
  FoodOrderReasonRequest,
  MenuCategoryRequest,
  MenuItemRequest,
  RejectFoodOrderRequest,
  SettlementEntriesRequest,
  SoldOutRequest,
  StoreFoodOrderListRequest,
  StorefrontOpenRequest,
  StorefrontPauseRequest,
  StorefrontSettingsRequest,
  StoreSettlementAccountRequest,
  UpdateMenuCategoryRequest,
} from '../dto/marketplace.request.js';

const IMAGE_BODY = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

function requireFile(file: Express.Multer.File | undefined): Buffer {
  if (!file) throw new BadRequestException('file is required');
  return file.buffer;
}

function menuDetails(body: MenuItemRequest): MenuItemDetails {
  return {
    categoryId: body.categoryId,
    name: body.name,
    description: body.description ?? null,
    price: body.price,
    sortOrder: body.sortOrder ?? 0,
    hidden: body.hidden ?? false,
    optionGroups: (body.optionGroups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: (group.options ?? []).map((option) => ({ ...option })),
    })),
  };
}

/** 사장님의 주문앱 가게 운영 설정. `/stores/me/storefront` 경로. */
@ApiTags('stores')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('stores/me/storefront')
export class MyStorefrontController {
  constructor(private readonly storefront: MyStorefrontUseCase) {}

  /** 운영 설정과 지금 주문을 받는지 (처음 열면 기본 설정) */
  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MyStorefrontResult> {
    return this.storefront.get(user.id);
  }

  /** 영업시간·휴무·최소주문·배달팁·배달 거리·소개·원산지 */
  @Put()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StorefrontSettingsRequest,
  ): Promise<MyStorefrontResult> {
    return this.storefront.updateSettings(user.id, {
      ...body,
      description: body.description ?? null,
      originNotice: body.originNotice ?? null,
      distanceTipRules: body.distanceTipRules ?? [],
      holidays: body.holidays ?? [],
    });
  }

  /** 대표 사진 (JPG·PNG·WEBP, 5MB까지) */
  @Put('logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMAGE_BODY)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  uploadLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MyStorefrontResult> {
    return this.storefront.uploadLogo(user.id, requireFile(file));
  }

  /** 주문 받기 켜기·끄기 (켜려면 승인된 가게, 보이는 메뉴 1개 이상) */
  @Put('open')
  setOpen(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StorefrontOpenRequest,
  ): Promise<MyStorefrontResult> {
    return this.storefront.setOpen(user.id, body.open);
  }

  /** 임시 휴업 (minutes를 비우면 끝낸다) */
  @Put('pause')
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StorefrontPauseRequest,
  ): Promise<MyStorefrontResult> {
    return this.storefront.pause(user.id, body.minutes ?? null);
  }
}

/** 사장님의 메뉴 관리. `/stores/me/menu` 경로. */
@ApiTags('stores')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('stores/me/menu')
export class MyMenuController {
  constructor(private readonly menu: MyMenuUseCase) {}

  /** 카테고리별 메뉴 (숨긴 메뉴 포함) */
  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MenuCategoryResult[]> {
    return this.menu.get(user.id);
  }

  @Post('categories')
  createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MenuCategoryRequest,
  ): Promise<MenuCategoryResult[]> {
    return this.menu.createCategory(user.id, body.name);
  }

  @Put('categories/:id')
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMenuCategoryRequest,
  ): Promise<MenuCategoryResult[]> {
    return this.menu.updateCategory(user.id, id, body);
  }

  /** 빈 카테고리만 지울 수 있다 */
  @Delete('categories/:id')
  deleteCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MenuCategoryResult[]> {
    return this.menu.deleteCategory(user.id, id);
  }

  @Post('items')
  createItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MenuItemRequest,
  ): Promise<MenuItemResult> {
    return this.menu.createItem(user.id, menuDetails(body));
  }

  /** 메뉴·옵션 수정. 기존 옵션은 ID를 보내야 품절 상태와 손님 장바구니가 이어진다. */
  @Put('items/:id')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MenuItemRequest,
  ): Promise<MenuItemResult> {
    return this.menu.updateItem(user.id, id, menuDetails(body));
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.menu.deleteItem(user.id, id);
  }

  /** 품절 켜기·끄기 */
  @Put('items/:id/sold-out')
  setSoldOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SoldOutRequest,
  ): Promise<MenuItemResult> {
    return this.menu.setSoldOut(user.id, id, body.soldOut);
  }

  /** 메뉴 사진 (JPG·PNG·WEBP, 5MB까지) */
  @Put('items/:id/photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody(IMAGE_BODY)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MenuItemResult> {
    return this.menu.uploadPhoto(user.id, id, requireFile(file));
  }
}

/** 사장님의 주문 접수. `/stores/me/food-orders` 경로. */
@ApiTags('stores')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('stores/me/food-orders')
export class StoreFoodOrderController {
  constructor(private readonly orders: StoreFoodOrdersUseCase) {}

  /** 탭별 주문 (NEW는 먼저 온 주문이 위). counts는 탭마다의 주문 수. */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StoreFoodOrderListRequest,
  ): Promise<
    Page<FoodOrderSummaryResult> & { counts: Record<StoreFoodOrderTab, number> }
  > {
    return this.orders.list(
      user.id,
      { tab: query.tab, date: query.date },
      query,
    );
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.detail(user.id, id);
  }

  /** 접수. 조리 시간에 맞춰 라이더 배달이 자동으로 요청된다. */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AcceptFoodOrderRequest,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.accept(user.id, id, body.cookMinutes);
  }

  /** 거절. 손님에게 모두 돌려준다. */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectFoodOrderRequest,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.reject(user.id, id, body.reason);
  }

  /** 받은 주문 취소 (라이더 픽업 전). 라이더가 출발했으면 배달 취소 수수료를 정산에서 뺀다. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FoodOrderReasonRequest,
  ): Promise<FoodOrderDetailResult> {
    return this.orders.cancel(user.id, id, body.reason);
  }
}

/** 사장님의 주문앱 매출·정산. `/stores/me/settlements` 경로. */
@ApiTags('stores')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('stores/me')
export class StoreSettlementController {
  constructor(private readonly settlements: StoreSettlementsUseCase) {}

  /** 지급 예정 정산과 지금의 정산 방식·수수료율 */
  @Get('settlements')
  summary(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StoreSettlementSummaryResult> {
    return this.settlements.summary(user.id);
  }

  /** 주문별 정산 내역 (최근 것부터) */
  @Get('settlements/entries')
  entries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SettlementEntriesRequest,
  ): Promise<Page<StoreSettlementEntryResult>> {
    return this.settlements.entries(
      user.id,
      { from: query.from, to: query.to },
      query,
    );
  }

  /** 받은 정산금 */
  @Get('settlements/payouts')
  payouts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryRequest,
  ): Promise<Page<StorePayoutResult>> {
    return this.settlements.payouts(user.id, query);
  }

  /** 정산 계좌. 없으면 null. */
  @Get('settlement-account')
  account(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StoreSettlementAccountResult | null> {
    return this.settlements.account(user.id);
  }

  /** 정산 계좌 등록·변경 (바꾸면 운영자가 다시 확인한다) */
  @Put('settlement-account')
  saveAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StoreSettlementAccountRequest,
  ): Promise<StoreSettlementAccountResult> {
    return this.settlements.saveAccount(user.id, body);
  }
}
