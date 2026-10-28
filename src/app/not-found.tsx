import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
      <h1 className="text-3xl font-extrabold">No encontramos esa página</h1>
      <p className="text-muted-foreground">Puede que el juego ya no esté en el catálogo o que el link esté mal.</p>
      <Button asChild>
        <Link href="/buscar">Buscar juegos</Link>
      </Button>
    </div>
  );
}
