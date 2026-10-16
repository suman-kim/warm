import { Paged, PageRequest } from '../../../common/domain/pagination.js';

/** 회원 조회 DI 토큰. */
export const MEMBER_QUERY = Symbol('MEMBER_QUERY');

/** 사장님(CUSTOMER), 라이더(DRIVER), 주문앱 손님(CONSUMER). */
export type MemberRole = 'CUSTOMER' | 'DRIVER' | 'CONSUMER';

export interface MemberFilter {
  role: MemberRole;
  /** 이름, 이메일, 휴대폰 번호로 찾는다 */
  q?: string;
  /** true면 지금 정지된 회원만, false면 정지되지 않은 회원만 */
  suspended?: boolean;
}

/** 운영자가 보는 회원 한 명. 주문·운행 수와 최근 이용 시각이 붙는다. */
export interface MemberRow {
  id: string;
  role: MemberRole;
  name: string;
  email: string;
  phone: string;
  joinedAt: Date;
  /** 사장님은 요청한 배달 수(취소 제외), 라이더는 완료한 배달 수, 손님은 결제한 주문 수 */
  useCount: number;
  /** 사장님은 마지막으로 배달을 요청한 때, 라이더는 마지막으로 배달을 마친 때, 손님은 마지막으로 주문한 때 */
  lastUsedAt: Date | null;
  /** 지금 진행 중인(끝나지 않은) 배달 수. 손님은 끝나지 않은 주문 수. */
  activeDeliveries: number;
}

/**
 * 운영자의 회원 조회. 탈퇴한 회원과 운영자는 빼고 사장님·라이더·손님만 본다.
 * 회원·주문·기사·평가에 걸쳐 읽어야 해서 어느 한 컨텍스트의 저장소에 두지 않았다.
 */
export interface MemberQuery {
  /** 최근에 가입한 회원부터. */
  find(
    filter: MemberFilter,
    page: PageRequest,
    now: Date,
  ): Promise<Paged<MemberRow>>;
  findOne(userId: string): Promise<MemberRow | null>;
  countByRole(): Promise<Record<MemberRole, number>>;
}
