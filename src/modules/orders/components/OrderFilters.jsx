import { useEffect, useState } from "react";
import { Box, Button, MenuItem, TextField } from "@mui/material";
import { MARKETPLACE_OPTIONS } from "../orderFormat";
import MarketplaceLabel from "./MarketplaceLabel";

const SEARCH_DELAY_MS = 400;

// Filtros de `GET /api/orders/`. `filters` y `onChange` los maneja la
// página (viven en la URL); acá solo se edita y se demora la búsqueda.
export default function OrderFilters({ filters, onChange, onClear }) {
  const [search, setSearch] = useState(filters.search);

  // La URL manda: si cambia desde fuera (atrás/adelante, limpiar), se sigue.
  useEffect(() => setSearch(filters.search), [filters.search]);

  useEffect(() => {
    if (search === filters.search) return undefined;
    const timer = setTimeout(() => onChange({ search }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, filters.search, onChange]);

  const hasFilters = Boolean(filters.marketplace || filters.date_from || filters.date_to || filters.search);

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
      <TextField
        size="small"
        label="Buscar pedido"
        placeholder="N.º Shopify o marketplace"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 64 } }}
        sx={{ width: { xs: "100%", sm: 240 } }}
      />
      <TextField
        select
        size="small"
        label="Canal"
        value={filters.marketplace}
        onChange={(e) => onChange({ marketplace: e.target.value })}
        sx={{ width: { xs: "100%", sm: 220 } }}
      >
        <MenuItem value="">Todos</MenuItem>
        {MARKETPLACE_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <MarketplaceLabel value={option.value} label={option.label} />
          </MenuItem>
        ))}
      </TextField>
      <TextField
        type="date"
        size="small"
        label="Desde"
        value={filters.date_from}
        onChange={(e) => onChange({ date_from: e.target.value })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: filters.date_to || undefined } }}
        sx={{ width: { xs: "calc(50% - 6px)", sm: 170 } }}
      />
      <TextField
        type="date"
        size="small"
        label="Hasta"
        value={filters.date_to}
        onChange={(e) => onChange({ date_to: e.target.value })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: filters.date_from || undefined } }}
        sx={{ width: { xs: "calc(50% - 6px)", sm: 170 } }}
      />
      {hasFilters && (
        <Button color="inherit" size="small" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </Box>
  );
}
