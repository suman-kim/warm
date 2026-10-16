import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../places.dart';
import '../store/place_search_screen.dart';
import '../store/store_widgets.dart';
import '../wallet/top_up_sheet.dart';
import 'delivery_format.dart';

/// 배달 요청. 손님 주소·연락처, 음식값과 결제 방식, 조리 완료까지 남은 시간, 요청사항을 받는다.
/// 주소를 고르면 대행료와 요청 뒤 충전금을 바로 보여 주고, 요청하면 만든 배달을 돌려준다.
class DeliveryRequestScreen extends StatefulWidget {
  const DeliveryRequestScreen({super.key, required this.store});

  final Store store;

  /// 가게에서 이만큼 안까지만 배달한다.
  static const maxKm = 10.0;

  @override
  State<DeliveryRequestScreen> createState() => _DeliveryRequestScreenState();
}

class _DeliveryRequestScreenState extends State<DeliveryRequestScreen> {
  static const _cookOptions = [0, 10, 15, 20, 30];

  final _detail = TextEditingController();
  final _phone = TextEditingController();
  final _food = TextEditingController();
  final _cookText = TextEditingController();
  final _memo = TextEditingController();
  Place? _place;
  DeliveryQuote? _quote;
  bool _quoting = false;
  DoorPayment _payment = DoorPayment.prepaid;
  int _cook = 0;
  bool _customCook = false;
  final _errors = <String, String>{};
  String? _message;
  bool _busy = false;

  late final _store = Place(
    address: widget.store.address.address,
    sigungu: widget.store.address.sigungu,
    dong: widget.store.address.dong,
    latitude: widget.store.address.latitude,
    longitude: widget.store.address.longitude,
  );

  @override
  void dispose() {
    _detail.dispose();
    _phone.dispose();
    _food.dispose();
    _cookText.dispose();
    _memo.dispose();
    super.dispose();
  }

  int get _foodAmount =>
      int.tryParse(_food.text.replaceAll(RegExp(r'\D'), '')) ?? 0;

  int? get _cookMinutes => _customCook
      ? int.tryParse(_cookText.text.replaceAll(RegExp(r'\D'), ''))
      : _cook;

  DeliveryDestination _destination(Place place) => DeliveryDestination(
    address: place.address,
    detailAddress: _detail.text.trim(),
    sigungu: place.sigungu,
    dong: place.dong,
    latitude: place.latitude,
    longitude: place.longitude,
  );

  Future<List<Place>> _recent() async {
    try {
      final recent = await context.api.orders.recentDestinations();
      return [for (final r in recent) Place.fromWaypoint(r.waypoint)];
    } on Object {
      return const [];
    }
  }

  Future<void> _searchAddress() async {
    final navigator = Navigator.of(context);
    final recent = await _recent();
    if (!mounted) return;
    final place = await navigator.push<Place>(
      MaterialPageRoute(
        builder: (_) => PlaceSearchScreen(
          title: '손님 주소',
          origin: _store,
          maxKm: DeliveryRequestScreen.maxKm,
          recent: recent,
        ),
      ),
    );
    if (place == null || !mounted) return;
    setState(() {
      _place = place;
      _quote = null;
      _errors.remove('address');
      _message = null;
    });
    await _requote();
  }

  /// 고른 주소로 대행료를 다시 받는다 (충전한 뒤에도 부른다).
  Future<void> _requote() async {
    final place = _place;
    if (place == null) return;
    setState(() => _quoting = true);
    try {
      final quote = await context.api.deliveries.quote(_destination(place));
      if (!mounted || _place != place) return;
      setState(() {
        _quote = quote;
        _quoting = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _quoting = false;
        if (error.code == 'DELIVERY_TOO_FAR') {
          _errors['address'] = '가게에서 10km 안까지 배달할 수 있어요.';
        } else {
          _message = error.message;
        }
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _quoting = false;
        _message = errorMessage(error);
      });
    }
  }

  Future<void> _topUp() async {
    final topped = await showTopUpSheet(context);
    if (topped && mounted) await _requote();
  }

  bool _validate() {
    _errors.clear();
    _message = null;
    final place = _place;
    if (place == null) {
      _errors['address'] = '손님 주소를 검색해 주세요.';
    } else if (_store.distanceKmTo(place) > DeliveryRequestScreen.maxKm) {
      _errors['address'] = '가게에서 10km 안까지 배달할 수 있어요.';
    }
    final tel = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^0\d{8,11}$').hasMatch(tel)) {
      _errors['phone'] = '손님 연락처를 확인해 주세요.';
    }
    final food = _foodAmount;
    if (food > 1000000) {
      _errors['food'] = '음식값은 1,000,000원까지 적을 수 있어요.';
    } else if (_payment.collectsAtDoor && food == 0) {
      _errors['food'] = '만나서 결제하는 주문은 받을 음식값을 적어 주세요.';
    }
    final cook = _cookMinutes;
    if (cook == null || cook > 180) {
      _errors['cook'] = '조리 시간은 0~180분으로 적어 주세요.';
    }
    setState(() {});
    return _errors.isEmpty;
  }

  Future<void> _submit() async {
    if (!_validate()) return;
    final input = DeliveryRequestInput(
      dropoff: _destination(_place!),
      phone: _phone.text.replaceAll(RegExp(r'\D'), ''),
      foodAmount: _foodAmount,
      doorPayment: _payment,
      readyInMinutes: _cookMinutes!,
      memo: _memo.text.trim(),
    );
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    try {
      final order = await api.deliveries.request(input);
      if (!mounted) return;
      navigator.pop(order);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        switch (error.code) {
          case 'DELIVERY_TOO_FAR':
            _errors['address'] = '가게에서 10km 안까지 배달할 수 있어요.';
          case 'INVALID_PHONE_NUMBER':
            _errors['phone'] = '손님 연락처를 확인해 주세요.';
          case 'INVALID_FOOD_AMOUNT' || 'FOOD_AMOUNT_REQUIRED':
            _errors['food'] = error.message;
          case 'READY_AT_TOO_LATE':
            _errors['cook'] = error.message;
          case 'INSUFFICIENT_WALLET_BALANCE':
            // 그사이 잔액이 바뀌었다 — 다시 어림해서 부족 안내를 띄운다.
            _requote();
          default:
            _message = error.message;
        }
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = errorMessage(error);
      });
    }
  }

  String? get _addressSub {
    final place = _place;
    if (place == null) return '가게에서 10km 안까지 배달할 수 있어요';
    final quote = _quote;
    final distance = quote == null
        ? '가게에서 ${_store.distanceKmTo(place).toStringAsFixed(1)}km'
        : '가게에서 ${quote.distanceKm.toStringAsFixed(1)}km · 약 ${quote.durationMinutes}분';
    return [
      if (place.dong?.isNotEmpty ?? false) place.dong!,
      distance,
    ].join(' · ');
  }

  String get _payHint => switch (_payment) {
    DoorPayment.cash || DoorPayment.card =>
      '라이더가 손님에게 ${_foodAmount > 0 ? won(_foodAmount) : '음식값'}을 '
          '${_payment == DoorPayment.cash ? '현금으로' : '카드 단말기로'} 받아요.',
    _ => '배달앱에서 이미 결제한 주문이에요. 라이더는 돈을 받지 않아요.',
  };

  String get _cookNote {
    final minutes = _cookMinutes ?? 0;
    if (minutes == 0) return '조리가 끝났어요 · 라이더가 바로 와요';
    final at = DateTime.now().add(Duration(minutes: minutes));
    return '${ampm(at)}에 조리가 끝나요 · 라이더가 맞춰서 와요';
  }

  /// 조리 시간 칩. [minutes]가 null이면 '직접 입력'.
  Widget _cookChip(int? minutes) => MovoChip(
    minutes == null ? '직접 입력' : (minutes == 0 ? '바로' : '$minutes분'),
    selected: minutes == null ? _customCook : !_customCook && _cook == minutes,
    height: 42,
    outlined: false,
    background: context.colors.background,
    onTap: () => setState(() {
      if (minutes == null) {
        _customCook = true;
      } else {
        _cook = minutes;
        _customCook = false;
      }
      _errors.remove('cook');
    }),
  );

  Widget _error(String key) => _errors[key] == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
          child: Text(
            _errors[key]!,
            style: mv(12, 700, color: MovoPalette.danger),
          ),
        );

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final place = _place;
    final quote = _quote;
    final lacking = quote != null && quote.balanceAfter < 0;
    return MovoPage(
      title: '배달 요청',
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (quote != null) ...[
            _QuoteSummary(quote),
            const SizedBox(height: 10),
          ],
          if (lacking) ...[
            _DangerBox(
              '충전금이 부족해요. 잔액 ${won(quote.walletBalance)}, 대행료 ${won(quote.fee)}.',
            ),
            const SizedBox(height: 10),
            MovoButton(
              '충전하기',
              background: MovoPalette.lime,
              foreground: MovoPalette.ink,
              onPressed: _topUp,
            ),
          ] else
            MovoButton(
              quote == null ? '배달 요청하기' : '배달 요청하기 · ${won(quote.fee)}',
              loading: _busy || _quoting,
              onPressed: _submit,
            ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Section(
            title: '손님',
            children: [
              AddressPickField(
                label: '손님 주소',
                address: place?.address,
                sub: _addressSub,
                placeholder: '손님 주소를 검색해 주세요',
                error: _errors['address'],
                onSearch: _searchAddress,
              ),
              const SizedBox(height: 12),
              MovoField(label: '상세주소', controller: _detail, maxLength: 200),
              const SizedBox(height: 12),
              MovoField(
                label: '손님 연락처',
                controller: _phone,
                keyboardType: TextInputType.phone,
                inputFormatters: [_PhoneFormatter()],
                tabular: true,
                onChanged: (_) => setState(() => _errors.remove('phone')),
              ),
              _error('phone'),
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
                child: Text(
                  '배달앱 안심번호(050)를 넣어도 돼요',
                  style: mv(12, 600, color: colors.textMuted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _Section(
            title: '음식값과 결제',
            children: [
              MovoField(
                label: '음식값',
                controller: _food,
                keyboardType: TextInputType.number,
                inputFormatters: [_WonFormatter()],
                tabular: true,
                trailing: Text('원', style: mv(16, 800)),
                onChanged: (_) => setState(() => _errors.remove('food')),
              ),
              _error('food'),
              const SizedBox(height: 12),
              MovoSegmented<DoorPayment>(
                options: const {
                  DoorPayment.prepaid: '선결제',
                  DoorPayment.cash: '만나서 현금',
                  DoorPayment.card: '만나서 카드',
                },
                value: _payment,
                onChanged: (value) => setState(() {
                  _payment = value;
                  _errors.remove('food');
                }),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
                child: Text(
                  _payHint,
                  style: mv(13, 600, color: colors.textSecondary, height: 1.5),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _Section(
            title: '조리 완료까지',
            children: [
              for (final row in [
                _cookOptions.sublist(0, 3),
                [..._cookOptions.sublist(3), null],
              ]) ...[
                Row(
                  children: [
                    for (final (index, minutes) in row.indexed) ...[
                      if (index > 0) const SizedBox(width: 6),
                      Expanded(child: _cookChip(minutes)),
                    ],
                  ],
                ),
                if (row.first == 0) const SizedBox(height: 6),
              ],
              if (_customCook) ...[
                const SizedBox(height: 12),
                MovoField(
                  label: '직접 입력',
                  hint: '0~180',
                  controller: _cookText,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(3),
                  ],
                  tabular: true,
                  trailing: Text('분', style: mv(16, 800)),
                  onChanged: (_) => setState(() => _errors.remove('cook')),
                ),
              ],
              _error('cook'),
              const SizedBox(height: 10),
              Row(
                children: [
                  MovoIcon(
                    MovoIcons.clock,
                    size: 16,
                    color: colors.textSecondary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _cookNote,
                      style: mv(13, 700, color: colors.textSecondary),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          _Section(
            title: '요청사항',
            trailing: Text(
              '${_memo.text.length}/500',
              style: mv(12, 700, color: colors.textMuted, tabular: true),
            ),
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colors.fieldBorder, width: 1.5),
                ),
                child: TextField(
                  controller: _memo,
                  minLines: 3,
                  maxLines: 5,
                  maxLength: 500,
                  onChanged: (_) => setState(() {}),
                  style: mv(15, 600, height: 1.55),
                  decoration: InputDecoration(
                    isCollapsed: true,
                    border: InputBorder.none,
                    counterText: '',
                    hintText: '라이더에게 남길 말을 적어 주세요',
                    hintStyle: mv(15, 600, color: colors.placeholder),
                  ),
                ),
              ),
            ],
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            _DangerBox(_message!),
          ],
        ],
      ),
    );
  }
}

/// 흰 카드 한 칸 (제목 + 내용).
class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children, this.trailing});

  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => MovoCard(
    radius: 24,
    padding: const EdgeInsets.all(18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text(title, style: mv(16, 800))),
            ?trailing,
          ],
        ),
        const SizedBox(height: 14),
        ...children,
      ],
    ),
  );
}

/// 거리·대행료·요청 뒤 충전금.
class _QuoteSummary extends StatelessWidget {
  const _QuoteSummary(this.quote);

  final DeliveryQuote quote;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final lacking = quote.balanceAfter < 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${km(quote.distanceKm)} · 약 ${quote.durationMinutes}분',
                  style: mv(13, 600, color: colors.textMuted, tabular: true),
                ),
              ),
              Text(
                '배달대행료 ${won(quote.fee)}',
                style: mv(14, 800, tabular: true),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(
                  '요청 뒤 충전금',
                  style: mv(13, 600, color: colors.textMuted),
                ),
              ),
              Text(
                lacking
                    ? '−${won(-quote.balanceAfter)}'
                    : won(quote.balanceAfter),
                style: mv(
                  14,
                  700,
                  tabular: true,
                  color: lacking ? MovoPalette.danger : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DangerBox extends StatelessWidget {
  const _DangerBox(this.message);

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: MovoPalette.dangerSoft,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: MovoIcon(MovoIcons.alert, size: 16, color: MovoPalette.danger),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: mv(14, 700, color: MovoPalette.danger, height: 1.45),
          ),
        ),
      ],
    ),
  );
}

/// 숫자만 받아 23,000처럼 쉼표를 넣는다.
class _WonFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final d = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (d.isEmpty) return const TextEditingValue();
    final digits = d.length > 7 ? d.substring(0, 7) : d;
    final text = won(int.parse(digits)).replaceAll('원', '');
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// 숫자만 받아 전화번호 모양(050-1234-5678, 010-1234-5678)으로 나눈다.
class _PhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final d = newValue.text.replaceAll(RegExp(r'\D'), '');
    final digits = d.length > 12 ? d.substring(0, 12) : d;
    final text = phone(digits);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
