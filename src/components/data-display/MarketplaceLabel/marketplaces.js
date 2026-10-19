// Nombre e ícono de cada canal (valores de `Marketplace` del backend, más
// `shopify` = sin marketplace). Sodimac Colombia opera como Homecenter.

import falabellaLogo from "../../../assets/marketplaces/falabella.png";
import madecentroLogo from "../../../assets/marketplaces/madecentro.png";
import mercadolibreLogo from "../../../assets/marketplaces/mercadolibre.png";
import shopifyLogo from "../../../assets/marketplaces/shopify.png";
import sodimacLogo from "../../../assets/marketplaces/sodimac.png";

const MARKETPLACE_LABELS = {
  falabella: "Falabella",
  mercadolibre: "Mercado Libre",
  madecentro: "Madecentro",
  sodimac: "Sodimac",
  shopify: "Shopify",
};

const MARKETPLACE_LOGOS = {
  falabella: falabellaLogo,
  mercadolibre: mercadolibreLogo,
  madecentro: madecentroLogo,
  sodimac: sodimacLogo,
  shopify: shopifyLogo,
};

export const marketplaceLogo = (value) => MARKETPLACE_LOGOS[value] ?? null;

export const marketplaceLabel = (value) => MARKETPLACE_LABELS[value] ?? value ?? "—";
