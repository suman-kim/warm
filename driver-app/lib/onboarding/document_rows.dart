import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../services.dart';

/// 라이더가 내는 서류 세 가지 (이 순서로 보여 준다).
const riderDocuments = [
  DriverDocumentType.driverLicense,
  DriverDocumentType.vehicleRegistration,
  DriverDocumentType.deliveryInsurance,
];

/// 서류마다 어떻게 찍으면 되는지.
String documentHint(DriverDocumentType type) => switch (type) {
  DriverDocumentType.driverLicense => '앞면이 잘 보이게 찍어 주세요',
  DriverDocumentType.vehicleRegistration => '차량번호가 보이게 찍어 주세요',
  DriverDocumentType.deliveryInsurance => '보험 기간과 차량번호가 보이게 올려 주세요',
  DriverDocumentType.unknown => '사진이나 PDF로 올려 주세요',
};

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

/// 서류 목록. 올린 서류는 [올림](누르면 다시 올린다), 올려야 하는 서류는 [올리기].
/// 반려된 서류는 사유를 함께 보여 준다.
class DocumentRows extends StatefulWidget {
  const DocumentRows({
    super.key,
    required this.documents,
    required this.onChanged,
  });

  final List<DriverDocument> documents;

  /// 서류를 올린 뒤의 새 상태.
  final ValueChanged<List<DriverDocument>> onChanged;

  @override
  State<DocumentRows> createState() => _DocumentRowsState();
}

class _DocumentRowsState extends State<DocumentRows> {
  DriverDocumentType? _uploading;

  Future<void> _upload(DriverDocumentType type) async {
    setState(() => _uploading = type);
    final documents = await uploadDocument(context, type);
    if (!mounted) return;
    setState(() => _uploading = null);
    if (documents != null) widget.onChanged(documents);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoRows(
      radius: 22,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      children: [
        for (final type in riderDocuments)
          _row(
            colors,
            type,
            widget.documents.where((d) => d.type == type).firstOrNull,
          ),
      ],
    );
  }

  Widget _row(MovoColors colors, DriverDocumentType type, DriverDocument? doc) {
    final uploaded = doc != null && !doc.needsUpload;
    final rejected = doc?.status == DriverDocumentStatus.rejected;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          MovoIconTile(
            MovoIcons.document,
            size: 40,
            radius: 12,
            iconSize: 20,
            background: colors.surfaceMuted,
            foreground: MovoPalette.lime,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(documentLabel(type), style: mv(15, 800, height: 1.35)),
                const SizedBox(height: 3),
                Text(
                  uploaded
                      ? '올렸어요 · 누르면 다시 올려요'
                      : rejected
                      ? '반려됨 · ${doc?.rejectionReason ?? documentHint(type)}'
                      : documentHint(type),
                  style: mv(
                    12,
                    600,
                    color: rejected && !uploaded
                        ? MovoPalette.dangerOnNight
                        : colors.textMuted,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (_uploading == type)
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: MovoPalette.lime,
              ),
            )
          else
            Semantics(
              button: true,
              label: '${documentLabel(type)} ${uploaded ? '다시 올리기' : '올리기'}',
              child: Pressable(
                onTap: _uploading == null ? () => _upload(type) : null,
                child: Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: uploaded ? colors.surfaceMuted : MovoPalette.lime,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      MovoIcon(
                        uploaded ? MovoIcons.check : MovoIcons.camera,
                        size: uploaded ? 12 : 15,
                        color: uploaded ? MovoPalette.lime : MovoPalette.ink,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        uploaded ? '올림' : '올리기',
                        style: mv(
                          13,
                          800,
                          color: uploaded ? MovoPalette.lime : MovoPalette.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 낸 서류를 본다 (마이). 필요하면 다시 올린다.
class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  List<DriverDocument>? _updated;

  @override
  Widget build(BuildContext context) => MovoPage(
    title: '서류',
    child: MovoAsync<List<DriverDocument>>(
      load: context.api.drivers.documents,
      builder: (context, documents) => DocumentRows(
        documents: _updated ?? documents,
        onChanged: (documents) => setState(() => _updated = documents),
      ),
    ),
  );
}
