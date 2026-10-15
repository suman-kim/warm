import 'package:flutter/material.dart';
import 'package:movo_api/movo_api.dart';
import 'package:movo_ui/movo_ui.dart';

import 'driver_scope.dart';
import 'onboarding/review_screens.dart';
import 'onboarding/vehicle_docs_screen.dart';
import 'shell.dart';

/// 로그인한 기사를 가입 단계에 맞는 화면으로 보낸다:
/// 차량·서류 등록 → 승인 대기 → (반려되면 재신청) → 승인되면 홈.
class DriverGate extends StatefulWidget {
  const DriverGate({super.key});

  @override
  State<DriverGate> createState() => _DriverGateState();
}

class _DriverGateState extends State<DriverGate> {
  late final _controller = DriverController(context.api)..refresh();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _controller,
    builder: (context, _) {
      if (!_controller.loaded) {
        final error = _controller.error;
        return Scaffold(
          body: error == null
              ? const MovoLoading()
              : MovoErrorView(error, onRetry: _controller.refresh),
        );
      }
      final driver = _controller.driver;
      return switch (driver?.status) {
        null => VehicleDocsScreen(controller: _controller),
        DriverStatus.pending => ReviewPendingScreen(
          controller: _controller,
          driver: driver!,
        ),
        DriverStatus.rejected => ReviewRejectedScreen(
          controller: _controller,
          driver: driver!,
        ),
        _ => DriverShell(controller: _controller),
      };
    },
  );
}
