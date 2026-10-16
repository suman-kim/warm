import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'colors.dart';
import 'icons.dart';

/// 누르는 동안 살짝 흐려지는 터치 영역. 디자인에 물결 효과가 없어 InkWell 대신 쓴다.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool down) {
    if (widget.onTap != null && _down != down) setState(() => _down = down);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: widget.onTap,
    onTapDown: (_) => _set(true),
    onTapUp: (_) => _set(false),
    onTapCancel: () => _set(false),
    child: AnimatedOpacity(
      opacity: _down ? 0.6 : 1,
      duration: const Duration(milliseconds: 90),
      child: widget.child,
    ),
  );
}

/// 워드마크 "mov●". [badge]를 주면 옆에 라임색 꼬리표(라이더 앱의 '라이더')가 붙는다.
class MovoLogo extends StatelessWidget {
  const MovoLogo({super.key, this.size = 26, this.badge});

  final double size;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final dot = size * 0.56;
    final mark = Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text('mov', style: mv(size, 900, ls: -0.05, height: 1)),
        Container(
          width: dot,
          height: dot,
          // 점의 아래쪽을 글자의 기준선에 맞춘다 (줄 높이 1일 때 기준선은 아래에서 0.136em).
          margin: EdgeInsets.only(left: size * 0.04, bottom: size * 0.136),
          decoration: BoxDecoration(
            color: MovoPalette.lime,
            shape: BoxShape.circle,
            // 밝은 바탕에서는 라임 점이 묻히지 않게 잉크색 테를 두른다.
            border: colors.isDark
                ? null
                : Border.all(color: MovoPalette.ink, width: size * 0.11),
          ),
        ),
      ],
    );
    if (badge == null) return mark;
    final large = size >= 30;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: large ? 10 : 8),
        MovoTag(
          badge!,
          background: MovoPalette.lime,
          foreground: MovoPalette.ink,
          fontSize: large ? 13 : 11,
          padding: large
              ? const EdgeInsets.symmetric(horizontal: 9, vertical: 5)
              : const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
          radius: large ? 9 : 7,
        ),
      ],
    );
  }
}

/// 작은 꼬리표 (배차 완료, 만나서 결제, 완료, 취소 등).
class MovoTag extends StatelessWidget {
  const MovoTag(
    this.label, {
    super.key,
    this.background,
    this.foreground,
    this.borderColor,
    this.fontSize = 12,
    this.weight = 800,
    this.padding = const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    this.radius = 8,
    this.leading,
  });

  final String label;
  final Color? background;
  final Color? foreground;
  final Color? borderColor;
  final double fontSize;
  final int weight;
  final EdgeInsets padding;
  final double radius;
  final Widget? leading;

  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(radius),
      border: borderColor == null ? null : Border.all(color: borderColor!),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (leading != null) ...[leading!, const SizedBox(width: 4)],
        Text(
          label,
          style: mv(fontSize, weight, color: foreground, height: 1.2),
        ),
      ],
    ),
  );
}

enum MovoButtonKind {
  /// 화면의 주 행동 (밝은 테마: 잉크색, 어두운 테마: 라임색)
  primary,

  /// 테두리만 있는 보조 행동 (배달 취소, 요청 취소)
  outline,

  /// 카드색 바탕의 보조 행동 (제출 서류 보기)
  surface,

  /// 바탕 없는 글자 버튼 (다른 계정으로 로그인, 오늘 운행 종료)
  text,
}

/// 버튼. 기본 크기는 화면 아래의 주 버튼(높이 58)이다.
class MovoButton extends StatelessWidget {
  const MovoButton(
    this.label, {
    super.key,
    required this.onPressed,
    this.kind = MovoButtonKind.primary,
    this.height = 58,
    this.radius = 18,
    this.fontSize = 17,
    this.weight = 800,
    this.expand = true,
    this.horizontalPadding = 22,
    this.loading = false,
    this.leading,
    this.trailing,
    this.background,
    this.foreground,
  });

  final String label;

  /// null이면 누를 수 없는 상태로 그린다.
  final VoidCallback? onPressed;
  final MovoButtonKind kind;
  final double height;
  final double radius;
  final double fontSize;
  final int weight;

  /// true면 가로로 꽉 채우고, false면 글자 길이에 맞춘다.
  final bool expand;
  final double horizontalPadding;

  /// true면 글자 대신 진행 표시를 보여주고 누를 수 없다.
  final bool loading;
  final Widget? leading;

  /// 주면 글자는 왼쪽, 이것은 오른쪽 끝에 놓인다 (배달 요청하기의 대행료).
  final Widget? trailing;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final enabled = onPressed != null && !loading;
    final (bg, fg, border) = switch (kind) {
      MovoButtonKind.primary => (
        background ??
            (onPressed == null ? colors.primaryDisabled : colors.primary),
        foreground ??
            (onPressed == null ? colors.onPrimaryDisabled : colors.onPrimary),
        null,
      ),
      MovoButtonKind.outline => (
        background,
        foreground ?? colors.text,
        Border.all(color: colors.fieldBorder, width: 1.5),
      ),
      MovoButtonKind.surface => (
        background ?? colors.surface,
        foreground ?? colors.text,
        null,
      ),
      MovoButtonKind.text => (null, foreground ?? colors.textSecondary, null),
    };
    final text = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: mv(fontSize, weight, color: fg, height: 1.2),
    );
    final content = loading
        ? SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.5, color: fg),
          )
        : trailing != null
        ? Row(
            children: [
              Expanded(child: text),
              trailing!,
            ],
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 8)],
              Flexible(child: text),
            ],
          );
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: Pressable(
        onTap: enabled ? onPressed : null,
        child: Container(
          height: height,
          width: expand ? double.infinity : null,
          padding: EdgeInsets.only(
            left: horizontalPadding,
            right: trailing != null ? 10 : horizontalPadding,
          ),
          decoration: BoxDecoration(
            color: bg,
            border: border,
            borderRadius: BorderRadius.circular(radius),
          ),
          child: Center(
            widthFactor: expand ? null : 1,
            child: IconTheme.merge(
              data: IconThemeData(color: fg),
              child: DefaultTextStyle.merge(
                style: TextStyle(color: fg),
                child: content,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 라벨이 칸 안에 들어 있는 입력란.
class MovoField extends StatefulWidget {
  const MovoField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.obscure = false,
    this.revealable = true,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.inputFormatters,
    this.onChanged,
    this.onSubmitted,
    this.focusNode,
    this.autofocus = false,
    this.trailing,
    this.maxLength,
    this.tabular = false,
    this.enabled = true,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;

  /// 비밀번호처럼 가려서 입력한다.
  final bool obscure;

  /// 가린 글자를 잠깐 볼 수 있는 눈 아이콘을 둘지.
  final bool revealable;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final FocusNode? focusNode;
  final bool autofocus;
  final Widget? trailing;
  final int? maxLength;
  final bool tabular;
  final bool enabled;

  @override
  State<MovoField> createState() => _MovoFieldState();
}

class _MovoFieldState extends State<MovoField> {
  late final FocusNode _focus = widget.focusNode ?? FocusNode();
  bool _reveal = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(_onFocus);
  }

  void _onFocus() => setState(() {});

  @override
  void dispose() {
    _focus.removeListener(_onFocus);
    if (widget.focusNode == null) _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final focused = _focus.hasFocus;
    final hidden = widget.obscure && !_reveal;
    final field = TextField(
      controller: widget.controller,
      focusNode: _focus,
      enabled: widget.enabled,
      autofocus: widget.autofocus,
      obscureText: hidden,
      obscuringCharacter: '•',
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      autofillHints: widget.autofillHints,
      inputFormatters: [
        ...?widget.inputFormatters,
        if (widget.maxLength != null)
          LengthLimitingTextInputFormatter(widget.maxLength),
      ],
      onChanged: widget.onChanged,
      onSubmitted: widget.onSubmitted,
      autocorrect: false,
      enableSuggestions: !widget.obscure,
      cursorWidth: 2,
      cursorHeight: 18,
      style: hidden
          ? mv(
              16,
              800,
              color: colors.text,
              height: 1.2,
            ).copyWith(letterSpacing: 3)
          : mv(
              16,
              600,
              color: colors.text,
              height: 1.2,
              tabular: widget.tabular,
            ),
      decoration: InputDecoration.collapsed(
        hintText: widget.hint,
        hintStyle: mv(16, 600, color: colors.placeholder, height: 1.2),
      ),
    );
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.enabled ? _focus.requestFocus : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: focused ? colors.focus : colors.fieldBorder,
            width: focused ? 2 : 1.5,
            strokeAlign: BorderSide.strokeAlignInside,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.label,
                    style: mv(
                      12,
                      700,
                      color: !focused
                          ? colors.textMuted
                          : colors.isDark
                          ? colors.focus
                          : colors.text,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 3),
                  field,
                ],
              ),
            ),
            if (widget.obscure && widget.revealable) ...[
              const SizedBox(width: 12),
              Pressable(
                onTap: () => setState(() => _reveal = !_reveal),
                child: MovoIcon(
                  MovoIcons.eye,
                  size: 22,
                  color: _reveal ? colors.text : colors.textMuted,
                ),
              ),
            ] else if (widget.trailing != null) ...[
              const SizedBox(width: 10),
              widget.trailing!,
            ],
          ],
        ),
      ),
    );
  }
}

/// 라벨과 값을 보여주는, 눌러서 고르는 칸 (입력란과 같은 모양이지만 키보드가 뜨지 않는다).
class MovoSelectBox extends StatelessWidget {
  const MovoSelectBox({
    super.key,
    required this.label,
    required this.value,
    this.placeholder = false,
    this.onTap,
    this.trailing,
    this.height = 56,
    this.tabular = false,
  });

  final String label;
  final String value;

  /// true면 값을 흐리게 그린다 (아직 고르지 않았다).
  final bool placeholder;
  final VoidCallback? onTap;
  final Widget? trailing;
  final double height;
  final bool tabular;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Pressable(
      onTap: onTap,
      child: Container(
        height: height,
        padding: const EdgeInsets.only(left: 16, right: 12),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.fieldBorder, width: 1.5),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: mv(12, 700, color: colors.textMuted, height: 1.25),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: mv(
                      16,
                      placeholder ? 600 : 700,
                      color: placeholder ? colors.placeholder : colors.text,
                      height: 1.2,
                      tabular: tabular,
                    ),
                  ),
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 10), trailing!],
          ],
        ),
      ),
    );
  }
}

/// 고르는 칩 (결제 방식, 날짜, 조리 시간, 목록 필터).
class MovoChip extends StatelessWidget {
  const MovoChip(
    this.label, {
    super.key,
    required this.selected,
    this.onTap,
    this.height = 36,
    this.radius = 12,
    this.horizontalPadding = 12,
    this.selectedBackground,
    this.selectedForeground,
    this.selectedBorder,
    this.background,
    this.outlined = true,
    this.tabular = false,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final double height;
  final double radius;
  final double horizontalPadding;
  final Color? selectedBackground;
  final Color? selectedForeground;
  final Color? selectedBorder;

  /// 고르지 않은 칩의 바탕. 주지 않으면 밝은 테마는 카드색, 어두운 테마는 투명이다.
  final Color? background;

  /// 고르지 않은 칩에 테두리를 그릴지.
  final bool outlined;
  final bool tabular;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final bg = selected
        ? selectedBackground ?? colors.primary
        : background ?? (colors.isDark ? null : colors.surface);
    final fg = selected
        ? selectedForeground ?? colors.onPrimary
        : colors.textSecondary;
    final border = selected
        ? (selectedBorder == null
              ? null
              : Border.all(color: selectedBorder!, width: 1.5))
        : outlined
        ? Border.all(color: colors.fieldBorder, width: colors.isDark ? 1 : 1.5)
        : null;
    return Pressable(
      onTap: onTap,
      child: Container(
        height: height,
        padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
        decoration: BoxDecoration(
          color: bg,
          border: border,
          borderRadius: BorderRadius.circular(radius),
        ),
        // 글자 길이만큼만 차지한다.
        child: Center(
          widthFactor: 1,
          child: Text(
            label,
            style: mv(
              14,
              selected ? 800 : 700,
              color: fg,
              height: 1.2,
              tabular: tabular,
            ),
          ),
        ),
      ),
    );
  }
}

/// 둘 중 하나를 고르는 막대 (지금 바로 / 예약).
class MovoSegmented<T> extends StatelessWidget {
  const MovoSegmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  final Map<T, String> options;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          for (final (index, entry) in options.entries.indexed) ...[
            if (index > 0) const SizedBox(width: 4),
            Expanded(
              child: Pressable(
                onTap: () => onChanged(entry.key),
                child: Container(
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: entry.key == value ? colors.primary : null,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Text(
                    entry.value,
                    style: mv(
                      14,
                      entry.key == value ? 800 : 700,
                      color: entry.key == value
                          ? colors.onPrimary
                          : colors.textMuted,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 카드.
class MovoCard extends StatelessWidget {
  const MovoCard({
    super.key,
    required this.child,
    this.radius = 22,
    this.padding = EdgeInsets.zero,
    this.color,
    this.border,
    this.onTap,
  });

  final Widget child;
  final double radius;
  final EdgeInsets padding;
  final Color? color;
  final BoxBorder? border;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? context.colors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: border,
      ),
      child: child,
    );
    return onTap == null ? card : Pressable(onTap: onTap, child: card);
  }
}

/// 카드 안에 줄을 쌓고 사이에 구분선을 긋는다.
class MovoRows extends StatelessWidget {
  const MovoRows({
    super.key,
    required this.children,
    this.radius = 22,
    this.padding = const EdgeInsets.symmetric(horizontal: 18, vertical: 2),
    this.color,
    this.dividerColor,
  });

  final List<Widget> children;
  final double radius;
  final EdgeInsets padding;
  final Color? color;
  final Color? dividerColor;

  @override
  Widget build(BuildContext context) => MovoCard(
    radius: radius,
    padding: padding,
    color: color,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final (index, child) in children.indexed)
          DecoratedBox(
            decoration: BoxDecoration(
              border: index == children.length - 1
                  ? null
                  : Border(
                      bottom: BorderSide(
                        color: dividerColor ?? context.colors.divider,
                      ),
                    ),
            ),
            child: child,
          ),
      ],
    ),
  );
}

/// 메뉴 한 줄 (내 정보 화면의 항목).
class MovoMenuRow extends StatelessWidget {
  const MovoMenuRow(
    this.label, {
    super.key,
    this.value,
    this.onTap,
    this.trailing,
    this.chevron = true,
    this.muted = false,
    this.height = 52,
  });

  final String label;

  /// 오른쪽에 흐리게 보이는 현재 값 (2곳, 3개 확인됨).
  final String? value;
  final VoidCallback? onTap;

  /// 화살표 대신 놓을 것 (스위치).
  final Widget? trailing;
  final bool chevron;

  /// 덜 눈에 띄게 그린다 (회원 탈퇴).
  final bool muted;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Pressable(
      onTap: onTap,
      child: SizedBox(
        height: height,
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: mv(
                  15,
                  muted ? 600 : 700,
                  color: muted ? colors.textMuted : colors.text,
                ),
              ),
            ),
            if (value != null) ...[
              Text(value!, style: mv(14, 700, color: colors.textMuted)),
              const SizedBox(width: 12),
            ],
            if (trailing != null)
              trailing!
            else if (chevron)
              MovoIcon(
                MovoIcons.chevronRight,
                size: 18,
                color: colors.textMuted,
              ),
          ],
        ),
      ),
    );
  }
}

/// 라벨과 값이 양 끝에 놓이는 한 줄 (배달 상세, 배달 완료의 요약).
class MovoKeyValue extends StatelessWidget {
  const MovoKeyValue(
    this.label,
    this.value, {
    super.key,
    this.verticalPadding = 12,
    this.strong = false,
    this.tabular = false,
  });

  final String label;
  final String value;
  final double verticalPadding;
  final bool strong;
  final bool tabular;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: verticalPadding),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: mv(14, 600, color: context.colors.textMuted)),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: mv(14, strong ? 800 : 700, tabular: tabular),
          ),
        ),
      ],
    ),
  );
}

/// 켜고 끄는 스위치.
class MovoToggle extends StatelessWidget {
  const MovoToggle({super.key, required this.value, this.onChanged});

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      toggled: value,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onChanged == null ? null : () => onChanged!(!value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          width: 46,
          height: 28,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: value ? colors.toggleOn : colors.toggleOff,
            borderRadius: BorderRadius.circular(14),
          ),
          child: AnimatedAlign(
            duration: const Duration(milliseconds: 160),
            curve: Curves.easeOut,
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: value ? colors.toggleKnobOn : colors.toggleKnobOff,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 화면 위의 뒤로 가기와 가운데 제목.
class MovoTopBar extends StatelessWidget {
  const MovoTopBar({super.key, this.title, this.onBack, this.trailing});

  final String? title;

  /// 주지 않으면 이전 화면으로 돌아간다.
  final VoidCallback? onBack;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 12, right: 12, top: 4),
    child: SizedBox(
      height: 44,
      child: Row(
        children: [
          Semantics(
            button: true,
            label: '뒤로 가기',
            excludeSemantics: true,
            child: Pressable(
              onTap: onBack ?? () => Navigator.of(context).maybePop(),
              child: const SizedBox(
                width: 44,
                height: 44,
                child: Center(child: MovoIcon(MovoIcons.back, size: 22)),
              ),
            ),
          ),
          Expanded(
            child: title == null
                ? const SizedBox.shrink()
                : Text(title!, textAlign: TextAlign.center, style: mv(17, 800)),
          ),
          SizedBox(
            width: trailing == null ? 44 : null,
            child: trailing ?? const SizedBox.shrink(),
          ),
        ],
      ),
    ),
  );
}

/// 지도 위에 떠 있는 둥근 뒤로 가기 버튼.
class MovoFloatingBack extends StatelessWidget {
  const MovoFloatingBack({super.key, this.onBack});

  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) => Pressable(
    onTap: onBack ?? () => Navigator.of(context).maybePop(),
    child: Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: context.colors.surface,
        shape: BoxShape.circle,
        boxShadow: const [
          BoxShadow(
            color: Color(0x4D121212),
            blurRadius: 18,
            spreadRadius: -6,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: const Center(child: MovoIcon(MovoIcons.back, size: 20)),
    ),
  );
}

class MovoNavItem {
  const MovoNavItem(this.icon, this.label);

  final MovoIcons icon;
  final String label;
}

/// 화면 아래에 붙박이로 놓는 것(탭 막대, 주 버튼)의 아래 여백 — 시스템 영역(홈 표시줄·내비게이션 바)까지 포함.
///
/// - 시스템 영역이 없으면 [none].
/// - iPhone 홈 표시줄은 영역 아래쪽의 얇은 선이라 영역 자체가 여백이 된다 — 디자인 값(영역 높이) 그대로.
/// - Android 내비게이션 바는 영역 경계에서 바로 시작한다. 그대로 두면 버튼·탭 글자가 바에 붙어
///   겹쳐 보이므로 [androidSystemBarGap]만큼 더 띄운다.
double bottomSafeSpace(BuildContext context, {double none = 20}) {
  final inset = MediaQuery.paddingOf(context).bottom;
  if (inset <= 0) return none;
  final android = Theme.of(context).platform == TargetPlatform.android;
  return inset + (android ? androidSystemBarGap : 0);
}

/// Android 내비게이션 바 위에 두는 틈.
const androidSystemBarGap = 10.0;

/// 화면 아래의 탭 막대.
class MovoBottomNav extends StatelessWidget {
  const MovoBottomNav({
    super.key,
    required this.items,
    required this.index,
    required this.onChanged,
  });

  final List<MovoNavItem> items;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      // 디자인의 86 = 내용 52 + 홈 표시줄 34. 시스템 영역이 없는 기기에서는 내용 아래 10만 둔다.
      height: 52 + bottomSafeSpace(context, none: 10),
      padding: const EdgeInsets.only(top: 10),
      decoration: BoxDecoration(
        color: colors.navBackground,
        border: Border(top: BorderSide(color: colors.navBorder)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (i, item) in items.indexed)
            Expanded(
              child: Semantics(
                selected: i == index,
                button: true,
                label: item.label,
                excludeSemantics: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(i),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      MovoIcon(
                        item.icon,
                        size: 22,
                        color: i == index
                            ? colors.navActiveIcon
                            : colors.textMuted,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.label,
                        style: mv(
                          11,
                          i == index ? 800 : 700,
                          color: i == index ? colors.text : colors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 시트 위쪽의 손잡이.
class MovoSheetHandle extends StatelessWidget {
  const MovoSheetHandle({super.key});

  @override
  Widget build(BuildContext context) => Center(
    child: Container(
      width: 38,
      height: 5,
      decoration: BoxDecoration(
        color: context.colors.isDark
            ? context.colors.separator
            : context.colors.fieldBorder,
        borderRadius: BorderRadius.circular(3),
      ),
    ),
  );
}

/// 지도 위로 올라오는 아래쪽 패널.
class MovoBottomPanel extends StatelessWidget {
  const MovoBottomPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(20, 10, 20, 0),
    this.handle = true,
  });

  final Widget child;
  final EdgeInsets padding;
  final bool handle;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        boxShadow: colors.isDark
            ? null
            : const [
                BoxShadow(
                  color: Color(0x4D121212),
                  blurRadius: 30,
                  spreadRadius: -20,
                  offset: Offset(0, -12),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (handle) ...[const MovoSheetHandle(), const SizedBox(height: 12)],
          Expanded(child: child),
        ],
      ),
    );
  }
}

/// 칸으로 나뉜 진행 막대 (배차 · 픽업 · 도착).
class MovoSegments extends StatelessWidget {
  const MovoSegments({
    super.key,
    required this.total,
    required this.filled,
    this.height = 6,
    this.onColor,
    this.offColor,
  });

  final int total;
  final int filled;
  final double height;
  final Color? onColor;
  final Color? offColor;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (var i = 0; i < total; i++) ...[
        if (i > 0) const SizedBox(width: 4),
        Expanded(
          child: Container(
            height: height,
            decoration: BoxDecoration(
              color: i < filled
                  ? onColor ?? MovoPalette.lime
                  : offColor ?? context.colors.progressOff,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ),
      ],
    ],
  );
}

/// 이름의 첫 글자를 넣은 둥근 프로필.
class MovoAvatar extends StatelessWidget {
  const MovoAvatar(
    this.name, {
    super.key,
    this.size = 48,
    this.background,
    this.foreground,
  });

  final String name;
  final double size;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background ?? colors.avatar,
        shape: BoxShape.circle,
      ),
      child: Text(
        name.isEmpty ? '' : name.characters.first,
        style: mv(size * 0.375, 800, color: foreground ?? colors.onAvatar),
      ),
    );
  }
}

/// 아이콘을 담은 네모 타일 (목록 줄의 왼쪽).
class MovoIconTile extends StatelessWidget {
  const MovoIconTile(
    this.icon, {
    super.key,
    this.size = 40,
    this.radius = 14,
    this.iconSize = 18,
    this.background,
    this.foreground,
    this.circle = false,
  });

  final MovoIcons icon;
  final double size;
  final double radius;
  final double iconSize;
  final Color? background;
  final Color? foreground;
  final bool circle;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: background ?? context.colors.surfaceSunken,
      shape: circle ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: circle ? null : BorderRadius.circular(radius),
    ),
    child: MovoIcon(
      icon,
      size: iconSize,
      color: foreground ?? context.colors.text,
    ),
  );
}

/// 출발지(동그라미)와 도착지(네모)를 구분하는 점.
class MovoWaypointDot extends StatelessWidget {
  const MovoWaypointDot.pickup({super.key, this.size = 10}) : _pickup = true;
  const MovoWaypointDot.dropoff({super.key, this.size = 10}) : _pickup = false;

  final double size;
  final bool _pickup;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    if (colors.isDark) {
      // 어두운 테마: 속이 빈 동그라미와 꽉 찬 네모.
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: _pickup ? null : colors.text,
          shape: _pickup ? BoxShape.circle : BoxShape.rectangle,
          borderRadius: _pickup ? null : BorderRadius.circular(2),
          border: _pickup ? Border.all(color: colors.text, width: 2.5) : null,
        ),
      );
    }
    final ring = size >= 10 ? 3.0 : 2.0;
    return Container(
      width: size + (_pickup ? ring * 2 : 0),
      height: size + (_pickup ? ring * 2 : 0),
      decoration: BoxDecoration(
        color: _pickup ? MovoPalette.lime : MovoPalette.ink,
        shape: _pickup ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: _pickup
            ? null
            : BorderRadius.circular(size >= 10 ? 3 : 2),
        border: _pickup
            ? Border.all(color: MovoPalette.ink, width: ring)
            : null,
      ),
    );
  }
}

/// 잠깐 떴다 사라지는 안내.
void showMovoToast(BuildContext context, String message) {
  final colors = context.colors;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: mv(
            14,
            700,
            color: colors.isDark ? MovoPalette.ink : MovoPalette.white,
            height: 1.45,
          ),
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: colors.isDark ? colors.text : MovoPalette.ink,
        elevation: 0,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        duration: const Duration(seconds: 3),
      ),
    );
}

/// 확인을 받는 아래쪽 시트. 확인을 누르면 true.
Future<bool> showMovoConfirm(
  BuildContext context, {
  required String title,
  String? body,
  required String confirmLabel,
  String cancelLabel = '닫기',
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: context.colors.scrim,
    isScrollControlled: true,
    builder: (context) {
      final colors = context.colors;
      return Container(
        padding: EdgeInsets.fromLTRB(
          24,
          12,
          24,
          MediaQuery.paddingOf(context).bottom + 20,
        ),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const MovoSheetHandle(),
            const SizedBox(height: 24),
            Text(title, style: mv(22, 800, ls: -0.02, height: 1.3)),
            if (body != null) ...[
              const SizedBox(height: 10),
              Text(
                body,
                style: mv(15, 500, color: colors.textMuted, height: 1.6),
              ),
            ],
            const SizedBox(height: 24),
            MovoButton(
              confirmLabel,
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: 6),
            MovoButton(
              cancelLabel,
              kind: MovoButtonKind.text,
              height: 46,
              fontSize: 15,
              weight: 700,
              onPressed: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      );
    },
  );
  return result ?? false;
}
