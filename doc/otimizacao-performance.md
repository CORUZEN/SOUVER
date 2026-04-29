# Otimização de Performance — SOUVER

> **Status geral:** Em andamento. Otimizações de backend, cache e banco aplicadas. Migração do `MetasWorkspace` para React Query foi implementada e posteriormente revertida por instabilidade.
> **Última atualização:** 2026-04-27

---

## 1. Contexto do Problema

O módulo de Metas (`/metas`) carrega múltiplas fontes de dados pesadas do Sankhya em paralelo:
- `sellers-performance` — performance dos vendedores
- `brand-weight` — peso por marca
- `sankhya-targets` — metas financeiras e de peso
- `item-distribution` — distribuição de itens
- `product-focus` — foco por produto (múltiplos códigos)

Em ambiente de desenvolvimento (`next dev`), o servidor Node é single-threaded. Disparar 5-6 queries pesadas simultaneamente saturava o event loop, fazendo com que requisições leves como `/api/auth/me` (Header/Sidebar) e `/api/notifications` ficassem presas na fila por minutos.

---

## 2. Otimizações Aplicadas ✅

### 2.1 Banco de Dados (PostgreSQL/Neon)

| Otimização | Status | Detalhes |
|-----------|--------|----------|
| **13 índices novos** | ✅ Aplicado | Criados diretamente no Neon para reduzir full table scans em joins pesados do Sankhya |
| **Pool Prisma `max: 3`** | ✅ Configurado | Limita conexões simultâneas para evitar esgotar o Neon (planos com limites de conexão) |
| **FK discovery cache (24h)** | ✅ Implementado | Cacheia descoberta de chaves estrangeiras do Sankhya, evitando repetir metadados |
| **Queries paralelas** `returns` + `openTitles` | ✅ Backend | Reduz latência total da requisição `sellers-performance` |
| **Diagnostics opcional** (`?debug=1`) | ✅ API | Payload menor por padrão; metadados de debug só enviados quando solicitado |

### 2.2 Cache e Integração Sankhya

| Otimização | Status | Detalhes |
|-----------|--------|----------|
| **Token Sankhya cache (5min TTL)** | ✅ Corrigido | Reduzido de 50min para 5min. Tokens expirados causavam retorno de dados vazios |
| **HTTP Cache-Control headers** | ✅ API | Permite cache no edge/CDN para respostas imutáveis |
| **`withRequestCache`** | ✅ Utilitário | Cache genérico para requisições ao Sankhya com TTL configurável |

### 2.3 Frontend — React Query Migration (Hooks Globais)

| Módulo | Status | Hooks |
|--------|--------|-------|
| **Auth** | ✅ Completo | `useAuth`, `useInvalidateAuth` |
| **Notificações** | ✅ Completo | `useNotifications` |
| **Dashboard KPIs** | ✅ Completo | `useDashboardKpis`, `useDashboardTrend` |
| **Metas — Hooks utilitários** | ✅ Criados | `useSellersPerformance`, `useBrandWeight`, `useSankhyaTargets`, `useItemDistribution`, `usePositivationDetails`, `useProductFocusQueries` |
| **PWA Auth fix** | ✅ Corrigido | Removido `authCheckStartedRef` que causava loop infinito de "Validando acesso" nas páginas `diretoria`, `supervisor`, `metas-diretoria` |

### 2.4 MetasWorkspace — Tentativa de Migração

**Status:** ⚠️ **Revertido**

Foi implementada a migração completa do `MetasWorkspace.tsx` (~11.600 linhas) para React Query, incluindo:
- Serialização de queries secundárias via `enabled: !sellersLoading && sellers.length > 0`
- Remoção de `useEffect` + `fetch` + `AbortController` manuais
- Uso de `queryClient.fetchQuery` para `loadPreviousConsolidated`
- Invalidação de cache via `queryClient.invalidateQueries` em mutações

**Motivo da reversão:** Instabilidade detectada em ambiente de desenvolvimento (erros de execução, possivelmente relacionados à complexidade do componente e ordem dos hooks em um arquivo muito grande). O componente foi restaurado ao estado anterior.

**Aprendizado:** A migração de um componente monolítico de ~11.600 linhas precisa ser feita de forma incremental, extraindo sub-componentes ou usando estratégia de feature flags.

---

## 3. Pendências 🚧

### 3.1 Alta Prioridade

| Item | Descrição | Complexidade |
|------|-----------|--------------|
| **Commit das alterações estáveis** | Otimizações de backend e hooks globais ainda não commitados | Baixa |
| **Atualizar `progress.md`** | Sincronizar documentação do projeto com estado atual | Baixa |

### 3.2 Média Prioridade

| Item | Descrição | Complexidade |
|------|-----------|--------------|
| **Mutations no MetasWorkspace** | `loadAllowlist`, `saveAllowlist`, `removeSellerAndSave`, `syncAllowlistFromSankhya` ainda usam `fetch` manual. Candidatas a `useMutation` | Média |
| **Páginas PWA restantes** | `supervisor` e `metas-diretoria` ainda usam `fetch` manual e podem ter gargalos similares | Média |
| **Serialização manual no MetasWorkspace** | Como a migração React Query foi revertida, a serialização de queries (evitar disparar tudo de uma vez) precisa ser reimplementada com `fetch` sequencial | Média |

### 3.3 Baixa Prioridade / Dependências Externas

| Item | Descrição | Bloqueio |
|------|-----------|----------|
| **Contrato real Sankhya** | Autenticação OAuth com credenciais de produção | Acesso/infra externa |
| **Sync jobs automatizados** | Jobs de sincronização de dados (provavelmente Vercel Cron) | Definição de escopo |
| **Observabilidade** | Logs estruturados de tempo de query, métricas de cache hit/miss, alerta de pool exhaustion | Decisão de ferramenta |

### 3.4 Futuro / Exploração

| Item | Descrição |
|------|-----------|
| **Refatoração do MetasWorkspace** | Quebrar o componente monolítico em sub-componentes menores antes de migrar para React Query |
| **Paginação/cursor nas queries Sankhya** | Evitar carregar datasets completos de uma vez |
| **Otimização de queries SQL** | Revisar planos de execução e adicionar mais índices se necessário |
| **React Query Devtools** | Instalar para debugging de cache em dev |

---

## 4. Decisões Técnicas Registradas

### 4.1 TTL do Cache Sankhya
- **Anterior:** 50 minutos
- **Atual:** 5 minutos
- **Racional:** Tokens OAuth do Sankhya expiram em ~10 minutos. TTL de 50min causava cache de token inválido, retornando dados vazios.

### 4.2 Pool de Conexões Prisma
- **Configuração:** `max: 3`
- **Racional:** Neon (plano atual) tem limite de conexões. Em serverless (Vercel), cada função mantém conexões abertas. `max: 3` previne esgotamento, com trade-off de possível fila em picos.

### 4.3 Serialização vs Paralelização
- **Produção (Vercel):** Queries podem ser paralelas — cada requisição é um serverless function independente.
- **Desenvolvimento (`next dev`):** Node single-threaded exige serialização de queries pesadas para não bloquear requisições leves (auth, notificações).
- **Solução aplicada (e revertida):** `enabled: !sellersLoading` nos hooks secundários do React Query.

---

## 5. Checklist de Próximos Passos

- [ ] Commit das otimizações de backend aplicadas (cache, índices, headers)
- [ ] Atualizar `progress.md` do projeto
- [ ] Reimplementar serialização de queries no `MetasWorkspace` (com `fetch` sequencial)
- [ ] Migrar mutações do `MetasWorkspace` para `useMutation`
- [ ] Migrar páginas PWA (`supervisor`, `metas-diretoria`) para React Query
- [ ] Implementar observabilidade básica (tempo de queries Sankhya)
- [ ] Planejar refatoração do `MetasWorkspace` em sub-componentes

---

## 6. Referências

- Arquivos modificados recentemente:
  - `src/lib/integrations/sankhya-auth.ts`
  - `src/lib/client/hooks/use-metas.ts`
  - `src/components/layout/Header.tsx`
  - `src/components/layout/Sidebar.tsx`
  - `src/app/(dashboard)/diretoria/page.tsx`
  - `src/app/(dashboard)/supervisor/page.tsx`
  - `src/app/(dashboard)/metas-diretoria/page.tsx`
- Índices aplicados: ver migrations Prisma ou execução direta no Neon
