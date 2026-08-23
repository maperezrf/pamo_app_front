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

export const remittancesApi = {
  list: (invoiceStatus = "") =>
    request(`/api/facturacion/remisiones/${invoiceStatus ? `?invoice_status=${invoiceStatus}` : ""}`),
  referenceData: () => request("/api/facturacion/remisiones/referencias/"),
  create: (payload) => request("/api/facturacion/remisiones/", { method: "POST", body: payload }),
  detail: (id) => request(`/api/facturacion/remisiones/${id}/`),
  confirm: (id, expectedVersion) =>
    request(`/api/facturacion/remisiones/${id}/confirmar/`, {
      method: "POST",
      body: { expected_version: expectedVersion },
    }),
  accountingQueue: () => request("/api/facturacion/remisiones/contabilidad/"),
  invoicePreview: (id) => request(`/api/facturacion/remisiones/${id}/factura/vista-previa/`),
};
