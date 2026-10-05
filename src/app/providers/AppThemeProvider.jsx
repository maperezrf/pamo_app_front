import { ThemeProvider, CssBaseline } from "@mui/material";
import { createAppTheme } from "../../theme";

const theme = createAppTheme();

export default function AppThemeProvider({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
