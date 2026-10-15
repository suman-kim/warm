import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movo_ui/movo_ui.dart';

/// 화면 아래 시스템 영역(Android 내비게이션 바, iPhone 홈 인디케이터)에 글자·아이콘·버튼이
/// 들어가 있거나 [minGap]보다 가까이 붙어 있으면 실패한다. 바탕색은 그 아래까지 깔려도 되지만,
/// 읽거나 누를 것은 그 위에 떨어져 있어야 한다 — 붙어 있으면 Android 내비게이션 바와 겹쳐 보인다.
///
/// - 고정된 요소: 지금 자리가 시스템 영역에 걸리면 문제다.
/// - 세로로 스크롤하는 내용: 끝까지 내렸을 때 마지막 내용이 시스템 영역에 걸리면 문제다
///   (스크롤 도중에 그 아래로 지나가는 것은 괜찮다). 확인한 뒤 원래 위치로 되돌린다.
/// - 맨 위 화면(라우트)만 본다 — 시트·대화상자 뒤에 깔린 화면은 보지 않는다.
///
/// `MOVO_SYSTEM_BAR_AUDIT=report`로 돌리면 실패하는 대신 찾은 것을 출력한다 (한꺼번에 조사할 때).
Future<void> expectClearOfSystemBars(WidgetTester tester, String where) async {
  final problems = await findSystemBarOverlaps(tester);
  if (problems.isEmpty) return;
  final message = '[$where] 시스템 영역과 겹쳐요:\n  ${problems.join('\n  ')}';
  if (Platform.environment['MOVO_SYSTEM_BAR_AUDIT'] == 'report') {
    // ignore: avoid_print
    print('SYSTEM-BAR $message');
  } else {
    fail(message);
  }
}

/// 시스템 영역에 걸린 글자·아이콘 ("내용 @ 위치").
Future<List<String>> findSystemBarOverlaps(WidgetTester tester) async {
  final view = tester.view;
  final screen = view.physicalSize / view.devicePixelRatio;
  final inset = view.padding.bottom / view.devicePixelRatio;
  if (inset <= 0) return const [];
  // 가장자리 반올림 오차는 넘어간다.
  final limit = screen.height - inset - minGap + 0.5;
  final problems = <String>{};

  void check(Iterable<Element> elements) {
    for (final element in elements) {
      if (!_onTopRoute(element)) continue;
      final box = element.renderObject;
      if (box is! RenderBox || !box.attached || !box.hasSize) continue;
      if (box.size.isEmpty) continue;
      final rect = box.localToGlobal(Offset.zero) & box.size;
      // 화면 밖(옆 페이지, 아래로 벗어난 것)은 보이지 않는다.
      if (rect.right <= 0 || rect.left >= screen.width) continue;
      if (rect.top >= screen.height || rect.bottom <= limit) continue;
      if (_clippedAway(box, rect, limit)) continue;
      problems.add('${_describe(element)} @ ${_short(rect)}');
    }
  }

  Iterable<Element> visuals() => [
    ...find.byType(RichText).evaluate(),
    ...find.byType(MovoIcon).evaluate(),
    // 버튼은 글자가 가운데 있어 테두리가 붙어 있어도 글자만으로는 드러나지 않는다.
    ...find.byType(MovoButton).evaluate(),
  ];

  // 1) 스크롤 밖의 고정된 요소.
  check(visuals().where((element) => _verticalScrollable(element) == null));

  // 2) 세로 스크롤 — 바깥쪽 스크롤만 끝까지 내려 본다 (안쪽 것은 바깥 것을 따라 움직인다).
  final scrollables = find
      .byType(Scrollable)
      .evaluate()
      .whereType<StatefulElement>()
      .where((element) {
        final state = element.state as ScrollableState;
        return axisDirectionToAxis(state.axisDirection) == Axis.vertical &&
            _onTopRoute(element) &&
            _verticalScrollable(element) == null;
      })
      .toList();
  for (final element in scrollables) {
    final position = (element.state as ScrollableState).position;
    if (!position.hasContentDimensions) continue;
    final original = position.pixels;
    // 내용을 그때그때 만드는 목록은 끝 위치가 어림값이라, 끝으로 가서 그려 보면 길이가 바뀐다 —
    // 끝 위치가 더 바뀌지 않을 때까지 다시 간다.
    for (var i = 0; i < 6; i++) {
      final end = position.maxScrollExtent;
      if (position.pixels != end) position.jumpTo(end);
      await tester.pump();
      if (position.maxScrollExtent == end && position.pixels == end) break;
    }
    check(
      visuals().where(
        (visual) => visual == element || _isDescendant(visual, element),
      ),
    );
    if (position.pixels != original) {
      position.jumpTo(original);
      await tester.pump();
    }
  }
  return problems.toList();
}

/// 이 요소를 담은 가장 가까운 세로 스크롤 (없으면 null).
StatefulElement? _verticalScrollable(Element element) {
  StatefulElement? found;
  element.visitAncestorElements((ancestor) {
    if (ancestor is StatefulElement && ancestor.state is ScrollableState) {
      final state = ancestor.state as ScrollableState;
      if (axisDirectionToAxis(state.axisDirection) == Axis.vertical) {
        found = ancestor;
        return false;
      }
    }
    return true;
  });
  return found;
}

bool _isDescendant(Element element, Element ancestor) {
  var result = false;
  element.visitAncestorElements((each) {
    if (each == ancestor) {
      result = true;
      return false;
    }
    return true;
  });
  return result;
}

/// 맨 위 화면(라우트)에 있는지. 라우트 밖(앱 전체를 덮는 것)도 본다.
bool _onTopRoute(Element element) {
  final route = ModalRoute.of(element);
  return route == null || route.isCurrent;
}

/// 조상이 잘라 내서(스크롤 영역 밖 등) 시스템 영역 안의 부분이 보이지 않는지.
bool _clippedAway(RenderBox box, Rect rect, double limit) {
  RenderObject? node = box.parent;
  while (node != null) {
    if (node is RenderBox &&
        node.hasSize &&
        (node is RenderClipRect ||
            node is RenderClipRRect ||
            node is RenderViewportBase)) {
      final clip = node.localToGlobal(Offset.zero) & node.size;
      if (clip.bottom <= limit || !clip.overlaps(rect)) return true;
    }
    node = node.parent;
  }
  return false;
}

/// 시스템 영역과 최소한 이만큼 떨어져야 한다 (논리 픽셀).
const minGap = 4.0;

String _describe(Element element) {
  final widget = element.widget;
  if (widget is RichText) {
    final text = widget.text.toPlainText().replaceAll('\n', ' ');
    return '글자 "${text.length > 30 ? '${text.substring(0, 30)}…' : text}"';
  }
  if (widget is MovoIcon) return '아이콘 ${widget.icon.name}';
  if (widget is MovoButton) return '버튼 "${widget.label}"';
  return widget.runtimeType.toString();
}

String _short(Rect rect) =>
    'y ${rect.top.toStringAsFixed(0)}~${rect.bottom.toStringAsFixed(0)}';
