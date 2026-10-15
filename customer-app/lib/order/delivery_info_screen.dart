import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'draft.dart';
import 'order_steps.dart';
import 'quote_screen.dart';

/// 배송 정보 (주문 3단계 중 2단계). 물품 종류·수량·무게, 큰 짐 운반 도움과 층·엘리베이터,
/// 보내는 분과 받는 분 연락처, 픽업 시간, 요청사항을 받는다. 항목마다 흰 카드에 담는다.
class DeliveryInfoScreen extends StatefulWidget {
  const DeliveryInfoScreen({super.key, required this.draft});

  final OrderDraft draft;

  @override
  State<DeliveryInfoScreen> createState() => _DeliveryInfoScreenState();
}

/// 무게 네 단계. 마지막 단계는 '이상'이라 그 값을 하한으로 보낸다.
const _weights = <(double, String)>[
  (5, '약 5kg'),
  (15, '약 15kg'),
  (30, '약 30kg'),
  (50, '50kg 이상'),
];

/// 요청사항을 한 번에 채우는 말.
const _memoPresets = ['1층 경비실에 맡겨주세요', '문 앞에 두세요', '도착 전에 전화 주세요'];

class _DeliveryInfoScreenState extends State<DeliveryInfoScreen> {
  OrderDraft get _draft => widget.draft;
  late final _memo = TextEditingController(text: _draft.memo);
  late final _receiverName = TextEditingController(text: _draft.receiverName);
  late final _receiverPhone = TextEditingController(
    text: _draft.receiverPhone.isEmpty ? '' : phone(_draft.receiverPhone),
  );
  late bool _scheduled = _draft.scheduledAt != null;
  late DateTime _day = _dateOnly(_draft.scheduledAt ?? DateTime.now());
  late int? _hour = _draft.scheduledAt?.hour;

  /// 다음을 눌렀을 때 연락처 카드에 보여줄 오류.
  String? _contactError;

  /// 구간의 도로 거리(km). 서버의 견적에서 받는다 — 다음 단계(견적)와 같은 값이다.
  /// 받기 전이나 받지 못하면 거리를 비워 둔다.
  double? _distanceKm;

  /// 오류가 나면 연락처 카드를 보이는 곳으로 옮긴다 — 아래쪽은 떠 있는 버튼이 가린다.
  final _contactCard = GlobalKey();

  static const _categories = [
    CargoCategory.document,
    CargoCategory.box,
    CargoCategory.shoppingBag,
    CargoCategory.furnitureAppliance,
    CargoCategory.etc,
  ];

  @override
  void initState() {
    super.initState();
    // 무게는 네 단계 중 하나다 — 전에 고른 값이 그 사이면 가까운 단계로 맞춘다.
    if (!_weights.any((weight) => weight.$1 == _draft.weightKg)) {
      _draft.weightKg = _weights
          .lastWhere(
            (weight) => weight.$1 <= _draft.weightKg,
            orElse: () => _weights.first,
          )
          .$1;
    }
    _memo.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadDistance());
  }

  Future<void> _loadDistance() async {
    try {
      final estimates = await context.api.orders.estimates(
        pickup: _draft.pickup.coordinates,
        dropoff: _draft.dropoff.coordinates,
        serviceType: _draft.service,
      );
      if (mounted) setState(() => _distanceKm = estimates.distanceKm);
    } on MovoException {
      // 거리는 안내일 뿐이다 — 못 받아도 다음으로 넘어갈 수 있다.
    }
  }

  @override
  void dispose() {
    _memo.dispose();
    _receiverName.dispose();
    _receiverPhone.dispose();
    super.dispose();
  }

  static DateTime _dateOnly(DateTime at) => DateTime(at.year, at.month, at.day);

  /// 그날 고를 수 있는 시각. 오늘은 이미 지난 시각을 뺀다.
  List<int> get _hours {
    final now = DateTime.now();
    return [
      for (var hour = 8; hour <= 21; hour++)
        if (_day.isAfter(_dateOnly(now)) || hour > now.hour) hour,
    ];
  }

  Future<void> _editSender() async {
    final result = await showModalBottomSheet<(String, String)>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: context.colors.scrim,
      builder: (context) => _ContactSheet(
        title: '보내는 분',
        name: _draft.senderName,
        phoneNumber: _draft.senderPhone,
      ),
    );
    if (result == null) return;
    final (name, number) = result;
    setState(() {
      _draft
        ..senderName = name
        ..senderPhone = number;
    });
  }

  void _next() {
    final name = _receiverName.text.trim();
    final number = _receiverPhone.text.trim();
    final error = name.isEmpty || number.isEmpty
        ? '받는 분의 이름과 연락처를 입력해 주세요.'
        : !_phonePattern.hasMatch(number)
        ? '받는 분 연락처를 확인해 주세요.'
        : null;
    if (error != null) {
      setState(() => _contactError = error);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final card = _contactCard.currentContext;
        if (card != null && card.mounted) {
          Scrollable.ensureVisible(
            card,
            alignment: 0.2,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic,
          );
        }
      });
      return;
    }
    if (_scheduled && _hour == null) {
      showMovoToast(context, '픽업 시간을 골라 주세요.');
      return;
    }
    _draft
      ..receiverName = name
      ..receiverPhone = number
      ..memo = _memo.text.trim()
      ..scheduledAt = _scheduled
          ? DateTime(_day.year, _day.month, _day.day, _hour!)
          : null;
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => QuoteScreen(draft: _draft)));
  }

  static final _phonePattern = RegExp(r'^0\d{1,2}-?\d{3,4}-?\d{4}$');

  void _clearContactError() {
    if (_contactError != null) setState(() => _contactError = null);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    // 버튼과 그 위 흐려지는 띠는 본문 위에 떠 있다 — 본문은 그 높이만큼 아래를 비워 둔다.
    final bottomSpace = bottomSafeSpace(context);
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const MovoTopBar(title: '배송 정보'),
                // 단계 막대 아래 8까지는 머리 바탕이다 — 본문은 그 아래에서 스크롤된다.
                const Padding(
                  padding: EdgeInsets.fromLTRB(24, 6, 24, 8),
                  child: OrderSteps(step: 2),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(16, 16, 16, bottomSpace + 98),
                    child: WithChargeRules(
                      builder: (context, rules) =>
                          _content(context, rules: rules),
                    ),
                  ),
                ),
              ],
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: IgnorePointer(
                child: Container(
                  height: bottomSpace + 106,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        colors.background.withValues(alpha: 0),
                        colors.background,
                      ],
                      stops: const [0, 0.42],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 20,
              right: 20,
              bottom: bottomSpace,
              child: WithChargeRules(
                builder: (context, rules) => _NextButton(
                  addOn: rules == null ? null : _draft.addOnFare(rules),
                  onPressed: _next,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _content(BuildContext context, {required ChargeRules? rules}) {
    final colors = context.colors;
    final user = context.session.user!;
    final distance = _distanceKm;
    final route = [
      '${_draft.pickup.dong ?? shortAddress(_draft.pickup.address)} → ${_draft.dropoff.dong ?? shortAddress(_draft.dropoff.address)}',
      if (distance != null) km(distance),
    ].join(' · ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(6, 0, 6, 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(route, style: mv(13, 700, color: colors.textMuted)),
              const SizedBox(height: 6),
              Text(
                '어떻게 보낼지\n알려 주세요',
                style: mv(26, 800, ls: -0.035, height: 1.3),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        _Card(
          title: '물품',
          children: [
            Row(
              children: [
                for (final (index, category) in _categories.indexed) ...[
                  if (index > 0) const SizedBox(width: 6),
                  Expanded(
                    child: _CargoTile(
                      category,
                      selected: _draft.category == category,
                      onTap: () => setState(() => _draft.category = category),
                    ),
                  ),
                ],
              ],
            ),
            Row(
              children: [
                Expanded(child: _Label('수량')),
                _Stepper(
                  value: '${_draft.quantity}개',
                  onMinus: _draft.quantity > 1
                      ? () => setState(() => _draft.quantity--)
                      : null,
                  onPlus: _draft.quantity < 99
                      ? () => setState(() => _draft.quantity++)
                      : null,
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Label('무게'),
                const SizedBox(height: 8),
                _Segments<double>(
                  options: {
                    for (final (value, label) in _weights) value: label,
                  },
                  value: _draft.weightKg,
                  height: 38,
                  onChanged: (value) => setState(() => _draft.weightKg = value),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        _Card(
          title: '큰 짐 운반 도움',
          children: [
            Column(
              children: [
                for (final (index, help) in const [
                  LoadingHelp.none,
                  LoadingHelp.together,
                  LoadingHelp.driverOnly,
                ].indexed) ...[
                  if (index > 0) const SizedBox(height: 8),
                  _HelpOption(
                    title: loadingHelpLabel(help),
                    description: switch (help) {
                      LoadingHelp.together => '기사님과 함께 옮겨요',
                      LoadingHelp.driverOnly => '기사님이 혼자 옮겨요',
                      _ => '직접 옮겨요',
                    },
                    price: help == LoadingHelp.none
                        ? '0원'
                        : rules == null
                        ? ''
                        : '+${won(rules.helpFeeOf(help))}',
                    selected: _draft.loadingHelp == help,
                    onTap: () => setState(() => _draft.loadingHelp = help),
                  ),
                ],
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        _Card(
          title: '층수와 엘리베이터',
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _FloorBox(
                    label: '출발지',
                    access: _draft.pickupAccess,
                    onChanged: (access) =>
                        setState(() => _draft.pickupAccess = access),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _FloorBox(
                    label: '도착지',
                    access: _draft.dropoffAccess,
                    onChanged: (access) =>
                        setState(() => _draft.dropoffAccess = access),
                  ),
                ),
              ],
            ),
            _StairNote(draft: _draft, rules: rules),
          ],
        ),
        const SizedBox(height: 14),
        _Card(
          key: _contactCard,
          title: '연락처',
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 보내는 분은 눌러서 고치고, '내 정보'로 내 이름·번호로 되돌린다.
                Pressable(
                  onTap: _editSender,
                  child: _ContactRow(
                    label: '보내는 분',
                    border: true,
                    top: 0,
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${_draft.senderName} · ${phone(_draft.senderPhone)}',
                            style: mv(16, 700, tabular: true),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Pressable(
                          onTap: () => setState(() {
                            _draft
                              ..senderName = user.name
                              ..senderPhone = user.phone;
                          }),
                          child: Container(
                            height: 28,
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: colors.surfaceSunken,
                              borderRadius: BorderRadius.circular(9),
                            ),
                            child: Text(
                              '내 정보',
                              style: mv(12, 700, color: colors.textSecondary),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                _ContactRow(
                  label: '받는 분 이름',
                  border: true,
                  child: _InlineField(
                    controller: _receiverName,
                    hint: '이름을 입력해 주세요',
                    maxLength: 50,
                    textInputAction: TextInputAction.next,
                    onChanged: (_) => _clearContactError(),
                  ),
                ),
                _ContactRow(
                  label: '받는 분 연락처',
                  bottom: 0,
                  child: _InlineField(
                    controller: _receiverPhone,
                    hint: '010-0000-0000',
                    keyboardType: TextInputType.phone,
                    tabular: true,
                    maxLength: 13,
                    textInputAction: TextInputAction.done,
                    onChanged: (_) => _clearContactError(),
                  ),
                ),
              ],
            ),
            if (_contactError case final error?)
              Transform.translate(
                offset: const Offset(0, -6),
                child: Text(
                  error,
                  style: mv(13, 700, color: MovoPalette.danger),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        _Card(title: '픽업 시간', children: _pickupTime(context)),
        const SizedBox(height: 14),
        _Card(
          title: '요청사항',
          trailing: Text('선택', style: mv(12, 700, color: colors.textMuted)),
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              decoration: BoxDecoration(
                color: colors.background,
                borderRadius: BorderRadius.circular(16),
              ),
              child: _InlineField(
                controller: _memo,
                hint: '기사님께 남길 말을 적어 주세요',
                size: 15,
                weight: 600,
                maxLength: 500,
                textInputAction: TextInputAction.done,
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -6),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final preset in _memoPresets)
                    _MemoPreset(
                      preset,
                      selected: _memo.text.trim() == preset,
                      onTap: () => _memo.text = _memo.text.trim() == preset
                          ? ''
                          : preset,
                    ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  List<Widget> _pickupTime(BuildContext context) {
    final colors = context.colors;
    final today = _dateOnly(DateTime.now());
    final hours = _hours;
    return [
      _Segments<bool>(
        options: const {false: '지금 바로', true: '예약'},
        value: _scheduled,
        height: 40,
        onChanged: (value) => setState(() => _scheduled = value),
      ),
      if (_scheduled) ...[
        Row(
          children: [
            for (var index = 0; index < 4; index++) ...[
              if (index > 0) const SizedBox(width: 6),
              Expanded(
                child: _DayCard(
                  day: today.add(Duration(days: index)),
                  label: switch (index) {
                    0 => '오늘',
                    1 => '내일',
                    _ => weekday(today.add(Duration(days: index))),
                  },
                  selected: today.add(Duration(days: index)) == _day,
                  onTap: () => setState(() {
                    _day = today.add(Duration(days: index));
                    if (!_hours.contains(_hour)) _hour = null;
                  }),
                ),
              ),
            ],
          ],
        ),
        if (hours.isEmpty)
          Text(
            '오늘은 예약할 수 있는 시간이 지났어요. 다른 날을 골라 주세요.',
            style: mv(13, 600, color: colors.textMuted),
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final width = (constraints.maxWidth - 12) / 3;
              return Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final hour in hours)
                    SizedBox(
                      width: width,
                      child: _HourCard(
                        hour: hour,
                        selected: hour == _hour,
                        onTap: () => setState(() => _hour = hour),
                      ),
                    ),
                ],
              );
            },
          ),
      ] else
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            color: colors.background,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              const MovoIcon(MovoIcons.clock, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '요청하면 바로 기사님을 찾아요',
                  style: mv(14, 600, color: colors.textSecondary),
                ),
              ),
            ],
          ),
        ),
    ];
  }
}

/// 항목 하나를 담는 흰 카드. 제목 아래로 [children]을 18씩 띄워 쌓는다.
class _Card extends StatelessWidget {
  const _Card({
    super.key,
    required this.title,
    this.trailing,
    required this.children,
  });

  final String title;
  final Widget? trailing;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
    decoration: BoxDecoration(
      color: context.colors.surface,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: Text(title, style: mv(17, 800, ls: -0.02))),
            ?trailing,
          ],
        ),
        for (final child in children) ...[const SizedBox(height: 18), child],
      ],
    ),
  );
}

/// 카드 안의 작은 제목 (수량, 무게).
class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: mv(13, 700, color: context.colors.textSecondary));
}

/// 물품 종류 한 칸: 아이콘과 이름.
class _CargoTile extends StatelessWidget {
  const _CargoTile(
    this.category, {
    required this.selected,
    required this.onTap,
  });

  final CargoCategory category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      label: cargoLabel(category),
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: 74,
          decoration: BoxDecoration(
            color: selected ? colors.primary : colors.background,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              MovoIcon(
                switch (category) {
                  CargoCategory.document => MovoIcons.document,
                  CargoCategory.box => MovoIcons.box,
                  CargoCategory.shoppingBag => MovoIcons.bag,
                  CargoCategory.furnitureAppliance => MovoIcons.sofa,
                  _ => MovoIcons.dots,
                },
                size: 20,
                color: selected ? MovoPalette.lime : colors.textSecondary,
              ),
              const SizedBox(height: 7),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    cargoLabel(category),
                    maxLines: 1,
                    style: mv(
                      12,
                      700,
                      ls: -0.03,
                      color: selected ? colors.onPrimary : colors.text,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 값 양옆에 −·+ 단추가 붙은 알약 (수량).
class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, this.onMinus, this.onPlus});

  final String value;
  final VoidCallback? onMinus;
  final VoidCallback? onPlus;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: context.colors.surfaceSunken,
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _StepButton(minus: true, onTap: onMinus),
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 56),
          child: Text(
            value,
            textAlign: TextAlign.center,
            style: mv(16, 800, tabular: true),
          ),
        ),
        _StepButton(minus: false, onTap: onPlus),
      ],
    ),
  );
}

/// −(흰 바탕)·+(검은 바탕) 단추. 더 줄이거나 늘릴 수 없으면 흐리게.
class _StepButton extends StatelessWidget {
  const _StepButton({required this.minus, required this.onTap});

  final bool minus;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = minus ? colors.text : colors.onPrimary;
    Widget bar(double width, double height) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(1),
      ),
    );
    return Semantics(
      button: true,
      label: minus ? '줄이기' : '늘리기',
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.35 : 1,
          child: Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: minus ? colors.surface : colors.primary,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [bar(12, 2.2), if (!minus) bar(2.2, 12)],
            ),
          ),
        ),
      ),
    );
  }
}

/// 회색 바탕 위에서 하나를 고르는 칸들. 고른 칸은 흰 바탕에 옅은 그림자.
class _Segments<T> extends StatelessWidget {
  const _Segments({
    required this.options,
    required this.value,
    required this.height,
    required this.onChanged,
  });

  final Map<T, String> options;
  final T value;
  final double height;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.surfaceSunken,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          for (final (index, entry) in options.entries.indexed) ...[
            if (index > 0) const SizedBox(width: 4),
            Expanded(
              child: Semantics(
                button: true,
                selected: entry.key == value,
                child: Pressable(
                  onTap: () => onChanged(entry.key),
                  child: Container(
                    height: height,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: entry.key == value ? colors.surface : null,
                      borderRadius: BorderRadius.circular(11),
                      boxShadow: entry.key == value
                          ? const [
                              BoxShadow(
                                color: Color(0x1F121212),
                                offset: Offset(0, 1),
                                blurRadius: 3,
                              ),
                            ]
                          : null,
                    ),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        entry.value,
                        maxLines: 1,
                        style: mv(
                          13,
                          800,
                          color: entry.key == value
                              ? colors.text
                              : colors.textMuted,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 큰 짐 운반 도움 하나: 고름 표시, 이름과 설명, 요금.
class _HelpOption extends StatelessWidget {
  const _HelpOption({
    required this.title,
    required this.description,
    required this.price,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String description;
  final String price;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final shape = BorderRadius.circular(18);
    return Semantics(
      button: true,
      selected: selected,
      child: Pressable(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: selected ? colors.surface : colors.background,
            borderRadius: shape,
          ),
          // 테두리를 안쪽에 그려 고를 때 크기가 바뀌지 않게 한다.
          foregroundDecoration: selected
              ? BoxDecoration(
                  borderRadius: shape,
                  border: Border.all(color: colors.text, width: 2),
                )
              : null,
          child: Row(
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? MovoPalette.lime : colors.surface,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected ? colors.text : colors.separator,
                    width: 1.5,
                  ),
                ),
                child: selected
                    ? const MovoIcon(
                        MovoIcons.check,
                        size: 12,
                        color: MovoPalette.ink,
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: mv(15, 800)),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: mv(13, 600, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                price,
                style: mv(
                  14,
                  800,
                  tabular: true,
                  color: selected ? colors.text : colors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 출발지나 도착지 한 곳의 층과 엘리베이터.
class _FloorBox extends StatelessWidget {
  const _FloorBox({
    required this.label,
    required this.access,
    required this.onChanged,
  });

  final String label;
  final FloorAccess access;
  final ValueChanged<FloorAccess> onChanged;

  void _set({int? floor, bool? elevator}) => onChanged(
    FloorAccess(
      floor: floor ?? access.floor,
      elevator: elevator ?? access.elevator,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Text(label, style: mv(12, 700, color: colors.textMuted)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _StepButton(
                minus: true,
                onTap: access.floor > 1
                    ? () => _set(floor: access.floor - 1)
                    : null,
              ),
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: '${access.floor}'),
                        TextSpan(text: '층', style: mv(14, 800)),
                      ],
                    ),
                    style: mv(24, 900, ls: -0.03, tabular: true, height: 1),
                  ),
                ),
              ),
              _StepButton(
                minus: false,
                onTap: access.floor < 30
                    ? () => _set(floor: access.floor + 1)
                    : null,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Semantics(
            button: true,
            toggled: access.elevator,
            label: '$label 엘리베이터',
            excludeSemantics: true,
            child: Pressable(
              onTap: () => _set(elevator: !access.elevator),
              child: Container(
                padding: const EdgeInsets.fromLTRB(2, 12, 2, 2),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: colors.fieldBorder)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('엘리베이터', style: mv(13, 800)),
                          const SizedBox(height: 1),
                          Text(
                            access.elevator ? '있어요' : '없어요',
                            style: mv(
                              12,
                              700,
                              color: access.elevator
                                  ? colors.textMuted
                                  : colors.text,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    _Switch(on: access.elevator),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 켜짐·꺼짐 스위치 (42×26). 누르는 일은 감싼 줄이 받는다.
class _Switch extends StatelessWidget {
  const _Switch({required this.on});

  final bool on;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 42,
      height: 26,
      decoration: BoxDecoration(
        color: on ? colors.text : colors.toggleOff,
        borderRadius: BorderRadius.circular(13),
      ),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 150),
        alignment: on ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 20,
          height: 20,
          margin: const EdgeInsets.symmetric(horizontal: 3),
          decoration: const BoxDecoration(
            color: MovoPalette.white,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Color(0x40121212),
                offset: Offset(0, 1),
                blurRadius: 3,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 계단으로 오르는 층수와 계단 요금.
class _StairNote extends StatelessWidget {
  const _StairNote({required this.draft, required this.rules});

  final OrderDraft draft;
  final ChargeRules? rules;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final rules = this.rules;
    final accesses = [draft.pickupAccess, draft.dropoffAccess];
    final floors = accesses
        .where((access) => access.hasStairs)
        .fold(0, (sum, access) => sum + access.floor - 1);
    final fee = rules == null
        ? null
        : accesses.fold(
            0,
            (sum, access) =>
                sum + rules.stairFeeOf(access.floor, elevator: access.elevator),
          );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              floors > 0
                  ? '엘리베이터 없이 $floors개 층을 올라요'
                  : rules == null
                  ? '엘리베이터가 없으면 2층부터 계단 요금이 붙어요'
                  : '엘리베이터가 없으면 2층부터 한 층에 ${won(rules.stairFeePerFloor)}이 붙어요',
              style: mv(13, 600, color: colors.textMuted, height: 1.5),
            ),
          ),
          if (floors > 0 && fee != null) ...[
            const SizedBox(width: 10),
            Container(
              height: 28,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: MovoPalette.lime,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Text(
                '+${won(fee)}',
                style: mv(13, 800, tabular: true, color: MovoPalette.ink),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 연락처 카드의 한 줄: 작은 제목과 값(또는 입력란). 줄 사이는 가는 선으로 나눈다.
class _ContactRow extends StatelessWidget {
  const _ContactRow({
    required this.label,
    required this.child,
    this.border = false,
    this.top = 14,
    this.bottom = 14,
  });

  final String label;
  final Widget child;
  final bool border;
  final double top;
  final double bottom;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: EdgeInsets.only(top: top, bottom: bottom),
      decoration: border
          ? BoxDecoration(
              border: Border(bottom: BorderSide(color: colors.surfaceSunken)),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: mv(12, 700, color: colors.textMuted)),
          const SizedBox(height: 4),
          child,
        ],
      ),
    );
  }
}

/// 테두리 없이 카드 안에 놓는 입력란.
class _InlineField extends StatelessWidget {
  const _InlineField({
    required this.controller,
    required this.hint,
    required this.maxLength,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.tabular = false,
    this.size = 16,
    this.weight = 700,
  });

  final TextEditingController controller;
  final String hint;
  final int maxLength;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final bool tabular;
  final double size;
  final int weight;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onChanged: onChanged,
      inputFormatters: [LengthLimitingTextInputFormatter(maxLength)],
      cursorColor: colors.text,
      style: mv(size, weight, tabular: tabular),
      decoration: InputDecoration.collapsed(
        hintText: hint,
        hintStyle: mv(size, weight, color: colors.placeholder),
      ),
    );
  }
}

/// 요청사항을 한 번에 채우는 둥근 단추.
class _MemoPreset extends StatelessWidget {
  const _MemoPreset(this.label, {required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final shape = BorderRadius.circular(17);
    return Semantics(
      button: true,
      selected: selected,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: 34,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: selected ? colors.primary : colors.surface,
            borderRadius: shape,
          ),
          foregroundDecoration: selected
              ? null
              : BoxDecoration(
                  borderRadius: shape,
                  border: Border.all(color: colors.fieldBorder, width: 1.5),
                ),
          // 글자 너비만큼만 차지한다 (가운데 정렬을 주면 줄 전체로 늘어난다).
          child: Center(
            widthFactor: 1,
            child: Text(
              label,
              style: mv(
                13,
                700,
                color: selected ? colors.onPrimary : colors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 예약 날짜 한 칸 (오늘·내일·요일과 날짜).
class _DayCard extends StatelessWidget {
  const _DayCard({
    required this.day,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final DateTime day;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: 60,
          decoration: BoxDecoration(
            color: selected ? colors.primary : colors.background,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: mv(
                  12,
                  700,
                  color: selected ? MovoPalette.lime : colors.textMuted,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '${day.day}일',
                style: mv(
                  16,
                  800,
                  color: selected ? colors.onPrimary : colors.text,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 예약 시각 한 칸.
class _HourCard extends StatelessWidget {
  const _HourCard({
    required this.hour,
    required this.selected,
    required this.onTap,
  });

  final int hour;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final shape = BorderRadius.circular(13);
    return Semantics(
      button: true,
      selected: selected,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? MovoPalette.lime : colors.background,
            borderRadius: shape,
          ),
          foregroundDecoration: selected
              ? BoxDecoration(
                  borderRadius: shape,
                  border: Border.all(color: MovoPalette.ink, width: 1.5),
                )
              : null,
          child: Text(
            '${hour.toString().padLeft(2, '0')}:00',
            style: mv(
              14,
              800,
              tabular: true,
              color: selected ? MovoPalette.ink : colors.text,
            ),
          ),
        ),
      ),
    );
  }
}

/// 다음 단계 단추. 오른쪽에 지금까지 고른 추가 요금을 보여준다 (요금 규칙을 받기 전이면 비운다).
class _NextButton extends StatelessWidget {
  const _NextButton({required this.addOn, required this.onPressed});

  final int? addOn;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final addOn = this.addOn;
    return Semantics(
      button: true,
      label: '다음 · 차종 선택',
      child: Pressable(
        onTap: onPressed,
        child: Container(
          height: 58,
          padding: const EdgeInsets.only(left: 22, right: 20),
          decoration: BoxDecoration(
            color: colors.primary,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '다음 · 차종 선택',
                  style: mv(17, 800, color: colors.onPrimary),
                ),
              ),
              if (addOn != null)
                Text(
                  addOn > 0 ? '추가 +${won(addOn)}' : '추가 요금 없음',
                  style: mv(
                    13,
                    800,
                    tabular: true,
                    color: addOn > 0
                        ? MovoPalette.lime
                        : const Color(0xFFA5A5A0),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 이름과 연락처를 받는 시트. 확인을 누르면 (이름, 연락처)를 돌려준다.
class _ContactSheet extends StatefulWidget {
  const _ContactSheet({
    required this.title,
    required this.name,
    required this.phoneNumber,
  });

  final String title;
  final String name;
  final String phoneNumber;

  @override
  State<_ContactSheet> createState() => _ContactSheetState();
}

class _ContactSheetState extends State<_ContactSheet> {
  late final _name = TextEditingController(text: widget.name);
  late final _phone = TextEditingController(
    text: widget.phoneNumber.isEmpty ? '' : phone(widget.phoneNumber),
  );

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _done() {
    final name = _name.text.trim();
    final number = _phone.text.trim();
    if (name.isEmpty ||
        !RegExp(r'^0\d{1,2}-?\d{3,4}-?\d{4}$').hasMatch(number)) {
      showMovoToast(context, '이름과 전화번호를 확인해 주세요.');
      return;
    }
    Navigator.of(context).pop((name, number));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          MediaQuery.paddingOf(context).bottom + 20,
        ),
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const MovoSheetHandle(),
            const SizedBox(height: 20),
            Text(widget.title, style: mv(20, 800, ls: -0.02)),
            const SizedBox(height: 14),
            MovoField(
              label: '이름',
              controller: _name,
              autofocus: widget.name.isEmpty,
              textInputAction: TextInputAction.next,
              maxLength: 50,
            ),
            const SizedBox(height: 10),
            MovoField(
              label: '연락처',
              controller: _phone,
              hint: '010-1234-5678',
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              tabular: true,
              onSubmitted: (_) => _done(),
            ),
            const SizedBox(height: 16),
            MovoButton('확인', onPressed: _done),
          ],
        ),
      ),
    );
  }
}
