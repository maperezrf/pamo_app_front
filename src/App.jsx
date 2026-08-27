import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
import Dashboard from "./screens/Dashboard";
import Login from "./screens/Login";
import Prototipos from "./screens/Prototipos";
import Unauthorized from "./screens/Unauthorized";
import AppShell from "./shared/layout/AppShell";

const RemittancesOperationsScreen = lazy(() => import("./areas/remittances/screens/RemittancesOperationsScreen"));
const RemittanceAccountingScreen = lazy(() => import("./areas/remittances/screens/RemittanceAccountingScreen"));
const RecipientRemittanceScreen = lazy(() => import("./areas/remittances/screens/RecipientRemittanceScreen"));

// authed: null = verificando sesión, false = sin sesión, true = con sesión
export default function App() {
  const [authed, setAuthed] = useState(null);
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const isPublicRecipientRoute = /^\/remisiones\/firmar\/[^/]+\/?$/.test(location.pathname);

  const loadMenu = () => {
    api.menu().then(({ ok, data }) => {
      if (ok) setMenu(data);
    });
  };

  useEffect(() => {
    if (isPublicRecipientRoute) return;
    api.fetchCsrfCookie().then(() => {
      api.me().then(({ ok, data }) => {
        if (ok) {
          setUser(data);
          setAuthed(true);
          loadMenu();
        } else {
          setAuthed(false);
        }
      });
    });
  }, [isPublicRecipientRoute]);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setMenu([]);
    setAuthed(false);
    navigate("/login");
  };

  if (isPublicRecipientRoute) {
    return (
      <Routes>
        <Route
          path="/remisiones/firmar/:token"
          element={<Suspense fallback={<div className="loading-text">Abriendo remisión segura…</div>}><RecipientRemittanceScreen /></Suspense>}
        />
      </Routes>
    );
  }

  if (authed === null) {
    return <p className="loading-text">Cargando…</p>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authed ? (
            <Navigate to="/" replace />
          ) : (
            <Login
              onAuthorized={(loggedUser) => {
                setUser(loggedUser);
                setAuthed(true);
                loadMenu();
                navigate("/");
              }}
              onUnauthorized={() => navigate("/unauthorized")}
            />
          )
        }
      />
      <Route
        path="/unauthorized"
        element={<Unauthorized onBack={() => navigate("/login")} />}
      />
      <Route
        element={
          authed ? (
            <AppShell user={user} menu={menu} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/prototipos" element={<Prototipos />} />
        <Route path="/prototipos/remisiones" element={<Suspense fallback={<div className="card">Abriendo Remisiones…</div>}><RemittancesOperationsScreen /></Suspense>} />
        <Route path="/prototipos/facturacion-remisiones" element={<Suspense fallback={<div className="card">Abriendo Facturación de remisiones…</div>}><RemittanceAccountingScreen /></Suspense>} />
        <Route path="/remisiones" element={<Navigate to="/prototipos/remisiones" replace />} />
        <Route path="/contabilidad/remisiones" element={<Navigate to="/prototipos/facturacion-remisiones" replace />} />
      </Route>
    </Routes>
  );
}
