import { useEffect, useState } from "react";
import { api } from "../api";

export default function Dashboard({ user }) {
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    api.pingAdmin().then(({ ok }) => setIsAdmin(ok));
  }, []);

  return (
    <div>
      <h1>Bienvenido</h1>
      <p className="subtitle">Sesión iniciada correctamente</p>
      <p className="dashboard-email">{user?.email}</p>
      <div>
        {isAdmin === null && (
          <span className="role-badge no">Verificando rol…</span>
        )}
        {isAdmin === true && <span className="role-badge yes">Sos Admin</span>}
        {isAdmin === false && <span className="role-badge no">No sos Admin</span>}
      </div>
    </div>
  );
}
