import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../places.dart';
import 'place_search_screen.dart';
import 'store_widgets.dart';

/// 가게 등록 (처음) 또는 가게 정보 수정. 저장한 가게를 돌려준다.
/// 승인된 가게는 사업자등록번호를 고칠 수 없다 (고객센터).
class StoreFormScreen extends StatefulWidget {
  const StoreFormScreen({super.key, this.store});

  /// 고칠 가게. 없으면 새로 등록한다.
  final Store? store;

  @override
  State<StoreFormScreen> createState() => _StoreFormScreenState();
}

class _StoreFormScreenState extends State<StoreFormScreen> {
  late final _name = TextEditingController(text: widget.store?.name);
  late final _business = TextEditingController(
    text: widget.store == null
        ? null
        : businessNumberLabel(widget.store!.businessNumber),
  );
  late final _phone = TextEditingController(
    text: widget.store == null ? null : phone(widget.store!.phone),
  );
  late final _detail = TextEditingController(
    text: widget.store?.address.detailAddress,
  );
  late Place? _place = widget.store == null
      ? null
      : Place(
          address: widget.store!.address.address,
          sigungu: widget.store!.address.sigungu,
          dong: widget.store!.address.dong,
          latitude: widget.store!.address.latitude,
          longitude: widget.store!.address.longitude,
        );
  final _errors = <String, String>{};
  bool _busy = false;

  bool get _editing => widget.store != null;
  bool get _businessLocked => widget.store?.status == StoreStatus.approved;

  @override
  void dispose() {
    _name.dispose();
    _business.dispose();
    _phone.dispose();
    _detail.dispose();
    super.dispose();
  }

  Future<void> _searchAddress() async {
    final place = await Navigator.of(context).push<Place>(
      MaterialPageRoute(
        builder: (_) => const PlaceSearchScreen(title: '가게 주소'),
      ),
    );
    if (place != null && mounted) {
      setState(() {
        _place = place;
        _errors.remove('address');
      });
    }
  }

  bool _validate() {
    _errors.clear();
    if (_name.text.trim().isEmpty) _errors['name'] = '상호를 적어 주세요.';
    if (!_businessLocked && !isValidBusinessNumber(_business.text)) {
      _errors['business'] = '사업자등록번호를 확인해 주세요.';
    }
    final tel = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^0\d{8,10}$').hasMatch(tel)) {
      _errors['phone'] = '전화번호를 확인해 주세요.';
    }
    final place = _place;
    if (place == null ||
        (place.sigungu?.isEmpty ?? true) ||
        (place.dong?.isEmpty ?? true)) {
      _errors['address'] = '가게 주소를 검색해서 골라 주세요.';
    }
    setState(() {});
    return _errors.isEmpty;
  }

  Future<void> _submit() async {
    if (!_validate()) return;
    final place = _place!;
    final input = StoreInput(
      name: _name.text.trim(),
      businessNumber: _business.text.replaceAll(RegExp(r'\D'), ''),
      phone: _phone.text.replaceAll(RegExp(r'\D'), ''),
      address: StoreAddress(
        address: place.address,
        detailAddress: _detail.text.trim(),
        sigungu: place.sigungu!,
        dong: place.dong!,
        latitude: place.latitude,
        longitude: place.longitude,
      ),
    );
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    try {
      final store = _editing
          ? await api.stores.update(input)
          : await api.stores.register(input);
      if (!mounted) return;
      navigator.pop(store);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        switch (error.code) {
          case 'INVALID_BUSINESS_NUMBER':
            _errors['business'] = error.message;
          case 'INVALID_PHONE_NUMBER':
            _errors['phone'] = error.message;
          case 'INVALID_STORE_NAME':
            _errors['name'] = error.message;
          default:
            showMovoToast(context, error.message);
        }
      });
    } on Object {
      if (!mounted) return;
      setState(() => _busy = false);
      showMovoToast(context, '저장하지 못했어요. 다시 시도해 주세요.');
    }
  }

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
    return MovoPage(
      title: _editing ? '가게 정보 수정' : '가게 등록',
      bottom: MovoButton(
        _editing ? '저장' : '심사 신청하기',
        loading: _busy,
        onPressed: _submit,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!_editing) ...[
            Text('가게 정보를\n알려 주세요', style: mv(26, 800, ls: -0.03, height: 1.3)),
            const SizedBox(height: 8),
            Text(
              '심사가 끝나면 배달을 요청할 수 있어요',
              style: mv(14, 600, color: colors.textMuted),
            ),
            const SizedBox(height: 20),
          ],
          MovoField(
            label: '상호',
            controller: _name,
            maxLength: 50,
            onChanged: (_) => setState(() => _errors.remove('name')),
          ),
          _error('name'),
          const SizedBox(height: 12),
          MovoField(
            label: '사업자등록번호',
            controller: _business,
            keyboardType: TextInputType.number,
            inputFormatters: [_BusinessNumberFormatter()],
            tabular: true,
            enabled: !_businessLocked,
            trailing: _businessLocked
                ? const MovoIcon(MovoIcons.lock, size: 18)
                : null,
            onChanged: (_) => setState(() => _errors.remove('business')),
          ),
          if (_businessLocked)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
              child: Text(
                '승인 뒤에는 고객센터 1600-0000에서 바꿀 수 있어요',
                style: mv(12, 600, color: colors.textMuted),
              ),
            ),
          _error('business'),
          const SizedBox(height: 12),
          MovoField(
            label: '가게 전화',
            controller: _phone,
            keyboardType: TextInputType.phone,
            inputFormatters: [_PhoneFormatter()],
            tabular: true,
            onChanged: (_) => setState(() => _errors.remove('phone')),
          ),
          _error('phone'),
          const SizedBox(height: 12),
          AddressPickField(
            label: '가게 주소',
            address: place?.address,
            sub: place == null
                ? null
                : [
                    if (place.dong?.isNotEmpty ?? false) place.dong!,
                    if (place.detail?.isNotEmpty ?? false) place.detail!,
                  ].join(' · '),
            placeholder: '가게 주소를 검색해 주세요',
            error: _errors['address'],
            onSearch: _searchAddress,
          ),
          const SizedBox(height: 12),
          MovoField(label: '상세주소', controller: _detail, maxLength: 200),
          const SizedBox(height: 16),
          const PickupNotice(),
        ],
      ),
    );
  }
}

/// 숫자만 받아 220-81-62517로 나눈다.
class _BusinessNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final d = newValue.text.replaceAll(RegExp(r'\D'), '');
    final digits = d.length > 10 ? d.substring(0, 10) : d;
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i == 3 || i == 5) buffer.write('-');
      buffer.write(digits[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// 숫자만 받아 전화번호 모양(02-555-1234, 010-1234-5678)으로 나눈다.
class _PhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final d = newValue.text.replaceAll(RegExp(r'\D'), '');
    final digits = d.length > 11 ? d.substring(0, 11) : d;
    final text = phone(digits);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
