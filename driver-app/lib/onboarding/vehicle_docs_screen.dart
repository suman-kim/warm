import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import 'document_rows.dart';

/// 가입 2단계: 오토바이 번호와 서류 세 가지. 모두 올리고 신청하면 심사 대기로 넘어간다.
/// 반려된 라이더가 다시 신청할 때도 쓴다 ([driver]의 차량번호를 채워 둔다).
class VehicleDocsScreen extends StatefulWidget {
  const VehicleDocsScreen({super.key, required this.controller, this.driver});

  final DriverController controller;

  /// 반려돼서 다시 신청하는 라이더. 처음 가입이면 null.
  final Driver? driver;

  @override
  State<VehicleDocsScreen> createState() => _VehicleDocsScreenState();
}

class _VehicleDocsScreenState extends State<VehicleDocsScreen> {
  late final _plate = TextEditingController(text: widget.driver?.vehicleNumber);
  final _reload = MovoAsyncController();
  List<DriverDocument> _documents = const [];
  bool _busy = false;

  bool get _reapplying => widget.driver != null;

  @override
  void initState() {
    super.initState();
    _plate.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _plate.dispose();
    _reload.dispose();
    super.dispose();
  }

  int get _missing => riderDocuments
      .where(
        (type) =>
            _documents.where((d) => d.type == type && !d.needsUpload).isEmpty,
      )
      .length;

  bool get _plateOk => _plate.text.replaceAll(' ', '').length >= 4;

  Future<void> _apply() async {
    FocusScope.of(context).unfocus();
    if (!_plateOk) {
      showMovoToast(context, '차량번호를 적어 주세요');
      return;
    }
    if (_missing > 0) {
      showMovoToast(context, '서류 3가지를 모두 올려 주세요');
      return;
    }
    setState(() => _busy = true);
    final api = context.api;
    final navigator = Navigator.of(context);
    final driver = await runAction(
      context,
      () => api.drivers.register(vehicleNumber: _plate.text.trim()),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (driver == null) return;
    widget.controller.set(driver);
    if (_reapplying) navigator.pop();
  }

  Future<void> _leave() async {
    if (_reapplying) {
      Navigator.of(context).pop();
      return;
    }
    final confirmed = await showMovoConfirm(
      context,
      title: '가입을 나중에 이어서 할까요?',
      body: '로그아웃해도 올린 서류는 남아 있어요. 다시 로그인하면 이어서 신청할 수 있어요.',
      confirmLabel: '로그아웃',
      cancelLabel: '계속 입력하기',
    );
    if (confirmed && mounted) await context.session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '오토바이와 서류',
      trailing: Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Text(
          '2/2',
          style: mv(14, 800, color: colors.textMuted, tabular: true),
        ),
      ),
      // 로그인한 상태의 첫 화면이라, 뒤로 가기는 로그아웃이다.
      onBack: _leave,
      bottom: MovoButton('심사 신청하기', onPressed: _apply, loading: _busy),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 6),
          Text('서류 3가지를\n올려 주세요', style: mv(28, 800, ls: -0.035, height: 1.3)),
          const SizedBox(height: 8),
          Text(
            '사진이나 PDF로 올릴 수 있어요',
            style: mv(14, 600, color: colors.textMuted),
          ),
          const SizedBox(height: 22),
          MovoField(
            label: '차량번호',
            controller: _plate,
            hint: '서울 강남 가 1234',
            maxLength: 20,
            textInputAction: TextInputAction.done,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
            child: Text(
              '오토바이 번호판에 적힌 그대로 적어 주세요',
              style: mv(12, 600, color: colors.textMuted),
            ),
          ),
          const SizedBox(height: 18),
          MovoAsync<List<DriverDocument>>(
            controller: _reload,
            load: () async {
              final documents = await context.api.drivers.documents();
              if (mounted) setState(() => _documents = documents);
              return documents;
            },
            builder: (context, _) => DocumentRows(
              documents: _documents,
              onChanged: (documents) => setState(() => _documents = documents),
            ),
          ),
        ],
      ),
    );
  }
}
