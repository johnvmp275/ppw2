"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, ClipboardList, Package, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", titulo: "PDV", icone: ShoppingCart },
  { href: "/cozinha", titulo: "Cozinha", icone: ChefHat },
  { href: "/pedidos", titulo: "Pedidos", icone: ClipboardList },
  { href: "/produtos", titulo: "Produtos", icone: Package },
];

// "/pedidos/novo" e "/pedidos/123" também deixam "Pedidos" destacado
function linkAtivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function DeliveryNav() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="font-bold">Cozinha Delivery</span>
        <nav className="flex gap-1">
          {links.map(({ href, titulo, icone: Icone }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                linkAtivo(pathname, href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icone className="size-4" />
              {titulo}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
