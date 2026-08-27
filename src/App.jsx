import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import Dashboard from "./screens/Dashboard";
import Login from "./screens/Login";
import Prototipos from "./screens/Prototipos";
import Unauthorized from "./screens/Unauthorized";
import AppShell from "./shared/layout/AppShell";
import CatalogWorkspace from "./areas/catalogo/screens/CatalogWorkspace";

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
        <Route path="/catalogo-multicanal" element={<CatalogWorkspace user={user} />} />
      </Route>
    </Routes>
  );
}
