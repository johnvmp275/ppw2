"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, ClipboardList, Package, ShoppingCart, UserRound } from "lucide-react";
import React from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { usuariosApi } from "@/lib/api";
import { PAPEIS, Usuario } from "@/lib/delivery";
import { setUsuarioId, useUsuarioId } from "@/lib/sessao";
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

// Seletor de perfil: cada perfil enxerga botões diferentes (RBAC decidido no servidor)
function PerfilSelect() {
  const usuarioId = useUsuarioId();
  const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);

  React.useEffect(() => {
    usuariosApi
      .listar()
      .then((lista) => {
        setUsuarios(lista);
        // Primeiro acesso: começa como gerente para tudo ficar visível
        if (!lista.some((u) => u.id === usuarioId)) {
          const padrao = lista.find((u) => u.papel === 'GERENTE') ?? lista[0];
          if (padrao) setUsuarioId(padrao.id);
        }
      })
      .catch(() => setUsuarios([]));
  }, [usuarioId]);

  return (
    <label className="flex items-center gap-1.5 text-sm">
      <UserRound className="size-4 text-muted-foreground" />
      <span className="sr-only">Perfil</span>
      <NativeSelect className="w-48" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
        {usuarios.length === 0 && <option value="">Sem conexão</option>}
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nome} · {PAPEIS[u.papel]}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

export function DeliveryNav() {
  const pathname = usePathname();

  // A página do cliente final não mostra a navegação interna
  if (pathname.startsWith("/acompanhar")) return null;

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="font-bold">Cozinha Delivery</span>
        <nav className="flex flex-wrap gap-1">
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
        <PerfilSelect />
      </div>
    </header>
  );
}
