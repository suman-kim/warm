import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddressSearchUseCase } from '../application/address-search.use-case.js';
import { FoundAddressResult } from '../application/ports/address-search.port.js';
import { AddressSearchQuery } from './address-search.request.js';

/** 주소 검색 컨트롤러. `/address-search` 경로. */
@ApiTags('addresses')
@ApiBearerAuth()
@Controller('address-search')
export class AddressSearchController {
  constructor(private readonly addressSearchUseCase: AddressSearchUseCase) {}

  /** 주소·장소 검색. 주소로 찾은 것이 앞에 오고, 15곳까지 온다. */
  @Get()
  search(@Query() query: AddressSearchQuery): Promise<FoundAddressResult[]> {
    return this.addressSearchUseCase.search(query.query);
  }
}
