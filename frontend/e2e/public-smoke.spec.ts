import { expect, test } from "./fixtures";

test.describe("public marketplace smoke", () => {
  test("home page renders its primary public journey", async ({ page }, testInfo) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Buy and Sell Safely Within the INTI Community/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore Listings" })).toHaveAttribute("href", "/browse");
    await expect(page.getByRole("heading", { name: "Fresh on Campus" })).toBeVisible();
    await expect(page.getByText("Deterministic Calculus Textbook", { exact: true })).toBeVisible();

    const searchPlaceholder = testInfo.project.name.startsWith("mobile")
      ? "Search items..."
      : "Search for textbooks, furniture...";
    await expect(page.getByPlaceholder(searchPlaceholder)).toBeVisible();

    const hasPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasPageOverflow, "The public home must not overflow horizontally").toBe(false);
  });

  test("public browse page renders results without authentication", async ({ page }) => {
    await page.goto("/browse");

    await expect(page.getByText("Deterministic Calculus Textbook", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "All Categories", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/browse$/);
  });
});
