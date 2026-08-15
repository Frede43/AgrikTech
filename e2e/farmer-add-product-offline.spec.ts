import { expect, test } from "@playwright/test";
import { API_URL, createE2eSeed, createPhoneNumber, loginViaOtp } from "./auth-utils";

test("farmer product creation is queued offline then replayed when network returns", async ({ page, request }) => {
  test.setTimeout(60_000);

  const seed = createE2eSeed();
  const farmerPhone = createPhoneNumber("61", seed);

  const farmerResponse = await request.post(`${API_URL}/testing/users/`, {
    data: { phone_number: farmerPhone, role: "farmer", name: "Fermier Offline E2E", province: "Ngozi" },
  });
  expect(farmerResponse.ok()).toBeTruthy();
  const farmer = (await farmerResponse.json()) as { id: number };

  await loginViaOtp(page, "fermier", farmerPhone.replace("+257", ""));
  const profileResponsePromise = page.waitForResponse(
    (response) => response.url().includes(`/users/${farmer.id}`) && response.request().method() === "GET",
  );
  await page.goto("/produits/ajouter");
  await expect(page.getByRole("heading", { name: "Ajouter une récolte", level: 1 })).toBeVisible();
  await profileResponsePromise;

  await page.context().setOffline(true);

  const productName = `Haricots Offline ${seed.slice(-4)}`;
  await page.getByLabel(/Nom du produit/i).fill(productName);
  await page.getByRole("combobox", { name: "Catégorie *" }).click();
  await page.getByRole("option", { name: "Légumes" }).click();
  await page.getByLabel(/^Prix/i).fill("2800");
  await page.getByLabel(/Quantité disponible/i).fill("18");

  await page.getByRole("button", { name: /Mettre en vente/i }).click();

  await expect(page.getByRole("heading", { name: "Produit mis en attente hors ligne !" })).toBeVisible();

  const queuedBeforeReplay = await page.evaluate(() => {
    const raw = window.localStorage.getItem("agriconnect-offline-product-queue");
    return raw ? JSON.parse(raw) : [];
  });
  expect(queuedBeforeReplay).toHaveLength(1);
  expect(queuedBeforeReplay[0]?.payload?.name).toBe(productName);

  const replayResponsePromise = page.waitForResponse(
    (response) => response.url().includes(`/products/?farmer_id=${farmer.id}`) && response.request().method() === "POST",
  );

  await page.context().setOffline(false);
  await page.reload();
  await replayResponsePromise;

  await expect.poll(async () => page.evaluate(() => {
    const raw = window.localStorage.getItem("agriconnect-offline-product-queue");
    return raw ? JSON.parse(raw).length : 0;
  })).toBe(0);

  const farmerProductsResponse = await request.get(`${API_URL}/products/?farmer_id=${farmer.id}`);
  expect(farmerProductsResponse.ok()).toBeTruthy();
  const farmerProducts = (await farmerProductsResponse.json()) as Array<{ name: string }>;
  expect(farmerProducts.some((product) => product.name === productName)).toBeTruthy();
});