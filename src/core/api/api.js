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
  // Despacho de UN pedido (botones del panel). `dispatchId`: el despacho de
  // la bodega (obligatorio si el pedido sale de varias). Responden
  // {dispatch, dispatches} o {detail}.
  notifyDispatch: (shopifyOrderId, dispatchId) =>
    request(`/api/orders/${shopifyOrderId}/dispatch/notify/`, { method: "POST", body: { dispatch_id: dispatchId } }),
  fetchDispatchLabel: (shopifyOrderId, dispatchId) =>
    request(`/api/orders/${shopifyOrderId}/dispatch/label/fetch/`, { method: "POST", body: { dispatch_id: dispatchId } }),
  quoteDispatchLabel: (shopifyOrderId, dispatchId) =>
    request(`/api/orders/${shopifyOrderId}/dispatch/label/quote/`, { method: "POST", body: { dispatch_id: dispatchId } }),
  generateDispatchLabel: (shopifyOrderId, dispatchId, { carrier, service }) =>
    request(`/api/orders/${shopifyOrderId}/dispatch/label/`, {
      method: "POST",
      body: { dispatch_id: dispatchId, carrier, service },
    }),
  // Recuadro del RPA de guías de Sodimac: estado (con el enlace del visor),
  // "Continuar" tras el CAPTCHA y "Detener". Responden el estado o {detail}.
  sodimacRpaStatus: () => request("/api/orders/sodimac/rpa/status/"),
  continueSodimacRpa: () => request("/api/orders/sodimac/rpa/continue/", { method: "POST" }),
  killSodimacRpa: () => request("/api/orders/sodimac/rpa/kill/", { method: "POST" }),
  // Botón "Generar guía (RPA)" de Sodimac. Responde {channel_label} o {detail}.
  requestChannelLabel: (shopifyOrderId) =>
    request(`/api/orders/${shopifyOrderId}/channel-label/request/`, { method: "POST" }),
  // Botón "Cargar guía" de Sodimac: rótulo y relación (PDF) y número opcional
  // (si falta, el backend lo lee del rótulo). Responde {channel_label} o {detail}.
  uploadChannelLabel: (shopifyOrderId, { label, relation, trackingNumber }) => {
    const form = new FormData();
    form.append("label", label);
    form.append("relation", relation);
    if (trackingNumber) form.append("tracking_number", trackingNumber);
    return request(`/api/orders/${shopifyOrderId}/channel-label/upload/`, { method: "POST", body: form });
  },
  // PDF de la guía que generó un tercero (RPA de Sodimac): kind "rotulo" | "relacion".
  downloadChannelLabel: (shopifyOrderId, kind) =>
    downloadFile(`/api/orders/${shopifyOrderId}/channel-label/${kind}/`),
  // PDF de la guía generada en Envía (guardada en el despacho).
  downloadDispatchLabel: (shopifyOrderId, dispatchId) =>
    downloadFile(`/api/orders/${shopifyOrderId}/dispatch/label/file/${dispatchId ? `?dispatch_id=${dispatchId}` : ""}`),
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
