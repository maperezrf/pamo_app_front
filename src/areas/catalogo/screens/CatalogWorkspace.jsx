import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { catalogApi } from "../api";
import StatusBadge from "../components/StatusBadge";
import "../styles/catalog.css";

const ProductDrawer = lazy(() => import("../components/ProductDrawer"));
const SodimacAuditWorkspace = lazy(
  () => import("../components/SodimacAuditWorkspace"),
);
const Phase6Configurator = lazy(() =>
  import("../components/Phase6Workspaces").then((module) => ({
    default: module.Phase6Configurator,
  })),
);
const MultwarehouseSimulator = lazy(() =>
  import("../components/Phase6Workspaces").then((module) => ({
    default: module.MultwarehouseSimulator,
  })),
);

const CATALOG_RUNTIME_LABEL =
  import.meta.env.VITE_CATALOG_RUNTIME_LABEL || "SQLite local";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const tabs = [
  "Catálogo maestro",
  "Reglas del catálogo",
  "Conexiones",
];
const catalogBusinessRules = [
  {
    group: "Precio Shopify",
    name: "Margen neto objetivo",
    value: "20%",
    explanation: "Utilidad esperada después del costo del producto, Mercado Pago, gastos administrativos, alistamiento y reserva logística.",
    source: "Regla comercial PAMO",
    status: "APLICADA",
  },
  {
    group: "Precio Shopify",
    name: "Reserva logística",
    value: "4% · máximo $40.000",
    explanation: "Se calcula sobre el precio sugerido por unidad. Nunca supera $40.000, aunque el producto tenga un precio mayor.",
    source: "Regla comercial PAMO",
    status: "APLICADA",
  },
  {
    group: "Cobro Shopify",
    name: "Mercado Pago",
    value: "3,29% + $800 + IVA",
    explanation: "Referencia pública para disponibilidad inmediata. Debe compararse con la tarifa contractual real antes de publicar precios.",
    source: "Mercado Pago Colombia · 27/08/2026",
    status: "POR VALIDAR",
  },
  {
    group: "Gastos internos",
    name: "Administración",
    value: "23%",
    explanation: "Porcentaje aplicado al precio sugerido para representar los gastos administrativos de la compañía.",
    source: "Informe de precios revisado",
    status: "APLICADA",
  },
  {
    group: "Gastos internos",
    name: "Alistamiento y bodegaje",
    value: "$7.200 por unidad",
    explanation: "Valor fijo interno. No es el envío cobrado por la transportadora y no debe duplicarse como flete.",
    source: "Informe de precios revisado",
    status: "APLICADA",
  },
  {
    group: "Gastos internos",
    name: "Provisión de devolución",
    value: "$360 por unidad",
    explanation: "Corresponde al 5% del alistamiento de $7.200; no es 5% del precio del producto.",
    source: "Informe de precios revisado",
    status: "APLICADA",
  },
  {
    group: "Envío",
    name: "Precio promedio de envío",
    value: "Según banda logística",
    explanation: "Se estima con peso, volumen, familia del producto e históricos disponibles. Sirve para análisis; la compra requiere cotización final por destino.",
    source: "Histórico local de guías Envía",
    status: "ESTIMADA",
  },
  {
    group: "Seguridad",
    name: "Publicación de precios",
    value: "Desactivada",
    explanation: "Los precios sugeridos son una simulación local. Ningún valor se publica en Shopify sin piloto y autorización separados.",
    source: "Control de seguridad",
    status: "BLOQUEADA",
  },
];
const connectorCatalog = [
  { code: "SHOPIFY", label: "Shopify", purpose: "Catálogo, precios e inventario", mode: "Beta · escrituras apagadas" },
  { code: "SIIGO", label: "Siigo", purpose: "Productos, costos e inventario contable", mode: "Solo lectura" },
  { code: "MERCADO_LIBRE", label: "Mercado Libre", purpose: "Publicaciones, comisión y envío", mode: "Solo lectura" },
  { code: "FALABELLA", label: "Falabella", purpose: "Catálogo del canal", mode: "Solo lectura" },
  { code: "SODIMAC", label: "Sodimac / Homecenter", purpose: "Catálogo y transporte", mode: "Fuente local" },
  { code: "MADECENTRO", label: "Madecentro", purpose: "Catálogo comercial", mode: "Solo lectura" },
  { code: "RAPPI", label: "Rappi", purpose: "Catálogo futuro", mode: "No conectado" },
  { code: "ENVIA", label: "Envía", purpose: "Cotizaciones y costos de guías", mode: "Lectura habilitada" },
  { code: "TAUMM", label: "TAUMM", purpose: "Precio e inventario del proveedor", mode: "Pendiente de conectar" },
  { code: "BARU", label: "Barú", purpose: "Listas, costos y medidas del proveedor", mode: "Carga local" },
];
const channelColumns = [
  ["SHOPIFY", "Shopify"],
  ["MERCADO_LIBRE", "Mercado Libre"],
  ["FALABELLA", "Falabella"],
  ["SODIMAC", "Sodimac / Homecenter"],
  ["MADECENTRO", "Madecentro"],
  ["RAPPI", "Rappi"],
];
const channelLabels = {
  SHOPIFY: "Shopify",
  SIIGO: "Siigo",
  MERCADO_LIBRE: "Mercado Libre",
  FALABELLA: "Falabella",
  SODIMAC: "Sodimac / Homecenter",
  MADECENTRO: "Madecentro",
  RAPPI: "Rappi",
};
const shopifySyncBlockerLabels = {
  SKU_MISSING: "Falta SKU",
  SKU_NOT_LITERAL_UNIQUE: "SKU duplicado o ambiguo",
  SHOPIFY_IDS_MISSING: "Falta vínculo exacto con Shopify",
  SHOPIFY_SNAPSHOT_MISSING: "Falta lectura reciente de Shopify",
  PRICE_NOT_CALCULABLE: "Falta costo o regla para calcular precio",
  PRICE_INVALID: "Precio calculado inválido",
  INVENTORY_SOURCE_MISSING: "Falta inventario externo confiable",
  INVENTORY_SOURCE_AMBIGUOUS: "Hay más de una fuente de inventario",
  INVENTORY_SOURCE_STALE: "Inventario externo vencido",
  INVENTORY_SOURCE_NEGATIVE: "Inventario externo inválido",
  SHOPIFY_INVENTORY_ITEM_ID_MISSING: "Falta vínculo del inventario Shopify",
  SHOPIFY_LOCATION_NOT_UNIQUE: "Ubicación Shopify no identificada",
};
const shopifySyncBlockerLabel = (code) =>
  shopifySyncBlockerLabels[code] || code;
const shopifySyncFieldLabels = { PRICE: "Precio", INVENTORY: "Inventario" };
const shopifySyncStatusLabels = {
  READY: "Listo para piloto",
  BLOCKED: "Bloqueado",
  NO_CHANGE: "Sin cambios",
  SUCCEEDED: "Sincronizado",
  FAILED: "Falló",
  CONFLICT: "Conflicto",
};
const channelBusinessModels = {
  SHOPIFY: { type: "DIRECT", commission: "DEDUCTED" },
  MERCADO_LIBRE: { type: "MARKETPLACE", commission: "DEDUCTED" },
  FALABELLA: { type: "MARKETPLACE", commission: "DEDUCTED" },
  SODIMAC: { type: "WHOLESALE", commission: "NOT_APPLICABLE" },
  MADECENTRO: { type: "WHOLESALE", commission: "NOT_APPLICABLE" },
  RAPPI: { type: "MARKETPLACE", commission: "DEDUCTED" },
};
const channelBusinessModelFor = (channel) =>
  channelBusinessModels[channel] || {
    type: "MARKETPLACE",
    commission: "DEDUCTED",
  };
const channelUsesCommission = (channel) =>
  channelBusinessModelFor(channel).commission === "DEDUCTED";
const channelMetrics = [
  { key: "status", label: "Estado", description: "Publicación e inventario", visibleKey: "channel_status" },
  { key: "inventory", label: "Inventario por ubicación", description: "Disponible en cada ubicación de Shopify; lectura local", visibleKey: "channel_inventory", channels: ["SHOPIFY"] },
  { key: "price", label: "Precio venta", description: "Publicado o vendido al canal", visibleKey: "channel_price" },
  { key: "compare_at", label: "Precio de comparación", description: "Precio tachado vigente en Shopify; lectura local", visibleKey: "channel_compare_at", channels: ["SHOPIFY"] },
  { key: "commission", label: "Comisión", description: "Valor y tarifa, si aplica", visibleKey: "channel_commission" },
  { key: "costs", label: "Otros gastos", description: "Pasarela, administración, alistamiento y provisiones", visibleKey: "channel_costs" },
  { key: "profit", label: "Utilidad est.", description: "Después de costos conocidos", visibleKey: "channel_profit" },
  { key: "target", label: "Margen libre", description: "Objetivo esperado", visibleKey: "channel_target" },
  { key: "reserve", label: "Reserva logística", description: "4% del precio sugerido; máximo $40.000 por unidad", visibleKey: "channel_reserve", channels: ["SHOPIFY"] },
  { key: "markup", label: "Incremento sobre costo", description: "No es el margen: 113% significa que el precio sugerido equivale a 2,13 veces el costo", visibleKey: "channel_markup", channels: ["SHOPIFY"] },
  { key: "suggested", label: "Precio sugerido", description: "Simulación local; garantiza 20% estimado después de gastos conocidos y reserva", visibleKey: "channel_suggested", channels: ["SHOPIFY"] },
  { key: "difference", label: "Posición frente al objetivo", description: "Verde: precio actual por encima del objetivo. Rojo: precio actual por debajo del objetivo", visibleKey: "channel_difference", channels: ["SHOPIFY"] },
  { key: "shipping", label: "Envío", description: "Empresa / cliente; promedio si falta tarifa", visibleKey: "channel_shipping" },
  { key: "quality", label: "Calidad", description: "Calidad de publicación", visibleKey: "channel_quality" },
  { key: "missing", label: "Faltantes", description: "Información por completar", visibleKey: "channel_missing" },
];
const optionalColumns = [
  ["provider", "Proveedor"],
  ["cost", "Costo Shopify sin IVA"],
  ["shipping", "Precio promedio de envío"],
  ["siigo", "Siigo"],
  ["channels", "Canales"],
  ["channel_status", "Canales · Estado"],
  ["channel_inventory", "Shopify · Inventario por ubicación"],
  ["channel_price", "Canales · Precio venta"],
  ["channel_compare_at", "Shopify · Precio de comparación"],
  ["channel_commission", "Canales · Comisión"],
  ["channel_costs", "Canales · Otros gastos"],
  ["channel_profit", "Canales · Utilidad estimada"],
  ["channel_target", "Canales · Margen libre"],
  ["channel_reserve", "Shopify · Reserva logística"],
  ["channel_markup", "Shopify · Incremento sobre costo"],
  ["channel_suggested", "Shopify · Precio sugerido"],
  ["channel_difference", "Shopify · Posición frente al objetivo"],
  ["channel_shipping", "Canales · Envío"],
  ["channel_quality", "Canales · Calidad"],
  ["channel_missing", "Canales · Faltantes"],
];
const channelMetricColumnKey = (channel, metric) => `${channel}__${metric}`;
const channelMetricsFor = (channel) =>
  channelMetrics.filter(
    (metric) => !metric.channels || metric.channels.includes(channel),
  );
const channelMetricLabelFor = (channel, metric) => {
  if (channel === "SHOPIFY" && metric.key === "price") return "Precio actual";
  if (channel === "SHOPIFY" && metric.key === "compare_at") return "Precio de comparación";
  if (channel === "SHOPIFY" && metric.key === "commission") return "Mercado Pago";
  if (channel === "SHOPIFY" && metric.key === "costs") return "Gastos empresa";
  if (channel === "SHOPIFY" && metric.key === "target") return "Margen neto";
  return metric.label;
};
const pinnableColumns = [
  ["photo", "Foto"],
  ["sku", "SKU"],
  ["product", "Nombre del producto"],
  ["provider", "Proveedor"],
  ["cost", "Costo Shopify sin IVA"],
  ["shipping", "Precio promedio de envío"],
  ["siigo", "Siigo"],
  ...channelColumns.flatMap(([channel, channelLabel]) =>
    channelMetricsFor(channel).map((metric) => [
      channelMetricColumnKey(channel, metric.key),
      `${channelLabel} · ${channelMetricLabelFor(channel, metric)}`,
      metric.visibleKey,
      channel,
    ]),
  ),
];
const channelMetricColumnKeys = channelColumns.flatMap(([channel]) =>
  channelMetricsFor(channel).map((metric) =>
    channelMetricColumnKey(channel, metric.key),
  ),
);
const supportedTableColumnKeys = new Set([
  "photo",
  "sku",
  "product",
  "provider",
  "cost",
  "siigo",
  ...channelMetricColumnKeys,
]);
const defaultColumns = optionalColumns.map(([key]) => key);
const money = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      })
        .format(Number(value))
        .replace(/\u00a0/g, " ");
const percent = (value) => `${Number(value || 0).toFixed(1)}%`;
const priceDifference = (channelPrice, shopifyPrice) => {
  if (channelPrice == null || shopifyPrice == null) return null;
  const delta = Number(channelPrice) - Number(shopifyPrice);
  const percentage = Number(shopifyPrice)
    ? (delta / Number(shopifyPrice)) * 100
    : 0;
  return `${delta > 0 ? "+" : ""}${money(delta)} (${delta > 0 ? "+" : ""}${percentage.toFixed(1)}%)`;
};
const suggestedPriceAdjustment = (value) => {
  const difference = Number(value || 0);
  if (difference > 0) return { label: `Por debajo ${money(difference)}`, tone: "is-shortfall" };
  if (difference < 0) return { label: `Por encima ${money(Math.abs(difference))}`, tone: "is-headroom" };
  return { label: "En objetivo", tone: "is-on-target" };
};
const shippingBandLabel = (average) => {
  const labels = {
    HASTA_1_KG: "Hasta 1 kg",
    HASTA_1_KG_ASUMIDO: "Menos de 1 kg · asumido",
    "1_A_2_KG": "1 a 2 kg",
    "2_A_5_KG": "2 a 5 kg",
    "5_A_10_KG": "5 a 10 kg",
    MAS_DE_10_KG: "Más de 10 kg",
    LAVAMANOS_VOLUMINOSO: "Lavamanos voluminoso · P75 histórico",
    LAVAPLATOS_VOLUMINOSO: "Lavaplatos voluminoso · P75 histórico",
  };
  return labels[average?.tariff_band] || average?.tariff_band || "Sin datos";
};

const channelSnapshotFor = (row, channel) =>
  channel === "SODIMAC" ? null : row.channels[channel];

const channelExistsFor = (row, channel) =>
  channel === "SODIMAC"
    ? row.sodimac?.status === "LINKED_EXACT"
    : Boolean(channelSnapshotFor(row, channel));

const channelStateFor = (row, channel) => {
  if (channel === "SODIMAC") {
    if (!channelExistsFor(row, channel)) return "NO CREADO";
    return (
      row.sodimac?.latest_observation?.publication_state || "LINKED_EXACT"
    );
  }
  return channelSnapshotFor(row, channel)?.state || "NO CREADO";
};

const channelPriceFor = (row, channel) => {
  if (channel === "SODIMAC") return null;
  const snapshot = channelSnapshotFor(row, channel);
  if (channel === "SHOPIFY") return snapshot?.price ?? row.variant.price ?? null;
  return snapshot?.price ?? null;
};

const shopifyCompareAtPriceFor = (row) =>
  channelSnapshotFor(row, "SHOPIFY")?.compare_at_price ??
  row.variant.compare_at_price ??
  null;

const channelInventoryFor = (row, channel) => {
  if (channel === "SODIMAC")
    return row.sodimac?.latest_observation?.inventory_available ?? null;
  return channelSnapshotFor(row, channel)?.inventory_available ?? null;
};

const shopifyInventoryLocationsFor = (row) =>
  [...(row.variant.inventory_levels || [])].sort((left, right) => {
    const availabilityDifference =
      Number(right.available || 0) - Number(left.available || 0);
    if (availabilityDifference) return availabilityDifference;
    return String(left.location_name || "").localeCompare(
      String(right.location_name || ""),
      "es",
      { sensitivity: "base" },
    );
  });

const shopifyInventoryStatusFor = (row) => {
  const locations = shopifyInventoryLocationsFor(row);
  if (!locations.length) return "Sin ubicaciones";
  return locations.some((location) => Number(location.available || 0) > 0)
    ? "Con disponibilidad"
    : "Sin disponibilidad";
};

const shopifyInventoryTotalFor = (row) => {
  const locations = shopifyInventoryLocationsFor(row);
  if (!locations.length) return null;
  return locations.reduce(
    (total, location) => total + Number(location.available || 0),
    0,
  );
};

const shopifyShippingOriginFor = (row) => {
  const locations = shopifyInventoryLocationsFor(row).filter(
    (location) =>
      location.location_active !== false && Number(location.available || 0) > 0,
  );
  if (!locations.length) return null;
  return (
    locations.find((location) => location.fulfills_online_orders) || locations[0]
  );
};

const inventoryQuantity = (value) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(
    Number(value || 0),
  );

const channelQualityFor = (row, channel) => {
  if (channel === "SODIMAC") {
    const score = row.sodimac?.latest_observation?.overall_score ?? null;
    return {
      score,
      label: score == null ? "—" : String(score),
      available: score != null,
    };
  }
  const snapshot = channelSnapshotFor(row, channel);
  const publicationQuality = snapshot?.publication_quality;
  if (publicationQuality?.verified_channel_metric) {
    return {
      score: publicationQuality.score,
      label: String(publicationQuality.score ?? "—"),
      available: publicationQuality.score != null,
    };
  }
  if (channel === "SHOPIFY" && snapshot?.quality_score != null) {
    return {
      score: snapshot.quality_score,
      label: String(snapshot.quality_score),
      available: true,
    };
  }
  return { score: null, label: "—", available: false };
};

const channelShippingFor = (row, channel) => {
  const direct = row.shipping.channels?.[channel] || null;
  if (
    direct &&
    (channel !== "SHOPIFY" ||
      direct.seller_estimate != null ||
      direct.buyer_charge != null)
  )
    return direct;
  if (channel === "SHOPIFY" && row.shipping.carrier_quote?.amount != null) {
    return {
      status: "CARRIER_QUOTE_AVAILABLE",
      seller_estimate: row.shipping.carrier_quote.amount,
      buyer_charge: null,
      basis: { seller: "ENVIA_CURRENT_QUOTE" },
    };
  }
  return direct;
};

const channelProfitFor = (row, channel) => {
  if (!channelExistsFor(row, channel))
    return {
      amount: null,
      label: "—",
      available: false,
      verified: false,
      missingConcepts: ["Publicación"],
    };
  const commercial = channelCommercialFor(row, channel);
  if (commercial?.verified && commercial.net_profit != null) {
    const price = channelPriceFor(row, channel);
    const amount = Number(commercial.net_profit);
    return {
      amount,
      label: money(amount),
      available: true,
      verified: true,
      margin: price ? (amount / Number(price)) * 100 : null,
      missingConcepts: [],
    };
  }
  const price = channelPriceFor(row, channel);
  const cost = row.currentShopifyCost;
  if (price == null || cost == null) {
    const missingPrice = price == null;
    const missingCost = cost == null;
    return {
      amount: null,
      label:
        missingPrice && missingCost
          ? "Faltan precio y costo"
          : missingCost
            ? "Falta costo Shopify"
            : "Falta precio",
      available: false,
      verified: false,
      margin: null,
      missingConcepts: [
        ...(missingPrice ? ["Precio"] : []),
        ...(missingCost ? ["Costo Shopify"] : []),
      ],
    };
  }
  const shipping = channelShippingFor(row, channel);
  const missingConcepts = [];
  const commission = Number(commercial?.commission_amount ?? 0);
  const otherCosts = Number(commercial?.other_cost_amount ?? 0);
  const sellerShipping = Number(shipping?.seller_estimate ?? 0);
  if (
    channelUsesCommission(channel) &&
    commercial?.commission_amount == null
  )
    missingConcepts.push("Comisión");
  if (commercial?.other_cost_amount == null) missingConcepts.push("Otros gastos");
  if (shipping?.seller_estimate == null) missingConcepts.push("Envío empresa");
  const amount =
    Number(price) -
    Number(cost) -
    commission -
    otherCosts -
    sellerShipping;
  return {
    amount,
    label: money(amount),
    available: true,
    verified: false,
    margin: Number(price) ? (amount / Number(price)) * 100 : null,
    missingConcepts,
  };
};

const channelCommercialFor = (row, channel) => {
  const profitability =
    channelSnapshotFor(row, channel)?.payload?.profitability;
  return profitability && typeof profitability === "object"
    ? profitability
    : null;
};

const shopifyPricingSimulationFor = (row) =>
  channelCommercialFor(row, "SHOPIFY")?.pricing_simulation || null;

const channelMissingFor = (row, channel) => {
  if (!channelExistsFor(row, channel)) return ["Publicación"];
  const missing = [];
  if (channelPriceFor(row, channel) == null) missing.push("Precio");
  if (row.currentShopifyCost == null) missing.push("Costo");
  const profit = channelProfitFor(row, channel);
  if (!profit.available) missing.push("Utilidad");
  if (
    profit.missingConcepts?.some((concept) =>
      ["Comisión", "Otros gastos"].includes(concept),
    )
  )
    missing.push("Comisión/cargos");
  const shipping = channelShippingFor(row, channel);
  const shippingAvailable =
    shipping?.seller_estimate != null || shipping?.buyer_charge != null;
  if (
    shipping?.seller_estimate == null &&
    shipping?.buyer_charge == null
  )
    missing.push("Envío");
  if (!channelQualityFor(row, channel).available) missing.push("Calidad");
  if (channelInventoryFor(row, channel) == null) missing.push("Inventario");
  if (
    !shippingAvailable &&
    Array.isArray(row.envia.missing_fields) &&
    row.envia.missing_fields.length
  )
    missing.push("Peso/medidas");
  return [...new Set(missing)];
};

const shippingModalityLabels = (shipping) => {
  const modalities = shipping.modalities || {};
  return [
    ["Colecta", modalities.collecta],
    ["Flex", modalities.flex],
    ["Full", modalities.full],
  ]
    .filter(([, details]) => details?.eligible)
    .map(([label, details]) => {
      const quote = `cot. ${money(details.seller_estimate)}`;
      const history =
        details.historical_p75 == null
          ? ""
          : ` · P75 ${money(details.historical_p75)}`;
      return `${label}: ${quote}${history}`;
    });
};

const channelShippingLabel = (row, channel) => {
  const shipping = channelShippingFor(row, channel);
  const average = channel === "SHOPIFY" ? row.shipping.average_shipping : null;
  if (!shipping && average?.amount == null) return "Pendiente";
  const modalityLabels = shippingModalityLabels(shipping || {});
  const usesAverage = shipping?.seller_estimate == null && average?.amount != null;
  const seller =
    usesAverage
      ? `Promedio estimado ${money(average.amount)}`
      : shipping?.seller_estimate == null
      ? "Costo preventivo —"
      : `Costo preventivo ${money(shipping.seller_estimate)}`;
  const buyer =
    shipping?.buyer_charge == null
      ? "Cliente ref. —"
      : `Cliente ref. ${money(shipping.buyer_charge)}`;
  return [seller, ...modalityLabels, buyer].join(" · ");
};

const initialFilters = {
  search: "",
  provider: "",
  channel: "",
  channelCoverage: "",
  channelState: "",
  status: "",
  brand: "",
  collection: "",
  category: "",
  quality: "",
  priceMin: "",
  priceMax: "",
  costStatus: "",
  siigoStatus: "",
  missing: "",
  review: "",
  period: "30d",
  sodimacLink: "",
  sodimacQuality: "",
  sodimacFreshness: "",
  sodimacInventory: "",
  enviaReadiness: "",
};
const FILTER_LABELS = {
  search: "Búsqueda",
  provider: "Proveedor",
  channel: "Canal",
  channelCoverage: "Cobertura del canal",
  channelState: "Estado del canal",
  status: "Estado Shopify",
  brand: "Marca",
  collection: "Colección",
  category: "Categoría",
  quality: "Calidad Shopify",
  missing: "Datos base",
  review: "Revisión",
  enviaReadiness: "Preparación Envía",
  sodimacLink: "Vínculo Sodimac",
  sodimacQuality: "Calidad Sodimac",
  sodimacFreshness: "Verificación Sodimac",
  sodimacInventory: "Inventario Sodimac",
  costStatus: "Costo Shopify sin IVA",
  siigoStatus: "Estado Siigo",
  priceMin: "Precio mínimo",
  priceMax: "Precio máximo",
};
const FILTER_FIELDS = Object.keys(FILTER_LABELS).filter(
  (key) => key !== "search",
);
const CHANNEL_METRIC_LABELS = {
  status: "Estado",
  price: "Precio venta",
  commission: "Comisión",
  costs: "Otros gastos",
  profit: "Utilidad estimada",
  target: "Objetivo",
  shipping: "Precio promedio de envío",
  quality: "Calidad",
  missing: "Faltantes",
};
const DEFAULT_SIM_FORM = {
  provider_id: "",
  policy_id: "",
  sku: "QA-SKU-004",
  supplier_price: "125000",
  previous_price: "199000",
  quoted_shipping: "16500",
  customer_shipping_charge: "3000",
};
const DEFAULT_MEASUREMENT_DRAFT = {
  variant_id: "",
  sku: "",
  gtin: "",
  description: "",
  provider: "Barú",
  weight: "",
  weight_unit: "KG",
  length: "",
  width: "",
  height: "",
  dimension_unit: "CM",
  package_count: "1",
  verified_date: "",
  responsible: "",
  source_kind: "MEDICION_FISICA",
  source_reference: "",
  evidence_url: "",
  notes: "",
};

const safeRead = (key, fallback, ttl = null) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (!parsed) return fallback;
    if (ttl && (!parsed.savedAt || Date.now() - parsed.savedAt > ttl))
      return fallback;
    return parsed.value ?? fallback;
  } catch {
    return fallback;
  }
};
const safeWrite = (key, value) =>
  localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }));

const normalizeColumnFilters = (filters) =>
  Object.fromEntries(
    Object.entries(filters && typeof filters === "object" ? filters : {}).filter(
      ([, selectedValues]) =>
        Array.isArray(selectedValues) && selectedValues.length > 0,
    ),
  );

function FilterSelect({ label, value, onChange, options, disabled = false }) {
  return (
    <label className="catalog-filter">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Todos</option>
        {options.map((item) => {
          const option =
            typeof item === "string" ? { value: item, label: item } : item;
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <article className={`executive-card ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ChannelMetricCell({ row, channel, metric, pinned = false }) {
  const className = `channel-metric-cell channel-metric-${metric} ${
    pinned ? "is-pinned-column" : ""
  }`.trim();
  if (metric === "status") {
    const inventory = channelInventoryFor(row, channel);
    return (
      <td className={className}>
        <StatusBadge
          value={channelStateFor(row, channel)}
          tone={channelExistsFor(row, channel) ? undefined : "neutral"}
        />
        {channel !== "SHOPIFY" && (
          <small>{inventory == null ? "Inv. —" : `Inv. ${inventory}`}</small>
        )}
      </td>
    );
  }
  if (metric === "inventory") {
    const locations = shopifyInventoryLocationsFor(row);
    const total = shopifyInventoryTotalFor(row);
    const observed = locations
      .map((location) => location.observed_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    return (
      <td
        className={`${className} shopify-location-inventory`}
        title={`Inventario Shopify por ubicación, solo lectura local.${observed ? ` Última observación: ${observed}.` : ""}`}
      >
        <strong>{total == null ? "Sin ubicaciones" : inventoryQuantity(total)}</strong>
        {locations.slice(0, 4).map((location) => (
          <small key={location.location_external_id || location.location_name}>
            <span>{location.location_name || "Ubicación sin nombre"}</span>
            <b>{inventoryQuantity(location.available)}</b>
          </small>
        ))}
        {locations.length > 4 && <small>+{locations.length - 4} ubicaciones</small>}
      </td>
    );
  }
  if (metric === "price") {
    const price = channelPriceFor(row, channel);
    const shopifyPrice = channelPriceFor(row, "SHOPIFY");
    return (
      <td className={className}>
        <strong>{money(price)}</strong>
        {channel !== "SHOPIFY" && price != null && shopifyPrice != null && (
          <small className="channel-price-delta">
            {priceDifference(price, shopifyPrice)}
          </small>
        )}
      </td>
    );
  }
  if (metric === "compare_at") {
    const compareAtPrice = shopifyCompareAtPriceFor(row);
    return (
      <td
        className={className}
        title="Precio de comparación vigente en Shopify. En este laboratorio es de solo lectura; editarlo requerirá una propuesta aprobada y una sincronización autorizada."
      >
        <strong>{money(compareAtPrice)}</strong>
      </td>
    );
  }
  if (metric === "profit") {
    const profit = channelProfitFor(row, channel);
    const pendingAssumptions = profit.missingConcepts?.join(", ");
    return (
      <td
        className={className}
        title={
          profit.verified
            ? "Utilidad neta verificada por la fuente comercial del canal."
            : profit.available
              ? `Estimación preliminar: precio menos costo Shopify y cargos conocidos. Pendientes asumidos temporalmente en $0: ${pendingAssumptions || "ninguno"}. IVA de la venta pendiente de validar.`
              : "Se requiere precio del canal y costo Shopify para calcular la utilidad preliminar."
        }
      >
        <strong>{profit.label}</strong>
        {profit.available && (
          <small className={profit.verified ? "profit-verified" : "profit-partial"}>
            {profit.margin == null ? "" : `${profit.margin.toFixed(1)}% · `}
            {profit.verified
              ? "Verificada"
              : profit.missingConcepts.length
                ? `Parcial · ${profit.missingConcepts.length} pendientes`
                : "Estimada"}
          </small>
        )}
      </td>
    );
  }
  if (metric === "commission") {
    if (!channelUsesCommission(channel)) {
      return (
        <td
          className={className}
          title="Este canal compra a PAMO a un precio mayorista y define su propio precio de venta. No descuenta comisión."
        >
          <strong>No aplica</strong>
          <small>Modelo mayorista</small>
        </td>
      );
    }
    const commercial = channelCommercialFor(row, channel);
    const commissionRate = commercial?.commission_percent;
    return (
      <td
        className={className}
        title={
          commissionRate == null
            ? "Tarifa de comisión pendiente"
            : `Tarifa aplicada: ${percent(commissionRate)}`
        }
      >
        <strong>{commercial?.commission_amount == null ? "Pendiente" : money(commercial.commission_amount)}</strong>
      </td>
    );
  }
  if (metric === "costs") {
    const commercial = channelCommercialFor(row, channel);
    const amount = commercial?.other_cost_amount;
    const labels = Array.isArray(commercial?.other_cost_labels)
      ? commercial.other_cost_labels.join(" · ")
      : "";
    return (
      <td className={className} title={labels || "Pasarela cuando aplica, administración, alistamiento, bodegaje y provisiones configuradas"}>
        <strong>{amount == null ? "Pendiente" : money(amount)}</strong>
      </td>
    );
  }
  if (metric === "target") {
    const commercial = channelCommercialFor(row, channel);
    return (
      <td className={className}>
        <strong>{commercial?.target_label || "20–25%"}</strong>
      </td>
    );
  }
  if (["reserve", "markup", "suggested", "difference"].includes(metric)) {
    const simulation = shopifyPricingSimulationFor(row);
    if (!simulation || simulation.status !== "SIMULATED_LOCAL") {
      return (
        <td className={className} title="Se necesita el costo del producto para calcular la simulación.">
          <strong>Sin costo</strong>
        </td>
      );
    }
    const difference = suggestedPriceAdjustment(simulation.difference_amount);
    const values = {
      reserve: money(simulation.logistics_reserve_amount),
      markup: percent(simulation.markup_percent),
      suggested: money(simulation.suggested_price),
      difference: difference.label,
    };
    const metricClassName = `${className} ${metric === "difference" ? difference.tone : ""}`.trim();
    const markupMultiple = (1 + Number(simulation.markup_percent) / 100).toFixed(2);
    return (
      <td
        className={metricClassName}
        title={
          metric === "reserve" && simulation.logistics_reserve_basis === "CAPPED"
            ? "La reserva alcanzó el tope máximo de $40.000 por unidad."
            : metric === "markup"
              ? `El precio sugerido equivale a ${markupMultiple} veces el costo. Este porcentaje no es la utilidad ni el margen neto.`
              : metric === "difference"
                ? difference.tone === "is-shortfall"
                  ? "El precio actual está por debajo del objetivo por este valor. No significa necesariamente una pérdida contable."
                  : difference.tone === "is-headroom"
                    ? "El precio actual está por encima del objetivo por este valor."
                    : "El precio actual coincide con el sugerido."
            : undefined
        }
      >
        <strong>{values[metric]}</strong>
      </td>
    );
  }
  if (metric === "shipping") {
    const shipping = channelShippingFor(row, channel);
    const average = channel === "SHOPIFY" ? row.shipping.average_shipping : null;
    const usesAverage =
      shipping?.seller_estimate == null && average?.amount != null;
    const modalityLabels = shipping ? shippingModalityLabels(shipping) : [];
    const shippingError = Array.isArray(shipping?.errors)
      ? shipping.errors.find(Boolean)
      : null;
    const noCoverage =
      shipping?.seller_estimate == null &&
      shipping?.buyer_charge == null &&
      /no coverage options found/i.test(shippingError || "");
    const sellerAmount = usesAverage
      ? average.amount
      : shipping?.seller_estimate;
    const buyerAmount = shipping?.buyer_charge;
    const shippingOrigin = channel === "SHOPIFY" ? shopifyShippingOriginFor(row) : null;
    const modalityDetail = modalityLabels.length
      ? ` Modalidades: ${modalityLabels.join(" · ")}.`
      : "";
    return (
      <td
        className={className}
        title={
          noCoverage
            ? "Mercado Libre no encontró cobertura de envío para esta publicación. La modalidad logística figura como no configurada."
            : shippingError ||
              (usesAverage
                ? `Promedio informativo de guías realizadas para la banda ${average.tariff_band || "SIN_DATOS"}. No forma parte del costo ni de la utilidad y será reemplazado por la cotización real.${modalityDetail}`
                : undefined) ||
              (shipping?.seller_estimate_strategy?.startsWith("MAX_ELIGIBLE")
                ? `Antes de la venta se aplica el mayor valor entre la cotización del SKU y el P75 real de 90 días para las modalidades habilitadas. El costo definitivo se conciliará con la orden.${modalityDetail}`
                : modalityDetail || undefined)
        }
      >
        {noCoverage ? (
          <strong>Sin cobertura ML</strong>
        ) : (
          <span className="shipping-value-stack">
            <strong>{money(sellerAmount)}</strong>
            {buyerAmount != null && <strong>{money(buyerAmount)}</strong>}
          </span>
        )}
        {usesAverage && <small>{shippingBandLabel(average)}</small>}
        {shippingOrigin && <small>Sale de {shippingOrigin.location_name}</small>}
        {noCoverage && (
          <strong>
            No disponible
          </strong>
        )}
      </td>
    );
  }
  if (metric === "quality") {
    return (
      <td className={className}>
        <strong>{channelQualityFor(row, channel).label}</strong>
      </td>
    );
  }
  const missing = channelMissingFor(row, channel);
  return (
    <td className={className}>
      <StatusBadge
        value={missing.length ? `${missing.length} faltantes` : "Completo"}
        tone={missing.length ? "warning" : "success"}
      />
      {missing.length > 0 && <small>{missing.join(" · ")}</small>}
    </td>
  );
}

function ExcelColumnHeader({
  columnKey,
  label,
  description,
  className = "",
  rowSpan,
  rows,
  definition,
  sortConfig,
  onSort,
  columnFilters,
  onFilterChange,
  pinned = false,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [draftValues, setDraftValues] = useState([]);
  const [globalOptions, setGlobalOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const localOptions = useMemo(
    () =>
      [
        ...new Set(
          rows.map((row) => String(definition.filter(row) ?? "Vacío")),
        ),
      ].sort((left, right) =>
        left.localeCompare(right, "es", { numeric: true, sensitivity: "base" }),
      ),
    [rows, definition],
  );
  const options = globalOptions || localOptions;
  const selectedValues = columnFilters[columnKey];
  const activeFilter =
    Array.isArray(selectedValues) && selectedValues.length > 0;
  const visibleOptions = options.filter((value) =>
    value.toLocaleLowerCase("es").includes(searchValue.toLocaleLowerCase("es")),
  );
  const allDraftValuesSelected =
    options.length > 0 && draftValues.length === options.length;
  const toggleValue = (value) => {
    setDraftValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };
  const resetDraft = () => {
    setDraftValues(
      activeFilter
        ? selectedValues.filter((value) => options.includes(value))
        : options,
    );
    setSearchValue("");
  };
  const openDraft = async () => {
    setSearchValue("");
    setDraftValues(activeFilter ? selectedValues : options);
    if (globalOptions) return;
    setOptionsLoading(true);
    try {
      const result = await catalogApi.columnOptions(columnKey);
      const loaded = result.ok ? result.data?.options : [];
      if (Array.isArray(loaded) && loaded.length) {
        setGlobalOptions(loaded);
        setDraftValues(activeFilter ? selectedValues : loaded);
      }
    } catch {
      setGlobalOptions(localOptions);
    } finally {
      setOptionsLoading(false);
    }
  };
  const applyDraft = () => {
    if (!draftValues.length) return;
    onFilterChange(
      columnKey,
      draftValues.length === options.length ? undefined : draftValues,
    );
    setIsOpen(false);
  };
  const cancelDraft = () => {
    resetDraft();
    setIsOpen(false);
  };
  const clearFilter = () => {
    onFilterChange(columnKey, undefined);
    setDraftValues(options);
    setSearchValue("");
    setIsOpen(false);
  };
  const sortDirection =
    sortConfig?.key === columnKey ? sortConfig.direction : null;
  return (
    <th
      rowSpan={rowSpan}
      className={`${className} excel-filterable-header ${pinned ? "is-pinned-column" : ""}`.trim()}
    >
      <details
        className={`excel-column-menu ${activeFilter ? "filtered" : ""}`}
        open={isOpen}
        onToggle={(event) => {
          const nextOpen = event.currentTarget.open;
          if (nextOpen && !isOpen) openDraft();
          setIsOpen(nextOpen);
        }}
      >
        <summary aria-label={`Ordenar y filtrar ${label}`}>
          <span className="excel-header-copy">
            <span>{label}</span>
            {description && <small>{description}</small>}
          </span>
          <b>
            {sortDirection === "asc"
              ? "↑"
              : sortDirection === "desc"
                ? "↓"
                : "▾"}
          </b>
        </summary>
        {isOpen &&
          createPortal(
            <>
              <button
                className="excel-filter-backdrop"
                type="button"
                aria-label={`Cerrar filtro de ${label}`}
                onClick={cancelDraft}
              />
              <div
                className="excel-filter-popover"
                role="dialog"
                aria-modal="true"
                aria-label={`Filtro de ${label}`}
              >
                <strong>{label}</strong>
                <div className="excel-sort-actions">
                  <button
                    type="button"
                    onClick={() => onSort(columnKey, "asc")}
                  >
                    ↑ Orden ascendente
                  </button>
                  <button
                    type="button"
                    onClick={() => onSort(columnKey, "desc")}
                  >
                    ↓ Orden descendente
                  </button>
                  <button type="button" onClick={() => onSort(null, null)}>
                    Quitar orden
                  </button>
                </div>
                <input
                  aria-label={`Buscar valores en ${label}`}
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Buscar valores"
                />
                <div className="excel-value-list">
                  {optionsLoading && (
                    <small>Cargando valores de todo el catálogo…</small>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={allDraftValuesSelected}
                      onChange={(event) =>
                        setDraftValues(event.target.checked ? options : [])
                      }
                    />
                    Seleccionar todo
                  </label>
                  {visibleOptions.map((value) => (
                    <div className="excel-value-option" key={value}>
                      <label>
                        <input
                          type="checkbox"
                          checked={draftValues.includes(value)}
                          onChange={() => toggleValue(value)}
                        />
                        <span>{value}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setDraftValues([value])}
                      >
                        Solo este
                      </button>
                    </div>
                  ))}
                  {!visibleOptions.length && (
                    <small>Sin valores coincidentes</small>
                  )}
                </div>
                {!draftValues.length && (
                  <small className="excel-filter-warning">
                    Selecciona al menos un valor antes de aplicar.
                  </small>
                )}
                <div className="excel-filter-actions">
                  <button type="button" onClick={cancelDraft}>
                    Cancelar
                  </button>
                  <button type="button" onClick={clearFilter}>
                    Limpiar filtro
                  </button>
                  <button
                    className="excel-apply-filter"
                    type="button"
                    disabled={!draftValues.length}
                    onClick={applyDraft}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </>,
            document.body,
          )}
      </details>
    </th>
  );
}

export default function CatalogWorkspace({ user }) {
  const actorScope = String(user?.email || "local-operator")
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, "_");
  const storageKeys = useMemo(
    () =>
      Object.fromEntries(
        [
          "active-tab",
          "filters",
          "physical-filters",
          "page",
          "workspace-cache",
          "density",
          "columns",
          "columns-layout",
          "columns-layout-schema",
          "pinned-column",
          "column-filters",
          "table-sort",
          "saved-views",
          "collapsed-channels",
          "coverage-open",
          "architecture-open",
          "filter-builder-open",
          "pricing-draft",
          "measurement-draft",
        ].map((name) => [name, `merci-local-catalog-${name}-v3:${actorScope}`]),
      ),
    [actorScope],
  );
  const initialCache = useMemo(
    () => safeRead(storageKeys["workspace-cache"], null, CACHE_TTL_MS),
    [storageKeys],
  );
  const [activeTab, setActiveTab] = useState(() => {
    const saved = safeRead(storageKeys["active-tab"], tabs[0], DRAFT_TTL_MS);
    return tabs.includes(saved) ? saved : tabs[0];
  });
  const [workspace, setWorkspace] = useState(
    () => initialCache?.workspace || null,
  );
  const [executive, setExecutive] = useState(
    () => initialCache?.executive || null,
  );
  const [importPlan, setImportPlan] = useState(
    () => initialCache?.importPlan || null,
  );
  const [pilot, setPilot] = useState(() => initialCache?.pilot || null);
  const [physical, setPhysical] = useState(
    () => initialCache?.physical || null,
  );
  const [measurement, setMeasurement] = useState(
    () => initialCache?.measurement || null,
  );
  const [phase7, setPhase7] = useState(() => initialCache?.phase7 || null);
  const [alignment, setAlignment] = useState(null);
  const [alignmentChannel, setAlignmentChannel] = useState("MERCADO_LIBRE");
  const [alignmentPage, setAlignmentPage] = useState(1);
  const [alignmentSearch, setAlignmentSearch] = useState("");
  const [alignmentStatus, setAlignmentStatus] = useState("");
  const [alignmentLoading, setAlignmentLoading] = useState(false);
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    ...safeRead(storageKeys.filters, initialFilters, DRAFT_TTL_MS),
  }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    ...initialFilters,
    ...safeRead(storageKeys.filters, initialFilters, DRAFT_TTL_MS),
  }));
  const [physicalFilters, setPhysicalFilters] = useState(() =>
    safeRead(
      storageKeys["physical-filters"],
      { scope: "", classification: "" },
      DRAFT_TTL_MS,
    ),
  );
  const [selected, setSelected] = useState([]);
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [selectionExclusions, setSelectionExclusions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(() => !initialCache?.workspace);
  const [stale, setStale] = useState(() => Boolean(initialCache?.workspace));
  const [lastSuccess, setLastSuccess] = useState(
    () => initialCache?.lastSuccess || null,
  );
  const [notice, setNotice] = useState("");
  const [channelRefresh, setChannelRefresh] = useState(null);
  const [connectionsWorkspace, setConnectionsWorkspace] = useState(
    () => initialCache?.workspace?.connections || null,
  );
  const [shopifySync, setShopifySync] = useState(null);
  const [shopifySyncLoading, setShopifySyncLoading] = useState(false);
  const [shopifySyncOpen, setShopifySyncOpen] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [simulationError, setSimulationError] = useState("");
  const [page, setPage] = useState(() =>
    safeRead(storageKeys.page, 1, DRAFT_TTL_MS),
  );
  const [density, setDensity] = useState(() =>
    safeRead(storageKeys.density, "compact"),
  );
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = safeRead(storageKeys["columns-layout"], defaultColumns);
    const normalized = saved.filter((key) =>
      optionalColumns.some(([item]) => item === key),
    );
    const layoutSchema = safeRead(storageKeys["columns-layout-schema"], 1);
    if (
      layoutSchema < 2 &&
      normalized.includes("channel_price") &&
      !normalized.includes("channel_compare_at")
    ) {
      const priceIndex = normalized.indexOf("channel_price");
      normalized.splice(priceIndex + 1, 0, "channel_compare_at");
      safeWrite(storageKeys["columns-layout"], normalized);
    }
    if (
      layoutSchema < 3 &&
      normalized.includes("channel_status") &&
      !normalized.includes("channel_inventory")
    ) {
      const statusIndex = normalized.indexOf("channel_status");
      normalized.splice(statusIndex + 1, 0, "channel_inventory");
      safeWrite(storageKeys["columns-layout"], normalized);
    }
    safeWrite(storageKeys["columns-layout-schema"], 3);
    return normalized;
  });
  const [pinnedColumn, setPinnedColumn] = useState(() =>
    safeRead(storageKeys["pinned-column"], "", DRAFT_TTL_MS),
  );
  const [columnFilters, setColumnFilters] = useState(() =>
    Object.fromEntries(
      Object.entries(
        normalizeColumnFilters(
          safeRead(storageKeys["column-filters"], {}, DRAFT_TTL_MS),
        ),
      ).filter(([key]) => supportedTableColumnKeys.has(key)),
    ),
  );
  const [tableSort, setTableSort] = useState(() => {
    const saved = safeRead(
      storageKeys["table-sort"],
      null,
      DRAFT_TTL_MS,
    );
    return supportedTableColumnKeys.has(saved?.key) ? saved : null;
  });
  const [savedViews, setSavedViews] = useState(() =>
    safeRead(storageKeys["saved-views"], []),
  );
  const [collapsedChannels, setCollapsedChannels] = useState(() => {
    const saved = safeRead(
      storageKeys["collapsed-channels"],
      channelColumns.map(([channel]) => channel),
      DRAFT_TTL_MS,
    );
    return Array.isArray(saved)
      ? saved.filter((channel) => channelLabels[channel])
      : [];
  });
  const [viewName, setViewName] = useState("");
  const tableScrollRef = useRef(null);
  const workspaceRequestRef = useRef(null);
  const workspaceRequestSequenceRef = useRef(0);
  const workspaceResultCacheRef = useRef(new Map());
  const [coverageOpen, setCoverageOpen] = useState(() =>
    safeRead(storageKeys["coverage-open"], false, DRAFT_TTL_MS),
  );
  const [architectureOpen, setArchitectureOpen] = useState(() =>
    safeRead(storageKeys["architecture-open"], false, DRAFT_TTL_MS),
  );
  const [filterBuilderOpen, setFilterBuilderOpen] = useState(() =>
    safeRead(storageKeys["filter-builder-open"], false, DRAFT_TTL_MS),
  );
  const [activeFilterField, setActiveFilterField] = useState("provider");
  const [simForm, setSimForm] = useState(() =>
    safeRead(storageKeys["pricing-draft"], DEFAULT_SIM_FORM, DRAFT_TTL_MS),
  );
  const [measurementDraft, setMeasurementDraft] = useState(() =>
    safeRead(
      storageKeys["measurement-draft"],
      DEFAULT_MEASUREMENT_DRAFT,
      DRAFT_TTL_MS,
    ),
  );

  useEffect(
    () => () => workspaceRequestRef.current?.abort(),
    [],
  );

  const load = async (
    requestedPage = page,
    requestedFilters = filters,
    requestedColumnFilters = columnFilters,
    requestedSort = tableSort,
  ) => {
    workspaceRequestRef.current?.abort();
    const controller = new AbortController();
    workspaceRequestRef.current = controller;
    const requestSequence = workspaceRequestSequenceRef.current + 1;
    workspaceRequestSequenceRef.current = requestSequence;
    const requestKey = JSON.stringify([
      requestedPage,
      requestedFilters,
      requestedColumnFilters,
      requestedSort,
    ]);
    const memoryCached = workspaceResultCacheRef.current.get(requestKey);
    if (memoryCached && Date.now() - memoryCached.savedAt < 30_000) {
      setWorkspace(memoryCached.data);
      setAppliedFilters({ ...initialFilters, ...requestedFilters });
      setPage(memoryCached.data.pagination?.page || requestedPage);
      setLoading(false);
      setStale(false);
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const workspaceResult = await catalogApi.workspace(
        requestedPage,
        requestedFilters,
        requestedColumnFilters,
        requestedSort,
        controller.signal,
      );
      if (requestSequence !== workspaceRequestSequenceRef.current) return;
      if (
        !workspaceResult.ok ||
        !workspaceResult.data?.summary ||
        !Array.isArray(workspaceResult.data?.products)
      ) {
        throw new Error("La API local no devolvió un catálogo válido.");
      }
      setWorkspace(workspaceResult.data);
      workspaceResultCacheRef.current.set(requestKey, {
        data: workspaceResult.data,
        savedAt: Date.now(),
      });
      if (workspaceResultCacheRef.current.size > 12) {
        const oldestKey = workspaceResultCacheRef.current.keys().next().value;
        workspaceResultCacheRef.current.delete(oldestKey);
      }
      const currentPage = workspaceResult.data.pagination?.page || requestedPage;
      const totalPages = workspaceResult.data.pagination?.pages || currentPage;
      if (currentPage < totalPages) {
        const nextPage = currentPage + 1;
        const nextKey = JSON.stringify([
          nextPage,
          requestedFilters,
          requestedColumnFilters,
          requestedSort,
        ]);
        if (!workspaceResultCacheRef.current.has(nextKey)) {
          window.setTimeout(async () => {
            try {
              const prefetched = await catalogApi.workspace(
                nextPage,
                requestedFilters,
                requestedColumnFilters,
                requestedSort,
              );
              if (
                prefetched.ok &&
                prefetched.data?.summary &&
                Array.isArray(prefetched.data?.products)
              ) {
                workspaceResultCacheRef.current.set(nextKey, {
                  data: prefetched.data,
                  savedAt: Date.now(),
                });
              }
            } catch {
              // La precarga es opcional y nunca reemplaza la vista vigente.
            }
          }, 300);
        }
      }
      setAppliedFilters({ ...initialFilters, ...requestedFilters });
      setPage(workspaceResult.data.pagination?.page || requestedPage);
      const timestamp = new Date().toISOString();
      setLastSuccess(timestamp);
      setStale(false);
      const previous =
        safeRead(storageKeys["workspace-cache"], {}, CACHE_TTL_MS) || {};
      safeWrite(storageKeys["workspace-cache"], {
        ...previous,
        workspace: workspaceResult.data,
        lastSuccess: timestamp,
      });
    } catch (error) {
      if (
        controller.signal.aborted ||
        error?.code === "ERR_CANCELED" ||
        error?.name === "CanceledError" ||
        requestSequence !== workspaceRequestSequenceRef.current
      ) {
        return;
      }
      const cached = safeRead(
        storageKeys["workspace-cache"],
        null,
        CACHE_TTL_MS,
      );
      if (cached) {
        if (
          !cached.workspace?.summary ||
          !Array.isArray(cached.workspace?.products)
        )
          throw error;
        setWorkspace(cached.workspace);
        setPage(cached.workspace.pagination?.page || requestedPage);
        setLastSuccess(cached.lastSuccess);
        setStale(true);
        setNotice(
          "La API local no respondió. Se conserva la última vista correcta; las acciones de cambio están bloqueadas.",
        );
      } else {
        setNotice(error.message);
      }
    } finally {
      if (requestSequence === workspaceRequestSequenceRef.current) {
        setLoading(false);
      }
    }
  };

  const loadTabData = async (tab) => {
    const cachePatch = {};
    if (tab === "Panel ejecutivo" && !executive) {
      const result = await catalogApi.executive();
      if (result.ok) {
        setExecutive(result.data);
        cachePatch.executive = result.data;
      }
    }
    if (tab === "Alineación multicanal" && !alignment) {
      await loadAlignment({
        channel: alignmentChannel,
        page: 1,
        search: alignmentSearch,
        matchStatus: alignmentStatus,
      });
    }
    if (tab === "Piloto y fuentes" && !pilot) {
      const [pilotResult, planResult] = await Promise.all([
        catalogApi.pilot(),
        catalogApi.importPlan(),
      ]);
      if (pilotResult.ok) {
        setPilot(pilotResult.data);
        cachePatch.pilot = pilotResult.data;
      }
      if (planResult.ok) {
        setImportPlan(planResult.data);
        cachePatch.importPlan = planResult.data;
      }
    }
    if (tab === "Shopify local" && !importPlan) {
      const result = await catalogApi.importPlan();
      if (result.ok) {
        setImportPlan(result.data);
        cachePatch.importPlan = result.data;
      }
    }
    if (
      tab === "Enriquecimiento logístico" &&
      (!physical || !measurement || !phase7)
    ) {
      const [physicalResult, measurementResult, phase7Result] =
        await Promise.all([
          catalogApi.physicalQueue(physicalFilters),
          catalogApi.measurementWorkspace(),
          catalogApi.phase7Workspace(),
        ]);
      if (physicalResult.ok && Array.isArray(physicalResult.data?.rows)) {
        setPhysical(physicalResult.data);
        cachePatch.physical = physicalResult.data;
      }
      if (
        measurementResult.ok &&
        Array.isArray(measurementResult.data?.progress)
      ) {
        setMeasurement(measurementResult.data);
        cachePatch.measurement = measurementResult.data;
      }
      if (phase7Result.ok) {
        setPhase7(phase7Result.data);
        cachePatch.phase7 = phase7Result.data;
      }
    }
    if (Object.keys(cachePatch).length) {
      const previous =
        safeRead(storageKeys["workspace-cache"], {}, CACHE_TTL_MS) || {};
      safeWrite(storageKeys["workspace-cache"], { ...previous, ...cachePatch });
    }
  };

  const synchronizeChannels = async () => {
    setNotice("");
    const started = await catalogApi.startChannelRefresh();
    if (!started.ok) {
      setNotice(started.data?.detail || "No fue posible iniciar la sincronización de canales.");
      return;
    }
    let current = started.data;
    setChannelRefresh(current);
    while (current?.status === "RUNNING") {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      const statusResult = await catalogApi.channelRefreshStatus();
      if (!statusResult.ok) {
        setNotice("La sincronización sigue protegida en el servidor, pero no fue posible consultar su avance.");
        return;
      }
      current = statusResult.data;
      setChannelRefresh(current);
    }
    if (current?.status === "SUCCEEDED") {
      setNotice("Canales con conector en vivo actualizados y conciliados por SKU. externalWrites=0.");
    } else {
      setNotice("La sincronización terminó parcialmente. Los canales fallidos conservaron su último snapshot correcto.");
    }
    await load(1, appliedFilters, columnFilters, tableSort);
  };

  const loadShopifySync = async () => {
    const result = await catalogApi.shopifySyncWorkspace();
    if (result.ok) setShopifySync(result.data);
  };

  const loadConnections = async () => {
    const result = await catalogApi.connections();
    if (result.ok) setConnectionsWorkspace(result.data);
  };

  const previewShopifySync = async () => {
    if (stale || shopifySyncLoading) return;
    setShopifySyncLoading(true);
    try {
      const selectedSkus = allMatchingSelected
        ? []
        : tableRows
            .filter((row) => selected.includes(row.id))
            .map((row) => row.variant?.sku)
            .filter(Boolean);
      const result = await catalogApi.shopifySyncAction({
        action: "PREVIEW",
        skus: selectedSkus,
        limit: selectedSkus.length || 250,
      });
      if (!result.ok) {
        setNotice(result.data?.detail || "No fue posible preparar la vista previa Shopify.");
        return;
      }
      setShopifySync(result.data);
      setShopifySyncOpen(true);
      setNotice(
        `Vista previa Shopify: ${result.data.latest_run?.counts?.ready || 0} cambios listos y ${result.data.latest_run?.counts?.blocked || 0} bloqueados. No se escribió Shopify.`,
      );
    } finally {
      setShopifySyncLoading(false);
    }
  };

  const loadAlignment = async ({
    channel = alignmentChannel,
    page: requestedPage = alignmentPage,
    search = alignmentSearch,
    matchStatus = alignmentStatus,
  } = {}) => {
    setAlignmentLoading(true);
    try {
      const result = await catalogApi.alignment({
        channel,
        page: requestedPage,
        search,
        matchStatus,
      });
      if (!result.ok || !Array.isArray(result.data?.records))
        throw new Error("La conciliación local no devolvió datos válidos.");
      setAlignment(result.data);
      setAlignmentChannel(channel);
      setAlignmentPage(result.data.pagination?.page || requestedPage);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setAlignmentLoading(false);
    }
  };

  // Carga inicial solamente; los reintentos y filtros invocan load con estado explícito.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load(1);
    void loadShopifySync();
  }, []);
  // Los paneles costosos se hidratan al abrir su pestaña; nunca bloquean el
  // primer render del catálogo.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadTabData(activeTab);
  }, [activeTab]);
  useEffect(() => {
    if (activeTab !== "Conexiones") return undefined;
    void loadConnections();
    const interval = window.setInterval(() => void loadConnections(), 60_000);
    return () => window.clearInterval(interval);
  }, [activeTab]);
  useEffect(() => {
    safeWrite(storageKeys.filters, filters);
  }, [filters, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys["physical-filters"], physicalFilters);
  }, [physicalFilters, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys.page, page);
  }, [page, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys["pricing-draft"], simForm);
  }, [simForm, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys["measurement-draft"], measurementDraft);
  }, [measurementDraft, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys["active-tab"], activeTab);
  }, [activeTab, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys["column-filters"], columnFilters);
  }, [columnFilters, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys["pinned-column"], pinnedColumn);
  }, [pinnedColumn, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys["table-sort"], tableSort);
  }, [tableSort, storageKeys]);
  useEffect(() => {
    safeWrite(storageKeys["collapsed-channels"], collapsedChannels);
  }, [collapsedChannels, storageKeys]);
  useEffect(() => {
    if (!workspace) return;
    const initialPolicy = workspace.policies?.[0];
    setSimForm((current) => ({
      ...current,
      provider_id:
        current.provider_id ||
        initialPolicy?.provider ||
        workspace.providers?.find(
          (provider) => provider.tax_treatment !== "PENDING",
        )?.id ||
        "",
      policy_id: current.policy_id || initialPolicy?.id || "",
    }));
  }, [workspace]);

  const productRows = useMemo(
    () =>
      (workspace?.products || []).map((product) => {
        const variant = product.variants?.[0] || {};
        const channels = Object.fromEntries(
          (product.channel_snapshots || []).map((snapshot) => [
            snapshot.channel,
            snapshot,
          ]),
        );
        const channel =
          channels.SHOPIFY || product.channel_snapshots?.[0] || {};
        const sodimacLinks = (variant.sodimac_catalog_links || []).filter(
          (link) => link.active,
        );
        const sodimac = sodimacLinks[0] || null;
        const currentShopifyCost = (variant.cost_observations || [])
          .filter(
            (observation) =>
              observation.source === "SHOPIFY" && observation.raw_cost != null,
          )
          .sort(
            (left, right) =>
              new Date(right.observed_at || 0).getTime() -
              new Date(left.observed_at || 0).getTime(),
          )[0];
        const canonicalCost =
          variant.canonical_cost?.derived_net_cost ?? null;
        const siigoSnapshot = (variant.siigo_snapshots || []).find(
          (snapshot) => snapshot.match_status === "EXACT_SHOPIFY",
        );
        const estimatedMargin =
          variant.price && canonicalCost
            ? ((Number(variant.price) - Number(canonicalCost)) /
                Number(variant.price)) *
              100
            : null;
        return {
          ...product,
          variant,
          channel,
          channels,
          sodimacLinks,
          sodimac,
          envia: variant.envia_readiness || {},
          shipping: variant.shipping_intelligence || {},
          canonicalCost,
          currentShopifyCost: currentShopifyCost?.raw_cost ?? null,
          shopifyCostReady: currentShopifyCost?.raw_cost != null,
          siigoSnapshot: siigoSnapshot || null,
          siigoCreated: Boolean(siigoSnapshot),
          estimatedMargin,
        };
      }),
    [workspace],
  );

  const values = (key) =>
    [...new Set(productRows.map((row) => row[key]).filter(Boolean))].sort();
  const filterDefinitions = [
    { key: "provider", label: FILTER_LABELS.provider, options: workspace?.facets?.providers || values("vendor") },
    {
      key: "channel",
      label: FILTER_LABELS.channel,
      options: Object.keys(workspace?.summary?.master_catalog?.channels || {}).map((code) => ({
        value: code,
        label: channelLabels[code] || code,
      })),
    },
    { key: "channelCoverage", label: FILTER_LABELS.channelCoverage, disabled: !filters.channel, options: [
      { value: "created", label: "Creado / vinculado" },
      { value: "missing", label: "Falta publicar" },
    ] },
    {
      key: "channelState",
      label: FILTER_LABELS.channelState,
      disabled: !filters.channel,
      options: Object.keys(workspace?.summary?.master_catalog?.channels?.[filters.channel]?.states || {}),
    },
    { key: "status", label: FILTER_LABELS.status, options: Object.keys(workspace?.summary?.master_catalog?.channels?.SHOPIFY?.states || {}) },
    { key: "brand", label: FILTER_LABELS.brand, options: workspace?.facets?.brands || values("brand") },
    { key: "collection", label: FILTER_LABELS.collection, options: workspace?.facets?.collections || [...new Set(productRows.flatMap((row) => row.collections || []))] },
    { key: "category", label: FILTER_LABELS.category, options: workspace?.facets?.categories || values("category") },
    { key: "quality", label: FILTER_LABELS.quality, options: [
      { value: "low", label: "Crítica / incompleta" },
      { value: "ready", label: "Lista (80+)" },
    ] },
    { key: "missing", label: FILTER_LABELS.missing, options: [
      { value: "yes", label: "Con faltantes" },
      { value: "no", label: "Completa" },
    ] },
    { key: "review", label: FILTER_LABELS.review, options: [
      { value: "yes", label: "Necesita revisión" },
      { value: "no", label: "No necesita revisión" },
    ] },
    { key: "enviaReadiness", label: FILTER_LABELS.enviaReadiness, options: [
      { value: "missing", label: "Faltan peso o medidas" },
      { value: "ready", label: "Listo para cotizar" },
      { value: "quoted", label: "Cotización actual disponible" },
    ] },
    { key: "sodimacLink", label: FILTER_LABELS.sodimacLink, options: ["UNLINKED", "LINKED_EXACT", "AMBIGUOUS", "STALE", "NOT_FOUND", "NEEDS_REVIEW"] },
    { key: "sodimacQuality", label: FILTER_LABELS.sodimacQuality, options: [
      { value: "APPROVED", label: "Aprobable" },
      { value: "WARNING", label: "Advertencia" },
      { value: "BLOCKER", label: "Bloqueo" },
    ] },
    { key: "sodimacFreshness", label: FILTER_LABELS.sodimacFreshness, options: [
      { value: "current", label: "Vigente" },
      { value: "stale", label: "Vencida" },
      { value: "never", label: "Sin verificar" },
    ] },
    { key: "sodimacInventory", label: FILTER_LABELS.sodimacInventory, options: [
      { value: "known", label: "Con fuente" },
      { value: "unknown", label: "Desconocido" },
    ] },
    { key: "costStatus", label: FILTER_LABELS.costStatus, options: [
      { value: "ready", label: "Con costo" },
      { value: "pending", label: "Sin costo" },
    ] },
    { key: "siigoStatus", label: FILTER_LABELS.siigoStatus, options: [
      { value: "created", label: "Creado en Siigo" },
      { value: "missing", label: "Falta crear en Siigo" },
    ] },
    { key: "priceMin", label: FILTER_LABELS.priceMin, type: "number" },
    { key: "priceMax", label: FILTER_LABELS.priceMax, type: "number" },
  ];
  const activeFilterDefinition =
    filterDefinitions.find(({ key }) => key === activeFilterField) || filterDefinitions[0];
  const filteredRows = productRows;

  const excelColumns = useMemo(() => {
    const channelMetricDefinition = (channel, metric) => {
      if (metric === "status")
        return {
          sort: (row) => channelStateFor(row, channel),
          filter: (row) => channelStateFor(row, channel),
        };
      if (metric === "price")
        return {
          sort: (row) => channelPriceFor(row, channel),
          filter: (row) => money(channelPriceFor(row, channel)),
        };
      if (metric === "compare_at")
        return {
          sort: (row) => shopifyCompareAtPriceFor(row),
          filter: (row) => money(shopifyCompareAtPriceFor(row)),
        };
      if (metric === "inventory")
        return {
          sort: (row) => shopifyInventoryTotalFor(row),
          filter: (row) => shopifyInventoryStatusFor(row),
        };
      if (metric === "profit")
        return {
          sort: (row) => channelProfitFor(row, channel).amount,
          filter: (row) => channelProfitFor(row, channel).label,
        };
      if (metric === "commission")
        return {
          sort: (row) => channelCommercialFor(row, channel)?.commission_amount ?? null,
          filter: (row) => channelCommercialFor(row, channel)?.commission_amount == null ? "Pendiente" : money(channelCommercialFor(row, channel).commission_amount),
        };
      if (metric === "costs")
        return {
          sort: (row) => channelCommercialFor(row, channel)?.other_cost_amount ?? null,
          filter: (row) => channelCommercialFor(row, channel)?.other_cost_amount == null ? "Pendiente" : money(channelCommercialFor(row, channel).other_cost_amount),
        };
      if (metric === "target")
        return {
          sort: (row) => channelCommercialFor(row, channel)?.target_value ?? null,
          filter: (row) => channelCommercialFor(row, channel)?.target_label || "Pendiente",
        };
      if (["reserve", "markup", "suggested", "difference"].includes(metric)) {
        const fieldByMetric = {
          reserve: "logistics_reserve_amount",
          markup: "markup_percent",
          suggested: "suggested_price",
          difference: "difference_amount",
        };
        const valueFor = (row) =>
          shopifyPricingSimulationFor(row)?.[fieldByMetric[metric]] ?? null;
        return {
          sort: (row) => {
            const value = valueFor(row);
            return value == null ? null : Number(value);
          },
          filter: (row) => {
            const value = valueFor(row);
            if (value == null) return "Sin costo";
            if (metric === "markup") return percent(value);
            if (metric === "difference") return suggestedPriceAdjustment(value).label;
            return money(value);
          },
        };
      }
      if (metric === "shipping")
        return {
          sort: (row) => {
            const shipping = channelShippingFor(row, channel);
            return (
              shipping?.seller_estimate ??
              shipping?.buyer_charge ??
              (channel === "SHOPIFY"
                ? row.shipping.average_shipping?.amount
                : null)
            );
          },
          filter: (row) => channelShippingLabel(row, channel),
        };
      if (metric === "quality")
        return {
          sort: (row) => channelQualityFor(row, channel).score,
          filter: (row) => channelQualityFor(row, channel).label,
        };
      return {
        sort: (row) => channelMissingFor(row, channel).length,
        filter: (row) => {
          const count = channelMissingFor(row, channel).length;
          return count ? `${count} faltantes` : "Completo";
        },
      };
    };
    const channelDefinitions = Object.fromEntries(
      channelColumns.flatMap(([channel]) =>
        channelMetricsFor(channel).map((metric) => [
          channelMetricColumnKey(channel, metric.key),
          channelMetricDefinition(channel, metric.key),
        ]),
      ),
    );
    return {
      photo: {
        sort: (row) => (row.images?.[0]?.source_url ? 1 : 0),
        filter: (row) =>
          row.images?.[0]?.source_url ? "Con imagen" : "Sin imagen",
      },
      product: {
        sort: (row) => row.title || "",
        filter: (row) => row.title || "Nombre pendiente",
      },
      sku: {
        sort: (row) => row.variant.sku || "",
        filter: (row) => row.variant.sku || "SKU pendiente",
      },
      provider: {
        sort: (row) => row.vendor || "",
        filter: (row) => row.vendor || "Pendiente",
      },
      cost: {
        sort: (row) =>
          row.currentShopifyCost == null
            ? null
            : Number(row.currentShopifyCost),
        filter: (row) =>
          row.currentShopifyCost == null
            ? "—"
            : money(row.currentShopifyCost),
      },
      siigo: {
        sort: (row) => (row.siigoCreated ? 1 : 0),
        filter: (row) => (row.siigoCreated ? "CREADO" : "FALTA CREAR"),
      },
      shipping: {
        sort: (row) => row.shipping.average_shipping?.amount ?? null,
        filter: (row) =>
          row.shipping.average_shipping?.amount == null
            ? "Pendiente"
            : money(row.shipping.average_shipping.amount),
      },
      ...channelDefinitions,
    };
  }, []);

  const tableRows = useMemo(() => {
    const result = filteredRows;
    const definition = excelColumns[tableSort?.key];
    if (!definition || !tableSort?.direction) return result;
    const direction = tableSort.direction === "desc" ? -1 : 1;
    return [...result].sort((left, right) => {
      const leftValue = definition.sort(left);
      const rightValue = definition.sort(right);
      if (leftValue == null && rightValue == null) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      if (typeof leftValue === "number" && typeof rightValue === "number")
        return (leftValue - rightValue) * direction;
      return (
        String(leftValue).localeCompare(String(rightValue), "es", {
          numeric: true,
          sensitivity: "base",
        }) * direction
      );
    });
  }, [filteredRows, tableSort, excelColumns]);

  const clearSelection = () => {
    setSelected([]);
    setAllMatchingSelected(false);
    setSelectionExclusions([]);
  };
  const updateColumnFilter = (key, valuesToKeep) => {
    const next = { ...columnFilters };
    if (!Array.isArray(valuesToKeep) || !valuesToKeep.length) delete next[key];
    else next[key] = valuesToKeep;
    setColumnFilters(next);
    clearSelection();
    load(1, appliedFilters, next, tableSort);
  };
  const updateTableSort = (key, direction) => {
    const next = key && direction ? { key, direction } : null;
    setTableSort(next);
    load(1, appliedFilters, columnFilters, next);
  };

  const isRowSelected = (id) =>
    allMatchingSelected
      ? !selectionExclusions.includes(id)
      : selected.includes(id);
  const pageAllSelected =
    tableRows.length > 0 && tableRows.every((row) => isRowSelected(row.id));
  const selectedCount = allMatchingSelected
    ? Math.max(
        Number(workspace?.pagination?.total || 0) - selectionExclusions.length,
        0,
      )
    : selected.length;
  const activeFilterEntries = Object.entries(appliedFilters).filter(
    ([key, value]) =>
      key !== "period" &&
      value !== null &&
      value !== undefined &&
      String(value).trim(),
  );
  const activeFilterCount =
    activeFilterEntries.length + Object.keys(columnFilters).length;
  const hasPendingFilterChanges =
    JSON.stringify(filters) !== JSON.stringify(appliedFilters);
  const filterDisplayValue = (key, value) => {
    const definition = filterDefinitions.find((item) => item.key === key);
    const option = definition?.options?.find((item) =>
      typeof item === "string" ? item === value : item.value === value,
    );
    if (typeof option === "string") return option;
    return option?.label || value;
  };
  const columnFilterLabel = (key) => {
    const [channel, metric] = key.split("__");
    if (metric) {
      return `${channelLabels[channel] || channel} · ${CHANNEL_METRIC_LABELS[metric] || metric}`;
    }
    return {
      photo: "Foto",
      sku: "SKU",
      product: "Nombre del producto",
      provider: "Proveedor (columna)",
      cost: "Costo Shopify sin IVA (columna)",
      siigo: "Siigo (columna)",
      price: "Precio (columna)",
      margin: "Margen (columna)",
      sodimac: "Sodimac (columna)",
      envia: "Envía (columna)",
      shipping: "Precio promedio de envío (columna)",
      quality: "Calidad (columna)",
      missing: "Faltantes (columna)",
    }[key] || key;
  };
  const toggleSelected = (id) => {
    if (allMatchingSelected) {
      setSelectionExclusions((current) =>
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id],
      );
      return;
    }
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };
  const toggleVisibleSelection = (checked) => {
    const visibleIds = tableRows.map((row) => row.id);
    if (allMatchingSelected) {
      setSelectionExclusions((current) =>
        checked
          ? current.filter((id) => !visibleIds.includes(id))
          : [...new Set([...current, ...visibleIds])],
      );
      return;
    }
    setSelected((current) =>
      checked
        ? [...new Set([...current, ...visibleIds])]
        : current.filter((id) => !visibleIds.includes(id)),
    );
  };
  const clearFilters = () => {
    setFilters(initialFilters);
    setColumnFilters({});
    setTableSort(null);
    clearSelection();
    load(1, initialFilters, {}, null);
  };
  const applyCurrentFilters = () => {
    clearSelection();
    load(1, filters, columnFilters, tableSort);
    setFilterBuilderOpen(false);
    safeWrite(storageKeys["filter-builder-open"], false);
  };
  const toggleCoverage = () =>
    setCoverageOpen((current) => {
      const next = !current;
      safeWrite(storageKeys["coverage-open"], next);
      return next;
    });
  const toggleArchitecture = () =>
    setArchitectureOpen((current) => {
      const next = !current;
      safeWrite(storageKeys["architecture-open"], next);
      return next;
    });
  const toggleFilterBuilder = () =>
    setFilterBuilderOpen((current) => {
      const next = !current;
      safeWrite(storageKeys["filter-builder-open"], next);
      return next;
    });
  const updateFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const removeAppliedFilter = (key) => {
    const next = {
      ...filters,
      [key]: "",
      ...(key === "channel"
        ? { channelCoverage: "", channelState: "" }
        : {}),
    };
    setFilters(next);
    clearSelection();
    load(1, next, columnFilters, tableSort);
  };
  const saveView = () => {
    const normalizedName = viewName.trim() || `Vista ${savedViews.length + 1}`;
    const next = [
      ...savedViews,
      {
        name: normalizedName,
        filters: appliedFilters,
        columnFilters,
        tableSort,
        visibleColumns,
        density,
        pinnedColumn,
        collapsedChannels,
      },
    ].slice(-6);
    setSavedViews(next);
    safeWrite(storageKeys["saved-views"], next);
    setViewName("");
    setNotice(
      `Vista “${normalizedName}” guardada para ${user?.email || "este usuario local"} en este navegador.`,
    );
  };
  const applySavedView = (index) => {
    if (index === "all") {
      clearFilters();
      return;
    }
    const view = savedViews[Number(index)];
    if (!view) return;
    const nextFilters = { ...initialFilters, ...view.filters };
    const nextColumnFilters = Object.fromEntries(
      Object.entries(normalizeColumnFilters(view.columnFilters)).filter(([key]) =>
        supportedTableColumnKeys.has(key),
      ),
    );
    const nextSort = supportedTableColumnKeys.has(view.tableSort?.key)
      ? view.tableSort
      : null;
    const nextVisibleColumns = Array.isArray(view.visibleColumns)
      ? view.visibleColumns.filter((key) =>
          optionalColumns.some(([item]) => item === key),
        )
      : visibleColumns;
    const nextDensity = ["compact", "comfortable"].includes(view.density)
      ? view.density
      : density;
    const nextPinnedColumn = pinnableColumns.some(
      ([key]) => key === view.pinnedColumn,
    )
      ? view.pinnedColumn
      : "";
    const nextCollapsedChannels = Array.isArray(view.collapsedChannels)
      ? view.collapsedChannels.filter((channel) => channelLabels[channel])
      : collapsedChannels;
    setFilters(nextFilters);
    setColumnFilters(nextColumnFilters);
    setTableSort(nextSort);
    setVisibleColumns(nextVisibleColumns);
    setDensity(nextDensity);
    setPinnedColumn(nextPinnedColumn);
    setCollapsedChannels(nextCollapsedChannels);
    safeWrite(storageKeys["columns-layout"], nextVisibleColumns);
    safeWrite(storageKeys.density, nextDensity);
    clearSelection();
    load(1, nextFilters, nextColumnFilters, nextSort);
  };
  const changeDensity = (value) => {
    setDensity(value);
    safeWrite(storageKeys.density, value);
  };
  const toggleColumn = (key) => {
    const hiding = visibleColumns.includes(key);
    if (
      hiding &&
      (pinnedColumn === key ||
        (key === "channels" &&
          channelMetricColumnKeys.includes(pinnedColumn)) ||
        pinnableColumns.some(
          ([itemKey, , visibleKey]) =>
            itemKey === pinnedColumn && visibleKey === key,
        ))
    ) {
      setPinnedColumn("");
    }
    setVisibleColumns((current) => {
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];
      safeWrite(storageKeys["columns-layout"], next);
      return next;
    });
  };
  const shows = (key) => visibleColumns.includes(key);
  const pinClass = (key) =>
    pinnedColumn === key ? "is-pinned-column" : "";
  const pinOptionVisible = (key) =>
    ["photo", "sku", "product"].includes(key) ||
    (["provider", "cost", "shipping", "siigo"].includes(key)
      ? shows(key)
      : pinnableColumns.some(
          ([itemKey, , visibleKey, channel]) =>
            itemKey === key &&
            shows("channels") &&
            shows(visibleKey) &&
            (!appliedFilters.channel || appliedFilters.channel === channel),
        ));
  useEffect(() => {
    if (pinnedColumn && !pinOptionVisible(pinnedColumn)) setPinnedColumn("");
  }, [appliedFilters.channel, pinnedColumn, visibleColumns]);
  const displayedChannelColumns =
    appliedFilters.channel &&
    channelColumns.some(([code]) => code === appliedFilters.channel)
      ? channelColumns.filter(([code]) => code === appliedFilters.channel)
      : channelColumns;
  const visibleChannelMetrics = channelMetrics.filter((metric) =>
    shows(metric.visibleKey),
  );
  const metricsForChannel = (channel) => {
    const applicableMetrics = visibleChannelMetrics.filter(
      (metric) => !metric.channels || metric.channels.includes(channel),
    );
    if (!collapsedChannels.includes(channel)) return applicableMetrics;
    const statusMetric = applicableMetrics.find(
      (metric) => metric.key === "status",
    );
    return statusMetric ? [statusMetric] : applicableMetrics.slice(0, 1);
  };
  const metricDescriptionFor = (channel, metric) => {
    if (metric.key !== "commission") return metric.description;
    if (!channelUsesCommission(channel)) return "No aplica · venta mayorista";
    if (channel === "SHOPIFY") {
      const formula = filteredRows
        .map((row) => channelCommercialFor(row, channel)?.commission_formula_label)
        .find(Boolean);
      return formula ? `${formula} · referencia pública` : "Tarifa Mercado Pago pendiente";
    }
    const rates = [
      ...new Set(
        filteredRows
          .map((row) => channelCommercialFor(row, channel)?.commission_percent)
          .filter((value) => value != null)
          .map((value) => Number(value)),
      ),
    ];
    if (!rates.length) return "Tarifa pendiente";
    if (rates.length === 1) return `Tarifa ${percent(rates[0])}`;
    return "Tarifa variable según producto";
  };
  const toggleChannelCollapsed = (channel) => {
    setCollapsedChannels((current) => {
      const collapsing = !current.includes(channel);
      const next = collapsing
        ? [...current, channel]
        : current.filter((item) => item !== channel);
      if (
        collapsing &&
        pinnedColumn.startsWith(`${channel}__`) &&
        pinnedColumn !== channelMetricColumnKey(channel, "status")
      )
        setPinnedColumn("");
      return next;
    });
  };
  const focusChannel = (channel) => {
    setCollapsedChannels(
      channelColumns
        .map(([code]) => code)
        .filter((code) => code !== channel),
    );
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const container = tableScrollRef.current;
        const heading = container?.querySelector(
          `[data-channel-heading="${channel}"]`,
        );
        if (!container || !heading) return;
        container.scrollTo({
          left: Math.max(0, heading.offsetLeft - 180),
          behavior: "smooth",
        });
      });
    });
  };
  const collapseAllChannels = () => {
    setCollapsedChannels(channelColumns.map(([channel]) => channel));
    tableScrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };
  const tableColumnCount =
    5 +
    Number(shows("provider")) +
    Number(shows("cost")) +
    Number(shows("shipping")) +
    Number(shows("siigo")) +
    (shows("channels")
      ? displayedChannelColumns.reduce(
          (total, [channel]) => total + metricsForChannel(channel).length,
          0,
        )
      : 0);

  const decidePhysical = async (candidateId, action) => {
    if (stale) return;
    const result = await catalogApi.decidePhysicalEvidence({
      candidate_id: candidateId,
      action,
      actor_label: actorScope,
      reason: "Revisión operativa local",
    });
    if (!result.ok) {
      setNotice(
        result.data?.detail ||
          "La evidencia no puede aprobarse con esta puerta de seguridad.",
      );
      return;
    }
    setNotice(
      `${action === "APPROVE_LOCAL" ? "Aprobación" : action === "REJECT" ? "Rechazo" : "Solicitud al proveedor"} guardada solo localmente. externalWrites=0.`,
    );
    await load(page, appliedFilters);
  };

  const measurementAction = async (body) => {
    if (stale) return;
    const result = await catalogApi.measurementAction({
      ...body,
      actor_label: actorScope,
    });
    if (!result.ok) {
      setNotice(
        result.data?.detail || "No fue posible guardar la captura local.",
      );
      return;
    }
    const batch = result.data?.batch;
    setNotice(
      batch
        ? `Vista interna: ${batch.valid_rows} válidas, ${batch.error_rows} con error y ${batch.conflict_rows} en conflicto. externalWrites=0.`
        : `Tarea guardada únicamente en ${CATALOG_RUNTIME_LABEL}. externalWrites=0.`,
    );
    await load(page, appliedFilters);
  };

  const uploadMeasurement = async (file) => {
    if (stale || !file) return;
    const form = new FormData();
    form.append("action", "PREVIEW_IMPORT");
    form.append("provider", "Barú");
    form.append("actor_label", actorScope);
    form.append("file", file);
    const result = await catalogApi.measurementAction(form);
    if (!result.ok) {
      setNotice(result.data?.detail || "El archivo no pudo revisarse.");
      return;
    }
    const batch = result.data.batch;
    setNotice(
      `Archivo revisado localmente: ${batch.valid_rows} válidas, ${batch.error_rows} con error, ${batch.conflict_rows} conflictos. Nada fue enviado.`,
    );
    await load(page, appliedFilters);
  };

  const registerMeasurement = async (event) => {
    event.preventDefault();
    await measurementAction({
      action: "REGISTER_MEASUREMENT",
      measurement: measurementDraft,
    });
  };

  const simulate = async (event) => {
    event.preventDefault();
    if (stale) return;
    setSimulationError("");
    const result = await catalogApi.simulatePrice(simForm);
    if (!result.ok) {
      setSimulation(null);
      setSimulationError(result.data?.detail || "No fue posible simular.");
      return;
    }
    setSimulation(result.data);
    setNotice(
      "Simulación guardada únicamente en la base local. externalWrites=0.",
    );
    await load(page);
  };

  const updateHypothesis = async (values) => {
    if (stale) return;
    const result = await catalogApi.updateHypothesis(values);
    if (!result.ok) {
      setNotice(
        result.data?.detail || "No fue posible guardar la hipótesis local.",
      );
      return;
    }
    setNotice(
      `Hipótesis actualizada solo en ${CATALOG_RUNTIME_LABEL}; permanece inactiva y sin autorización comercial. externalWrites=0.`,
    );
    await load(page);
  };

  return (
    <div className="catalog-workspace">
      <header className="catalog-heading">
        <div>
          <p className="breadcrumbs">
            Merci / Productos y publicaciones / Laboratorio local
          </p>
          <h1>
            Catálogo, costos y precios multicanal <span>Local</span>
          </h1>
          <p>
            Shopify como catálogo maestro; comparación auditable de
            publicaciones, precios, inventario y envío por canal.
          </p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="sync-channels-action"
            onClick={synchronizeChannels}
            disabled={loading || channelRefresh?.status === "RUNNING"}
          >
            {channelRefresh?.status === "RUNNING"
              ? `Sincronizando ${channelLabels[channelRefresh.current_channel] || "canales"}…`
              : "↻ Sincronizar canales"}
          </button>
          <button type="button" onClick={() => load(page)} disabled={loading}>
            ↻ Actualizar local
          </button>
          <span className="safety-pill">● Solo lectura · externalWrites=0</span>
        </div>
      </header>

      {shopifySync && (
        <section className={`shopify-sync-beta ${shopifySyncOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="shopify-sync-summary"
            aria-expanded={shopifySyncOpen}
            onClick={() => setShopifySyncOpen((current) => !current)}
          >
            <div>
              <span>Sincronización Shopify · Beta</span>
              <strong>Precios e inventario con cola, auditoría y control de concurrencia</strong>
            </div>
            <div>
              <b>{shopifySync.gates?.execution_allowed ? "Piloto habilitado" : "Escrituras apagadas"}</b>
              <small>{shopifySyncOpen ? "Ocultar" : "Revisar"}</small>
            </div>
          </button>
          {shopifySyncOpen && (
            <div className="shopify-sync-body">
              <div className="shopify-sync-kpis">
                <span><small>Modo</small><strong>{shopifySync.environment}</strong></span>
                <span><small>Listos</small><strong>{shopifySync.latest_run?.counts?.ready || 0}</strong></span>
                <span><small>Bloqueados</small><strong>{shopifySync.latest_run?.counts?.blocked || 0}</strong></span>
                <span><small>Escrituras</small><strong>{shopifySync.latest_run?.external_writes || 0}</strong></span>
              </div>
              <div className="shopify-sync-copy">
                <p>
                  El detector recurrente consolida cambios locales. El inventario solo se propone cuando existe una fuente externa canónica, vigente y vinculada a una única ubicación de Shopify. La lectura de Shopify nunca se usa como si fuera un inventario nuevo del proveedor.
                </p>
                <ul>
                  <li>Precio: cálculo local vigente, costo trazable y SKU literal único.</li>
                  <li>Inventario: compare-and-set para no pisar cambios concurrentes.</li>
                  <li>Piloto: máximo {shopifySync.policy?.maximum_batch_size || 5} SKU y autorización separada.</li>
                </ul>
              </div>
              <div className="shopify-sync-actions">
                <button type="button" onClick={previewShopifySync} disabled={stale || shopifySyncLoading}>
                  {shopifySyncLoading
                    ? "Preparando…"
                    : allMatchingSelected
                      ? "Revisar muestra de 250"
                      : selectedCount
                        ? `Revisar ${selectedCount} seleccionados`
                        : "Preparar vista previa"}
                </button>
                <span>
                  Recurrente en Beta al configurar el worker · ejecución externa desactivada
                </span>
              </div>
              {!!shopifySync.latest_run?.items?.length && (
                <div className="shopify-sync-items">
                  {shopifySync.latest_run.items.slice(0, 8).map((item) => (
                    <article key={item.id} data-status={item.status}>
                      <strong>{item.sku || "SKU pendiente"}</strong>
                      <span>
                        {item.fields?.map((field) => shopifySyncFieldLabels[field] || field).join(" + ")
                          || shopifySyncStatusLabels[item.status]
                          || item.status}
                      </span>
                      <small>{item.blockers?.map(shopifySyncBlockerLabel).join(" · ") || "Sin bloqueos"}</small>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {channelRefresh?.run_id && (
        <section className={`channel-refresh-panel ${String(channelRefresh.status).toLowerCase()}`} aria-live="polite">
          <header>
            <div>
              <strong>Actualización de fuentes</strong>
              <span>
                {channelRefresh.status === "RUNNING"
                  ? "Leyendo canales en orden: Shopify → Siigo → Mercado Libre → Falabella."
                  : channelRefresh.status === "SUCCEEDED"
                    ? "Lecturas completadas y conciliación local renovada."
                    : "Proceso terminado con canales pendientes; se conservaron los datos anteriores."}
              </span>
            </div>
            <b>{channelRefresh.status === "RUNNING" ? "En curso" : channelRefresh.status === "SUCCEEDED" ? "Listo" : "Revisar"}</b>
          </header>
          <div className="channel-refresh-grid">
            {channelRefresh.channels.map((channel) => (
              <article key={channel.code} data-status={channel.status}>
                <strong>{channel.label}</strong>
                <span>{channel.status === "SUCCEEDED" ? "Actualizado" : channel.status === "RUNNING" ? "Leyendo…" : channel.status === "PENDING" ? "En espera" : channel.status === "MANUAL_SOURCE" ? "Fuente manual" : "No actualizado"}</span>
                <small>{channel.message}</small>
              </article>
            ))}
          </div>
          <footer>Solo lectura externa · conciliación por SKU en SQLite local · externalWrites=0</footer>
        </section>
      )}

      <nav className="catalog-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      {notice && (
        <div className={`continuity-notice ${stale ? "stale" : ""}`}>
          <div>
            <strong>
              {stale ? "Vista temporalmente desactualizada" : "Estado local"}
            </strong>
            <span>{notice}</span>
            {lastSuccess && (
              <small>
                Última actualización correcta:{" "}
                {new Date(lastSuccess).toLocaleString("es-CO")}
              </small>
            )}
          </div>
          <button type="button" onClick={() => load(page)}>
            Reintentar
          </button>
        </div>
      )}
      {loading && !workspace ? (
        <div className="catalog-loading">Preparando el catálogo local…</div>
      ) : null}

      {activeTab === "Catálogo maestro" && workspace && (
        <>
          <section
            className={`master-channel-coverage collapsible-panel ${coverageOpen ? "is-open" : ""}`}
          >
            <button
              className="collapsible-trigger"
              type="button"
              aria-expanded={coverageOpen}
              onClick={toggleCoverage}
            >
              <div>
                <span className="eyebrow">Cobertura global</span>
                <strong className="collapsible-title">
                  Qué existe y qué falta publicar por canal
                </strong>
              </div>
              <span className="collapsible-action">
                <small>Base: variantes Shopify</small>
                <b aria-hidden="true">{coverageOpen ? "−" : "+"}</b>
                {coverageOpen ? "Ocultar" : "Mostrar"}
              </span>
            </button>
            {coverageOpen && (
              <div className="collapsible-content">
                {Object.entries(
                  workspace.summary.master_catalog?.channels || {},
                ).map(([code, metrics]) => (
                  <article key={code}>
                    <div>
                      <strong>{channelLabels[code] || code}</strong>
                      <StatusBadge
                        value={`${metrics.coverage_percent || 0}%`}
                        tone={metrics.missing ? "warning" : "success"}
                      />
                    </div>
                    <dl>
                      <div>
                        <dt>Creadas / vinculadas</dt>
                        <dd>{metrics.created || 0}</dd>
                      </div>
                      <div>
                        <dt>Faltan</dt>
                        <dd>{metrics.missing || 0}</dd>
                      </div>
                    </dl>
                    <small>
                      {Object.entries(metrics.states || {})
                        .map(([state, count]) => `${state}: ${count}`)
                        .join(" · ") || "Sin integración disponible"}
                    </small>
                    {metrics.classification ===
                      "COMMERCIAL_PILOT_NOT_LIVE_CHANNEL" && (
                      <em>Piloto comercial; no prueba publicación activa.</em>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          <ChannelReadinessMatrix
            channels={phase7?.channels || []}
            liveChannels={workspace.channels || []}
            open={architectureOpen}
            onToggle={toggleArchitecture}
          />
          <section className="catalog-query-shell">
            <div className="catalog-search-row shopify-filter-toolbar">
              <select
                className="catalog-view-selector"
                aria-label={`Vistas de ${user?.email || "usuario local"}`}
                defaultValue="all"
                onChange={(event) => applySavedView(event.target.value)}
              >
                <option value="all">Todos</option>
                {savedViews.map((view, index) => (
                  <option key={`${view.name}-${index}`} value={index}>
                    {view.name}
                  </option>
                ))}
              </select>
              <div className="catalog-search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Buscar catálogo"
                  placeholder="Buscar y filtrar por SKU, producto, proveedor, marca o categoría"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyCurrentFilters();
                  }}
                />
              </div>
              <button
                type="button"
                className={`filter-builder-toggle ${filterBuilderOpen ? "active" : ""}`}
                aria-expanded={filterBuilderOpen}
                onClick={toggleFilterBuilder}
              >
                + Agregar filtro
                {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
              </button>
              <button type="button" onClick={applyCurrentFilters}>
                Buscar
              </button>
            </div>

            <div className="active-filter-strip" aria-label="Filtros aplicados">
              {activeFilterEntries.map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  className="active-filter-chip"
                  onClick={() => removeAppliedFilter(key)}
                  title="Quitar este filtro"
                >
                  <span>{FILTER_LABELS[key] || key} es</span>
                  <strong>{filterDisplayValue(key, value)}</strong>
                  <b aria-hidden="true">×</b>
                </button>
              ))}
              {Object.entries(columnFilters).map(([key, selectedValues]) => (
                <button
                  key={key}
                  type="button"
                  className="active-filter-chip column-filter-chip"
                  onClick={() => updateColumnFilter(key, undefined)}
                  title="Quitar este filtro de columna"
                >
                  <span>{columnFilterLabel(key)} es</span>
                  <strong>
                    {selectedValues.length > 2
                      ? `${selectedValues.length} valores`
                      : selectedValues.join(", ")}
                  </strong>
                  <b aria-hidden="true">×</b>
                </button>
              ))}
              {!activeFilterCount && (
                <span className="no-active-filters">Sin filtros aplicados</span>
              )}
              {hasPendingFilterChanges && (
                <span className="pending-filter-change">
                  Cambios sin aplicar
                </span>
              )}
            </div>

            {filterBuilderOpen && (
              <div className="compact-filter-builder">
                <div className="filter-field-picker">
                  <label>
                    <span>Filtrar por</span>
                    <select
                      value={activeFilterField}
                      onChange={(event) => setActiveFilterField(event.target.value)}
                    >
                      {FILTER_FIELDS.map((key) => (
                        <option key={key} value={key}>
                          {FILTER_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activeFilterDefinition.type === "number" ? (
                    <label>
                      <span>{activeFilterDefinition.label}</span>
                      <input
                        type="number"
                        min="0"
                        value={filters[activeFilterDefinition.key]}
                        onChange={(event) =>
                          updateFilter(activeFilterDefinition.key, event.target.value)
                        }
                        placeholder="Escribe un valor"
                      />
                    </label>
                  ) : (
                    <FilterSelect
                      label={activeFilterDefinition.label}
                      value={filters[activeFilterDefinition.key]}
                      disabled={activeFilterDefinition.disabled}
                      onChange={(value) => {
                        if (activeFilterDefinition.key === "channel") {
                          setFilters((current) => ({
                            ...current,
                            channel: value,
                            channelCoverage: "",
                            channelState: "",
                          }));
                        } else {
                          updateFilter(activeFilterDefinition.key, value);
                        }
                      }}
                      options={activeFilterDefinition.options || []}
                    />
                  )}
                </div>
                <div className="compact-filter-actions">
                  <button type="button" className="secondary" onClick={clearFilters}>
                    Limpiar todo
                  </button>
                  <details className="save-view-menu">
                    <summary>Guardar vista</summary>
                    <div>
                      <strong>Guardar para {user?.email || "usuario local"}</strong>
                      <input
                        aria-label="Nombre de la vista"
                        placeholder={`Vista ${savedViews.length + 1}`}
                        value={viewName}
                        onChange={(event) => setViewName(event.target.value)}
                      />
                      <button type="button" onClick={saveView}>
                        Guardar
                      </button>
                    </div>
                  </details>
                  <button type="button" onClick={applyCurrentFilters}>
                    Aplicar filtro
                  </button>
                </div>
              </div>
            )}

            <div className="catalog-result-line">
              <span>
                <strong>{workspace.pagination?.total || 0} resultados</strong>
                {" · "}
                {tableRows.length} en esta página
                {" · "}
                página {workspace.pagination?.page || 1} de{" "}
                {workspace.pagination?.pages || 1}
                {loading && (
                  <strong className="catalog-results-loading" role="status">
                    Actualizando resultados…
                  </strong>
                )}
              </span>
              <div className="view-controls">
                <select
                  aria-label="Columna fija"
                  value={pinnedColumn}
                  onChange={(event) => setPinnedColumn(event.target.value)}
                >
                  <option value="">Sin columna fija</option>
                  {pinnableColumns
                    .filter(([key]) => pinOptionVisible(key))
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        Fijar: {label}
                      </option>
                    ))}
                </select>
                <details className="column-menu">
                  <summary>Columnas · {visibleColumns.length}</summary>
                  <div>
                    {optionalColumns.map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={shows(key)}
                          onChange={() => toggleColumn(key)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </details>
                <select
                  aria-label="Densidad de tabla"
                  value={density}
                  onChange={(event) => changeDensity(event.target.value)}
                >
                  <option value="compact">Compacta</option>
                  <option value="comfortable">Cómoda</option>
                </select>
              </div>
            </div>
          </section>
          {(pageAllSelected || allMatchingSelected) && selectedCount > 0 && (
            <div className="selection-scope-banner" role="status">
              {allMatchingSelected ? (
                <>
                  <strong>
                    {selectedCount} variantes seleccionadas en todo el resultado
                  </strong>
                  <span>
                    Incluye todas las páginas que coinciden con los filtros
                    actuales.
                  </span>
                  <button type="button" onClick={clearSelection}>
                    Limpiar selección global
                  </button>
                </>
              ) : (
                <>
                  <strong>
                    {tableRows.length} variantes seleccionadas en esta página
                  </strong>
                  <span>
                    Hay {workspace.pagination?.total || 0} coincidencias en
                    todas las páginas.
                  </span>
                  {(workspace.pagination?.total || 0) > selected.length && (
                    <button
                      type="button"
                      onClick={() => {
                        setAllMatchingSelected(true);
                        setSelected([]);
                        setSelectionExclusions([]);
                      }}
                    >
                      Seleccionar las {workspace.pagination?.total || 0}{" "}
                      variantes que coinciden
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {shows("channels") && (
            <nav className="channel-focus-nav" aria-label="Navegar por canales">
              <span>Ver un canal:</span>
              {displayedChannelColumns.map(([code, label]) => (
                <button
                  type="button"
                  key={code}
                  className={collapsedChannels.includes(code) ? "" : "active"}
                  aria-pressed={!collapsedChannels.includes(code)}
                  onClick={() => focusChannel(code)}
                >
                  {label}
                </button>
              ))}
              <button type="button" onClick={collapseAllChannels}>
                Plegar todos
              </button>
            </nav>
          )}
          <div
            className={`catalog-table-card density-${density} ${loading ? "is-refreshing" : ""}`.trim()}
            aria-busy={loading}
          >
            {loading && (
              <div className="catalog-table-refresh-status" role="status">
                Aplicando filtros…
              </div>
            )}
            <div className="catalog-table-scroll" ref={tableScrollRef}>
              <table>
                <thead className="channel-table-head">
                  <tr className="channel-group-row">
                    <th
                      className="sticky-select"
                      rowSpan={
                        shows("channels") && visibleChannelMetrics.length
                          ? 2
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={pageAllSelected}
                        aria-label="Seleccionar variantes visibles en esta página"
                        onChange={(event) =>
                          toggleVisibleSelection(event.target.checked)
                        }
                      />
                    </th>
                    <ExcelColumnHeader
                      columnKey="photo"
                      pinned={pinnedColumn === "photo"}
                      label="Foto"
                      className="sticky-photo"
                      rowSpan={
                        shows("channels") && visibleChannelMetrics.length
                          ? 2
                          : undefined
                      }
                      rows={filteredRows}
                      definition={excelColumns.photo}
                      sortConfig={tableSort}
                      onSort={updateTableSort}
                      columnFilters={columnFilters}
                      onFilterChange={updateColumnFilter}
                    />
                    <ExcelColumnHeader
                      columnKey="sku"
                      pinned={pinnedColumn === "sku"}
                      label="SKU"
                      className="sticky-sku"
                      rowSpan={
                        shows("channels") && visibleChannelMetrics.length
                          ? 2
                          : undefined
                      }
                      rows={filteredRows}
                      definition={excelColumns.sku}
                      sortConfig={tableSort}
                      onSort={updateTableSort}
                      columnFilters={columnFilters}
                      onFilterChange={updateColumnFilter}
                    />
                    <ExcelColumnHeader
                      columnKey="product"
                      pinned={pinnedColumn === "product"}
                      label="Nombre del producto"
                      className="sticky-product"
                      rowSpan={
                        shows("channels") && visibleChannelMetrics.length
                          ? 2
                          : undefined
                      }
                      rows={filteredRows}
                      definition={excelColumns.product}
                      sortConfig={tableSort}
                      onSort={updateTableSort}
                      columnFilters={columnFilters}
                      onFilterChange={updateColumnFilter}
                    />
                    {shows("provider") && (
                      <ExcelColumnHeader
                        columnKey="provider"
                        pinned={pinnedColumn === "provider"}
                        label="Proveedor"
                        rowSpan={
                          shows("channels") && visibleChannelMetrics.length
                            ? 2
                            : undefined
                        }
                        rows={filteredRows}
                        definition={excelColumns.provider}
                        sortConfig={tableSort}
                        onSort={updateTableSort}
                        columnFilters={columnFilters}
                        onFilterChange={updateColumnFilter}
                      />
                    )}
                    {shows("cost") && (
                      <ExcelColumnHeader
                        columnKey="cost"
                        pinned={pinnedColumn === "cost"}
                        label="Costo Shopify sin IVA"
                        rowSpan={
                          shows("channels") && visibleChannelMetrics.length
                            ? 2
                            : undefined
                        }
                        rows={filteredRows}
                        definition={excelColumns.cost}
                        sortConfig={tableSort}
                        onSort={updateTableSort}
                        columnFilters={columnFilters}
                        onFilterChange={updateColumnFilter}
                      />
                    )}
                    {shows("shipping") && (
                      <ExcelColumnHeader
                        columnKey="shipping"
                        pinned={pinnedColumn === "shipping"}
                        label="Precio promedio de envío"
                        rowSpan={
                          shows("channels") && visibleChannelMetrics.length
                            ? 2
                            : undefined
                        }
                        rows={filteredRows}
                        definition={excelColumns.shipping}
                        sortConfig={tableSort}
                        onSort={updateTableSort}
                        columnFilters={columnFilters}
                        onFilterChange={updateColumnFilter}
                      />
                    )}
                    {shows("siigo") && (
                      <ExcelColumnHeader
                        columnKey="siigo"
                        pinned={pinnedColumn === "siigo"}
                        label="Siigo"
                        rowSpan={
                          shows("channels") && visibleChannelMetrics.length
                            ? 2
                            : undefined
                        }
                        rows={filteredRows}
                        definition={excelColumns.siigo}
                        sortConfig={tableSort}
                        onSort={updateTableSort}
                        columnFilters={columnFilters}
                        onFilterChange={updateColumnFilter}
                      />
                    )}
                    {shows("channels") && visibleChannelMetrics.length > 0 &&
                      displayedChannelColumns.map(([code, label]) => (
                        <th
                          className="channel-group-heading"
                          data-channel-heading={code}
                          colSpan={metricsForChannel(code).length}
                          key={code}
                          scope="colgroup"
                        >
                          <span className="channel-group-heading-content">
                            <span>
                              {label}
                              <small>
                                {channelBusinessModelFor(code).type ===
                                "WHOLESALE"
                                  ? "Venta mayorista"
                                  : "Venta directa / comisión"}
                              </small>
                            </span>
                            <button
                              type="button"
                              className="channel-collapse-button"
                              aria-label={`${collapsedChannels.includes(code) ? "Desplegar" : "Plegar"} ${label}`}
                              aria-expanded={!collapsedChannels.includes(code)}
                              onClick={() => toggleChannelCollapsed(code)}
                            >
                              {collapsedChannels.includes(code) ? "+" : "−"}
                            </button>
                          </span>
                        </th>
                      ))}
                    <th
                      rowSpan={
                        shows("channels") && visibleChannelMetrics.length
                          ? 2
                          : undefined
                      }
                    />
                  </tr>
                  {shows("channels") && visibleChannelMetrics.length > 0 && (
                    <tr className="channel-metric-row">
                      {displayedChannelColumns.flatMap(([channel]) =>
                        metricsForChannel(channel).map((metric) => {
                          const key = channelMetricColumnKey(
                            channel,
                            metric.key,
                          );
                          return (
                            <ExcelColumnHeader
                              columnKey={key}
                              pinned={pinnedColumn === key}
                              label={channelMetricLabelFor(channel, metric)}
                              description={metricDescriptionFor(channel, metric)}
                              className={`channel-metric-heading channel-metric-${metric.key}`}
                              key={key}
                              rows={filteredRows}
                              definition={excelColumns[key]}
                              sortConfig={tableSort}
                              onSort={updateTableSort}
                              columnFilters={columnFilters}
                              onFilterChange={updateColumnFilter}
                            />
                          );
                        }),
                      )}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.needs_review ? "needs-review" : ""}
                    >
                      <td className="sticky-select">
                        <input
                          type="checkbox"
                          checked={isRowSelected(row.id)}
                          onChange={() => toggleSelected(row.id)}
                        />
                      </td>
                      <td
                        className={`sticky-photo catalog-photo-cell ${pinClass("photo")}`.trim()}
                      >
                        <button
                          className="catalog-photo-button"
                          type="button"
                          aria-label={`Ver ${row.title}`}
                          onClick={() => setDetail(row)}
                        >
                          {row.images?.[0]?.source_url ? (
                            <img
                              className="catalog-product-thumb"
                              src={row.images[0].source_url}
                              alt={row.images[0].alt_text || row.title}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span
                              className="catalog-product-thumb placeholder"
                              aria-hidden="true"
                            >
                              Sin imagen
                            </span>
                          )}
                        </button>
                      </td>
                      <td
                        className={`sticky-sku catalog-sku-cell ${pinClass("sku")}`.trim()}
                      >
                        <strong>{row.variant.sku || "SKU pendiente"}</strong>
                      </td>
                      <td
                        className={`sticky-product ${pinClass("product")}`.trim()}
                      >
                        <button
                          className="product-link"
                          type="button"
                          onClick={() => setDetail(row)}
                        >
                          <span className="product-link-copy">
                            <strong>{row.title}</strong>
                          </span>
                        </button>
                      </td>
                      {shows("provider") && (
                        <td className={pinClass("provider")}>
                          {row.vendor || "Pendiente"}
                        </td>
                      )}
                      {shows("cost") && (
                        <td
                          className={`shopify-cost-cell ${pinClass("cost")}`.trim()}
                        >
                          <strong>
                            {row.currentShopifyCost == null
                              ? "Falta costo"
                              : money(row.currentShopifyCost)}
                          </strong>
                        </td>
                      )}
                      {shows("shipping") && (
                        <td
                          className={`average-shipping-cell ${pinClass("shipping")}`.trim()}
                          title="Referencia informativa; no forma parte del costo del producto"
                        >
                          <strong>
                            {row.shipping.average_shipping?.amount == null
                              ? "—"
                              : money(row.shipping.average_shipping.amount)}
                          </strong>
                          <small>
                            {shippingBandLabel(row.shipping.average_shipping)}
                            {" · estimado"}
                          </small>
                          {shopifyShippingOriginFor(row) && (
                            <small>
                              Sale de {shopifyShippingOriginFor(row).location_name}
                            </small>
                          )}
                        </td>
                      )}
                      {shows("siigo") && (
                        <td
                          className={`siigo-status-cell ${pinClass("siigo")}`.trim()}
                        >
                          <StatusBadge
                            value={row.siigoCreated ? "CREADO" : "FALTA CREAR"}
                            tone={row.siigoCreated ? "active" : "missing"}
                          />
                          <small>
                            {row.siigoSnapshot
                              ? `${row.siigoSnapshot.active ? "Activo" : "Inactivo"} · ${row.siigoSnapshot.sku || "SKU no informado"}`
                              : row.variant.sku
                                ? "Pendiente de vincular o crear"
                                : "Bloqueado: SKU Shopify pendiente"}
                          </small>
                        </td>
                      )}
                      {shows("channels") &&
                        displayedChannelColumns.flatMap(([channel]) =>
                          metricsForChannel(channel).map((metric) => {
                            const key = channelMetricColumnKey(
                              channel,
                              metric.key,
                            );
                            return (
                              <ChannelMetricCell
                                key={key}
                                row={row}
                                channel={channel}
                                metric={metric.key}
                                pinned={pinnedColumn === key}
                              />
                            );
                          }),
                        )}
                      <td>
                        <button
                          className="row-action"
                          type="button"
                          onClick={() => setDetail(row)}
                        >
                          Ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!tableRows.length && (
                    <tr>
                      <td colSpan={tableColumnCount} className="empty-state">
                        Sin resultados para estos filtros. Esto no significa que
                        se hayan borrado datos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pagination-bar">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => load(page - 1, appliedFilters)}
            >
              ← Anterior
            </button>
            <span>
              Página {page} de {workspace.pagination?.pages || 1}
            </span>
            <button
              type="button"
              disabled={loading || page >= (workspace.pagination?.pages || 1)}
              onClick={() => load(page + 1, appliedFilters)}
            >
              Siguiente →
            </button>
          </div>
          {selectedCount > 0 && (
            <div className="selection-workbar">
              <div>
                <strong>{selectedCount} variantes seleccionadas</strong>
                <span>
                  {allMatchingSelected
                    ? "Selección global basada en los filtros actuales."
                    : "Selección explícita de filas."}{" "}
                  La aprobación es interna; no publica.
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setNotice(
                    `Vista previa local creada para ${selectedCount} variantes. Falta revisión antes de aprobar.`,
                  )
                }
                disabled={stale}
              >
                Crear vista previa
              </button>
              <button
                type="button"
                onClick={() =>
                  setNotice(
                    `Lote de ${selectedCount} variantes marcado como aprobado internamente. No se escribió en ningún canal.`,
                  )
                }
                disabled={stale}
              >
                Aprobar internamente
              </button>
              <button type="button" onClick={clearSelection}>
                Cancelar
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === "Panel ejecutivo" && (
        <ExecutivePanel
          executive={executive}
          filters={filters}
          updateFilter={updateFilter}
          productRows={productRows}
        />
      )}
      {activeTab === "Alineación multicanal" && (
        <ChannelAlignmentPanel
          data={alignment}
          loading={alignmentLoading}
          channel={alignmentChannel}
          search={alignmentSearch}
          status={alignmentStatus}
          onChannel={(value) => {
            setAlignmentChannel(value);
            setAlignmentPage(1);
            void loadAlignment({
              channel: value,
              page: 1,
              search: alignmentSearch,
              matchStatus: alignmentStatus,
            });
          }}
          onSearch={setAlignmentSearch}
          onStatus={setAlignmentStatus}
          onApply={() =>
            loadAlignment({
              channel: alignmentChannel,
              page: 1,
              search: alignmentSearch,
              matchStatus: alignmentStatus,
            })
          }
          onPage={(value) =>
            loadAlignment({
              channel: alignmentChannel,
              page: value,
              search: alignmentSearch,
              matchStatus: alignmentStatus,
            })
          }
        />
      )}
      {activeTab === "Auditoría Sodimac" && (
        <Suspense
          fallback={<div className="catalog-loading">Abriendo auditoría…</div>}
        >
          <SodimacAuditWorkspace
            actorScope={actorScope}
            parentStale={stale}
            onCatalogChanged={() => load(page, appliedFilters)}
          />
        </Suspense>
      )}
      {activeTab === "Piloto y fuentes" && (
        <PilotPanel
          pilot={pilot}
          statuses={workspace?.integration_statuses || []}
        />
      )}
      {activeTab === "Enriquecimiento logístico" && (
        <>
          <ShopifyLogisticsContractPanel />
          <LogisticsEstimatePanel phase7={phase7} />
          <PhysicalEnrichmentPanel
            data={physical}
            measurement={measurement}
            measurementDraft={measurementDraft}
            setMeasurementDraft={setMeasurementDraft}
            registerMeasurement={registerMeasurement}
            measurementAction={measurementAction}
            uploadMeasurement={uploadMeasurement}
            filters={physicalFilters}
            setFilters={setPhysicalFilters}
            reload={() => load(page, appliedFilters)}
            decide={decidePhysical}
            stale={stale}
          />
        </>
      )}
      {activeTab === "Configurador de precios" && workspace && (
        <Suspense
          fallback={
            <div className="catalog-loading">Abriendo configurador…</div>
          }
        >
          <Phase6Configurator actorScope={actorScope} stale={stale} />
        </Suspense>
      )}
      {activeTab === "Simulador multibodega" && workspace && (
        <Suspense
          fallback={<div className="catalog-loading">Abriendo simulador…</div>}
        >
          <MultwarehouseSimulator actorScope={actorScope} stale={stale} />
        </Suspense>
      )}
      {activeTab === "Reglas anteriores" && workspace && (
        <PricingAssistant
          workspace={workspace}
          form={simForm}
          setForm={setSimForm}
          onDiscardDraft={() => {
            setSimForm(DEFAULT_SIM_FORM);
            setSimulation(null);
            setSimulationError("");
            setNotice("Borrador local descartado.");
          }}
          onSubmit={simulate}
          onUpdateHypothesis={updateHypothesis}
          result={simulation}
          error={simulationError}
          stale={stale}
        />
      )}
      {activeTab === "Shopify local" && (
        <ShopifyPlan plan={importPlan} importState={workspace?.import_state} />
      )}
      {activeTab === "Historial" && (
        <HistoryPanel events={workspace?.history || []} />
      )}
      {activeTab === "Reglas del catálogo" && (
        <CatalogRulesPanel rules={catalogBusinessRules} />
      )}
      {activeTab === "Conexiones" && (
        <ConnectionsPanel
          statuses={workspace?.integration_statuses || []}
          channels={workspace?.channels || []}
          events={workspace?.history || []}
          connections={
            connectionsWorkspace?.connections ||
            workspace?.connections?.connections ||
            []
          }
          scheduler={
            connectionsWorkspace?.scheduler || workspace?.connections?.scheduler
          }
        />
      )}
      {detail && (
        <Suspense fallback={null}>
          <ProductDrawer
            product={detail}
            history={workspace?.history || []}
            onClose={() => setDetail(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function CatalogRulesPanel({ rules }) {
  const groups = [...new Set(rules.map((rule) => rule.group))];
  return (
    <section className="catalog-simple-panel catalog-rules-panel">
      <header className="catalog-simple-header">
        <div>
          <span className="eyebrow">Cómo calcula hoy el catálogo</span>
          <h2>Reglas del catálogo</h2>
          <p>
            Esta hoja separa las reglas aplicadas de las estimaciones y de los
            valores que todavía necesitan validación.
          </p>
        </div>
        <StatusBadge value="SIMULACIÓN LOCAL" tone="success" />
      </header>
      <div className="catalog-rules-summary">
        <article>
          <strong>20%</strong>
          <span>margen neto objetivo</span>
        </article>
        <article>
          <strong>4%</strong>
          <span>reserva logística</span>
        </article>
        <article>
          <strong>$40.000</strong>
          <span>tope de reserva por unidad</span>
        </article>
        <article>
          <strong>0</strong>
          <span>escrituras externas</span>
        </article>
      </div>
      {groups.map((group) => (
        <section className="catalog-rule-group" key={group}>
          <h3>{group}</h3>
          <div className="catalog-rule-grid">
            {rules.filter((rule) => rule.group === group).map((rule) => (
              <article key={rule.name} data-status={rule.status}>
                <div className="catalog-rule-title">
                  <strong>{rule.name}</strong>
                  <StatusBadge
                    value={rule.status.replaceAll("_", " ")}
                    tone={
                      rule.status === "APLICADA"
                        ? "success"
                        : rule.status === "ESTIMADA" || rule.status === "POR VALIDAR"
                          ? "warning"
                          : "neutral"
                    }
                  />
                </div>
                <b>{rule.value}</b>
                <p>{rule.explanation}</p>
                <small>Fuente: {rule.source}</small>
              </article>
            ))}
          </div>
        </section>
      ))}
      <div className="catalog-rule-note">
        <strong>Lectura práctica</strong>
        <span>
          El precio sugerido ya incluye los gastos conocidos y busca dejar el
          20% neto. El envío promedio orienta el análisis, pero no reemplaza la
          cotización final por ciudad y paquete.
        </span>
      </div>
    </section>
  );
}

function connectionSummary(connector, statuses, channels) {
  const rows = statuses.filter(
    (item) => String(item.system || "").toUpperCase() === connector.code,
  );
  const channel = channels.find(
    (item) => String(item.code || "").toUpperCase() === connector.code,
  );
  const hasAvailable = rows.some((item) => item.status === "AVAILABLE");
  const hasIncomplete = rows.some((item) =>
    ["PARTIAL", "BLOCKED", "MISSING"].includes(item.status),
  );
  let status = "PENDIENTE";
  if (hasAvailable && hasIncomplete) status = "PARCIAL";
  else if (hasAvailable || channel?.connected) status = "DISPONIBLE";
  else if (rows.some((item) => item.status === "BLOCKED")) status = "BLOQUEADA";

  const dates = rows
    .flatMap((item) => [item.last_success_at, item.observed_at])
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));
  const latest = dates.length
    ? new Date(Math.max(...dates.map((value) => value.getTime())))
    : null;
  const recordCount = rows.reduce(
    (maximum, item) => Math.max(maximum, Number(item.record_count) || 0),
    0,
  );
  return {
    ...connector,
    rows,
    status,
    recordCount,
    latest,
  };
}

function localDateTime(value, fallback = "Sin registro") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleString("es-CO");
}

function ConnectionsPanel({ statuses, channels, events, connections, scheduler }) {
  const connectionRows = connections.length
    ? connections
    : connectorCatalog.map((connector) =>
        connectionSummary(connector, statuses, channels),
      );
  return (
    <section className="catalog-simple-panel catalog-connections-panel">
      <header className="catalog-simple-header">
        <div>
          <span className="eyebrow">Estado sencillo de integraciones</span>
          <h2>Conexiones</h2>
          <p>
            Qué fuente está disponible, cuándo se leyó por última vez y si hoy
            funciona como lectura, carga local o conexión pendiente.
          </p>
        </div>
        <div className="connection-header-status">
          <StatusBadge value="externalWrites=0" tone="success" />
          <small>
            Actualización de esta hoja: cada minuto
          </small>
        </div>
      </header>
      <div className="connection-scheduler-status">
        <div>
          <span className="eyebrow">Planificador de lecturas</span>
          <strong>{scheduler?.status_label || "No iniciado"}</strong>
          <small>{scheduler?.message || "Sin ciclo registrado."}</small>
        </div>
        <dl>
          <div>
            <dt>Último pulso</dt>
            <dd>{localDateTime(scheduler?.last_heartbeat_at)}</dd>
          </div>
          <div>
            <dt>Último ciclo correcto</dt>
            <dd>{localDateTime(scheduler?.last_success_at)}</dd>
          </div>
          <div>
            <dt>Frecuencia</dt>
            <dd>{scheduler?.cadence_label || "Cada 6 horas"}</dd>
          </div>
        </dl>
      </div>
      <div className="catalog-connection-grid">
        {connectionRows.map((connection) => (
          <article key={connection.code} data-status={connection.status}>
            <header>
              <div>
                <strong>{connection.label}</strong>
                <span>{connection.purpose}</span>
              </div>
              <StatusBadge
                value={connection.status_label || connection.status}
                tone={
                  ["CONNECTED", "DISPONIBLE", "FILE_AVAILABLE"].includes(connection.status)
                    ? "success"
                    : ["PARTIAL", "PARCIAL", "STALE"].includes(connection.status)
                      ? "warning"
                      : "neutral"
                }
              />
            </header>
            <dl>
              <div>
                <dt>Última lectura</dt>
                <dd>{localDateTime(connection.last_attempt_at || connection.latest, "Sin lectura registrada")}</dd>
              </div>
              <div>
                <dt>Última sincronización correcta</dt>
                <dd>{localDateTime(connection.last_success_at, "Sin sincronización confirmada")}</dd>
              </div>
              <div>
                <dt>Último archivo</dt>
                <dd>{localDateTime(connection.last_file_upload_at, "No aplica o no registrado")}</dd>
              </div>
              <div>
                <dt>Registros</dt>
                <dd>{connection.record_count || connection.recordCount || "—"}</dd>
              </div>
              <div>
                <dt>Modo actual</dt>
                <dd>{connection.mode}</dd>
              </div>
              <div>
                <dt>Método</dt>
                <dd>{connection.strategy || "Lectura local"}</dd>
              </div>
              {connection.webhook_state && (
                <div>
                  <dt>Webhook</dt>
                  <dd>
                    {connection.webhook_state === "NO_INSTALADO_EN_ESTE_MODULO"
                      ? "No instalado en este módulo"
                      : connection.webhook_state}
                  </dd>
                </div>
              )}
              <div>
                <dt>Próxima revisión</dt>
                <dd>{localDateTime(connection.next_scheduled_at, "Sin tarea programada")}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="connection-legend">
        <span><b>Conectada:</b> existe una lectura vigente y verificable.</span>
        <span><b>Parcial:</b> algunos datos existen y otros siguen pendientes.</span>
        <span><b>Desactualizada:</b> hubo una lectura correcta, pero ya superó dos ciclos.</span>
        <span><b>Desconectada:</b> todavía no existe una lectura verificable en este catálogo.</span>
      </div>
      <details className="connection-technical-details">
        <summary>Ver detalle técnico e historial</summary>
        <PilotConnectionDetail statuses={statuses} />
        <HistoryPanel events={events} />
      </details>
    </section>
  );
}

function PilotConnectionDetail({ statuses }) {
  if (!statuses.length) {
    return <div className="empty-state">No hay lecturas técnicas registradas.</div>;
  }
  return (
    <div className="source-status-table connection-source-table">
      <table>
        <thead>
          <tr>
            <th>Sistema</th>
            <th>Dato</th>
            <th>Estado</th>
            <th>Registros</th>
            <th>Explicación</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((item) => (
            <tr key={`${item.system}-${item.capability}`}>
              <td><strong>{item.system}</strong></td>
              <td>{String(item.capability || "").replaceAll("_", " ")}</td>
              <td>{item.status_label || item.status}</td>
              <td>{item.record_count ?? "—"}</td>
              <td>{item.message || "Sin detalle"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChannelAlignmentPanel({
  data,
  loading,
  channel,
  search,
  status,
  onChannel,
  onSearch,
  onStatus,
  onApply,
  onPage,
}) {
  const metrics = data?.summary || {};
  const current = metrics[channel] || {};
  const records = data?.records || [];
  const pages = data?.pagination?.pages || 1;
  const page = data?.pagination?.page || 1;
  const channels = [
    ["SHOPIFY", "Shopify"],
    ["SIIGO", "Siigo"],
    ["MERCADO_LIBRE", "Mercado Libre"],
    ["FALABELLA", "Falabella"],
    ["MADECENTRO", "Madecentro"],
  ];
  const madecentroPilot = channel === "MADECENTRO";
  const channelContext = data?.channel_context || {};
  return (
    <section className="channel-alignment-panel">
      <header>
        <div>
          <span className="eyebrow">
            Conciliación local por identificadores
          </span>
          <h2>
            Shopify como maestro, canales alineados sin forzar coincidencias
          </h2>
          <p>
            Solo el SKU exacto y único se vincula automáticamente. Códigos
            alternos, duplicados y ausencias permanecen en revisión.
          </p>
        </div>
        <StatusBadge value="externalWrites=0" tone="success" />
      </header>
      {madecentroPilot && (
        <div className="madecentro-pilot-notice">
          <div>
            <strong>Piloto comercial local, no catálogo vivo</strong>
            <span>{channelContext.label}</span>
            <small>
              {channelContext.margin_warning ||
                "El margen debe validarse contra costo Siigo y logística real."}
            </small>
          </div>
          <StatusBadge value="MARGEN POR VALIDAR" tone="warning" />
        </div>
      )}
      <div className="alignment-channel-cards">
        {channels.map(([code, label]) => (
          <button
            key={code}
            type="button"
            className={channel === code ? "active" : ""}
            onClick={() => onChannel(code)}
          >
            <span>{label}</span>
            <strong>{metrics[code]?.total || 0}</strong>
            <small>
              {metrics[code]?.exact || 0} exactos ·{" "}
              {metrics[code]?.missing_shopify || 0} sin Shopify
            </small>
          </button>
        ))}
      </div>
      <div className="alignment-controls">
        <label>
          Canal
          <select
            value={channel}
            onChange={(event) => onChannel(event.target.value)}
          >
            {channels.map(([code, label]) => (
              <option value={code} key={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="SKU, título o ID externo"
          />
        </label>
        <label>
          Estado
          <select
            value={status}
            onChange={(event) => onStatus(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="EXACT_SKU">SKU exacto</option>
            <option value="MISSING_SHOPIFY">Falta en Shopify</option>
            <option value="MISSING_SKU">Sin SKU</option>
            <option value="AMBIGUOUS_SKU">Ambiguo</option>
            <option value="DUPLICATE_SKU">Duplicado</option>
            <option value="IDENTIFIER_REVIEW">Otro identificador</option>
          </select>
        </label>
        <button type="button" onClick={onApply} disabled={loading}>
          Aplicar
        </button>
      </div>
      <div className="alignment-summary">
        <span>
          <strong>{current.total || 0}</strong> registros
        </span>
        <span>
          <strong>{current.exact || 0}</strong> exactos
        </span>
        <span>
          <strong>{current.missing_shopify || 0}</strong> faltan en Shopify
        </span>
        <span>
          <strong>{current.missing_sku || 0}</strong> sin SKU
        </span>
        <span>
          <strong>{current.ambiguous || 0}</strong> ambiguos
        </span>
        <span>
          <strong>{current.duplicates || 0}</strong> duplicados
        </span>
      </div>
      <div className="alignment-table">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU canal</th>
              <th>Estado vínculo</th>
              <th>Shopify</th>
              <th>{madecentroPilot ? "Precio piloto" : "Precio"}</th>
              <th>{madecentroPilot ? "Logística propuesta" : "Inventario"}</th>
              <th>Estado canal</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row) => (
              <tr
                key={`${row.channel}-${row.external_product_id}-${row.external_variant_id}`}
              >
                <td>
                  <div className="alignment-product">
                    {row.image_url ? (
                      <img
                        src={row.image_url}
                        alt={row.title || row.sku}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span>Sin imagen</span>
                    )}
                    <div>
                      <strong>{row.title || "Sin título"}</strong>
                      <small>{row.external_product_id}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{row.sku || "Sin SKU"}</strong>
                  <small>{row.barcode || ""}</small>
                </td>
                <td>
                  <StatusBadge
                    value={row.match_status}
                    tone={
                      row.match_status === "EXACT_SKU" ||
                      row.match_status === "EXACT_SHOPIFY" ||
                      row.match_status === "MASTER"
                        ? "success"
                        : "warning"
                    }
                  />
                  <small>{row.match_reason}</small>
                </td>
                <td>
                  {row.matched_shopify_product || "—"}
                  <small>{row.matched_shopify_sku || ""}</small>
                </td>
                <td>
                  {money(row.price)}
                  {madecentroPilot && (
                    <>
                      <small>
                        Público Shopify:{" "}
                        {money(row.payload?.public_suggested_price)}
                      </small>
                      <small>
                        Anterior referencia:{" "}
                        {money(row.payload?.previous_reference_price)}
                      </small>
                    </>
                  )}
                </td>
                <td>
                  {madecentroPilot ? (
                    <>
                      <strong>
                        Bog/Cun{" "}
                        {money(row.payload?.shipping?.bogota_cundinamarca)}
                      </strong>
                      <small>
                        Resto {money(row.payload?.shipping?.rest_of_colombia)} ·
                        Otros {money(row.payload?.shipping?.other_destinations)}
                      </small>
                      <small>Sin inventario en este archivo</small>
                    </>
                  ) : (
                    (row.inventory_available ?? "—")
                  )}
                </td>
                <td>
                  {row.state || "—"}
                  {madecentroPilot && (
                    <small>{row.payload?.workbook_status}</small>
                  )}
                </td>
              </tr>
            ))}
            {!records.length && (
              <tr>
                <td colSpan="7" className="empty-state">
                  {loading
                    ? "Cargando conciliación…"
                    : "No hay registros con estos filtros; no significa que se hayan borrado datos."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ← Anterior
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button
          type="button"
          disabled={loading || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Siguiente →
        </button>
      </div>
    </section>
  );
}

function ShopifyLogisticsContractPanel() {
  const fields = [
    [
      "Peso empacado canónico",
      "inventoryItem.measurement.weight",
      "Nativo por variante",
    ],
    ["Largo del paquete", "logistica.largo_paquete", "Metacampo dimension"],
    ["Ancho del paquete", "logistica.ancho_paquete", "Metacampo dimension"],
    ["Alto del paquete", "logistica.alto_paquete", "Metacampo dimension"],
    ["Fragilidad", "logistica.fragil", "Metacampo boolean"],
    ["Revisión logística", "logistica.fecha_revision", "Metacampo date"],
  ];
  return (
    <section className="shopify-logistics-contract">
      <header>
        <div>
          <span className="eyebrow">Fuente logística canónica</span>
          <h2>Las medidas viven en Shopify</h2>
          <p>
            La aplicación solo conserva un snapshot rápido para consulta. Toda
            captura nueva termina en una vista previa de actualización Shopify;
            nunca reemplaza a Shopify como maestro.
          </p>
        </div>
        <StatusBadge value="CONTRATO VERIFICADO" tone="success" />
      </header>
      <div>
        {fields.map(([label, key, type]) => (
          <article key={key}>
            <strong>{label}</strong>
            <code>{key}</code>
            <small>{type}</small>
          </article>
        ))}
      </div>
      <p className="muted">
        <b>Compatibilidad:</b> <code>logistica.peso_empacado</code> se lee como
        campo heredado y se compara con el peso nativo; una diferencia queda
        bloqueada para revisión, no se resuelve en silencio.
      </p>
    </section>
  );
}

function ChannelReadinessMatrix({
  channels,
  liveChannels = [],
  open = false,
  onToggle,
}) {
  const baseChannels = channels.length
    ? channels
    : liveChannels
        .filter((channel) => channel.code !== "SIIGO")
        .map((channel) => ({
          ...channel,
          implementation: channel.connected ? "IMPLEMENTED_LOCAL" : "PREPARED",
          connection: channel.connected ? "LOCAL_SNAPSHOT" : "NOT_CONNECTED",
          capabilities: {
            existence: channel.connected ? "LOCAL" : "PREPARED",
            quality_completeness: channel.connected ? "LOCAL" : "PREPARED",
            price: channel.connected ? "LOCAL_IF_SNAPSHOT" : "PREPARED",
            inventory: channel.connected ? "LOCAL_IF_SNAPSHOT" : "PREPARED",
            cost_shipping: channel.connected ? "LOCAL_IF_SOURCE" : "PREPARED",
          },
        }));
  if (!baseChannels.length) return null;
  const currentChannels = baseChannels.map((channel) => {
    const connected = liveChannels.find(
      (item) => item.code === channel.code,
    )?.connected;
    if (!connected) return channel;
    return {
      ...channel,
      implementation: "IMPLEMENTED_LOCAL",
      connection: "LOCAL_SNAPSHOT",
      capabilities: {
        ...channel.capabilities,
        existence: "LOCAL",
        quality_completeness: "LOCAL",
        price: "LOCAL_IF_SNAPSHOT",
        inventory: "LOCAL_IF_SNAPSHOT",
        cost_shipping: "LOCAL_IF_SOURCE",
      },
    };
  });
  return (
    <section
      className={`channel-readiness collapsible-panel ${open ? "is-open" : ""}`}
    >
      <button
        className="collapsible-trigger"
        type="button"
        aria-expanded={open}
        onClick={onToggle}
      >
        <div>
          <span className="eyebrow">Arquitectura multicanal</span>
          <strong className="collapsible-title">
            Un modelo consistente, conexiones explícitas
          </strong>
        </div>
        <span className="collapsible-action">
          <StatusBadge value="externalWrites=0" tone="success" />
          <b aria-hidden="true">{open ? "−" : "+"}</b>
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>
      {open && (
        <div className="channel-readiness-grid collapsible-content">
          {currentChannels.map((channel) => (
            <article key={channel.code}>
              <div>
                <strong>{channel.label}</strong>
                <StatusBadge
                  value={
                    channel.implementation === "IMPLEMENTED_LOCAL"
                      ? "Implementado local"
                      : "Preparado"
                  }
                  tone={
                    channel.implementation === "IMPLEMENTED_LOCAL"
                      ? "success"
                      : "warning"
                  }
                />
              </div>
              <p>
                {channel.connection === "LOCAL_SNAPSHOT"
                  ? "Snapshot local disponible; no consulta en vivo."
                  : "Sin adaptador conectado; acciones futuras bloqueadas."}
              </p>
              <dl>
                <div>
                  <dt>Existencia</dt>
                  <dd>{channel.capabilities.existence}</dd>
                </div>
                <div>
                  <dt>Calidad</dt>
                  <dd>{channel.capabilities.quality_completeness}</dd>
                </div>
                <div>
                  <dt>Precio / inventario</dt>
                  <dd>
                    {channel.capabilities.price} /{" "}
                    {channel.capabilities.inventory}
                  </dd>
                </div>
                <div>
                  <dt>Costo / envío</dt>
                  <dd>{channel.capabilities.cost_shipping}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LogisticsEstimatePanel({ phase7 }) {
  const logistics = phase7?.logistics;
  if (!logistics)
    return (
      <div className="catalog-loading">
        Preparando perfiles logísticos locales…
      </div>
    );
  return (
    <section className="logistics-estimates">
      <header>
        <div>
          <span className="eyebrow">
            Perfiles provisionales · solo decisión local
          </span>
          <h2>Históricos segmentados, nunca promedio global</h2>
          <p>
            {logistics.aggregation}. Se reconstruyen cuando entran nuevas guías
            sanitizadas.
          </p>
        </div>
        <StatusBadge value="ESTIMATED · NO COTIZABLE" tone="warning" />
      </header>
      <div className="estimate-summary">
        <span>
          <strong>{logistics.realized_guides}</strong> guías reales locales
        </span>
        <span>
          <strong>{logistics.profiles.length}</strong> segmentos físicos
        </span>
        <span>
          <strong>{logistics.assignable_profiles}</strong> asignables hoy
        </span>
        <span>
          <strong>{phase7.measurement_priority_total}</strong> productos por
          medir
        </span>
      </div>
      <div className="estimate-warning">
        <strong>Falla cerrada</strong>
        <span>
          Los históricos no traen SKU/familia ni bodega de origen. Las medianas
          y P75 se muestran como evidencia exploratoria, pero no pueden elegirse
          como tarifa ni promesa comercial.
        </span>
      </div>
      <div className="estimate-profile-table">
        <table>
          <thead>
            <tr>
              <th>Zona</th>
              <th>Banda física</th>
              <th>Servicio</th>
              <th>Muestra</th>
              <th>Mediana</th>
              <th>P75 conservador</th>
              <th>Asignación</th>
            </tr>
          </thead>
          <tbody>
            {logistics.profiles.slice(0, 30).map((row, index) => (
              <tr
                key={`${row.destination_zone}-${row.size}-${row.carrier_service}-${index}`}
              >
                <td>{row.destination_zone}</td>
                <td>{row.size}</td>
                <td>{row.carrier_service}</td>
                <td>{row.sample_size}</td>
                <td>{money(row.median_cop)}</td>
                <td>{money(row.conservative_p75_cop)}</td>
                <td>
                  <StatusBadge value="Bloqueada" tone="warning" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="priority-preview">
        <div>
          <h3>Medición priorizada</h3>
          <p>
            Puntaje por presencia Shopify, actividad, valor, costo conocido,
            faltantes físicos y origen desconocido; no representa ventas.
          </p>
        </div>
        {(phase7.measurement_priority || []).slice(0, 8).map((row) => (
          <span key={row.sku}>
            <b>{row.priority_score}</b>
            <strong>{row.sku || "Sin SKU"}</strong>
            <small>{row.product}</small>
          </span>
        ))}
      </article>
    </section>
  );
}

function PilotPanel({ pilot, statuses }) {
  const metrics = pilot?.metrics || {};
  const coverage = metrics.cost_coverage || {};
  const missing = metrics.missing_physical_data || {};
  const inventory = metrics.inventory || {};
  const shipping = metrics.shipping || {};
  const readiness = metrics.readiness || {};
  const evidence = metrics.evidence_classification || {};
  const hypothesis = metrics.policy_hypothesis;
  return (
    <section className="executive-panel pilot-panel">
      <div className="estimate-banner">
        <strong>SOLO LECTURA · DATOS LOCALES</strong>
        <span>
          Los bloqueos son parte del resultado: ningún dato ausente se convierte
          en cero ni en una promesa comercial.
        </span>
      </div>
      <div className="executive-card-grid">
        <MetricCard
          label="Catálogo Barú"
          value={metrics.catalog_rows || 0}
          detail="SKU únicos · IVA incluido"
        />
        <MetricCard
          label="Cobertura de costo"
          value={`${coverage.percent || 0}%`}
          detail={`${coverage.known || 0} conocidos · ${coverage.unknown || 0} desconocidos`}
          tone="highlight"
        />
        <MetricCard
          label="Sin peso"
          value={missing.weight || 0}
          detail="Bloquea cotización confiable"
          tone="warning"
        />
        <MetricCard
          label="Sin dimensiones"
          value={missing.dimensions || 0}
          detail="No se inventan medidas"
          tone="warning"
        />
        <MetricCard
          label="Inventario pendiente"
          value={inventory.unknown || 0}
          detail="No equivale a cero"
          tone="warning"
        />
        <MetricCard
          label="Listo para piloto"
          value={`${readiness.commercial_ready_percent || 0}%`}
          detail={`${readiness.commercial_ready_count || 0} SKU · ${readiness.pilot_decision || "BLOCKED"}`}
          tone={readiness.pilot_decision === "GO" ? "highlight" : "warning"}
        />
        <MetricCard
          label="Guías Envía reales"
          value={shipping.historical_realized_guides || 0}
          detail={`Mediana histórica ${money(shipping.historical_realized_median)}`}
        />
        <MetricCard
          label="Con regla aplicable"
          value={metrics.pricing?.simulated || 0}
          detail="Políticas comerciales configuradas"
        />
        <MetricCard
          label="Escrituras externas"
          value={pilot?.external_writes ?? 0}
          detail="Shopify · Siigo · Envía"
          tone="highlight"
        />
      </div>
      <article className="source-status-table">
        <h2>Estado verificable por sistema y capacidad</h2>
        <table>
          <thead>
            <tr>
              <th>Sistema</th>
              <th>Dato</th>
              <th>Estado</th>
              <th>Registros</th>
              <th>Explicación</th>
              <th>Evidencia</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((item) => (
              <tr key={`${item.system}-${item.capability}`}>
                <td>
                  <strong>{item.system}</strong>
                </td>
                <td>{item.capability.replaceAll("_", " ")}</td>
                <td>
                  <StatusBadge
                    value={item.status_label || item.status}
                    tone={
                      item.status === "AVAILABLE"
                        ? "success"
                        : item.status === "PARTIAL"
                          ? "warning"
                          : "neutral"
                    }
                  />
                </td>
                <td>{item.record_count ?? "—"}</td>
                <td>{item.message}</td>
                <td>{item.evidence_reference || "Pendiente"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <article className="readiness-panel">
        <div>
          <span className="eyebrow">Criterio de salida</span>
          <h2>
            {readiness.pilot_decision === "GO"
              ? "Piloto habilitable"
              : "Piloto comercial bloqueado"}
          </h2>
          <p>{readiness.definition}</p>
        </div>
        <div className="evidence-grid">
          <span>
            <strong>{evidence.confirmed?.cost || 0}</strong> costos confirmados
          </span>
          <span>
            <strong>{evidence.confirmed?.weight || 0}</strong> pesos confirmados
          </span>
          <span>
            <strong>{evidence.confirmed?.dimensions || 0}</strong> dimensiones
            confirmadas
          </span>
          <span>
            <strong>{evidence.confirmed?.inventory || 0}</strong> inventarios
            confirmados
          </span>
        </div>
      </article>
      <article className="shipping-modes">
        <h2>Elegibilidad de cobro de envío</h2>
        <p>
          Tarifa real, $3.000, $2.000 y $0 requieren datos físicos, inventario,
          cotización actual y margen mínimo. El histórico de guía no reemplaza
          una cotización por destino y paquete.
        </p>
        <div>
          {Object.entries(shipping.eligible || {}).map(([mode, count]) => (
            <span key={mode}>
              <strong>
                {mode === "REAL_RATE" ? "Tarifa real" : money(mode)}
              </strong>
              {count} elegibles
            </span>
          ))}
        </div>
      </article>
      {hypothesis && (
        <article className="sensitivity-panel">
          <header>
            <div>
              <span className="eyebrow">Hipótesis editable · no activada</span>
              <h2>Sensibilidad y punto de equilibrio</h2>
            </div>
            <StatusBadge value="NO APROBADA" tone="warning" />
          </header>
          <p>{hypothesis.warning}</p>
          <div className="hypothesis-readout">
            <span>
              Objetivo{" "}
              <strong>{percent(hypothesis.target_margin_percent)}</strong>
            </span>
            <span>
              Mínimo{" "}
              <strong>{percent(hypothesis.minimum_margin_percent)}</strong>
            </span>
            <span>
              Comisión <strong>{percent(hypothesis.commission_percent)}</strong>
            </span>
            <span>
              Reserva máxima <strong>{money(hypothesis.reserve_cap)}</strong>
            </span>
            <span>
              Reserva aplicada <strong>$0 · es tope</strong>
            </span>
          </div>
          <div className="sensitivity-table">
            <table>
              <thead>
                <tr>
                  <th>Margen</th>
                  <th>Cobro cliente</th>
                  <th>Subsidio</th>
                  <th>Punto equilibrio</th>
                  <th>Precio requerido</th>
                  <th>Topes</th>
                </tr>
              </thead>
              <tbody>
                {(hypothesis.sensitivity || [])
                  .slice(0, 20)
                  .map((row, index) => (
                    <tr
                      key={`${row.target_margin_percent}-${row.customer_shipping_charge}-${index}`}
                    >
                      <td>{percent(row.target_margin_percent)}</td>
                      <td>{money(row.customer_shipping_charge)}</td>
                      <td>{money(row.shipping_subsidy)}</td>
                      <td>{money(row.break_even_price)}</td>
                      <td>{money(row.required_price)}</td>
                      <td>
                        <StatusBadge
                          value={row.eligible_by_caps ? "Soportado" : "Excede"}
                          tone={row.eligible_by_caps ? "success" : "warning"}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
      <article className="missing-action-panel">
        <h2>Faltantes accionables</h2>
        <p>
          Completa la plantilla por proveedor; los vacíos siguen siendo
          desconocidos, nunca cero.
        </p>
        <div>
          {(metrics.missing_action_rows || []).slice(0, 12).map((row) => (
            <span key={row.sku}>
              <strong>{row.sku}</strong>
              <small>{row.blockers.join(" · ")}</small>
            </span>
          ))}
        </div>
      </article>
      {(pilot?.warnings || []).map((warning) => (
        <div className="warning-box" key={warning}>
          {warning}
        </div>
      ))}
    </section>
  );
}

function PhysicalEnrichmentPanel({
  data,
  measurement,
  measurementDraft,
  setMeasurementDraft,
  registerMeasurement,
  measurementAction,
  uploadMeasurement,
  filters,
  setFilters,
  reload,
  decide,
  stale,
}) {
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  const progress = measurement?.progress || [];
  const imports = measurement?.imports || [];
  const updateMeasurement = (key, value) =>
    setMeasurementDraft((current) => ({ ...current, [key]: value }));
  const beginMeasurement = (row) => {
    setMeasurementDraft({
      ...DEFAULT_MEASUREMENT_DRAFT,
      variant_id: row.variant_id,
      sku: row.sku,
      gtin: row.gtin || "",
      description: row.title,
      verified_date: new Date().toISOString().slice(0, 10),
    });
    measurementAction({
      action: "CREATE_TASK",
      variant_id: row.variant_id,
      task_action: "REGISTER_MEASUREMENT",
      note: "Borrador de medición física iniciado",
    });
  };
  return (
    <section className="physical-panel">
      <div className="estimate-banner">
        <strong>EMPAQUE ≠ PRODUCTO</strong>
        <span>
          Las medidas de producto o similares ayudan a revisar, pero nunca
          habilitan cotización, cobro ni actualización Shopify.
        </span>
      </div>
      <div className="executive-card-grid physical-metrics">
        <MetricCard
          label="Evidencias"
          value={summary.candidates || 0}
          detail="Por campo, fuente y SKU"
        />
        <MetricCard
          label="Empaque confirmado"
          value={summary.confirmed_package || 0}
          detail="Aún requiere aprobación del conjunto"
          tone="highlight"
        />
        <MetricCard
          label="Derivadas"
          value={summary.derived || 0}
          detail="Descripción o coincidencia exacta"
        />
        <MetricCard
          label="Estimadas"
          value={summary.estimated || 0}
          detail="Solo tarea de validación"
          tone="warning"
        />
        <MetricCard
          label="Conflictos"
          value={summary.conflicts || 0}
          detail="Bloqueados hasta resolver"
          tone="warning"
        />
        <MetricCard
          label="Pendientes"
          value={summary.pending_review || 0}
          detail="Cola de revisión local"
        />
        <MetricCard
          label="Peso Shopify = 0"
          value={summary.shopify_zero_weight_exact || 0}
          detail="Se trata como desconocido, nunca como peso real"
          tone="warning"
        />
        <MetricCard
          label="Vista previa Shopify"
          value={summary.shopify_previews_ready || 0}
          detail="Preparada, nunca ejecutada"
        />
        <MetricCard
          label="Escrituras externas"
          value={data?.external_writes ?? 0}
          detail="Shopify · Envía · comercios"
          tone="highlight"
        />
      </div>
      <div className="physical-controls">
        <FilterSelect
          label="Tipo medido"
          value={filters.scope}
          onChange={(value) =>
            setFilters((current) => ({ ...current, scope: value }))
          }
          options={[
            { value: "PACKAGE", label: "Empaque transporte" },
            { value: "PRODUCT", label: "Producto" },
          ]}
        />
        <FilterSelect
          label="Clasificación"
          value={filters.classification}
          onChange={(value) =>
            setFilters((current) => ({ ...current, classification: value }))
          }
          options={["CONFIRMED", "DERIVED", "ESTIMATED", "CONFLICT"]}
        />
        <button type="button" onClick={reload}>
          Aplicar / reintentar
        </button>
      </div>
      <article className="measurement-capture-panel">
        <header>
          <div>
            <span className="eyebrow">Camino confiable principal</span>
            <h2>Captura de empaque · 25 SKU</h2>
            <p>
              Proveedor exacto o medición física. Primero vista previa, después
              revisión humana; nunca escritura externa.
            </p>
          </div>
          <div className="measurement-toolbar">
            <a
              href={
                measurement?.template_url ||
                "/api/catalogo/physical/measurement-template/"
              }
            >
              Descargar Excel
            </a>
            <label className={stale ? "disabled" : ""}>
              Importar archivo
              <input
                type="file"
                accept=".xlsx,.csv"
                disabled={stale}
                onChange={(event) => uploadMeasurement(event.target.files?.[0])}
              />
            </label>
          </div>
        </header>
        <div className="measurement-progress-table">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Progreso</th>
                <th>Faltantes</th>
                <th>Tareas</th>
                <th>Acciones locales</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((row) => (
                <tr key={row.variant_id}>
                  <td>
                    <strong>{row.sku}</strong>
                    <small>{row.title}</small>
                  </td>
                  <td>
                    <b>{row.progress_percent}%</b>
                    <span>
                      <i style={{ width: `${row.progress_percent}%` }} />
                    </span>
                  </td>
                  <td>
                    <small>
                      {row.missing_fields.join(" · ") || "Conjunto aprobado"}
                    </small>
                  </td>
                  <td>
                    <small>
                      {row.tasks.length
                        ? row.tasks
                            .map((task) => `${task.action}: ${task.status}`)
                            .join(" · ")
                        : "Sin tarea"}
                    </small>
                  </td>
                  <td>
                    <div className="physical-actions">
                      <button
                        type="button"
                        disabled={stale}
                        onClick={() =>
                          measurementAction({
                            action: "CREATE_TASK",
                            variant_id: row.variant_id,
                            task_action: "REQUEST_PROVIDER",
                            note: "Completar plantilla de empaque",
                          })
                        }
                      >
                        Solicitar al proveedor
                      </button>
                      <button
                        type="button"
                        disabled={stale}
                        onClick={() => beginMeasurement(row)}
                      >
                        Registrar medición
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="measurement-form" onSubmit={registerMeasurement}>
          <div>
            <span className="eyebrow">Borrador local con TTL</span>
            <h3>
              {measurementDraft.sku
                ? `Medición · ${measurementDraft.sku}`
                : "Seleccione Registrar medición"}
            </h3>
          </div>
          <label>
            <span>Peso empacado</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={measurementDraft.weight}
              onChange={(event) =>
                updateMeasurement("weight", event.target.value)
              }
            />
          </label>
          <label>
            <span>Unidad peso</span>
            <select
              value={measurementDraft.weight_unit}
              onChange={(event) =>
                updateMeasurement("weight_unit", event.target.value)
              }
            >
              <option>KG</option>
              <option>G</option>
              <option>LB</option>
              <option>OZ</option>
            </select>
          </label>
          {[
            ["length", "Largo"],
            ["width", "Ancho"],
            ["height", "Alto"],
          ].map(([key, label]) => (
            <label key={key}>
              <span>{label} paquete</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={measurementDraft[key]}
                onChange={(event) => updateMeasurement(key, event.target.value)}
              />
            </label>
          ))}
          <label>
            <span>Unidad dimensiones</span>
            <select
              value={measurementDraft.dimension_unit}
              onChange={(event) =>
                updateMeasurement("dimension_unit", event.target.value)
              }
            >
              <option>CM</option>
              <option>MM</option>
              <option>M</option>
              <option>IN</option>
            </select>
          </label>
          <label>
            <span>Cantidad bultos</span>
            <input
              type="number"
              min="1"
              max="20"
              value={measurementDraft.package_count}
              onChange={(event) =>
                updateMeasurement("package_count", event.target.value)
              }
            />
          </label>
          <label>
            <span>Fecha verificación</span>
            <input
              type="date"
              value={measurementDraft.verified_date}
              onChange={(event) =>
                updateMeasurement("verified_date", event.target.value)
              }
            />
          </label>
          <label>
            <span>Responsable</span>
            <input
              value={measurementDraft.responsible}
              onChange={(event) =>
                updateMeasurement("responsible", event.target.value)
              }
            />
          </label>
          <label>
            <span>Tipo de fuente</span>
            <select
              value={measurementDraft.source_kind}
              onChange={(event) =>
                updateMeasurement("source_kind", event.target.value)
              }
            >
              <option value="MEDICION_FISICA">Medición física</option>
              <option value="PROVEEDOR_EXACTO">Proveedor exacto</option>
              <option value="DEMO_NO_CONFIRMADO">Demo no confirmado</option>
            </select>
          </label>
          <label>
            <span>Fuente / referencia</span>
            <input
              value={measurementDraft.source_reference}
              onChange={(event) =>
                updateMeasurement("source_reference", event.target.value)
              }
              placeholder="Báscula, ficha Barú o acta"
            />
          </label>
          <label>
            <span>Evidencia / foto URL</span>
            <input
              value={measurementDraft.evidence_url}
              onChange={(event) =>
                updateMeasurement("evidence_url", event.target.value)
              }
              placeholder="Opcional"
            />
          </label>
          <label className="measurement-notes">
            <span>Observaciones</span>
            <input
              value={measurementDraft.notes}
              onChange={(event) =>
                updateMeasurement("notes", event.target.value)
              }
            />
          </label>
          <div className="measurement-form-actions">
            <button type="submit" disabled={stale || !measurementDraft.sku}>
              Crear vista previa local
            </button>
            <button
              type="button"
              onClick={() => setMeasurementDraft(DEFAULT_MEASUREMENT_DRAFT)}
            >
              Descartar borrador
            </button>
          </div>
        </form>
        <div className="measurement-imports">
          <h3>Importaciones y reversión local</h3>
          {imports.length ? (
            imports.map((batch) => (
              <article key={batch.id}>
                <div>
                  <strong>{batch.filename}</strong>
                  <StatusBadge
                    value={batch.status}
                    tone={
                      batch.status === "IMPORTED_LOCAL"
                        ? "success"
                        : batch.error_rows || batch.conflict_rows
                          ? "warning"
                          : "neutral"
                    }
                  />
                  <small>
                    {batch.valid_rows} válidas · {batch.error_rows} errores ·{" "}
                    {batch.conflict_rows} conflictos
                    {batch.is_demo ? " · DEMO BLOQUEADO" : ""}
                  </small>
                </div>
                <div className="physical-actions">
                  <button
                    type="button"
                    disabled={
                      stale ||
                      batch.is_demo ||
                      batch.status !== "PREVIEW" ||
                      batch.error_rows > 0 ||
                      batch.conflict_rows > 0
                    }
                    onClick={() =>
                      measurementAction({
                        action: "APPLY_IMPORT_LOCAL",
                        batch_id: batch.id,
                      })
                    }
                  >
                    Aplicar solo local
                  </button>
                  <button
                    type="button"
                    disabled={stale || batch.status !== "IMPORTED_LOCAL"}
                    onClick={() =>
                      measurementAction({
                        action: "REVERSE_IMPORT_LOCAL",
                        batch_id: batch.id,
                      })
                    }
                  >
                    Revertir local
                  </button>
                </div>
                {batch.rows.some(
                  (row) => row.errors.length || row.conflicts.length,
                ) && (
                  <details>
                    <summary>Errores por fila</summary>
                    {batch.rows
                      .filter(
                        (row) => row.errors.length || row.conflicts.length,
                      )
                      .map((row) => (
                        <small key={row.id}>
                          Fila {row.row_number} · {row.sku || "sin SKU"}:{" "}
                          {[...row.errors, ...row.conflicts].join(" · ")}
                        </small>
                      ))}
                  </details>
                )}
              </article>
            ))
          ) : (
            <p>Sin archivos revisados todavía.</p>
          )}
        </div>
      </article>
      <div className="catalog-table-card density-compact physical-table">
        <div className="catalog-table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU / producto</th>
                <th>Campo</th>
                <th>Tipo</th>
                <th>Candidato</th>
                <th>Clasificación</th>
                <th>Fuente / evidencia</th>
                <th>Confianza</th>
                <th>Conflicto</th>
                <th>Impacto</th>
                <th>Revisión local</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.sku}</strong>
                    <small>{row.product}</small>
                  </td>
                  <td>{row.field}</td>
                  <td>
                    <StatusBadge
                      value={row.scope}
                      tone={row.scope === "PACKAGE" ? "success" : "neutral"}
                    />
                  </td>
                  <td>
                    <strong>
                      {row.value} {row.unit}
                    </strong>
                  </td>
                  <td>
                    <StatusBadge
                      value={row.classification}
                      tone={
                        row.classification === "CONFIRMED"
                          ? "success"
                          : "warning"
                      }
                    />
                  </td>
                  <td>
                    <strong>{row.source_type}</strong>
                    <small>{row.source_reference}</small>
                    <small>
                      {row.identifier?.type
                        ? `${row.identifier.type}: ${row.identifier.value}`
                        : "Identificador pendiente"}
                    </small>
                    <small title={row.evidence_excerpt}>
                      {row.evidence_excerpt || "Sin fragmento"}
                    </small>
                    {row.source_url && (
                      <a href={row.source_url} target="_blank" rel="noreferrer">
                        Abrir fuente pública
                      </a>
                    )}
                  </td>
                  <td>{Math.round(Number(row.confidence || 0) * 100)}%</td>
                  <td>
                    {row.conflict ? (
                      <StatusBadge value="BLOQUEADO" tone="warning" />
                    ) : (
                      "No"
                    )}
                  </td>
                  <td>
                    <small>{row.shipping_impact}</small>
                  </td>
                  <td>
                    <div className="physical-actions">
                      <button
                        type="button"
                        disabled={
                          stale ||
                          row.latest_decision === "APPROVE_LOCAL" ||
                          row.classification === "ESTIMATED" ||
                          row.conflict
                        }
                        onClick={() => decide(row.id, "APPROVE_LOCAL")}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={stale}
                        onClick={() => decide(row.id, "REJECT")}
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        disabled={stale}
                        onClick={() => decide(row.id, "REQUEST_PROVIDER")}
                      >
                        Pedir proveedor
                      </button>
                    </div>
                    <small>{row.latest_decision}</small>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="10" className="empty-state">
                    No hay evidencia con estos filtros. Los faltantes permanecen
                    UNKNOWN, nunca cero.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <article className="pilot-candidate-panel">
        <header>
          <div>
            <span className="eyebrow">Piloto de validación</span>
            <h2>25 SKU por exactitud y evidencia potencial</h2>
          </div>
          <StatusBadge value="SIN POPULARIDAD INVENTADA" tone="success" />
        </header>
        <p>
          Orden: SKU exacto + costo + inventario visible; luego GTIN, metacampo
          físico y medidas en descripción. No usa ventas no disponibles.
        </p>
        <div>
          {(data?.pilot_selection || []).map((row) => (
            <span key={row.sku}>
              <b>#{row.rank}</b>
              <strong>{row.sku}</strong>
              <small>{row.title}</small>
              <small>{row.criteria.join(" · ")}</small>
            </span>
          ))}
        </div>
      </article>
      <article className="shopify-preview-panel">
        <header>
          <div>
            <span className="eyebrow">Vista previa futura Shopify</span>
            <h2>Metacampos físicos propuestos</h2>
          </div>
          <StatusBadge value="NO EJECUTABLE" tone="warning" />
        </header>
        <p>
          Solo aparece lista cuando peso, largo, ancho y alto de PAQUETE están
          confirmados y aprobados localmente. Conserva valores anteriores y
          reversión.
        </p>
        <div>
          {(data?.shopify_previews || []).map((row) => (
            <span key={row.sku}>
              <strong>{row.sku}</strong>
              <StatusBadge
                value={row.status}
                tone={row.status === "READY_LOCAL" ? "success" : "warning"}
              />
              <small>
                {row.blockers.length
                  ? row.blockers.join(" · ")
                  : "Conjunto completo; falta autorización externa separada"}
              </small>
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

function ExecutivePanel({ executive, filters, updateFilter, productRows }) {
  const totals = executive?.totals || {};
  return (
    <section className="executive-panel">
      <div className="executive-filter-row">
        <label>
          <span>Período</span>
          <select
            value={filters.period}
            onChange={(event) => updateFilter("period", event.target.value)}
          >
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
            <option value="90d">90 días</option>
          </select>
        </label>
        {[
          "channel",
          "provider",
          "brand",
          "collection",
          "category",
          "status",
        ].map((key) => (
          <label key={key}>
            <span>
              {
                {
                  channel: "Canal",
                  provider: "Proveedor",
                  brand: "Marca",
                  collection: "Colección",
                  category: "Categoría",
                  status: "Estado",
                }[key]
              }
            </span>
            <select>
              <option>Todos</option>
            </select>
          </label>
        ))}
      </div>
      <div className="estimate-banner">
        <strong>ESTIMADO AL CHECKOUT</strong>
        <span>
          {executive?.warning ||
            "La utilidad no está garantizada hasta conciliar guía, entrega y devoluciones."}
        </span>
      </div>
      <div className="executive-card-grid">
        <MetricCard
          label="Ventas / GMV simulado"
          value={money(totals.gmv)}
          detail="Precio de producto; datos locales"
        />
        <MetricCard
          label="Utilidad bruta"
          value={money(totals.gross_profit)}
          detail="GMV − costo producto"
        />
        <MetricCard
          label="Utilidad neta estimada"
          value={money(totals.net_profit_estimate)}
          detail="Tras comisión, subsidio y reserva"
          tone="highlight"
        />
        <MetricCard
          label="Margen real estimado"
          value={percent(totals.real_margin_percent)}
          detail="Sobre venta, no markup"
        />
        <MetricCard
          label="Costo producto"
          value={money(totals.cost)}
          detail="Costo normalizado"
        />
        <MetricCard
          label="Comisiones"
          value={money(totals.commissions)}
          detail="Estimación por canal"
        />
        <MetricCard
          label="Cotización envío"
          value={money(totals.quoted_shipping)}
          detail="No es costo final de guía"
        />
        <MetricCard
          label="Cobrado al cliente"
          value={money(totals.customer_shipping)}
          detail="Tarifa real / 3.000 / 2.000 / 0"
        />
        <MetricCard
          label="Subsidio logístico"
          value={money(totals.subsidy)}
          detail="Cotización − cobro cliente"
        />
        <MetricCard
          label="Reserva usada"
          value={money(totals.reserve)}
          detail="Protección configurable"
        />
        <MetricCard
          label="Devoluciones / ajustes"
          value="Pendiente"
          detail="Solo tras conciliación realizada"
        />
        <MetricCard
          label="Cotización vs guía real"
          value="No conciliado"
          detail="Se habilita con costo real"
          tone="warning"
        />
      </div>
      <div className="executive-columns">
        <article>
          <h2>Alertas operativas</h2>
          <div className="alert-list">
            <span>
              <b>{executive?.alerts?.low_margin || 0}</b> margen bajo
            </span>
            <span>
              <b>{executive?.alerts?.subsidy_exceeded || 0}</b> subsidio
              excedido
            </span>
            <span>
              <b>{executive?.alerts?.missing_data || 0}</b> con datos faltantes
            </span>
          </div>
        </article>
        <article>
          <h2>Estimado vs realizado</h2>
          <div className="reconciliation-steps">
            <span className="done">1. Cotización checkout</span>
            <span>2. Guía emitida</span>
            <span>3. Entrega</span>
            <span>4. Devolución/ajustes</span>
            <span>5. Utilidad realizada</span>
          </div>
        </article>
      </div>
      <article className="profitability-table">
        <h2>Rentabilidad navegable</h2>
        <p>
          Filtros previstos: proveedor, canal, categoría, colección, marca y
          SKU. El fixture local permite validar la lectura; los valores reales
          requieren eventos de venta y conciliación.
        </p>
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Canal</th>
              <th>Categoría</th>
              <th>SKU</th>
              <th>Precio</th>
              <th>Margen est.</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {productRows.slice(0, 6).map((row) => (
              <tr key={row.id}>
                <td>{row.vendor}</td>
                <td>{row.channel.channel_label || "Shopify futuro"}</td>
                <td>{row.category}</td>
                <td>{row.variant.sku}</td>
                <td>{money(row.variant.price)}</td>
                <td>
                  {row.estimatedMargin == null
                    ? "Pendiente"
                    : percent(row.estimatedMargin)}
                </td>
                <td>{row.needs_review ? "Revisión" : "Simulado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

function PricingAssistant({
  workspace,
  form,
  setForm,
  onDiscardDraft,
  onSubmit,
  onUpdateHypothesis,
  result,
  error,
  stale,
}) {
  const provider = workspace.providers?.find(
    (item) => String(item.id) === String(form.provider_id),
  );
  const compatiblePolicies =
    workspace.policies?.filter(
      (item) =>
        !item.provider || String(item.provider) === String(form.provider_id),
    ) || [];
  const policy = compatiblePolicies.find(
    (item) => String(item.id) === String(form.policy_id),
  );
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const changeProvider = (value) => {
    const firstCompatible = workspace.policies?.find(
      (item) => !item.provider || String(item.provider) === String(value),
    );
    setForm((current) => ({
      ...current,
      provider_id: value,
      policy_id: firstCompatible?.id || "",
    }));
  };
  return (
    <section className="pricing-assistant">
      <div className="assistant-header">
        <div>
          <span className="eyebrow">Asistente de configuración</span>
          <h2>Construye y explica el precio sin fórmulas ocultas</h2>
          <p>
            El asistente bloquea el cálculo cuando falta IVA y conserva la razón
            de la regla aplicada.
          </p>
        </div>
        <div className="draft-actions">
          <span className="step-indicator">
            1 Proveedor → 2 Regla → 3 Envío → 4 Resultado
          </span>
          <button type="button" onClick={onDiscardDraft}>
            Descartar borrador local
          </button>
        </div>
      </div>
      <form onSubmit={onSubmit} className="assistant-grid">
        <fieldset>
          <legend>1. Datos del proveedor</legend>
          <label>
            Proveedor
            <select
              value={form.provider_id}
              onChange={(event) => changeProvider(event.target.value)}
            >
              {workspace.providers?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="config-readout">
            <span>
              IVA{" "}
              <strong>{provider?.tax_treatment_label || "Pendiente"}</strong>
            </span>
            <span>
              Tratamiento{" "}
              <strong>
                {provider?.tax_treatment === "INCLUDED"
                  ? "Bruto intacto; no sumar IVA"
                  : "Requiere validación"}
              </strong>
            </span>
            <span>
              Descuento general{" "}
              <strong>{provider?.general_discount_percent || 0}%</strong>
            </span>
            <span>
              Cargos{" "}
              <strong>
                {provider
                  ? `${provider.charge_percent}% + ${money(provider.fixed_charge)}`
                  : "—"}
              </strong>
            </span>
            <span>
              Vigencia{" "}
              <strong>
                {provider?.valid_from || "Pendiente"} →{" "}
                {provider?.valid_until || "Pendiente"}
              </strong>
            </span>
            <span>
              Fuente{" "}
              <strong>{provider?.source_reference || "Pendiente"}</strong>
            </span>
          </div>
          <label>
            SKU para excepción
            <input
              value={form.sku}
              onChange={(event) => update("sku", event.target.value)}
            />
          </label>
          <label>
            Precio proveedor
            <input
              type="number"
              min="0"
              value={form.supplier_price}
              onChange={(event) => update("supplier_price", event.target.value)}
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>2. Regla y precedencia</legend>
          <label>
            Política
            <select
              value={form.policy_id}
              onChange={(event) => update("policy_id", event.target.value)}
            >
              <option value="">Sin regla configurada</option>
              {compatiblePolicies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {!compatiblePolicies.length && (
            <div className="warning-box">
              Barú tiene costo verificable e IVA incluido, pero todavía no tiene
              margen ni comisión aprobados. No se inventa una política de venta.
            </div>
          )}
          <div className="rule-reason">
            <strong>
              {policy?.precedence_label || "Regla pendiente"} ·{" "}
              {policy?.approval_status_label || "Sin aprobación"}
            </strong>
            <p>
              {policy?.explanation ||
                "Configura una regla compatible antes de simular."}
            </p>
          </div>
          <div className="config-readout">
            <span>
              Canal <strong>{policy?.channel_label || "Pendiente"}</strong>
            </span>
            <span>
              Margen sobre venta{" "}
              <strong>{policy?.target_margin_percent || 0}%</strong>
            </span>
            <span>
              Comisión{" "}
              <strong>{policy?.channel_commission_percent || 0}%</strong>
            </span>
            <span>
              Reserva máxima <strong>{money(policy?.logistics_reserve)}</strong>
            </span>
            <span>
              Tratamiento{" "}
              <strong>{policy?.reserve_behavior_label || "Pendiente"}</strong>
            </span>
            <span>
              Redondeo <strong>{money(policy?.rounding_increment)}</strong>
            </span>
          </div>
        </fieldset>
        <fieldset>
          <legend>3. Envío y subsidio</legend>
          <label>
            Cotización estimada
            <input
              type="number"
              min="0"
              value={form.quoted_shipping}
              onChange={(event) =>
                update("quoted_shipping", event.target.value)
              }
            />
          </label>
          <label>
            Cobro al cliente
            <select
              value={form.customer_shipping_charge}
              onChange={(event) =>
                update("customer_shipping_charge", event.target.value)
              }
            >
              <option value={form.quoted_shipping}>
                Tarifa estimada completa
              </option>
              <option value="3000">$3.000</option>
              <option value="2000">$2.000</option>
              <option value="0">$0</option>
            </select>
          </label>
          <label>
            Precio anterior
            <input
              type="number"
              min="0"
              value={form.previous_price}
              onChange={(event) => update("previous_price", event.target.value)}
            />
          </label>
          <div className="warning-box">
            Una cotización no garantiza el costo real. La rentabilidad final
            requiere costo de guía, entrega y devoluciones.
          </div>
          <button
            className="primary-action"
            type="submit"
            disabled={stale || !policy}
          >
            Simular y guardar localmente
          </button>
        </fieldset>
      </form>
      {policy?.approval_status === "HYPOTHESIS" && (
        <HypothesisEditor
          policy={policy}
          onSave={onUpdateHypothesis}
          disabled={stale}
        />
      )}
      {error && (
        <div className="validation-error">
          <strong>Validación</strong>
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="simulation-result">
          <div>
            <span>Costo normalizado</span>
            <strong>{money(result.normalized_cost)}</strong>
          </div>
          <div>
            <span>Precio anterior</span>
            <strong>{money(form.previous_price)}</strong>
          </div>
          <div className="highlight">
            <span>Precio propuesto</span>
            <strong>{money(result.proposed_price)}</strong>
          </div>
          <div>
            <span>Margen real</span>
            <strong>{percent(result.achieved_margin_percent)}</strong>
          </div>
          <div>
            <span>Comisión</span>
            <strong>{money(result.commission_amount)}</strong>
          </div>
          <div>
            <span>Subsidio</span>
            <strong>{money(result.shipping_subsidy)}</strong>
          </div>
          <article>
            <strong>Fórmula explicada</strong>
            <p>{result.formula.plain_language}</p>
            <small>{result.reason}</small>
            {result.warnings?.map((warning) => (
              <span className="inline-warning" key={warning}>
                {warning}
              </span>
            ))}
          </article>
          <article>
            <strong>Opciones de cobro de envío</strong>
            {result.shipping_options?.map((option) => (
              <span
                key={option.customer_charge}
                className={option.supported ? "supported" : "unsupported"}
              >
                {money(option.customer_charge)} · subsidio{" "}
                {money(option.subsidy)} · precio requerido{" "}
                {money(option.required_product_price)}
              </span>
            ))}
          </article>
        </div>
      )}
    </section>
  );
}

function HypothesisEditor({ policy, onSave, disabled }) {
  const [draft, setDraft] = useState({});
  useEffect(() => {
    setDraft({
      policy_id: policy.id,
      target_margin_percent: policy.target_margin_percent,
      minimum_margin_percent: policy.minimum_margin_percent,
      channel_commission_percent: policy.channel_commission_percent,
      logistics_reserve: policy.logistics_reserve,
      max_shipping_subsidy: policy.max_shipping_subsidy,
      rounding_increment: policy.rounding_increment,
    });
  }, [policy]);
  const update = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const fields = [
    ["target_margin_percent", "Margen objetivo %"],
    ["minimum_margin_percent", "Margen mínimo %"],
    ["channel_commission_percent", "Comisión %"],
    ["logistics_reserve", "Reserva máxima COP"],
    ["max_shipping_subsidy", "Subsidio máximo COP"],
    ["rounding_increment", "Redondeo COP"],
  ];
  return (
    <section className="hypothesis-editor">
      <header>
        <div>
          <span className="eyebrow">Edición segura</span>
          <h3>Supuestos comerciales Barú</h3>
        </div>
        <StatusBadge value="INACTIVA" tone="warning" />
      </header>
      <p>
        Cambiar estos valores solo modifica la simulación local. No aprueba
        precios ni habilita publicaciones.
      </p>
      <div>
        {fields.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input
              type="number"
              min="0"
              value={draft[key] ?? ""}
              onChange={(event) => update(key, event.target.value)}
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={() => onSave(draft)} disabled={disabled}>
        Guardar hipótesis local
      </button>
    </section>
  );
}

function ShopifyPlan({ plan, importState }) {
  const imported = plan?.status === "LOCAL_SNAPSHOT_IMPORTED";
  return (
    <section className="shopify-plan">
      <header>
        <div>
          <span className="eyebrow">Adaptador 1 · Solo lectura</span>
          <h2>Importación Shopify hacia persistencia interna</h2>
          <p>
            La tabla nunca depende de consultas en vivo: primero se consolida un
            snapshot interno y luego se actualiza incrementalmente.
          </p>
        </div>
        <StatusBadge
          value={imported ? "SNAPSHOT INTERNO" : "PENDIENTE"}
          tone={imported ? "success" : "warning"}
        />
      </header>
      <div className="architecture-flow">
        <article>
          <b>1</b>
          <strong>Importación inicial</strong>
          <span>Productos y variantes paginados por cursor.</span>
        </article>
        <article>
          <b>2</b>
          <strong>Snapshot interno</strong>
          <span>{CATALOG_RUNTIME_LABEL}.</span>
        </article>
        <article>
          <b>3</b>
          <strong>Incremental</strong>
          <span>Cursor + fecha actualizada persistidos.</span>
        </article>
        <article>
          <b>4</b>
          <strong>Webhooks futuros</strong>
          <span>Bandeja idempotente, sin procesar hoy.</span>
        </article>
      </div>
      <div className="shopify-fields">
        <h3>Datos previstos</h3>
        {plan?.initial_import?.fields?.map((field) => (
          <span key={field}>✓ {field}</span>
        ))}
      </div>
      <div className="shopify-safety-grid">
        <article>
          <h3>Estado interno</h3>
          <dl>
            <div>
              <dt>Estado</dt>
              <dd>{importState?.status_label || "Sin configurar"}</dd>
            </div>
            <div>
              <dt>Páginas</dt>
              <dd>{importState?.pages_processed || 0}</dd>
            </div>
            <div>
              <dt>Productos</dt>
              <dd>{importState?.products_processed || 0}</dd>
            </div>
            <div>
              <dt>Variantes</dt>
              <dd>{importState?.variants_processed || 0}</dd>
            </div>
          </dl>
        </article>
        <article>
          <h3>Puertas antes de escribir</h3>
          <ol>
            <li>Vista previa interna</li>
            <li>Aprobación por lote</li>
            <li>Historial auditable</li>
            <li>Autorización externa separada</li>
            <li>Reversión documentada</li>
          </ol>
        </article>
        <article>
          <h3>Conciliación SKU</h3>
          <p>{plan?.reconciliation}</p>
          <p>
            Duplicados, faltantes y ambigüedades nunca se aceptan
            automáticamente.
          </p>
        </article>
      </div>
      <button className="disabled-action" type="button" disabled>
        Escritura externa desactivada · requiere aprobación separada
      </button>
    </section>
  );
}

function HistoryPanel({ events }) {
  return (
    <section className="history-panel">
      <header>
        <div>
          <span className="eyebrow">Auditoría local</span>
          <h2>Historial y reversión</h2>
          <p>
            Cada cálculo, configuración y lote debe registrar antes/después y si
            admite reversión.
          </p>
        </div>
      </header>
      {events.length ? (
        events.map((event) => (
          <article key={event.id}>
            <div>
              <strong>{event.action}</strong>
              <span>
                {event.entity_type} · {event.entity_id}
              </span>
            </div>
            <div>
              <StatusBadge
                value={event.reversible ? "Reversible" : "No reversible"}
                tone={event.reversible ? "success" : "warning"}
              />
              <small>
                {new Date(event.created_at).toLocaleString("es-CO")}
              </small>
            </div>
          </article>
        ))
      ) : (
        <div className="empty-state">Aún no hay eventos locales.</div>
      )}
    </section>
  );
}
