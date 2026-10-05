// Paleta única de Pamo. Valores tomados de los custom properties que ya
// existían en src/index.css (--accent, --danger, etc.) y de los colores de
// estado usados en los badges (.role-badge.yes, .estado-badge.activo).
// No hay variantes de marca: si se necesita una nueva, se agrega acá, no
// como hex suelto en un componente.

export const palette = {
  primary: {
    main: "#3454d1",
    contrastText: "#ffffff",
  },
  error: {
    main: "#b3432f",
    light: "#f9e7e3",
  },
  success: {
    main: "#1f7a6c",
    light: "#dcf0ec",
  },
  background: {
    default: "#f4f5f7",
    paper: "#ffffff",
  },
  text: {
    primary: "#1a1f27",
    secondary: "#5b6472",
  },
  divider: "#e2e5ea",
};
