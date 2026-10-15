import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ReviewTag } from '../../domain/entities/review.entity.js';

export class WriteReviewRequest {
  /** 별점 1~5 */
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  /** 칭찬 태그 (친절해요·빨라요·꼼꼼해요) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(ReviewTag, { each: true })
  tags?: ReviewTag[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  comment?: string;
}

export class SendMessageRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;
}

export class ListMessagesRequest {
  /** 이 시각 뒤에 온 메시지만 (ISO 8601). 새 메시지를 확인할 때 마지막 메시지의 시각을 보낸다. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  after?: Date;
}

export class NavigationRequest {
  /** 지금 위치. 안 보내면 마지막으로 보낸 위치를 쓴다. 위도·경도는 함께 보낸다. */
  @ValidateIf((o: NavigationRequest) => o.longitude !== undefined)
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ValidateIf((o: NavigationRequest) => o.latitude !== undefined)
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}

export class RecentDestinationsRequest {
  /** 몇 곳까지 (기본 5, 최대 20) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 5;
}
