import 'package:flutter/material.dart';

import 'colors.dart';
import 'icons.dart';

/// 밀어서 확인하는 버튼 (밀어서 픽업 완료). 실수로 눌리지 않게 끝까지 밀어야 한다.
class MovoSlideToConfirm extends StatefulWidget {
  const MovoSlideToConfirm({
    super.key,
    required this.label,
    required this.onConfirmed,
    this.busy = false,
  });

  final String label;
  final VoidCallback onConfirmed;

  /// 처리 중이면 손잡이 대신 진행 표시를 보여주고 밀 수 없다.
  final bool busy;

  @override
  State<MovoSlideToConfirm> createState() => _MovoSlideToConfirmState();
}

class _MovoSlideToConfirmState extends State<MovoSlideToConfirm> {
  static const _height = 64.0;
  static const _knob = 54.0;
  static const _inset = 5.0;

  double _drag = 0;
  bool _settling = false;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: widget.label,
    onTap: widget.busy ? null : widget.onConfirmed,
    excludeSemantics: true,
    child: LayoutBuilder(
      builder: (context, constraints) {
        final travel = constraints.maxWidth - _knob - _inset * 2;
        return Container(
          height: _height,
          decoration: BoxDecoration(
            color: MovoPalette.lime,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Stack(
            alignment: Alignment.centerLeft,
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 56),
                child: Center(
                  child: Opacity(
                    opacity: travel <= 0
                        ? 1
                        : (1 - _drag / travel * 1.4).clamp(0, 1).toDouble(),
                    child: Text(
                      widget.label,
                      style: mv(17, 800, color: MovoPalette.ink),
                    ),
                  ),
                ),
              ),
              AnimatedPositioned(
                duration: _settling
                    ? const Duration(milliseconds: 180)
                    : Duration.zero,
                curve: Curves.easeOut,
                left: _inset + _drag,
                top: _inset,
                child: GestureDetector(
                  onHorizontalDragUpdate: widget.busy
                      ? null
                      : (details) => setState(() {
                          _settling = false;
                          _drag = (_drag + details.delta.dx)
                              .clamp(0, travel)
                              .toDouble();
                        }),
                  onHorizontalDragEnd: widget.busy
                      ? null
                      : (_) {
                          final done = _drag >= travel * 0.85;
                          setState(() {
                            _settling = true;
                            _drag = 0;
                          });
                          if (done) widget.onConfirmed();
                        },
                  child: Container(
                    width: _knob,
                    height: _knob,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: MovoPalette.ink,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: widget.busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: MovoPalette.lime,
                            ),
                          )
                        : const MovoIcon(
                            MovoIcons.doubleChevron,
                            size: 22,
                            color: MovoPalette.lime,
                          ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    ),
  );
}
