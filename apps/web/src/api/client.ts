import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: `${API_URL}/api`
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("marketplace_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function mediaUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}
