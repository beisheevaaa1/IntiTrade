import { expect, test } from "./fixtures";

test("category chips update multi-category URL and listing request", async ({ page, api }) => {
  await page.goto("/browse");
  await expect(page.getByText("Deterministic Calculus Textbook", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Textbooks", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("category")).toBe("textbooks");

  await page.getByRole("button", { name: "Electronics", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("category")).toBe("textbooks,electronics");
  await expect(page.getByText("Category: Textbooks", { exact: false })).toBeVisible();
  await expect(page.getByText("Category: Electronics", { exact: false })).toBeVisible();

  await expect.poll(() => api.listingQueries.some((query) => query.get("category") === "textbooks,electronics")).toBe(true);

  const textbooksBadge = page.getByText("Category: Textbooks", { exact: false });
  await textbooksBadge.getByRole("button").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("category")).toBe("electronics");
});
