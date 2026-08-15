import { expect, test } from "@playwright/test";
import { API_URL, createE2eSeed, createPhoneNumber, loginViaOtp } from "./auth-utils";

test("buyer can add a product to cart and place an order", async ({ page, request }) => {
  const seed = createE2eSeed();
  const buyerPhone = createPhoneNumber("79", seed);
  const farmerPhone = createPhoneNumber("61", seed);

  const buyerResponse = await request.post(`${API_URL}/testing/users/`, {
    data: { phone_number: buyerPhone, role: "buyer", name: "Acheteur Checkout E2E", province: "Bujumbura" },
  });
  expect(buyerResponse.ok()).toBeTruthy();
  const buyer = (await buyerResponse.json()) as { id: number };

  const farmerResponse = await request.post(`${API_URL}/testing/users/`, {
    data: { phone_number: farmerPhone, role: "farmer", name: "Fermier Checkout E2E", province: "Gitega" },
  });
  expect(farmerResponse.ok()).toBeTruthy();
  const farmer = (await farmerResponse.json()) as { id: number };

  const productResponse = await request.post(`${API_URL}/testing/products/?farmer_id=${farmer.id}`, {
    data: {
      name: `Tomates Checkout ${seed.slice(-4)}`,
      category: "legumes",
      price_per_kg: 3200,
      unit: "kg",
      quantity_kg: 10,
      min_stock: 2,
      province: "Gitega",
    },
  });
  expect(productResponse.ok()).toBeTruthy();
  const product = (await productResponse.json()) as { id: number; name: string; quantity_kg: number };

  await loginViaOtp(page, "acheteur", buyerPhone.replace("+257", ""));

  await page.goto(`/acheteur/produit/${product.id}`);
  await expect(page.locator("main").getByRole("heading", { name: product.name, level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("button", { name: "Ajouté au panier !" })).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem("agriconnect_cart");
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed.length : parsed?.items?.length ?? 0;
    }))
    .toBe(1);

  await expect
    .poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem("agriconnect_cart");
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.version ?? null;
    }))
    .toBe(1);

  await page.goto("/acheteur/panier");
  await expect(page.locator("main").getByRole("heading", { name: "Mon Panier", level: 1 })).toBeVisible();
  await expect(page.getByText(product.name, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Procéder au paiement" }).click();
  await expect(page.locator("main").getByRole("heading", { name: "Paiement & Livraison", level: 1 })).toBeVisible();

  const orderResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/orders/") && response.request().method() === "POST",
  );

  await page.getByPlaceholder("Ex: Avenue du Lac, Bujumbura, Rohero I").fill("Avenue du Lac, Bujumbura, Rohero I");
  await page.locator('input[type="tel"]').fill("79123456");
  await page.getByRole("button", { name: /Payer .* via/i }).click();

  const createdOrder = (await (await orderResponsePromise).json()) as { id: number };

  await expect(page.getByRole("heading", { name: "Paiement confirmé !" })).toBeVisible();
  await expect(page.getByText(/Votre commande a été transmise aux fermiers/i)).toBeVisible();

  const orderDetailResponse = await request.get(`${API_URL}/testing/orders/${createdOrder.id}`);
  expect(orderDetailResponse.ok()).toBeTruthy();
  const orderDetail = (await orderDetailResponse.json()) as {
    status: string;
    items: Array<{ name: string; qty: number }>;
  };
  expect(orderDetail.status).toBe("paid_escrow");
  expect(orderDetail.items[0]?.qty).toBe(1);
  expect(orderDetail.items[0]?.name).toBe(product.name);

  const updatedProductResponse = await request.get(`${API_URL}/products/${product.id}`);
  expect(updatedProductResponse.ok()).toBeTruthy();
  const updatedProduct = (await updatedProductResponse.json()) as { quantity_kg: number };
  expect(updatedProduct.quantity_kg).toBe(product.quantity_kg - 1);
});