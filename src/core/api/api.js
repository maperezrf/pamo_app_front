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
  // Botón "Generar guía (RPA)" de Sodimac. Responde {channel_label} o {detail}.
  requestChannelLabel: (shopifyOrderId) =>
    request(`/api/orders/${shopifyOrderId}/channel-label/request/`, { method: "POST" }),
  // PDF de la guía que generó un tercero (RPA de Sodimac): kind "rotulo" | "relacion".
  downloadChannelLabel: (shopifyOrderId, kind) =>
    downloadFile(`/api/orders/${shopifyOrderId}/channel-label/${kind}/`),
};

// Descarga un archivo con la sesión (cookie) y lo guarda con el nombre que
// manda el backend en Content-Disposition. Devuelve {ok, status}.
async function downloadFile(path) {
  try {
    const response = await httpClient.get(path, { responseType: "blob" });
    const disposition = response.headers["content-disposition"] ?? "";
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "documento.pdf";
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { ok: true, status: response.status };
  } catch (error) {
    if (error.response) return { ok: false, status: error.response.status };
    throw error;
  }
}
