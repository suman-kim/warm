import { maskName, writeReview } from './review.entity.js';

describe('Review', () => {
  it('이름 가운데를 가린다', () => {
    expect(maskName('김지은')).toBe('김*은');
    expect(maskName('이준')).toBe('이*');
    expect(maskName('남궁민수')).toBe('남**수');
    expect(maskName('')).toBe('손님');
  });

  it('별점은 1~5, 글은 500자까지', () => {
    const input = {
      id: 'review-1',
      foodOrderId: 'order-1',
      storeId: 'store-1',
      consumerUserId: 'consumer-1',
      consumerName: '김지은',
      orderSummary: '후라이드 치킨',
      content: '  맛있어요  ',
      now: new Date(),
    };
    expect(writeReview({ ...input, rating: 5 })).toMatchObject({
      authorName: '김*은',
      content: '맛있어요',
    });
    expect(() => writeReview({ ...input, rating: 0 })).toThrow(
      expect.objectContaining({ code: 'INVALID_RATING' }),
    );
    expect(() =>
      writeReview({ ...input, rating: 4, content: 'a'.repeat(501) }),
    ).toThrow(expect.objectContaining({ code: 'REVIEW_TOO_LONG' }));
  });
});
