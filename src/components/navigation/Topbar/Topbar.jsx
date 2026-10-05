import { AppBar, Box, Button, IconButton, Toolbar, Typography, useMediaQuery } from "@mui/material";

const MOBILE_QUERY = "(max-width:768px)";

export default function Topbar({ user, onLogout, onToggleMobileNav }) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Toolbar sx={{ minHeight: "60px !important", px: 3, gap: 2 }}>
        {isMobile && (
          <IconButton
            onClick={onToggleMobileNav}
            aria-label="Abrir menú"
            size="small"
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              width: 32,
              height: 32,
              color: "text.secondary",
            }}
          >
            ☰
          </IconButton>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, ml: "auto" }}>
          <Typography fontSize={13} color="textSecondary">
            {user?.email}
          </Typography>
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            onClick={onLogout}
            sx={{
              borderColor: "divider",
              color: "text.secondary",
              "&:hover": { borderColor: "error.main", color: "error.main" },
            }}
          >
            Cerrar sesión
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
