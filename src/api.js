const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (method !== "GET") {
    headers["X-CSRFToken"] = getCookie("csrftoken");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // sin body (ej. 204)
  }

  return { ok: response.ok, status: response.status, data };
}

export const api = {
  fetchCsrfCookie: () => request("/api/auth/csrf/"),
  loginWithGoogle: (credential) =>
    request("/api/auth/google/", { method: "POST", body: { credential } }),
  me: () => request("/api/auth/me/"),
  logout: () => request("/api/auth/logout/", { method: "POST" }),
  pingAdmin: () => request("/api/auth/ping-admin/"),
};
