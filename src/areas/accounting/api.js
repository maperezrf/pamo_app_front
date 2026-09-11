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

export const accountingApi = {
  queue: () => request("/api/accounting/remittances/"),
  invoicePreview: (id) => request(`/api/accounting/remittances/${id}/invoice/preview/`),
  invoiceConfirm: (id, payload) =>
    request(`/api/accounting/remittances/${id}/invoice/confirm/`, { method: "POST", body: payload }),
};
