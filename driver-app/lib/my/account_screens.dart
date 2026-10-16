import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

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
