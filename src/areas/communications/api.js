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


export const communicationsApi = {
  capabilities: () => request("/api/communications/whatsapp/capabilities/"),
  recipients: (shipmentIds) =>
    request("/api/communications/whatsapp/recipients/", {
      method: "POST",
      data: { shipment_ids: shipmentIds },
    }),
  createDrafts: (selections) =>
    request("/api/communications/whatsapp/drafts/", {
      method: "POST",
      data: { selections },
    }),
  draftAction: (draftId, action) =>
    request(`/api/communications/whatsapp/drafts/${draftId}/${action}/`, {
      method: "POST",
    }),
  dispatch: (outboxId) =>
    request(`/api/communications/whatsapp/outbox/${outboxId}/dispatch/`, {
      method: "POST",
    }),
};

