import httpClient, { refreshCsrfToken } from "./lib/httpClient";

async function request(path, { method = "GET", body, signal } = {}) {
  try {
    const response = await httpClient.request({ url: path, method, data: body, signal });
    return { ok: true, status: response.status, data: response.data ?? null };
  } catch (error) {
    if (error.response) {
      return { ok: false, status: error.response.status, data: error.response.data ?? null };
    }
    throw error;
  }
}

export const api = {
  fetchCsrfCookie: () => request("/api/auth/csrf/"),
  loginWithGoogle: async (credential) => {
    const result = await request("/api/auth/google/", {
      method: "POST",
      body: { credential },
    });
    if (result.ok) await refreshCsrfToken();
    return result;
  },
  loginLocalDemo: async () => {
    const result = await request("/api/auth/local-demo/", { method: "POST" });
    if (result.ok) await refreshCsrfToken();
    return result;
  },
  me: () => request("/api/auth/me/"),
  logout: async () => {
    const result = await request("/api/auth/logout/", { method: "POST" });
    if (result.ok) await refreshCsrfToken();
    return result;
  },
  menu: () => request("/api/auth/menu/"),
  pingAdmin: () => request("/api/auth/ping-admin/"),
  listarPrototipos: () => request("/api/tracking/prototipos/admin/"),
  catalogWorkspace: (page = 1, filters = {}, columnFilters = {}, tableSort = null, signal) => {
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== "period" && key !== "marginMin") params.set(key, value);
    });
    if (Object.keys(columnFilters).length) params.set("column_filters", JSON.stringify(columnFilters));
    if (tableSort?.key && tableSort?.direction) {
      params.set("sort_key", tableSort.key);
      params.set("sort_direction", tableSort.direction);
    }
    return request(`/api/catalogo/workspace/?${params.toString()}`, { signal });
  },
  catalogColumnOptions: (column) => {
    const params = new URLSearchParams({ column });
    return request(`/api/catalogo/workspace/column-options/?${params.toString()}`);
  },
  catalogChannelRefreshStatus: () => request("/api/catalogo/workspace/refresh-channels/"),
  catalogConnections: () => request("/api/catalogo/workspace/connections/"),
  shippingDeliveryWorkspace: (signal) => request("/api/catalogo/shipping-delivery/workspace/", { signal }),
  simulateStandardShipping: (body) => request("/api/catalogo/shipping-delivery/workspace/", { method: "POST", body }),
  startCatalogChannelRefresh: () => request("/api/catalogo/workspace/refresh-channels/", { method: "POST" }),
  catalogAlignment: ({ channel = "MERCADO_LIBRE", page = 1, search = "", matchStatus = "" } = {}) => {
    const params = new URLSearchParams({ channel, page: String(page), page_size: "50" });
    if (search) params.set("search", search);
    if (matchStatus) params.set("match_status", matchStatus);
    return request(`/api/catalogo/alignment/?${params.toString()}`);
  },
  catalogExecutiveSimulation: () => request("/api/catalogo/executive/simulation/"),
  catalogShopifyImportPlan: () => request("/api/catalogo/shopify/import-plan/"),
  catalogShopifySyncWorkspace: () => request("/api/catalogo/shopify/sync-workspace/"),
  catalogShopifySyncAction: (body) => request("/api/catalogo/shopify/sync-workspace/", { method: "POST", body }),
  catalogPilotSimulation: () => request("/api/catalogo/pilot/simulation/"),
  catalogPhysicalReviewQueue: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return request(`/api/catalogo/physical/review-queue/?${params.toString()}`);
  },
  decideCatalogPhysicalEvidence: (body) => request("/api/catalogo/physical/review-queue/", { method: "POST", body }),
  catalogPhysicalMeasurementWorkspace: () => request("/api/catalogo/physical/measurement-workspace/"),
  catalogPhysicalMeasurementAction: (body) => request("/api/catalogo/physical/measurement-workspace/", { method: "POST", body }),
  catalogEnviaQuoteContract: () => request("/api/catalogo/envia/quote-contract/"),
  validateCatalogEnviaFixture: (body) => request("/api/catalogo/envia/quote-contract/", { method: "POST", body }),
  simulateCatalogPrice: (body) => request("/api/catalogo/pricing/simulate/", { method: "POST", body }),
  updateCatalogHypothesis: (body) => request("/api/catalogo/pricing/hypothesis/", { method: "POST", body }),
  catalogPhase6Workspace: () => request("/api/catalogo/phase6/workspace/"),
  catalogPhase6Pricing: (body) => request("/api/catalogo/phase6/pricing/", { method: "POST", body }),
  catalogPhase6Multwarehouse: (body) => request("/api/catalogo/phase6/multwarehouse/", { method: "POST", body }),
  catalogPhase7Workspace: () => request("/api/catalogo/phase7/workspace/"),
  catalogSodimacWorkspace: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return request(`/api/catalogo/sodimac/workspace/?${params.toString()}`);
  },
  catalogSodimacAction: (body) => request("/api/catalogo/sodimac/workspace/", { method: "POST", body }),
};
