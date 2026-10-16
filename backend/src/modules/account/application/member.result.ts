import { MemberRole } from './member.query.js';

/** 운영자가 보는 회원. */
export class MemberResult {
  id: string;
  role: MemberRole;
  name: string;
  email: string;
  phone: string;
  joinedAt: Date;
  /** 지금 정지 중인지 */
  suspended: boolean;
  /** 정지가 끝나는 시각. 정지 중이 아니거나 무기한이면 null. */
  suspendedUntil: Date | null;
  /** 사장님은 요청한 배달 수(취소 제외), 라이더는 완료한 배달 수 */
  useCount: number;
  /** 사장님은 마지막으로 배달을 요청한 때, 라이더는 마지막으로 배달을 마친 때 */
  lastUsedAt: Date | null;
}

export class MemberPageResult {
  items: MemberResult[];
  total: number;
  page: number;
  size: number;
  /** 탭에 보이는 역할별 회원 수 */
  counts: Record<MemberRole, number>;
}

/** 정지 기록 한 건. */
export class SuspensionResult {
  startedAt: Date;
  /** 정지 기간(일). 무기한이면 null. */
  days: number | null;
  reason: string;
  /** 정지한 운영자의 이름 */
  suspendedByName: string | null;
  /** 지금 걸려 있는 정지인지 */
  inEffect: boolean;
  /** 운영자가 해제한 시각. 기간이 끝나 풀렸거나 아직 정지 중이면 null. */
  liftedAt: Date | null;
}

/** 회원 상세. 진행 중인 배송과 정지 이력이 붙는다. */
export class MemberDetailResult extends MemberResult {
  /** 지금 진행 중인 배송 수. 있으면 정지할 수 없다. */
  activeDeliveries: number;
  suspensions: SuspensionResult[];
}
