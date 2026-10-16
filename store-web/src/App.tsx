import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./auth/session";
import { Shell } from "./layout/Shell";
import { BoardPage } from "./pages/BoardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { StorePage } from "./pages/StorePage";
import { WalletPage } from "./pages/WalletPage";

export function App() {
  const { user } = useSession();
  // 저장해 둔 로그인이 유효한지 확인하는 동안에는 아무것도 그리지 않는다.
  if (user === undefined) return null;
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/board" replace /> : <LoginPage />}
      />
      <Route element={user ? <Shell /> : <Navigate to="/login" replace />}>
        <Route path="/board" element={<BoardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/store" element={<StorePage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={user ? "/board" : "/login"} replace />}
      />
    </Routes>
  );
}
