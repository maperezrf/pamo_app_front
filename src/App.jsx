import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Typography } from "@mui/material";
import { api } from "./core/api/api";
import AppShell from "./app/layouts/AppShell";
import LoginPage from "./modules/access/pages/LoginPage";
import UnauthorizedPage from "./modules/access/pages/UnauthorizedPage";
import HomePage from "./modules/home/pages/HomePage";
import OrdersPage from "./modules/orders/pages/OrdersPage";

// authed: null = verificando sesión, false = sin sesión, true = con sesión
export default function App() {
  const [authed, setAuthed] = useState(null);
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState([]);
  const navigate = useNavigate();

  const loadMenu = () => {
    api.menu().then(({ ok, data }) => {
      if (ok) setMenu(data);
    });
  };

  useEffect(() => {
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
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setMenu([]);
    setAuthed(false);
    navigate("/login");
  };

  if (authed === null) {
    return (
      <Typography color="textSecondary" fontSize={14}>
        Cargando…
      </Typography>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authed ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage
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
        element={<UnauthorizedPage onBack={() => navigate("/login")} />}
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
        <Route path="/" element={<HomePage user={user} />} />
        <Route path="/orders" element={<OrdersPage />} />
      </Route>
    </Routes>
  );
}
