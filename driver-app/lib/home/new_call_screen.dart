import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 새 콜. 요금과 구간을 크게 보여주고 수락할지 묻는다.
/// 상세 주소와 연락처는 수락한 뒤에 보인다. 수락하면 true를 돌려주며 닫힌다.
class NewCallScreen extends StatefulWidget {
  const NewCallScreen({super.key, required this.call, this.countdown = false});

  final OpenOrder call;

  /// 방금 들어온 콜이면 남은 시간을 세고, 시간이 다 되면 닫는다.
  final bool countdown;

  @override
  State<NewCallScreen> createState() => _NewCallScreenState();
}

class _NewCallScreenState extends State<NewCallScreen> {
  static const _seconds = 15;
  int _left = _seconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (widget.countdown) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (_left <= 1) {
          Navigator.of(context).pop(false);
        } else {
          setState(() => _left--);
        }
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final call = widget.call;
    const ink = MovoPalette.ink;
    final fromMe = call.distanceFromMeKm;
    return Scaffold(
      backgroundColor: context.colors.background,
      body: SafeArea(
        minimum: const EdgeInsets.only(bottom: 16),
        child: Container(
          margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: MovoPalette.lime,
            borderRadius: BorderRadius.circular(36),
          ),
          child: DefaultTextStyle.merge(
            style: const TextStyle(color: ink),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const MovoTag(
                      '새 배송 요청',
                      background: ink,
                      foreground: MovoPalette.lime,
                      fontSize: 13,
                      padding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      radius: 12,
                    ),
                    if (widget.countdown)
                      MovoCountdownRing(remaining: _left, total: _seconds)
                    else
                      const SizedBox(height: 48),
                  ],
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          '${vehicleLabel(call.vehicleType)} · ${serviceLabel(call.serviceType)}',
                          style: mv(15, 700),
                        ),
                        const SizedBox(height: 2),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            won(call.fare),
                            style: mv(
                              54,
                              900,
                              ls: -0.045,
                              height: 1.1,
                              tabular: true,
                            ),
                          ),
                        ),
                        if (call.fare > call.baseFare) ...[
                          const SizedBox(height: 2),
                          Text(
                            '기본 ${won(call.baseFare)} + 추가 ${won(call.fare - call.baseFare)} 포함',
                            style: mv(14, 700),
                          ),
                        ],
                        const SizedBox(height: 16),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(22),
                          child: SizedBox(
                            height: 128,
                            child: MovoMap(
                              dark: true,
                              zoom: 0.33,
                              lineWidth: 4,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 70,
                                vertical: 30,
                              ),
                              route: [call.pickup, call.dropoff],
                              markers: [
                                MovoMapMarker(
                                  call.pickup,
                                  Container(
                                    width: 12,
                                    height: 12,
                                    decoration: BoxDecoration(
                                      color: ink,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: MovoPalette.lime,
                                        width: 3,
                                      ),
                                    ),
                                  ),
                                ),
                                MovoMapMarker(
                                  call.dropoff,
                                  Container(
                                    width: 11,
                                    height: 11,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF2F2EE),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 16,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0x14121212),
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Column(
                            children: [
                              IntrinsicHeight(
                                child: Row(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    SizedBox(
                                      width: 14,
                                      child: Column(
                                        children: [
                                          const SizedBox(height: 5),
                                          Container(
                                            width: 12,
                                            height: 12,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: ink,
                                                width: 3,
                                              ),
                                            ),
                                          ),
                                          const Expanded(child: _Dashes()),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: 12,
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              fromMe == null
                                                  ? '픽업'
                                                  : '픽업 · 내 위치에서 ${km(fromMe)}',
                                              style: mv(12, 700),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              call.pickupArea,
                                              style: mv(19, 800, ls: -0.02),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(
                                    width: 14,
                                    child: Padding(
                                      padding: const EdgeInsets.only(top: 5),
                                      child: Center(
                                        child: Container(
                                          width: 12,
                                          height: 12,
                                          decoration: BoxDecoration(
                                            color: ink,
                                            borderRadius: BorderRadius.circular(
                                              3,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '도착 · 총 ${km(call.distanceKm)}',
                                          style: mv(12, 700),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          call.dropoffArea,
                                          style: mv(19, 800, ls: -0.02),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Row(
                            children: [
                              _Fact('예상 시간', '${call.durationMinutes}분'),
                              _Fact('물품', cargoSummary(call.cargo)),
                              _Fact('무게', '약 ${kg(call.cargo.weightKg)}'),
                            ],
                          ),
                        ),
                        if (callAddOns(call).isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            decoration: BoxDecoration(
                              color: const Color(0x14121212),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Column(
                              children: [
                                for (final (index, line) in callAddOns(
                                  call,
                                ).indexed)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                    decoration: BoxDecoration(
                                      border: index == 0
                                          ? null
                                          : const Border(
                                              top: BorderSide(
                                                color: Color(0x1F121212),
                                              ),
                                            ),
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            line.label,
                                            style: mv(14, 700),
                                          ),
                                        ),
                                        Text(
                                          line.amountText,
                                          style: mv(15, 800, tabular: true),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  call.scheduledPickupAt == null
                      ? '가장 먼저 수락한 기사님에게 배차돼요'
                      : '예약 픽업 · ${monthDayClock(call.scheduledPickupAt!)}',
                  textAlign: TextAlign.center,
                  style: mv(13, 700),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: MovoButton(
                        '거절',
                        onPressed: () => Navigator.of(context).pop(false),
                        height: 60,
                        radius: 20,
                        background: const Color(0x1A121212),
                        foreground: ink,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: MovoButton(
                        '수락하기',
                        onPressed: () => Navigator.of(context).pop(true),
                        height: 60,
                        radius: 20,
                        fontSize: 19,
                        background: ink,
                        foreground: MovoPalette.white,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: mv(12, 700)),
        const SizedBox(height: 3),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: mv(18, 900),
        ),
      ],
    ),
  );
}

/// 픽업지와 도착지를 잇는 세로 점선.
class _Dashes extends StatelessWidget {
  const _Dashes();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: CustomPaint(painter: _DashPainter(), size: const Size(2, 22)),
  );
}

class _DashPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = MovoPalette.ink
      ..strokeWidth = 2;
    for (var y = 0.0; y < size.height; y += 7) {
      canvas.drawLine(
        Offset(size.width / 2, y),
        Offset(size.width / 2, (y + 4).clamp(0, size.height).toDouble()),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_DashPainter oldDelegate) => false;
}

/// 고객이 고른 운반 도움과 계단 — 기본 요금에 더해진 항목.
List<FareLine> callAddOns(OpenOrder call) => [
  if (call.helpFee > 0)
    FareLine('운반 도움 · ${loadingHelpLabel(call.loadingHelp)}', call.helpFee),
  if (call.stairFee > 0)
    FareLine(
      '계단 · ${stairsLabel(call.pickupAccess, call.dropoffAccess)}',
      call.stairFee,
    ),
];
