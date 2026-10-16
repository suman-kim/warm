import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../delivery/delivery_format.dart';
import 'top_up_sheet.dart';

/// 충전금. 지금 잔액과 [충전하기], 날짜별 충전·대행료·환불·조정 내역.
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key, required this.controller});

  final MovoAsyncController controller;

  Future<void> _topUp(BuildContext context) async {
    if (await showTopUpSheet(context)) controller.reload();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: MovoAsync<Wallet>(
      controller: controller,
      load: () => context.api.stores.wallet(size: 50),
      builder: (context, wallet) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          Text('충전금', style: mv(28, 800, ls: -0.03)),
          const SizedBox(height: 18),
          _BalanceCard(balance: wallet.balance, onTopUp: () => _topUp(context)),
          const SizedBox(height: 22),
          if (wallet.items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: MovoStateView(
                icon: MovoIcons.wallet,
                title: '충전금 내역이 없어요',
                body: '충전하면 여기에 내역이 쌓여요',
                compact: true,
              ),
            )
          else
            for (final (day, entries) in groupByDay(
              wallet.items,
              (e) => e.createdAt,
            )) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
                child: Text(dayLabel(day), style: mv(14, 800)),
              ),
              MovoRows(
                radius: 24,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 2,
                ),
                children: [for (final e in entries) _EntryRow(e)],
              ),
              const SizedBox(height: 18),
            ],
          if (wallet.total > wallet.items.length)
            Text(
              '최근 ${wallet.items.length}건까지 보여드려요',
              textAlign: TextAlign.center,
              style: mv(12, 600, color: context.colors.placeholder),
            ),
        ],
      ),
    ),
  );
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance, required this.onTopUp});

  final int balance;
  final VoidCallback onTopUp;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
    decoration: BoxDecoration(
      color: MovoPalette.ink,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('지금 잔액', style: mv(13, 700, color: const Color(0xFFA5A5A0))),
        const SizedBox(height: 8),
        Text(
          won(balance),
          style: mv(
            32,
            800,
            ls: -0.03,
            tabular: true,
            color: MovoPalette.white,
          ),
        ),
        const SizedBox(height: 18),
        MovoButton(
          '충전하기',
          height: 50,
          radius: 16,
          fontSize: 16,
          background: MovoPalette.lime,
          foreground: MovoPalette.ink,
          onPressed: onTopUp,
        ),
      ],
    ),
  );
}

class _EntryRow extends StatelessWidget {
  const _EntryRow(this.entry);

  final WalletEntry entry;

  String get _kind => switch (entry.kind) {
    WalletEntryKind.topUp => '충전',
    WalletEntryKind.deliveryFee => '배달대행료',
    WalletEntryKind.refund => '환불',
    WalletEntryKind.adjustment => '운영자 조정',
    WalletEntryKind.unknown => '기타',
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final plus = entry.amount > 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_kind, style: mv(15, 800)),
                const SizedBox(height: 3),
                Text(
                  [
                    ampm(entry.createdAt),
                    if (entry.memo?.isNotEmpty ?? false) entry.memo!,
                  ].join(' · '),
                  style: mv(12, 600, color: colors.textMuted, height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${plus ? '+' : '−'}${won(entry.amount.abs())}',
                style: mv(
                  15,
                  800,
                  tabular: true,
                  color: plus ? colors.accentText : null,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '잔액 ${won(entry.balanceAfter)}',
                style: mv(12, 600, color: colors.textMuted, tabular: true),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
