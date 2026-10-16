import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../delivery/rider_board.dart';
import '../delivery/rider_format.dart';
import '../driver_scope.dart';
import 'new_call_screen.dart';

/// 홈. 운행을 켜고 끄고, 오늘 수입·완료·진행 중을 보고, 들어온 콜을 수락한다.
/// 새 콜이 들어오면 크게 띄운다.
class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({
    super.key,
    required this.controller,
    required this.board,
    required this.reload,
    required this.onAccepted,
  });

  final DriverController controller;
  final RiderBoard board;
  final MovoAsyncController reload;

  /// 콜을 수락하면 (그 배달 진행 화면을 연다).
  final Future<void> Function(Order order) onAccepted;

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  final _calls = MovoAsyncController();

  /// 이미 본 콜. 새로 들어온 콜만 크게 띄운다.
  Set<String>? _seen;
  bool _toggling = false;
  String? _accepting;

  Driver get _driver => widget.controller.driver!;

  @override
  void dispose() {
    _calls.dispose();
    super.dispose();
  }

  Future<DailyEarnings?> _today() async {
    final now = DateTime.now();
    final earnings = await context.api.dispatch.earnings(from: now, to: now);
    return earnings.daily.lastOrNull;
  }

  Future<void> _toggle(bool available) async {
    if (_toggling) return;
    setState(() => _toggling = true);
    await runAction(
      context,
      () => widget.controller.setAvailability(available),
    );
    if (!mounted) return;
    setState(() {
      _toggling = false;
      _seen = null;
    });
  }

  Future<void> _accept(OpenOrder call) async {
    if (_accepting != null) return;
    if (widget.board.full) {
      showMovoToast(context, '동시에 3건까지 맡을 수 있어요. 진행 중인 배달을 먼저 끝내 주세요.');
      return;
    }
    setState(() => _accepting = call.id);
    final api = context.api;
    try {
      final order = await api.dispatch.accept(call.id);
      if (!mounted) return;
      widget.board.put(order);
      setState(() => _accepting = null);
      await widget.onAccepted(order);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _accepting = null);
      showMovoToast(context, switch (error.code) {
        ApiErrorCode.orderNotOpen ||
        ApiErrorCode.staleAggregate => '이미 다른 라이더가 수락한 콜이에요',
        ApiErrorCode.tooManyActiveDeliveries =>
          '동시에 3건까지 맡을 수 있어요. 진행 중인 배달을 먼저 끝내 주세요.',
        _ => error.message,
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _accepting = null);
      showMovoToast(context, errorMessage(error));
    }
    _calls.reload();
  }

  /// 콜을 크게 띄운다. 수락하면 바로 수락한다.
  Future<void> _showCall(OpenOrder call) async {
    final accepted = await Navigator.of(context).push(
      MaterialPageRoute<bool>(
        fullscreenDialog: true,
        builder: (_) => NewCallScreen(call: call, full: widget.board.full),
      ),
    );
    if (accepted == true && mounted) await _accept(call);
  }

  Future<List<OpenOrder>> _loadCalls() async {
    final page = await context.api.dispatch.openOrders(size: 30);
    final calls = [...page.items]
      ..sort((a, b) => b.requestedAt.compareTo(a.requestedAt));
    final seen = _seen;
    if (seen != null && mounted && ModalRoute.of(context)!.isCurrent) {
      final fresh = calls.where((call) => !seen.contains(call.id));
      if (fresh.isNotEmpty) {
        final call = fresh.first;
        WidgetsBinding.instance.addPostFrameCallback((_) => _showCall(call));
      }
    }
    _seen = {for (final call in calls) call.id};
    return calls;
  }

  @override
  Widget build(BuildContext context) {
    final online = _driver.available;
    return SafeArea(
      bottom: false,
      child: ListenableBuilder(
        listenable: widget.board,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          children: [
            Row(
              children: [
                MovoLogo(badge: MovoAppProfile.driver.logoBadge),
                const Spacer(),
                _OnlineToggle(
                  online: online,
                  busy: _toggling,
                  onChanged: _toggle,
                ),
              ],
            ),
            const SizedBox(height: 18),
            MovoAsync<DailyEarnings?>(
              controller: widget.reload,
              load: _today,
              builder: (context, today) => _Stats(
                earnings: today?.earnings ?? 0,
                done: today?.completedCount ?? 0,
                active: widget.board.active.length,
              ),
            ),
            const SizedBox(height: 14),
            if (!online)
              _OfflinePanel(busy: _toggling, onStart: () => _toggle(true))
            else
              MovoAsync<List<OpenOrder>>(
                controller: _calls,
                load: _loadCalls,
                interval: const Duration(seconds: 5),
                builder: (context, calls) => _CallList(
                  calls: calls,
                  full: widget.board.full,
                  accepting: _accepting,
                  onAccept: _accept,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// 운행 중 / 운행 꺼짐 스위치.
class _OnlineToggle extends StatelessWidget {
  const _OnlineToggle({
    required this.online,
    required this.busy,
    required this.onChanged,
  });

  final bool online;
  final bool busy;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      toggled: online,
      button: true,
      label: '운행',
      child: Pressable(
        onTap: busy ? null : () => onChanged(!online),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: 38,
          padding: const EdgeInsets.fromLTRB(14, 4, 4, 4),
          decoration: BoxDecoration(
            color: online ? MovoPalette.lime : colors.surfaceMuted,
            borderRadius: BorderRadius.circular(19),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                online ? '운행 중' : '운행 꺼짐',
                style: mv(
                  13,
                  800,
                  color: online ? MovoPalette.ink : const Color(0xFFC9CBCF),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: online ? MovoPalette.ink : const Color(0xFF8E9196),
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 오늘 수입 · 완료 · 진행 중.
class _Stats extends StatelessWidget {
  const _Stats({
    required this.earnings,
    required this.done,
    required this.active,
  });

  final int earnings;
  final int done;
  final int active;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    Widget cell(String label, String value, {Color? color}) => Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: mv(12, 700, color: colors.textMuted)),
            const SizedBox(height: 4),
            Text(value, style: mv(17, 800, tabular: true, color: color)),
          ],
        ),
      ),
    );
    Widget divider() =>
        Container(width: 1, height: 34, color: colors.surfaceMuted);
    return MovoCard(
      radius: 22,
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          cell('오늘 수입', won(earnings)),
          divider(),
          cell('완료', '$done건'),
          divider(),
          cell(
            '진행 중',
            '$active/$maxActiveDeliveries',
            color: active > 0 ? MovoPalette.lime : null,
          ),
        ],
      ),
    );
  }
}

class _OfflinePanel extends StatelessWidget {
  const _OfflinePanel({required this.busy, required this.onStart});

  final bool busy;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoCard(
      radius: 24,
      padding: const EdgeInsets.fromLTRB(22, 30, 22, 22),
      child: Column(
        children: [
          MovoIconTile(
            MovoIcons.power,
            size: 64,
            radius: 20,
            iconSize: 26,
            background: colors.surfaceMuted,
            foreground: colors.textMuted,
          ),
          const SizedBox(height: 16),
          Text('운행이 꺼져 있어요', style: mv(19, 800)),
          const SizedBox(height: 6),
          Text(
            '운행을 켜면 주변 가게의 콜을 받을 수 있어요',
            style: mv(13, 600, color: colors.textMuted),
          ),
          const SizedBox(height: 20),
          MovoButton(
            '운행 시작',
            loading: busy,
            background: MovoPalette.lime,
            foreground: MovoPalette.ink,
            onPressed: onStart,
          ),
        ],
      ),
    );
  }
}

class _CallList extends StatelessWidget {
  const _CallList({
    required this.calls,
    required this.full,
    required this.accepting,
    required this.onAccept,
  });

  final List<OpenOrder> calls;
  final bool full;
  final String? accepting;
  final void Function(OpenOrder call) onAccept;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 10),
        Row(
          children: [
            Text('콜 목록 ', style: mv(17, 800)),
            Text(
              '${calls.length}건',
              style: mv(17, 800, color: MovoPalette.lime, tabular: true),
            ),
            const Spacer(),
            Text('새로 들어온 순', style: mv(12, 600, color: colors.textMuted)),
          ],
        ),
        const SizedBox(height: 12),
        if (full) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: MovoPalette.dangerNight,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const MovoIcon(
                  MovoIcons.alert,
                  size: 16,
                  color: MovoPalette.dangerOnNight,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '동시에 3건까지 맡을 수 있어요. 진행 중인 배달을 먼저 끝내 주세요.',
                    style: mv(
                      13,
                      700,
                      color: MovoPalette.dangerOnNight,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (calls.isEmpty)
          MovoCard(
            radius: 24,
            padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 20),
            child: Column(
              children: [
                MovoIconTile(
                  MovoIcons.motorcycle,
                  size: 52,
                  radius: 16,
                  iconSize: 24,
                  background: colors.surfaceMuted,
                  foreground: colors.textMuted,
                ),
                const SizedBox(height: 14),
                Text('주변에 들어온 콜이 없어요', style: mv(16, 800)),
                const SizedBox(height: 4),
                Text(
                  '새 콜이 들어오면 바로 알려 드릴게요',
                  style: mv(13, 600, color: colors.textMuted),
                ),
              ],
            ),
          )
        else
          for (final call in calls) ...[
            CallCard(
              call,
              full: full,
              busy: accepting == call.id,
              onAccept: () => onAccept(call),
            ),
            const SizedBox(height: 10),
          ],
      ],
    );
  }
}

/// 콜 한 건: 가게, 가게 동 > 손님 동, 거리·픽업까지, 받을 돈, 라이더 몫과 [수락].
class CallCard extends StatelessWidget {
  const CallCard(
    this.call, {
    super.key,
    required this.full,
    required this.busy,
    required this.onAccept,
  });

  final OpenOrder call;
  final bool full;
  final bool busy;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final delivery = call.storeDelivery;
    final earning = call.earning;
    final minutes = DateTime.now().difference(call.requestedAt).inMinutes;
    return MovoCard(
      radius: 24,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              MovoIcon(MovoIcons.store, size: 15, color: colors.text),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  delivery.storeName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: mv(14, 800),
                ),
              ),
              Text(
                minutes < 1 ? '방금' : '$minutes분 전',
                style: mv(12, 600, color: colors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 10),
          RouteTitle(
            from: areaShort(call.pickupArea),
            to: areaShort(call.dropoffArea),
            size: 22,
          ),
          const SizedBox(height: 4),
          Text(
            '${km(call.distanceKm)} · ${readyText(delivery.readyAt)}',
            style: mv(13, 600, color: colors.textMuted, tabular: true),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: PayBadge(
              payment: delivery.doorPayment,
              foodAmount: delivery.foodAmount,
            ),
          ),
          const SizedBox(height: 14),
          Divider(height: 1, color: colors.divider),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      won(earning),
                      style: mv(
                        26,
                        800,
                        ls: -0.03,
                        tabular: true,
                        color: MovoPalette.lime,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '대행료 ${won(call.fare)} · 수수료 '
                      '${commissionPercentOf(call.fare, earning)}%를 뺀 금액',
                      style: mv(12, 600, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              MovoButton(
                '수락',
                expand: false,
                height: 48,
                radius: 16,
                fontSize: 16,
                horizontalPadding: 24,
                loading: busy,
                background: full ? colors.surfaceMuted : MovoPalette.lime,
                foreground: full ? const Color(0xFF8E9196) : MovoPalette.ink,
                onPressed: onAccept,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 역삼동 › 대치동 (가게 동 › 손님 동)
class RouteTitle extends StatelessWidget {
  const RouteTitle({
    super.key,
    required this.from,
    required this.to,
    required this.size,
  });

  final String from;
  final String to;
  final double size;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Flexible(child: Text(from, style: mv(size, 800, ls: -0.02))),
      Padding(
        padding: EdgeInsets.symmetric(horizontal: size / 3),
        child: MovoIcon(
          MovoIcons.chevronRight,
          size: size * 0.8,
          color: context.colors.text,
        ),
      ),
      Flexible(child: Text(to, style: mv(size, 800, ls: -0.02))),
    ],
  );
}
