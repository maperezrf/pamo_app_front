import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import StatusChip from "../../../components/data-display/StatusChip";
import falabellaLogo from "../../../assets/marketplaces/falabella.png";
import mercadolibreLogo from "../../../assets/marketplaces/mercadolibre.png";
import shopifyLogo from "../../../assets/marketplaces/shopify.png";
import sodimacLogo from "../../../assets/marketplaces/sodimac.png";

// Ilustración del lado derecho de las pantallas de acceso, mientras no haya
// una imagen corporativa: pedidos de varios canales llegando a un solo lugar.
// Solo decorativa (aria-hidden); los colores salen del tema.
const CARDS = [
  { logo: mercadolibreLogo, channel: "Mercado Libre", order: "#20361", total: "$ 1.509.615", top: "14%", left: "12%", rotate: -6 },
  { logo: falabellaLogo, channel: "Falabella", order: "#20360", total: "$ 78.249", top: "31%", left: "40%", rotate: 4 },
  { logo: sodimacLogo, channel: "Sodimac", order: "#20351", total: "$ 146.818", top: "48%", left: "16%", rotate: -2 },
];

export default function AuthHero() {
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => ({
        position: "relative",
        overflow: "hidden",
        height: "100%",
        color: "primary.contrastText",
        background: `linear-gradient(150deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      })}
    >
      {/* Trama de puntos */}
      <Box
        sx={(theme) => ({
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${alpha(theme.palette.primary.contrastText, 0.14)} 1px, transparent 1px)`,
          backgroundSize: "22px 22px",
        })}
      />
      {/* Halos */}
      <Box sx={(theme) => halo(theme, { width: 520, top: -160, right: -140 })} />
      <Box sx={(theme) => halo(theme, { width: 380, bottom: -120, left: -100 })} />

      {CARDS.map((card) => (
        <OrderCard key={card.order} {...card} />
      ))}

      <Box sx={{ position: "absolute", left: "12%", right: "12%", bottom: "9%" }}>
        <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
          {[shopifyLogo, falabellaLogo, mercadolibreLogo, sodimacLogo].map((logo) => (
            <Box
              key={logo}
              sx={(theme) => ({
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 1,
                bgcolor: "background.paper",
                boxShadow: theme.customShadows.card,
              })}
            >
              <Box component="img" src={logo} alt="" sx={{ width: 22, height: 22, objectFit: "contain" }} />
            </Box>
          ))}
        </Box>
        <Typography component="p" sx={{ fontSize: { md: 26, lg: 32 }, fontWeight: 700, lineHeight: 1.2, maxWidth: 460 }}>
          Todos tus canales de venta, en un solo lugar.
        </Typography>
        <Typography component="p" sx={{ mt: 1.5, fontSize: 15, opacity: 0.8, maxWidth: 420 }}>
          Pedidos, catálogo, logística y facturación de Pamo.
        </Typography>
      </Box>
    </Box>
  );
}

function halo(theme, position) {
  return {
    position: "absolute",
    height: position.width,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${alpha(theme.palette.primary.contrastText, 0.16)} 0%, transparent 70%)`,
    ...position,
  };
}

function OrderCard({ logo, channel, order, total, top, left, rotate }) {
  return (
    <Box
      sx={(theme) => ({
        position: "absolute",
        top,
        left,
        width: 260,
        p: 2,
        borderRadius: 1.5,
        bgcolor: "background.paper",
        color: "text.primary",
        boxShadow: `0 18px 40px ${alpha(theme.palette.common.black, 0.22)}`,
        transform: `rotate(${rotate}deg)`,
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box component="img" src={logo} alt="" sx={{ width: 28, height: 28, borderRadius: 0.75, objectFit: "contain" }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Pedido {order}</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{channel}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.75 }}>
        <StatusChip label="Pagado" tone="success" />
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{total}</Typography>
      </Box>
      {/* Líneas de producto esquemáticas */}
      <Box sx={{ mt: 1.75, display: "grid", gap: 0.75 }}>
        <Box sx={{ height: 6, width: "80%", borderRadius: 1, bgcolor: "divider" }} />
        <Box sx={{ height: 6, width: "55%", borderRadius: 1, bgcolor: "divider" }} />
      </Box>
    </Box>
  );
}
