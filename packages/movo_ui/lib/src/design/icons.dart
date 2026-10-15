import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'colors.dart';

/// 디자인의 아이콘. 24×24 격자에 그린 선 아이콘이고, 크기를 바꾸면 선 굵기도 함께 커진다.
enum MovoIcons {
  eye(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  ),
  van(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 16.5V8a2 2 0 012-2H14l4.5 4.5H20a1.5 1.5 0 011.5 1.5v4.5h-2"/><path d="M9.5 16.5h5"/><circle cx="7" cy="17" r="2.2" fill="#000" stroke="none"/><circle cx="17" cy="17" r="2.2" fill="#000" stroke="none"/></svg>',
  ),
  chevronRight(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6l6 6-6 6"/></svg>',
  ),
  back(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  ),
  check(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  ),
  bell(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5h4"/></svg>',
  ),
  motorcycle(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6l2.5-7H20M7 10h4l2 7"/></svg>',
  ),
  truck(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5h11v10h-11zM13.5 10H18l3.5 3.5v3h-8"/><circle cx="6.5" cy="17" r="2.2" fill="#000" stroke="none"/><circle cx="17" cy="17" r="2.2" fill="#000" stroke="none"/></svg>',
  ),
  swap(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v16M8 20l-3.5-3.5M8 20l3.5-3.5M16 20V4M16 4l-3.5 3.5M16 4l3.5 3.5"/></svg>',
  ),
  clock(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  ),
  home(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z"/></svg>',
  ),
  list(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  ),
  person(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20.5c1.2-4 4.4-6 8-6s6.8 2 8 6"/></svg>',
  ),
  close(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  ),
  target(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.5" fill="#000" stroke="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>',
  ),
  bookmark(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h10v17l-5-3.5-5 3.5z"/></svg>',
  ),
  pin(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  ),
  chevronDown(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5l6 6 6-6"/></svg>',
  ),
  vanWindow(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 16.5V8a2 2 0 012-2H14l4.5 4.5H20a1.5 1.5 0 011.5 1.5v4.5h-2"/><path d="M9.5 16.5h5M14 6v4.5h4.5"/><circle cx="7" cy="17" r="2.2" fill="#000" stroke="none"/><circle cx="17" cy="17" r="2.2" fill="#000" stroke="none"/></svg>',
  ),
  box(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9"/></svg>',
  ),
  star(
    '<svg viewBox="0 0 24 24" fill="#000"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>',
  ),
  chat(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v10.5H10l-6 4z"/></svg>',
  ),
  phone(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h3l1.5 4.5-2 1.3a10.5 10.5 0 005.7 5.7l1.3-2 4.5 1.5v3a2 2 0 01-2 2A16.5 16.5 0 014.5 5.5a2 2 0 012-2z"/></svg>',
  ),
  document(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9.5 12.5h5M9.5 16h5"/></svg>',
  ),
  upload(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19.5h14"/></svg>',
  ),
  power(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v8"/><path d="M6.6 6.6a7.5 7.5 0 1010.8 0"/></svg>',
  ),
  route(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H16a3.5 3.5 0 000-7H8a3.5 3.5 0 010-7h7.5"/></svg>',
  ),
  wallet(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10.5h18M16.5 15h.01"/></svg>',
  ),
  navigation(
    '<svg viewBox="0 0 24 24" fill="#000"><g transform="rotate(90 12 12)"><path d="M12 2.5l7.5 18-7.5-4-7.5 4z"/></g></svg>',
  ),
  doubleChevron(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l6 6-6 6M13 6l6 6-6 6"/></svg>',
  ),
  wifiOff(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5a14 14 0 0119 0M5.5 12a9.5 9.5 0 0113 0M8.5 15.5a5 5 0 017 0"/><path d="M3 3l18 18"/><circle cx="12" cy="19" r="1.2" fill="#000" stroke="none"/></svg>',
  ),
  lock(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg>',
  ),
  card(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h3"/></svg>',
  ),
  cardOff(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 11.5v-4A2.5 2.5 0 0019 5H5a2.5 2.5 0 00-2.5 2.5v9A2.5 2.5 0 005 19h8"/><path d="M2.5 10h19"/><path d="M16.5 15.5l4 4M20.5 15.5l-4 4"/></svg>',
  ),
  plus(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  ),
  alert(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.5" r="1.1" fill="#000" stroke="none"/></svg>',
  ),
  refund(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5L4.5 11 9 15.5"/><path d="M4.5 11h10a5 5 0 010 10H12"/></svg>',
  ),
  receipt(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3h13v18l-2.2-1.5L14 21l-2-1.5L10 21l-2.3-1.5L5.5 21z"/><path d="M9 8h6M9 12h6"/></svg>',
  ),
  bag(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8.5h14l-1.2 12H6.2z"/><path d="M9 8.5V7a3 3 0 016 0v1.5"/></svg>',
  ),
  sofa(
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3"/><path d="M3 12.5a1.5 1.5 0 013 0V15h12v-2.5a1.5 1.5 0 013 0v6H3z"/><path d="M5.5 18.5V20M18.5 18.5V20"/></svg>',
  ),
  dots(
    '<svg viewBox="0 0 24 24" fill="#000"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>',
  );

  const MovoIcons(this.svg);
  final String svg;
}

/// [MovoIcons] 하나를 한 가지 색으로 그린다. 색을 주지 않으면 주변 글자색을 따른다.
class MovoIcon extends StatelessWidget {
  const MovoIcon(this.icon, {super.key, this.size = 24, this.color});

  final MovoIcons icon;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => SvgPicture.string(
    icon.svg,
    width: size,
    height: size,
    colorFilter: ColorFilter.mode(
      color ?? DefaultTextStyle.of(context).style.color ?? context.colors.text,
      BlendMode.srcIn,
    ),
  );
}
