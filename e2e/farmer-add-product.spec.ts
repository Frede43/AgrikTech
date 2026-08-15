import { expect, test } from "@playwright/test";
import { API_URL, createE2eSeed, createPhoneNumber, loginViaOtp } from "./auth-utils";

test("farmer can add a product from the UI", async ({ page, request }) => {
  test.setTimeout(60_000);

  const seed = createE2eSeed();
  const farmerPhone = createPhoneNumber("61", seed);

  const farmerResponse = await request.post(`${API_URL}/testing/users/`, {
    data: { phone_number: farmerPhone, role: "farmer", name: "Fermier Produit E2E", province: "Ngozi" },
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

  const productName = `Maïs Fermier ${seed.slice(-4)}`;
  await page.getByLabel(/Nom du produit/i).fill(productName);
  await page.getByRole("combobox", { name: "Catégorie *" }).click();
  await page.getByRole("option", { name: "Céréales" }).click();
  await page.getByLabel(/Date de récolte/i).fill("2026-03-01");
  await page.getByLabel(/^Prix/i).fill("3400");
  await page.getByLabel(/Quantité disponible/i).fill("42");

  const createProductResponsePromise = page.waitForResponse(
    (response) => response.url().includes(`/products/?farmer_id=${farmer.id}`) && response.request().method() === "POST",
  );

  await page.getByRole("button", { name: /Mettre en vente/i }).click();

  const createdProduct = (await (await createProductResponsePromise).json()) as {
    id: number;
    name: string;
    category: string;
    price_per_kg: number;
    quantity_kg: number;
    unit: string;
    province: string;
    farmer_id: number;
  };

  await expect(page.getByRole("heading", { name: "Produit ajouté !" })).toBeVisible();
  expect(createdProduct.name).toBe(productName);
  expect(createdProduct.category).toBe("cereales");
  expect(Number(createdProduct.price_per_kg)).toBe(3400);
  expect(createdProduct.quantity_kg).toBe(42);
  expect(createdProduct.unit).toBe("kg");
  expect(createdProduct.province).toBe("Ngozi");
  expect(createdProduct.farmer_id).toBe(farmer.id);

  const farmerProductsResponse = await request.get(`${API_URL}/products/?farmer_id=${farmer.id}`);
  expect(farmerProductsResponse.ok()).toBeTruthy();
  const farmerProducts = (await farmerProductsResponse.json()) as Array<{
    id: number;
    name: string;
    category: string;
    price_per_kg: number;
    quantity_kg: number;
    province: string;
  }>;
  const listedProduct = farmerProducts.find((product) => product.id === createdProduct.id);
  expect(listedProduct).toBeTruthy();
  expect(listedProduct?.name).toBe(productName);
  expect(listedProduct?.category).toBe("cereales");
  expect(Number(listedProduct?.price_per_kg)).toBe(3400);
  expect(listedProduct?.quantity_kg).toBe(42);
  expect(listedProduct?.province).toBe("Ngozi");

  const productDetailResponse = await request.get(`${API_URL}/products/${createdProduct.id}`);
  expect(productDetailResponse.ok()).toBeTruthy();
  const productDetail = (await productDetailResponse.json()) as {
    farmer_id: number;
    name: string;
    category: string;
    quantity_kg: number;
  };
  expect(productDetail.farmer_id).toBe(farmer.id);
  expect(productDetail.name).toBe(productName);
  expect(productDetail.category).toBe("cereales");
  expect(productDetail.quantity_kg).toBe(42);
});