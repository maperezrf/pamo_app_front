// Punto de entrada del sistema de diseño. Los componentes consumen el tema
// distribuido por AppThemeProvider (vía props semánticas, `sx` o
// useTheme()); nunca importan `palette.js` directamente.

import { createTheme } from "@mui/material/styles";
import { palette } from "./palette";
import { typography } from "./typography";
import { shape } from "./shape";
import { customShadows } from "./shadows";

export function createAppTheme() {
  return createTheme({
    palette: {
      mode: "light",
      ...palette,
    },
    typography,
    shape: {
      borderRadius: shape.borderRadius,
    },
    customShape: shape.custom,
    customShadows,
  });
}
