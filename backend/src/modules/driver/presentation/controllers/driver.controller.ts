import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../../common/application/authenticated-user.js';
import { UserRole } from '../../../../common/domain/user-role.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import {
  DriverDocumentResult,
  MyDriverResult,
  SettlementAccountResult,
} from '../../application/dto/driver.result.js';
import { ChangeAvailabilityUseCase } from '../../application/use-cases/change-availability.use-case.js';
import { DriverDocumentsUseCase } from '../../application/use-cases/driver-documents.use-case.js';
import { DriverSettingsUseCase } from '../../application/use-cases/driver-settings.use-case.js';
import { GetMyDriverUseCase } from '../../application/use-cases/get-my-driver.use-case.js';
import { RegisterDriverUseCase } from '../../application/use-cases/register-driver.use-case.js';
import { RequestVehicleChangeUseCase } from '../../application/use-cases/request-vehicle-change.use-case.js';
import {
  DriverDocumentType,
  MAX_DOCUMENT_BYTES,
} from '../../domain/entities/driver-document.entity.js';
import {
  ChangeAvailabilityRequest,
  ReportLocationRequest,
  SettlementAccountRequest,
  VehicleRequest,
} from '../dto/driver.request.js';

/** 기사 컨트롤러. `/drivers` 경로. 기사 회원만 부른다. */
@ApiTags('drivers')
@ApiBearerAuth()
@Roles(UserRole.DRIVER)
@Controller('drivers')
export class DriverController {
  constructor(
    private readonly registerDriverUseCase: RegisterDriverUseCase,
    private readonly getMyDriverUseCase: GetMyDriverUseCase,
    private readonly changeAvailabilityUseCase: ChangeAvailabilityUseCase,
    private readonly requestVehicleChangeUseCase: RequestVehicleChangeUseCase,
    private readonly driverDocumentsUseCase: DriverDocumentsUseCase,
    private readonly driverSettingsUseCase: DriverSettingsUseCase,
  ) {}

  /** 기사 등록 신청 (반려된 뒤 재신청 포함). 서류를 모두 올린 뒤에 할 수 있다. */
  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: VehicleRequest,
  ): Promise<MyDriverResult> {
    return this.registerDriverUseCase.execute(user.id, body);
  }

  /** 내 기사 정보. 심사 상태와 오늘 운행 시간을 함께 준다. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<MyDriverResult> {
    return this.getMyDriverUseCase.execute(user.id);
  }

  /** 운행 시작·종료 */
  @Patch('me/availability')
  changeAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangeAvailabilityRequest,
  ): Promise<MyDriverResult> {
    return this.changeAvailabilityUseCase.execute(user.id, body.available);
  }

  /** 차량 변경 신청. 다시 심사 대기가 되고 승인 전까지 운행할 수 없다. */
  @Post('me/vehicle-change')
  @HttpCode(HttpStatus.OK)
  requestVehicleChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: VehicleRequest,
  ): Promise<MyDriverResult> {
    return this.requestVehicleChangeUseCase.execute(user.id, body);
  }

  /** 현재 위치 보고. 기사 앱이 운행 중에 주기적으로 보낸다. */
  @Put('me/location')
  @HttpCode(HttpStatus.NO_CONTENT)
  reportLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReportLocationRequest,
  ): Promise<void> {
    return this.driverSettingsUseCase.reportLocation(
      user.id,
      body.latitude,
      body.longitude,
    );
  }

  /** 내 서류 목록. 필요한 서류 전부의 상태를 준다 (안 올린 것 포함). */
  @Get('me/documents')
  documents(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DriverDocumentResult[]> {
    return this.driverDocumentsUseCase.list(user.id);
  }

  /** 서류 올리기 (사진 또는 PDF, 10MB까지). 같은 종류를 다시 올리면 바뀐다. */
  @Put('me/documents/:type')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES } }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type', new ParseEnumPipe(DriverDocumentType))
    type: DriverDocumentType,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<DriverDocumentResult[]> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.driverDocumentsUseCase.upload(user.id, type, file.buffer);
  }

  /** 올린 서류 파일 보기 */
  @Get('me/documents/:type/file')
  async documentFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type', new ParseEnumPipe(DriverDocumentType))
    type: DriverDocumentType,
  ): Promise<StreamableFile> {
    const file = await this.driverDocumentsUseCase.file(user.id, type);
    return new StreamableFile(file.bytes, { type: file.contentType });
  }

  /** 정산 계좌. 등록하지 않았으면 null. */
  @Get('me/settlement-account')
  settlementAccount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SettlementAccountResult | null> {
    return this.driverSettingsUseCase.settlementAccount(user.id);
  }

  /** 정산 계좌 등록·변경. 저장하면서 본인 명의인지 확인한다. */
  @Put('me/settlement-account')
  saveSettlementAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SettlementAccountRequest,
  ): Promise<SettlementAccountResult> {
    return this.driverSettingsUseCase.saveSettlementAccount(user.id, body);
  }

  /** 저장한 정산 계좌로 본인 확인을 다시 한다. 결과는 verificationStatus로 본다. */
  @Post('me/settlement-account/verify')
  @HttpCode(HttpStatus.OK)
  verifySettlementAccount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SettlementAccountResult> {
    return this.driverSettingsUseCase.verifySettlementAccount(user.id);
  }
}
