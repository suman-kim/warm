import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../earnings/settlements_screen.dart';

import '../driver_scope.dart';
import '../onboarding/review_screens.dart';
import '../onboarding/vehicle_docs_screen.dart';

class _MyData {
  const _MyData(this.documents, this.account, this.pushEnabled);

  final List<DriverDocument> documents;
  final SettlementAccount? account;
  final bool pushEnabled;
}

/// 내 정보. 등록 차량, 서류, 정산 계좌, 콜 알림과 로그아웃·탈퇴.
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
    return _MyData(documents, account, push);
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => screen));
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
          final confirmed = data.documents
              .where((d) => d.status == DriverDocumentStatus.approved)
              .length;
          final account = data.account;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            children: [
              Text('내 정보', style: mv(28, 800, ls: -0.03)),
              const SizedBox(height: 18),
              MovoCard(
                radius: 24,
                padding: const EdgeInsets.all(18),
                onTap: () => _open(const ProfileEditScreen()),
                child: Row(
                  children: [
                    MovoAvatar(user.name, size: 56),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  user.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: mv(19, 800),
                                ),
                              ),
                              const SizedBox(width: 8),
                              MovoTag(
                                '승인 완료',
                                background: colors.surfaceMuted,
                                foreground: MovoPalette.lime,
                                fontSize: 11,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 4,
                                ),
                                radius: 7,
                                leading: const MovoIcon(
                                  MovoIcons.check,
                                  size: 10,
                                  color: MovoPalette.lime,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: mv(13, 600, color: colors.textMuted),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            phone(user.phone),
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
              MovoCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    MovoIconTile(
                      vehicleIcon(driver.vehicleType),
                      size: 46,
                      radius: 15,
                      iconSize: 24,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '등록 차량',
                            style: mv(12, 700, color: colors.textMuted),
                          ),
                          const SizedBox(height: 3),
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text(
                              '${vehicleLabel(driver.vehicleType)} · ${plate(driver.vehicleNumber)}',
                              style: mv(16, 800),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Pressable(
                      onTap: () => _open(
                        VehicleChangeScreen(controller: widget.controller),
                      ),
                      child: Container(
                        height: 34,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: colors.surfaceMuted,
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Text('변경 신청', style: mv(13, 700)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              MovoRows(
                children: [
                  MovoMenuRow(
                    '제출 서류',
                    value: '$confirmed개 확인됨',
                    height: 50,
                    onTap: () => _open(const DocumentsScreen()),
                  ),
                  MovoMenuRow(
                    '정산 계좌',
                    height: 50,
                    trailing: account == null
                        ? null
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              MovoTag(
                                account.isVerified ? '인증 완료' : '인증 필요',
                                background: account.isVerified
                                    ? MovoPalette.lime.withValues(alpha: 0.16)
                                    : MovoPalette.dangerNight,
                                foreground: account.isVerified
                                    ? MovoPalette.lime
                                    : MovoPalette.dangerOnNight,
                                fontSize: 11,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 3,
                                ),
                                radius: 6,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${account.bankName} ${account.maskedAccountNumber.replaceAll('••••', '••')}',
                                style: mv(14, 700, color: colors.textMuted),
                              ),
                            ],
                          ),
                    value: account == null ? '등록하기' : null,
                    onTap: () => _open(
                      account == null
                          ? const SettlementAccountScreen()
                          : const AccountVerificationScreen(),
                    ),
                  ),
                  MovoMenuRow(
                    '정산 내역',
                    height: 50,
                    onTap: () => _open(const SettlementsScreen()),
                  ),
                  MovoMenuRow(
                    '콜 알림',
                    height: 50,
                    trailing: MovoToggle(
                      value: data.pushEnabled,
                      onChanged: (value) async {
                        final api = context.api;
                        await runAction(
                          context,
                          () => api.notifications.setPushEnabled(value),
                        );
                        widget.reload.reload();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              MovoRows(
                children: [
                  MovoMenuRow(
                    '알림',
                    height: 50,
                    onTap: () => _open(const NotificationsScreen()),
                  ),
                  MovoMenuRow(
                    '공지사항',
                    height: 50,
                    onTap: () => _open(const NoticesScreen()),
                  ),
                  MovoMenuRow(
                    '고객센터',
                    height: 50,
                    onTap: () => _open(const SupportScreen()),
                  ),
                  MovoMenuRow(
                    '약관 및 정책',
                    height: 50,
                    onTap: () => _open(const LegalListScreen()),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              MovoRows(
                children: [
                  MovoMenuRow(
                    '로그아웃',
                    chevron: false,
                    height: 50,
                    onTap: _logout,
                  ),
                  MovoMenuRow(
                    '회원 탈퇴',
                    chevron: false,
                    muted: true,
                    height: 50,
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

/// 차량 변경 신청. 다시 심사를 받아야 해서, 승인 전까지 운행할 수 없다.
class VehicleChangeScreen extends StatefulWidget {
  const VehicleChangeScreen({super.key, required this.controller});

  final DriverController controller;

  @override
  State<VehicleChangeScreen> createState() => _VehicleChangeScreenState();
}

class _VehicleChangeScreenState extends State<VehicleChangeScreen> {
  late VehicleType? _vehicle = widget.controller.driver?.vehicleType;
  late final _number = TextEditingController(
    text: plate(widget.controller.driver?.vehicleNumber ?? ''),
  );
  bool _busy = false;

  @override
  void dispose() {
    _number.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final vehicle = _vehicle;
    if (vehicle == null || _number.text.replaceAll(' ', '').length < 4) {
      showMovoToast(context, '차종과 차량 번호를 확인해 주세요.');
      return;
    }
    final confirmed = await showMovoConfirm(
      context,
      title: '차량 변경을 신청할까요?',
      body: '다시 심사를 받아요. 승인되기 전까지는 운행할 수 없어요.',
      confirmLabel: '변경 신청',
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    final driver = await runAction(
      context,
      () => api.drivers.requestVehicleChange(
        vehicleType: vehicle,
        vehicleNumber: _number.text.trim(),
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (driver != null) {
      navigator.popUntil((route) => route.isFirst);
      // 심사 대기가 되어, 앱이 승인 대기 화면으로 바뀐다.
      widget.controller.set(driver);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      bottom: MovoButton('변경 신청하기', onPressed: _submit, loading: _busy),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('차량 변경', style: mv(28, 800, ls: -0.035)),
          const SizedBox(height: 8),
          Text(
            '바꾼 차종의 콜을 받게 돼요. 운행을 끈 뒤에 신청할 수 있어요.',
            style: mv(15, 600, color: colors.textMuted, height: 1.5),
          ),
          const SizedBox(height: 22),
          Text('차종', style: mv(14, 800)),
          const SizedBox(height: 10),
          VehicleChips(
            selected: _vehicle,
            onChanged: (vehicle) => setState(() => _vehicle = vehicle),
          ),
          const SizedBox(height: 22),
          MovoField(
            label: '차량 번호',
            controller: _number,
            hint: '서울 81바 2047',
            maxLength: 20,
          ),
        ],
      ),
    );
  }
}

/// 정산 계좌와 본인인증 상태. 예금주가 가입자와 다르면 인증 실패로 보여 주고 다시 인증하게 한다.
class AccountVerificationScreen extends StatefulWidget {
  const AccountVerificationScreen({super.key});

  @override
  State<AccountVerificationScreen> createState() =>
      _AccountVerificationScreenState();
}

class _AccountVerificationScreenState extends State<AccountVerificationScreen> {
  final _reload = MovoAsyncController();

  @override
  void dispose() {
    _reload.dispose();
    super.dispose();
  }

  Future<void> _change() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const SettlementAccountScreen()),
    );
    _reload.reload();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoAsync<SettlementAccount?>(
      controller: _reload,
      load: context.api.drivers.settlementAccount,
      builder: (context, account) => MovoPage(
        title: '정산 계좌',
        bottom: MovoButton(
          account == null
              ? '정산 계좌 등록'
              : account.isVerified
              ? '계좌 바꾸기'
              : '본인 명의 계좌로 다시 인증',
          onPressed: _change,
        ),
        child: account == null
            ? Text(
                '정산 계좌를 등록하면 본인 명의인지 확인한 뒤 매주 정산금을 보내 드려요.',
                style: mv(14, 600, color: colors.textMuted, height: 1.6),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  MovoCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            const MovoIconTile(
                              MovoIcons.wallet,
                              size: 44,
                              iconSize: 20,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${account.bankName} ${account.maskedAccountNumber}',
                                    style: mv(17, 800, tabular: true),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '예금주 ${account.accountHolder}',
                                    style: mv(12, 600, color: colors.textMuted),
                                  ),
                                ],
                              ),
                            ),
                            if (account.isVerified)
                              MovoTag(
                                '인증 완료',
                                background: MovoPalette.lime.withValues(
                                  alpha: 0.16,
                                ),
                                foreground: MovoPalette.lime,
                                fontSize: 11,
                              ),
                          ],
                        ),
                        if (!account.isVerified) ...[
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: MovoPalette.dangerNight,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const MovoIcon(
                                  MovoIcons.alert,
                                  size: 18,
                                  color: MovoPalette.dangerOnNight,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        account.verificationStatus ==
                                                AccountVerificationStatus.failed
                                            ? '본인인증 실패'
                                            : '본인인증 전',
                                        style: mv(
                                          15,
                                          800,
                                          color: MovoPalette.dangerOnNight,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${account.verificationFailureReason ?? '계좌가 본인 명의인지 아직 확인하지 않았어요.'} 본인 명의 계좌로 다시 인증해야 정산금을 받을 수 있어요. 인증 전까지 지급이 보류돼요.',
                                        style: mv(13, 600, height: 1.55),
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
                  const SizedBox(height: 12),
                  MovoRows(
                    children: [
                      const MovoKeyValue('인증 방법', '예금주와 가입자 이름 확인'),
                      if (account.verificationAttemptedAt case final at?)
                        MovoKeyValue(
                          '최근 인증',
                          '${monthDayClock(at)} ${account.isVerified ? '완료' : '시도'}',
                        ),
                      const MovoKeyValue('정산 주기', '매주 화요일 · 지난주 월–일 운행분'),
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}

/// 정산 계좌 등록·변경.
class SettlementAccountScreen extends StatefulWidget {
  const SettlementAccountScreen({super.key});

  @override
  State<SettlementAccountScreen> createState() =>
      _SettlementAccountScreenState();
}

class _SettlementAccountScreenState extends State<SettlementAccountScreen> {
  final _bank = TextEditingController();
  final _number = TextEditingController();
  final _holder = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _bank.dispose();
    _number.dispose();
    _holder.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_bank.text.trim().isEmpty ||
        !RegExp(r'^[\d\s-]{8,24}$').hasMatch(_number.text.trim()) ||
        _holder.text.trim().isEmpty) {
      showMovoToast(context, '은행, 계좌번호, 예금주를 확인해 주세요.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    final saved = await runAction(
      context,
      () => api.drivers.saveSettlementAccount(
        bankName: _bank.text.trim(),
        accountNumber: _number.text.trim(),
        accountHolder: _holder.text.trim(),
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (saved != null) {
      showMovoToast(
        context,
        saved.isVerified
            ? '정산 계좌를 저장하고 본인인증을 마쳤어요.'
            : '계좌를 저장했지만 본인인증이 안 됐어요. ${saved.verificationFailureReason ?? ''}',
      );
      navigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '정산 계좌',
      bottom: MovoButton('저장', onPressed: _save, loading: _busy),
      child: MovoAsync<SettlementAccount?>(
        load: context.api.drivers.settlementAccount,
        builder: (context, account) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (account != null) ...[
              MovoCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 16,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '지금 등록된 계좌',
                      style: mv(12, 700, color: colors.textMuted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${account.bankName} ${account.maskedAccountNumber} · ${account.accountHolder}',
                      style: mv(16, 800),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Text('새 계좌로 바꾸기', style: mv(14, 800)),
              const SizedBox(height: 10),
            ],
            MovoField(
              label: '은행',
              controller: _bank,
              hint: '예: 국민',
              maxLength: 30,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 10),
            MovoField(
              label: '계좌번호',
              controller: _number,
              hint: '숫자와 하이픈',
              keyboardType: TextInputType.number,
              tabular: true,
              maxLength: 24,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 10),
            MovoField(
              label: '예금주',
              controller: _holder,
              maxLength: 50,
              textInputAction: TextInputAction.done,
            ),
          ],
        ),
      ),
    );
  }
}
