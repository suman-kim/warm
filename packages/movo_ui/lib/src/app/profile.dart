import 'package:movo_api/movo_api.dart';

import '../design/icons.dart';

/// 앱마다 다른 문구와 표시. 같은 로그인·가입 화면이 이 값으로 가게 앱·라이더 앱이 된다.
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

  /// 로고 옆의 꼬리표 (라이더 앱의 '라이더').
  final String? logoBadge;
  final String loginTitle;
  final String loginSubtitle;
  final String signupLabel;
  final String signupTitle;
  final String signupSubtitle;
  final String signupSubmitLabel;

  /// 가입이 여러 단계일 때 이 화면이 몇 번째인지 (라이더 앱: 1 / 2).
  final (int step, int total)? signupStep;
  final String otherAppName;
  final MovoIcons otherAppIcon;
  final String otherAppTitle;
  final String otherAppBody;

  /// 다른 앱의 계정을 부르는 말 (라이더 계정).
  final String otherAccountLabel;
  final String wrongAppTitle;
  final String wrongAppBody;

  /// 내 정보 화면의 푸시 스위치 이름.
  final String pushSettingLabel;

  static const customer = MovoAppProfile(
    role: UserRole.customer,
    logoBadge: '사장님',
    loginTitle: '가게 계정으로\n로그인해 주세요',
    loginSubtitle: '배달 요청과 충전금을 한곳에서 관리해요',
    signupLabel: '처음이에요 · 가입하기',
    signupTitle: '회원가입',
    signupSubtitle: '가입하고 나면 가게를 등록해요',
    signupSubmitLabel: '다음 · 가게 등록',
    signupStep: null,
    otherAppName: '라이더 앱',
    otherAppIcon: MovoIcons.motorcycle,
    otherAppTitle: '라이더이신가요?',
    otherAppBody: '라이더 계정은 라이더 앱에서 로그인해요',
    otherAccountLabel: '라이더 계정',
    wrongAppTitle: '라이더 계정으로\n로그인했어요',
    wrongAppBody: '이 앱은 배달을 요청하는 가게용이에요. 라이더 계정은 라이더 앱에서 로그인해 주세요.',
    pushSettingLabel: '배달 알림',
  );

  static const driver = MovoAppProfile(
    role: UserRole.driver,
    logoBadge: '라이더',
    loginTitle: '라이더 계정으로\n로그인해 주세요',
    loginSubtitle: '콜을 받고 배달을 진행해요',
    signupLabel: '처음이에요 · 라이더 가입',
    signupTitle: '라이더 가입',
    signupSubtitle: '오토바이로 배달해요. 다음 단계에서 서류를 올려요',
    signupSubmitLabel: '다음 · 서류 올리기',
    signupStep: (1, 2),
    otherAppName: '가게 앱',
    otherAppIcon: MovoIcons.store,
    otherAppTitle: '가게 사장님이신가요?',
    otherAppBody: '가게 계정은 가게 앱에서 로그인해요',
    otherAccountLabel: '가게 계정',
    wrongAppTitle: '가게 계정으로\n로그인했어요',
    wrongAppBody: '이 앱은 배달하는 라이더용이에요. 가게 계정은 가게 앱에서 로그인해 주세요.',
    pushSettingLabel: '콜 알림',
  );
}
