import { Box, Button, Typography } from "@mui/material";

// Elegir un PDF para cargarlo (guías del panel de pedidos).
export default function FileField({ label, file, onChange }) {
  return (
    <Box>
      <Typography variant="caption" color="textSecondary" component="div">
        {label}
      </Typography>
      <Button size="small" variant="outlined" component="label">
        {file ? file.name : "Elegir archivo"}
        <input hidden type="file" accept="application/pdf" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </Button>
    </Box>
  );
}
