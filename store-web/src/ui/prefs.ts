import { useCallback, useState } from "react";

// 이 PC에만 남기는 설정 (알림, 알림음). 브라우저 저장소를 못 쓰면 기본값으로 둔다.

export type PrefKey = "notifyProgress" | "notifyLowBalance" | "sound";

const DEFAULTS: Record<PrefKey, boolean> = {
  notifyProgress: true,
  notifyLowBalance: true,
  sound: true,
};

export function readPref(key: PrefKey): boolean {
  try {
    const raw = localStorage.getItem(`movo-store-${key}`);
    return raw === null ? DEFAULTS[key] : raw === "1";
  } catch {
    return DEFAULTS[key];
  }
}

export function usePref(key: PrefKey): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => readPref(key));
  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(`movo-store-${key}`, next ? "1" : "0");
      } catch {
        // 저장하지 못해도 이번 화면에서는 바뀐 값으로 쓴다.
      }
    },
    [key],
  );
  return [value, set];
}

/** 짧은 알림음 (새 상태가 생겼을 때). */
export function beep(): void {
  if (!readPref("sound")) return;
  try {
    const audio = new AudioContext();
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
    tone.connect(gain).connect(audio.destination);
    tone.start();
    tone.stop(audio.currentTime + 0.35);
  } catch {
    // 소리를 낼 수 없는 환경이면 넘어간다.
  }
}

/** 브라우저 알림 (허락받았을 때만). */
export function notify(title: string, body: string): void {
  if (!readPref("notifyProgress")) return;
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // 알림을 띄울 수 없으면 넘어간다.
  }
}
