import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import Dashboard from "./screens/Dashboard";
import Login from "./screens/Login";
import Unauthorized from "./screens/Unauthorized";
import AppShell from "./shared/layout/AppShell";

// authed: null = verificando sesión, false = sin sesión, true = con sesión
export default function App() {
  const [authed, setAuthed] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.fetchCsrfCookie().then(() => {
      api.me().then(({ ok, data }) => {
        if (ok) {
          setUser(data);
          setAuthed(true);
        } else {
          setAuthed(false);
        }
      });
    });
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
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
            <AppShell user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<Dashboard user={user} />} />
      </Route>
    </Routes>
  );
}
