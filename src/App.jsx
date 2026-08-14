import { useEffect, useState } from "react";
import { api } from "./api";
import Dashboard from "./screens/Dashboard";
import Login from "./screens/Login";
import Unauthorized from "./screens/Unauthorized";

// "checking" | "login" | "unauthorized" | "authorized"
export default function App() {
  const [screen, setScreen] = useState("checking");
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.fetchCsrfCookie().then(() => {
      api.me().then(({ ok, data }) => {
        if (ok) {
          setUser(data);
          setScreen("authorized");
        } else {
          setScreen("login");
        }
      });
    });
  }, []);

  if (screen === "checking") {
    return <p className="loading-text">Cargando…</p>;
  }

  if (screen === "authorized") {
    return (
      <Dashboard
        user={user}
        onLoggedOut={() => {
          setUser(null);
          setScreen("login");
        }}
      />
    );
  }

  if (screen === "unauthorized") {
    return <Unauthorized onBack={() => setScreen("login")} />;
  }

  return (
    <Login
      onAuthorized={(loggedUser) => {
        setUser(loggedUser);
        setScreen("authorized");
      }}
      onUnauthorized={() => setScreen("unauthorized")}
    />
  );
}
