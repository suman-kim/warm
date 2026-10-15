import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';

import '../../app/async_view.dart';
import '../../app/format.dart';
import '../../app/session.dart';
import '../../design/colors.dart';
import '../../design/icons.dart';
import '../../design/states.dart';
import '../../design/widgets.dart';

// 내 정보 화면에서 들어가는 화면들. 디자인에는 메뉴만 있어, 같은 모양새로 만들었다.

/// 내 정보 수정.
class ProfileEditScreen extends StatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  late final User _user = MovoScope.read(context).notifier!.user!;
  late final _name = TextEditingController(text: _user.name);
  late final _phone = TextEditingController(text: phone(_user.phone));
  late bool _marketing = _user.marketingAgreed;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final session = MovoScope.read(context).notifier!;
    final navigator = Navigator.of(context);
    final user = await runAction(
      context,
      () => session.api.users.update(
        name: _name.text.trim(),
        phone: _phone.text.trim(),
        marketingAgreed: _marketing,
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (user != null) {
      session.updateUser(user);
      showMovoToast(context, '내 정보를 저장했어요.');
      navigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) => MovoPage(
    title: '내 정보 수정',
    bottom: MovoButton('저장', onPressed: _save, loading: _busy),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MovoField(label: '이름', controller: _name, maxLength: 50),
        const SizedBox(height: 10),
        MovoField(
          label: '휴대폰 번호',
          controller: _phone,
          keyboardType: TextInputType.phone,
          tabular: true,
        ),
        const SizedBox(height: 10),
        MovoSelectBox(label: '이메일', value: _user.email, height: 58),
        const SizedBox(height: 14),
        MovoRows(
          children: [
            MovoMenuRow(
              '마케팅 정보 수신',
              trailing: MovoToggle(
                value: _marketing,
                onChanged: (value) => setState(() => _marketing = value),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

/// 공지사항 목록.
class NoticesScreen extends StatelessWidget {
  const NoticesScreen({super.key});

  @override
  Widget build(BuildContext context) => MovoPage(
    title: '공지사항',
    scrollable: false,
    padding: EdgeInsets.zero,
    child: MovoAsync<Paged<NoticeSummary>>(
      load: () => context.api.notices.list(size: 50),
      builder: (context, page) {
        if (page.items.isEmpty) {
          return const MovoStateView(
            icon: MovoIcons.bell,
            title: '공지사항이 없어요',
            body: '새 소식이 생기면 여기에 올라와요',
            compact: true,
          );
        }
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            MovoRows(
              children: [
                for (final notice in page.items)
                  Pressable(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => NoticeDetailScreen(noticeId: notice.id),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  notice.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: mv(15, 700, height: 1.4),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  monthDay(notice.publishedAt),
                                  style: mv(
                                    12,
                                    600,
                                    color: context.colors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          MovoIcon(
                            MovoIcons.chevronRight,
                            size: 18,
                            color: context.colors.textMuted,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        );
      },
    ),
  );
}

/// 공지사항 본문.
class NoticeDetailScreen extends StatelessWidget {
  const NoticeDetailScreen({super.key, required this.noticeId});

  final String noticeId;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '공지사항',
      scrollable: false,
      padding: EdgeInsets.zero,
      child: MovoAsync<Notice>(
        load: () => context.api.notices.get(noticeId),
        builder: (context, notice) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            Text(notice.title, style: mv(22, 800, ls: -0.02, height: 1.3)),
            const SizedBox(height: 8),
            Text(
              monthDay(notice.publishedAt),
              style: mv(13, 600, color: colors.textMuted),
            ),
            const SizedBox(height: 20),
            Text(
              notice.body,
              style: mv(15, 500, color: colors.textSecondary, height: 1.7),
            ),
          ],
        ),
      ),
    );
  }
}

/// 고객센터 연락처.
class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context) => MovoPage(
    title: '고객센터',
    scrollable: false,
    padding: EdgeInsets.zero,
    child: MovoAsync<SupportContact>(
      load: context.api.support.contact,
      builder: (context, contact) {
        final launcher = context.launcher;
        Future<void> launch(Future<bool> Function() open) async {
          final opened = await open();
          if (!opened && context.mounted) {
            showMovoToast(context, '열 수 없어요. 직접 연락해 주세요.');
          }
        }

        final rows = [
          if (contact.phone case final value?)
            MovoMenuRow(
              '전화',
              value: value,
              onTap: () => launch(() => launcher.call(value)),
            ),
          if (contact.kakaoChannelUrl case final value?)
            MovoMenuRow(
              '카카오톡 채널',
              onTap: () => launch(() => launcher.open(Uri.parse(value))),
            ),
          if (contact.email case final value?)
            MovoMenuRow(
              '이메일',
              value: value,
              onTap: () => launch(
                () => launcher.open(Uri(scheme: 'mailto', path: value)),
              ),
            ),
          if (contact.hours case final value?)
            MovoMenuRow('운영 시간', value: value, chevron: false),
        ];
        if (rows.isEmpty) {
          return const MovoStateView(
            icon: MovoIcons.chat,
            title: '연락처를 준비 중이에요',
            body: '곧 문의하실 수 있어요',
            compact: true,
          );
        }
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [MovoRows(children: rows)],
        );
      },
    ),
  );
}

/// 회원 탈퇴. 비밀번호를 한 번 더 확인한다.
class WithdrawScreen extends StatefulWidget {
  const WithdrawScreen({super.key});

  @override
  State<WithdrawScreen> createState() => _WithdrawScreenState();
}

class _WithdrawScreenState extends State<WithdrawScreen> {
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _withdraw() async {
    if (_password.text.isEmpty) {
      showMovoToast(context, '비밀번호를 입력해 주세요.');
      return;
    }
    FocusScope.of(context).unfocus();
    final confirmed = await showMovoConfirm(
      context,
      title: '정말 탈퇴할까요?',
      body: '탈퇴하면 되돌릴 수 없어요.',
      confirmLabel: '탈퇴하기',
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    final session = MovoScope.read(context).notifier!;
    final navigator = Navigator.of(context);
    final ok = await runAction(context, () async {
      await session.withdraw(password: _password.text);
      return true;
    });
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok == true) navigator.popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final driver = context.appRole == UserRole.driver;
    return MovoPage(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      bottom: MovoButton('탈퇴하기', onPressed: _withdraw, loading: _busy),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('회원 탈퇴', style: mv(28, 800, ls: -0.035)),
          const SizedBox(height: 8),
          Text('탈퇴하기 전에 확인해 주세요', style: mv(15, 600, color: colors.textMuted)),
          const SizedBox(height: 22),
          MovoCard(
            radius: 20,
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (index, line) in [
                  '이름·이메일·휴대폰 번호를 지우고 모든 기기에서 로그아웃돼요.',
                  driver
                      ? '진행 중인 배송이 있으면 끝난 뒤에 탈퇴할 수 있어요.'
                      : '끝나지 않은 주문이 있으면 탈퇴할 수 없어요.',
                  '같은 이메일로 다시 가입할 수 있지만 지난 내역은 이어지지 않아요.',
                ].indexed) ...[
                  if (index > 0) const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: MovoIcon(
                          MovoIcons.check,
                          size: 14,
                          color: colors.textMuted,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          line,
                          style: mv(
                            14,
                            600,
                            color: colors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          MovoField(
            label: '비밀번호',
            controller: _password,
            obscure: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _withdraw(),
          ),
        ],
      ),
    );
  }
}

/// 알림함.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, this.onOpenOrder});

  /// 주문에 관한 알림을 눌렀을 때. 주지 않으면 눌러도 읽음 표시만 한다.
  final void Function(BuildContext context, String orderId)? onOpenOrder;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _controller = MovoAsyncController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _open(AppNotification notification) async {
    final api = context.api;
    if (!notification.isRead) {
      await runAction(
        context,
        () => api.notifications.markRead(notification.id),
      );
      _controller.reload();
    }
    final orderId = notification.orderId;
    if (orderId != null && mounted) widget.onOpenOrder?.call(context, orderId);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '알림',
      scrollable: false,
      padding: EdgeInsets.zero,
      trailing: Pressable(
        onTap: () async {
          final api = context.api;
          await runAction(context, api.notifications.markAllRead);
          _controller.reload();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
          child: Text('모두 읽음', style: mv(13, 700, color: colors.textMuted)),
        ),
      ),
      child: MovoAsync<NotificationInbox>(
        controller: _controller,
        load: () => context.api.notifications.list(size: 50),
        builder: (context, inbox) {
          if (inbox.items.isEmpty) {
            return const MovoStateView(
              icon: MovoIcons.bell,
              title: '받은 알림이 없어요',
              body: '배송 소식은 여기에 모여요',
              compact: true,
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            itemCount: inbox.items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) => _NotificationCard(
              inbox.items[index],
              onTap: () => _open(inbox.items[index]),
            ),
          );
        },
      ),
    );
  }
}

enum _Tone { ink, lime, danger, plain }

/// 알림의 종류마다 아이콘과 위에 붙는 이름.
(MovoIcons, String, _Tone) _kindOf(NotificationType type) => switch (type) {
  NotificationType.paymentPaid => (MovoIcons.check, '결제 완료', _Tone.ink),
  NotificationType.paymentAdditionalPaid => (
    MovoIcons.plus,
    '추가 결제',
    _Tone.ink,
  ),
  NotificationType.paymentAdditionalFailed => (
    MovoIcons.alert,
    '추가 결제 실패',
    _Tone.danger,
  ),
  NotificationType.orderPaymentFailed => (
    MovoIcons.alert,
    '결제 실패',
    _Tone.danger,
  ),
  NotificationType.paymentRefunded => (MovoIcons.refund, '환불', _Tone.lime),
  NotificationType.orderNoShow => (MovoIcons.clock, '노쇼', _Tone.danger),
  NotificationType.orderAssigned => (MovoIcons.van, '배차 완료', _Tone.plain),
  NotificationType.orderDeparted => (MovoIcons.route, '기사 출발', _Tone.plain),
  NotificationType.orderArrived => (MovoIcons.pin, '픽업지 도착', _Tone.plain),
  NotificationType.orderPickedUp => (MovoIcons.box, '픽업 완료', _Tone.plain),
  NotificationType.orderDelivered => (MovoIcons.check, '배송 완료', _Tone.plain),
  NotificationType.orderCancelled => (MovoIcons.close, '주문 취소', _Tone.danger),
  NotificationType.driverApproved => (MovoIcons.check, '가입 승인', _Tone.lime),
  NotificationType.driverRejected => (
    MovoIcons.document,
    '서류 확인',
    _Tone.danger,
  ),
  NotificationType.orderRequested ||
  NotificationType.orderMessage ||
  NotificationType.unknown => (MovoIcons.bell, '알림', _Tone.plain),
};

class _NotificationCard extends StatelessWidget {
  const _NotificationCard(this.notification, {required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (icon, kind, tone) = _kindOf(notification.type);
    final danger = colors.isDark
        ? MovoPalette.dangerOnNight
        : MovoPalette.danger;
    final (tileBg, tileFg) = switch (tone) {
      _Tone.ink => (
        colors.isDark ? MovoPalette.lime : MovoPalette.ink,
        colors.isDark ? MovoPalette.ink : MovoPalette.lime,
      ),
      _Tone.lime => (MovoPalette.lime, MovoPalette.ink),
      _Tone.danger => (
        colors.isDark ? MovoPalette.dangerNight : MovoPalette.dangerSoft,
        danger,
      ),
      _Tone.plain => (colors.surfaceSunken, colors.text),
    };
    return Pressable(
      onTap: onTap,
      child: MovoCard(
        radius: 20,
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MovoIconTile(
              icon,
              size: 38,
              radius: 12,
              iconSize: 18,
              background: tileBg,
              foreground: tileFg,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          kind,
                          style: mv(
                            12,
                            800,
                            color: tone == _Tone.danger
                                ? danger
                                : colors.textSecondary,
                          ),
                        ),
                      ),
                      Text(
                        sameDay(notification.createdAt, DateTime.now())
                            ? dayClock(notification.createdAt)
                            : monthDay(notification.createdAt),
                        style: mv(12, 600, color: colors.textMuted),
                      ),
                      if (!notification.isRead) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(
                            color: MovoPalette.lime,
                            shape: BoxShape.circle,
                            border: colors.isDark
                                ? null
                                : Border.all(
                                    color: MovoPalette.ink,
                                    width: 1.5,
                                  ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.title,
                    style: mv(16, notification.isRead ? 700 : 800),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    notification.body,
                    style: mv(13, 600, color: colors.textMuted, height: 1.45),
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
