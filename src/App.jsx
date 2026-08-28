import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import Dashboard from "./screens/Dashboard";
import Login from "./screens/Login";
import Prototipos from "./screens/Prototipos";
import Unauthorized from "./screens/Unauthorized";
import AppShell from "./shared/layout/AppShell";
import CatalogWorkspace from "./areas/catalogo/screens/CatalogWorkspace";
import OrdersWorkspace from "./areas/pedidos/screens/OrdersWorkspace";
import SalesDashboard from "./areas/pedidos/screens/SalesDashboard";
import WhatsAppSettings from "./areas/communications/WhatsAppSettings";
import ShippingDeliveryWorkspace from "./areas/shippingDelivery/screens/ShippingDeliveryWorkspace";
import "./areas/communications/whatsapp-settings.css";
import "./areas/pedidos/styles/orders.css";

// authed: null = verificando sesión, false = sin sesión, true = con sesión
export default function App() {
  const [authed, setAuthed] = useState(null);
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState([]);
  const [bootstrapError, setBootstrapError] = useState("");
  const navigate = useNavigate();
  const localDemoEnabled = import.meta.env.VITE_LOCAL_DEMO_AUTH === "true";

  const loadMenu = () => {
    api.menu().then(({ ok, data }) => {
      if (ok) setMenu(data);
    });
  };

  const bootstrap = () => {
    setBootstrapError("");
    setAuthed(null);
    api.fetchCsrfCookie()
      .then(() => api.me())
      .then(({ ok, data }) => {
        if (ok) {
          setUser(data);
          setAuthed(true);
          loadMenu();
        } else {
          setAuthed(false);
        }
      })
      .catch(() => {
        setBootstrapError("No fue posible conectar con el backend local.");
        setAuthed(false);
      });
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setMenu([]);
    setAuthed(false);
    navigate("/login");
  };

  if (authed === null) {
    return <p className="loading-text">Cargando…</p>;
  }

  if (bootstrapError) {
    return (
      <div className="card">
        <h1>Entorno local no disponible</h1>
        <p className="subtitle">{bootstrapError}</p>
        <button type="button" className="local-demo-login" onClick={bootstrap}>
          Reintentar conexión
        </button>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authed ? (
            <Navigate to={localDemoEnabled ? "/ventas/pedidos" : "/"} replace />
          ) : (
            <Login
              onAuthorized={(loggedUser, options = {}) => {
                setUser(loggedUser);
                setAuthed(true);
                loadMenu();
                navigate(options.destination ?? "/");
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
        <Route path="/catalogo-multicanal" element={<CatalogWorkspace user={user} />} />
        <Route path="/ventas" element={<SalesDashboard />} />
        <Route path="/ventas/pedidos" element={<OrdersWorkspace user={user} />} />
        <Route path="/integraciones/whatsapp" element={<WhatsAppSettings />} />
        <Route path="/envios-entrega" element={<ShippingDeliveryWorkspace user={user} />} />
      </Route>
    </Routes>
  );
}
