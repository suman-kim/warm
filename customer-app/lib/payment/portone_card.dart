import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';

// 포트원 카드 등록 창. 포트원 브라우저 SDK로 PG사(나이스페이먼츠)의 빌링키 발급 창을 웹뷰에 띄우고,
// 끝나면 돌아오는 주소를 가로채 빌링키를 서버에 보낸다. 카드 번호는 MOVO 앱과 서버를 거치지 않는다.

/// 등록 창이 끝나면 돌아오는 경로. 실제로 열지 않고 웹뷰에서 가로챈다.
const _returnPath = '/__movo/portone/billing-key';

/// 포트원 등록 창이 돌려준 결과.
sealed class PortOneIssue {
  const PortOneIssue();
}

/// 빌링키를 받았다.
class PortOneIssued extends PortOneIssue {
  const PortOneIssued(this.billingKey);

  final String billingKey;
}

/// 등록하지 못했다 (고객이 닫았거나 PG사가 거절했다).
class PortOneFailed extends PortOneIssue {
  const PortOneFailed(this.code, this.message);

  final String code;
  final String message;
}

/// 등록 창 페이지의 출처. 서버 주소의 스킴·호스트·포트만 쓴다.
Uri portOneOrigin(Uri server) => Uri(
  scheme: server.scheme,
  host: server.host,
  port: server.hasPort ? server.port : null,
  path: '/',
);

/// 등록 창이 끝나고 돌아오는 주소.
Uri portOneReturnUrl(Uri server) =>
    portOneOrigin(server).replace(path: _returnPath);

/// [url]이 등록 창이 끝나고 돌아온 주소면 결과를, 아니면 null을 돌려준다.
PortOneIssue? parsePortOneReturn(Uri url, Uri returnUrl) {
  if (url.host != returnUrl.host || url.path != returnUrl.path) return null;
  final query = url.queryParameters;
  final billingKey = query['billingKey'];
  if (query['code'] case final code? when code.isNotEmpty) {
    // 카드사·PG사가 거절한 사유(고객이 닫은 경우 포함)만 그대로 보여 준다. 나머지는 설정·연동 문제라 고객에게는 일반 안내를 한다.
    final message = query['message'] ?? '';
    if (code != 'FAILURE_TYPE_PG' || message.isEmpty) {
      debugPrint('포트원 카드 등록 실패: $code $message');
    }
    return PortOneFailed(
      code,
      code == 'FAILURE_TYPE_PG' && message.isNotEmpty
          ? message
          : _registrationFailed,
    );
  }
  if (billingKey == null || billingKey.isEmpty) {
    return const PortOneFailed('NO_BILLING_KEY', _registrationFailed);
  }
  return PortOneIssued(billingKey);
}

const _registrationFailed = '카드를 등록하지 못했어요. 잠시 뒤 다시 시도해 주세요.';

/// 포트원 SDK로 빌링키 발급 창을 여는 페이지. 고객 키를 넘겨 서버가 이 고객의 카드인지 확인할 수 있게 한다.
/// SDK가 창을 열기 전에 오류를 돌려주면 그 오류를 실어 돌아오는 주소로 보낸다.
String portOneBillingPage({
  required CardRegistration setup,
  required User? user,
  required Uri returnUrl,
}) {
  final request = {
    'storeId': setup.storeId,
    'channelKey': setup.channelKey,
    'billingKeyMethod': 'CARD',
    'issueId': 'movo-${DateTime.now().millisecondsSinceEpoch}',
    'issueName': 'MOVO 카드 등록',
    'customer': {
      'customerId': setup.customerKey,
      if (user != null) ...{
        'fullName': user.name,
        'phoneNumber': user.phone.replaceAll(RegExp(r'\D'), ''),
        'email': user.email,
      },
    },
    'redirectUrl': returnUrl.toString(),
  };
  // </script>로 끝나는 값이 스크립트를 닫지 못하게 한다.
  final json = jsonEncode(request).replaceAll('</', r'<\/');
  final back = jsonEncode(returnUrl.toString());
  return '''<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.portone.io/v2/browser-sdk.js"></script></head>
<body><script>
function done(code, message) {
  location.replace($back + '?' + new URLSearchParams({ code: code || 'UNKNOWN', message: message || '' }));
}
try {
  PortOne.requestIssueBillingKey($json).then(function (res) {
    if (res && res.code) done(res.code, res.message);
    else if (res && res.billingKey) location.replace($back + '?' + new URLSearchParams({ billingKey: res.billingKey }));
  }, function (e) { done('SDK_ERROR', e && e.message); });
} catch (e) { done('SDK_ERROR', e && e.message); }
</script></body></html>''';
}

/// 카드사 앱·인증 앱을 여는 주소를 기기가 열 수 있는 주소로 바꾼다.
/// 안드로이드의 `intent://…#Intent;scheme=X;package=Y;end`는 `X://…`로, 앱이 없을 때를 위해 스토어 주소도 준다.
({Uri app, Uri? store}) externalAppUrl(Uri url) {
  if (url.scheme != 'intent') return (app: url, store: null);
  final raw = url.toString();
  final hash = raw.indexOf('#Intent;');
  final target = raw.substring(
    'intent://'.length,
    hash < 0 ? raw.length : hash,
  );
  final extras = <String, String>{
    if (hash >= 0)
      for (final part in raw.substring(hash + '#Intent;'.length).split(';'))
        if (part.contains('='))
          part.substring(0, part.indexOf('=')): part.substring(
            part.indexOf('=') + 1,
          ),
  };
  final scheme = extras['scheme'];
  final package = extras['package'];
  return (
    app: scheme == null ? url : Uri.parse('$scheme://$target'),
    store: package == null ? null : Uri.parse('market://details?id=$package'),
  );
}

/// 포트원 카드 등록 창. 등록한 카드를 돌려준다 (닫거나 실패하면 null).
class PortOneCardScreen extends StatefulWidget {
  const PortOneCardScreen({super.key, required this.setup});

  final CardRegistration setup;

  @override
  State<PortOneCardScreen> createState() => _PortOneCardScreenState();
}

class _PortOneCardScreenState extends State<PortOneCardScreen> {
  late final Uri _returnUrl = portOneReturnUrl(context.api.baseUrl);
  late final WebViewController _web;
  bool _started = false;
  bool _loading = true;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: _onNavigation,
          onUrlChange: (change) {
            final url = Uri.tryParse(change.url ?? '');
            if (url != null) _check(url);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
        ),
      );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _web.loadHtmlString(
      portOneBillingPage(
        setup: widget.setup,
        user: context.session.user,
        returnUrl: _returnUrl,
      ),
      baseUrl: portOneOrigin(context.api.baseUrl).toString(),
    );
  }

  NavigationDecision _onNavigation(NavigationRequest request) {
    final url = Uri.tryParse(request.url);
    if (url == null) return NavigationDecision.prevent;
    if (_check(url)) return NavigationDecision.prevent;
    const web = {'http', 'https', 'about', 'data', 'blob', 'javascript'};
    if (web.contains(url.scheme)) return NavigationDecision.navigate;
    // 카드사 앱·PASS 앱 등은 기기에서 연다.
    _openApp(url);
    return NavigationDecision.prevent;
  }

  Future<void> _openApp(Uri url) async {
    final launcher = context.launcher;
    final target = externalAppUrl(url);
    if (await launcher.open(target.app)) return;
    if (target.store case final store?) await launcher.open(store);
  }

  /// 돌아오는 주소면 결과를 처리하고 true를 돌려준다.
  bool _check(Uri url) {
    final issue = parsePortOneReturn(url, _returnUrl);
    if (issue == null) return false;
    if (!_finished) {
      _finished = true;
      _finish(issue);
    }
    return true;
  }

  Future<void> _finish(PortOneIssue issue) async {
    final navigator = Navigator.of(context);
    switch (issue) {
      case PortOneFailed(:final message):
        showMovoToast(context, message);
        navigator.pop();
      case PortOneIssued(:final billingKey):
        setState(() => _loading = true);
        final api = context.api;
        final card = await runAction(
          context,
          () => api.paymentMethods.register(billingKey),
        );
        if (!mounted) return;
        navigator.pop(card);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          children: [
            const MovoTopBar(title: '카드 등록'),
            Expanded(
              child: Stack(
                children: [
                  WebViewWidget(controller: _web),
                  if (_loading)
                    ColoredBox(
                      color: colors.background,
                      child: const Center(child: CircularProgressIndicator()),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
