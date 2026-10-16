/** 회원 역할. 인증·인가와 여러 컨텍스트가 함께 쓰는 공유 커널이다. */
export enum UserRole {
  /** 배달을 요청하는 가게 사장님 */
  CUSTOMER = 'CUSTOMER',
  /** 배달 라이더 */
  DRIVER = 'DRIVER',
  /** 주문앱(따끈)으로 음식을 주문하는 손님 */
  CONSUMER = 'CONSUMER',
  /** 운영자 */
  ADMIN = 'ADMIN',
}
