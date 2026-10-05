import { Box } from "@mui/material";

export default function BrandMark() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 1,
        bgcolor: "primary.main",
        color: "primary.contrastText",
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      P
    </Box>
  );
}
