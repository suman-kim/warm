import { Inject, Injectable } from '@nestjs/common';
import {
  ADDRESS_SEARCH,
  type AddressSearch,
  FoundAddressResult,
} from './ports/address-search.port.js';

/** 주소 검색. 바깥 API 키는 서버에만 두고, 앱은 이 유스케이스를 거쳐 찾는다. */
@Injectable()
export class AddressSearchUseCase {
  constructor(
    @Inject(ADDRESS_SEARCH) private readonly addressSearch: AddressSearch,
  ) {}

  async search(query: string): Promise<FoundAddressResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return this.addressSearch.search(trimmed);
  }
}
