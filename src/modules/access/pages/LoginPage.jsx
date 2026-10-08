import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import AuthLayout from "../../../app/layouts/AuthLayout";

export default function LoginPage({ onAuthorized, onUnauthorized }) {
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

    setError("No se pudo iniciar sesión. Inténtalo de nuevo.");
  };

  return (
    <AuthLayout>
      <Typography variant="h4" component="h1" fontWeight={700}>
        Bienvenido
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mt: 1, mb: 4 }}>
        Inicia sesión con tu cuenta de Google de Pamo para continuar.
      </Typography>

      <Box sx={{ display: "flex" }}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError("Google no pudo completar el inicio de sesión.")}
          size="large"
          shape="rectangular"
          text="signin_with"
          locale="es"
          width="320"
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2.5 }}>
          {error}
        </Alert>
      )}

      <Typography variant="body2" color="textSecondary" sx={{ mt: 4 }}>
        Solo el equipo de Pamo tiene acceso. Si tu cuenta no está autorizada,
        pide acceso al administrador.
      </Typography>
    </AuthLayout>
  );
}
