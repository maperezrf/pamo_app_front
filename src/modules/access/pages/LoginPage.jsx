import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { api } from "../../../core/api/api";

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

    setError("No se pudo iniciar sesión. Intentá de nuevo.");
  };

  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        maxWidth: 380,
        width: "100%",
        p: 5,
        textAlign: "center",
        borderRadius: 1.5,
        boxShadow: theme.customShadows.card,
      })}
    >
      <Typography variant="h5" component="h1" fontWeight={700} gutterBottom>
        Pamo
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3.5 }}>
        Iniciá sesión con tu cuenta de Google
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError("Google no pudo completar el inicio de sesión.")}
        />
      </Box>
      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Paper>
  );
}
