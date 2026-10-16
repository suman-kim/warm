import { useEffect, useState } from "react";

/** 입력이 멈춘 뒤의 값. 검색어를 글자마다 서버에 보내지 않으려고 쓴다. */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/** 받은 파일을 <img>·<iframe>에 넣을 주소로 바꾼다. 쓰지 않게 되면 주소를 거둔다. */
export function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

/** 이어 받는 목록에서 다음 쪽 번호. 다 받았으면 undefined. */
export function nextPage<T>(
  last: { total: number },
  pages: { items: T[] }[],
): number | undefined {
  const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
  return loaded < last.total ? pages.length + 1 : undefined;
}
