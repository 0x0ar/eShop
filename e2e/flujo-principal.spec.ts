import { expect, test } from "@playwright/test";

test("buscar → ficha → ver recomendación y filtrarla", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("más barato");

  // Búsqueda tolerante a tildes y errores menores ("reyno pixelad" → "Reino Pixelado").
  await page.getByRole("searchbox", { name: "Buscar un juego" }).first().fill("aventura reyno pixelad");
  await page.getByRole("button", { name: "Buscar", exact: true }).first().click();
  await expect(page).toHaveURL(/\/buscar\?q=/);
  const resultado = page.getByRole("link", { name: "Aventura del Reino Pixelado", exact: true });
  await expect(resultado).toBeVisible();
  await resultado.click();

  await expect(page).toHaveURL(/\/juego\/demo-aventura-del-reino-pixelado/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aventura del Reino Pixelado");

  // Recomendación con perfil completo: la key europea es lo más barato en los datos de demo.
  const rec = page.getByTestId("recomendacion");
  await expect(rec).toContainText("La opción más barata para vos");
  await expect(rec).toContainText("Key");
  await expect(rec).toContainText("Ahorrás");

  // Tabla: 4 regiones × 4 métodos.
  const tabla = page.getByTestId("tabla-comparativa");
  await expect(tabla.locator("tbody > tr")).toHaveCount(16);
  await expect(tabla.getByText("Más barata").first()).toBeVisible();

  // Perfil: solo cuenta argentina, sin keys ni gift cards → la recomendación cambia a Argentina.
  await page.locator("summary", { hasText: "¿Qué tenés?" }).click();
  for (const opcion of ["España", "Otro país de Europa", "Estados Unidos", "Gift cards", "Keys"]) {
    await page.getByRole("checkbox", { name: opcion, exact: true }).uncheck();
  }
  await expect(rec).toContainText("Argentina");
  await expect(rec).not.toContainText("Key");

  // Volver a mostrar todo.
  await page.getByRole("button", { name: "Mostrar todas las opciones" }).click();
  await expect(rec).toContainText("Key");
});

test("ordenar la tabla por precio con oficial", async ({ page }) => {
  await page.goto("/juego/demo-aventura-del-reino-pixelado");
  const tabla = page.getByTestId("tabla-comparativa");
  await tabla.getByRole("button", { name: /Con oficial/ }).click();
  await expect(tabla.locator("thead th").nth(1)).toHaveAttribute("aria-sort", "ascending");
  // La primera fila pasa a ser la más barata.
  await expect(tabla.locator("tbody > tr").first()).toContainText("Más barata");
});

test("wishlist: agregar, ver y compartir", async ({ page }) => {
  await page.goto("/juego/demo-granja-tranquila");
  await page.getByRole("button", { name: /Agregar Granja Tranquila a la wishlist/ }).click();
  await page.goto("/wishlist");
  await expect(page.getByRole("link", { name: "Granja Tranquila", exact: true })).toBeVisible();

  await page.goto("/wishlist?juegos=demo-escuadron-galactico");
  await expect(page.getByText("Estás viendo una wishlist compartida")).toBeVisible();
  await expect(page.getByRole("link", { name: "Escuadrón Galáctico", exact: true })).toBeVisible();
});

test("crear una alerta pide confirmación por email", async ({ page }) => {
  await page.goto("/juego/demo-escuadron-galactico");
  await page.getByLabel("Email").fill(`prueba+${Date.now()}@example.com`);
  await page.getByLabel(/Avisame por debajo/).fill("20000");
  await page.getByRole("button", { name: "Crear alerta" }).click();
  await expect(page.getByRole("status").filter({ hasText: "confirmar" })).toBeVisible();
});

test("cotizaciones y página de cálculo", async ({ page }) => {
  await page.goto("/cotizaciones");
  for (const t of ["Dólar oficial", "Dólar blue", "Euro oficial", "Euro blue"]) {
    await expect(page.getByText(t, { exact: true })).toBeVisible();
  }
  await page.goto("/como-calculamos");
  await expect(page.getByText("ARS = convertir(P) × C × (1 + IVA)")).toBeVisible();
});
