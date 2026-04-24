import { expect, test, type APIRequestContext } from "@playwright/test";
import { API_URL, createE2eSeed, createPhoneDigits, createPhoneNumber, loginViaOtp } from "./auth-utils";

async function seedCollectedOrder(request: APIRequestContext) {
  const seed = createE2eSeed();

  const buyerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("79", seed), role: "buyer", name: `Acheteur Guard ${seed}`, province: "Bujumbura" },
  });
  expect(buyerResponse.ok()).toBeTruthy();
  const buyer = await buyerResponse.json() as { id: number };

  const farmerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("61", seed), role: "farmer", name: `Fermier Guard ${seed}`, province: "Gitega" },
  });
  expect(farmerResponse.ok()).toBeTruthy();
  const farmer = await farmerResponse.json() as { id: number };

  const driverResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("68", seed), role: "driver", name: `Livreur Guard ${seed}`, province: "Ngozi" },
  });
  expect(driverResponse.ok()).toBeTruthy();
  const driver = await driverResponse.json() as { id: number };

  const productResponse = await request.post(`${API_URL}/products/?farmer_id=${farmer.id}`, {
    data: {
      name: `Haricots Guard ${seed}`,
      category: "cereales",
      price_per_kg: 2400,
      unit: "kg",
      quantity_kg: 12,
      province: "Gitega",
    },
  });
  expect(productResponse.ok()).toBeTruthy();
  const product = await productResponse.json() as { id: number; name: string };

  const orderResponse = await request.post(`${API_URL}/orders/?buyer_id=${buyer.id}`, {
    data: { product_id: product.id, quantity: 2 },
  });
  expect(orderResponse.ok()).toBeTruthy();
  const order = await orderResponse.json() as { id: number };

  const detailResponse = await request.get(`${API_URL}/orders/${order.id}`);
  expect(detailResponse.ok()).toBeTruthy();
  const detail = await detailResponse.json() as { pickup_qr: string };

  const pickupResponse = await request.post(
    `${API_URL}/orders/${order.id}/pickup?qr_token=${encodeURIComponent(detail.pickup_qr)}&driver_id=${driver.id}`,
  );
  expect(pickupResponse.ok()).toBeTruthy();

  return { buyer, farmer, driver, product, order, driverPhoneDigits: createPhoneDigits("68", seed) };
}

test("login keeps the user on OTP step when the code is invalid", async ({ page, request }) => {
  const phoneDigits = createPhoneDigits("79");
  const fullPhone = `+257${phoneDigits}`;

  const userResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: fullPhone, role: "buyer", name: "Acheteur OTP Invalide", province: "Bujumbura" },
  });
  expect(userResponse.ok()).toBeTruthy();

  await page.goto("/connexion?role=acheteur");

  const otpResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/auth/request-otp") && response.request().method() === "POST",
  );

  await page.getByRole("textbox").first().fill(phoneDigits);
  await page.getByRole("button", { name: "Recevoir le code SMS" }).click();
  await otpResponsePromise;

  await expect(page.getByRole("heading", { name: "Code de vérification" })).toBeVisible();
  await page.getByRole("textbox").fill("0000");
  await page.getByRole("button", { name: "Valider le code" }).click();

  await expect(page).toHaveURL(/\/connexion\?role=acheteur$/);
  await expect(page.getByText("Code OTP invalide ou expiré")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Code de vérification" })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "agriconnect_session")).toBe(false);
});

test("driver cannot complete delivery with a wrong OTP", async ({ page, request }) => {
  test.setTimeout(60_000);

  const { farmer, order, driverPhoneDigits } = await seedCollectedOrder(request);

  await loginViaOtp(page, "logistique", driverPhoneDigits);

  await page.goto(`/logistique/livraison/${order.id}`);
  await expect(page.locator("main").getByRole("heading", { name: "Détails de livraison", level: 1 })).toBeVisible();

  const validationSection = page.locator("main section").last();
  const deliveryInput = validationSection.getByRole("textbox");
  const deliveryActionButton = validationSection.getByRole("button");
  await deliveryInput.fill("0000");

  let dialogMessage = "";
  page.once("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });
  await deliveryActionButton.click();
  await expect.poll(() => dialogMessage).toContain("Code OTP de livraison invalide");

  await expect(page).toHaveURL(new RegExp(`/logistique/livraison/${order.id}$`));

  const orderDetailResponse = await request.get(`${API_URL}/orders/${order.id}`);
  expect(orderDetailResponse.ok()).toBeTruthy();
  const orderDetail = (await orderDetailResponse.json()) as { status: string };
  expect(orderDetail.status).toBe("collected");

  const farmerResponse = await request.get(`${API_URL}/users/${farmer.id}`);
  expect(farmerResponse.ok()).toBeTruthy();
  const farmerPayload = (await farmerResponse.json()) as { balance: number };
  expect(farmerPayload.balance).toBe(0);

  const transactionsResponse = await request.get(`${API_URL}/users/${farmer.id}/transactions`);
  expect(transactionsResponse.ok()).toBeTruthy();
  const transactions = (await transactionsResponse.json()) as Array<{
    id: string;
    order_id: number | null;
    status: string;
    type: string;
  }>;
  const orderTransaction = transactions.find((transaction) => transaction.order_id === order.id);
  expect(orderTransaction).toBeTruthy();
  expect(orderTransaction?.type).toBe("sale");
  expect(orderTransaction?.status).toBe("pending");
  expect(transactions.some((transaction) => transaction.order_id === order.id && transaction.status === "paid")).toBe(false);
});

test("protected spaces redirect to the role-specific login when the session role is wrong", async ({ page, request }) => {
  test.setTimeout(90_000);

  const seed = createE2eSeed();
  const buyerPhoneDigits = createPhoneDigits("79", seed);
  const adminPhoneDigits = createPhoneDigits("71", seed);
  const driverPhoneDigits = createPhoneDigits("68", seed);

  const buyerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: `+257${buyerPhoneDigits}`, role: "buyer", name: `Acheteur Redirect ${seed}`, province: "Bujumbura" },
  });
  expect(buyerResponse.ok()).toBeTruthy();

  const adminResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: `+257${adminPhoneDigits}`, role: "admin", name: `Admin Redirect ${seed}`, province: "Gitega" },
  });
  expect(adminResponse.ok()).toBeTruthy();

  const driverResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: `+257${driverPhoneDigits}`, role: "driver", name: `Livreur Redirect ${seed}`, province: "Ngozi" },
  });
  expect(driverResponse.ok()).toBeTruthy();

  await loginViaOtp(page, "acheteur", buyerPhoneDigits);

  await page.goto("/admin/utilisateurs");
  await expect(page).toHaveURL(/\/connexion\?role=admin$/);
  await expect(page.getByRole("heading", { name: "Connexion Admin" })).toBeVisible();

  await loginViaOtp(page, "admin", adminPhoneDigits);

  await page.goto("/logistique");
  await expect(page).toHaveURL(/\/connexion\?role=logistique$/);
  await expect(page.getByRole("heading", { name: "Connexion Livreur" })).toBeVisible();

  await loginViaOtp(page, "logistique", driverPhoneDigits);

  await page.goto("/fermier");
  await expect(page).toHaveURL(/\/connexion\?role=fermier$/);
  await expect(page.getByRole("heading", { name: "Connexion Fermier" })).toBeVisible();
});