import httpClient, { refreshCsrfToken } from "./lib/httpClient";

async function request(path, { method = "GET", body } = {}) {
  try {
    const response = await httpClient.request({ url: path, method, data: body });
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
};
