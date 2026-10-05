import { Box, Typography } from "@mui/material";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        height: 42,
        flexShrink: 0,
        px: 3,
        fontSize: 12,
        color: "text.secondary",
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Typography component="span" fontSize={12}>
        Pamo
      </Typography>
      <Typography component="span" fontSize={12} sx={{ opacity: 0.7 }}>
        Beta interna
      </Typography>
    </Box>
  );
}
