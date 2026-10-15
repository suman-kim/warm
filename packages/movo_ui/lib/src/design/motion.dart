import 'package:flutter/material.dart';

import 'colors.dart';

/// 지금 진행 중임을 알리는 깜빡이는 점 (배차 요청 중, 배송 중, 운행 중).
class MovoLiveDot extends StatefulWidget {
  const MovoLiveDot({super.key, this.ring = true});

  /// 점 둘레에 잉크색 테를 두를지. 어두운 바탕에서는 빼는 편이 낫다.
  final bool ring;

  @override
  State<MovoLiveDot> createState() => _MovoLiveDotState();
}

class _MovoLiveDotState extends State<MovoLiveDot>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 8,
    height: 8,
    child: Stack(
      clipBehavior: Clip.none,
      children: [
        AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final t = Curves.easeOut.transform(_controller.value);
            return Transform.scale(
              scale: 1 + 1.8 * t,
              child: Opacity(opacity: 0.6 * (1 - t), child: child),
            );
          },
          child: const DecoratedBox(
            decoration: BoxDecoration(
              color: MovoPalette.lime,
              shape: BoxShape.circle,
            ),
            child: SizedBox.expand(),
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: MovoPalette.lime,
            shape: BoxShape.circle,
            boxShadow: widget.ring
                ? const [BoxShadow(color: MovoPalette.ink, spreadRadius: 1.5)]
                : null,
          ),
          child: const SizedBox.expand(),
        ),
      ],
    ),
  );
}

/// 한 점에서 퍼져 나가는 고리 세 개 (기사 찾는 중, 기사 위치, 콜 대기).
/// 크기가 0인 위젯이라, 고리의 중심에 놓으면 된다.
class MovoPulse extends StatefulWidget {
  const MovoPulse({
    super.key,
    required this.size,
    required this.color,
    this.border,
    this.duration = const Duration(milliseconds: 2700),
  });

  /// 기사 찾는 중 — 지도 위의 출발지에서 퍼진다.
  const MovoPulse.search({super.key})
    : size = 230,
      color = const Color(0x73C6F432),
      border = const BorderSide(color: Color(0x33121212), width: 1.5),
      duration = const Duration(milliseconds: 2700);

  /// 배송 중 — 기사 위치에서 퍼진다.
  const MovoPulse.ping({super.key})
    : size = 110,
      color = const Color(0x8CC6F432),
      border = null,
      duration = const Duration(milliseconds: 2400);

  /// 콜 대기 — 기사 홈의 레이더.
  const MovoPulse.radar({super.key})
    : size = 210,
      color = const Color(0x0FC6F432),
      border = const BorderSide(color: Color(0x99C6F432), width: 1.5),
      duration = const Duration(milliseconds: 2700);

  final double size;
  final Color color;
  final BorderSide? border;
  final Duration duration;

  @override
  State<MovoPulse> createState() => _MovoPulseState();
}

class _MovoPulseState extends State<MovoPulse>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  )..repeat();

  static const _curve = Cubic(0.2, 0.6, 0.35, 1);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 0,
    height: 0,
    child: OverflowBox(
      maxWidth: widget.size,
      maxHeight: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => Stack(
          children: [
            for (var i = 0; i < 3; i++)
              Builder(
                builder: (context) {
                  final t = _curve.transform((_controller.value + i / 3) % 1);
                  return Opacity(
                    opacity: 1 - t,
                    child: Transform.scale(
                      scale: 0.15 + 0.85 * t,
                      child: Container(
                        width: widget.size,
                        height: widget.size,
                        decoration: BoxDecoration(
                          color: widget.color,
                          shape: BoxShape.circle,
                          border: widget.border == null
                              ? null
                              : Border.fromBorderSide(widget.border!),
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    ),
  );
}

/// 좌우로 흐르는 가는 진행 막대 (기사 찾는 중).
class MovoShimmerBar extends StatefulWidget {
  const MovoShimmerBar({super.key});

  @override
  State<MovoShimmerBar> createState() => _MovoShimmerBarState();
}

class _MovoShimmerBarState extends State<MovoShimmerBar>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: Container(
        height: 4,
        color: colors.progressOff,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final t = Curves.easeInOut.transform(_controller.value);
            // 막대가 왼쪽 밖(-40%)에서 오른쪽 밖(100%)까지 흐른다.
            return FractionallySizedBox(
              alignment: Alignment(-1 + 2 * (-0.4 + 1.4 * t) / 0.6, 0),
              widthFactor: 0.4,
              child: child,
            );
          },
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.text,
              borderRadius: BorderRadius.circular(4),
            ),
            child: const SizedBox.expand(),
          ),
        ),
      ),
    );
  }
}

/// 남은 시간을 고리로 보여주는 카운트다운 (새 콜).
class MovoCountdownRing extends StatelessWidget {
  const MovoCountdownRing({
    super.key,
    required this.remaining,
    required this.total,
    this.size = 48,
  });

  final int remaining;
  final int total;
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size,
    child: Stack(
      alignment: Alignment.center,
      children: [
        SizedBox(
          width: size - 8,
          height: size - 8,
          child: CircularProgressIndicator(
            value: total == 0 ? 0 : remaining / total,
            strokeWidth: 4,
            strokeCap: StrokeCap.round,
            color: MovoPalette.ink,
            backgroundColor: const Color(0x26121212),
          ),
        ),
        Text('$remaining', style: mv(15, 900, color: MovoPalette.ink)),
      ],
    ),
  );
}
