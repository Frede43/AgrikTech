import { expect, test } from "@playwright/test";
import { API_URL, createE2eSeed, createPhoneNumber, loginViaOtp } from "./auth-utils";

test("driver can pick up and deliver an order", async ({ page, request }) => {
  test.setTimeout(60_000);

  const seed = createE2eSeed();
  const buyerPhone = createPhoneNumber("79", seed);
  const farmerPhone = createPhoneNumber("61", seed);
  const driverPhone = createPhoneNumber("68", seed);

  const buyerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: buyerPhone, role: "buyer", name: "Acheteur Logistique E2E", province: "Bujumbura" },
  });
  expect(buyerResponse.ok()).toBeTruthy();
  const buyer = (await buyerResponse.json()) as { id: number };

  const farmerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: farmerPhone, role: "farmer", name: "Fermier Logistique E2E", province: "Gitega" },
  });
  expect(farmerResponse.ok()).toBeTruthy();
  const farmer = (await farmerResponse.json()) as { id: number };

  const driverResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: driverPhone, role: "driver", name: "Livreur Logistique E2E", province: "Bujumbura" },
  });
  expect(driverResponse.ok()).toBeTruthy();
  const driver = (await driverResponse.json()) as { id: number };

  const productResponse = await request.post(`${API_URL}/products/?farmer_id=${farmer.id}`, {
    data: {
      name: `Haricots Logistique ${seed.slice(-4)}`,
      category: "cereales",
      price_per_kg: 2800,
      unit: "kg",
      quantity_kg: 15,
      min_stock: 3,
      province: "Gitega",
    },
  });
  expect(productResponse.ok()).toBeTruthy();
  const product = (await productResponse.json()) as { id: number; name: string };

  const orderResponse = await request.post(`${API_URL}/orders/?buyer_id=${buyer.id}`, {
    data: {
      product_id: product.id,
      quantity: 2,
    },
  });
  expect(orderResponse.ok()).toBeTruthy();
  const order = (await orderResponse.json()) as { id: number };

  const initialDetailResponse = await request.get(`${API_URL}/orders/${order.id}`);
  expect(initialDetailResponse.ok()).toBeTruthy();
  const initialDetail = (await initialDetailResponse.json()) as {
    status: string;
    pickup_qr: string;
    delivery_otp: string;
    items: Array<{ name: string; qty: number }>;
  };
  expect(initialDetail.status).toBe("pending");

  await loginViaOtp(page, "logistique", driverPhone.replace("+257", ""));

  await expect(page.getByText("Collectes à effectuer")).toBeVisible();
  await expect(page.getByText(product.name)).toBeVisible();

  await page.goto(`/logistique/livraison/${order.id}`);
  await expect(page.locator("main").getByRole("heading", { name: "Détails de livraison", level: 1 })).toBeVisible();
  await expect(page.getByText(`Token de démo: ${initialDetail.pickup_qr}`)).toBeVisible();

  const pickupValidationSection = page.locator("main section").last();
  const pickupInput = pickupValidationSection.getByRole("textbox");
  const pickupActionButton = pickupValidationSection.getByRole("button");
  await pickupInput.fill(initialDetail.pickup_qr);

  let pickupDialogMessage = "";
  page.once("dialog", async (dialog) => {
    pickupDialogMessage = dialog.message();
    await dialog.accept();
  });
  await pickupActionButton.click();
  await page.waitForURL("**/logistique");
  expect(pickupDialogMessage).toContain("Collecte confirmée");

  await expect(page.getByText("Collectes effectuées")).toBeVisible();
  await expect(page.getByText(product.name)).toBeVisible();

  const collectedDetailResponse = await request.get(`${API_URL}/orders/${order.id}`);
  expect(collectedDetailResponse.ok()).toBeTruthy();
  const collectedDetail = (await collectedDetailResponse.json()) as {
    status: string;
    delivery_otp: string;
  };
  expect(collectedDetail.status).toBe("collected");

  await page.goto(`/logistique/livraison/${order.id}`);
  await expect(page.getByText(`OTP de démo: ${collectedDetail.delivery_otp}`)).toBeVisible();

  const deliveryValidationSection = page.locator("main section").last();
  const deliveryInput = deliveryValidationSection.getByRole("textbox");
  const deliveryActionButton = deliveryValidationSection.getByRole("button");
  await deliveryInput.fill(collectedDetail.delivery_otp);

  let deliveryDialogMessage = "";
  page.once("dialog", async (dialog) => {
    deliveryDialogMessage = dialog.message();
    await dialog.accept();
  });
  await deliveryActionButton.click();
  await page.waitForURL("**/logistique");
  expect(deliveryDialogMessage).toContain("Livraison terminée");

  const deliveredDetailResponse = await request.get(`${API_URL}/orders/${order.id}`);
  expect(deliveredDetailResponse.ok()).toBeTruthy();
  const deliveredDetail = (await deliveredDetailResponse.json()) as { status: string };
  expect(deliveredDetail.status).toBe("delivered");

  const logisticsOrdersResponse = await request.get(`${API_URL}/orders/logistics`);
  expect(logisticsOrdersResponse.ok()).toBeTruthy();
  const logisticsOrders = (await logisticsOrdersResponse.json()) as Array<{ id: number }>;
  expect(logisticsOrders.some((item) => item.id === order.id)).toBe(false);

  const farmerTransactionsResponse = await request.get(`${API_URL}/users/${farmer.id}/transactions`);
  expect(farmerTransactionsResponse.ok()).toBeTruthy();
  const farmerTransactions = (await farmerTransactionsResponse.json()) as Array<{
    type: string;
    status: string;
    items: string;
  }>;
  expect(farmerTransactions.some((tx) => tx.type === "sale" && tx.status === "paid" && tx.items === product.name)).toBe(true);
});