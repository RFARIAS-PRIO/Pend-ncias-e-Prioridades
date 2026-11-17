"use client";
import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, {} as { error?: string });
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-4 p-6" aria-labelledby="t">
        <div>
          <h1 id="t" className="text-xl font-bold">Command Center</h1>
          <p className="text-sm text-sub">Pendências e Prioridades</p>
        </div>
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" required className="input" autoFocus /></div>
        <div><label className="label" htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
        {state.error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{state.error}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
        {process.env.NODE_ENV !== "production" && <p className="text-xs text-sub">Demo (dev): admin@demo.local / Demo@1234</p>}
      </form>
    </main>
  );
}
