import { expect, test } from "./fixtures";

test("opening a product resets scroll and the in-page Back button restores the previous route", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByText("Deterministic Calculus Textbook", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    document.body.style.minHeight = "3000px";
    window.scrollTo(0, 1800);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

  await page.getByRole("link", { name: "Deterministic Calculus Textbook", exact: true }).last().click();
  await expect(page).toHaveURL(/\/product\/listing-e2e-1$/);
  await expect(page.getByRole("heading", { name: "Deterministic Calculus Textbook" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/browse$/);
});
