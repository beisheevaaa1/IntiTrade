import { expect, test } from "./fixtures";

test("wishlist renders a moderated listing safely and still lets the user remove it", async ({ page, api }) => {
  api.authenticated = true;
  api.favorites = [{
    id: "favorite-e2e-1",
    listingId: "listing-pending-e2e-1",
    listing: {
      id: "listing-pending-e2e-1",
      title: "Listing unavailable",
      status: "PENDING",
      price: null,
      images: [],
      unavailable: true,
      isSnapshot: false,
    },
  }];

  await page.goto("/wishlist");

  await expect(page.getByTestId("unavailable-favorite")).toBeVisible();
  await expect(page.getByText("This listing is awaiting moderation and cannot be opened right now.")).toBeVisible();
  await expect(page.locator('a[href="/product/listing-pending-e2e-1"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Remove from saved" }).click();
  await expect(page.getByText("Your wishlist is empty.")).toBeVisible();
  expect(api.favoriteDeletes).toEqual(["listing-pending-e2e-1"]);
});

test("inbox presents an approved snapshot as unavailable and caps auto-reply delay", async ({ page, api }) => {
  api.authenticated = true;
  api.conversations = [{
    id: "conversation-e2e-1",
    listingId: "listing-snapshot-e2e-1",
    buyerId: "user-e2e-1",
    sellerId: "seller-e2e-1",
    updatedAt: "2026-07-15T08:00:00.000Z",
    buyer: {
      id: "user-e2e-1",
      name: "Support Tester",
      avatarUrl: null,
      lastActiveAt: null,
      showOnlineStatus: true,
    },
    seller: {
      id: "seller-e2e-1",
      name: "Snapshot Seller",
      avatarUrl: null,
      lastActiveAt: null,
      showOnlineStatus: true,
    },
    messages: [],
    listing: {
      id: "listing-snapshot-e2e-1",
      title: "Previously approved calculator",
      description: "The last version approved by moderation.",
      price: "25.00",
      type: "PRODUCT",
      condition: "GOOD",
      status: "PENDING",
      location: "Main Campus",
      sellerId: "seller-e2e-1",
      categoryId: "category-electronics",
      createdAt: "2026-07-01T08:00:00.000Z",
      images: [],
      transactions: [],
      unavailable: true,
      isSnapshot: true,
    },
  }];

  await page.goto("/inbox");
  await page.getByTitle("Chat & Profile Settings").click();
  await page.getByLabel("Enable Auto-Reply").check();
  const delay = page.getByLabel("Response Delay (seconds)");
  await expect(delay).toHaveAttribute("max", "1440");
  await delay.fill("2000");
  await expect(delay).toHaveValue("1440");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Save Configuration" }).click();
  await expect.poll(() => api.profileRequests.length).toBe(1);
  expect(api.profileRequests[0].autoReplyDelay).toBe(1440);

  await page.getByText("Previously approved calculator", { exact: true }).click();
  await expect(page.getByText("Pending moderation", { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/product/listing-snapshot-e2e-1"]')).toHaveCount(0);
});
