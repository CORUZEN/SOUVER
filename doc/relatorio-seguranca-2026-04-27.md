# 🔒 Relatório de Auditoria de Segurança — Sistema Ouro Verde (SOUVER)

> **Data da auditoria:** 27/04/2026  
> **Escopo:** Autenticação, autorização, APIs, proteção contra ataques, infraestrutura  
> **Metodologia:** Análise estática de código, revisão de configurações, mapeamento de superfície de ataque

---

## 📋 Resumo Executivo

O sistema SOUVER possui **uma base de segurança razoável** em alguns pontos (senhas com bcrypt, 2FA/TOTP, sessões revogáveis, headers básicos de segurança), mas apresenta **vulnerabilidades críticas e altas** que precisam de correção imediata para evitar exposição de dados, injeção de SQL e acessos não autorizados.

| Categoria | Status Geral |
|-----------|-------------|
| Autenticação | 🟡 Razoável (2FA presente, mas sem rate limit global) |
| Autorização | 🟡 Razoável (RBAC implementado, mas sem middleware central) |
| Proteção de APIs | 🔴 Fraca (sem rate limiting, sem CORS, sem CSP) |
| Validação de Inputs | 🟡 Parcial (Zod em algumas APIs, ausente em outras) |
| Proteção contra Injeção | 🔴 Crítica (SQL dinâmico no Sankhya sem parametrização) |
| Observabilidade | 🟢 Boa (audit logs, telemetria, notificações de login suspeito) |

---

## ✅ Pontos Fortes (Manter)

1. **Senhas com bcrypt (12 rounds)** — `src/lib/auth/password.ts`
2. **2FA/TOTP com códigos de recuperação** — implementado via `otplib`
3. **Sessões revogáveis no banco** — `UserSession` com `status`, `expiresAt`, `revokedAt`
4. **Bloqueio por tentativas falhas no login** — 5 tentativas / 30 minutos por conta
5. **Notificação de login de novo IP** — detecta e alerta usuário + admin
6. **Audit logging em ações sensíveis** — login, logout, CRUD de usuários, impersonation
7. **Headers básicos de segurança** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
8. **Escopo de dados por perfil no módulo Metas** — `SELLER` vê apenas seus dados, `SUPERVISOR` vê equipe
9. **Proteção contra enumeration no forgot-password** — retorna mensagem genérica independente de existir usuário
10. **Cache com escopo por perfil** — chaves de cache incluem `SUP:<code>` / `SELLER:<code>`

---

## 🔴 Vulnerabilidades CRÍTICAS (Corrigir Imediatamente)

### 1. SQL Injection em Queries Sankhya
**Severidade:** 🔴 CRÍTICA  
**Arquivos afetados:** ~10 APIs que constroem SQL dinâmico

**Descrição:** Todas as APIs que consultam o ERP Sankhya concatenam strings diretamente no SQL. A sanitização de aspas simples (`replace(/'/g, "''")`) é **insuficiente** para Oracle/Sankhya.

**Exemplo vulnerável:**
```ts
// src/app/api/metas/sellers-performance/route.ts
const escaped = sellerCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ')
return `... AND CAB.CODVEND IN (${escaped}) ...`
```

**Risco:** Um atacante com acesso ao sistema (ou via manipulação de `sellerCode` em inputs) pode injetar SQL no ERP corporativo, extraindo, alterando ou deletando dados comerciais.

**Correção:** Usar prepared statements ou a API parametrizada do Sankhya. Se não for possível, validar rigorosamente `sellerCodes` contra regex `/^\d+$/` antes de concatenar.

---

### 2. Ausência de Middleware Global de Autenticação
**Severidade:** 🔴 CRÍTICA  
**Arquivos afetados:** Todo o projeto

**Descrição:** Não existe `middleware.ts` no projeto. Cada API Route Handler precisa chamar `getAuthUser(req)` manualmente. Se um desenvolvedor esquecer, a rota fica pública.

**Correção:** Criar `src/middleware.ts` que valide `souver_token` em todas as rotas protegidas (exceto `/login`, `/api/auth/login`, `/api/auth/forgot-password`, etc.).

---

### 3. Ausência Total de Rate Limiting
**Severidade:** 🔴 CRÍTICA  
**Arquivos afetados:** Todas as APIs

**Descrição:** Nenhuma dependência de rate limiting está instalada (`rate-limiter-flexible`, `express-rate-limit`, etc.). Nenhuma API possui proteção contra flood de requisições.

**APIs especialmente vulneráveis:**
- `POST /api/auth/login` — brute-force distribuído por IP possível
- `POST /api/auth/forgot-password` — spam e enumeration massivo
- `POST /api/auth/reset-password` — bombardeio de tokens
- `GET /api/health` — DDoS em endpoint que consulta banco
- `GET/POST /api/cron/*` — sobrecarga de jobs

**Correção:** Instalar `rate-limiter-flexible` e aplicar:
- 5 tentativas / minuto por IP no login
- 3 tentativas / hora por IP no forgot-password
- 100 requisições / minuto por IP em APIs gerais
- 20 requisições / minuto por IP em APIs pesadas (Sankhya)

---

### 4. Exposição de Dados Sensíveis via `/api/reports/export?module=hr`
**Severidade:** 🔴 ALTA  
**Arquivo:** `src/app/api/reports/export/route.ts`

**Descrição:** Qualquer usuário autenticado pode exportar dados PII de **todos os colaboradores** (nome, email, telefone, CPF, endereço, salário, etc.) sem verificação de permissão específica.

**Correção:** Adicionar verificação `hasPermission(user.roleId, 'hr:read')` ou restringir a roles `HR`, `DIRECTORATE`, `DEVELOPER`.

---

### 5. `/api/health` Exposto Publicamente
**Severidade:** 🟡 MÉDIA → 🔴 CRÍTICA se exposto à internet  
**Arquivo:** `src/app/api/health/route.ts`

**Descrição:** Endpoint público retorna:
- Uptime do servidor
- Uso de memória (rss, heap, external)
- Versão da aplicação
- Environment (dev/prod)
- Status do banco de dados e job queue

**Risco:** Information disclosure para reconhecimento de ataques. Um atacante pode identificar versões, horários de restart, e vulnerabilidades conhecidas.

**Correção:** Proteger com autenticação (token de monitoramento) ou reduzir dados expostos a apenas `status: healthy/unhealthy`.

---

## 🟡 Vulnerabilidades MÉDIAS (Corrigir em Breve)

### 6. Qualquer Usuário Autenticado Pode Criar Departamentos
**Arquivo:** `src/app/api/departments/route.ts`  
**Descrição:** A API de departamentos exige apenas login, não verifica role ou permissão para criar novos departamentos.

### 7. `forgot-password` Expõe Token em Resposta (Modo Dev)
**Arquivo:** `src/app/api/auth/forgot-password/route.ts`  
**Descrição:** A resposta inclui `_dev: { resetUrl, token: rawToken }`. Se houver deploy em homologação sem remoção, é uma brecha grave.

**Correção:** Condicionar `_dev` a `APP_ENV === 'development'` ou remover completamente.

### 8. `sameSite: 'lax'` em Cookies de Autenticação
**Arquivos:** `src/app/api/auth/login/route.ts`, `impersonate`, `2fa`  
**Descrição:** `lax` permite envio do cookie em navegações top-level cross-site (ex: clicar em link de phishing). Deveria ser `strict`.

**Correção:** Alterar para `sameSite: 'strict'` em todos os cookies de sessão.

### 9. `jsonwebtoken` sem Verificação Explícita de Algoritmo
**Arquivo:** `src/lib/auth/jwt.ts`  
**Descrição:**
```ts
return jwt.verify(token, SECRET) as JwtPayload  // SEM { algorithms: ['HS256'] }
```
**Risco:** Ataque de algorithm confusion se a chave for comprometida.

**Correção:** Especificar `jwt.verify(token, SECRET, { algorithms: ['HS256'] })`.

### 10. `CRON_SECRET` Opcional (Fail-Open)
**Arquivos:** `src/app/api/cron/cleanup/route.ts`, `src/app/api/cron/reports/route.ts`  
**Descrição:** Se `CRON_SECRET` não estiver definido, qualquer um pode executar jobs de limpeza e relatórios.

**Correção:** Tornar obrigatório (fail-closed):
```ts
if (!cronSecret) throw new Error('CRON_SECRET não configurado')
```

### 11. Recovery Codes 2FA Usam `Math.random()`
**Arquivo:** `src/app/api/auth/2fa/setup/route.ts`  
**Descrição:** Geração de códigos de backup usa `Math.random().toString(36)` em vez de `crypto.randomBytes()`.

**Correção:** Substituir por `crypto.randomBytes(5).toString('base64').slice(0, 5).toUpperCase()`.

### 12. Sanitização de Outputs Ausente (Risco XSS)
**Descrição:** Não há `DOMPurify` ou similar. Campos como `title`, `description`, `message`, `notes`, `content` de chat são armazenados sem sanitização HTML.

**Correção:** Instalar `dompurify` e sanitizar inputs ricos antes de armazenar/renderizar.

### 13. CORS Não Configurado
**Descrição:** `next.config.ts` não possui configuração de CORS. APIs podem ser chamadas de qualquer origem.

**Correção:** Adicionar headers CORS restritos às origens permitidas.

### 14. CSP (Content-Security-Policy) Ausente
**Descrição:** O header mais importante contra XSS não está configurado.

**Correção:** Adicionar CSP no `next.config.ts`:
```ts
{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" }
```

---

## 🟢 Vulnerabilidades BAIXAS (Corrigir quando Possível)

### 15. `bcryptjs` em vez de `bcrypt`
**Descrição:** `bcryptjs` é uma implementação pura JS — mais lenta e suscetível a timing attacks que a versão nativa `bcrypt`.

### 16. Notificações POST Verifica Role `ADMIN` Inexistente
**Arquivo:** `src/app/api/notifications/route.ts`  
**Descrição:** O role `ADMIN` não existe no catálogo de roles (`src/lib/role-catalog.ts`), então a verificação nunca será verdadeira para usuários comuns (apenas `DEVELOPER` passa por `hasPermission`).

### 17. `dangerouslySetInnerHTML` no Layout
**Arquivo:** `src/app/layout.tsx`  
**Descrição:** Script inline injetado via `dangerouslySetInnerHTML`. Sem hash CSP (SRI), se o layout for comprometido, é vetor de XSS.

### 18. Falta de Refresh Token
**Descrição:** Sessões expiram e o usuário precisa fazer login novamente. Não há mecanismo de revalidação silenciosa.

---

## 📊 Matriz de Risco Consolidada

| # | Vulnerabilidade | Severidade | Esforço de Correção |
|---|-----------------|------------|---------------------|
| 1 | SQL Injection em queries Sankhya | 🔴 Crítica | Médio |
| 2 | Middleware global ausente | 🔴 Crítica | Médio |
| 3 | Rate limiting ausente | 🔴 Crítica | Baixo |
| 4 | Export HR expõe PII de todos | 🔴 Alta | Baixo |
| 5 | `/api/health` público | 🔴 Alta | Baixo |
| 6 | Criar departamentos sem permissão | 🟡 Média | Baixo |
| 7 | Token dev exposto no forgot-password | 🟡 Média | Baixo |
| 8 | `sameSite: lax` nos cookies | 🟡 Média | Baixo |
| 9 | JWT sem verificação de algoritmo | 🟡 Média | Baixo |
| 10 | `CRON_SECRET` opcional | 🟡 Média | Baixo |
| 11 | Recovery codes com `Math.random()` | 🟡 Média | Baixo |
| 12 | Sanitização XSS ausente | 🟡 Média | Médio |
| 13 | CORS não configurado | 🟡 Média | Baixo |
| 14 | CSP ausente | 🟡 Média | Baixo |
| 15 | `bcryptjs` em vez de `bcrypt` | 🟢 Baixa | Baixo |
| 16 | Role `ADMIN` inexistente | 🟢 Baixa | Baixo |
| 17 | `dangerouslySetInnerHTML` no layout | 🟢 Baixa | Baixo |
| 18 | Refresh token ausente | 🟢 Baixa | Médio |

---

## 🎯 Plano de Ação Prioritário (Sugerido)

### Fase 1 — Segurança Crítica (1-2 semanas)
- [ ] **Validar rigorosamente `sellerCodes`** com regex `/^\d+$/` antes de concatenar SQL Sankhya
- [ ] **Criar `src/middleware.ts`** para autenticação/authorization global
- [ ] **Instalar `rate-limiter-flexible`** e aplicar em todas as APIs de auth e públicas
- [ ] **Proteger `/api/reports/export`** com verificação de permissão HR
- [ ] **Reduzir exposição do `/api/health`** ou proteger com token

### Fase 2 — Hardening (2-3 semanas)
- [ ] **Alterar `sameSite: 'lax'` → `'strict'`** em todos os cookies
- [ ] **Adicionar `{ algorithms: ['HS256'] }`** no `jwt.verify`
- [ ] **Tornar `CRON_SECRET` obrigatório** (fail-closed)
- [ ] **Remover `_dev` do forgot-password** ou condicionar a dev-only
- [ ] **Adicionar CSP e CORS** no `next.config.ts`
- [ ] **Restringir POST `/api/departments`** a administradores

### Fase 3 — Qualidade e Observabilidade (contínuo)
- [ ] **Substituir `Math.random()` por `crypto.randomBytes()`** nos recovery codes
- [ ] **Instalar `dompurify`** para sanitização de inputs ricos
- [ ] **Migrar `bcryptjs` → `bcrypt`** (bindings nativos)
- [ ] **Implementar refresh token** para melhor UX de sessão
- [ ] **Auditar periodicamente** novas APIs para garantir que chamam `getAuthUser`

---

## 📁 Arquivos-Chave Revisados

| Arquivo | Função |
|---------|--------|
| `src/lib/auth/session.ts` | Gestão de sessões JWT + Prisma |
| `src/lib/auth/permissions.ts` | RBAC, permissões de metas e módulos |
| `src/lib/auth/jwt.ts` / `jwt-edge.ts` | Assinatura/verificação JWT |
| `src/app/api/auth/login/route.ts` | Login com brute-force protection |
| `src/app/api/auth/me/route.ts` | Dados do usuário logado |
| `src/app/api/users/route.ts` | CRUD de usuários |
| `src/app/api/metas/sellers-performance/route.ts` | SQL dinâmico Sankhya |
| `src/app/api/pwa/summary/route.ts` | Resumo PWA com escopo por perfil |
| `src/app/api/health/route.ts` | Health check público |
| `next.config.ts` | Headers de segurança |

---

> **Nota:** Este relatório foi gerado por análise estática de código. Recomenda-se complementar com testes de penetração (pentest) em ambiente de homologação antes de aplicar correções em produção.
