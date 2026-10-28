import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource-variable/nunito";
import "./globals.css";
import { AvisoDemo } from "@/components/aviso-demo";
import { Encabezado } from "@/components/encabezado";
import { Pie } from "@/components/pie";
import { ProveedorTema } from "@/components/tema";

export const metadata: Metadata = {
  title: { default: "PixelPeso — ¿Dónde te sale más barato ese juego de Switch?", template: "%s · PixelPeso" },
  description:
    "Compará precios de juegos de Nintendo Switch y Switch 2 en Argentina, España, Europa y Estados Unidos, en pesos, con dólar oficial y blue.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#111218" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col antialiased">
        <ProveedorTema>
          <Suspense fallback={null}>
            <AvisoDemo />
          </Suspense>
          <Encabezado />
          <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>
          <Pie />
        </ProveedorTema>
      </body>
    </html>
  );
}
