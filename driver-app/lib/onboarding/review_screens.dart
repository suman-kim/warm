import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../driver_scope.dart';
import 'document_rows.dart';

/// 가입 심사 화면들의 뼈대: 로고, 로그아웃, 스크롤되는 본문, 아래 버튼.
class _ReviewPage extends StatelessWidget {
  const _ReviewPage({required this.children, required this.bottom});

  final List<Widget> children;
  final Widget bottom;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const MovoLogo(size: 24, badge: '기사'),
                      Pressable(
                        onTap: () async {
                          final confirmed = await showMovoConfirm(
                            context,
                            title: '로그아웃할까요?',
                            confirmLabel: '로그아웃',
                          );
                          if (confirmed && context.mounted) {
                            await context.session.logout();
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text(
                            '로그아웃',
                            style: mv(13, 700, color: colors.textMuted),
                          ),
                        ),
                      ),
                    ],
                  ),
                  ...children,
                ],
              ),
            ),
            MovoBottomBar(child: bottom),
          ],
        ),
      ),
    );
  }
}

class _VehicleCard extends StatelessWidget {
  const _VehicleCard(this.driver);

  final Driver driver;

  @override
  Widget build(BuildContext context) => MovoCard(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    child: Row(
      children: [
        MovoIconTile(
          vehicleIcon(driver.vehicleType),
          size: 46,
          radius: 15,
          iconSize: 24,
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '등록 차량',
                style: mv(12, 700, color: context.colors.textMuted),
              ),
              const SizedBox(height: 3),
              Text(
                '${vehicleLabel(driver.vehicleType)} · ${plate(driver.vehicleNumber)}',
                style: mv(16, 800),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// 승인 대기. 승인되면 알림이 오고, 이 화면도 주기적으로 확인해 홈으로 넘어간다.
class ReviewPendingScreen extends StatefulWidget {
  const ReviewPendingScreen({
    super.key,
    required this.controller,
    required this.driver,
  });

  final DriverController controller;
  final Driver driver;

  @override
  State<ReviewPendingScreen> createState() => _ReviewPendingScreenState();
}

class _ReviewPendingScreenState extends State<ReviewPendingScreen> {
  late final Timer _timer = Timer.periodic(
    const Duration(seconds: 10),
    (_) => widget.controller.refresh(),
  );

  @override
  void initState() {
    super.initState();
    _timer;
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final driver = widget.driver;
    return _ReviewPage(
      bottom: MovoButton(
        '제출 서류 보기',
        kind: MovoButtonKind.surface,
        fontSize: 16,
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const DocumentsScreen()),
        ),
      ),
      children: [
        const SizedBox(height: 32),
        Text('가입 심사 중', style: mv(13, 800, color: colors.accentText)),
        const SizedBox(height: 10),
        Text('제출하신 서류를\n확인하고 있어요', style: mv(28, 800, ls: -0.035, height: 1.3)),
        const SizedBox(height: 10),
        Text(
          '승인되면 알림으로 알려드려요. 그다음 운행을 시작하면 콜을 받을 수 있어요.',
          style: mv(15, 500, color: colors.textMuted, height: 1.6),
        ),
        const SizedBox(height: 24),
        MovoCard(
          radius: 26,
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 6),
          child: Column(
            children: [
              _Step(
                state: _StepState.done,
                title: '회원 가입',
                note: monthDayClock(context.session.user!.createdAt),
              ),
              _Step(
                state: _StepState.done,
                title: '서류 제출',
                note: '운전면허증 · 자동차등록증 · 화물운송 자격증',
              ),
              const _Step(
                state: _StepState.current,
                title: '승인 심사',
                note: '검토 중이에요',
              ),
              const _Step(
                state: _StepState.todo,
                title: '운행 시작',
                note: '승인 후 바로 시작할 수 있어요',
                last: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        _VehicleCard(driver),
      ],
    );
  }
}

enum _StepState { done, current, todo }

class _Step extends StatelessWidget {
  const _Step({
    required this.state,
    required this.title,
    required this.note,
    this.last = false,
  });

  final _StepState state;
  final String title;
  final String note;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = colors.isDark ? MovoPalette.lime : colors.text;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 24,
            child: Column(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: switch (state) {
                      _StepState.done => MovoPalette.lime,
                      _StepState.current => null,
                      _StepState.todo => colors.progressOff,
                    },
                    border: state == _StepState.current
                        ? Border.all(color: accent, width: 2)
                        : null,
                  ),
                  child: switch (state) {
                    _StepState.done => const MovoIcon(
                      MovoIcons.check,
                      size: 13,
                      color: MovoPalette.ink,
                    ),
                    _StepState.current => const MovoLiveDot(ring: false),
                    _StepState.todo => null,
                  },
                ),
                if (!last)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: state == _StepState.done
                          ? MovoPalette.lime
                          : colors.progressOff,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 16 : 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: mv(
                      16,
                      800,
                      color: state == _StepState.todo ? colors.textMuted : null,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    note,
                    style: state == _StepState.current
                        ? mv(13, 700, color: colors.accentText)
                        : mv(13, 600, color: colors.textMuted, height: 1.5),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 심사 반려. 사유를 보여주고, 문제가 된 서류만 다시 올려 재신청한다.
class ReviewRejectedScreen extends StatefulWidget {
  const ReviewRejectedScreen({
    super.key,
    required this.controller,
    required this.driver,
  });

  final DriverController controller;
  final Driver driver;

  @override
  State<ReviewRejectedScreen> createState() => _ReviewRejectedScreenState();
}

class _ReviewRejectedScreenState extends State<ReviewRejectedScreen> {
  List<DriverDocument>? _documents;

  /// 이 화면에서 새로 올린 서류.
  final _replaced = <DriverDocumentType>{};

  /// 처음 열었을 때 반려돼 있던 서류의 수 (제목에 쓴다).
  int _rejectedCount = 0;
  Object? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final documents = await context.api.drivers.documents();
      if (!mounted) return;
      setState(() {
        _documents = documents;
        _rejectedCount = documents.where((d) => d.needsUpload).length;
        _error = null;
      });
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  void _onUploaded(List<DriverDocument> documents) {
    final before = _documents ?? const [];
    setState(() {
      for (final document in documents) {
        final was = before.where((d) => d.type == document.type).firstOrNull;
        if ((was?.needsUpload ?? false) && !document.needsUpload) {
          _replaced.add(document.type);
        }
      }
      _documents = documents;
    });
  }

  Future<void> _reapply() async {
    setState(() => _busy = true);
    final api = context.api;
    final driver = await runAction(
      context,
      () => api.drivers.register(
        vehicleType: widget.driver.vehicleType,
        vehicleNumber: widget.driver.vehicleNumber,
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (driver != null) widget.controller.set(driver);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final documents = _documents;
    if (documents == null) {
      final error = _error;
      return Scaffold(
        body: error == null
            ? const MovoLoading()
            : MovoErrorView(error, onRetry: _load),
      );
    }
    final ready = documents.every((document) => !document.needsUpload);
    return _ReviewPage(
      bottom: MovoButton(
        '재신청하기',
        onPressed: ready ? _reapply : null,
        loading: _busy,
      ),
      children: [
        const SizedBox(height: 30),
        Text('가입 심사 결과', style: mv(13, 800, color: colors.textMuted)),
        const SizedBox(height: 10),
        Text(switch (_rejectedCount) {
          0 => '신청 내용을\n다시 확인해 주세요',
          1 => '서류 한 가지를\n다시 올려주세요',
          final count => '서류 $count가지를\n다시 올려주세요',
        }, style: mv(28, 800, ls: -0.035, height: 1.3)),
        const SizedBox(height: 10),
        Text(
          '사유를 확인하고 서류를 다시 올린 뒤 재신청해 주세요.',
          style: mv(15, 500, color: colors.textMuted, height: 1.6),
        ),
        const SizedBox(height: 22),
        MovoCard(
          color: colors.surfaceMuted,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.text,
                  shape: BoxShape.circle,
                ),
                child: Text('!', style: mv(15, 900, color: colors.background)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('반려 사유', style: mv(12, 700, color: colors.textFaint)),
                    const SizedBox(height: 4),
                    Text(
                      widget.driver.rejectionReason ?? '사유가 적혀 있지 않아요.',
                      style: mv(15, 700, height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Text('제출 서류', style: mv(14, 800)),
        const SizedBox(height: 10),
        DocumentRows(
          documents: documents,
          onChanged: _onUploaded,
          reviewed: true,
          replaced: _replaced,
        ),
      ],
    );
  }
}

/// 제출한 서류의 상태를 본다. 필요하면 다시 올린다.
class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  List<DriverDocument>? _updated;

  @override
  Widget build(BuildContext context) => MovoPage(
    title: '제출 서류',
    scrollable: false,
    padding: EdgeInsets.zero,
    child: MovoAsync<List<DriverDocument>>(
      load: context.api.drivers.documents,
      builder: (context, documents) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          DocumentRows(
            documents: _updated ?? documents,
            reviewed: true,
            onChanged: (documents) => setState(() => _updated = documents),
          ),
        ],
      ),
    ),
  );
}
