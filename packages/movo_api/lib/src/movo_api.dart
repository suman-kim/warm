import 'package:http/http.dart' as http;

import 'api/auth_api.dart';
import 'api/drivers_api.dart';
import 'api/orders_api.dart';
import 'api/resources.dart';
import 'api_transport.dart';
import 'models/enums.dart';
import 'secure_token_store.dart';
import 'token_store.dart';

/// MOVO 서버 API. 앱마다 하나를 만들어 앱이 떠 있는 동안 계속 쓴다.
///
/// ```dart
/// final api = MovoApi(
///   baseUrl: Uri.parse('https://api.example.com/api'),
///   appRole: UserRole.customer,
/// );
/// await api.auth.login(email: email, password: password);
/// final orders = await api.orders.list();
/// ```
///
/// 로그인한 뒤의 호출에는 토큰이 자동으로 붙고, 만료되면 자동으로 갱신된다.
class MovoApi {
  /// [appRole]은 이 앱이 누구의 앱인지다 (고객 앱은 [UserRole.customer], 기사 앱은
  /// [UserRole.driver]). 가입은 이 역할로 되고, 다른 역할의 계정은 로그인할 수 없다.
  ///
  /// [tokenStore]를 주지 않으면 기기의 보안 저장소에 토큰을 둔다.
  MovoApi({
    required Uri baseUrl,
    required UserRole appRole,
    TokenStore? tokenStore,
    http.Client? httpClient,
    Duration timeout = const Duration(seconds: 15),
  }) : assert(appRole == UserRole.customer || appRole == UserRole.driver),
       baseUrl = baseUrl,
       _transport = ApiTransport(
         baseUrl: baseUrl,
         tokenStore: tokenStore ?? SecureTokenStore(),
         httpClient: httpClient,
         timeout: timeout,
       ) {
    auth = AuthApi(_transport, appRole);
    users = UsersApi(_transport);
    vehicleTypes = VehicleTypesApi(_transport);
    drivers = DriversApi(_transport);
    orders = OrdersApi(_transport);
    dispatch = DispatchApi(_transport);
    pushDevices = PushDevicesApi(_transport);
    notifications = NotificationsApi(_transport);
    savedAddresses = SavedAddressesApi(_transport);
    addressSearch = AddressSearchApi(_transport);
    notices = NoticesApi(_transport);
    legal = LegalApi(_transport, appRole);
    support = SupportApi(_transport);
    paymentMethods = PaymentMethodsApi(_transport);
  }

  final ApiTransport _transport;

  /// 서버 주소 (`.../api`). PG사 창처럼 웹 페이지를 띄울 때 그 페이지의 출처로 쓴다.
  final Uri baseUrl;

  // 두 앱이 함께 쓰는 것
  late final AuthApi auth;
  late final UsersApi users;
  late final VehicleTypesApi vehicleTypes;
  late final PushDevicesApi pushDevices;
  late final NotificationsApi notifications;
  late final SavedAddressesApi savedAddresses;

  /// 주소·장소 검색 (고객 앱의 출발지·도착지, 자주 쓰는 주소)
  late final AddressSearchApi addressSearch;
  late final NoticesApi notices;
  late final LegalApi legal;
  late final SupportApi support;

  /// 배송 요청과 조회 (고객 앱). 주문 상세·추적·메시지는 기사 앱도 쓴다.
  late final OrdersApi orders;

  /// 결제 카드 등록·관리
  late final PaymentMethodsApi paymentMethods;

  // 기사 앱
  late final DriversApi drivers;
  late final DispatchApi dispatch;

  /// 로그인이 풀리면(리프레시 토큰 만료·폐기) 알린다. 앱의 한 곳에서 구독해 로그인 화면으로 보낸다.
  Stream<void> get sessionExpired => _transport.sessionExpired;

  void close() => _transport.close();
}
