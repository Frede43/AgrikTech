import { expect, test } from "@playwright/test";
import { API_URL, createPhoneDigits, loginViaOtp } from "./auth-utils";

test("buyer login persists a session snapshot and logout clears it", async ({ page, request }) => {
  const phoneDigits = createPhoneDigits("79");
  const fullPhone = `+257${phoneDigits}`;

  const userResponse = await request.post(`${API_URL}/testing/users/`, {
    data: {
      phone_number: fullPhone,
      role: "buyer",
      name: "Acheteur Session Persist",
      province: "Bujumbura",
    },
  });
  expect(userResponse.ok()).toBeTruthy();

  await loginViaOtp(page, "acheteur", phoneDigits);

  await expect
    .poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem("agriconnect_session_snapshot");
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.session?.role ?? null;
    }))
    .toBe("acheteur");

  await page.goto("/deconnexion");
  await expect(page).toHaveURL(/\/$/);

  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem("agriconnect_session_snapshot")))
    .toBeNull();
});