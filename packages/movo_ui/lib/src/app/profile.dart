import 'package:movo_api/movo_api.dart';

import '../design/icons.dart';

/// 앱마다 다른 문구와 표시. 같은 로그인·가입 화면이 이 값으로 고객 앱·기사 앱이 된다.
class MovoAppProfile {
  const MovoAppProfile({
    required this.role,
    required this.logoBadge,
    required this.loginTitle,
    required this.loginSubtitle,
    required this.signupLabel,
    required this.signupTitle,
    required this.signupSubtitle,
    required this.signupSubmitLabel,
    required this.signupStep,
    required this.otherAppName,
    required this.otherAppIcon,
    required this.otherAppTitle,
    required this.otherAppBody,
    required this.otherAccountLabel,
    required this.wrongAppTitle,
    required this.wrongAppBody,
    required this.pushSettingLabel,
  });

  final UserRole role;

  /// 로고 옆의 꼬리표 (기사 앱의 '기사').
  final String? logoBadge;
  final String loginTitle;
  final String loginSubtitle;
  final String signupLabel;
  final String signupTitle;
  final String signupSubtitle;
  final String signupSubmitLabel;

  /// 가입이 여러 단계일 때 이 화면이 몇 번째인지 (기사 앱: 1 / 2).
  final (int step, int total)? signupStep;
  final String otherAppName;
  final MovoIcons otherAppIcon;
  final String otherAppTitle;
  final String otherAppBody;

  /// 다른 앱의 계정을 부르는 말 (기사 계정).
  final String otherAccountLabel;
  final String wrongAppTitle;
  final String wrongAppBody;

  /// 내 정보 화면의 푸시 스위치 이름.
  final String pushSettingLabel;

  static const customer = MovoAppProfile(
    role: UserRole.customer,
    logoBadge: null,
    loginTitle: '로그인하고\n바로 배송을 요청하세요',
    loginSubtitle: '퀵 배송부터 화물 운송까지',
    signupLabel: '회원가입',
    signupTitle: '회원가입',
    signupSubtitle: '배송을 요청하려면 계정이 필요해요',
    signupSubmitLabel: '가입하기',
    signupStep: null,
    otherAppName: '기사 앱',
    otherAppIcon: MovoIcons.van,
    otherAppTitle: '기사님이신가요?',
    otherAppBody: '기사 계정은 기사 앱에서 로그인해요',
    otherAccountLabel: '기사 계정',
    wrongAppTitle: '기사 계정으로\n로그인했어요',
    wrongAppBody: '이 앱은 배송을 보내는 고객용이에요. 기사 계정은 기사 앱에서 로그인해 주세요.',
    pushSettingLabel: '배송 알림',
  );

  static const driver = MovoAppProfile(
    role: UserRole.driver,
    logoBadge: '기사',
    loginTitle: '기사님, 오늘도\n안전 운행하세요',
    loginSubtitle: '기사 계정으로 로그인해 주세요',
    signupLabel: '기사 회원가입',
    signupTitle: '기사 회원가입',
    signupSubtitle: '먼저 계정 정보를 입력해 주세요',
    signupSubmitLabel: '다음',
    signupStep: (1, 2),
    otherAppName: '고객 앱',
    otherAppIcon: MovoIcons.box,
    otherAppTitle: '배송을 보내시나요?',
    otherAppBody: '고객 계정은 고객 앱에서 로그인해요',
    otherAccountLabel: '고객 계정',
    wrongAppTitle: '고객 계정으로\n로그인했어요',
    wrongAppBody: '이 앱은 배송을 수행하는 기사님용이에요. 고객 계정은 고객 앱에서 로그인해 주세요.',
    pushSettingLabel: '콜 알림',
  );
}
