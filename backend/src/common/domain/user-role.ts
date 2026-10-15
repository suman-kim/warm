/** 회원 역할. 인증·인가와 여러 컨텍스트가 함께 쓰는 공유 커널이다. */
export enum UserRole {
  /** 배송을 요청하는 개인 사용자 */
  CUSTOMER = 'CUSTOMER',
  /** 퀵·화물 기사 */
  DRIVER = 'DRIVER',
  /** 운영자 */
  ADMIN = 'ADMIN',
}
