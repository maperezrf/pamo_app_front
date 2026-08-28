import axios from "axios";

const CSRF_PATH = "/api/auth/csrf/";
const AUTH_PATHS_THAT_ROTATE_CSRF = new Set([
  "/api/auth/google/",
  "/api/auth/local-demo/",
  "/api/auth/logout/",
]);

let csrfToken = null;
let csrfRequest = null;

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

function ensureCsrfToken() {
  if (csrfToken) return Promise.resolve(csrfToken);
  if (!csrfRequest) {
    csrfRequest = httpClient
      .get(CSRF_PATH)
      .then((response) => response.data?.csrftoken ?? null)
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

export async function refreshCsrfToken() {
  csrfToken = null;
  csrfRequest = null;
  return ensureCsrfToken();
}

httpClient.interceptors.request.use(async (config) => {
  if (config.method?.toLowerCase() === "get") return config;

  if (!csrfToken) {
    await ensureCsrfToken();
  }
  config.headers["X-CSRFToken"] = csrfToken;
  return config;
});

httpClient.interceptors.response.use((response) => {
  if (response.config.url === CSRF_PATH && response.data?.csrftoken) {
    csrfToken = response.data.csrftoken;
  }
  if (AUTH_PATHS_THAT_ROTATE_CSRF.has(response.config.url)) {
    csrfToken = null;
  }
  return response;
});

export default httpClient;
