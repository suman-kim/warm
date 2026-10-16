import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "../api/client";
import { authApi, storeApi } from "../api/store";
import type { FoundAddress, Store } from "../api/types";
import { useStore } from "../auth/session";
import { TopBar } from "../layout/Shell";
import { businessNumber, dotted, phone, storeAddressLine } from "../ui/format";
import { KeyValue, Modal, ModalHeader, Toggle } from "../ui/kit";
import { type PrefKey, usePref } from "../ui/prefs";
import { useToast } from "../ui/toast";
import { AddressSearch } from "./board/AddressSearch";

/** 가게 정보와 이 PC의 알림 설정. */
export function StorePage() {
  const store = useStore();
  const me = useQuery({ queryKey: ["me"], queryFn: authApi.me });
  const [editing, setEditing] = useState(false);
  const data = store.data;
  return (
    <>
      <TopBar
        title="가게 정보"
        updatedAt={store.dataUpdatedAt}
        onRefresh={() => store.refetch()}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-4 overflow-y-auto p-5 xl:grid-cols-2">
        <section className="flex flex-col rounded-[22px] bg-white px-5 pt-4 pb-2">
          <div className="flex items-center justify-between pb-2">
            <h2 className="m-0 text-[16px] font-extrabold">가게 정보</h2>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={!data}
              className="h-9 rounded-[11px] bg-hair px-3.5 text-[13px] font-extrabold"
            >
              수정
            </button>
          </div>
          {data && (
            <>
              <KeyValue label="상호" value={data.name} />
              <KeyValue
                label="사업자등록번호"
                value={`${businessNumber(data.businessNumber)} · 승인 뒤에는 고객센터에서 바꿔요`}
              />
              <KeyValue label="가게 전화" value={phone(data.phone)} />
              <KeyValue
                label="가게 주소"
                value={`${storeAddressLine(data.address)} · 모든 배달의 픽업지`}
              />
              <KeyValue
                label="사장님"
                value={me.data ? `${me.data.name} · ${me.data.email}` : ""}
              />
              <KeyValue
                label="승인"
                value={data.reviewedAt ? dotted(data.reviewedAt) : "심사 중"}
              />
            </>
          )}
        </section>
        <section className="flex flex-col rounded-[22px] bg-white px-5 py-2">
          <PrefRow
            pref="notifyProgress"
            title="배달 진행 알림"
            body="배정·도착·픽업·완료를 알려 드려요"
            askPermission
          />
          <PrefRow
            pref="notifyLowBalance"
            title="충전금 부족 알림"
            body="잔액이 10,000원보다 적으면 알려 드려요"
          />
          <PrefRow
            pref="sound"
            title="새 상태 알림음"
            body="카운터 PC에서 소리로 알려 드려요"
          />
        </section>
      </div>
      {editing && data && (
        <EditStoreModal store={data} onClose={() => setEditing(false)} />
      )}
    </>
  );
}

function PrefRow({
  pref,
  title,
  body,
  askPermission,
}: {
  pref: PrefKey;
  title: string;
  body: string;
  askPermission?: boolean;
}) {
  const [value, setValue] = usePref(pref);
  return (
    <div className="flex items-center gap-4 border-b border-rule py-4 last:border-b-0">
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[15px] font-extrabold">{title}</span>
        <span className="text-[12px] font-semibold text-muted">{body}</span>
      </div>
      <Toggle
        label={title}
        checked={value}
        onChange={(next) => {
          setValue(next);
          // 브라우저 알림은 처음 켤 때 허락을 받는다.
          if (next && askPermission && "Notification" in window) {
            void Notification.requestPermission().catch(() => {});
          }
        }}
      />
    </div>
  );
}

/** 상호·가게 전화·주소를 고친다. 사업자등록번호는 승인 뒤에 바꿀 수 없다. */
function EditStoreModal({
  store,
  onClose,
}: {
  store: Store;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(store.name);
  const [tel, setTel] = useState(phone(store.phone));
  const [place, setPlace] = useState<FoundAddress | null>(null);
  const [detail, setDetail] = useState(store.address.detailAddress ?? "");
  const save = useMutation({
    mutationFn: () =>
      storeApi.update({
        name: name.trim(),
        businessNumber: store.businessNumber,
        phone: tel.replace(/\D/g, ""),
        address: place
          ? {
              address: place.address,
              detailAddress: detail.trim() || null,
              sigungu: place.sigungu ?? store.address.sigungu,
              dong: place.dong ?? store.address.dong,
              latitude: place.latitude,
              longitude: place.longitude,
            }
          : { ...store.address, detailAddress: detail.trim() || null },
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["store"], saved);
      toast("가게 정보를 저장했어요");
      onClose();
    },
  });
  return (
    <Modal label="가게 정보 수정" width={500} onClose={onClose}>
      <ModalHeader
        title="가게 정보 수정"
        sub={businessNumber(store.businessNumber)}
        onClose={onClose}
      />
      <TextField label="상호" value={name} onChange={setName} />
      <TextField label="가게 전화" value={tel} onChange={setTel} />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-extrabold">가게 주소</span>
        <span className="rounded-[12px] bg-hair px-3.5 py-2.5 text-[14px] font-bold">
          {place ? place.address : store.address.address}
        </span>
        <AddressSearch
          placeholder="가게 주소를 바꾸려면 검색 (도로명·건물명)"
          onPick={setPlace}
        />
      </div>
      <TextField label="상세주소" value={detail} onChange={setDetail} />
      {save.isError && (
        <span role="alert" className="text-[13px] font-bold text-danger">
          {errorMessage(save.error)}
        </span>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-12 rounded-[14px] bg-hair px-5 text-[15px] font-extrabold"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !name.trim()}
          className="h-12 rounded-[14px] bg-ink px-6 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </Modal>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 rounded-[14px] px-3.5 py-2.5 shadow-[inset_0_0_0_1.5px_#E6E4DE] focus-within:shadow-[inset_0_0_0_2px_#121212]">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-[15px] font-bold outline-none"
      />
    </label>
  );
}
