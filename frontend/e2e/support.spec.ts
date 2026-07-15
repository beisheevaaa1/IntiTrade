import { expect, test } from "./fixtures";

test("an authenticated user can create a private support request", async ({ page, api }) => {
  api.authenticated = true;

  await page.goto("/support");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("marketplace_token"))).toBeNull();
  await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
  await expect(page.getByText("Only you and the support team can see it.")).toBeVisible();

  await page.getByLabel("What do you need help with?").selectOption("TECHNICAL");
  await page.getByLabel("Subject").fill("Mobile listing problem");
  await page.getByLabel("Details").fill("The listing page does not behave as expected on my phone.");
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByRole("status")).toContainText("Your request was sent");
  expect(api.supportRequests).toEqual([{
    category: "TECHNICAL",
    subject: "Mobile listing problem",
    description: "The listing page does not behave as expected on my phone."
  }]);
});
