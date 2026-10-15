import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:movo_api/movo_api.dart';

MovoEnvironment resolve(
  String appEnv,
  String apiBaseUrl, {
  bool debugBuild = false,
}) => MovoEnvironment.resolve(
  appEnv: appEnv,
  apiBaseUrl: apiBaseUrl,
  debugBuild: debugBuild,
);

Matcher throwsEnvironmentError(String message) => throwsA(
  isA<MovoEnvironmentError>().having(
    (error) => error.message,
    'message',
    contains(message),
  ),
);

void main() {
  group('환경 파일 없이', () {
    test('디버그 빌드는 이 컴퓨터의 개발 서버를 본다', () {
      final environment = resolve('', '', debugBuild: true);
      expect(environment.environment, AppEnvironment.local);
      expect(environment.apiBaseUrl, Uri.parse('http://localhost:4000/api'));
    });

    test('릴리스·프로파일 빌드는 멈춘다', () {
      expect(
        () => resolve('', 'https://api.example.com/api'),
        throwsEnvironmentError('환경 파일 없이 빌드했어요'),
      );
    });
  });

  test('모르는 환경은 멈춘다', () {
    expect(
      () => resolve('staging', 'https://api.example.com/api'),
      throwsEnvironmentError('APP_ENV=staging'),
    );
  });

  group('local', () {
    test('주소를 비우면 개발 서버를 본다', () {
      expect(
        resolve('local', '').apiBaseUrl,
        Uri.parse(MovoEnvironment.localApiBaseUrl),
      );
    });

    test('HTTP와 다른 호스트도 쓸 수 있다', () {
      expect(
        resolve('local', 'http://192.168.0.10:4000/api').apiBaseUrl,
        Uri.parse('http://192.168.0.10:4000/api'),
      );
    });
  });

  group('device·prod', () {
    for (final name in ['device', 'prod']) {
      test('$name: 주소가 비어 있으면 어느 파일을 채울지 알려준다', () {
        expect(
          () => resolve(name, ''),
          throwsEnvironmentError('env/$name.json 의 API_BASE_URL이 비어 있어요'),
        );
      });

      test('$name: 공인 주소의 HTTP는 쓸 수 없다', () {
        expect(
          () => resolve(name, 'http://api.example.com/api'),
          throwsEnvironmentError('HTTPS 주소'),
        );
      });

      test('$name: localhost는 쓸 수 없다', () {
        expect(
          () => resolve(name, 'https://localhost:4000/api'),
          throwsEnvironmentError('localhost는 이 컴퓨터가 아니에요'),
        );
        expect(
          () => resolve(name, 'https://127.0.0.1/api'),
          throwsEnvironmentError('localhost는 이 컴퓨터가 아니에요'),
        );
      });
    }

    test('device는 같은 와이파이의 사설 IP에 HTTP로 붙을 수 있다 — prod는 안 된다', () {
      for (final url in [
        'http://192.168.0.211:4000/api',
        'http://10.0.0.5:4000/api',
        'http://172.20.1.2:4000/api',
      ]) {
        expect(resolve('device', url).apiBaseUrl, Uri.parse(url), reason: url);
        expect(
          () => resolve('prod', url),
          throwsEnvironmentError('HTTPS 주소만'),
          reason: url,
        );
      }
      // 사설 대역이 아닌 IP(172.32.x.x)와 일반 도메인은 HTTPS여야 한다.
      for (final url in [
        'http://172.32.0.1:4000/api',
        'http://192.169.0.1/api',
        'http://dev.example.com/api',
      ]) {
        expect(
          () => resolve('device', url),
          throwsEnvironmentError('같은 와이파이의 사설 IP'),
          reason: url,
        );
      }
    });

    test('device는 ngrok 고정 도메인을 볼 수 있다', () {
      final environment = resolve(
        'device',
        'https://movo-test.ngrok-free.app/api',
      );
      expect(environment.environment, AppEnvironment.device);
      expect(
        environment.toString(),
        'device (https://movo-test.ngrok-free.app/api)',
      );
    });

    test('prod는 터널 주소를 볼 수 없다', () {
      for (final url in [
        'https://movo-test.ngrok-free.app/api',
        'https://abc.ngrok.app/api',
        'https://abc.trycloudflare.com/api',
      ]) {
        expect(
          () => resolve('prod', url),
          throwsEnvironmentError('터널 주소'),
          reason: url,
        );
      }
      expect(
        resolve('prod', 'https://api.movo.example/api').environment,
        AppEnvironment.prod,
      );
    });
  });

  test('주소 모양이 아니면 멈춘다', () {
    for (final url in ['api.example.com/api', 'ftp://api.example.com', '://']) {
      expect(
        () => resolve('device', url),
        throwsEnvironmentError('API_BASE_URL=$url'),
        reason: url,
      );
    }
  });

  test('끝의 /는 떼어 둔다', () {
    expect(
      resolve('device', 'https://api.example.com/api/').apiBaseUrl.toString(),
      'https://api.example.com/api',
    );
  });

  group('저장소의 환경 파일', () {
    final directory = Directory('../../env');

    for (final name in ['local', 'device', 'prod']) {
      test('$name.json은 자기 환경을 가리키고, 주소가 있으면 규칙에 맞는다', () {
        final values =
            (jsonDecode(File('${directory.path}/$name.json').readAsStringSync())
                    as Map<String, dynamic>)
                .cast<String, String>();
        expect(
          values.keys,
          unorderedEquals([
            'APP_ENV',
            'API_BASE_URL',
            'KAKAO_CUSTOMER_APP_KEY',
            'KAKAO_DRIVER_APP_KEY',
          ]),
        );
        // 카카오 앱 키는 32자리 16진수이고, 고객 앱과 기사 앱의 키가 다르다.
        final hex = matches(RegExp(r'^[0-9a-f]{32}$'));
        expect(values['KAKAO_CUSTOMER_APP_KEY'], hex);
        expect(values['KAKAO_DRIVER_APP_KEY'], hex);
        expect(
          values['KAKAO_CUSTOMER_APP_KEY'],
          isNot(values['KAKAO_DRIVER_APP_KEY']),
        );
        expect(values['APP_ENV'], name);

        final url = values['API_BASE_URL']!;
        // 아직 정하지 않은 주소(빈 값)는 앱이 켜질 때 멈추게 둔다.
        if (url.isEmpty && name != 'local') return;
        final environment = resolve(name, url);
        expect(environment.environment.name, name);
      });
    }
  });
}
