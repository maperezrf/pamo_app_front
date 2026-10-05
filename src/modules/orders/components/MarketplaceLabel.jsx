import { Box } from "@mui/material";
import { marketplaceLabel, marketplaceLogo } from "../orderFormat";

// Logo del canal + nombre. Sin logo conocido, solo el nombre.
export default function MarketplaceLabel({ value, label, size = 18 }) {
  const logo = marketplaceLogo(value);
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, whiteSpace: "nowrap" }}>
      {logo && (
        <Box
          component="img"
          src={logo}
          alt=""
          width={size}
          height={size}
          sx={{ borderRadius: 0.5, flexShrink: 0, objectFit: "contain" }}
        />
      )}
      {label ?? marketplaceLabel(value)}
    </Box>
  );
}
