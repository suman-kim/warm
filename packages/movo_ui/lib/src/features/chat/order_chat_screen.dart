import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';

import '../../app/async_view.dart';
import '../../app/format.dart';
import '../../app/session.dart';
import '../../design/colors.dart';
import '../../design/icons.dart';
import '../../design/states.dart';
import '../../design/widgets.dart';

/// 주문 하나를 두고 고객과 배차된 기사가 주고받는 메시지.
/// 새 메시지는 몇 초마다 확인한다. 보내기는 배송이 진행 중일 때만 된다.
class OrderChatScreen extends StatefulWidget {
  const OrderChatScreen({
    super.key,
    required this.orderId,
    required this.title,
    this.canSend = true,
  });

  final String orderId;

  /// 상대의 이름 (김도윤 기사님, 고객님).
  final String title;
  final bool canSend;

  @override
  State<OrderChatScreen> createState() => _OrderChatScreenState();
}

class _OrderChatScreenState extends State<OrderChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <OrderMessage>[];
  Timer? _timer;
  Object? _error;
  bool _loaded = false;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final fresh = await context.api.orders.messages(
        widget.orderId,
        after: _messages.isEmpty ? null : _messages.last.createdAt,
      );
      if (!mounted) return;
      final known = {for (final message in _messages) message.id};
      setState(() {
        _messages.addAll(fresh.where((message) => !known.contains(message.id)));
        _loaded = true;
        _error = null;
      });
      if (fresh.isNotEmpty) _scrollToEnd();
    } on Object catch (error) {
      if (mounted && !_loaded) setState(() => _error = error);
    }
  }

  void _scrollToEnd() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (_scroll.hasClients) {
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    }
  });

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    final api = context.api;
    final sent = await runAction(
      context,
      () => api.orders.sendMessage(widget.orderId, text),
    );
    if (!mounted) return;
    setState(() {
      _sending = false;
      if (sent != null) {
        _input.clear();
        if (_messages.every((message) => message.id != sent.id)) {
          _messages.add(sent);
        }
      }
    });
    if (sent != null) _scrollToEnd();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final error = _error;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          children: [
            MovoTopBar(title: widget.title),
            Expanded(
              child: !_loaded
                  ? (error == null
                        ? const MovoLoading()
                        : MovoErrorView(
                            error,
                            onRetry: () {
                              setState(() => _error = null);
                              _refresh();
                            },
                          ))
                  : _messages.isEmpty
                  ? MovoStateView(
                      icon: MovoIcons.chat,
                      title: '아직 메시지가 없어요',
                      body: widget.canSend
                          ? '전할 말이 있으면 메시지를 보내 보세요'
                          : '배송이 끝나 메시지를 보낼 수 없어요',
                      compact: true,
                    )
                  : ListView.separated(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      itemCount: _messages.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) =>
                          _Bubble(_messages[index]),
                    ),
            ),
            if (widget.canSend)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 13,
                        ),
                        decoration: BoxDecoration(
                          color: colors.surface,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: colors.fieldBorder,
                            width: 1.5,
                          ),
                        ),
                        child: TextField(
                          controller: _input,
                          minLines: 1,
                          maxLines: 4,
                          maxLength: 500,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _send(),
                          style: mv(15, 600, color: colors.text, height: 1.4),
                          decoration: InputDecoration.collapsed(
                            hintText: '메시지 보내기',
                            hintStyle: mv(15, 600, color: colors.placeholder),
                          ).copyWith(counterText: ''),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Pressable(
                      onTap: _send,
                      child: Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: colors.primary,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: MovoIcon(
                          MovoIcons.navigation,
                          size: 18,
                          color: colors.onPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble(this.message);

  final OrderMessage message;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final mine = message.mine;
    final time = Text(
      clock(message.createdAt),
      style: mv(11, 600, color: colors.textMuted, tabular: true),
    );
    return Row(
      mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (mine) ...[time, const SizedBox(width: 6)],
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: mine ? colors.primary : colors.surface,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Text(
              message.text,
              style: mv(
                15,
                600,
                color: mine ? colors.onPrimary : colors.text,
                height: 1.45,
              ),
            ),
          ),
        ),
        if (!mine) ...[const SizedBox(width: 6), time],
      ],
    );
  }
}
