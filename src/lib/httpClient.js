import axios from "axios";

const CSRF_PATH = "/api/auth/csrf/";

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
  return response;
});

export default httpClient;
