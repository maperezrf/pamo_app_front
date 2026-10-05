import { Chip } from "@mui/material";

// Tonos de estado sobre la paleta del tema. Agregar un tono aquí solo si la
// paleta ya tiene el color (ver docs/patterns/THEME.md).
const TONES = {
  success: { bgcolor: "success.light", color: "success.main" },
  error: { bgcolor: "error.light", color: "error.main" },
  neutral: { bgcolor: "background.default", color: "text.secondary", border: 1, borderColor: "divider" },
};

export default function StatusChip({ label, tone = "neutral", title }) {
  return (
    <Chip
      label={label}
      title={title}
      size="small"
      sx={{ fontSize: 12, fontWeight: 600, ...(TONES[tone] ?? TONES.neutral) }}
    />
  );
}
