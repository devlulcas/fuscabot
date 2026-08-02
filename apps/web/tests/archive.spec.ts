import { expect, test } from "@playwright/test";

test("archive navigation, filtering, detail, and theme remain functional", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.getByRole("heading", { name: "Fuscabot Archive" })).toBeVisible();
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByLabel("Search the archive").fill("useful");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/q=useful/);
  await page.getByRole("link", { name: "A useful link" }).click();
  await expect(page.getByRole("heading", { name: "A useful link" })).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("locale negotiation and API forwarding preserve request semantics", async ({ browser, request }) => {
  const localizedContext = await browser.newContext({ locale: "pt-BR" });
  const localized = await localizedContext.newPage();
  await localized.goto("/");
  await expect(localized).toHaveURL(/\/pt-br\/$/);
  await localizedContext.close();

  const response = await request.post("/v1/__e2e__/echo?mode=smoke", {
    headers: { authorization: "Bearer extension-token" },
    data: "payload",
  });
  expect(response.status()).toBe(202);
  expect(response.headers()["x-api-fixture"]).toBe("true");
  expect(await response.json()).toEqual({
    method: "POST",
    query: "?mode=smoke",
    body: "payload",
    authorization: "Bearer extension-token",
  });
  expect((await request.get("/health")).status()).toBe(200);
});
