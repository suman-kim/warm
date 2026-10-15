import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { membersApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { MemberDetail } from "../../api/types";
import { Chip } from "../../ui/chip";
import {
  addDays,
  date,
  dateTime,
  dotted,
  phone,
  shortId,
  todayKst,
} from "../../ui/format";
import { AlertIcon } from "../../ui/icons";
import {
  ActionButton,
  CloseButton,
  ConfirmModal,
  FormError,
  Modal,
  useDialogFocus,
} from "../../ui/kit";
import { useToast } from "../../ui/toast";

/** 정지 기간 고르기. null은 무기한. */
const PERIODS: { days: number | null; label: string }[] = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: null, label: "무기한" },
];

/** 회원을 누르면 오른쪽에서 나오는 상세. 여기서 정지하고 정지를 푼다. */
export function MemberDrawer({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useDialogFocus(panel, onClose);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<"suspend" | "unsuspend" | null>(null);
  const detail = useQuery({
    queryKey: ["members", "detail", id],
    queryFn: () => membersApi.detail(id),
  });
  const settle = (member: MemberDetail, message: string) => {
    queryClient.setQueryData(["members", "detail", id], member);
    void queryClient.invalidateQueries({ queryKey: ["members", "list"] });
    setModal(null);
    toast(message);
  };
  const suspend = useMutation({
    mutationFn: (input: { days: number | null; reason: string }) =>
      membersApi.suspend(id, input.days, input.reason),
    onSuccess: (member) =>
      settle(member, `${member.name} 님 계정을 정지했어요`),
  });
  const unsuspend = useMutation({
    mutationFn: () => membersApi.unsuspend(id),
    onSuccess: (member) =>
      settle(member, `${member.name} 님 정지를 해제했어요`),
  });
  const member = detail.data;
  const isDriver = member?.role === "DRIVER";
  const roleLabel = isDriver ? "기사" : "고객";

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(18,18,18,.28)]"
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="회원 상세"
        tabIndex={-1}
        className="fixed top-0 right-0 bottom-0 z-[41] flex w-[440px] max-w-full flex-col bg-white shadow-[-30px_0_60px_-30px_rgba(0,0,0,.35)] outline-none"
      >
        <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-[26px] py-[22px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-muted">
              {member ? `${roleLabel} · ${shortId(member.id)}` : ""}
            </span>
            <CloseButton onClick={onClose} />
          </div>
          {!member ? (
            <span className="text-[14px] font-semibold text-muted">
              {detail.isError
                ? errorMessage(detail.error)
                : "불러오는 중이에요"}
            </span>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                <span className="text-[26px] font-extrabold tracking-[-0.03em]">
                  {member.name}
                </span>
                <div className="flex items-center gap-2">
                  <Chip
                    kind={
                      member.suspended ? "MEMBER_SUSPENDED" : "MEMBER_ACTIVE"
                    }
                  />
                  <span className="text-[13px] font-bold text-danger">
                    {member.suspended &&
                      (member.suspendedUntil
                        ? `${date(member.suspendedUntil)}까지 정지`
                        : "무기한 정지")}
                  </span>
                </div>
              </div>
              {member.activeDeliveries > 0 && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-ink px-4 py-3.5 text-[14px] font-bold text-white">
                  <span className="size-2 flex-none rounded-full bg-lime" />
                  지금 진행 중인 배송이 {member.activeDeliveries}건 있어요
                </div>
              )}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                {(isDriver
                  ? [
                      ["운행", `${member.useCount}건`],
                      [
                        "평점",
                        member.rating === null
                          ? "평가 없음"
                          : `★ ${member.rating.toFixed(1)}`,
                      ],
                    ]
                  : [
                      ["주문", `${member.useCount}건`],
                      [
                        "진행 중 배송",
                        member.activeDeliveries > 0
                          ? `${member.activeDeliveries}건`
                          : "없음",
                      ],
                    ]
                ).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col gap-2 rounded-2xl bg-paper px-4 py-3.5"
                  >
                    <span className="text-[12px] font-bold text-muted">
                      {key}
                    </span>
                    <span className="tnum text-[20px] font-extrabold">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                {[
                  ["이메일", member.email],
                  ["휴대폰", phone(member.phone)],
                  ["가입일", date(member.joinedAt)],
                  [
                    isDriver ? "최근 운행" : "최근 이용",
                    member.lastUsedAt ? dateTime(member.lastUsedAt) : "—",
                  ],
                ].map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between gap-4 border-b border-hair py-3 text-[14px]"
                  >
                    <span className="flex-none font-semibold text-muted">
                      {key}
                    </span>
                    <span className="text-right font-bold break-all">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-[15px] font-extrabold">정지 이력</span>
                {member.suspensions.map((each) => (
                  <div
                    key={each.startedAt}
                    className="flex flex-col gap-1.5 rounded-2xl bg-paper px-4 py-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="tnum text-[12px] font-bold text-muted">
                        {[
                          dateTime(each.startedAt),
                          each.days === null ? "무기한" : `${each.days}일`,
                          each.suspendedByName,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span
                        className={`text-[12px] font-extrabold ${
                          each.inEffect ? "text-danger" : "text-muted"
                        }`}
                      >
                        {each.inEffect
                          ? "정지 중"
                          : each.liftedAt
                            ? `${date(each.liftedAt)} 해제`
                            : "기간 종료"}
                      </span>
                    </div>
                    <span className="text-[14px] leading-[1.5] font-semibold">
                      {each.reason}
                    </span>
                  </div>
                ))}
                {member.suspensions.length === 0 && (
                  <span className="text-[14px] font-semibold text-muted">
                    정지된 적이 없어요
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {member && (
          <div className="flex border-t border-rule px-[26px] pt-4 pb-[22px]">
            {member.suspended ? (
              <button
                type="button"
                onClick={() => setModal("unsuspend")}
                className="flex h-[50px] flex-1 items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white"
              >
                정지 해제
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setModal("suspend")}
                className="ring-danger flex h-[50px] flex-1 items-center justify-center rounded-2xl bg-white text-[15px] font-extrabold text-danger"
              >
                계정 정지
              </button>
            )}
          </div>
        )}
      </aside>
      {member && modal === "suspend" && (
        <SuspendModal
          member={member}
          sub={`${roleLabel} · ${shortId(member.id)}`}
          busy={suspend.isPending}
          error={suspend.isError ? errorMessage(suspend.error) : null}
          onSubmit={(days, reason) => suspend.mutate({ days, reason })}
          onClose={() => setModal(null)}
        />
      )}
      {member && modal === "unsuspend" && (
        <ConfirmModal
          title="정지를 해제할까요?"
          body={`${member.name} 님이 바로 다시 로그인할 수 있어요. 정지 이력은 그대로 남아요.`}
          confirm="정지 해제"
          busy={unsuspend.isPending}
          error={unsuspend.isError ? errorMessage(unsuspend.error) : null}
          onConfirm={() => unsuspend.mutate()}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function SuspendModal({
  member,
  sub,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  member: MemberDetail;
  sub: string;
  busy: boolean;
  error: string | null;
  onSubmit: (days: number | null, reason: string) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState<number | null>(7);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const blocked = member.activeDeliveries > 0;
  const title = `${member.name} 님 계정을 정지할까요?`;

  return (
    <Modal label={title} width={500} onClose={onClose}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[21px] font-extrabold tracking-[-0.02em]">
          {title}
        </span>
        <span className="text-[14px] font-semibold text-muted">{sub}</span>
      </div>
      {blocked && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-soft px-4 py-3.5 text-[14px] leading-[1.5] font-bold">
          <span className="text-danger">
            <AlertIcon />
          </span>
          진행 중인 배송이 있어 지금은 정지할 수 없어요. 배송이 끝난 뒤 다시
          시도해 주세요.
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        <span className="text-[14px] font-extrabold">정지 기간</span>
        <div
          role="radiogroup"
          aria-label="정지 기간"
          className="grid grid-cols-3 gap-1 rounded-[14px] bg-well p-1"
        >
          {PERIODS.map((period) => {
            const on = period.days === days;
            return (
              <button
                key={period.label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDays(period.days)}
                className={`flex h-[38px] items-center justify-center rounded-[11px] text-[14px] font-extrabold ${
                  on
                    ? "bg-white text-ink shadow-[0_1px_2px_rgba(18,18,18,.08)]"
                    : "text-tab"
                }`}
              >
                {period.label}
              </button>
            );
          })}
        </div>
        <span className="text-[13px] font-semibold text-muted">
          {days === null
            ? "정지를 해제할 때까지 로그인할 수 없어요"
            : `${dotted(addDays(todayKst(), days))}까지 로그인할 수 없어요`}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="text-[14px] font-extrabold">정지 사유</span>
        <label className="field rounded-[14px] px-3.5 py-3">
          <textarea
            value={reason}
            onChange={(event) => {
              setInvalid(null);
              setReason(event.target.value);
            }}
            rows={3}
            maxLength={500}
            aria-label="정지 사유"
            placeholder="회원에게 보여 줄 정지 사유"
            className="text-[15px] leading-[1.6] font-medium"
          />
        </label>
        <span className="text-[13px] font-semibold text-muted">
          정지되면 바로 로그아웃되고, 다시 로그인하면 정지 안내와 사유가 보여요
        </span>
      </div>
      <FormError message={invalid ?? error} />
      <div className="flex justify-end gap-2">
        <ActionButton tone="soft" onClick={onClose}>
          취소
        </ActionButton>
        <ActionButton
          tone="danger"
          disabled={blocked || busy}
          onClick={() =>
            reason.trim().length < 5
              ? setInvalid("정지 사유를 적어 주세요")
              : onSubmit(days, reason.trim())
          }
        >
          정지하기
        </ActionButton>
      </div>
    </Modal>
  );
}
