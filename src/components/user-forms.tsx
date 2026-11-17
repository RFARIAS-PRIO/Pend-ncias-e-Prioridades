"use client";
import { useActionState } from "react";
import { changePasswordAction, saveUserAction } from "@/app/actions";

export function PasswordForm() {
  const [s, a, p] = useActionState(changePasswordAction, {} as { error?: string; ok?: boolean });
  return (
    <form action={a} className="card max-w-md space-y-3 p-4">
      <h2 className="font-semibold">Alterar senha</h2>
      <div><label className="label" htmlFor="current">Senha atual</label><input id="current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
      <div><label className="label" htmlFor="next">Nova senha (mín. 10 caracteres)</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className="input" /></div>
      {s.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{s.error}</p>}{s.ok && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">✔ Senha alterada.</p>}
      <button className="btn btn-primary" disabled={p}>Salvar senha</button>
    </form>
  );
}

export function UserForm({ user, projects, memberOf }: { user?: { id: string; name: string; email: string; role: string; active: boolean }; projects: { id: string; name: string }[]; memberOf: string[] }) {
  const [s, a, p] = useActionState(saveUserAction, {} as { error?: string; ok?: boolean });
  const k = user?.id ?? "new";
  return (
    <form action={a} className="grid gap-3 p-3 sm:grid-cols-2">
      {user && <input type="hidden" name="id" value={user.id} />}
      <div><label className="label" htmlFor={`n-${k}`}>Nome</label><input id={`n-${k}`} name="name" defaultValue={user?.name} required className="input" /></div>
      <div><label className="label" htmlFor={`e-${k}`}>E-mail</label><input id={`e-${k}`} name="email" type="email" defaultValue={user?.email} required className="input" /></div>
      <div><label className="label" htmlFor={`r-${k}`}>Perfil</label><select id={`r-${k}`} name="role" defaultValue={user?.role ?? "EDITOR"} className="input"><option value="ADMIN">Administrador</option><option value="EDITOR">Editor</option><option value="VIEWER">Leitor</option></select></div>
      <div><label className="label" htmlFor={`p-${k}`}>{user ? "Nova senha (opcional)" : "Senha inicial (mín. 10)"}</label><input id={`p-${k}`} name="password" type="password" autoComplete="new-password" className="input" /></div>
      <fieldset className="sm:col-span-2"><legend className="label">Acesso a projetos (administradores veem todos)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{projects.map((pr) => <label key={pr.id} className="flex items-center gap-1.5"><input type="checkbox" name="projectIds" value={pr.id} defaultChecked={memberOf.includes(pr.id)} />{pr.name}</label>)}</div></fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={user?.active ?? true} />Ativo</label>
      <div className="flex items-center gap-3 sm:col-span-2"><button className="btn btn-primary btn-sm" disabled={p}>{user ? "Salvar" : "Criar usuário"}</button>
        {s.error && <span role="alert" className="text-sm text-red-700 dark:text-red-300">{s.error}</span>}{s.ok && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">✔ Salvo</span>}</div>
    </form>
  );
}
