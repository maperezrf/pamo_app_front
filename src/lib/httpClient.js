import axios from "axios";

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

httpClient.interceptors.request.use((config) => {
  if (config.method !== "get") {
    config.headers["X-CSRFToken"] = getCookie("csrftoken");
  }
  return config;
});

export default httpClient;
