import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_customer/payment/portone_card.dart';

void main() {
  final server = Uri.parse('https://api.movo.example:8443/api');
  final returnUrl = portOneReturnUrl(server);

  test('등록 창 페이지는 서버 주소의 출처를 쓰고, 끝나면 그 출처의 정해진 경로로 돌아온다', () {
    expect(portOneOrigin(server).toString(), 'https://api.movo.example:8443/');
    expect(
      returnUrl.toString(),
      'https://api.movo.example:8443/__movo/portone/billing-key',
    );
  });

  group('돌아온 주소', () {
    test('빌링키가 있으면 받은 것이다', () {
      final issue = parsePortOneReturn(
        returnUrl.replace(queryParameters: {'billingKey': 'billing-key-1'}),
        returnUrl,
      );
      expect(issue, isA<PortOneIssued>());
      expect((issue! as PortOneIssued).billingKey, 'billing-key-1');
    });

    test('오류 코드가 있으면 빌링키가 같이 와도 실패고, 카드사가 준 사유는 그대로 보여 준다', () {
      final issue = parsePortOneReturn(
        returnUrl.replace(
          queryParameters: {
            'billingKey': 'billing-key-1',
            'code': 'FAILURE_TYPE_PG',
            'message': '사용자가 취소했습니다',
          },
        ),
        returnUrl,
      );
      expect(issue, isA<PortOneFailed>());
      expect((issue! as PortOneFailed).message, '사용자가 취소했습니다');
    });

    test('PG사 거절이 아닌 오류는 고객에게 일반 안내를 보여 준다', () {
      final issue = parsePortOneReturn(
        returnUrl.replace(
          queryParameters: {
            'code': 'FAILURE_TYPE_PARAMETER',
            'message':
                '조건에 맞는 드라이버(pg/ksnet/issue-billing-key/redirection)가 없습니다.',
          },
        ),
        returnUrl,
      );
      expect(
        (issue! as PortOneFailed).message,
        '카드를 등록하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
      );
    });

    test('다른 주소는 건드리지 않는다', () {
      expect(
        parsePortOneReturn(
          Uri.parse(
            'https://web.nicepay.co.kr/billing/mobileWeb/issueMBKStep1.jsp',
          ),
          returnUrl,
        ),
        isNull,
      );
    });
  });

  test('등록 창 요청에 상점·채널·고객 키와 돌아올 주소를 넣고, 스크립트를 닫는 값은 막는다', () {
    const setup = CardRegistration(
      provider: CardProvider.portone,
      storeId: 'store-1',
      channelKey: 'channel-key-nice',
      customerKey: 'movo_abc',
    );
    final user = User.fromJson({
      'id': 'u1',
      'email': 'test@example.com',
      'name': '김모보</script>',
      'phone': '010-1234-5678',
      'role': 'CUSTOMER',
      'marketingAgreed': false,
      'createdAt': '2026-10-15T00:00:00.000Z',
    });
    final page = portOneBillingPage(
      setup: setup,
      user: user,
      returnUrl: returnUrl,
    );

    expect(page, contains('https://cdn.portone.io/v2/browser-sdk.js'));
    expect(page, isNot(contains('김모보</script>')));
    final request =
        jsonDecode(
              RegExp(
                r'requestIssueBillingKey\((\{.*?\})\)\.then',
              ).firstMatch(page)!.group(1)!.replaceAll(r'<\/', '</'),
            )
            as Map<String, dynamic>;
    expect(request['storeId'], 'store-1');
    expect(request['channelKey'], 'channel-key-nice');
    expect(request['billingKeyMethod'], 'CARD');
    expect(request['redirectUrl'], returnUrl.toString());
    expect(request['customer'], {
      'customerId': 'movo_abc',
      'fullName': '김모보</script>',
      'phoneNumber': '01012345678',
      'email': 'test@example.com',
    });
  });

  test('안드로이드 intent 주소는 앱 주소와 스토어 주소로 바꾼다', () {
    final target = externalAppUrl(
      Uri.parse(
        'intent://pay?srCode=123#Intent;scheme=ispmobile;package=kvp.jjy.MispAndroid320;end',
      ),
    );
    expect(target.app.toString(), 'ispmobile://pay?srCode=123');
    expect(
      target.store.toString(),
      'market://details?id=kvp.jjy.MispAndroid320',
    );

    final plain = externalAppUrl(Uri.parse('supertoss://pay?x=1'));
    expect(plain.app.toString(), 'supertoss://pay?x=1');
    expect(plain.store, isNull);
  });
}
