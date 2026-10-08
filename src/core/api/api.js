import httpClient from "./httpClient";

async function request(path, { method = "GET", body, params } = {}) {
  try {
    const response = await httpClient.request({ url: path, method, data: body, params });
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
  loginWithGoogle: (credential) =>
    request("/api/auth/google/", { method: "POST", body: { credential } }),
  me: () => request("/api/auth/me/"),
  logout: () => request("/api/auth/logout/", { method: "POST" }),
  menu: () => request("/api/auth/menu/"),
  pingAdmin: () => request("/api/auth/ping-admin/"),
  listOrders: (params) => request("/api/orders/", { params }),
  // Despacho de UN pedido (botones del panel). Responden {dispatch} o {detail}.
  notifyDispatch: (shopifyOrderId) =>
    request(`/api/orders/${shopifyOrderId}/dispatch/notify/`, { method: "POST" }),
  fetchDispatchLabel: (shopifyOrderId) =>
    request(`/api/orders/${shopifyOrderId}/dispatch/label/fetch/`, { method: "POST" }),
  quoteDispatchLabel: (shopifyOrderId) =>
    request(`/api/orders/${shopifyOrderId}/dispatch/label/quote/`, { method: "POST" }),
  generateDispatchLabel: (shopifyOrderId, { carrier, service }) =>
    request(`/api/orders/${shopifyOrderId}/dispatch/label/`, { method: "POST", body: { carrier, service } }),
};
