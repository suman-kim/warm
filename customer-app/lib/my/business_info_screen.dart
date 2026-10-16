import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 사업자 정보 (전자상거래법 표시 의무). 서버에 적은 값을 보여준다.
class BusinessInfoScreen extends StatelessWidget {
  const BusinessInfoScreen({super.key});

  @override
  Widget build(BuildContext context) => MovoPage(
    title: '사업자 정보',
    child: MovoAsync<BusinessInfo>(
      load: context.api.support.business,
      builder: (context, info) {
        final rows = [
          ('상호', info.name),
          ('대표자', info.representative),
          ('사업자등록번호', info.registrationNumber),
          ('통신판매업 신고', info.mailOrderNumber),
          ('주소', info.address),
          (
            '고객센터',
            [?info.phone, ?info.hours].join(' · ').isEmpty
                ? null
                : [?info.phone, ?info.hours].join(' · '),
          ),
          ('이메일', info.email),
        ];
        return MovoRows(
          children: [
            for (final (label, value) in rows)
              MovoKeyValue(label, value ?? '—', verticalPadding: 15),
          ],
        );
      },
    ),
  );
}
