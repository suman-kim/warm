import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../delivery/rider_format.dart';

/// 새 콜. 라임 화면 가득 가게·경로·라이더 몫·받을 돈을 보여 주고 15초 동안 기다린다.
/// 수락하면 true, 넘기거나 시간이 지나면 false로 닫힌다.
class NewCallScreen extends StatefulWidget {
  const NewCallScreen({super.key, required this.call, this.full = false});

  final OpenOrder call;

  /// 이미 3건을 맡고 있어 수락할 수 없는지.
  final bool full;

  @override
  State<NewCallScreen> createState() => _NewCallScreenState();
}

class _NewCallScreenState extends State<NewCallScreen> {
  static const _seconds = 15;
  late final DateTime _end = DateTime.now().add(
    const Duration(seconds: _seconds),
  );
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    HapticFeedback.heavyImpact();
    _timer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (!mounted) return;
      if (DateTime.now().isAfter(_end)) {
        _timer?.cancel();
        Navigator.of(context).maybePop(false);
      } else {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final call = widget.call;
    final delivery = call.storeDelivery;
    final earning = call.earning;
    final leftMs = _end
        .difference(DateTime.now())
        .inMilliseconds
        .clamp(0, _seconds * 1000);
    final collects = delivery.doorPayment.collectsAtDoor;
    const ink = MovoPalette.ink;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: MovoPalette.lime,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const MovoIcon(MovoIcons.motorcycle, size: 18, color: ink),
                    const SizedBox(width: 6),
                    Text('새 콜', style: mv(14, 800, color: ink)),
                    const Spacer(),
                    Text(
                      '${(leftMs / 1000).ceil()}초',
                      style: mv(14, 800, color: ink, tabular: true),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: leftMs / (_seconds * 1000),
                    minHeight: 5,
                    color: ink,
                    backgroundColor: const Color(0x26121212),
                  ),
                ),
                const SizedBox(height: 20),
                Text(delivery.storeName, style: mv(15, 800, color: ink)),
                const SizedBox(height: 4),
                _InkRoute(
                  from: areaShort(call.pickupArea),
                  to: areaShort(call.dropoffArea),
                ),
                const SizedBox(height: 6),
                Text(
                  [
                    km(call.distanceKm),
                    readyText(delivery.readyAt) +
                        (delivery.readyAt == null
                            ? ''
                            : ' (${ampm(delivery.readyAt!)})'),
                  ].join(' · '),
                  style: mv(14, 700, color: ink, tabular: true),
                ),
                const SizedBox(height: 18),
                Text('라이더 몫', style: mv(13, 700, color: ink)),
                Text(
                  won(earning),
                  style: mv(48, 800, ls: -0.03, color: ink, tabular: true),
                ),
                Text(
                  '대행료 ${won(call.fare)}에서 수수료 '
                  '${commissionPercentOf(call.fare, earning)}%를 뺐어요',
                  style: mv(13, 700, color: ink),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: ink,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      MovoIconTile(
                        collects
                            ? (delivery.doorPayment == DoorPayment.card
                                  ? MovoIcons.card
                                  : MovoIcons.cash)
                            : MovoIcons.check,
                        size: 44,
                        radius: 14,
                        iconSize: 20,
                        background: const Color(0xFF26292D),
                        foreground: MovoPalette.lime,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '음식값',
                              style: mv(
                                12,
                                700,
                                color: const Color(0xFF8E9196),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              collectLine(
                                delivery.doorPayment,
                                delivery.foodAmount,
                              ),
                              style: mv(
                                16,
                                800,
                                tabular: true,
                                color: collects
                                    ? MovoPalette.lime
                                    : MovoPalette.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                if (widget.full)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      '동시에 3건까지 맡을 수 있어요. 진행 중인 배달을 먼저 끝내 주세요.',
                      textAlign: TextAlign.center,
                      style: mv(13, 700, color: ink),
                    ),
                  ),
                Opacity(
                  opacity: widget.full ? 0.35 : 1,
                  child: MovoButton(
                    '수락하기',
                    background: ink,
                    foreground: MovoPalette.white,
                    onPressed: widget.full
                        ? null
                        : () => Navigator.of(context).pop(true),
                  ),
                ),
                const SizedBox(height: 4),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text('넘기기', style: mv(15, 800, color: ink)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 잉크색 큰 경로 (라임 바탕 위).
class _InkRoute extends StatelessWidget {
  const _InkRoute({required this.from, required this.to});

  final String from;
  final String to;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Flexible(
        child: Text(
          from,
          style: mv(32, 800, ls: -0.03, color: MovoPalette.ink),
        ),
      ),
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 8),
        child: MovoIcon(
          MovoIcons.chevronRight,
          size: 26,
          color: MovoPalette.ink,
        ),
      ),
      Flexible(
        child: Text(to, style: mv(32, 800, ls: -0.03, color: MovoPalette.ink)),
      ),
    ],
  );
}
