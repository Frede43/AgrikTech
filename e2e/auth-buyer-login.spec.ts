import { expect, test } from "@playwright/test";
import { API_URL, createPhoneDigits, loginViaOtp } from "./auth-utils";

test("buyer can log in with OTP and reach the buyer home", async ({ page, request }) => {
  const phoneDigits = createPhoneDigits("79");
  const fullPhone = `+257${phoneDigits}`;

  const userResponse = await request.post(`${API_URL}/testing/users/`, {
    data: {
      phone_number: fullPhone,
      role: "buyer",
      name: "Acheteur E2E",
      province: "Bujumbura",
    },
  });
  expect(userResponse.ok()).toBeTruthy();

  await loginViaOtp(page, "acheteur", phoneDigits);

  await expect(page).toHaveURL(/\/acheteur$/);
  await expect(page.getByRole("heading", { name: /Que souhaitez-vous commander aujourd'hui \?/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Catégories" })).toBeVisible();
});