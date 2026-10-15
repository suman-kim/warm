import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 결제 확인 중. 수락을 누르면 고객 카드 결제가 끝날 때까지 잠깐 보인다.
/// [accept]가 끝나면 배차된 주문(성공) 또는 그 오류(실패)를 들고 닫힌다.
class PayingScreen extends StatefulWidget {
  const PayingScreen({super.key, required this.call, required this.accept});

  final OpenOrder call;
  final Future<Order> Function() accept;

  @override
  State<PayingScreen> createState() => _PayingScreenState();
}

class _PayingScreenState extends State<PayingScreen>
    with SingleTickerProviderStateMixin {
  late final _progress = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..forward();

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    Object result;
    try {
      result = await widget.accept();
    } on Object catch (error) {
      result = error;
    }
    if (mounted) Navigator.of(context).pop(result);
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final call = widget.call;
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: colors.background,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: MovoIconTile(
                    MovoIcons.card,
                    size: 72,
                    radius: 22,
                    iconSize: 30,
                    background: colors.surface,
                    foreground: MovoPalette.lime,
                  ),
                ),
                const SizedBox(height: 24),
                Text('결제 확인 중', style: mv(30, 800, ls: -0.03)),
                const SizedBox(height: 10),
                Text(
                  '고객 카드 결제가 끝나면 배차가 확정돼요. 잠시만 기다려 주세요.',
                  style: mv(14, 500, color: colors.textMuted, height: 1.6),
                ),
                const SizedBox(height: 24),
                AnimatedBuilder(
                  animation: _progress,
                  builder: (context, _) => ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: _progress.value,
                      minHeight: 3,
                      backgroundColor: colors.surfaceMuted,
                      color: MovoPalette.lime,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                MovoCard(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${vehicleLabel(call.vehicleType)} · ${km(call.distanceKm)}',
                        style: mv(12, 700, color: colors.textMuted),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        won(call.fare),
                        style: mv(26, 900, ls: -0.03, tabular: true),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${areaShort(call.pickupArea)} → ${areaShort(call.dropoffArea)}',
                        style: mv(13, 700),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 120),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 배차 안 됨. 고객 카드 결제가 안 돼 이 콜은 취소됐다. 운행은 그대로 켜져 있다.
class PaymentDeclinedScreen extends StatelessWidget {
  const PaymentDeclinedScreen({super.key, required this.call});

  final OpenOrder call;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 90, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MovoIconTile(
                      MovoIcons.cardOff,
                      size: 72,
                      radius: 22,
                      iconSize: 30,
                      background: colors.surface,
                      foreground: MovoPalette.dangerOnNight,
                    ),
                    const SizedBox(height: 24),
                    Text('배차되지 않았어요', style: mv(28, 800, ls: -0.03)),
                    const SizedBox(height: 10),
                    Text(
                      '고객 카드 결제가 안 돼 이 콜은 취소됐어요. 운행은 계속 켜져 있어요.',
                      style: mv(14, 500, color: colors.textMuted, height: 1.6),
                    ),
                    const SizedBox(height: 24),
                    MovoRows(
                      children: [
                        MovoKeyValue(
                          '경로',
                          '${areaShort(call.pickupArea)} → ${areaShort(call.dropoffArea)}',
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '요금',
                                  style: mv(14, 600, color: colors.textMuted),
                                ),
                              ),
                              Text(
                                won(call.fare),
                                style: mv(
                                  14,
                                  700,
                                  color: colors.textMuted,
                                  tabular: true,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            MovoBottomBar(
              child: MovoButton(
                '콜 목록으로',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
