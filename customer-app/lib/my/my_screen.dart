import 'package:flutter/material.dart';
import 'package:movo_ui/movo_ui.dart';

import '../payment/cards.dart';
import '../payment/policy_screens.dart';
import 'saved_addresses_screen.dart';

/// 내 정보. 프로필과 설정, 공지·고객센터·약관, 로그아웃과 탈퇴.
class MyScreen extends StatefulWidget {
  const MyScreen({super.key});

  @override
  State<MyScreen> createState() => _MyScreenState();
}

class _MyScreenState extends State<MyScreen> {
  final _reload = MovoAsyncController();

  @override
  void dispose() {
    _reload.dispose();
    super.dispose();
  }

  Future<(int, int, bool)> _load() async {
    final api = context.api;
    final (cards, addresses, push) = await (
      api.paymentMethods.list(),
      api.savedAddresses.list(),
      api.notifications.isPushEnabled(),
    ).wait;
    return (cards.length, addresses.length, push);
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => screen));
    _reload.reload();
  }

  Future<void> _logout() async {
    final confirmed = await showMovoConfirm(
      context,
      title: '로그아웃할까요?',
      confirmLabel: '로그아웃',
    );
    if (!confirmed || !mounted) return;
    await context.session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final user = context.session.user;
    if (user == null) return const SizedBox.shrink();
    return SafeArea(
      bottom: false,
      child: MovoAsync<(int, int, bool)>(
        controller: _reload,
        load: _load,
        builder: (context, data) {
          final (cardCount, addressCount, pushEnabled) = data;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            children: [
              Text('내 정보', style: mv(28, 800, ls: -0.03)),
              const SizedBox(height: 18),
              MovoCard(
                radius: 24,
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    MovoAvatar(_avatarLetter(user.name), size: 56),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.name, style: mv(19, 800)),
                          const SizedBox(height: 3),
                          Text(
                            user.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: mv(13, 600, color: colors.textMuted),
                          ),
                          const SizedBox(height: 3),
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
                    const SizedBox(width: 8),
                    Pressable(
                      onTap: () => _open(const ProfileEditScreen()),
                      child: Container(
                        height: 34,
                        padding: const EdgeInsets.symmetric(horizontal: 13),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: colors.surfaceMuted,
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Text('수정', style: mv(13, 700)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              MovoRows(
                children: [
                  MovoMenuRow(
                    '결제 수단',
                    value: '$cardCount개',
                    onTap: () => _open(const PaymentMethodsScreen()),
                  ),
                  MovoMenuRow(
                    '자주 쓰는 주소',
                    value: '$addressCount곳',
                    onTap: () => _open(const SavedAddressesScreen()),
                  ),
                  MovoMenuRow(
                    '배송 알림',
                    trailing: MovoToggle(
                      value: pushEnabled,
                      onChanged: (value) async {
                        final api = context.api;
                        await runAction(
                          context,
                          () => api.notifications.setPushEnabled(value),
                        );
                        _reload.reload();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              MovoRows(
                children: [
                  MovoMenuRow(
                    '공지사항',
                    onTap: () => _open(const NoticesScreen()),
                  ),
                  MovoMenuRow(
                    '고객센터',
                    onTap: () => _open(const SupportScreen()),
                  ),
                  MovoMenuRow(
                    '약관 및 정책',
                    onTap: () => _open(const LegalListScreen()),
                  ),
                  MovoMenuRow(
                    '취소·환불 규정',
                    onTap: () => _open(const RefundPolicyScreen()),
                  ),
                  MovoMenuRow(
                    '사업자 정보',
                    onTap: () => _open(const BusinessInfoScreen()),
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

/// 프로필에 넣을 글자. 한글 이름이면 이름의 첫 글자(김지은 → 지), 아니면 첫 글자.
String _avatarLetter(String name) =>
    RegExp(r'^[가-힣]{3,4}$').hasMatch(name) ? name.substring(1) : name;
