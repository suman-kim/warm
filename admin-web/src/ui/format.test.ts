import {
  addDays,
  date,
  dateTime,
  fileSize,
  kstMidnight,
  orderCode,
  phone,
  plate,
  shortDateTime,
  todayKst,
  weekday,
  weekLabel,
  won,
} from "./format";

describe("날짜와 시각", () => {
  it("늘 한국 시간으로 보여 준다", () => {
    // UTC로는 10월 12일 밤이지만 한국은 13일 아침이다.
    expect(dateTime("2026-10-12T23:42:00Z")).toBe("2026.10.13 08:42");
    expect(date("2026-10-12T15:00:00Z")).toBe("2026.10.13");
    expect(shortDateTime("2026-10-13T00:05:00+09:00")).toBe("10.13 00:05");
  });

  it("오늘은 한국 날짜다", () => {
    expect(todayKst(new Date("2026-10-12T15:30:00Z"))).toBe("2026-10-13");
    expect(todayKst(new Date("2026-10-12T14:59:00Z"))).toBe("2026-10-12");
  });

  it("날짜를 더하고 요일을 구한다", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekday("2026-10-13")).toBe("화");
    expect(weekday("2026-10-18")).toBe("일");
  });

  it("한국 날짜의 0시를 서버에 보낼 시각으로 바꾼다", () => {
    expect(new Date(kstMidnight("2026-11-15")).toISOString()).toBe(
      "2026-11-14T15:00:00.000Z",
    );
  });

  it("주를 그 달의 몇째 주로 부른다", () => {
    expect(weekLabel("2026-10-05")).toBe("10월 1주");
    expect(weekLabel("2026-10-12")).toBe("10월 2주");
    expect(weekLabel("2026-09-28")).toBe("9월 4주");
  });
});

describe("글자 모양", () => {
  it("금액", () => {
    expect(won(28000)).toBe("28,000원");
    expect(won(0)).toBe("0원");
  });

  it("휴대폰 번호", () => {
    expect(phone("01048213307")).toBe("010-4821-3307");
    expect(phone("0111234567")).toBe("011-123-4567");
    expect(phone("023334444")).toBe("02-333-4444");
    expect(phone("00000000000")).toBe("00000000000");
  });

  it("차량 번호", () => {
    expect(plate("경기85자3412")).toBe("경기 85자 3412");
    expect(plate("123가4567")).toBe("123가 4567");
    expect(plate("임시번호")).toBe("임시번호");
  });

  it("파일 크기", () => {
    expect(fileSize(2_202_009)).toBe("2.1MB");
    expect(fileSize(655_360)).toBe("640KB");
    expect(fileSize(12)).toBe("1KB");
  });

  it("주문을 가리키는 짧은 이름", () => {
    expect(
      orderCode("3f9a1c2e-0000-4000-8000-000000000000", "2026-10-13T05:00:00Z"),
    ).toBe("MV261013-3F9A");
  });
});
