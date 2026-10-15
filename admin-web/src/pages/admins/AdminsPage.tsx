import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminsApi } from "../../api/admin";
import { errorMessage } from "../../api/client";
import type { AdminAccount, AdminRole } from "../../api/types";
import { useMe } from "../../auth/session";
import { ROLES } from "../../layout/menu";
import { Chip } from "../../ui/chip";
import { date, shortDateTime } from "../../ui/format";
import { PlusIcon } from "../../ui/icons";
import {
  ActionButton,
  ConfirmModal,
  FormError,
  HeaderButton,
  ListState,
  Modal,
  ModalHeader,
  PageTitle,
  TableCard,
  TableHead,
  TableRow,
} from "../../ui/kit";
import { useToast } from "../../ui/toast";

const COLUMNS = "minmax(220px,1.4fr) 110px 130px 100px 90px 140px";
const ROLE_ORDER: AdminRole[] = ["SUPER", "OPS", "FINANCE"];

export function AdminsPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const [deactivating, setDeactivating] = useState<AdminAccount | null>(null);
  const list = useQuery({ queryKey: ["admins"], queryFn: adminsApi.list });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admins"] });
  const invite = useMutation({
    mutationFn: adminsApi.invite,
    onSuccess: (account) => {
      void refresh();
      setInviting(false);
      toast(`${account.email}로 초대 메일을 보냈어요`);
    },
  });
  const deactivate = useMutation({
    mutationFn: (account: AdminAccount) =>
      adminsApi.update(account.id, { active: false }),
    onSuccess: (account) => {
      void refresh();
      setDeactivating(null);
      toast(`${account.name} 님을 비활성화했어요`);
    },
  });
  const reactivate = useMutation({
    mutationFn: (account: AdminAccount) =>
      adminsApi.update(account.id, { active: true }),
    onSuccess: (account) => {
      void refresh();
      toast(`${account.name} 님을 다시 활성화했어요`);
    },
    onError: (error) => toast(errorMessage(error)),
  });
  const resend = useMutation({
    mutationFn: (account: AdminAccount) =>
      adminsApi.resendInvitation(account.id),
    onSuccess: (_, account) =>
      toast(`${account.email}로 초대 메일을 다시 보냈어요`),
    onError: (error) => toast(errorMessage(error)),
  });
  const rows = list.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="관리자 계정"
          sub="관리자를 초대하고, 권한에 따라 볼 수 있는 메뉴를 정해요"
        />
        <HeaderButton
          onClick={() => {
            invite.reset();
            setInviting(true);
          }}
        >
          <PlusIcon />
          관리자 추가
        </HeaderButton>
      </div>
      <TableCard minWidth={860}>
        <TableHead columns={COLUMNS}>
          <span>관리자</span>
          <span>권한</span>
          <span>마지막 로그인</span>
          <span>추가한 날</span>
          <span>상태</span>
          <span />
        </TableHead>
        {rows.map((account) => (
          <TableRow
            key={account.id}
            columns={COLUMNS}
            className="min-h-16 py-3"
          >
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                {account.name}
                {account.id === me.id && (
                  <span className="rounded-md bg-lime px-1.5 py-[3px] text-[11px] font-extrabold text-ink">
                    나
                  </span>
                )}
              </span>
              <span className="truncate text-[12px] font-semibold text-muted">
                {account.email}
              </span>
            </div>
            <span className="font-bold">{ROLES[account.role].label}</span>
            <span className="tnum text-body">
              {account.lastLoginAt ? shortDateTime(account.lastLoginAt) : "—"}
            </span>
            <span className="tnum text-body">{date(account.createdAt)}</span>
            <div>
              <Chip kind={`ADMIN_${account.status}`} />
            </div>
            <div className="flex justify-end">
              {account.id !== me.id && (
                <button
                  type="button"
                  disabled={reactivate.isPending || resend.isPending}
                  onClick={() => {
                    if (account.status === "ACTIVE") {
                      deactivate.reset();
                      setDeactivating(account);
                    } else if (account.status === "INACTIVE") {
                      reactivate.mutate(account);
                    } else {
                      resend.mutate(account);
                    }
                  }}
                  className={`ring-line h-8 rounded-[10px] bg-white px-3 text-[13px] font-bold whitespace-nowrap ${
                    account.status === "ACTIVE" ? "text-danger" : "text-ink"
                  }`}
                >
                  {account.status === "ACTIVE"
                    ? "비활성화"
                    : account.status === "INACTIVE"
                      ? "다시 활성화"
                      : "초대 다시 보내기"}
                </button>
              )}
            </div>
          </TableRow>
        ))}
        <ListState
          loading={list.isPending}
          error={list.isError}
          empty={rows.length === 0}
          emptyText="관리자가 없어요"
          onRetry={() => list.refetch()}
        />
      </TableCard>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
        {ROLE_ORDER.map((role) => (
          <div
            key={role}
            className="flex flex-col gap-1.5 rounded-[18px] bg-well px-[18px] py-4"
          >
            <span className="text-[14px] font-extrabold">
              {ROLES[role].label}
            </span>
            <span className="text-[13px] leading-[1.5] font-semibold text-sub">
              {ROLES[role].description}
            </span>
          </div>
        ))}
      </div>

      {inviting && (
        <InviteModal
          busy={invite.isPending}
          error={invite.isError ? errorMessage(invite.error) : null}
          onSubmit={(input) => invite.mutate(input)}
          onClose={() => setInviting(false)}
        />
      )}
      {deactivating && (
        <ConfirmModal
          title={`${deactivating.name} 님을 비활성화할까요?`}
          body="바로 로그아웃되고 다시 로그인할 수 없어요. 언제든 다시 활성화할 수 있어요."
          confirm="비활성화"
          tone="danger"
          busy={deactivate.isPending}
          error={deactivate.isError ? errorMessage(deactivate.error) : null}
          onConfirm={() => deactivate.mutate(deactivating)}
          onClose={() => setDeactivating(null)}
        />
      )}
    </>
  );
}

function InviteModal({
  busy,
  error,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (input: { name: string; email: string; role: AdminRole }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("OPS");
  const [invalid, setInvalid] = useState<string | null>(null);

  function submit() {
    if (name.trim().length < 2) {
      setInvalid("이름을 적어 주세요");
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setInvalid("이메일 형식을 확인해 주세요");
    } else {
      onSubmit({ name: name.trim(), email: email.trim(), role });
    }
  }

  return (
    <Modal label="관리자 추가" width={540} onClose={onClose}>
      <ModalHeader title="관리자 추가" onClose={onClose} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
        <label className="field gap-1 rounded-[14px] px-3.5 py-2.5">
          <span className="text-[12px] font-bold text-muted">이름</span>
          <input
            value={name}
            onChange={(event) => {
              setInvalid(null);
              setName(event.target.value);
            }}
            maxLength={50}
            placeholder="이름"
            className="text-[16px] font-semibold"
          />
        </label>
        <label className="field gap-1 rounded-[14px] px-3.5 py-2.5">
          <span className="text-[12px] font-bold text-muted">회사 이메일</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setInvalid(null);
              setEmail(event.target.value);
            }}
            placeholder="name@movo.kr"
            className="text-[16px] font-semibold"
          />
        </label>
      </div>
      <div role="radiogroup" aria-label="권한" className="flex flex-col gap-2">
        <span className="text-[14px] font-extrabold">권한</span>
        {ROLE_ORDER.map((each) => {
          const on = each === role;
          return (
            <button
              key={each}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setRole(each)}
              className={`flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left ${
                on ? "ring-ink-2" : "ring-line"
              }`}
            >
              <span
                className={`size-5 flex-none rounded-full ${
                  on ? "shadow-[inset_0_0_0_6px_#121212]" : "ring-box"
                }`}
              />
              <div className="flex flex-col gap-[3px]">
                <span className="text-[15px] font-extrabold">
                  {ROLES[each].label}
                </span>
                <span className="text-[13px] font-semibold text-muted">
                  {ROLES[each].description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <span className="text-[13px] leading-[1.5] font-semibold text-muted">
        초대 메일이 가요. 받은 분이 메일에서 비밀번호를 정하면 로그인할 수
        있어요.
      </span>
      <FormError message={invalid ?? error} />
      <div className="flex justify-end gap-2">
        <ActionButton tone="soft" onClick={onClose}>
          취소
        </ActionButton>
        <ActionButton disabled={busy} onClick={submit}>
          초대 메일 보내기
        </ActionButton>
      </div>
    </Modal>
  );
}
