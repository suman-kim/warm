import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../places.dart';

/// 자주 쓰는 주소. 이름을 붙여 저장해 두고 주소 검색에서 불러 쓴다.
class SavedAddressesScreen extends StatefulWidget {
  const SavedAddressesScreen({super.key});

  @override
  State<SavedAddressesScreen> createState() => _SavedAddressesScreenState();
}

class _SavedAddressesScreenState extends State<SavedAddressesScreen> {
  final _reload = MovoAsyncController();

  @override
  void dispose() {
    _reload.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final place = await Navigator.of(context).push(
      MaterialPageRoute<Place>(builder: (_) => const _PlacePickerScreen()),
    );
    if (place == null || !mounted) return;
    final label = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: context.colors.scrim,
      builder: (_) => _LabelSheet(place),
    );
    if (label == null || !mounted) return;
    final api = context.api;
    final saved = await runAction(
      context,
      () => api.savedAddresses.add(
        SavedAddressInput(
          label: label,
          address: place.address,
          detailAddress: place.detail,
          sigungu: place.sigungu,
          dong: place.dong,
          latitude: place.latitude,
          longitude: place.longitude,
        ),
      ),
    );
    if (saved != null) _reload.reload();
  }

  Future<void> _remove(SavedAddress address) async {
    final confirmed = await showMovoConfirm(
      context,
      title: "'${address.label}'을 지울까요?",
      confirmLabel: '지우기',
    );
    if (!confirmed || !mounted) return;
    final api = context.api;
    await runAction(context, () => api.savedAddresses.remove(address.id));
    _reload.reload();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '자주 쓰는 주소',
      scrollable: false,
      padding: EdgeInsets.zero,
      bottom: MovoButton('주소 추가', onPressed: _add),
      child: MovoAsync<List<SavedAddress>>(
        controller: _reload,
        load: context.api.savedAddresses.list,
        builder: (context, addresses) {
          if (addresses.isEmpty) {
            return const MovoStateView(
              icon: MovoIcons.bookmark,
              title: '저장한 주소가 없어요',
              body: '자주 보내는 곳을 저장해 두세요',
              compact: true,
            );
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              MovoRows(
                radius: 24,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 4,
                ),
                children: [
                  for (final address in addresses)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        children: [
                          const MovoIconTile(MovoIcons.bookmark),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  address.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: mv(15, 700),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  shortAddress(address.address),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: mv(13, 500, color: colors.textMuted),
                                ),
                              ],
                            ),
                          ),
                          Semantics(
                            button: true,
                            label: '${address.label} 지우기',
                            excludeSemantics: true,
                            child: Pressable(
                              onTap: () => _remove(address),
                              child: Padding(
                                padding: const EdgeInsets.all(8),
                                child: MovoIcon(
                                  MovoIcons.close,
                                  size: 14,
                                  color: colors.textMuted,
                                ),
                              ),
                            ),
                          ),
                        ],
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

/// 주소 한 곳을 검색해 고른다.
class _PlacePickerScreen extends StatefulWidget {
  const _PlacePickerScreen();

  @override
  State<_PlacePickerScreen> createState() => _PlacePickerScreenState();
}

class _PlacePickerScreenState extends State<_PlacePickerScreen> {
  final _query = TextEditingController();
  List<Place> _results = const [];
  String? _error;
  int _seq = 0;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  /// 입력이 잠깐 멈추면 찾는다 — 글자마다 서버(카카오)를 부르지 않는다.
  void _onChanged(String text) {
    _debounce?.cancel();
    final query = text.trim();
    if (query.isEmpty) {
      _seq++;
      setState(() {
        _results = const [];
        _error = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () => _search(query));
  }

  Future<void> _search(String query) async {
    final seq = ++_seq;
    final api = context.api;
    try {
      final found = await api.addressSearch.search(query);
      if (!mounted || seq != _seq) return;
      setState(() {
        _results = [for (final each in found) Place.fromFound(each)];
        _error = null;
      });
    } on MovoException catch (error) {
      if (!mounted || seq != _seq) return;
      setState(() {
        _results = const [];
        _error = errorMessage(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return MovoPage(
      title: '주소 검색',
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MovoField(
            label: '주소',
            controller: _query,
            hint: '도로명이나 건물 이름',
            autofocus: true,
            onChanged: _onChanged,
            textInputAction: TextInputAction.search,
          ),
          if (_results.isNotEmpty) ...[
            const SizedBox(height: 12),
            MovoRows(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
              children: [
                for (final place in _results)
                  Pressable(
                    onTap: () => Navigator.of(context).pop(place),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        children: [
                          const MovoIconTile(
                            MovoIcons.pin,
                            size: 36,
                            radius: 12,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  shortAddress(place.address),
                                  style: mv(15, 700),
                                ),
                                if (place.detail ?? place.dong case final sub?)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 3),
                                    child: Text(
                                      sub,
                                      style: mv(
                                        12,
                                        600,
                                        color: colors.textMuted,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
          if (_error case final error?) ...[
            const SizedBox(height: 20),
            Text(
              error,
              textAlign: TextAlign.center,
              style: mv(14, 700, color: colors.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}

/// 저장할 주소에 붙일 이름을 받는다.
class _LabelSheet extends StatefulWidget {
  const _LabelSheet(this.place);

  final Place place;

  @override
  State<_LabelSheet> createState() => _LabelSheetState();
}

class _LabelSheetState extends State<_LabelSheet> {
  final _label = TextEditingController();

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  void _done() {
    final label = _label.text.trim();
    if (label.isEmpty) {
      showMovoToast(context, '주소에 붙일 이름을 입력해 주세요.');
      return;
    }
    Navigator.of(context).pop(label);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          MediaQuery.paddingOf(context).bottom + 20,
        ),
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const MovoSheetHandle(),
            const SizedBox(height: 20),
            Text('이름 붙이기', style: mv(20, 800, ls: -0.02)),
            const SizedBox(height: 6),
            Text(
              shortAddress(widget.place.address),
              style: mv(14, 600, color: colors.textMuted),
            ),
            const SizedBox(height: 14),
            MovoField(
              label: '이름',
              controller: _label,
              hint: '예: 역삼 사무실',
              autofocus: true,
              maxLength: 30,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _done(),
            ),
            const SizedBox(height: 16),
            MovoButton('저장', onPressed: _done),
          ],
        ),
      ),
    );
  }
}
