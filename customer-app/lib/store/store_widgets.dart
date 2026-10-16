import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 사업자등록번호 220-81-62517 (숫자 10자리가 아니면 그대로).
String businessNumberLabel(String digits) {
  final d = digits.replaceAll(RegExp(r'\D'), '');
  if (d.length != 10) return digits;
  return '${d.substring(0, 3)}-${d.substring(3, 5)}-${d.substring(5)}';
}

/// 사업자등록번호가 맞는지 — 숫자 10자리와 국세청 검증 숫자(서버와 같은 규칙).
bool isValidBusinessNumber(String raw) {
  final d = raw.replaceAll(RegExp(r'\D'), '');
  if (d.length != 10) return false;
  final digits = [for (final c in d.split('')) int.parse(c)];
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  var sum = 0;
  for (var i = 0; i < 9; i++) {
    sum += weights[i] * digits[i];
  }
  sum += (digits[8] * 5) ~/ 10;
  return (10 - sum % 10) % 10 == digits[9];
}

/// 가게 주소 한 줄 (도로명 + 상세주소)
String storeAddressLine(StoreAddress address) => [
  address.address,
  if (address.detailAddress?.isNotEmpty ?? false) address.detailAddress!,
].join(' ');

/// 신청한 가게 정보 (심사 대기·반려 화면).
class StoreInfoCard extends StatelessWidget {
  const StoreInfoCard(this.store, {super.key});

  final Store store;

  @override
  Widget build(BuildContext context) => MovoCard(
    padding: const EdgeInsets.fromLTRB(18, 18, 18, 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('신청한 가게 정보', style: mv(15, 800)),
        const SizedBox(height: 6),
        MovoKeyValue('상호', store.name, strong: true),
        MovoKeyValue(
          '사업자등록번호',
          businessNumberLabel(store.businessNumber),
          tabular: true,
        ),
        MovoKeyValue('가게 전화', phone(store.phone), tabular: true),
        MovoKeyValue('가게 주소', storeAddressLine(store.address)),
      ],
    ),
  );
}

/// "이 주소가 모든 배달의 픽업지예요" 안내.
class PickupNotice extends StatelessWidget {
  const PickupNotice({super.key});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: MovoPalette.ink,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const MovoIconTile(
          MovoIcons.pin,
          size: 32,
          radius: 10,
          iconSize: 17,
          background: MovoPalette.lime,
          foreground: MovoPalette.ink,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '이 주소가 모든 배달의 픽업지예요',
                style: mv(14, 800, color: MovoPalette.white),
              ),
              const SizedBox(height: 4),
              Text(
                '라이더가 이 주소로 음식을 받으러 와요. 가게를 옮기면 마이에서 고쳐 주세요.',
                style: mv(
                  12.5,
                  600,
                  color: const Color(0xFFB9B9B3),
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// 주소를 검색해서 고르는 칸. 고른 주소(도로명)와 그 아래 동·건물을 보여 주고, 누르면 [onSearch]를 부른다.
class AddressPickField extends StatelessWidget {
  const AddressPickField({
    super.key,
    required this.label,
    required this.address,
    required this.sub,
    required this.placeholder,
    required this.onSearch,
    this.error,
  });

  final String label;
  final String? address;
  final String? sub;
  final String placeholder;
  final VoidCallback onSearch;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Pressable(
          onTap: onSearch,
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 10, 12),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: error == null ? colors.fieldBorder : MovoPalette.danger,
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: mv(12, 600, color: colors.textMuted)),
                      const SizedBox(height: 3),
                      Text(
                        address ?? placeholder,
                        style: mv(
                          16,
                          address == null ? 600 : 700,
                          color: address == null ? colors.placeholder : null,
                        ),
                      ),
                      if (sub != null && sub!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(sub!, style: mv(12, 600, color: colors.textMuted)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Semantics(
                  label: '$label 검색',
                  button: true,
                  child: const MovoIconTile(
                    MovoIcons.search,
                    size: 40,
                    radius: 12,
                    iconSize: 19,
                    background: MovoPalette.ink,
                    foreground: MovoPalette.white,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
            child: Text(error!, style: mv(12, 700, color: MovoPalette.danger)),
          ),
      ],
    );
  }
}
