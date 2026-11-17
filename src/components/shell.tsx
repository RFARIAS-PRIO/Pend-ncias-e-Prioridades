"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarDays, ClipboardList, Columns3, History, LayoutDashboard, Menu, MessageSquare, Plus, Search, Settings, Users, Building2, ShieldCheck, LogOut } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Toaster } from "./ui";
import { ChatPanel } from "./chat-panel";
import { logoutAction } from "@/app/actions";

const NAV = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/pendencias", label: "Pendências", icon: ClipboardList },
  { href: "/kanban", label: "Kanban", icon: Columns3 },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/projetos", label: "Projetos e ativos", icon: Building2 },
  { href: "/fornecedores", label: "Fornecedores e pessoas", icon: Users },
  { href: "/busca", label: "Busca global", icon: Search },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Shell({ user, unread, canWrite, children }: { user: { name: string; role: string }; unread: number; canWrite: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [chat, setChat] = useState(false);
  const items = user.role === "ADMIN" ? [...NAV, { href: "/admin/usuarios", label: "Usuários", icon: ShieldCheck }] : NAV;
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-2">Ir para o conteúdo</a>
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-line bg-surface p-3 transition-transform lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`} aria-label="Menu principal">
        <div className="mb-4 px-2 pt-1"><div className="text-sm font-bold leading-tight">Command Center</div><div className="text-xs text-sub">Pendências e Prioridades</div></div>
        <nav className="space-y-0.5">
          {items.map(({ href, label, icon: I }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return <Link key={href} href={href} onClick={() => setMenu(false)} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm ${active ? "bg-brand/10 font-semibold text-brand" : "hover:bg-muted"}`}><I className="h-4 w-4" aria-hidden />{label}</Link>;
          })}
        </nav>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenu(false)} aria-hidden />}
      <div className={`lg:pl-60 ${chat ? "xl:pr-96" : ""}`}>
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur">
          <button className="btn btn-sm lg:hidden" aria-label="Abrir menu" onClick={() => setMenu(true)}><Menu className="h-4 w-4" aria-hidden /></button>
          <form action="/busca" className="flex-1"><label className="sr-only" htmlFor="gq">Busca global</label>
            <input id="gq" name="q" type="search" placeholder="Buscar pendências, TAG, RC, PO, fornecedor…" className="input max-w-xl" /></form>
          {canWrite && <Link href="/pendencias/nova" className="btn btn-primary btn-sm"><Plus className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Nova pendência</span></Link>}
          <Link href="/historico" className="btn btn-sm relative" aria-label={`Notificações: ${unread} não lidas`}><Bell className="h-4 w-4" aria-hidden />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] text-white">{unread}</span>}</Link>
          <button className="btn btn-sm" aria-expanded={chat} aria-controls="chat" onClick={() => setChat((c) => !c)}><MessageSquare className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Assistente</span></button>
          <ThemeToggle />
          <form action={logoutAction}><button className="btn btn-sm" aria-label={`Sair (${user.name})`} title={user.name}><LogOut className="h-4 w-4" aria-hidden /></button></form>
        </header>
        <main id="main" className="mx-auto max-w-[1400px] p-4">{children}</main>
      </div>
      <ChatPanel open={chat} onClose={() => setChat(false)} />
      <Toaster />
    </div>
  );
}
