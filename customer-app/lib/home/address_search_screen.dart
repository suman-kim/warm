import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import '../order/order_steps.dart';
import '../places.dart';

enum AddressSlot { pickup, dropoff }

/// 주소 검색 — 배송 요청의 첫 단계. 홈에서 고른 서비스로 시작해 출발지와 도착지를 한 화면에서
/// 번갈아 검색한다. 둘 다 정해지면 [onComplete]로 다음 단계(배송 정보)로 넘긴다.
class AddressSearchScreen extends StatefulWidget {
  const AddressSearchScreen({
    super.key,
    required this.service,
    required this.onComplete,
    this.pickup,
    this.dropoff,
    this.editing = AddressSlot.pickup,
  });

  final ServiceType service;

  /// 출발지와 도착지가 모두 정해졌을 때. 이 화면을 다음 단계로 바꿔 끼운다.
  final void Function(BuildContext context, Place pickup, Place dropoff)
  onComplete;

  final Place? pickup;
  final Place? dropoff;

  /// 처음에 입력할 칸.
  final AddressSlot editing;

  @override
  State<AddressSearchScreen> createState() => _AddressSearchScreenState();
}

class _AddressSearchScreenState extends State<AddressSearchScreen> {
  late Place? _pickup = widget.pickup;
  late Place? _dropoff = widget.dropoff;
  late AddressSlot _editing = widget.editing;
  final _query = TextEditingController();

  /// 칸마다 따로 둔다. 입력란은 고르는 칸에만 있어, 칸을 바꾸면 입력란이 새로 생긴다 — 노드를 함께 쓰면
  /// 새 입력란은 포커스가 '이미 있는' 노드를 받아 키보드에 이어지지 않는다 (한 번 더 눌러야 했다).
  final _focus = {
    AddressSlot.pickup: FocusNode(),
    AddressSlot.dropoff: FocusNode(),
  };
  List<Place> _results = const [];
  String? _error;

  /// 마지막으로 입력한 검색어와, 지금 보이는 결과의 검색어.
  String _typed = '';
  String? _shownFor;
  int _searchSeq = 0;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _query.addListener(_onQuery);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _focus[_editing]!.requestFocus(),
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    for (final node in _focus.values) {
      node.dispose();
    }
    super.dispose();
  }

  /// 입력이 잠깐 멈추면 찾는다 — 글자마다 서버(카카오)를 부르지 않는다.
  void _onQuery() {
    final query = _query.text.trim();
    if (query == _typed) return;
    _typed = query;
    _debounce?.cancel();
    if (query.isEmpty) {
      _searchSeq++;
      setState(() {
        _results = const [];
        _error = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () => _search(query));
  }

  Future<void> _search(String query) async {
    final seq = ++_searchSeq;
    final api = context.api;
    try {
      final found = await api.addressSearch.search(query);
      // 늦게 온 앞선 검색의 결과로 덮어쓰지 않는다.
      if (!mounted || seq != _searchSeq) return;
      setState(() {
        _results = [for (final each in found) Place.fromFound(each)];
        _error = null;
        _shownFor = query;
      });
    } on MovoException catch (error) {
      if (!mounted || seq != _searchSeq) return;
      setState(() {
        _results = const [];
        _error = errorMessage(error);
        _shownFor = query;
      });
    }
  }

  Place? get _other => _editing == AddressSlot.pickup ? _dropoff : _pickup;

  void _edit(AddressSlot slot) {
    setState(() {
      _editing = slot;
      _query.clear();
    });
    // 새 칸의 입력란이 그려진 뒤에 그 칸의 노드로 포커스를 옮긴다 — 키보드가 새 입력란에 이어진다.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus[slot]!.requestFocus();
    });
  }

  void _choose(Place place) {
    final other = _editing == AddressSlot.pickup ? _dropoff : _pickup;
    if (other != null &&
        other.address == place.address &&
        other.detail == place.detail) {
      showMovoToast(context, '출발지와 도착지가 같아요');
      return;
    }
    setState(() {
      if (_editing == AddressSlot.pickup) {
        _pickup = place;
      } else {
        _dropoff = place;
      }
    });
    final pickup = _pickup, dropoff = _dropoff;
    if (pickup != null && dropoff != null) {
      widget.onComplete(context, pickup, dropoff);
    } else {
      _edit(
        _editing == AddressSlot.pickup
            ? AddressSlot.dropoff
            : AddressSlot.pickup,
      );
    }
  }

  Future<void> _pickSaved() async {
    final api = context.api;
    final saved = await runAction(context, api.savedAddresses.list);
    if (saved == null || !mounted) return;
    if (saved.isEmpty) {
      showMovoToast(context, '저장한 주소가 없어요. 내 정보에서 추가할 수 있어요.');
      return;
    }
    final picked = await showModalBottomSheet<SavedAddress>(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: context.colors.scrim,
      builder: (context) => _SavedSheet(saved),
    );
    if (picked != null) _choose(Place.fromSaved(picked));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final query = _query.text.trim();
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MovoTopBar(title: serviceLabel(widget.service)),
            const Padding(
              padding: EdgeInsets.fromLTRB(24, 6, 24, 0),
              child: OrderSteps(step: 1),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(6, 0, 6, 4),
                    child: Text(
                      '어디서 어디로\n보낼까요?',
                      style: mv(24, 800, ls: -0.03, height: 1.3),
                    ),
                  ),
                  const SizedBox(height: 12),
                  MovoRows(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 4,
                    ),
                    children: [
                      _slot(AddressSlot.pickup, '출발', _pickup),
                      _slot(AddressSlot.dropoff, '도착', _dropoff),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _Shortcut(
                        MovoIcons.target,
                        '지도에서 선택',
                        onTap: () =>
                            showMovoToast(context, '지도를 연결한 뒤에 쓸 수 있어요.'),
                      ),
                      const SizedBox(width: 8),
                      _Shortcut(
                        MovoIcons.bookmark,
                        '자주 쓰는 주소',
                        onTap: _pickSaved,
                      ),
                    ],
                  ),
                  if (_results.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    MovoRows(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 2,
                      ),
                      children: [
                        for (final place in _results)
                          _Result(
                            place,
                            query: query,
                            from: _other,
                            onTap: () => _choose(place),
                          ),
                      ],
                    ),
                  ] else if (query.isNotEmpty && query == _shownFor) ...[
                    const SizedBox(height: 48),
                    Text(
                      _error ?? '검색 결과가 없어요',
                      textAlign: TextAlign.center,
                      style: mv(15, 700, color: colors.textMuted),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _slot(AddressSlot slot, String label, Place? place) {
    final colors = context.colors;
    final editing = _editing == slot;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: editing ? _focus[slot]!.requestFocus : () => _edit(slot),
      child: SizedBox(
        height: 56,
        child: Row(
          children: [
            SizedBox(
              width: 20,
              child: Center(
                child: slot == AddressSlot.pickup
                    ? const MovoWaypointDot.pickup()
                    : const MovoWaypointDot.dropoff(size: 11),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: editing
                        ? mv(11, 800)
                        : mv(11, 700, color: colors.textMuted),
                  ),
                  const SizedBox(height: 2),
                  if (editing)
                    TextField(
                      controller: _query,
                      focusNode: _focus[slot],
                      autocorrect: false,
                      textInputAction: TextInputAction.search,
                      cursorWidth: 2,
                      cursorHeight: 17,
                      style: mv(15, 700, color: colors.text, height: 1.2),
                      decoration: InputDecoration.collapsed(
                        hintText: place == null
                            ? '도로명이나 건물 이름'
                            : shortAddress(place.address),
                        hintStyle: mv(
                          15,
                          600,
                          color: place == null
                              ? colors.placeholder
                              : colors.textMuted,
                          height: 1.2,
                        ),
                      ),
                    )
                  else
                    Text(
                      place == null ? '눌러서 입력' : shortAddress(place.address),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: mv(
                        15,
                        600,
                        color: place == null ? colors.placeholder : colors.text,
                        height: 1.2,
                      ),
                    ),
                ],
              ),
            ),
            if (editing && _query.text.isNotEmpty)
              Semantics(
                button: true,
                label: '지우기',
                excludeSemantics: true,
                child: Pressable(
                  onTap: _query.clear,
                  child: Container(
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: colors.surfaceMuted,
                      shape: BoxShape.circle,
                    ),
                    child: MovoIcon(
                      MovoIcons.close,
                      size: 12,
                      color: colors.textSecondary,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Shortcut extends StatelessWidget {
  const _Shortcut(this.icon, this.label, {required this.onTap});

  final MovoIcons icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Pressable(
    onTap: onTap,
    child: Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(13),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          MovoIcon(icon, size: 16),
          const SizedBox(width: 7),
          Text(label, style: mv(13, 700)),
        ],
      ),
    ),
  );
}

class _Result extends StatelessWidget {
  const _Result(
    this.place, {
    required this.query,
    required this.from,
    required this.onTap,
  });

  final Place place;
  final String query;

  /// 반대쪽 주소. 있으면 거기서부터의 거리를 보여준다.
  final Place? from;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final title = streetAddress(place.address);
    final match = query.isEmpty ? -1 : title.indexOf(query);
    final detail = [?place.detail, ?place.dong].join(' · ');
    return Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            const MovoIconTile(MovoIcons.pin, size: 36, radius: 12),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      style: mv(15, 600, color: colors.textSecondary),
                      children: match < 0
                          ? [TextSpan(text: title)]
                          : [
                              TextSpan(text: title.substring(0, match)),
                              TextSpan(
                                text: title.substring(
                                  match,
                                  match + query.length,
                                ),
                                style: mv(15, 800, color: colors.text),
                              ),
                              TextSpan(
                                text: title.substring(match + query.length),
                              ),
                            ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (detail.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: mv(12, 600, color: colors.textMuted),
                    ),
                  ],
                ],
              ),
            ),
            if (from case final from?) ...[
              const SizedBox(width: 10),
              Text(
                km(from.distanceKmTo(place)),
                style: mv(12, 700, color: colors.textMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SavedSheet extends StatelessWidget {
  const _SavedSheet(this.saved);

  final List<SavedAddress> saved;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.7,
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        MediaQuery.paddingOf(context).bottom + 16,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const MovoSheetHandle(),
          const SizedBox(height: 20),
          Text('자주 쓰는 주소', style: mv(20, 800, ls: -0.02)),
          const SizedBox(height: 8),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final address in saved)
                  Pressable(
                    onTap: () => Navigator.of(context).pop(address),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        children: [
                          const MovoIconTile(MovoIcons.bookmark),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(address.label, style: mv(15, 700)),
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
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
