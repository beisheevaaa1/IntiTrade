import { expect, test as base, type Page, type Route } from "@playwright/test";

export const categories = [
  { id: "category-textbooks", name: "Textbooks", slug: "textbooks" },
  { id: "category-electronics", name: "Electronics", slug: "electronics" },
  { id: "category-courses", name: "Courses", slug: "courses" },
];

export const listing = {
  id: "listing-e2e-1",
  title: "Deterministic Calculus Textbook",
  description: "A listing served by the Playwright API fixture.",
  price: "42.50",
  type: "PRODUCT",
  condition: "GOOD",
  status: "ACTIVE",
  location: "Main Campus Library",
  viewsCount: 12,
  interestCount: 2,
  isNegotiable: true,
  showPhone: false,
  quantity: 2,
  sellerId: "seller-e2e-1",
  categoryId: categories[0].id,
  createdAt: "2026-07-01T08:00:00.000Z",
  seller: {
    id: "seller-e2e-1",
    name: "Test Seller",
    email: "seller@example.test",
    phone: null,
    faculty: "Engineering",
    campusArea: "Main Campus",
    avatarUrl: null,
    sellerType: "CASUAL",
    rating: 4.8,
    ratingCount: 7,
    isVerified: true,
  },
  category: categories[0],
  images: [],
  _count: { favorites: 0, reports: 0 },
};

type JsonObject = Record<string, unknown>;

export type MockApiState = {
  listingQueries: URLSearchParams[];
  registrationRequests: JsonObject[];
  profileRequests: JsonObject[];
  registerStatus: number;
  registerResponse: JsonObject;
  authenticated: boolean;
  adminAuthenticated: boolean;
  conversations: JsonObject[];
  favorites: JsonObject[];
  favoriteDeletes: string[];
  supportRequests: JsonObject[];
  unhandledRequests: string[];
};

function corsHeaders(route: Route) {
  return {
    "access-control-allow-origin": route.request().headers().origin || "http://127.0.0.1:4173",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
  };
}

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(route),
    body: JSON.stringify(body),
  });
}

async function installApiGuard(page: Page): Promise<MockApiState> {
  const state: MockApiState = {
    listingQueries: [],
    registrationRequests: [],
    profileRequests: [],
    registerStatus: 422,
    registerResponse: { message: "Mock registration rejected" },
    authenticated: false,
    adminAuthenticated: false,
    conversations: [],
    favorites: [],
    favoriteDeletes: [],
    supportRequests: [],
    unhandledRequests: [],
  };

  // This intercept applies to both the local API and a same-origin production API.
  // No test can accidentally write persistent data to a real environment.
  await page.route(/^https?:\/\/[^/]+\/api\/.*/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const apiIndex = url.pathname.indexOf("/api/");
    const path = apiIndex >= 0 ? url.pathname.slice(apiIndex + 4) : url.pathname;

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }

    if (method === "GET" && path === "/listings/categories") {
      await json(route, 200, { categories });
      return;
    }

    if (method === "GET" && path === "/auth/me") {
      if (!state.authenticated) {
        await json(route, 401, { message: "Authentication required" });
        return;
      }
      await json(route, 200, { user: { id: "user-e2e-1", name: state.adminAuthenticated ? "Admin Tester" : "Support Tester", email: "support@example.test", role: state.adminAuthenticated ? "ADMIN" : "STUDENT", isBlocked: false, isVerified: false } });
      return;
    }

    if (method === "GET" && path === "/community/notifications" && state.authenticated) {
      await json(route, 200, { notifications: [] });
      return;
    }

    if (method === "GET" && path === "/conversations" && state.authenticated) {
      await json(route, 200, { conversations: state.conversations });
      return;
    }

    if (method === "PATCH" && /^\/conversations\/[^/]+\/read$/.test(path) && state.authenticated) {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }

    if (method === "GET" && path === "/favorites" && state.authenticated) {
      await json(route, 200, { favorites: state.favorites });
      return;
    }

    if (method === "DELETE" && path.startsWith("/favorites/") && state.authenticated) {
      const listingId = decodeURIComponent(path.slice("/favorites/".length));
      state.favoriteDeletes.push(listingId);
      state.favorites = state.favorites.filter((favorite) => favorite.listingId !== listingId);
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }

    if (method === "GET" && path === "/support" && state.authenticated) {
      await json(route, 200, { tickets: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });
      return;
    }

    if (method === "POST" && path === "/support" && state.authenticated) {
      const payload = (request.postDataJSON() || {}) as JsonObject;
      state.supportRequests.push(payload);
      await json(route, 201, {
        ticket: {
          id: "ticket-e2e-1",
          ...payload,
          status: "OPEN",
          priority: "NORMAL",
          userId: "user-e2e-1",
          createdAt: "2026-07-14T10:00:00.000Z",
          updatedAt: "2026-07-14T10:00:00.000Z",
          lastMessageAt: "2026-07-14T10:00:00.000Z",
          _count: { messages: 1 }
        }
      });
      return;
    }

    if (method === "GET" && path === "/admin/overview" && state.adminAuthenticated) {
      await json(route, 200, { pendingListings: 0, openReports: 0, users: 1, activeListings: 1, openSupportTickets: 0 });
      return;
    }

    if (method === "GET" && path === "/admin/system" && state.adminAuthenticated) {
      await json(route, 200, {
        readiness: { ready: true, state: "ready", database: "connected" },
        monitoring: {
          requests: { total: 120, errors: 0, averageDurationMs: 12.5, statusCounts: { "2xx": 120 } },
          memory: { rssMb: 128, heapUsedMb: 64 },
          sockets: { activeConnections: 2, messagesSent: 5, messageErrors: 0 },
          recentErrors: []
        }
      });
      return;
    }

    if (method === "GET" && path === "/admin/logs" && state.adminAuthenticated) {
      await json(route, 200, {
        logs: [{ id: "audit-e2e-1", action: "LISTING_ACTIVE", entityType: "Listing", entityId: "listing-e2e-1", actorEmail: "admin@example.test", requestId: "00000000-0000-4000-8000-000000000001", createdAt: "2026-07-14T10:00:00.000Z", before: { status: "PENDING" }, after: { status: "ACTIVE" } }],
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
      });
      return;
    }

    if (method === "GET" && path === "/listings/autocomplete") {
      await json(route, 200, { suggestions: [] });
      return;
    }

    if (method === "GET" && path === "/want-ads") {
      await json(route, 200, { wantAds: [], pagination: { page: 1, totalPages: 1, total: 0 } });
      return;
    }

    if (method === "GET" && path === `/listings/${listing.id}`) {
      await json(route, 200, { listing });
      return;
    }

    if (method === "GET" && path === "/listings") {
      state.listingQueries.push(new URLSearchParams(url.search));
      await json(route, 200, {
        listings: [listing],
        pagination: { page: 1, totalPages: 1, total: 1 },
      });
      return;
    }

    if (method === "POST" && path === "/auth/register") {
      state.registrationRequests.push((request.postDataJSON() || {}) as JsonObject);
      await json(route, state.registerStatus, state.registerResponse);
      return;
    }

    if (method === "PATCH" && path === "/auth/profile" && state.authenticated) {
      const payload = (request.postDataJSON() || {}) as JsonObject;
      state.profileRequests.push(payload);
      await json(route, 200, { user: { id: "user-e2e-1", ...payload } });
      return;
    }

    state.unhandledRequests.push(`${method} ${path}`);
    await json(route, 503, { message: "Request blocked by the E2E API guard" });
  });

  return state;
}

export const test = base.extend<{ api: MockApiState }>({
  api: [
    async ({ page }, use) => {
      const state = await installApiGuard(page);
      await use(state);
      expect(state.unhandledRequests, "Every API call must be explicitly mocked").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
