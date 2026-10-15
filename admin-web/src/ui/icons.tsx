// 디자인(design/MOVO Admin.dc.html)의 아이콘을 그대로 옮겼다. 24×24 기준의 선 그림이다.

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

const DOCUMENT: Shape[] = [
  "M6.5 3.5h7l4 4v13h-11z",
  "M13.5 3.5v4h4M9.5 12.5h5M9.5 16h5",
];
const IMAGE: Shape[] = [
  ["rect", { x: 3.5, y: 5, width: 17, height: 14, rx: 2.5 }],
  ["circle", { cx: 9, cy: 10, r: 1.8 }],
  "M20.5 16l-5-5L6 19",
];

// 메뉴
export const ReviewIcon = icon(
  [
    ["circle", { cx: 10, cy: 8, r: 4 }],
    "M3 20c1-3.6 3.8-5.5 7-5.5 1.3 0 2.5.3 3.6.9",
    "M15.5 18l2 2 4-4.5",
  ],
  19,
);
export const OrdersIcon = icon(
  [
    "M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z",
    "M3.5 7.5L12 11.5l8.5-4M12 11.5v9",
  ],
  19,
);
export const MembersIcon = icon(
  [
    ["circle", { cx: 9, cy: 8, r: 3.5 }],
    "M2.5 20c.9-3.4 3.4-5.2 6.5-5.2s5.6 1.8 6.5 5.2",
    "M15.5 4.8a3.5 3.5 0 010 6.4M18 14.9c1.8.7 3 2.4 3.5 5.1",
  ],
  19,
);
export const SettleIcon = icon(
  [
    ["rect", { x: 3, y: 6, width: 18, height: 14, rx: 3 }],
    "M3 10.5h18M16.5 15h.01",
  ],
  19,
);
export const NoticeIcon = icon(
  [
    "M4 10v4a1 1 0 001 1h2l5 4V5L7 9H5a1 1 0 00-1 1z",
    "M16 8.5a5 5 0 010 7",
    "M18.5 6a8.5 8.5 0 010 12",
  ],
  19,
);
export const TermsIcon = icon(DOCUMENT, 19);
export const AdminsIcon = icon(
  [
    "M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z",
    "M9 12l2 2 4-4.5",
  ],
  19,
);

export const SearchIcon = icon(
  [["circle", { cx: 11, cy: 11, r: 6.5 }], "M16 16l4.5 4.5"],
  18,
);
export const PlusIcon = icon(["M12 5v14M5 12h14"], 16, 2.4);
export const BackIcon = icon(["M15 5l-7 7 7 7"], 18, 2.2);
export const ChevronLeftIcon = icon(["M14.5 6l-6 6 6 6"], 16, 2.2);
export const ChevronRightIcon = icon(["M9.5 6l6 6-6 6"], 16, 2.2);
export const ChevronLeftLargeIcon = icon(["M14.5 6l-6 6 6 6"], 24, 2);
export const ChevronRightLargeIcon = icon(["M9.5 6l6 6-6 6"], 24, 2);
export const CloseIcon = icon(["M7 7l10 10M17 7L7 17"], 16, 2.4);
export const CheckIcon = icon(["M5 12.5l4.5 4.5L19 7.5"], 13, 3.2);
export const LogoutIcon = icon(
  [
    "M14 4.5h4.5a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5H14",
    "M10 8l-4 4 4 4M6 12h9.5",
  ],
  18,
);
export const DownloadIcon = icon(
  ["M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"],
  16,
  2.2,
);
export const ImageIcon = icon(IMAGE, 30, 1.6);
export const ImageLargeIcon = icon(IMAGE, 48, 1.3);
export const PdfIcon = icon(DOCUMENT, 30, 1.6);
export const PdfLargeIcon = icon(DOCUMENT, 48, 1.3);
export const ExpandIcon = icon(
  ["M4.5 9.5v-5h5M19.5 9.5v-5h-5M4.5 14.5v5h5M19.5 14.5v5h-5"],
  15,
  2.2,
);
export const AlertIcon = icon(
  [["circle", { cx: 12, cy: 12, r: 8.5 }], "M12 8v4.5M12 16h.01"],
  18,
  2.2,
);
export const CalendarIcon = icon(
  [
    ["rect", { x: 4, y: 5.5, width: 16, height: 14.5, rx: 2.5 }],
    "M4 10h16M8.5 3.5v4M15.5 3.5v4",
  ],
  16,
);
