import path from "node:path";
import { expect, test } from "@playwright/test";

const SEED_ADMIN_CPF = "00000000000";
const SEED_ADMIN_PASSWORD = "123456";

test.describe("TC-ADMIN-001 — Login administrativo E2E en navegador", () => {
  test("Caso negativo: credenciales incorrectas permanecen en /login y muestran mensaje de error", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Acesse sua conta" }),
    ).toBeVisible();

    const cpfInput = page.getByPlaceholder("000.000.000-00");
    const passwordInput = page.getByPlaceholder("Digite sua senha");
    const submitButton = page.getByRole("button", { name: "Entrar" });

    await cpfInput.fill(SEED_ADMIN_CPF);
    await passwordInput.fill("senha_incorreta_999");
    await submitButton.click();

    await expect(page.getByText("Credenciais inválidas")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Caso positivo (TC-ADMIN-001): login con CPF sin puntuación y contraseña seed redirige al dashboard, crea cookie de sesión y no muestra errores", async ({
    page,
    context,
  }) => {
    await page.goto("/login");

    const cpfInput = page.getByPlaceholder("000.000.000-00");
    const passwordInput = page.getByPlaceholder("Digite sua senha");
    const submitButton = page.getByRole("button", { name: "Entrar" });

    // Introducir CPF sin puntuación (el input aplica la máscara visual y envía solo dígitos)
    await cpfInput.fill(SEED_ADMIN_CPF);
    await expect(cpfInput).toHaveValue("000.000.000-00");

    await passwordInput.fill(SEED_ADMIN_PASSWORD);
    await submitButton.click();

    // Verificar redirección al dashboard (ruta raíz "/" en admin-app)
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(
      page.getByText("Visão geral da frota municipal"),
    ).toBeVisible();

    // Verificar que no aparece ningún mensaje de error de login
    await expect(page.getByText("Credenciais inválidas")).toHaveCount(0);

    // Verificar que la cookie de sesión "token" (httpOnly) fue creada
    const cookies = await context.cookies();
    const tokenCookie = cookies.find((c) => c.name === "token");
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie?.value.length).toBeGreaterThan(10);

    // Guardar captura de pantalla del dashboard autenticado como evidencia
    const screenshotPath = path.resolve(
      __dirname,
      "../../evidencias/TC-ADMIN-001/dashboard-authenticated.png",
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
