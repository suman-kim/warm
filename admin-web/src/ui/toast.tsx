import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckIcon } from "./icons";

const ToastContext = createContext<(message: string) => void>(() => {});

/** 화면 아래에 잠깐 떴다 사라지는 안내를 띄우는 함수. */
export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

const VISIBLE_MS = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((next: string) => {
    clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* 화면 낭독기가 새 안내를 읽도록 늘 자리를 둔다. */}
      <div role="status" aria-live="polite">
        {message && (
          <div className="fixed bottom-7 left-1/2 z-[80] flex max-w-[calc(100vw-40px)] -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-ink px-[18px] py-3.5 text-[14px] font-bold text-white shadow-[0_16px_40px_-16px_rgba(0,0,0,.5)]">
            <span className="flex size-5 flex-none items-center justify-center rounded-full bg-lime text-ink">
              <CheckIcon />
            </span>
            {message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
