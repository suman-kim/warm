import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

/// 취소·환불 규정. 언제 취소하느냐에 따른 수수료와 대기료·추가 요금을 서버의 요금 규칙으로 보여준다.
/// 운영자가 올린 규정 전문(약관·정책의 '취소·환불 규정')은 아래 링크로 본다.
class RefundPolicyScreen extends StatelessWidget {
  const RefundPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '취소·환불 규정',
      child: MovoAsync<ChargeRules>(
        load: () => chargeRulesOf(context.api),
        builder: (context, rules) {
          final percent = rules.cancellationFeePercent;
          final stages = [
            ('배차 전', '수수료 없음', _Badge.plain, '아직 결제 전이라 언제 취소해도 요금이 나가지 않아요.'),
            ('배차 후 · 기사 출발 전', '수수료 0원', _Badge.plain, '결제 금액을 모두 환불해요.'),
            (
              '기사 출발 후 · 픽업 전',
              '수수료 $percent%',
              _Badge.lime,
              '요금의 $percent%를 뺀 금액을 환불해요.',
            ),
            (
              '픽업 후',
              '취소 불가',
              _Badge.plain,
              '물품을 실은 뒤에는 앱에서 취소할 수 없어요. 문제가 생기면 고객센터로 알려 주세요.',
            ),
            (
              '노쇼',
              '요금 100%',
              _Badge.danger,
              '기사님이 도착하고 ${rules.noShowWaitMinutes}분이 지나도 물품을 받지 못하면 노쇼로 처리돼요. 결제한 요금은 환불되지 않아요.',
            ),
          ];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '언제 취소하느냐에 따라 달라요',
                style: mv(13, 700, color: colors.textMuted),
              ),
              const SizedBox(height: 10),
              MovoRows(
                children: [
                  for (final (title, badge, tone, body) in stages)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(title, style: mv(15, 800))),
                              _BadgeTag(badge, tone),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            body,
                            style: mv(
                              14,
                              500,
                              color: colors.textSecondary,
                              height: 1.55,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              MovoRows(
                children: [
                  _Faq(
                    '대기료는 얼마인가요?',
                    '기사님이 픽업지에 도착하고 ${rules.freeWaitingMinutes}분까지는 무료예요. 그 뒤로는 1분에 ${won(rules.waitingFeePerMinute)}씩 붙고, 픽업할 때 결제돼요.',
                  ),
                  _Faq(
                    '추가 요금은 언제 붙나요?',
                    '과적, 큰 짐 운반, 계단처럼 요청할 때와 실제가 다르면 기사님이 추가 요금을 넣을 수 있어요. 픽업할 때 같은 카드로 결제되고 알림으로 내역을 알려 드려요. '
                        '과적 한 단계 ${won(rules.overloadUnitPrice)}, 큰 짐 한 개 ${won(rules.bulkyUnitPrice)}, 계단 한 층 ${won(rules.stairsUnitPrice)}이에요.',
                  ),
                  _Faq('환불은 언제 들어오나요?', '결제한 카드로 환불돼요. 카드사에 따라 3~7영업일 걸려요.'),
                ],
              ),
              const SizedBox(height: 12),
              MovoRows(
                children: [
                  MovoMenuRow(
                    '취소·환불 규정 전문',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const LegalDocumentScreen(
                          type: LegalDocumentType.refund,
                        ),
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
}

enum _Badge { plain, lime, danger }

class _BadgeTag extends StatelessWidget {
  const _BadgeTag(this.label, this.tone);

  final String label;
  final _Badge tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoTag(
      label,
      background: switch (tone) {
        _Badge.plain => colors.surfaceMuted,
        _Badge.lime => MovoPalette.lime,
        _Badge.danger => MovoPalette.dangerSoft,
      },
      foreground: switch (tone) {
        _Badge.plain => colors.textSecondary,
        _Badge.lime => MovoPalette.ink,
        _Badge.danger => MovoPalette.danger,
      },
      fontSize: 11,
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      radius: 7,
    );
  }
}

class _Faq extends StatelessWidget {
  const _Faq(this.question, this.answer);

  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(question, style: mv(15, 800)),
        const SizedBox(height: 6),
        Text(
          answer,
          style: mv(14, 500, color: context.colors.textSecondary, height: 1.55),
        ),
      ],
    ),
  );
}

/// 사업자 정보 (전자상거래법 표시 의무). 서버에 적은 값을 보여준다.
class BusinessInfoScreen extends StatelessWidget {
  const BusinessInfoScreen({super.key});

  @override
  Widget build(BuildContext context) => MovoPage(
    title: '사업자 정보',
    child: MovoAsync<BusinessInfo>(
      load: context.api.support.business,
      builder: (context, info) {
        final rows = [
          ('상호', info.name),
          ('대표자', info.representative),
          ('사업자등록번호', info.registrationNumber),
          ('통신판매업 신고', info.mailOrderNumber),
          ('주소', info.address),
          (
            '고객센터',
            [?info.phone, ?info.hours].join(' · ').isEmpty
                ? null
                : [?info.phone, ?info.hours].join(' · '),
          ),
          ('이메일', info.email),
        ];
        return MovoRows(
          children: [
            for (final (label, value) in rows)
              MovoKeyValue(label, value ?? '—', verticalPadding: 15),
          ],
        );
      },
    ),
  );
}
