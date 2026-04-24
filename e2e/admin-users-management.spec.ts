import { expect, test, type Page } from "@playwright/test";
import { API_URL, createE2eSeed, createPhoneNumber, loginViaOtp } from "./auth-utils";

const userRow = (page: Page, name: string) =>
  page.locator("tbody tr").filter({ hasText: name }).first();

test("admin can consult and filter users", async ({ page, request }) => {
  test.setTimeout(60_000);

  const seed = createE2eSeed();
  const marker = `AdminBatch${seed}`;

  const adminResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("71", seed), role: "admin", name: `Admin ${marker}`, province: "Bujumbura" },
  });
  expect(adminResponse.ok()).toBeTruthy();
  const admin = (await adminResponse.json()) as { id: number };

  const farmerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("61", seed), role: "farmer", name: `Fermier ${marker}`, province: "Ngozi" },
  });
  expect(farmerResponse.ok()).toBeTruthy();
  const farmer = (await farmerResponse.json()) as { id: number; phone_number: string };

  const buyerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("79", seed), role: "buyer", name: `Acheteur ${marker}`, province: "Gitega" },
  });
  expect(buyerResponse.ok()).toBeTruthy();
  const buyer = (await buyerResponse.json()) as { id: number };

  const driverResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("68", seed), role: "driver", name: `Livreur ${marker}`, province: "Kirundo" },
  });
  expect(driverResponse.ok()).toBeTruthy();
  const driver = (await driverResponse.json()) as { id: number };

  await loginViaOtp(page, "admin", `71${seed}`);

  const usersResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/users") && response.request().method() === "GET",
  );

  await page.goto("/admin/utilisateurs");
  await expect(page.getByRole("heading", { name: "Gestion des utilisateurs", level: 1 })).toBeVisible();
  await usersResponsePromise;

  const searchInput = page.getByPlaceholder("Rechercher par nom, téléphone, province...");
  await searchInput.fill(marker);

  await expect(page.getByText("4 utilisateurs affichés")).toBeVisible();
  const farmerRow = userRow(page, `Fermier ${marker}`);
  const buyerRow = userRow(page, `Acheteur ${marker}`);
  const driverRow = userRow(page, `Livreur ${marker}`);
  const adminRow = userRow(page, `Admin ${marker}`);

  await expect(farmerRow).toBeVisible();
  await expect(buyerRow).toBeVisible();
  await expect(driverRow).toBeVisible();
  await expect(adminRow).toBeVisible();

  await page.getByRole("button", { name: /^Fermier\s+\d+$/ }).click();
  await expect(page.getByText("1 utilisateur affiché")).toBeVisible();
  await expect(farmerRow).toBeVisible();
  await expect(farmerRow).toContainText("Ngozi");
  await expect(farmerRow.getByRole("button", { name: "Suspendre" })).toBeVisible();

  const suspendResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith(`/users/${farmer.id}`) && response.request().method() === "PUT",
  );
  await farmerRow.getByRole("button", { name: "Suspendre" }).click();
  await suspendResponsePromise;
  await expect(farmerRow.getByRole("button", { name: "Réactiver" })).toBeVisible();

  const suspendedUsersResponse = await request.get(`${API_URL}/users`);
  expect(suspendedUsersResponse.ok()).toBeTruthy();
  const suspendedUsers = (await suspendedUsersResponse.json()) as Array<{ id: number; is_active: boolean }>;
  expect(suspendedUsers.some((user) => user.id === farmer.id && user.is_active === false)).toBe(true);

  const reactivateResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith(`/users/${farmer.id}`) && response.request().method() === "PUT",
  );
  await farmerRow.getByRole("button", { name: "Réactiver" }).click();
  await reactivateResponsePromise;
  await expect(farmerRow.getByRole("button", { name: "Suspendre" })).toBeVisible();

  const reactivatedUsersResponse = await request.get(`${API_URL}/users`);
  expect(reactivatedUsersResponse.ok()).toBeTruthy();
  const reactivatedUsers = (await reactivatedUsersResponse.json()) as Array<{ id: number; is_active: boolean }>;
  expect(reactivatedUsers.some((user) => user.id === farmer.id && user.is_active === true)).toBe(true);

  await page.getByRole("button", { name: /^Acheteur\s+\d+$/ }).click();
  await expect(page.getByText("1 utilisateur affiché")).toBeVisible();
  await expect(buyerRow).toBeVisible();
  await expect(buyerRow).toContainText("Gitega");

  await page.getByRole("button", { name: /^Livreur\s+\d+$/ }).click();
  await expect(page.getByText("1 utilisateur affiché")).toBeVisible();
  await expect(driverRow).toBeVisible();
  await expect(driverRow).toContainText("Kirundo");

  await page.getByRole("button", { name: /^Tous\s+\d+$/ }).click();
  await expect(page.getByText("4 utilisateurs affichés")).toBeVisible();

  await searchInput.fill(farmer.phone_number);
  await expect(page.getByText("1 utilisateur affiché")).toBeVisible();
  await expect(farmerRow).toBeVisible();

  const allUsersResponse = await request.get(`${API_URL}/users`);
  expect(allUsersResponse.ok()).toBeTruthy();
  const allUsers = (await allUsersResponse.json()) as Array<{
    id: number;
    role: string;
    name: string;
    is_active: boolean;
  }>;

  expect(allUsers.some((user) => user.id === admin.id && user.role === "admin" && user.is_active)).toBe(true);
  expect(allUsers.some((user) => user.id === farmer.id && user.role === "fermier" && user.name === `Fermier ${marker}`)).toBe(true);
  expect(allUsers.some((user) => user.id === buyer.id && user.role === "acheteur" && user.name === `Acheteur ${marker}`)).toBe(true);
  expect(allUsers.some((user) => user.id === driver.id && user.role === "logistique" && user.name === `Livreur ${marker}`)).toBe(true);
});

test("admin can create edit and delete a managed user", async ({ page, request }) => {
  test.setTimeout(60_000);

  const seed = createE2eSeed();
  const marker = `Crud${seed}`;

  const adminResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("72", seed), role: "admin", name: `Admin ${marker}`, province: "Bujumbura" },
  });
  expect(adminResponse.ok()).toBeTruthy();

  await loginViaOtp(page, "admin", `72${seed}`);
  await page.goto("/admin/utilisateurs");
  await expect(page.getByRole("heading", { name: "Gestion des utilisateurs", level: 1 })).toBeVisible();

  const createdName = `Acheteur ${marker}`;
  const updatedName = `Livreur ${marker}`;
  const createdPhone = createPhoneNumber("63", seed);
  const updatedPhone = createPhoneNumber("64", seed);

  const createResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/users/") && response.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Ajouter un utilisateur" }).click();
  await page.getByLabel("Nom complet").fill(createdName);
  await page.getByLabel("Téléphone").fill(createdPhone);
  await page.getByLabel("Province").fill("Gitega");
  await page.getByLabel("Rôle").selectOption("acheteur");
  await page.getByRole("button", { name: "Créer l'utilisateur" }).click();
  await createResponsePromise;

  const searchInput = page.getByPlaceholder("Rechercher par nom, téléphone, province...");
  await searchInput.fill(marker);
  const createdRow = userRow(page, createdName);
  await expect(createdRow).toBeVisible();

  const updateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/users/") &&
      response.request().method() === "PUT" &&
      (response.request().postData()?.includes(updatedPhone) ?? false),
  );

  await createdRow.getByRole("button", { name: `Modifier ${createdName}` }).click();
  await page.getByLabel("Nom complet").fill(updatedName);
  await page.getByLabel("Téléphone").fill(updatedPhone);
  await page.getByLabel("Province").fill("Kirundo");
  await page.getByLabel("Rôle").selectOption("logistique");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await updateResponsePromise;

  const updatedRow = userRow(page, updatedName);
  await expect(updatedRow).toBeVisible();
  await expect(updatedRow).toContainText("Kirundo");

  const allUsersAfterUpdate = await request.get(`${API_URL}/users`);
  expect(allUsersAfterUpdate.ok()).toBeTruthy();
  const updatedUsers = (await allUsersAfterUpdate.json()) as Array<{ name: string; phone_number: string; role: string }>;
  expect(updatedUsers.some((user) => user.name === updatedName && user.phone_number === updatedPhone && user.role === "logistique")).toBe(true);

  const deleteResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/users/") && response.request().method() === "DELETE",
  );

  await updatedRow.getByRole("button", { name: `Supprimer ${updatedName}` }).click();
  await page.getByRole("button", { name: "Confirmer la suppression" }).click();
  await deleteResponsePromise;

  await expect(page.locator("tbody tr").filter({ hasText: updatedName })).toHaveCount(0);

  const allUsersAfterDelete = await request.get(`${API_URL}/users`);
  expect(allUsersAfterDelete.ok()).toBeTruthy();
  const remainingUsers = (await allUsersAfterDelete.json()) as Array<{ name: string; phone_number: string }>;
  expect(remainingUsers.some((user) => user.name === updatedName || user.phone_number === updatedPhone)).toBe(false);
});

test("admin sees linked-user delete refusal without frontend console error", async ({ page, request }) => {
  test.setTimeout(60_000);

  const seed = createE2eSeed();
  const marker = `DeleteGuard${seed}`;
  const adminPhone = createPhoneNumber("73", seed);
  const farmerName = `Fermier Lié ${marker}`;

  const adminResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: adminPhone, role: "admin", name: `Admin ${marker}`, province: "Bujumbura" },
  });
  expect(adminResponse.ok()).toBeTruthy();

  const farmerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("65", seed), role: "farmer", name: farmerName, province: "Ngozi" },
  });
  expect(farmerResponse.ok()).toBeTruthy();
  const farmer = (await farmerResponse.json()) as { id: number };

  const buyerResponse = await request.post(`${API_URL}/users/`, {
    data: { phone_number: createPhoneNumber("74", seed), role: "buyer", name: `Acheteur Lié ${marker}`, province: "Gitega" },
  });
  expect(buyerResponse.ok()).toBeTruthy();
  const buyer = (await buyerResponse.json()) as { id: number };

  const productResponse = await request.post(`${API_URL}/products/?farmer_id=${farmer.id}`, {
    data: {
      name: `Choux ${marker}`,
      category: "legumes",
      price_per_kg: 1800,
      unit: "kg",
      quantity_kg: 12,
      province: "Ngozi",
    },
  });
  expect(productResponse.ok()).toBeTruthy();
  const product = (await productResponse.json()) as { id: number };

  const orderResponse = await request.post(`${API_URL}/orders/?buyer_id=${buyer.id}`, {
    data: {
      product_id: product.id,
      quantity: 2,
    },
  });
  expect(orderResponse.ok()).toBeTruthy();

  const deleteConsoleErrors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      msg.type() === "error"
      && (text.includes("User delete error") || text.includes("Impossible de supprimer cet utilisateur car il possède déjà des données liées."))
    ) {
      deleteConsoleErrors.push(text);
    }
  });

  await loginViaOtp(page, "admin", adminPhone.replace("+257", ""));
  await page.goto("/admin/utilisateurs");
  await expect(page.getByRole("heading", { name: "Gestion des utilisateurs", level: 1 })).toBeVisible();

  const searchInput = page.getByPlaceholder("Rechercher par nom, téléphone, province...");
  await searchInput.fill(marker);

  const linkedRow = userRow(page, farmerName);
  await expect(linkedRow).toBeVisible();

  const deleteResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith(`/users/${farmer.id}`) && response.request().method() === "DELETE",
  );

  await linkedRow.getByRole("button", { name: `Supprimer ${farmerName}` }).click();
  await page.getByRole("button", { name: "Confirmer la suppression" }).click();

  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.status()).toBe(400);

  await expect(page.getByText("Impossible de supprimer cet utilisateur car il possède déjà des données liées.")).toBeVisible();
  await expect(linkedRow).toBeVisible();
  await page.waitForTimeout(200);
  expect(deleteConsoleErrors).toEqual([]);
});