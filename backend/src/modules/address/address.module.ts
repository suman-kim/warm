import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressSearchUseCase } from './application/address-search.use-case.js';
import {
  ADDRESS_SEARCH,
  AddressSearch,
} from './application/ports/address-search.port.js';
import { KakaoLocalAddressSearch } from './infrastructure/search/kakao-local.address-search.js';
import { SampleAddressSearch } from './infrastructure/search/sample.address-search.js';
import { AddressSearchController } from './presentation/address-search.controller.js';

/** 주소 모듈. 가게 주소와 손님 주소를 찾는 주소 검색을 다룬다. */
@Module({
  controllers: [AddressSearchController],
  providers: [
    AddressSearchUseCase,
    {
      provide: ADDRESS_SEARCH,
      inject: [ConfigService],
      // 카카오 REST API 키가 있으면 카카오 로컬 API로, 없으면 견본 주소에서 찾는다.
      // 운영에서 키가 없으면 실제 주소를 찾을 수 없으므로 부팅을 막는다.
      useFactory: (config: ConfigService): AddressSearch => {
        const key = config.get<string>('KAKAO_REST_API_KEY');
        if (key) return new KakaoLocalAddressSearch(key);
        if (config.get<string>('NODE_ENV') === 'production') {
          throw new Error(
            'KAKAO_REST_API_KEY가 없어요. 운영에서는 실제 주소 검색이 필요해요.',
          );
        }
        return new SampleAddressSearch();
      },
    },
  ],
})
export class AddressModule {}
