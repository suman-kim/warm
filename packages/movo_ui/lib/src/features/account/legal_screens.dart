import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';

import '../../app/async_view.dart';
import '../../app/format.dart';
import '../../app/session.dart';
import '../../design/colors.dart';
import '../../design/icons.dart';
import '../../design/states.dart';
import '../../design/widgets.dart';

/// 약관·정책 목록 (내 정보 > 약관 및 정책).
class LegalListScreen extends StatelessWidget {
  const LegalListScreen({super.key});

  @override
  Widget build(BuildContext context) => MovoPage(
    title: '약관 및 정책',
    scrollable: false,
    padding: EdgeInsets.zero,
    child: MovoAsync<List<LegalDocumentSummary>>(
      load: context.api.legal.documents,
      builder: (context, documents) {
        final known = [
          for (final document in documents)
            if (document.type != LegalDocumentType.unknown) document,
        ];
        if (known.isEmpty) return const _NotReady();
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            MovoRows(
              children: [
                for (final document in known)
                  MovoMenuRow(
                    document.title,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            LegalDocumentScreen(type: document.type),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        );
      },
    ),
  );
}

/// 약관·정책 한 건의 본문. 가입 화면의 '보기'에서도 연다 (로그인 없이 볼 수 있다).
class LegalDocumentScreen extends StatelessWidget {
  const LegalDocumentScreen({super.key, required this.type});

  final LegalDocumentType type;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: legalLabel(type),
      scrollable: false,
      padding: EdgeInsets.zero,
      child: MovoAsync<LegalDocument?>(
        load: () => context.api.legal.document(type),
        builder: (context, document) {
          if (document == null) return const _NotReady();
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Text(document.title, style: mv(22, 800, ls: -0.02, height: 1.3)),
              const SizedBox(height: 8),
              Text(
                '시행일 ${document.effectiveAt.toLocal().year}년 ${monthDay(document.effectiveAt)} · ${document.version}',
                style: mv(13, 600, color: colors.textMuted),
              ),
              const SizedBox(height: 20),
              Text(
                document.body,
                style: mv(15, 500, color: colors.textSecondary, height: 1.7),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _NotReady extends StatelessWidget {
  const _NotReady();

  @override
  Widget build(BuildContext context) => const MovoStateView(
    icon: MovoIcons.document,
    title: '아직 준비 중이에요',
    body: '곧 내용을 볼 수 있어요',
    compact: true,
  );
}
