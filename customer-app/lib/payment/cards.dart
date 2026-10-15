import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'portone_card.dart';

/// 카드 그림 — 검은 카드에 끝 4자리.
class CardBadge extends StatelessWidget {
  const CardBadge(this.last4, {super.key, this.width = 40});

  final String last4;
  final double width;

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: width * 0.7,
    padding: const EdgeInsets.fromLTRB(5, 0, 5, 4),
    alignment: Alignment.bottomLeft,
    decoration: BoxDecoration(
      color: MovoPalette.ink,
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      last4,
      style: mv(8, 800, color: MovoPalette.lime, tabular: true),
    ),
  );
}

/// 카드 한 줄: 그림, 카드사 ••끝4자리, 아래 설명.
class CardSummary extends StatelessWidget {
  const CardSummary({
    super.key,
    required this.label,
    required this.last4,
    required this.subtitle,
    this.subtitleColor,
    this.badge,
  });

  final String label;
  final String last4;
  final String subtitle;
  final Color? subtitleColor;

  /// 이름 옆의 꼬리표 (기본)
  final Widget? badge;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      CardBadge(last4),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: mv(15, 800, tabular: true),
                  ),
                ),
                if (badge != null) ...[const SizedBox(width: 6), badge!],
              ],
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: mv(
                12,
                600,
                color: subtitleColor ?? context.colors.textMuted,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

String cardSubtitle(PaymentMethod card) =>
    '${cardTypeLabel(card.cardType)}${card.isDefault ? ' · 기본 카드' : ''}';

/// 결제할 카드를 고르는 시트. 고른 카드를 돌려주고, '새 카드 등록'을 고르면 카드를 등록한 뒤 그 카드를 돌려준다.
///
/// [failedId]의 카드는 방금 결제가 안 된 카드로 표시한다 (다른 카드로 다시 요청할 때).
/// [confirmLabel]을 주면 고른 뒤 아래 버튼으로 확정한다.
Future<PaymentMethod?> pickCard(
  BuildContext context, {
  required String title,
  required String subtitle,
  String? selectedId,
  String? failedId,
  String? confirmLabel,
}) async {
  final api = context.api;
  final cards = await runAction(context, api.paymentMethods.list);
  if (cards == null || !context.mounted) return null;
  final picked = await showModalBottomSheet<Object>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: context.colors.scrim,
    builder: (_) => _CardSheet(
      title: title,
      subtitle: subtitle,
      cards: cards,
      selectedId:
          selectedId ??
          cards
              .where((card) => card.id != failedId)
              .where((card) => card.isDefault)
              .firstOrNull
              ?.id ??
          cards.where((card) => card.id != failedId).firstOrNull?.id,
      failedId: failedId,
      confirmLabel: confirmLabel,
    ),
  );
  if (!context.mounted) return null;
  if (picked == _newCard) return registerCard(context, backLabel: '돌아가기');
  return picked is PaymentMethod ? picked : null;
}

const _newCard = Object();

class _CardSheet extends StatefulWidget {
  const _CardSheet({
    required this.title,
    required this.subtitle,
    required this.cards,
    required this.selectedId,
    required this.failedId,
    required this.confirmLabel,
  });

  final String title;
  final String subtitle;
  final List<PaymentMethod> cards;
  final String? selectedId;
  final String? failedId;
  final String? confirmLabel;

  @override
  State<_CardSheet> createState() => _CardSheetState();
}

class _CardSheetState extends State<_CardSheet> {
  late String? _selected = widget.selectedId;

  void _pick(PaymentMethod card) {
    if (widget.confirmLabel == null) {
      Navigator.of(context).pop(card);
    } else {
      setState(() => _selected = card.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final selected = widget.cards
        .where((card) => card.id == _selected)
        .firstOrNull;
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        MediaQuery.paddingOf(context).bottom + 20,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const MovoSheetHandle(),
          const SizedBox(height: 20),
          Text(widget.title, style: mv(20, 800, ls: -0.02)),
          const SizedBox(height: 4),
          Text(widget.subtitle, style: mv(13, 600, color: colors.textMuted)),
          const SizedBox(height: 16),
          for (final card in widget.cards) ...[
            _CardOption(
              card: card,
              selected: card.id == _selected,
              failed: card.id == widget.failedId,
              onTap: card.id == widget.failedId ? null : () => _pick(card),
            ),
            const SizedBox(height: 8),
          ],
          Pressable(
            onTap: () => Navigator.of(context).pop(_newCard),
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: colors.fieldBorder, width: 1.5),
              ),
              child: Row(
                children: [
                  MovoIconTile(
                    MovoIcons.plus,
                    size: 28,
                    radius: 8,
                    iconSize: 14,
                    background: colors.surfaceMuted,
                  ),
                  const SizedBox(width: 12),
                  Text('새 카드 등록', style: mv(15, 800)),
                ],
              ),
            ),
          ),
          if (widget.confirmLabel case final label?) ...[
            const SizedBox(height: 16),
            MovoButton(
              label,
              onPressed: selected == null
                  ? null
                  : () => Navigator.of(context).pop(selected),
            ),
          ],
        ],
      ),
    );
  }
}

class _CardOption extends StatelessWidget {
  const _CardOption({
    required this.card,
    required this.selected,
    required this.failed,
    required this.onTap,
  });

  final PaymentMethod card;
  final bool selected;
  final bool failed;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      child: Pressable(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? colors.text : colors.fieldBorder,
              width: selected ? 2.5 : 1.5,
              strokeAlign: BorderSide.strokeAlignInside,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: CardSummary(
                  label: card.label,
                  last4: card.cardLast4,
                  subtitle: failed ? '방금 결제가 안 된 카드예요' : cardSubtitle(card),
                  subtitleColor: failed ? MovoPalette.danger : null,
                ),
              ),
              _Radio(selected: selected),
            ],
          ),
        ),
      ),
    );
  }
}

class _Radio extends StatelessWidget {
  const _Radio({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? colors.text : colors.separator,
          width: selected ? 6 : 1.5,
        ),
      ),
    );
  }
}

/// 카드 등록: 안내 → PG사 화면(포트원 등록 창, 로컬 개발 서버면 개발용 화면) → 등록 완료. 등록한 카드를 돌려준다.
/// [backLabel]은 완료 화면의 버튼 글자다 (견적으로 돌아가기).
Future<PaymentMethod?> registerCard(
  BuildContext context, {
  String backLabel = '확인',
}) async {
  final navigator = Navigator.of(context);
  final setup = await runAction(
    context,
    context.api.paymentMethods.registration,
  );
  if (setup == null) return null;
  final started = await navigator.push<bool>(
    MaterialPageRoute(builder: (_) => const CardIntroScreen()),
  );
  if (started != true || !context.mounted) return null;
  final Widget screen;
  switch (setup.provider) {
    case CardProvider.portone:
      screen = PortOneCardScreen(setup: setup);
    case CardProvider.dev:
      screen = DevCardScreen(setup: setup);
    case CardProvider.unknown:
      showMovoToast(context, '이 버전에서는 카드를 등록할 수 없어요. 앱을 업데이트해 주세요.');
      return null;
  }
  final card = await navigator.push<PaymentMethod>(
    MaterialPageRoute(builder: (_) => screen),
  );
  if (card == null) return null;
  await navigator.push<void>(
    MaterialPageRoute(
      builder: (_) => CardDoneScreen(card: card, backLabel: backLabel),
    ),
  );
  return card;
}

/// 카드 등록 안내. PG사 화면으로 넘어가기 전에 결제 시점과 취소 규정을 알린다.
class CardIntroScreen extends StatelessWidget {
  const CardIntroScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '본인 명의 카드만 등록할 수 있어요',
            style: mv(12, 600, color: colors.textMuted),
          ),
          const SizedBox(height: 10),
          MovoButton(
            '카드 등록하기',
            onPressed: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
      child: WithChargeRules(
        builder: (context, rules) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 64,
              height: 46,
              padding: const EdgeInsets.fromLTRB(9, 8, 9, 7),
              decoration: BoxDecoration(
                color: MovoPalette.ink,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 14,
                    height: 10,
                    decoration: BoxDecoration(
                      color: MovoPalette.lime,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const Spacer(),
                  Align(
                    alignment: Alignment.bottomRight,
                    child: Text(
                      'MOVO',
                      style: mv(7, 900, color: MovoPalette.lime),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Text(
              '결제할 카드를\n등록해 주세요',
              style: mv(28, 800, ls: -0.03, height: 1.3),
            ),
            const SizedBox(height: 12),
            Text(
              '카드 정보 입력과 본인인증은 PG사 화면에서 해요. MOVO에는 카드 번호가 저장되지 않아요.',
              style: mv(14, 500, color: colors.textMuted, height: 1.6),
            ),
            const SizedBox(height: 24),
            MovoCard(
              padding: const EdgeInsets.fromLTRB(18, 6, 18, 6),
              child: Column(
                children: [
                  _IntroStep(
                    1,
                    '배차되면 결제돼요',
                    '기사님이 요청을 수락하면 등록한 카드로 결제해요. 요청만으로는 결제되지 않아요.',
                  ),
                  _IntroStep(
                    2,
                    '출발 전 취소는 수수료가 없어요',
                    '기사님이 출발한 뒤 픽업 전에 취소하면 요금의 ${rules?.cancellationFeePercent ?? 15}%를 뺀 금액을 환불해요.',
                  ),
                  const _IntroStep(
                    3,
                    '마이에서 카드를 관리해요',
                    '기본 카드를 바꾸거나 카드를 지울 수 있어요.',
                    last: true,
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

class _IntroStep extends StatelessWidget {
  const _IntroStep(this.number, this.title, this.body, {this.last = false});

  final int number;
  final String title;
  final String body;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        border: last ? null : Border(bottom: BorderSide(color: colors.divider)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: MovoPalette.lime,
              shape: BoxShape.circle,
              border: Border.all(color: MovoPalette.ink, width: 1.5),
            ),
            child: Text('$number', style: mv(12, 800, color: MovoPalette.ink)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: mv(15, 800)),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: mv(13, 500, color: colors.textMuted, height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 개발용 카드 등록. 포트원 키가 없는 서버(로컬 개발)에서 PG사 화면 대신 카드사·끝 4자리·종류를 골라 등록한다.
/// 끝 4자리가 0001~0005·0009인 카드는 배차 때 그 사유로 결제가 안 되는 시험용 카드다.
class DevCardScreen extends StatefulWidget {
  const DevCardScreen({super.key, required this.setup});

  final CardRegistration setup;

  @override
  State<DevCardScreen> createState() => _DevCardScreenState();
}

class _DevCardScreenState extends State<DevCardScreen> {
  static const _brands = ['신한카드', '국민카드', '현대카드', '삼성카드', '우리카드', '롯데카드'];
  static const _failing = {
    '0001': '한도 초과',
    '0002': '잔액 부족',
    '0003': '카드 정지·만료',
    '0004': '카드사 점검',
    '0005': '본인인증 필요',
  };

  String _brand = _brands.first;
  CardType _type = CardType.credit;
  late final _last4 = TextEditingController(
    text: (1000 + DateTime.now().millisecond * 7 % 9000).toString(),
  );
  bool _busy = false;

  @override
  void dispose() {
    _last4.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    final last4 = _last4.text.trim();
    if (!RegExp(r'^\d{4}$').hasMatch(last4)) {
      showMovoToast(context, '카드 번호 끝 4자리를 넣어 주세요.');
      return;
    }
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    final card = await runAction(
      context,
      () => api.paymentMethods.register(
        PaymentMethodsApi.devAuthKey(brand: _brand, last4: last4, type: _type),
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (card != null) navigator.pop(card);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '카드 등록 (개발용)',
      bottom: MovoButton('카드 등록', loading: _busy, onPressed: _register),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              '개발 서버라 실제 카드 대신 시험용 카드를 등록해요. 돈은 오가지 않아요.',
              style: mv(13, 600, color: colors.textSecondary, height: 1.5),
            ),
          ),
          const SizedBox(height: 20),
          Text('카드사', style: mv(15, 800)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final brand in _brands)
                MovoChip(
                  brand,
                  selected: brand == _brand,
                  onTap: () => setState(() => _brand = brand),
                ),
            ],
          ),
          const SizedBox(height: 20),
          Text('카드 종류', style: mv(15, 800)),
          const SizedBox(height: 10),
          MovoSegmented<CardType>(
            options: const {CardType.credit: '신용카드', CardType.check: '체크카드'},
            value: _type,
            onChanged: (type) => setState(() => _type = type),
          ),
          const SizedBox(height: 20),
          MovoField(
            label: '카드 번호 끝 4자리',
            controller: _last4,
            keyboardType: TextInputType.number,
            maxLength: 4,
            tabular: true,
          ),
          const SizedBox(height: 12),
          Text(
            '결제 실패 시험: ${_failing.entries.map((e) => '${e.key} ${e.value}').join(' · ')}',
            style: mv(12, 600, color: colors.textMuted, height: 1.5),
          ),
        ],
      ),
    );
  }
}

/// 카드 등록 완료. 등록한 카드와 기본 카드 여부를 보여주고 들어온 곳으로 돌려보낸다.
class CardDoneScreen extends StatelessWidget {
  const CardDoneScreen({
    super.key,
    required this.card,
    required this.backLabel,
  });

  final PaymentMethod card;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final user = context.session.user;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const MovoIconTile(
                      MovoIcons.check,
                      size: 68,
                      radius: 24,
                      iconSize: 32,
                      background: MovoPalette.lime,
                      foreground: MovoPalette.ink,
                    ),
                    const SizedBox(height: 22),
                    Text('카드를 등록했어요', style: mv(28, 800, ls: -0.03)),
                    const SizedBox(height: 10),
                    Text(
                      '이제 배송을 요청할 수 있어요. 결제는 기사님이 배차될 때 돼요.',
                      style: mv(14, 500, color: colors.textMuted, height: 1.6),
                    ),
                    const SizedBox(height: 28),
                    Container(
                      height: 196,
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        color: MovoPalette.ink,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  card.cardBrand,
                                  style: mv(16, 800, color: MovoPalette.white),
                                ),
                              ),
                              if (card.isDefault)
                                const MovoTag(
                                  '기본 카드',
                                  background: MovoPalette.lime,
                                  foreground: MovoPalette.ink,
                                ),
                            ],
                          ),
                          const SizedBox(height: 18),
                          Container(
                            width: 34,
                            height: 24,
                            decoration: BoxDecoration(
                              color: MovoPalette.lime,
                              borderRadius: BorderRadius.circular(6),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '••••  ••••  ••••  ${card.cardLast4}',
                            style: mv(
                              19,
                              800,
                              color: MovoPalette.white,
                              ls: 0.12,
                              tabular: true,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${cardTypeLabel(card.cardType)}${user == null ? '' : ' · ${user.name}'}',
                            style: mv(12, 600, color: const Color(0xFFA9A9A3)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            MovoBottomBar(
              child: MovoButton(
                backLabel,
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 결제 수단 관리 (마이). 기본 카드를 정하고, 카드를 추가하거나 지운다.
class PaymentMethodsScreen extends StatefulWidget {
  const PaymentMethodsScreen({super.key});

  @override
  State<PaymentMethodsScreen> createState() => _PaymentMethodsScreenState();
}

class _PaymentMethodsScreenState extends State<PaymentMethodsScreen> {
  final _reload = MovoAsyncController();

  @override
  void dispose() {
    _reload.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final card = await registerCard(context, backLabel: '결제 수단으로 돌아가기');
    if (card != null) _reload.reload();
  }

  Future<void> _makeDefault(PaymentMethod card) async {
    final api = context.api;
    final done = await runAction(
      context,
      () => api.paymentMethods.setDefault(card.id),
    );
    if (done != null) _reload.reload();
  }

  Future<void> _remove(PaymentMethod card) async {
    final confirmed = await showMovoConfirm(
      context,
      title: '${card.label}를 지울까요?',
      body: '이미 결제한 주문은 결제한 카드로 환불돼요.',
      confirmLabel: '카드 삭제',
    );
    if (!confirmed || !mounted) return;
    final api = context.api;
    await runAction(context, () => api.paymentMethods.remove(card.id));
    _reload.reload();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '결제 수단',
      child: MovoAsync<List<PaymentMethod>>(
        controller: _reload,
        load: context.api.paymentMethods.list,
        builder: (context, cards) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final card in cards) ...[
              MovoCard(
                radius: 18,
                padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
                child: Row(
                  children: [
                    Expanded(
                      child: CardSummary(
                        label: card.label,
                        last4: card.cardLast4,
                        subtitle:
                            '${cardTypeLabel(card.cardType)} · ${monthDay(card.createdAt)} 등록',
                        badge: card.isDefault
                            ? const MovoTag(
                                '기본',
                                background: MovoPalette.lime,
                                foreground: MovoPalette.ink,
                                padding: EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 3,
                                ),
                                radius: 6,
                                fontSize: 11,
                              )
                            : null,
                      ),
                    ),
                    if (!card.isDefault) ...[
                      _SmallButton('기본으로', () => _makeDefault(card)),
                      const SizedBox(width: 6),
                    ],
                    _SmallButton('삭제', () => _remove(card), outlined: true),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
            Pressable(
              onTap: _add,
              child: Container(
                height: 54,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: colors.fieldBorder, width: 1.5),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const MovoIcon(MovoIcons.plus, size: 16),
                    const SizedBox(width: 8),
                    Text('카드 추가', style: mv(15, 800)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                '기본 카드는 배송을 요청할 때 먼저 선택돼요. 이미 결제한 주문은 결제한 카드로 환불돼요.',
                style: mv(12, 600, color: colors.textMuted, height: 1.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SmallButton extends StatelessWidget {
  const _SmallButton(this.label, this.onTap, {this.outlined = false});

  final String label;
  final VoidCallback onTap;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Pressable(
      onTap: onTap,
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: outlined ? colors.surface : colors.surfaceMuted,
          borderRadius: BorderRadius.circular(10),
          border: outlined
              ? Border.all(color: colors.fieldBorder, width: 1.5)
              : null,
        ),
        child: Text(label, style: mv(12, 800)),
      ),
    );
  }
}
