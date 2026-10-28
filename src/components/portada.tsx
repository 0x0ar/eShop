/* eslint-disable @next/next/no-img-element -- las portadas se enlazan desde la fuente, no se re-alojan ni se optimizan acá */
import { Gamepad2 } from "lucide-react";

export function Portada({ src, alt, className = "size-full object-cover" }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className="flex size-full items-center justify-center text-muted-foreground" aria-hidden={alt === ""}>
        <Gamepad2 className="size-10" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={className} />;
}
