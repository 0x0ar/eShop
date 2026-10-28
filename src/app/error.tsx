"use client";

import { Button } from "@/components/ui/button";

export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
      <h1 className="text-3xl font-extrabold">Algo salió mal</h1>
      <p className="text-muted-foreground">No pudimos cargar esta página. Probá de nuevo en un momento.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
