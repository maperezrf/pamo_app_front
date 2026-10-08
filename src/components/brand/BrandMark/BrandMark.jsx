import { Box } from "@mui/material";

// Marca de Pamo mientras no exista un logo oficial: la "P" sobre el color
// primario. `size` en px; la letra escala con el cuadro.
export default function BrandMark({ size = 28 }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size >= 40 ? 1.5 : 1,
        bgcolor: "primary.main",
        color: "primary.contrastText",
        fontSize: Math.round(size / 2),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      P
    </Box>
  );
}
