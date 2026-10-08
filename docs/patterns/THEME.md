# Patrón: tema centralizado (MUI)

Ubicación: `src/theme/` (paleta, tipografía, forma y sombras) y
`src/app/providers/AppThemeProvider.jsx` (distribuye el tema con
`ThemeProvider` + `CssBaseline`, montado en `main.jsx`).

Pamo usa una única paleta (no hay selector de temas ni variantes de marca).
Los valores de `src/theme/palette.js` fueron tomados de los custom
properties que ya existían en `index.css` (`--accent`, `--danger`, etc.) y de
los colores de estado usados en los badges existentes — no son colores
nuevos.

## Regla de consumo

Un componente nuevo o migrado a MUI consume el tema, nunca un hex suelto:

```jsx
// correcto
<Button color="primary" variant="contained">Guardar</Button>
<Box sx={{ color: "text.secondary", borderRadius: 2 }}>...</Box>

// incorrecto
<Button sx={{ backgroundColor: "#3454d1" }}>Guardar</Button>
```

Para valores fuera de la paleta estándar de MUI (radios y sombras propias),
usar `useTheme()`:

```jsx
const theme = useTheme();
theme.customShape.pill; // 999
theme.customShadows.card;
```

### Trampa: el prop `color` de `Typography` no acepta rutas con punto

`sx={{ color: "text.secondary" }}` sí resuelve la ruta del tema, pero el
prop corto `color` de `Typography` **no** — solo acepta un enum fijo
(`primary`, `secondary`, `textSecondary`, `error`, `success`, `info`,
`warning`, …) o, si no reconoce el valor, lo usa como color CSS literal, que
el navegador ignora en silencio (sin error, sin warning — el texto
simplemente hereda el color del padre). Pasar `color="text.secondary"` o
`color="error.main"` a `Typography` no falla nada, pero tampoco pinta nada.
Correcto: `color="textSecondary"`, `color="error"`. Esto pasó en la
migración inicial de `LoginPage`/`UnauthorizedPage`/`HomePage`/
`Topbar`/`DataTable` y se detectó recién al verificar
visualmente el estado de error (texto invisible en vez de rojo) — motivo de
más para no saltarse la verificación visual real de un cambio de UI.

Ningún componente debe importar `src/theme/palette.js` (ni ningún archivo de
`src/theme/`) directamente; siempre a través del tema distribuido por
`AppThemeProvider`.

## Qué no se formalizó todavía

No hay una escala tipográfica completa (`h1`–`h6`, `body1`/`body2` con
tamaños definidos) ni colores `warning`/`info`: el CSS actual no los usaba de
forma consistente, así que no se inventaron. Se agregan cuando exista un
caso real que los necesite, no antes — MUI aplica sus valores por defecto
para lo que no está sobrescrito.

## Estado de la migración

Migradas a MUI: `LoginPage`, `UnauthorizedPage`, y todo `AppShell`
(`Sidebar`, `Topbar`, `Footer`). El sidebar usa `Drawer` de MUI en dos
variantes: `permanent` en escritorio (ancho fijo que alterna 240px/72px
según `collapsed`, persistido en `localStorage`) y `temporary` en móvil
(`< 768px`, con su propio backdrop — ya no se necesita el botón de backdrop
manual que tenía la versión en CSS plano). Al colapsar en escritorio, los
ítems de navegación se ocultan por completo (no solo el texto), igual que el
comportamiento original.

Migradas también: `DataTable` (markup MUI —`Table`, `TableSortLabel`,
`TextField`, `Paper`— sobre la misma lógica de TanStack Table), `HomePage`
y el estado de carga de `App.jsx`.

**Migración completa**: todo el árbol de componentes usa MUI. `index.css`
quedó reducido a lo mínimo indispensable — `--ink`, `--ground` y
`font-family` como *fallback* antes de que `CssBaseline` inyecte sus
estilos (evita un parpadeo sin estilos entre el HTML inicial y la
hidratación de React; los mismos valores viven en `src/theme/palette.js`,
así que si cambia la paleta hay que actualizar los dos lugares) y
`#root { min-height: 100vh }`. Cada pantalla define su propio marco
(`AppShell` o `AuthLayout`); `#root` ya no centra nada. Ningún componente de React
depende ya de una clase CSS propia del proyecto.
