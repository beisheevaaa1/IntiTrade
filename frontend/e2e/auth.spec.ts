import { expect, test } from "./fixtures";

test.describe("authentication UI", () => {
  test("login password can be revealed and hidden accessibly", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("INTI account")).toHaveAttribute("placeholder", "i00008872@student.newinti.edu.my");
    await expect(page.getByText("You can also enter only your student ID, for example i00008872.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Check Email Verification" })).toBeVisible();

    const password = page.getByRole("textbox", { name: "Password", exact: true });
    await password.fill("visible-secret");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("admin login password can be revealed and hidden accessibly", async ({ page }) => {
    await page.goto("/admin/login");

    const password = page.getByRole("textbox", { name: "Security Password" });
    await password.fill("admin-visible-secret");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("verification page can request a new email for an INTI account", async ({ page, api }) => {
    await page.goto("/verify-email?email=i00008872");

    await expect(page.getByRole("heading", { name: "Verify your account" })).toBeVisible();
    await expect(page.getByLabel("INTI account email")).toHaveValue("i00008872");
    await page.getByRole("button", { name: "Check Email Verification" }).click();

    await expect(page.getByText("If the account requires verification, a new code has been generated.")).toBeVisible();
    await expect(page.getByText("482731", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Verification Code")).toHaveValue("");
    expect(api.resendVerificationRequests).toEqual([{ email: "i00008872" }]);
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
    await page.getByLabel("Faculty *").selectOption("Faculty of Data Science and Information Technology (FDSIT)");
    await phone.fill("+60123456789");
    await page.getByLabel("Password", { exact: true }).fill("correct-password");
    await page.getByLabel("Confirm Password").fill("different-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Passwords do not match", { exact: true }).first()).toBeVisible();
    expect(api.registrationRequests).toHaveLength(0);
  });

  test("registration displays the generated demo verification code", async ({ page, api }) => {
    api.registerStatus = 201;
    api.registerResponse = {
      requiresVerification: true,
      verificationToken: "482731",
      verificationCode: "482731",
    };
    await page.goto("/register");

    await page.getByLabel("Full Name").fill("E2E User");
    await page.getByLabel("Email", { exact: true }).fill("e2e@example.test");
    await page.getByLabel("Faculty *").selectOption("Faculty of Data Science and Information Technology (FDSIT)");
    await page.getByLabel("Phone number").fill("+60123456789");
    await page.getByLabel("Password", { exact: true }).fill("correct-password");
    await page.getByLabel("Confirm Password").fill("correct-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Verify your account" })).toBeVisible();
    await expect(page.getByText("482731", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Enter Verification Page Now/ })).toHaveAttribute(
      "href",
      "/verify-email?email=e2e%40example.test",
    );
  });

  test("registration displays server validation and sends the expected phone field", async ({ page, api }) => {
    api.registerStatus = 400;
    api.registerResponse = { message: "Phone number is invalid" };
    await page.goto("/register");

    await page.getByLabel("Full Name").fill("E2E User");
    await page.getByLabel("Email", { exact: true }).fill("e2e@example.test");
    await page.getByLabel("Faculty *").selectOption("Faculty of Data Science and Information Technology (FDSIT)");
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
        accountType: "STUDENT",
        faculty: "Faculty of Data Science and Information Technology (FDSIT)",
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

  test("an authenticated student cannot mount the administrator route", async ({ page, api }) => {
    api.authenticated = true;

    await page.goto("/admin");

    await expect(page).toHaveURL(/\/browse$/);
    await expect(page.getByRole("heading", { name: "Admin Control Panel" })).toHaveCount(0);
  });

  test("dashboard labels admin accounts as administrators", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "The dashboard profile summary is hidden in the mobile layout.");
    api.authenticated = true;
    api.adminAuthenticated = true;

    await page.goto("/dashboard");

    await expect(page.getByText("Admin Tester")).toBeVisible();
    await expect(page.getByText("Administrator")).toBeVisible();
    await expect(page.getByText("admin@student.newinti.edu.my")).toBeVisible();
  });
});
