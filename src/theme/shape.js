// Radios ya usados en index.css: 8px (controles, botones, items de menú),
// 12px (cards, tablas) y 100px (badges tipo píldora). MUI solo tiene un
// borderRadius base; el resto queda como token custom para consumir con
// useTheme() donde se necesite un radio distinto al base.

export const shape = {
  borderRadius: 8,
  custom: {
    sm: 8,
    md: 12,
    pill: 999,
  },
};
