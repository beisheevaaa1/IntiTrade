import axios from "axios";
import { API_URL } from "./config";
import { reportClientError } from "../lib/telemetry";

export { API_URL };

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url ?? "");
    if (status >= 500 && !url.includes("/telemetry")) {
      reportClientError({
        type: "api_error",
        message: `API request failed with status ${status}`,
        requestId: error?.response?.headers?.["x-request-id"]
      });
    }
    return Promise.reject(error);
  }
);

export function mediaUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}
