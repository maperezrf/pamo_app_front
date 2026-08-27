import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { api } from "../api";

export default function Login({ onAuthorized, onUnauthorized }) {
  const [error, setError] = useState(null);

  const handleSuccess = async (credentialResponse) => {
    setError(null);
    const { ok, status, data } = await api.loginWithGoogle(
      credentialResponse.credential
    );

    if (ok && data?.authorized) {
      onAuthorized(data.user);
      return;
    }

    if (status === 403) {
      onUnauthorized();
      return;
    }

    setError("No se pudo iniciar sesión. Intentá de nuevo.");
  };

  const handleLocalDemo = async () => {
    setError(null);
    const { ok, data } = await api.loginLocalDemo();
    if (ok && data?.authorized) {
      onAuthorized(data.user);
      return;
    }
    setError("No se pudo abrir el entorno local. Ejecuta la preparación de datos.");
  };

  return (
    <div className="card">
      <h1>Pamo</h1>
      <p className="subtitle">Iniciá sesión con tu cuenta de Google</p>
      <div className="login-actions">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError("Google no pudo completar el inicio de sesión.")}
        />
      </div>
      {import.meta.env.VITE_LOCAL_DEMO_AUTH === "true" && (
        <button type="button" className="local-demo-login" onClick={handleLocalDemo}>
          Entrar al entorno local controlado
        </button>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
