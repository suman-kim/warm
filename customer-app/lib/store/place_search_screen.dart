import 'dart:async';

import 'package:flutter/material.dart';
import 'package:movo_ui/movo_ui.dart';

import '../places.dart';

/// 주소를 검색해서 하나 고른다 (가게 주소, 손님 주소). 고른 곳을 돌려준다.
/// [origin]을 주면 결과마다 거기서의 거리를 붙이고, [maxKm]보다 멀면 표시한다.
/// 검색어가 없으면 [recent](최근 배달한 주소 등)를 보여준다.
class PlaceSearchScreen extends StatefulWidget {
  const PlaceSearchScreen({
    super.key,
    required this.title,
    this.origin,
    this.maxKm,
    this.recentTitle = '최근 배달한 주소',
    this.recent = const [],
  });

  final String title;
  final Place? origin;
  final double? maxKm;
  final String recentTitle;
  final List<Place> recent;

  @override
  State<PlaceSearchScreen> createState() => _PlaceSearchScreenState();
}

class _PlaceSearchScreenState extends State<PlaceSearchScreen> {
  final _query = TextEditingController();
  Timer? _debounce;
  List<Place>? _results;
  bool _searching = false;
  Object? _error;
  int _seq = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _onChanged(String text) {
    _debounce?.cancel();
    // 입력이 잠깐 멈추면 찾는다.
    _debounce = Timer(const Duration(milliseconds: 250), () => _search(text));
  }

  Future<void> _search(String text) async {
    final query = text.trim();
    final seq = ++_seq;
    if (query.isEmpty) {
      setState(() {
        _results = null;
        _error = null;
      });
      return;
    }
    setState(() => _searching = true);
    try {
      final found = await context.api.addressSearch.search(query);
      if (!mounted || seq != _seq) return;
      setState(() {
        _results = [for (final f in found) Place.fromFound(f)];
        _error = null;
        _searching = false;
      });
    } on Object catch (error) {
      if (!mounted || seq != _seq) return;
      setState(() {
        _error = error;
        _searching = false;
      });
    }
  }

  String _sub(Place place) {
    final parts = <String>[
      if (place.dong?.isNotEmpty ?? false) place.dong!,
      if (place.detail?.isNotEmpty ?? false) place.detail!,
    ];
    final origin = widget.origin;
    if (origin != null) {
      final km = origin.distanceKmTo(place);
      parts.add('가게에서 ${km.toStringAsFixed(1)}km');
    }
    return parts.join(' · ');
  }

  bool _tooFar(Place place) {
    final origin = widget.origin, maxKm = widget.maxKm;
    return origin != null &&
        maxKm != null &&
        origin.distanceKmTo(place) > maxKm;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final results = _results;
    final showRecent = results == null && _query.text.trim().isEmpty;
    final places = showRecent ? widget.recent : (results ?? const <Place>[]);
    return MovoPage(
      title: widget.title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.text, width: 2),
            ),
            child: Row(
              children: [
                const MovoIcon(MovoIcons.search, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _query,
                    autofocus: true,
                    onChanged: _onChanged,
                    style: mv(16, 600),
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: '도로명이나 건물명으로 검색',
                      hintStyle: mv(16, 600, color: colors.placeholder),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (showRecent && widget.recent.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
              child: Text(
                widget.recentTitle,
                style: mv(13, 700, color: colors.textMuted),
              ),
            ),
          if (_error != null)
            MovoErrorView(_error!, onRetry: () => _search(_query.text))
          else if (_searching && results == null)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: MovoLoading(),
            )
          else if (!showRecent && places.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Column(
                children: [
                  Text('검색 결과가 없어요', style: mv(16, 800)),
                  const SizedBox(height: 6),
                  Text(
                    '도로명이나 건물명을 다시 확인해 주세요',
                    style: mv(13, 600, color: colors.textMuted),
                  ),
                ],
              ),
            )
          else if (places.isNotEmpty)
            MovoRows(
              children: [
                for (final place in places)
                  Pressable(
                    onTap: () => Navigator.of(context).pop(place),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      child: Row(
                        children: [
                          MovoIconTile(
                            MovoIcons.pin,
                            size: 36,
                            radius: 10,
                            iconSize: 18,
                            background: colors.surfaceMuted,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(place.address, style: mv(15, 800)),
                                const SizedBox(height: 2),
                                Text(
                                  _sub(place),
                                  style: mv(12, 600, color: colors.textMuted),
                                ),
                              ],
                            ),
                          ),
                          if (_tooFar(place))
                            const MovoTag(
                              '10km 밖',
                              background: MovoPalette.dangerSoft,
                              foreground: MovoPalette.danger,
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
