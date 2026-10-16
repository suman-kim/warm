import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useRef, useState } from "react";
import { ApiError, errorMessage } from "../../api/client";
import { deliveryApi } from "../../api/store";
import type { DoorPayment, FoundAddress, Store } from "../../api/types";
import { ampm, distanceKm, PAYMENTS, won } from "../../ui/format";
import { ClockIcon, CloseIcon } from "../../ui/icons";
import { Key } from "../../ui/kit";
import { useToast } from "../../ui/toast";
import { AddressSearch } from "./AddressSearch";

const MAX_KM = 10;
const COOKS = [0, 10, 15, 20, 30];
const PAY_KEYS: DoorPayment[] = ["PREPAID", "CASH", "CARD"];

/**
 * 빠른 배달 요청 (카운터용). 키보드만으로 주소 → 상세주소 → 연락처 → 음식값 → 조리 시간을 넣고
 * Enter로 요청한다. 숫자 1·2·3은 결제 방식, ←→는 조리 시간.
 */
export function QuickRequest({
  store,
  onRequested,
}: {
  store: Store;
  onRequested: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [place, setPlace] = useState<FoundAddress | null>(null);
  const [detail, setDetail] = useState("");
  const [phone, setPhone] = useState("");
  const [food, setFood] = useState("");
  const [payment, setPayment] = useState<DoorPayment>("CASH");
  const [cook, setCook] = useState(15);
  const [memo, setMemo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const search = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const foodRef = useRef<HTMLInputElement>(null);
  const cookRef = useRef<HTMLDivElement>(null);

  const destination = place && {
    address: place.address,
    detailAddress: detail.trim() || undefined,
    sigungu: place.sigungu ?? undefined,
    dong: place.dong ?? undefined,
    latitude: place.latitude,
    longitude: place.longitude,
  };
  const quote = useQuery({
    queryKey: ["quote", place?.latitude, place?.longitude],
    queryFn: () => deliveryApi.quote(destination!),
    enabled: !!place,
    retry: false,
  });
  const foodAmount = Number(food.replace(/\D/g, "")) || 0;
  const lacking = quote.data && quote.data.walletBalance < quote.data.fee;

  const reset = () => {
    setPlace(null);
    setDetail("");
    setPhone("");
    setFood("");
    setPayment("CASH");
    setCook(15);
    setMemo("");
    setErrors({});
    search.current?.focus();
  };

  const request = useMutation({
    mutationFn: () =>
      deliveryApi.request({
        dropoff: { ...destination!, phone: phone.replace(/\D/g, "") },
        foodAmount,
        doorPayment: payment,
        readyInMinutes: cook,
        memo: memo.trim() || undefined,
      }),
    onSuccess: (order) => {
      toast(
        `배달을 요청했어요 · ${won(order.fare)} · 끝자리 ${order.code.slice(-4)}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["store"] });
      onRequested();
      reset();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const field: Record<string, string> = {
          DELIVERY_TOO_FAR: "address",
          INVALID_PHONE_NUMBER: "phone",
          INVALID_FOOD_AMOUNT: "food",
          FOOD_AMOUNT_REQUIRED: "food",
        };
        setErrors({ [field[error.code] ?? "form"]: error.message });
      } else {
        setErrors({ form: errorMessage(error) });
      }
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!place) next.address = "손님 주소를 검색해 주세요.";
    else if (distanceKm(store.address, place) > MAX_KM) {
      next.address = "가게에서 10km 안까지 배달할 수 있어요.";
    }
    if (!/^0\d{8,11}$/.test(phone.replace(/\D/g, ""))) {
      next.phone = "손님 연락처를 확인해 주세요.";
    }
    if (foodAmount > 1_000_000)
      next.food = "음식값은 1,000,000원까지 적을 수 있어요.";
    else if (payment !== "PREPAID" && foodAmount === 0) {
      next.food = "만나서 결제하는 주문은 받을 음식값을 적어 주세요.";
    }
    setErrors(next);
    if (Object.keys(next).length === 0 && !lacking) request.mutate();
  };

  /** Enter는 다음 칸으로, 숫자 1·2·3은 (글을 쓰는 칸이 아니면) 결제 방식. */
  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    if (!typing && ["1", "2", "3"].includes(event.key)) {
      setPayment(PAY_KEYS[Number(event.key) - 1]);
      event.preventDefault();
    }
  };
  const next =
    (ref: { current: HTMLElement | null }) => (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        ref.current?.focus();
      }
    };
  const onCookKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = COOKS.indexOf(cook);
    if (event.key === "ArrowRight")
      setCook(COOKS[Math.min(COOKS.length - 1, index + 1)]);
    else if (event.key === "ArrowLeft") setCook(COOKS[Math.max(0, index - 1)]);
    else if (event.key === "Enter") submit();
    else return;
    event.preventDefault();
  };

  const placeKm = place
    ? (quote.data?.distanceKm ?? distanceKm(store.address, place))
    : 0;
  const readyAt = new Date(Date.now() + cook * 60_000);

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onPanelKey}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <span className="text-[16px] font-extrabold">빠른 배달 요청</span>
        <button
          type="button"
          onClick={reset}
          className="text-[13px] font-bold text-muted"
        >
          비우기
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
        {place && (
          <div className="flex items-start gap-2 rounded-[14px] bg-hair px-3.5 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[11px] font-bold text-muted">
                손님 주소
              </span>
              <span className="text-[15px] font-extrabold">
                {place.address}
              </span>
              <span className="text-[12px] font-semibold text-muted">
                {[
                  place.dong,
                  `가게에서 ${placeKm.toFixed(1)}km`,
                  quote.data && `약 ${quote.data.durationMinutes}분`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <button
              type="button"
              aria-label="손님 주소 지우기"
              onClick={() => {
                setPlace(null);
                search.current?.focus();
              }}
              className="flex size-7 items-center justify-center rounded-lg bg-white"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <AddressSearch
          ref={search}
          placeholder="손님 주소 검색 (도로명·건물명)"
          describe={(found) =>
            [
              found.dong,
              `가게에서 ${distanceKm(store.address, found).toFixed(1)}km`,
            ]
              .filter(Boolean)
              .join(" · ")
          }
          onPick={(found) => {
            setPlace(found);
            setErrors((e) => ({ ...e, address: "" }));
            detailRef.current?.focus();
          }}
        />
        <FieldError message={errors.address} />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="상세주소"
            inputRef={detailRef}
            value={detail}
            placeholder="101동 1203호"
            onChange={setDetail}
            onKeyDown={next(phoneRef)}
          />
          <Input
            label="손님 연락처"
            inputRef={phoneRef}
            value={phone}
            placeholder="050-0000-0000"
            onChange={(value) => {
              setPhone(value);
              setErrors((e) => ({ ...e, phone: "" }));
            }}
            onKeyDown={next(foodRef)}
          />
        </div>
        <FieldError message={errors.phone} />
        <Input
          label="음식값"
          inputRef={foodRef}
          value={foodAmount ? foodAmount.toLocaleString("ko-KR") : food}
          placeholder="0"
          suffix="원"
          onChange={(value) => {
            setFood(value.replace(/\D/g, "").slice(0, 7));
            setErrors((e) => ({ ...e, food: "" }));
          }}
          onKeyDown={next(cookRef)}
        />
        <FieldError message={errors.food} />
        <span className="text-[13px] font-extrabold">결제 방식</span>
        <div className="grid grid-cols-3 gap-1.5">
          {PAY_KEYS.map((key, index) => (
            <button
              key={key}
              type="button"
              aria-pressed={payment === key}
              onClick={() => setPayment(key)}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-[12px] text-[13px] font-extrabold ${
                payment === key ? "bg-ink text-white" : "bg-hair text-ink"
              }`}
            >
              <Key dark={payment === key}>{index + 1}</Key>
              {PAYMENTS[key]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold">조리 완료까지</span>
          <span className="flex gap-1">
            <Key>←</Key>
            <Key>→</Key>
          </span>
        </div>
        <div
          ref={cookRef}
          tabIndex={0}
          role="radiogroup"
          aria-label="조리 완료까지"
          onKeyDown={onCookKey}
          className="grid grid-cols-5 gap-1.5 rounded-[12px] outline-offset-2"
        >
          {COOKS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              role="radio"
              aria-checked={cook === minutes}
              tabIndex={-1}
              onClick={() => setCook(minutes)}
              className={`h-10 rounded-[11px] text-[13px] font-extrabold ${
                cook === minutes ? "bg-ink text-white" : "bg-hair"
              }`}
            >
              {minutes === 0 ? "바로" : `${minutes}분`}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-sub">
          <ClockIcon />
          {cook === 0
            ? "조리가 끝났어요 · 라이더가 바로 와요"
            : `${ampm(readyAt)}에 조리 완료 · 라이더가 맞춰서 와요`}
        </span>
        <label className="flex flex-col gap-1 rounded-[14px] bg-hair px-3.5 py-3">
          <span className="flex justify-between text-[11px] font-bold text-muted">
            요청사항 (선택)
            <span className="tnum">{memo.length}/500</span>
          </span>
          <textarea
            value={memo}
            maxLength={500}
            rows={2}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="라이더에게 남길 말"
            className="resize-none bg-transparent text-[14px] font-bold outline-none placeholder:font-semibold placeholder:text-faint"
          />
        </label>
        <div className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <Key>Enter</Key> 다음 칸 <Key>1</Key>
            <Key>2</Key>
            <Key>3</Key> 결제 방식
          </span>
          <span className="flex items-center gap-1.5">
            조리 시간에서 <Key>Enter</Key> 요청
          </span>
        </div>
        <FieldError message={errors.form} />
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line px-5 pt-3 pb-5">
        {quote.data && (
          <div className="grid grid-cols-3 gap-2 text-[11px] font-bold text-muted">
            <span className="flex flex-col gap-0.5">
              거리·예상 시간
              <span className="tnum text-[13px] font-extrabold text-ink">
                {quote.data.distanceKm.toFixed(1)}km · 약{" "}
                {quote.data.durationMinutes}분
              </span>
            </span>
            <span className="flex flex-col gap-0.5">
              배달대행료
              <span className="tnum text-[13px] font-extrabold text-ink">
                {won(quote.data.fee)}
              </span>
            </span>
            <span className="flex flex-col gap-0.5">
              요청 뒤 잔액
              <span
                className={`tnum text-[13px] font-extrabold ${lacking ? "text-danger" : "text-ink"}`}
              >
                {won(quote.data.walletBalance - quote.data.fee)}
              </span>
            </span>
          </div>
        )}
        {quote.isError && <FieldError message={errorMessage(quote.error)} />}
        {lacking && (
          <FieldError
            message={`충전금이 부족해요. 잔액 ${won(quote.data!.walletBalance)}, 대행료 ${won(quote.data!.fee)}.`}
          />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={request.isPending || !!lacking}
          className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-ink text-[16px] font-extrabold text-white disabled:opacity-40"
        >
          {quote.data ? `배달 요청 · ${won(quote.data.fee)}` : "배달 요청"}
          <Key dark>Enter</Key>
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  placeholder,
  suffix,
  inputRef,
  onChange,
  onKeyDown,
}: {
  label: string;
  value: string;
  placeholder: string;
  suffix?: string;
  inputRef: { current: HTMLInputElement | null };
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 rounded-[14px] bg-white px-3.5 py-2.5 shadow-[inset_0_0_0_1.5px_#E6E4DE] focus-within:shadow-[inset_0_0_0_2px_#121212]">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="tnum min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none placeholder:font-semibold placeholder:text-faint"
        />
        {suffix && <span className="text-[14px] font-extrabold">{suffix}</span>}
      </span>
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span role="alert" className="-mt-1.5 text-[12px] font-bold text-danger">
      {message}
    </span>
  ) : null;
}
