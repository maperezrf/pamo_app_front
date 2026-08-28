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

async function publicRequest(path, { method = "GET", body } = {}) {
  const apiBase = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { detail: "No fue posible conectar con la remisión." } };
  }
}

function publicApiUrl(path) {
  const apiBase = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${apiBase}${path}`;
}

async function authenticatedBlob(path, fallback) {
  try {
    const response = await httpClient.get(path, { responseType: "blob" });
    return { ok: true, status: response.status, data: response.data };
  } catch (error) {
    return {
      ok: false,
      status: error.response?.status ?? 0,
      data: error.response?.data ?? { detail: fallback },
    };
  }
}

export const remittancesApi = {
  list: (invoiceStatus = "") =>
    request(`/api/facturacion/remisiones/${invoiceStatus ? `?invoice_status=${invoiceStatus}` : ""}`),
  referenceData: () => request("/api/facturacion/remisiones/referencias/"),
  searchSuppliers: (query) => request(
    `/api/facturacion/remisiones/proveedores/?q=${encodeURIComponent(query)}`,
  ),
  confirmSiigoSupplier: (nit) => request("/api/facturacion/remisiones/proveedores/", {
    method: "POST",
    body: { nit },
  }),
  create: (payload) => request("/api/facturacion/remisiones/", { method: "POST", body: payload }),
  interpretSupplierInvoice: (file) => {
    const body = new FormData();
    body.append("file", file);
    return request("/api/facturacion/remisiones/factura-proveedor/interpretar/", { method: "POST", body });
  },
  attachSupplierInvoice: (id, file) => {
    const body = new FormData();
    body.append("file", file);
    return request(`/api/facturacion/remisiones/${id}/factura-proveedor/`, { method: "POST", body });
  },
  downloadSupplierInvoice: async (remittanceId, fileId) => {
    try {
      const response = await httpClient.get(
        `/api/facturacion/remisiones/${remittanceId}/factura-proveedor/${fileId}/`,
        { responseType: "blob" },
      );
      return { ok: true, status: response.status, data: response.data };
    } catch (error) {
      return {
        ok: false,
        status: error.response?.status ?? 0,
        data: error.response?.data ?? { detail: "No fue posible descargar la factura privada." },
      };
    }
  },
  clientDocument: (remittanceId, download = false) => authenticatedBlob(
    `/api/facturacion/remisiones/${remittanceId}/documento/${download ? "?download=1" : ""}`,
    "No fue posible generar el PDF de la remisión.",
  ),
  publicDocumentUrl: (token, download = false) => publicApiUrl(
    `/api/facturacion/remisiones/public/${token}/documento/${download ? "?download=1" : ""}`,
  ),
  detail: (id) => request(`/api/facturacion/remisiones/${id}/`),
  confirm: (id, expectedVersion) =>
    request(`/api/facturacion/remisiones/${id}/confirmar/`, {
      method: "POST",
      body: { expected_version: expectedVersion },
    }),
  prepareWhatsApp: (id, publicBaseUrl) =>
    request(`/api/facturacion/remisiones/${id}/compartir-whatsapp/`, {
      method: "POST",
      body: { public_base_url: publicBaseUrl },
    }),
  publicRecipient: (token) => publicRequest(`/api/facturacion/remisiones/public/${token}/`),
  acceptRecipient: (token, payload) => publicRequest(`/api/facturacion/remisiones/public/${token}/`, {
    method: "POST",
    body: payload,
  }),
  accountingQueue: () => request("/api/facturacion/remisiones/contabilidad/"),
  updateAccounting: (id, payload) => request(`/api/facturacion/remisiones/${id}/contabilidad/`, {
    method: "PATCH",
    body: payload,
  }),
  searchSiigoProducts: (query) => request(
    `/api/facturacion/remisiones/contabilidad/productos-siigo/?q=${encodeURIComponent(query)}`,
  ),
  updateCommercialPreparation: (id, payload) => request(
    `/api/facturacion/remisiones/${id}/contabilidad/preparacion/`,
    { method: "PATCH", body: payload },
  ),
  invoicePreview: (id) => request(`/api/facturacion/remisiones/${id}/factura/vista-previa/`),
  siigoInvoicePreflight: (id) => request(
    `/api/facturacion/remisiones/${id}/factura/prevalidar-siigo/`,
    { method: "POST", body: {} },
  ),
  createSiigoDraft: (id) => request(
    `/api/facturacion/remisiones/${id}/factura/confirmar/`,
    { method: "POST", body: { mode: "DRAFT" } },
  ),
};
