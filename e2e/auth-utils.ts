import { expect, type Page } from "@playwright/test";
import { PLAYWRIGHT_API_URL } from "./test-config";

export const API_URL = PLAYWRIGHT_API_URL;

const SESSION_COOKIE_NAME = "agriconnect_session";
let e2eSeedSequence = 0;

type LoginRole = "acheteur" | "fermier" | "logistique" | "admin";

const ROLE_HOME_PATHS: Record<LoginRole, string> = {
  acheteur: "/acheteur",
  fermier: "/fermier",
  logistique: "/logistique",
  admin: "/admin",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createE2eSeed() {
  e2eSeedSequence = (e2eSeedSequence + 1) % 100;
  const base = (Date.now() + Math.floor(Math.random() * 10_000) + e2eSeedSequence) % 1_000_000;
  return String(base).padStart(6, "0");
}

export function createPhoneDigits(prefix: string, seed = createE2eSeed()) {
  if (!/^[0-9]{2}$/.test(prefix)) {
    throw new Error(`Expected a 2-digit Burundi phone prefix, received "${prefix}".`);
  }

  if (!/^[0-9]{6}$/.test(seed)) {
    throw new Error(`Expected a 6-digit test seed, received "${seed}".`);
  }

  return `${prefix}${seed}`;
}

export function createPhoneNumber(prefix: string, seed = createE2eSeed()) {
  return `+257${createPhoneDigits(prefix, seed)}`;
}

export async function loginViaOtp(page: Page, role: LoginRole, phoneDigits: string, expectedPath = ROLE_HOME_PATHS[role]) {
  if (!/^[0-9]{8}$/.test(phoneDigits)) {
    throw new Error(`Expected an 8-digit Burundi phone number, received "${phoneDigits}".`);
  }

  await page.goto(`/connexion?role=${role}`);

  const otpResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/auth/request-otp") && response.request().method() === "POST",
  );

  await page.getByRole("textbox").first().fill(phoneDigits);
  await page.getByRole("button", { name: "Recevoir le code SMS" }).click();

  const otpPayload = (await (await otpResponsePromise).json()) as { mock_otp: string };

  await expect(page.getByRole("heading", { name: "Code de vérification" })).toBeVisible();
  await page.getByRole("textbox").fill(otpPayload.mock_otp);

  await page.getByRole("button", { name: "Valider le code" }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(expectedPath)}(?:\\?.*)?$`));

  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === SESSION_COOKIE_NAME)).toBeTruthy();
}