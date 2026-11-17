# Command Center de Pendências e Prioridades

Aplicação web para centralizar e acompanhar pendências profissionais (engenharia e planejamento de manutenção, Grandes Intervenções, materiais, fornecedores, documentação e operações offshore).

## Visão do produto
- **Command Center**: três próximas ações recomendadas, KPIs, listas (dependem de mim, vencidas, bloqueadas, aguardando terceiros, prazo em 7 dias, compromissos, sem atualização) e distribuições por prioridade/status/projeto/ativo/fornecedor.
- **Checklist interativo** com ações rápidas, seleção múltipla e lote (com confirmação). Concluir exige evidência; cancelar exige motivo; nada é excluído (exclusão lógica).
- **Priorização transparente** (`src/lib/priority.ts`): score por prazo, atraso, criticidade, impacto operacional/financeiro, segurança, parada/GI, dependentes, bloqueios, material, embarque, tempo sem atualização e cobranças. Mostra a razão em linguagem simples e **nunca altera prioridade sozinho**.
- **Histórico estruturado** por pendência (linha do tempo) e global; comentários, dependências (com detecção de ciclos), referências (link/RC/PO/documento).
- **Busca global** (texto, ID, TAG, RC, PO, fornecedor, pessoa, comentários, histórico) com trecho destacado.
- **Kanban**, **Calendário**, **Projetos/ativos/equipamentos**, **Fornecedores e pessoas**, **Configurações**, **Administração de usuários** (perfis e acesso por projeto).
- **Assistente de IA** lateral: consulta os dados, relaciona informações novas a pendências existentes, detecta duplicidades e **só grava após confirmação** do usuário.

## Tecnologias
Next.js 15 (App Router) · TypeScript · React 19 · Tailwind CSS 3 · PostgreSQL · Prisma 6 · Zod · jose (sessão JWT em cookie httpOnly) · bcryptjs · Vitest.

## Arquitetura
```
prisma/            schema, migrações, seed (dados fictícios)
src/lib/           funções puras: priorização, datas, linguagem natural (pt-BR), DTOs
src/server/        db, auth, acesso por projeto, serviço de pendências (transações + histórico), busca
src/server/ai/     provider.ts (abstração: local | anthropic | openai-compatível) e engine.ts (intenções, recuperação, propostas)
src/app/           páginas, server actions (validação server-side), rotas /api/chat
src/components/    UI (checklist, kanban, chat, formulários)
tests/             unitários e de integração
```
Princípios: toda escrita passa por `src/server/pendencies.ts` (valida com Zod, checa perfil e acesso ao projeto, grava histórico na mesma transação). O chat usa a mesma camada, então as regras de permissão valem igualmente.

## Configuração local
Requisitos: Node 20+, PostgreSQL 14+.
```bash
npm install
cp .env.example .env        # ajuste DATABASE_URL e AUTH_SECRET
npx prisma migrate deploy   # aplica migrações (ou: npm run db:migrate em desenvolvimento)
npm run db:seed             # dados de demonstração
npm run dev                 # http://localhost:3000
```
Logins de demonstração (senha `Demo@1234`): `admin@demo.local`, `editor@demo.local` (só projetos TG-B e Bravo), `leitor@demo.local` (somente leitura). **Remova o seed em produção** e crie usuários reais em *Usuários*.

## Variáveis de ambiente
| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL |
| `AUTH_SECRET` | Segredo da sessão (≥16 caracteres; `openssl rand -base64 32`) |
| `AI_PROVIDER` | `local` (padrão), `anthropic` ou `openai` |
| `AI_MODEL` | Modelo (obrigatório para `openai`; padrão `claude-sonnet-5-5` para `anthropic`) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENAI_BASE_URL` | Credenciais (somente servidor) |
| `CHAT_RATE_LIMIT_PER_MIN` | Mensagens/min por usuário no chat (padrão 20) |

## Provedor de IA
- **local**: nenhum dado sai do servidor; intenções e respostas por regras + consultas ao banco.
- **anthropic / openai**: o modelo apenas **redige a resposta de consultas** a partir dos registros recuperados (máx. 20, nunca o banco inteiro). Falha do provedor → resposta local. As **propostas de gravação** (criar, atualizar, adiar, mudar status/prioridade, concluir, cancelar) são sempre geradas pelo servidor e exigem clique em *Confirmar*.

## Testes, lint e build
```bash
npm run lint && npm run typecheck
npm test                    # unitários (integração é pulada sem banco de teste)
TEST_DATABASE_URL="postgresql://user@host:5432/pendencias_test?schema=public" npm test   # inclui integração (apaga os dados desse banco!)
npm run build
```

## Deploy
`npm run build && npm run db:deploy && npm start`. Use HTTPS (cookie `secure` em produção), `AUTH_SECRET` forte e banco gerenciado. O rate limit é em memória (por instância); com várias instâncias, substitua por Redis (`src/lib/rate-limit.ts`).

## Premissas e limitações conhecidas
- Sem integração com SAP (fora do escopo). Sem upload de arquivos: documentos são referências (link/código).
- Interpretação de linguagem natural por regras (pt-BR); frases muito livres podem cair na busca. Não há extração por LLM para escrita.
- Busca é insensível a maiúsculas, mas **sensível a acentos** no banco (o destaque do trecho ignora acentos).
- Pendências sem projeto são visíveis a todos os usuários autenticados; com projeto, só a membros (admin vê tudo).
- Notificações: geradas ao atribuir a próxima ação a um usuário; exibidas em *Histórico* (sem e-mail/push).
- Sem recuperação de senha por e-mail (admin redefine em *Usuários*).
- Kanban: arrastar é só por mouse; há seletor por cartão para teclado/toque.
- Observado uma vez em teste automatizado um aviso de hidratação do React (#418) não reproduzível; a investigar.
