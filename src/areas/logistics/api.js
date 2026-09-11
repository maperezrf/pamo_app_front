import httpClient from "../../lib/httpClient";

async function request(path, { method = "GET", body } = {}) {
  try {
    const response = await httpClient.request({ url: path, method, data: body });
    return { ok: true, status: response.status, data: response.data ?? null };
  } catch (error) {
    if (error.response) {
      return { ok: false, status: error.response.status, data: error.response.data ?? null };
    }
    return { ok: false, status: 0, data: { detail: "No fue posible conectar con la API." } };
  }
}

export const logisticsApi = {
  list: (currentState = "") =>
    request(`/api/logistics/remittances/${currentState ? `?current_state=${currentState}` : ""}`),
  referenceData: () => request("/api/logistics/remittances/references/"),
  create: (payload) => request("/api/logistics/remittances/", { method: "POST", body: payload }),
  detail: (id) => request(`/api/logistics/remittances/${id}/`),
  sendToConfirm: (id) =>
    request(`/api/logistics/remittances/${id}/send-to-confirm/`, { method: "POST" }),
  confirm: (id, expectedVersion) =>
    request(`/api/logistics/remittances/${id}/confirm/`, {
      method: "POST",
      body: { expected_version: expectedVersion },
    }),
  cancel: (id, reason) =>
    request(`/api/logistics/remittances/${id}/cancel/`, { method: "POST", body: { reason } }),
};
