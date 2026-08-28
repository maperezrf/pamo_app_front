import httpClient from "../../lib/httpClient";


async function request(path, options = {}) {
  try {
    const response = await httpClient.request({
      url: path,
      method: options.method || "GET",
      data: options.data,
    });
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail || "No se pudo completar la operación.";
    const wrapped = new Error(detail);
    wrapped.status = error.response?.status;
    wrapped.data = error.response?.data;
    throw wrapped;
  }
}


const queryString = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
};


export const ordersApi = {
  overview: () => request("/api/pedidos/overview/"),
  list: (params) => request(`/api/pedidos/?${queryString(params)}`),
  detail: (orderId) => request(`/api/pedidos/${orderId}/`),
  locations: () => request("/api/pedidos/locations/"),
  filterOptions: () => request("/api/pedidos/filter-options/"),
  integrations: () => request("/api/pedidos/integrations/"),
  updateShipment: (shipmentId, data) =>
    request(`/api/pedidos/shipments/${shipmentId}/`, { method: "PATCH", data }),
  shippingPlan: (shipmentId) =>
    request(`/api/pedidos/shipments/${shipmentId}/shipping-plan/`),
  updateShippingPlan: (shipmentId, data) =>
    request(`/api/pedidos/shipments/${shipmentId}/shipping-plan/`, { method: "PATCH", data }),
  prepareShippingPlan: (shipmentId) =>
    request(`/api/pedidos/shipments/${shipmentId}/shipping-plan/`, {
      method: "POST",
      data: { action: "prepare" },
    }),
  updateIncident: (shipmentId, data) =>
    request(`/api/pedidos/shipments/${shipmentId}/incident/`, { method: "PATCH", data }),
  uploadDocument: (shipmentId, file) => {
    const data = new FormData();
    data.append("file", file);
    return request(`/api/pedidos/shipments/${shipmentId}/document/`, {
      method: "POST",
      data,
    });
  },
  simulateSupplierResponse: (shipmentId, action, category = "", detail = "") =>
    request(`/api/pedidos/shipments/${shipmentId}/supplier-response/simulate/`, {
      method: "POST",
      data: {
        action,
        category,
        detail,
        event_id: `local-ui:${shipmentId}:${action}:${category || "none"}:${crypto.randomUUID()}`,
      },
    }),
  messagingConfigs: () => request("/api/pedidos/messaging/configs/"),
  saveMessagingConfig: (data) =>
    request("/api/pedidos/messaging/configs/", { method: "PUT", data }),
  prepareWhatsApp: (shipmentIds) =>
    request("/api/pedidos/messaging/manual/", {
      method: "POST",
      data: { shipment_ids: shipmentIds },
    }),
  markFollowup: (id, action) =>
    request(`/api/pedidos/messaging/manual/${id}/${action}/`, { method: "POST" }),
  savedFilters: () => request("/api/pedidos/saved-filters/"),
  saveFilter: (name, filters) =>
    request("/api/pedidos/saved-filters/", { method: "POST", data: { name, filters } }),
  deleteFilter: (id) =>
    request(`/api/pedidos/saved-filters/${id}/`, { method: "DELETE" }),
};


export const authenticatedDocumentUrl = (path) => {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";
  return `${base}${path}`;
};
