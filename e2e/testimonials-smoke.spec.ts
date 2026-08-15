import { expect, test } from "@playwright/test";
import { API_URL, createE2eSeed, createPhoneDigits, loginViaOtp } from "./auth-utils";

test("buyer submits testimonial, admin approves it, and home displays it", async ({ page, request }) => {
  test.setTimeout(90_000);

  const seed = createE2eSeed();
  const buyerDigits = createPhoneDigits("79", seed);
  const adminDigits = createPhoneDigits("71", seed);
  const buyerPhone = `+257${buyerDigits}`;
  const adminPhone = `+257${adminDigits}`;
  const quote = `SMOKE TEST TEMOIGNAGE UI ${seed}`;
  const adminNote = `Validation smoke test UI ${seed}`;

  const buyerResponse = await request.post(`${API_URL}/testing/users/`, {
    data: {
      phone_number: buyerPhone,
      role: "buyer",
      name: `Acheteur Smoke ${seed}`,
      province: "Bujumbura",
      address: "Rohero",
      commune: "Mukaza",
    },
  });
  expect(buyerResponse.ok()).toBeTruthy();

  const adminResponse = await request.post(`${API_URL}/testing/users/`, {
    data: {
      phone_number: adminPhone,
      role: "admin",
      name: `Admin Smoke ${seed}`,
      province: "Bujumbura",
    },
  });
  expect(adminResponse.ok()).toBeTruthy();

  await loginViaOtp(page, "acheteur", buyerDigits);

  const buyerListPromise = page.waitForResponse(
    (response) => response.url().endsWith("/testimonials/me") && response.request().method() === "GET",
  );
  await page.goto("/acheteur/temoignages");
  await expect(page.getByRole("heading", { name: "Mes témoignages", level: 1 })).toBeVisible();
  await buyerListPromise;

  await page.locator("select").selectOption("5");
  await page.getByPlaceholder(/Décrivez en quelques lignes/i).fill(quote);

  const submitPromise = page.waitForResponse(
    (response) => response.url().endsWith("/testimonials") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Envoyer pour validation" }).click();
  await submitPromise;

  await expect(page.getByText("Votre témoignage a bien été envoyé en attente de validation.")).toBeVisible();
  await expect(page.getByText(`“${quote}”`)).toBeVisible();
  await expect(page.getByText("En attente", { exact: true })).toBeVisible();

  const publicBefore = (await (await request.get(`${API_URL}/testimonials`)).json()) as Array<{ quote_fr?: string }>;
  expect(publicBefore.some((item) => item.quote_fr === quote)).toBe(false);

  await page.goto("/deconnexion");
  await expect(page).toHaveURL(/\/$/);

  await loginViaOtp(page, "admin", adminDigits);

  const adminListPromise = page.waitForResponse(
    (response) => response.url().endsWith("/admin/testimonials") && response.request().method() === "GET",
  );
  await page.goto("/admin/temoignages");
  await expect(page.getByRole("heading", { name: "Validation des témoignages", level: 1 })).toBeVisible();
  await adminListPromise;

  await page.getByPlaceholder(/Rechercher par ID, auteur, localisation ou contenu/i).fill(quote);
  await expect(page.getByText(`“${quote}”`)).toBeVisible();
  await page.getByPlaceholder(/Note admin optionnelle/i).fill(adminNote);

  const approvePromise = page.waitForResponse(
    (response) => /\/admin\/testimonials\/\d+\/approve$/.test(response.url()) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Approuver et publier" }).click();
  await approvePromise;

  await expect(page.getByText("Approuvé")).toBeVisible();
  await expect(page.getByText(adminNote)).toBeVisible();

  const publicAfter = (await (await request.get(`${API_URL}/testimonials`)).json()) as Array<{ quote_fr?: string }>;
  expect(publicAfter.some((item) => item.quote_fr === quote)).toBe(true);

  const homeTestimonialsPromise = page.waitForResponse(
    (response) => response.url().endsWith("/testimonials") && response.request().method() === "GET",
  );
  await page.goto("/");
  await homeTestimonialsPromise;
  await expect(page.getByText(quote).first()).toBeVisible();
});