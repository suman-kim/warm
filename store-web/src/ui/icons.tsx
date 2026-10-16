// 디자인의 선 아이콘 (24×24 격자).

type Shape =
  | string
  | [
      "rect",
      { x: number; y: number; width: number; height: number; rx: number },
    ]
  | ["circle", { cx: number; cy: number; r: number }];

function icon(shapes: Shape[], size = 18, strokeWidth = 2) {
  return function Icon() {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="block flex-none"
        aria-hidden="true"
      >
        {shapes.map((shape, index) =>
          typeof shape === "string" ? (
            <path key={index} d={shape} />
          ) : shape[0] === "rect" ? (
            <rect key={index} {...shape[1]} />
          ) : (
            <circle key={index} {...shape[1]} />
          ),
        )}
      </svg>
    );
  };
}

export const BoardIcon = icon([
  ["rect", { x: 4, y: 4, width: 7, height: 7, rx: 1.5 }],
  ["rect", { x: 13, y: 4, width: 7, height: 7, rx: 1.5 }],
  ["rect", { x: 4, y: 13, width: 7, height: 7, rx: 1.5 }],
  ["rect", { x: 13, y: 13, width: 7, height: 7, rx: 1.5 }],
]);
export const ListIcon = icon([
  "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
]);
export const WalletIcon = icon([
  ["rect", { x: 3.5, y: 6, width: 17, height: 13, rx: 2.5 }],
  "M3.5 10h17",
]);
export const StoreIcon = icon([
  "M4 11v9h16v-9",
  "M3 10.5L5 4.5h14l2 6",
  "M3 10.5c0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5c0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5c0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5",
]);
export const StoreSmallIcon = icon(
  [
    "M4 11v9h16v-9",
    "M3 10.5L5 4.5h14l2 6",
    "M3 10.5c0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5c0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5c0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5",
  ],
  14,
);
export const SearchIcon = icon([
  ["circle", { cx: 11, cy: 11, r: 6.5 }],
  "M16 16l4 4",
]);
export const CloseIcon = icon(["M7 7l10 10M17 7L7 17"], 16, 2.4);
export const CheckIcon = icon(["M5 12.5l4.5 4.5L19 7.5"], 13, 3.2);
export const ClockIcon = icon(
  [["circle", { cx: 12, cy: 12, r: 8.5 }], "M12 7.5V12l3 2"],
  15,
);
export const PhoneIcon = icon(
  [
    "M6.5 4h3l1.5 4-2 1.5a10 10 0 005.5 5.5l1.5-2 4 1.5v3a2 2 0 01-2 2A15.5 15.5 0 014.5 6a2 2 0 012-2z",
  ],
  16,
);
export const BikeIcon = icon(
  [
    ["circle", { cx: 5.5, cy: 16.5, r: 2.8 }],
    ["circle", { cx: 18.5, cy: 16.5, r: 2.8 }],
    "M5.5 16.5l3.5-6h4.5l2.5 6",
    "M13.5 10.5l1.2-3.5h2.8",
    "M9 10.5L7.5 8H5",
  ],
  18,
);
export const RefreshIcon = icon(
  ["M19 12a7 7 0 11-2.05-4.95M19 5v4h-4"],
  13,
  2.4,
);
export const DownloadIcon = icon(
  ["M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"],
  16,
);
export const CopyIcon = icon(
  [
    ["rect", { x: 8, y: 8, width: 11, height: 11, rx: 2 }],
    "M5 15V6a1 1 0 011-1h9",
  ],
  14,
);
