/**
 * 주문의 환불 한 건. 고객이 취소해 자동으로 돌려준 것과 운영자가 돌려준 것을 남긴다.
 * 결제(OrderCharge)에는 돌려준 금액의 합만 있어서, 누가 왜 돌려줬는지는 여기서 본다.
 */
export class OrderRefund {
  constructor(
    readonly id: string,
    readonly orderId: string,
    readonly customerId: string,
    readonly amount: number,
    readonly reason: string,
    /** 돌려준 운영자 (회원 ID). 고객 취소로 자동 환불했으면 null. */
    readonly refundedBy: string | null,
    readonly createdAt: Date,
  ) {}
}
