import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { AdminArea } from "./api/types";
import { InvitePage } from "./auth/InvitePage";
import { LoginPage } from "./auth/LoginPage";
import { useSession } from "./auth/session";
import { homePath } from "./layout/menu";
import { Shell } from "./layout/Shell";
import { AdminsPage } from "./pages/admins/AdminsPage";
import { MembersPage } from "./pages/members/MembersPage";
import { NoticesPage } from "./pages/notices/NoticesPage";
import { OrderDetailPage } from "./pages/orders/OrderDetailPage";
import { OrdersPage } from "./pages/orders/OrdersPage";
import { ReviewDetailPage } from "./pages/review/ReviewDetailPage";
import { ReviewListPage } from "./pages/review/ReviewListPage";
import { SettlePage } from "./pages/settle/SettlePage";
import { TermsPage } from "./pages/terms/TermsPage";

export function App() {
  const { me } = useSession();
  // 저장해 둔 로그인이 유효한지 확인하는 동안에는 아무것도 그리지 않는다.
  if (me === undefined) {
    return null;
  }
  const home = me ? homePath(me.areas) : "/login";
  /** 권한이 있는 메뉴만 연다. 없으면 첫 화면으로 보낸다. */
  const guarded = (area: AdminArea, page: ReactNode) =>
    me?.areas.includes(area) ? page : <Navigate to={home} replace />;

  return (
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/login"
        element={me ? <Navigate to={home} replace /> : <LoginPage />}
      />
      <Route element={me ? <Shell /> : <Navigate to="/login" replace />}>
        <Route path="/review" element={guarded("REVIEW", <ReviewListPage />)} />
        <Route
          path="/review/:id"
          element={guarded("REVIEW", <ReviewDetailPage />)}
        />
        <Route path="/orders" element={guarded("ORDERS", <OrdersPage />)} />
        <Route
          path="/orders/:id"
          element={guarded("ORDERS", <OrderDetailPage />)}
        />
        <Route path="/members" element={guarded("MEMBERS", <MembersPage />)} />
        <Route
          path="/settle"
          element={guarded("SETTLEMENTS", <SettlePage />)}
        />
        <Route path="/notices" element={guarded("NOTICES", <NoticesPage />)} />
        <Route path="/terms" element={guarded("TERMS", <TermsPage />)} />
        <Route path="/admins" element={guarded("ADMINS", <AdminsPage />)} />
      </Route>
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
