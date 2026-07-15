import { expect, test } from "./fixtures";

test("an administrator can inspect system health and the audit log", async ({ page, api }) => {
  api.authenticated = true;
  api.adminAuthenticated = true;

  await page.goto("/admin?tab=system");
  await expect(page.getByRole("heading", { name: "System Health" })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByText("120", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Audit Log" }).click();
  await expect(page.getByRole("heading", { name: "Administrator Audit Log" })).toBeVisible();
  await expect(page.getByText("LISTING_ACTIVE", { exact: true })).toBeVisible();
  await expect(page.getByText("admin@example.test", { exact: true })).toBeVisible();
});
