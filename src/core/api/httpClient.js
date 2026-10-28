import axios from "axios";

const CSRF_PATH = "/api/auth/csrf/";
// Django rota el token CSRF al iniciar sesión (y la sesión cambia al
// cerrarla): el token guardado deja de servir y cada POST respondería 403
// ("No tienes permiso…") hasta recargar la página.
const ROTATES_CSRF = ["/api/auth/google/", "/api/auth/logout/"];

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

function isCsrfFailure(error) {
  const detail = error.response?.data?.detail;
  return error.response?.status === 403 && typeof detail === "string" && detail.startsWith("CSRF Failed");
}

httpClient.interceptors.request.use(async (config) => {
  if (config.method?.toLowerCase() === "get") return config;

  if (!csrfToken) {
    await ensureCsrfToken();
  }
  config.headers["X-CSRFToken"] = csrfToken;
  return config;
});

httpClient.interceptors.response.use(
  (response) => {
    if (response.config.url === CSRF_PATH && response.data?.csrftoken) {
      csrfToken = response.data.csrftoken;
    }
    if (ROTATES_CSRF.includes(response.config.url)) {
      csrfToken = null;
    }
    return response;
  },
  (error) => {
    // Red de seguridad: un token vencido por otra vía (otra pestaña inició
    // sesión) se renueva y la solicitud se repite una sola vez.
    if (isCsrfFailure(error) && !error.config._csrfRetried) {
      csrfToken = null;
      return httpClient.request({ ...error.config, _csrfRetried: true });
    }
    return Promise.reject(error);
  },
);

export default httpClient;
