import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'vehicle_docs_screen.dart';

/// 서류 목록. 종류마다 상태를 보여주고, 올려야 하는 서류에는 '사진 올리기'가 붙는다.
class DocumentRows extends StatefulWidget {
  const DocumentRows({
    super.key,
    required this.documents,
    required this.onChanged,
    this.reviewed = false,
    this.replaced = const {},
  });

  final List<DriverDocument> documents;

  /// 서류를 올린 뒤의 새 상태.
  final ValueChanged<List<DriverDocument>> onChanged;

  /// 심사를 거친 뒤의 화면인지. true면 '등록됨' 대신 '확인됨'·'심사 중'으로 보여준다.
  final bool reviewed;

  /// 반려된 뒤 이 화면에서 새로 올린 서류 — '교체됨'으로 보여준다.
  final Set<DriverDocumentType> replaced;

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
    final known = [
      for (final document in widget.documents)
        if (document.type != DriverDocumentType.unknown) document,
    ];
    return MovoRows(
      radius: 20,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      children: [
        for (final document in known)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                const MovoIconTile(
                  MovoIcons.document,
                  size: 40,
                  radius: 12,
                  iconSize: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(documentLabel(document.type), style: mv(15, 700)),
                      if (widget.replaced.contains(document.type)) ...[
                        const SizedBox(height: 3),
                        Text(
                          '반려됨 → 새 사진 올림',
                          style: mv(12, 700, color: colors.textMuted),
                        ),
                      ] else if (document.status ==
                          DriverDocumentStatus.rejected) ...[
                        const SizedBox(height: 3),
                        Text(
                          '반려됨 · 다시 올려주세요',
                          style: mv(12, 700, color: colors.textMuted),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                if (_uploading == document.type)
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: colors.text,
                    ),
                  )
                else if (document.needsUpload)
                  Pressable(
                    onTap: _uploading == null
                        ? () => _upload(document.type)
                        : null,
                    child: Container(
                      height: 34,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: colors.text,
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          MovoIcon(
                            MovoIcons.upload,
                            size: 14,
                            color: colors.background,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '사진 올리기',
                            style: mv(13, 800, color: colors.background),
                          ),
                        ],
                      ),
                    ),
                  )
                else if (widget.replaced.contains(document.type))
                  _Mark('교체됨', strong: true)
                else if (!widget.reviewed)
                  _Mark('등록됨', strong: true)
                else
                  _Mark(
                    document.status == DriverDocumentStatus.approved
                        ? '확인됨'
                        : '심사 중',
                    strong: false,
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Mark extends StatelessWidget {
  const _Mark(this.label, {required this.strong});

  final String label;

  /// 강조색과 체크 표시로 그릴지.
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    if (!strong) {
      return Text(label, style: mv(13, 700, color: colors.textMuted));
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        MovoIcon(MovoIcons.check, size: 12, color: colors.accentText),
        const SizedBox(width: 5),
        Text(label, style: mv(13, 800, color: colors.accentText)),
      ],
    );
  }
}
