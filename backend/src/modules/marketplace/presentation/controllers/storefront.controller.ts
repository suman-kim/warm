import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PageQueryRequest } from '../../../../common/presentation/dto/page-query.request.js';
import { Public } from '../../../auth/presentation/decorators/public.decorator.js';
import {
  FoodOrderQuoteResult,
  Page,
  ReviewResult,
  StorefrontCardResult,
  StorefrontDetailResult,
} from '../../application/dto/marketplace.result.js';
import { BrowseStorefrontsUseCase } from '../../application/use-cases/browse-storefronts.use-case.js';
import { CheckoutUseCase } from '../../application/use-cases/checkout.use-case.js';
import {
  ListStorefrontsRequest,
  QuoteRequest,
  StorefrontDetailRequest,
} from '../dto/marketplace.request.js';

/** 손님 앱(따끈)의 가게 찾기. `/storefronts` 경로. 로그인 없이 볼 수 있다. */
@ApiTags('storefronts')
@Public()
@Controller('storefronts')
export class StorefrontController {
  constructor(
    private readonly browse: BrowseStorefrontsUseCase,
    private readonly checkout: CheckoutUseCase,
  ) {}

  /** 배달 받을 위치 근처의 가게. 지금 주문받는 가게가 먼저다. */
  @Get()
  list(
    @Query() query: ListStorefrontsRequest,
  ): Promise<Page<StorefrontCardResult>> {
    return this.browse.list(
      {
        latitude: query.latitude,
        longitude: query.longitude,
        category: query.category,
        q: query.q,
        sort: query.sort,
        openOnly: query.openOnly,
        maxMinOrder: query.maxMinOrder,
      },
      query,
    );
  }

  /** 가게 상세와 메뉴. 위치를 주면 그 주소의 배달 가능 여부와 배달팁을 붙인다. */
  @Get(':storeId')
  detail(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: StorefrontDetailRequest,
  ): Promise<StorefrontDetailResult> {
    return this.browse.detail(
      storeId,
      query.latitude !== undefined && query.longitude !== undefined
        ? { latitude: query.latitude, longitude: query.longitude }
        : null,
    );
  }

  /** 가게 리뷰 (최근 것부터) */
  @Get(':storeId/reviews')
  reviews(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: PageQueryRequest,
  ): Promise<Page<ReviewResult>> {
    return this.browse.reviews(storeId, query);
  }

  /** 가게 대표 사진·메뉴 사진 */
  @Get(':storeId/images/:file')
  async image(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('file') file: string,
  ): Promise<StreamableFile> {
    const image = await this.browse.image(storeId, file);
    return new StreamableFile(image.bytes, { type: image.contentType });
  }

  /** 장바구니 금액 확인 (메뉴 금액·배달팁·최소주문·배달 가능). 주문하기 전에 부른다. */
  @Post(':storeId/quote')
  @HttpCode(HttpStatus.OK)
  quote(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() body: QuoteRequest,
  ): Promise<FoodOrderQuoteResult> {
    return this.checkout.quote({
      storeId,
      lines: body.lines,
      dropoff: body.dropoff,
    });
  }
}
