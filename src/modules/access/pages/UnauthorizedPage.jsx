import { Box, Button, Link, Typography } from "@mui/material";
import AuthLayout from "../../../app/layouts/AuthLayout";

export default function UnauthorizedPage({ onBack }) {
  return (
    <AuthLayout>
      <Typography variant="h4" component="h1" fontWeight={700}>
        Perfil no autorizado
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mt: 1, mb: 4 }}>
        Tu cuenta de Google no tiene acceso a Pamo. Solicita acceso al equipo
        para poder entrar.
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
        <Button variant="contained" component={Link} href="mailto:soporte@pamo.com" underline="none">
          Solicitar acceso
        </Button>
        <Button variant="outlined" color="inherit" onClick={onBack}>
          Volver
        </Button>
      </Box>
    </AuthLayout>
  );
}
