import { useQuery } from "@tanstack/react-query";
import { forwardRef, useState } from "react";
import { addressApi } from "../../api/store";
import type { FoundAddress } from "../../api/types";
import { useDebounced } from "../../ui/hooks";
import { SearchIcon } from "../../ui/icons";
import { Key } from "../../ui/kit";

/**
 * 주소 검색 칸. 치는 대로 찾고, ↑↓로 고르고 Enter로 정한다.
 * [origin]을 주면 결과마다 거기서의 거리를 붙인다.
 */
export const AddressSearch = forwardRef<
  HTMLInputElement,
  {
    placeholder: string;
    onPick: (place: FoundAddress) => void;
    describe?: (place: FoundAddress) => string;
  }
>(function AddressSearch({ placeholder, onPick, describe }, ref) {
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const query = useDebounced(text.trim(), 250);
  const found = useQuery({
    queryKey: ["address-search", query],
    queryFn: () => addressApi.search(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });
  const results = query ? (found.data ?? []) : [];

  const pick = (place: FoundAddress) => {
    onPick(place);
    setText("");
    setOpen(false);
    setCursor(0);
  };

  return (
    <div className="relative">
      <label className="flex h-12 items-center gap-2.5 rounded-[14px] bg-white px-3.5 shadow-[inset_0_0_0_2px_#121212]">
        <SearchIcon />
        <input
          ref={ref}
          value={text}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-label={placeholder}
          placeholder={placeholder}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setCursor(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((c) =>
                Math.min(c + 1, Math.max(0, results.length - 1)),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            } else if (event.key === "Enter" && results[cursor]) {
              event.preventDefault();
              event.stopPropagation();
              pick(results[cursor]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none placeholder:font-semibold placeholder:text-faint"
        />
        <Key>↑↓</Key>
      </label>
      {open && query && (
        <div
          role="listbox"
          className="absolute top-[52px] right-0 left-0 z-20 flex max-h-[300px] flex-col overflow-y-auto rounded-[14px] bg-white p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,.35),inset_0_0_0_1px_#E6E4DE]"
        >
          {results.length === 0 ? (
            <span className="px-3 py-3 text-[13px] font-semibold text-muted">
              {found.isFetching ? "찾고 있어요" : "검색 결과가 없어요"}
            </span>
          ) : (
            results.map((place, index) => (
              <button
                key={`${place.address}-${index}`}
                type="button"
                role="option"
                aria-selected={index === cursor}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(place)}
                onMouseEnter={() => setCursor(index)}
                className={`flex flex-col gap-0.5 rounded-[10px] px-3 py-2.5 text-left ${
                  index === cursor ? "bg-hair" : ""
                }`}
              >
                <span className="text-[14px] font-extrabold">
                  {place.address}
                </span>
                <span className="text-[12px] font-semibold text-muted">
                  {describe
                    ? describe(place)
                    : [place.dong, place.detail].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
