import axios from "axios";

/** Auth tokens are httpOnly cookies only — never use localStorage/sessionStorage. */
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

const shouldSkipRefresh = (config) => {
  const url = config?.url || "";
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout") ||
    url.includes("/auth/me")
  );
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      !original ||
      original._retry ||
      error.response?.status !== 401 ||
      shouldSkipRefresh(original)
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = api
        .post("/auth/refresh")
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const { data } = await refreshPromise;
      if (data?.user) {
        window.dispatchEvent(
          new CustomEvent("auth:refreshed", { detail: data.user })
        );
      }
      return api(original);
    } catch (refreshError) {
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
      return Promise.reject(refreshError);
    }
  }
);

export default api;
