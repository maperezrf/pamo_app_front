import { Box, Typography } from "@mui/material";
import BrandMark from "../../../components/brand/BrandMark";
import AuthHero from "./AuthHero";

// Marco de las pantallas sin sesión (login, no autorizado). En escritorio
// divide la pantalla en dos mitades: contenido a la izquierda, ilustración a
// la derecha; en móvil (< md) solo el contenido.
export default function AuthLayout({ children }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
        bgcolor: "background.paper",
      }}
    >
      <Box
        component="main"
        sx={{ display: "flex", flexDirection: "column", px: { xs: 3, sm: 6 }, py: { xs: 4, sm: 5 } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <BrandMark size={36} />
          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>Pamo</Typography>
        </Box>

        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
          <Box sx={{ width: "100%", maxWidth: 360 }}>{children}</Box>
        </Box>

        <Typography variant="caption" color="textSecondary">
          © {new Date().getFullYear()} Pamo · Uso interno
        </Typography>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <AuthHero />
      </Box>
    </Box>
  );
}
