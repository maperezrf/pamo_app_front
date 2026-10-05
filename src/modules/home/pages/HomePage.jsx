import { useEffect, useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
import { api } from "../../../core/api/api";

const successChipSx = { bgcolor: "success.light", color: "success.main" };
const neutralChipSx = { bgcolor: "background.default", color: "text.secondary" };

export default function HomePage({ user }) {
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    api.pingAdmin().then(({ ok }) => setIsAdmin(ok));
  }, []);

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        Bienvenido
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3.5 }}>
        Sesión iniciada correctamente
      </Typography>
      <Typography
        component="p"
        sx={{
          fontFamily: "ui-monospace, Consolas, monospace",
          fontSize: 13,
          bgcolor: "background.default",
          border: 1,
          borderColor: "divider",
          borderRadius: 0.75,
          px: 1.5,
          py: 1,
          mb: 2,
          wordBreak: "break-all",
        }}
      >
        {user?.email}
      </Typography>
      <Box>
        {isAdmin === null && (
          <Chip label="Verificando rol…" size="small" sx={{ fontSize: 12, fontWeight: 600, ...neutralChipSx }} />
        )}
        {isAdmin === true && (
          <Chip label="Sos Admin" size="small" sx={{ fontSize: 12, fontWeight: 600, ...successChipSx }} />
        )}
        {isAdmin === false && (
          <Chip label="No sos Admin" size="small" sx={{ fontSize: 12, fontWeight: 600, ...neutralChipSx }} />
        )}
      </Box>
    </Box>
  );
}
