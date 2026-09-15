import { test, expect } from "@playwright/test";
const password = "LocalRide-2026!";
async function login(page, url, email) {
  await page.goto(url);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("passenger and driver complete a real ride, with separate same-browser sessions", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    geolocation: { latitude: 28.0572, longitude: 81.6194 },
    permissions: ["geolocation"],
  });
  const passenger = await context.newPage(),
    driver = await context.newPage();
  const errors = [];
  passenger.on("pageerror", (e) => errors.push(e.message));
  driver.on("pageerror", (e) => errors.push(e.message));
  await login(passenger, "http://localhost:5183", "passenger1@ride.test");
  await expect(
    passenger.getByRole("heading", { name: "Namaste, Aarav." }),
  ).toBeVisible();
  await passenger.screenshot({
    path: "test-results/passenger-desktop.png",
    fullPage: true,
  });
  await login(driver, "http://localhost:5184", "driver2@ride.test");
  await expect(
    driver.getByRole("heading", { name: "Ready when you are." }),
  ).toBeVisible();
  await driver.getByRole("button", { name: "Go online", exact: true }).click();
  await expect(
    driver.getByRole("button", { name: "You’re online" }),
  ).toBeVisible();
  await passenger.reload();
  await expect(
    passenger.getByRole("heading", { name: "Namaste, Aarav." }),
  ).toBeVisible();
  await passenger
    .getByRole("button", { name: "Dhamboji Chowk Nepalgunj" })
    .click();
  await passenger.getByRole("button", { name: "See ride estimates" }).click();
  await expect(
    passenger.getByRole("button", { name: "Request Sathi" }),
  ).toBeVisible({ timeout: 25000 });
  await passenger.getByRole("button", { name: "Request Sathi" }).click();
  await expect(
    passenger.getByRole("heading", { name: "Finding your local match." }),
  ).toBeVisible({ timeout: 25000 });
  const pin = (
    await passenger.locator(".pin-box strong").innerText()
  ).replaceAll(" ", "");
  expect(pin).toMatch(/^\d{4}$/);
  await expect(driver.getByRole("button", { name: "Accept ride" })).toBeVisible(
    { timeout: 30000 },
  );
  await driver.getByRole("button", { name: "Accept ride" }).click();
  await expect(
    driver.getByRole("button", { name: "I’ve arrived" }),
  ).toBeVisible();
  await driver.getByRole("button", { name: "I’ve arrived" }).click();
  await driver.getByLabel("Passenger’s 4-digit PIN").fill(pin);
  await driver.getByRole("button", { name: "Start trip" }).click();
  await expect(
    driver.getByRole("button", { name: "Complete ride" }),
  ).toBeVisible();
  await driver.getByRole("button", { name: "Complete ride" }).click();
  await expect(
    driver.getByRole("heading", { name: "Thanks for riding local." }),
  ).toBeVisible();
  await expect(
    passenger.getByRole("heading", { name: "Thanks for riding local." }),
  ).toBeVisible({ timeout: 15000 });
  await passenger.getByRole("button", { name: "Submit rating" }).click();
  await expect(
    passenger.getByText("Thank you for your feedback."),
  ).toBeVisible();
  await driver.getByRole("button", { name: "Submit rating" }).click();
  await expect(driver.getByText("Thank you for your feedback.")).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
test("mobile passenger navigation and admin reporting render without overflow", async ({
  browser,
}) => {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const page = await mobile.newPage();
  await login(page, "http://localhost:5183", "passenger3@ride.test");
  await expect(
    page.getByRole("heading", { name: "Namaste, Bikash." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/passenger-mobile.png",
    fullPage: true,
  });
  await page
    .locator(".bottom-nav")
    .getByRole("link", { name: "Wallet" })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little ready-to-go." }),
  ).toBeVisible();
  await mobile.close();
  const admin = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const dashboard = await admin.newPage();
  await login(dashboard, "http://localhost:5185", "admin@ride.test");
  await expect(
    dashboard.getByRole("heading", { name: "A city in motion." }),
  ).toBeVisible();
  await expect(
    dashboard.getByText("Passengers", { exact: true }).last(),
  ).toBeVisible();
  await dashboard.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  await admin.close();
});
