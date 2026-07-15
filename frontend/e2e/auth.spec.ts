import { expect, test } from "./fixtures";

test.describe("authentication UI", () => {
  test("login password can be revealed and hidden accessibly", async ({ page }) => {
    await page.goto("/login");

    const password = page.getByRole("textbox", { name: "Password", exact: true });
    await password.fill("visible-secret");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("registration explains phone privacy and validates passwords before API submission", async ({ page, api }) => {
    await page.goto("/register");

    const phone = page.getByLabel("Phone number");
    await expect(phone).toHaveAttribute("required", "");
    await expect(page.getByText("It stays private unless you enable it for a listing.")).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill("short77");
    await expect(page.getByText("1 more character required")).toBeVisible();

    await page.getByLabel("Full Name").fill("E2E User");
    await page.getByLabel("Email", { exact: true }).fill("e2e@example.test");
    await phone.fill("+60123456789");
    await page.getByLabel("Password", { exact: true }).fill("correct-password");
    await page.getByLabel("Confirm Password").fill("different-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Passwords do not match", { exact: true }).first()).toBeVisible();
    expect(api.registrationRequests).toHaveLength(0);
  });

  test("registration displays server validation and sends the expected phone field", async ({ page, api }) => {
    api.registerStatus = 400;
    api.registerResponse = { message: "Phone number is invalid" };
    await page.goto("/register");

    await page.getByLabel("Full Name").fill("E2E User");
    await page.getByLabel("Email", { exact: true }).fill("e2e@example.test");
    await page.getByLabel("Phone number").fill("+60123456789");
    await page.getByLabel("Password", { exact: true }).fill("correct-password");
    await page.getByLabel("Confirm Password").fill("correct-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Phone number is invalid", { exact: true })).toBeVisible();
    expect(api.registrationRequests).toEqual([
      {
        name: "E2E User",
        email: "e2e@example.test",
        phone: "+60123456789",
        password: "correct-password",
      },
    ]);
  });

  test("all protected routes redirect an anonymous user to login", async ({ page }) => {
    for (const route of ["/create-listing", "/inbox", "/dashboard", "/admin", "/wishlist", "/support"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    }
  });
});
