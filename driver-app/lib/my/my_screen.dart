import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import '../onboarding/document_rows.dart';
import 'account_screens.dart';

typedef _MyData = ({
  List<DriverDocument> documents,
  SettlementAccount? account,
  bool pushEnabled,
});

/// 마이. 내 정보, 서류, 정산 계좌, 알림, 공지·고객센터, 로그아웃과 탈퇴.
class DriverMyScreen extends StatefulWidget {
  const DriverMyScreen({
    super.key,
    required this.controller,
    required this.reload,
  });

  final DriverController controller;
  final MovoAsyncController reload;

  @override
  State<DriverMyScreen> createState() => _DriverMyScreenState();
}

class _DriverMyScreenState extends State<DriverMyScreen> {
  Future<_MyData> _load() async {
    final api = context.api;
    final (documents, account, push) = await (
      api.drivers.documents(),
      api.drivers.settlementAccount(),
      api.notifications.isPushEnabled(),
    ).wait;
    return (documents: documents, account: account, pushEnabled: push);
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => screen));
    widget.reload.reload();
  }

  Future<void> _togglePush(bool enabled) async {
    final api = context.api;
    final done = await runAction(
      context,
      () => api.notifications.setPushEnabled(!enabled),
    );
    if (!mounted) return;
    if (done != null) showMovoToast(context, enabled ? '알림을 껐어요' : '알림을 켰어요');
    widget.reload.reload();
  }

  Future<void> _logout() async {
    final confirmed = await showMovoConfirm(
      context,
      title: '로그아웃할까요?',
      body: widget.controller.driver?.available ?? false
          ? '운행 중이에요. 로그아웃해도 운행은 꺼지지 않으니, 먼저 운행을 종료해 주세요.'
          : null,
      confirmLabel: '로그아웃',
    );
    if (!confirmed || !mounted) return;
    await context.session.logout();
  }

  String _documentsLabel(List<DriverDocument> documents) {
    if (documents.any((d) => d.status == DriverDocumentStatus.rejected)) {
      return '다시 올려 주세요';
    }
    if (documents.isNotEmpty &&
        documents.every((d) => d.status == DriverDocumentStatus.approved)) {
      return '승인됨';
    }
    return '심사 중';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final user = context.session.user;
    final driver = widget.controller.driver;
    if (user == null || driver == null) return const SizedBox.shrink();
    return SafeArea(
      bottom: false,
      child: MovoAsync<_MyData>(
        controller: widget.reload,
        load: _load,
        builder: (context, data) {
          final account = data.account;
          final docs = _documentsLabel(data.documents);
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            children: [
              Text('마이', style: mv(28, 800, ls: -0.03)),
              const SizedBox(height: 18),
              MovoCard(
                radius: 24,
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    const MovoIconTile(
                      MovoIcons.motorcycle,
                      size: 56,
                      iconSize: 24,
                      circle: true,
                      background: MovoPalette.lime,
                      foreground: MovoPalette.ink,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.name, style: mv(19, 800)),
                          const SizedBox(height: 3),
                          Text(
                            '${phone(user.phone)} · ${plate(driver.vehicleNumber)} · 오토바이',
                            style: mv(
                              13,
                              600,
                              color: colors.textMuted,
                              tabular: true,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              MovoRows(
                children: [
                  MovoMenuRow(
                    '서류',
                    trailing: _Value(
                      docs,
                      color: docs == '승인됨'
                          ? MovoPalette.lime
                          : docs == '다시 올려 주세요'
                          ? MovoPalette.dangerOnNight
                          : null,
                    ),
                    onTap: () => _open(const DocumentsScreen()),
                  ),
                  MovoMenuRow(
                    '정산 계좌',
                    trailing: _Value(
                      account == null
                          ? '등록하기'
                          : '${account.bankName} ${account.maskedAccountNumber.replaceAll('••••', '••')}'
                                ' · ${account.isVerified ? '인증 완료' : '인증 필요'}',
                    ),
                    onTap: () => _open(
                      account == null
                          ? const SettlementAccountScreen()
                          : const AccountVerificationScreen(),
                    ),
                  ),
                  MovoMenuRow(
                    '알림 설정',
                    trailing: _Value(data.pushEnabled ? '켜짐' : '꺼짐'),
                    onTap: () => _togglePush(data.pushEnabled),
                  ),
                  MovoMenuRow(
                    '공지사항',
                    onTap: () => _open(const NoticesScreen()),
                  ),
                  MovoMenuRow(
                    '고객센터',
                    onTap: () => _open(const SupportScreen()),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              MovoRows(
                children: [
                  MovoMenuRow('로그아웃', chevron: false, onTap: _logout),
                  MovoMenuRow(
                    '회원 탈퇴',
                    chevron: false,
                    muted: true,
                    onTap: () => _open(const WithdrawScreen()),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

/// 메뉴 줄 오른쪽의 값 + 꺾쇠.
class _Value extends StatelessWidget {
  const _Value(this.text, {this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          text,
          style: mv(
            13,
            700,
            color: color ?? const Color(0xFFC9CBCF),
            tabular: true,
          ),
        ),
        const SizedBox(width: 6),
        MovoIcon(MovoIcons.chevronRight, size: 16, color: colors.placeholder),
      ],
    );
  }
}
