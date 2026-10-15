import 'package:movo_ui/movo_ui.dart';
import 'package:url_launcher/url_launcher.dart';

/// 전화 걸기와 링크 열기를 기기의 앱에 넘긴다.
class UrlLauncher implements ExternalLauncher {
  const UrlLauncher();

  @override
  Future<bool> call(String phoneNumber) =>
      open(Uri(scheme: 'tel', path: phoneNumber.replaceAll(RegExp(r'\D'), '')));

  @override
  Future<bool> open(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } on Object {
      return false;
    }
  }
}
