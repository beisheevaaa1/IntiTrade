const developmentApiUrl = import.meta.env.VITE_API_URL?.trim() || "http://localhost:4000";

// Production always uses the page origin. This keeps both deployed domains
// first-party for Secure cookies, API calls, uploads, and WebSocket traffic.
export const API_URL = import.meta.env.PROD ? "" : developmentApiUrl;
