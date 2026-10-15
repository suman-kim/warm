import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import '../services.dart';
import 'document_rows.dart';

const vehicleChoices = [
  VehicleType.motorcycle,
  VehicleType.damas,
  VehicleType.labo,
  VehicleType.truck1Ton,
  VehicleType.truck2HalfTon,
  VehicleType.truck5Ton,
];

/// 가입 2단계: 차량과 서류. 차종은 콜을 받는 기준이라 꼭 받는다.
/// 서류를 모두 올리고 신청하면 승인 대기로 넘어간다.
class VehicleDocsScreen extends StatefulWidget {
  const VehicleDocsScreen({super.key, required this.controller});

  final DriverController controller;

  @override
  State<VehicleDocsScreen> createState() => _VehicleDocsScreenState();
}

class _VehicleDocsScreenState extends State<VehicleDocsScreen> {
  VehicleType? _vehicle;
  final _number = TextEditingController();
  final _reload = MovoAsyncController();
  List<DriverDocument> _documents = const [];
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _number.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _number.dispose();
    _reload.dispose();
    super.dispose();
  }

  int get _missing =>
      _documents.where((document) => document.needsUpload).length;

  bool get _ready =>
      _vehicle != null &&
      _number.text.replaceAll(' ', '').length >= 4 &&
      _documents.isNotEmpty &&
      _missing == 0;

  Future<void> _apply() async {
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final api = context.api;
    final driver = await runAction(
      context,
      () => api.drivers.register(
        vehicleType: _vehicle!,
        vehicleNumber: _number.text.trim(),
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (driver != null) widget.controller.set(driver);
  }

  Future<void> _leave() async {
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
      trailing: Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Text(
          '2 / 2',
          style: mv(14, 800, color: colors.textMuted, tabular: true),
        ),
      ),
      // 로그인한 상태의 첫 화면이라, 뒤로 가기는 로그아웃이다.
      onBack: _leave,
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_documents.isNotEmpty && _missing > 0) ...[
            Text(
              '서류 $_missing개를 더 올리면 신청할 수 있어요',
              style: mv(13, 700, color: colors.textMuted),
            ),
            const SizedBox(height: 10),
          ],
          MovoButton(
            '가입 신청하기',
            onPressed: _ready ? _apply : null,
            loading: _busy,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const MovoSegments(total: 2, filled: 2, height: 4),
          const SizedBox(height: 22),
          Text('차량과 서류', style: mv(28, 800, ls: -0.035)),
          const SizedBox(height: 8),
          Text(
            '등록한 차종과 같은 콜만 받아요',
            style: mv(15, 600, color: colors.textMuted),
          ),
          const SizedBox(height: 22),
          Text('차종', style: mv(14, 800)),
          const SizedBox(height: 10),
          VehicleChips(
            selected: _vehicle,
            onChanged: (vehicle) => setState(() => _vehicle = vehicle),
          ),
          const SizedBox(height: 22),
          MovoField(
            label: '차량 번호',
            controller: _number,
            hint: '서울 81바 2047',
            maxLength: 20,
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: 22),
          Text('서류', style: mv(14, 800)),
          const SizedBox(height: 10),
          MovoAsync<List<DriverDocument>>(
            controller: _reload,
            load: () async {
              final documents = await context.api.drivers.documents();
              if (mounted) setState(() => _documents = documents);
              return documents;
            },
            builder: (context, documents) => DocumentRows(
              documents: _documents,
              onChanged: (documents) => setState(() => _documents = documents),
            ),
          ),
        ],
      ),
    );
  }
}

/// 차종을 고르는 칩.
class VehicleChips extends StatelessWidget {
  const VehicleChips({
    super.key,
    required this.selected,
    required this.onChanged,
  });

  final VehicleType? selected;
  final ValueChanged<VehicleType> onChanged;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: [
      for (final vehicle in vehicleChoices)
        MovoChip(
          vehicleLabel(vehicle),
          selected: vehicle == selected,
          height: 37,
          radius: 14,
          horizontalPadding: 14,
          onTap: () => onChanged(vehicle),
        ),
    ],
  );
}

/// 서류를 골라 올린다. 올린 뒤의 서류 상태를 돌려주고, 고르지 않았거나 실패했으면 null.
Future<List<DriverDocument>?> uploadDocument(
  BuildContext context,
  DriverDocumentType type,
) async {
  final api = context.api;
  final file = await documentPicker.pick(context);
  if (file == null || !context.mounted) return null;
  return runAction(context, () => api.drivers.uploadDocument(type, file));
}
