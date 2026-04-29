# Auditoria de Performance SOUVER — 29/04/2026

**Objetivo:** Reduzir custos de infraestrutura (Vercel Fluid Active CPU, Neon Compute Hours, Network Transfer) e tornar o sistema profissionalmente eficiente.

**Métricas atuais (últimos 30 dias):**
- Vercel Fluid Active CPU: **46m 22s / 4h** (Hobby — ~19% do limite)
- Vercel Function Invocations: **31K / 1M**
- Neon Compute: **35.62 / 100 CU-hrs**
- Neon Network Transfer: **2.18 / 5 GB**

---

## Resumo Executivo

Foram auditados **79 endpoints**, **44 páginas**, o **Prisma schema** e as **configurações de build**. Identificamos **42 problemas** distribuídos em:

| Categoria | Quantidade | Severidade Crítica/Alta |
|-----------|-----------|------------------------|
| Cache HTTP / Estratégia de cache | 10 | 4 |
| Banco de dados (Neon) — queries, índices, pool | 12 | 6 |
| Computação pesada no serverless | 6 | 5 |
| Chamadas externas redundantes (Sankhya) | 3 | 2 |
| Re-renderizações / Bundle size | 12 | 6 |
| Navegação e PWA | 8 | 0 |

---

## Prioridade 1 — Quick Wins (Impacto Alto / Esforço Baixo)

Estes itens podem ser implementados em **1-2 dias** e reduzem imediatamente o consumo de CPU e banco.

### 1.1 Cachear token OAuth do Sankhya entre requisições
**Impacto:** 🔴 Crítico | **Esforço:** Baixo

**Problema:** Cada endpoint de metas (`sellers-performance`, `faturamento`, `sankhya-targets`, `sellers-allowlist/sync`, `products-allowlist/sync`) autentica independentemente no Sankhya. Em uma navegação comum, o mesmo token OAuth é requisitado **5-10 vezes**. Cada autenticação consome **200-500ms de Fluid Active CPU**.

**Solução:** Implementar cache de token em `withRequestCache` com chave `sankhya:token:${integrationId}` e TTL de **50 minutos**.

**Arquivos afetados:**
- `src/app/api/metas/sellers-performance/route.ts`
- `src/app/api/metas/faturamento/route.ts`
- `src/app/api/metas/sankhya-targets/route.ts`
- `src/app/api/metas/sellers-allowlist/sync/route.ts`
- `src/app/api/metas/products-allowlist/sync/route.ts`

**Impacto estimado:** Redução de **30-40%** no Fluid Active CPU de endpoints de metas.

---

### 1.2 Adicionar `Cache-Control` HTTP em endpoints que já usam cache em memória
**Impacto:** 🔴 Alta | **Esforço:** Baixo

**Problema:** Vários endpoints usam `withRequestCache` (memória do worker serverless), mas **não enviam headers `Cache-Control` HTTP**. Isso significa que o navegador/cliente refaz a requisição mesmo quando o worker já tem o dado. A cada cold start no Vercel, o cache de memória é perdido.

**Endpoints afetados:**
| Endpoint | Cache atual | Cache-Control sugerido |
|----------|-------------|------------------------|
| `api/metas/sellers-performance` | 180s memória | `private, max-age=60, stale-while-revalidate=120` |
| `api/metas/config` | 300s memória | `private, max-age=300` |
| `api/metas/sellers-allowlist` | 60s memória | `private, max-age=60` |
| `api/pwa/summary` | 20s memória (conflita com `no-store` HTTP) | `private, max-age=60` + TTL 5min |
| `api/faturamento` | Nenhum | `private, max-age=60` + `withRequestCache` 5min |

**Impacto estimado:** Redução de **15-25%** em Function Invocations.

---

### 1.3 Adicionar índices faltantes no Prisma schema
**Impacto:** 🔴 Alta | **Esforço:** Baixo

**Problema:** Tabelas críticas não têm índices. Cada query sem índice faz **full table scan**, consumindo CU do Neon desnecessariamente.

**Índices urgentes:**
```prisma
model ConversationParticipant {
  @@index([userId])
}

model Message {
  @@index([conversationId, createdAt])
  @@index([senderId])
}

model Integration {
  @@index([provider, status])
}

model IntegrationLog {
  @@index([integrationId, executedAt])
  @@index([status, executedAt])
}

model MetasSeller {
  @@index([code])
  @@index([active])
  @@index([supervisorCode])
}
```

**Impacto estimado:** Redução de **10-20%** em Compute Hours do Neon.

---

### 1.4 Corrigir N+1 no chat
**Impacto:** 🔴 Alta | **Esforço:** Baixo

**Problema:** `src/domains/chat/chat.service.ts:158-177` faz uma query de participações e depois **uma query de `count` por conversa**. Se o usuário tiver 100 conversas, são **101 queries**.

**Solução:** Substituir por uma única query agregada:
```sql
SELECT conversation_id, COUNT(*) 
FROM messages 
WHERE conversation_id IN (...) 
  AND sender_id != ? 
  AND deleted_at IS NULL 
  AND created_at > ?
GROUP BY conversation_id
```

**Impacto estimado:** Redução de **5-10%** em Compute Hours do Neon.

---

### 1.5 Limitar `take` em queries sem paginação
**Impacto:** 🔴 Alta | **Esforço:** Baixo

**Problema:** Queries `findMany` sem `take` podem carregar milhares de registros de uma vez, consumindo memória e CPU no Vercel e no Neon.

**Arquivos afetados:**
- `src/app/api/reports/export/route.ts` — 5 queries sem `take`
- `src/domains/chat/chat.service.ts:26` — `listConversations` sem `take`
- `src/domains/production/production.service.ts:180` — `listBatchEvents` sem `take`

**Solução:** Adicionar `take: 100` (ou configurável) com paginação.

**Impacto estimado:** Redução de **5-15%** em Compute Hours do Neon + memória no Vercel.

---

### 1.6 Corrigir query não-utilizada no dashboard
**Impacto:** 🟡 Média | **Esforço:** Mínimo

**Problema:** `src/app/api/dashboard/kpis/route.ts:173` inicia `activeUsersPromise` mesmo quando `moduleParam` é fornecido e o resultado é descartado.

**Solução:** Mover a declaração para dentro do `else`.

---

## Prioridade 2 — Otimizações de Médio Impacto (Esforço Médio)

### 2.1 Reduzir pool de conexões do PrismaPg
**Impacto:** 🔴 Alta | **Esforço:** Médio

**Problema:** `src/lib/prisma.ts` usa o driver `pg` com pool padrão de **10 conexões**, mas está atrás do **Neon Pooler**. Pool sobre pool causa contenção e timeouts.

**Solução:**
```typescript
const adapter = new PrismaPg({
  connectionString,
  ssl: { rejectUnauthorized: !isDev },
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  max: Number(process.env.PG_POOL_MAX ?? 3), // reduzir para 3-5
})
```

**Impacto estimado:** Menos timeouts, menor latência de conexão, redução de **5-10%** em CU do Neon.

---

### 2.2 Tornar páginas de auth estáticas (`force-static`)
**Impacto:** 🟡 Média | **Esforço:** Baixo

**Problema:** Páginas como login, esqueci-senha, acesso-negado são SSR dinâmico. Cada visita gera uma execução serverless desnecessária.

**Páginas afetadas:**
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/esqueci-senha/page.tsx`
- `src/app/(auth)/resetar-senha/page.tsx`
- `src/app/(dashboard)/em-desenvolvimento/page.tsx`
- `src/app/(dashboard)/acesso-negado/page.tsx`

**Solução:** Adicionar `export const dynamic = 'force-static'`.

**Impacto estimado:** Redução de **5-10%** em Function Invocations.

---

### 2.3 Paralelizar queries sequenciais no sellers-performance
**Impacto:** 🟡 Média | **Esforço:** Baixo

**Problema:** `src/app/api/metas/sellers-performance/route.ts` executa Orders → Returns → OpenTitles → SellerBase **sequencialmente**. Returns e OpenTitles são independentes.

**Solução:**
```typescript
const [ordersResult, returnsResult] = await Promise.all([
  queryOrders(...),
  queryReturns(...),
])
```

**Impacto estimado:** Redução de **20-30%** no tempo de resposta deste endpoint.

---

### 2.4 Remover payload de diagnostics do sellers-performance em produção
**Impacto:** 🟡 Média | **Esforço:** Baixo

**Problema:** O endpoint retorna `diagnostics` com reduce em todos os pedidos. Isso pode representar **30-50% do JSON final**.

**Solução:** Mover `diagnostics` para query string opcional (`?debug=1`).

**Impacto estimado:** Redução de **10-20%** em Network Transfer e tempo de serialização JSON.

---

### 2.5 Cachear `discoverFkColumns` do sankhya-targets
**Impacto:** 🟡 Média | **Esforço:** Baixo

**Problema:** `src/app/api/metas/sankhya-targets/route.ts` executa `discoverFkColumns` a cada requisição. É uma query de schema que raramente muda.

**Solução:** Cachear em `withRequestCache` com TTL de **24h**.

---

## Prioridade 3 — Refatorações Estruturais (Impacto Alto / Esforço Médio-Alto)

### 3.1 Adotar TanStack Query (React Query) no frontend
**Impacto:** 🔴 Alta | **Esforço:** Médio-Alto

**Problema:** Todo o projeto usa `fetch` cru dentro de `useEffect`. Não há deduplicação, cache client-side, stale-while-revalidate, retry automático ou cancelamento de requests.

**Consequências:**
- Cada page faz `fetch('/api/auth/me')` independentemente → múltiplas chamadas ao mesmo endpoint
- Polling de notificações a cada 60s com `setInterval` sem cancelamento
- Race conditions ao trocar mês/ano nas páginas de metas
- Sem cache client-side → mais requisições serverless

**Solução:** Adotar **TanStack Query** (`@tanstack/react-query`). Começar pelas páginas mais críticas:
1. Auth (`/api/auth/me`) — cache de 30s, deduplicação global
2. Dashboard KPIs — `staleTime: 60_000`
3. Metas PWA — `staleTime: 300_000` + `refetchInterval` para polling

**Impacto estimado:** Redução de **20-35%** em Function Invocations + melhoria drástica na UX.

---

### 3.2 Quebrar monolitos de componentes
**Impacto:** 🔴 Alta | **Esforço:** Médio-Alto

**Problema:**
- `MetasWorkspace.tsx`: **11.896 linhas** — qualquer mudança de estado re-renderiza tudo
- `supervisor/page.tsx`: **2.430 linhas**
- `metas-diretoria/page.tsx`: **2.540 linhas** — duplicação massiva com supervisor

**Solução:**
- Extrair tipos para `types/metas.ts`
- Extrair helpers para `lib/metas/helpers.ts`
- Extrair cálculos para `lib/metas/calculations.ts`
- Criar componentes reutilizáveis e hooks (`useMetasDashboard`)
- Usar `React.memo` em listas estáticas

**Impacto estimado:** Menos re-renderizações, menor uso de CPU no client, bundle menor.

---

### 3.3 Criar `AuthProvider` centralizado
**Impacto:** 🟡 Média | **Esforço:** Médio

**Problema:** Header, Sidebar, MobileNavDrawer e páginas PWA fazem `fetch('/api/auth/me')` independentemente.

**Solução:** Criar um `AuthContext` no nível do layout que busca o usuário uma vez e compartilha via contexto.

**Impacto estimado:** Redução de **3-5 chamadas serverless** por navegação de página.

---

## Prioridade 4 — Melhorias de Longo Prazo (Impacto Médio / Esforço Alto)

### 4.1 Lazy-load de bibliotecas pesadas
**Impacto:** 🟡 Média | **Esforço:** Médio

**Problema:** `recharts` (~70kb gzipped) é importado estaticamente em `DashboardView.tsx` e `analytics/page.tsx`.

**Solução:**
```typescript
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
```

### 4.2 Otimizar Service Worker do PWA
**Impacto:** 🟡 Média | **Esforço:** Médio

**Problema:**
- Cache TTL de API é de apenas **2 minutos**
- `PRECACHE_URLS` não inclui CSS/JS bundles do Next.js
- Ícones 192x192 e 512x512 apontam para o **mesmo arquivo PNG**

**Solução:** Aumentar TTL para 15-30min, adicionar chunks críticos ao precache, criar ícones com resoluções corretas.

### 4.3 Implementar streaming para exports grandes
**Impacto:** 🟡 Média | **Esforço:** Alto

**Problema:** `reports/export` e `audit/export` carregam TODOS os dados em memória antes de gerar o buffer.

**Solução:** Usar `ReadableStream` para streaming de CSV/XLSX, ou limitar a 5.000 registros.

### 4.4 Bundle analyzer
**Impacto:** 🟢 Baixa | **Esforço:** Baixo

**Solução:** Instalar `@next/bundle-analyzer` e adicionar script de análise ao `package.json`.

---

## Roteiro Recomendado de Implementação

### Semana 1 — Quick Wins
1. Cachear token OAuth do Sankhya
2. Adicionar `Cache-Control` HTTP nos endpoints de metas
3. Adicionar índices faltantes no schema
4. Corrigir N+1 no chat
5. Limitar `take` em queries sem paginação
6. Corrigir query não-utilizada no dashboard

### Semana 2 — Pool e Estática
1. Reduzir pool de conexões PrismaPg
2. Tornar páginas de auth estáticas
3. Paralelizar queries no sellers-performance
4. Remover diagnostics em produção
5. Cachear `discoverFkColumns`

### Semana 3-4 — Frontend
1. Instalar TanStack Query
2. Implementar `AuthProvider`
3. Migrar endpoints críticos para React Query
4. Quebrar monolitos (começar por `MetasWorkspace.tsx`)

### Mês 2 — Refinamentos
1. Lazy-load de `recharts`
2. Otimizar Service Worker
3. Implementar streaming para exports
4. Bundle analyzer

---

## Projeção de Economia

| Otimização | Redução estimada Fluid Active CPU | Redução estimada Compute Hours Neon | Redução estimada Network Transfer |
|-----------|-----------------------------------|-------------------------------------|-----------------------------------|
| Cache OAuth + Cache-Control HTTP | **30-40%** | — | **15-20%** |
| Índices + N+1 fix + take limit | — | **20-35%** | — |
| TanStack Query + AuthProvider | **15-25%** | **5-10%** | **10-15%** |
| Páginas estáticas + diagnostics | **5-10%** | — | **5-10%** |
| **Total projetado** | **~50-75%** | **~25-45%** | **~30-45%** |

> Nota: Estas são projeções conservadoras. O impacto real depende do padrão de uso dos usuários.
