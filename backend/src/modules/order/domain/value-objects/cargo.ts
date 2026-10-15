import { InvalidArgumentError } from '../../../../common/domain/domain-error.js';

/** 물품 종류. 배송 요청 화면에서 하나를 고른다. */
export enum CargoCategory {
  DOCUMENT = 'DOCUMENT',
  BOX = 'BOX',
  SHOPPING_BAG = 'SHOPPING_BAG',
  FURNITURE_APPLIANCE = 'FURNITURE_APPLIANCE',
  ETC = 'ETC',
}

export interface CargoInput {
  category: CargoCategory;
  weightKg: number;
  quantity?: number;
  description?: string | null;
}

/** 화물 값 객체. 무엇을, 몇 개, 얼마나 무겁게 보내는지. */
export class Cargo {
  private constructor(
    readonly category: CargoCategory,
    /** 전체 중량(kg) */
    readonly weightKg: number,
    readonly quantity: number,
    /** 종류만으로 부족할 때 덧붙이는 설명 */
    readonly description: string | null,
  ) {}

  static of(input: CargoInput): Cargo {
    if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
      throw new InvalidArgumentError(
        'INVALID_CARGO_WEIGHT',
        '화물 중량은 0보다 커야 해요.',
      );
    }
    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new InvalidArgumentError(
        'INVALID_CARGO_QUANTITY',
        '화물 수량은 1개 이상이어야 해요.',
      );
    }
    const description = input.description?.trim() || null;
    if (description && description.length > 200) {
      throw new InvalidArgumentError(
        'INVALID_CARGO_DESCRIPTION',
        '화물 설명은 200자까지 쓸 수 있어요.',
      );
    }
    return new Cargo(input.category, input.weightKg, quantity, description);
  }
}
