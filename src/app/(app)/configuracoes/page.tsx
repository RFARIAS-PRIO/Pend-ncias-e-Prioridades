import { requireUser } from "@/server/auth";
import { PasswordForm } from "@/components/user-forms";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROLE_LABEL } from "@/lib/constants";
import { aiProviderInfo } from "@/server/ai/provider";

export const metadata = { title: "Configurações" };
export default async function SettingsPage() {
  const u = await requireUser(); const ai = aiProviderInfo();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Configurações</h1>
      <section className="card max-w-md space-y-2 p-4"><h2 className="font-semibold">Perfil</h2>
        <p className="text-sm">{u.name} · {u.email}</p><p className="text-sm text-sub">Perfil de acesso: {ROLE_LABEL[u.role]}</p>
        <div className="flex items-center gap-2 text-sm">Tema: <ThemeToggle /></div></section>
      <section className="card max-w-md space-y-1 p-4"><h2 className="font-semibold">Assistente de IA</h2>
        <p className="text-sm">Provedor ativo: <b>{ai.name}</b>{ai.model ? ` (${ai.model})` : ""}</p>
        <p className="text-xs text-sub">{ai.external ? "Somente os registros necessários à pergunta são enviados ao provedor; chaves ficam no servidor." : "Modo local: respostas geradas sem enviar dados a terceiros. Configure AI_PROVIDER para usar um modelo externo."}</p></section>
      <PasswordForm />
    </div>
  );
}
