import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  VEHICLE_SPECS,
  VehicleType,
} from '../../../../common/domain/vehicle-type.js';
import { Public } from '../../../auth/presentation/decorators/public.decorator.js';
import { VehicleTypeResult } from '../../application/dto/order.result.js';

/** 차종 안내 컨트롤러. `/vehicle-types` 경로. 로그인 없이 부른다. */
@ApiTags('orders')
@Public()
@Controller('vehicle-types')
export class VehicleTypeController {
  /** 요청할 수 있는 차종 목록 */
  @Get()
  list(): VehicleTypeResult[] {
    return Object.values(VehicleType).map((type) => ({
      type,
      ...VEHICLE_SPECS[type],
    }));
  }
}
