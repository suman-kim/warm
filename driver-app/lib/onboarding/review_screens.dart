import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import 'document_rows.dart';
import 'vehicle_docs_screen.dart';

/// 심사 화면의 뼈대: 큰 아이콘, 제목, 설명, 본문, 아래 버튼.
class _ReviewPage extends StatelessWidget {
  const _ReviewPage({
    required this.icon,
    required this.iconBackground,
    required this.iconColor,
    required this.title,
    required this.body,
    required this.children,
    required this.bottom,
  });

  final MovoIcons icon;
  final Color iconBackground;
  final Color iconColor;
  final String title;
  final String body;
  final List<Widget> children;
  final Widget bottom;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 40, 20, 24),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: MovoIconTile(
                      icon,
                      size: 68,
                      radius: 22,
                      iconSize: 28,
                      background: iconBackground,
                      foreground: iconColor,
                    ),
                  ),
                  const SizedBox(height: 22),
                  Text(title, style: mv(28, 800, ls: -0.035, height: 1.3)),
                  const SizedBox(height: 10),
                  Text(
                    body,
                    style: mv(14, 600, color: colors.textMuted, height: 1.6),
                  ),
                  const SizedBox(height: 22),
                  ...children,
                ],
              ),
            ),
            MovoBottomBar(child: bottom),
          ],
        ),
      ),
    );
  }
}

/// 심사 대기. 제출한 서류와 차량번호를 보여 주고, 승인됐는지 10초마다 다시 본다.
class ReviewPendingScreen extends StatefulWidget {
  const ReviewPendingScreen({
    super.key,
    required this.controller,
    required this.driver,
  });

  final DriverController controller;
  final Driver driver;

  @override
  State<ReviewPendingScreen> createState() => _ReviewPendingScreenState();
}

class _ReviewPendingScreenState extends State<ReviewPendingScreen> {
  late final Timer _timer = Timer.periodic(
    const Duration(seconds: 10),
    (_) => widget.controller.refresh(),
  );

  @override
  void initState() {
    super.initState();
    _timer;
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  Future<void> _logout() async {
    final confirmed = await showMovoConfirm(
      context,
      title: '로그아웃할까요?',
      confirmLabel: '로그아웃',
    );
    if (confirmed && mounted) await context.session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return _ReviewPage(
      icon: MovoIcons.clock,
      iconBackground: MovoPalette.lime,
      iconColor: MovoPalette.ink,
      title: '심사하고 있어요',
      body: '승인되면 알려 드릴게요. 승인되면 바로 운행을 켤 수 있어요.',
      bottom: MovoButton(
        '로그아웃',
        kind: MovoButtonKind.surface,
        fontSize: 16,
        onPressed: _logout,
      ),
      children: [
        MovoCard(
          radius: 22,
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('제출한 서류', style: mv(15, 800)),
              const SizedBox(height: 6),
              for (final type in riderDocuments)
                MovoKeyValue(documentLabel(type), '제출함'),
              MovoKeyValue(
                '차량번호',
                plate(widget.driver.vehicleNumber),
                tabular: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          '서류를 잘못 올렸다면 고객센터 1600-0000으로 알려 주세요.',
          style: mv(12, 600, color: colors.textMuted),
        ),
      ],
    );
  }
}

/// 반려. 반려된 서류와 사유를 보여 주고, [서류 다시 올리기]로 서류 화면에서 다시 신청한다.
class ReviewRejectedScreen extends StatelessWidget {
  const ReviewRejectedScreen({
    super.key,
    required this.controller,
    required this.driver,
  });

  final DriverController controller;
  final Driver driver;

  Future<void> _retry(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            VehicleDocsScreen(controller: controller, driver: driver),
      ),
    );
    await controller.refresh();
  }

  @override
  Widget build(BuildContext context) => _ReviewPage(
    icon: MovoIcons.alert,
    iconBackground: MovoPalette.dangerNight,
    iconColor: MovoPalette.dangerOnNight,
    title: '서류를 다시\n올려 주세요',
    body: '아래 서류를 확인하고 다시 신청해 주세요.',
    bottom: MovoButton('서류 다시 올리기', onPressed: () => _retry(context)),
    children: [
      MovoAsync<List<DriverDocument>>(
        load: context.api.drivers.documents,
        builder: (context, documents) {
          final rejected = [
            for (final d in documents)
              if (d.status == DriverDocumentStatus.rejected) d,
          ];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (rejected.isEmpty)
                _Reason(
                  title: '반려 사유',
                  body: driver.rejectionReason ?? '사유가 적혀 있지 않아요.',
                )
              else
                for (final d in rejected) ...[
                  _Reason(
                    title: documentLabel(d.type),
                    body:
                        d.rejectionReason ??
                        driver.rejectionReason ??
                        documentHint(d.type),
                  ),
                  const SizedBox(height: 10),
                ],
            ],
          );
        },
      ),
    ],
  );
}

class _Reason extends StatelessWidget {
  const _Reason({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
    decoration: BoxDecoration(
      color: MovoPalette.dangerNight,
      borderRadius: BorderRadius.circular(22),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: mv(12, 800, color: MovoPalette.dangerOnNight)),
        const SizedBox(height: 8),
        Text(body, style: mv(15, 700, height: 1.55)),
      ],
    ),
  );
}
