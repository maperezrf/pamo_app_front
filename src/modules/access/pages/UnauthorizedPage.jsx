import { Box, Button, Link, Paper, Typography } from "@mui/material";

export default function UnauthorizedPage({ onBack }) {
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
      <Typography sx={{ fontSize: 32, mb: 1.5 }} aria-hidden="true">
        🔒
      </Typography>
      <Typography variant="h5" component="h1" fontWeight={700} gutterBottom>
        Perfil no autorizado
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3.5 }}>
        Tu cuenta de Google no tiene acceso a Pamo. Debés solicitar acceso al
        equipo para poder entrar.
      </Typography>
      <Link href="mailto:soporte@pamo.com" color="primary" underline="none">
        Solicitar acceso
      </Link>
      <Box sx={{ mt: 3 }}>
        <Button variant="outlined" color="inherit" onClick={onBack}>
          Volver
        </Button>
      </Box>
    </Paper>
  );
}
