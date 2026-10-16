import {
  addDays,
  ampm,
  businessNumber,
  phone,
  plate,
  relativeTime,
  statusChip,
  todayKst,
  won,
} from "./format";

describe("글자 만들기", () => {
  it("시각은 한국 시간의 오전·오후로 보여 준다", () => {
    expect(ampm("2026-10-15T10:32:00Z")).toBe("오후 7:32");
    expect(ampm("2026-10-15T00:05:00Z")).toBe("오전 9:05");
    expect(ampm("2026-10-15T03:00:00Z")).toBe("오후 12:00");
  });

  it("오늘·어제는 날짜를 줄인다", () => {
    const now = new Date("2026-10-15T10:40:00Z");
    expect(relativeTime("2026-10-15T10:32:00Z", now)).toBe("오후 7:32");
    expect(relativeTime("2026-10-14T06:00:00Z", now)).toBe("어제 오후 3:00");
    expect(relativeTime("2026-10-13T12:42:00Z", now)).toBe("10.13 오후 9:42");
  });

  it("한국 날짜를 하루씩 옮긴다 (자정 근처도)", () => {
    expect(todayKst(new Date("2026-10-15T15:30:00Z"))).toBe("2026-10-16");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-10-15", 6)).toBe("2026-10-21");
  });

  it("번호와 금액", () => {
    expect(won(84500)).toBe("84,500원");
    expect(phone("025551234")).toBe("02-555-1234");
    expect(phone("01048211024")).toBe("010-4821-1024");
    expect(phone("050412345678")).toBe("0504-1234-5678");
    expect(businessNumber("2208162517")).toBe("220-81-62517");
    expect(plate("서울강남가1234")).toBe("서울 강남 가 1234");
  });

  it("상태 꼬리표는 가게 앱과 같은 이름이다", () => {
    expect(statusChip("REQUESTED").label).toBe("라이더 찾는 중");
    expect(statusChip("DEPARTED").label).toBe("가게로 오는 중");
    expect(statusChip("ARRIVED").label).toBe("라이더 가게 도착");
    expect(statusChip("CANCELLED").label).toBe("취소됨");
  });
});
