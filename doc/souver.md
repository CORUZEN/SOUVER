# SOUVER.md — Manual Unificado para Agente de IA (Full Stack)

Data de consolidação: 2026-05-07
Escopo: Sistema SOUVER (Next.js + Prisma + Neon + Vercel + Sankhya)
Objetivo: Este arquivo é a fonte única para um agente de IA entender o produto, trabalhar com segurança, evitar regressões e evoluir o sistema com qualidade profissional.

---

## 1) Visão do produto

SOUVER é um sistema empresarial com foco operacional e comercial, com módulo crítico de Metas (dashboard web + PWA), integração com Sankhya ERP (somente leitura) e governança por perfil.

Áreas-chave:
- Metas comerciais por vendedor/supervisor/diretoria
- KPIs, distribuição de itens, foco de produto, metas financeiras e de peso
- Gestão de usuários e vínculos (sellerCode obrigatório por perfil)
- Observabilidade operacional (telemetria de rotas críticas)

Princípio de negócio central:
- O Sankhya é origem de dados operacionais.
- O SOUVER consome dados do Sankhya e persiste configurações locais de controle (allowlists, metas auxiliares, parâmetros de UI/negócio).

---

## 2) Stack e dependências principais

- Frontend: Next.js (App Router), React, TypeScript, PWA (Service Worker)
- Backend: API Routes Next.js (serverless na Vercel)
- Banco: PostgreSQL (Neon)
- ORM: Prisma
- Auth: JWT próprio + refresh token + 2FA/TOTP
- Integração ERP: Sankhya (OAuth2 + fallback de sessão)
- Cache/controle: request cache in-memory, deduplicação in-flight, limite de concorrência
- Infra: Vercel + variáveis de ambiente seguras

Dependências/serviços externos críticos:
- Sankhya API/Gateway
- Neon (limites de conexão/computação)
- Vercel (cold starts, invocations, CPU)

---

## 3) Arquitetura funcional resumida

Fluxo típico de Metas:
1. Frontend (MetasWorkspace/PWA) chama APIs de metas.
2. API autentica usuário e aplica escopo por perfil.
3. API consulta configurações locais (allowlist e integrações).
4. API consulta Sankhya com autenticação e fallback em cascata.
5. API processa/agrega dados, aplica regras de negócio e retorna JSON.
6. Cache e deduplicação reduzem carga no Sankhya/Neon/Vercel.

Rotas e áreas críticas:
- `src/app/api/metas/sellers-performance/route.ts`
- `src/app/api/pwa/summary/route.ts`
- `src/app/api/metas/sellers-performance/brand-weight/route.ts`
- `src/app/api/metas/sellers-performance/product-focus/route.ts`
- `src/app/api/metas/sellers-performance/item-distribution/route.ts`
- `src/components/metas/MetasWorkspace.tsx`
- `src/app/(pwa)/app/supervisor/page.tsx`

---

## 3.1) Módulo Logística — Previsão de Pedidos (`/previsao`)

Objetivo da tela:
- Entregar visão operacional consolidada de pedidos em aberto, estoque e cidades atendidas para expedição/logística.
- Apoiar decisão diária de separação, cobertura de estoque e priorização de carga.

Arquivos núcleo:
- `src/app/(dashboard)/previsao/page.tsx` (gate de acesso)
- `src/components/faturamento/PlanejamentoDiario.tsx` (UI principal)
- `src/app/api/faturamento/route.ts` (dados de pedidos/itens/estoque)
- `src/app/api/faturamento/cities/route.ts` (lista persistida de cidades)
- `src/app/api/faturamento/cities/sync/route.ts` (sincronização de cidades via Sankhya)
- `src/app/api/faturamento/diagnose/route.ts` (diagnóstico técnico)

Permissão e segurança:
- Acesso exige autenticação e permissão `previsao:interact` (`requireModuleInteract(request, 'previsao')`).
- Nunca remover gate de permissão dessa área.
- Mesmo padrão de integração Sankhya: bearer no `token`, `X-Token`, `appkey` com fallback.

Fluxo técnico resumido:
1. Usuário abre `/previsao` e passa no gate de permissão.
2. Front consulta `/api/faturamento` com filtros (data/período, vendedores).
3. API busca pedidos em aberto no Sankhya (TGFCAB + TGFITE + TGFPRO + TGFVEN + TGFPAR + cidade/UF), agrega por pedido e itens.
4. API consulta estoque em `TGFEST` por produtos retornados.
5. Front consolida KPIs, tabela de produtos, cobertura de estoque e cards/modais por status.

KPIs principais da tela:
- Total de pedidos
- Vendas
- Bonificações
- Trocas
- Não Confirmados
- Em Carga (quando habilitado)
- Peso agregado (kg) por agrupamento

Regras funcionais críticas:
- Classificação base por `CODTIPOPER`:
- `1001` = Venda
- `1051` = Bonificação
- `1053` = Troca
- “Não Confirmados” e “Em Carga” são visões operacionais da UI, baseadas em campos de status/liberação/carga.
- Cobertura de estoque por item:
- `SUFICIENTE` quando `estoque >= quantidade`
- `FALTA` quando `estoque < quantidade`, com cálculo de falta em unidade e kg.
- Conversão FD→UN em trocas (`1053`) tem regra específica no front (fator por `CONVERVOL`/`FATTOTAL`/`MEDAUX` ou parsing da descrição, ex.: `20X500G`).

Filtros e operação:
- Filtros por vendedores e cidades.
- Modal detalhado por tipo de pedido com busca e filtros avançados.
- Presets de cidades por vendedor para operação recorrente.
- Exportação de relatório PDF pela própria tela.

Cidades (fonte e fallback):
- Sincronização principal via `TSICUS` em dois blocos (`A-M` e `N-ZZZZZZ`) para reduzir risco com limite de 5000 linhas.
- Fallback sem join de UF quando necessário.
- Último fallback via cidades distintas de `TGFPAR`.

Riscos e cuidados para evitar regressão:
- Não quebrar filtros SQL para trazer universo de pedidos e filtrar no client.
- Não remover validação de datas (`YYYY-MM-DD`) e de vendedores numéricos.
- Não alterar classificação de tipo de pedido sem alinhamento de negócio.
- Não mudar regra de conversão de troca sem validar impacto operacional com logística.
- Manter mensagens claras de erro de conectividade (não mascarar falha como ausência de pedidos).

Checklist de validação da Previsão (obrigatório):
- Acesso bloqueado para usuário sem `previsao:interact`.
- Consulta com vendedor+cidade retornando totais coerentes.
- Consistência entre cards e modal detalhado.
- Cobertura (`SUFICIENTE`/`FALTA`) coerente com estoque retornado.
- Sincronização de cidades funcionando com fallback.
- Exportação PDF operacional.

---

## 4) Regras de acesso e escopo (obrigatórias)

Perfis relevantes:
- `SELLER`: vê apenas seus dados (exige vínculo válido)
- `SALES_SUPERVISOR`: vê equipe vinculada
- `IT_ANALYST` e `DEVELOPER`: acesso técnico/avançado (configurações e diagnóstico)

Regras mandatórias:
- Nunca retornar dados fora do escopo do perfil.
- Sempre validar vínculo (`sellerCode`) para `SELLER` e supervisor.
- Cache deve incluir token de escopo (`SUP:<code>`, `SELLER:<code>`) para evitar vazamento entre usuários.

---

## 5) Segurança: baseline obrigatório

### 5.1 Autenticação/sessão
- Cookies de auth devem manter: `HttpOnly`, `Secure` (prod), `SameSite=Strict`.
- Suportar refresh token e logout completo (incluindo impersonação, quando houver).
- 2FA/TOTP com recovery codes seguros.

### 5.2 Autorização
- Todo endpoint sensível deve validar usuário e permissão explicitamente.
- Exportações de RH devem ser restritas por permissão (ex.: `hr:read`) ou roles aprovadas.

### 5.3 API hardening
- Aplicar rate limiting por classe de rota (auth, geral, rotas pesadas Sankhya).
- Proteger cron com `CRON_SECRET` fail-closed.
- Health endpoint público deve expor apenas status mínimo.

### 5.4 Injeção/inputs
- Nunca aceitar entrada não validada em SQL de Sankhya.
- Para códigos de vendedor/produto usados em `IN (...)`, permitir apenas regex estrita (ex.: `^\d+$`).
- Usar validação estruturada (ex.: Zod) em payloads e query params.

### 5.5 Headers e front security
- Manter CSP e CORS restritivos conforme ambiente.
- Evitar `dangerouslySetInnerHTML`; se inevitável, tratar como exceção com revisão de segurança.

---

## 6) Integração Sankhya: padrão oficial

### 6.1 Autenticação
- Preferir OAuth2 (`/authenticate`) e fallback de sessão (`MobileLoginSP.login`) quando necessário.
- Não armazenar credenciais em código; usar Integration config criptografada.

### 6.2 Headers corretos
- `Authorization: Bearer <jwt>` quando disponível.
- `token` deve carregar bearer JWT (não API key estática) no modo cloud.
- `X-Token` com token estático da integração.
- `appkey` com fallback `config.appKey || config.token`.

### 6.3 Estratégia de endpoint
- Com bearer: priorizar gateway cloud e fallback on-prem.
- Sem bearer: on-prem apenas.
- Evitar tentativas redundantes de múltiplos endpoints sem necessidade.

### 6.4 SQL + Oracle
- Oracle trata `''` como `NULL`.
- Nunca usar padrão `NVL(TRIM(X), '') <> ''`.
- Usar `TRIM(X) IS NOT NULL`.

### 6.5 Limite de 5000 linhas
- Sempre filtrar no SQL para reduzir dataset na origem.
- Evitar carregar universo e filtrar em JavaScript.

### 6.6 Parsing resiliente
- Tratar respostas com `fields` e `fieldsMetadata`.
- Tratar rows em formato objeto e array.

### 6.7 Fallback em cascata
- SQL mais completo → SQL simplificado → SQL mínimo.
- Em cada SQL: endpoints por prioridade + variantes de payload.
- Capturar erro com rastreabilidade (sem vazar segredo).

---

## 7) Performance e eficiência: política de implementação

### 7.1 Regras imediatas
- Cachear token Sankhya com TTL seguro (evitar TTL longo que ultrapasse validade real).
- Usar `Cache-Control` HTTP alinhado com cache server-side.
- Deduplicar requests in-flight e limitar concorrência em rotas pesadas.
- Evitar N+1 e queries sem paginação/`take`.
- Adicionar índices Prisma/DB em colunas críticas de filtro/join/sort.

### 7.2 Frontend e UX
- Evitar múltiplos `fetch('/api/auth/me')` redundantes.
- Preferir estratégia consistente de cache client-side.
- Em dev, evitar avalanche de queries pesadas em paralelo (Node single-thread).
- Em erros de conectividade, exibir mensagem operacional clara (não confundir com “sem dados”).

### 7.3 PWA
- Manter versão do SW atualizada para invalidar cache antigo quando necessário.
- Garantir comportamento de loading/scroll estável em mobile.
- Sincronizar regras de cálculo entre dashboard web e PWA para evitar divergência.

---

## 8) Qualidade de código e arquitetura evolutiva

Problema conhecido:
- Monólitos grandes (`MetasWorkspace.tsx`, páginas extensas de supervisor/diretoria) elevam risco de regressão.

Diretriz obrigatória de evolução:
- Refatorar incrementalmente: tipos, helpers, cálculos e subcomponentes.
- Evitar “big-bang migration”.
- Introduzir mudanças por fatias funcionais pequenas com validação por etapa.

Padrões de implementação:
- Funções puras para regras de negócio.
- Separar camada de acesso a dados, transformação e apresentação.
- Comentários curtos apenas onde a regra não for óbvia.

---

## 9) Observabilidade, operação e incidentes

Métricas mínimas por rota crítica:
- Latência média/máx/última
- Taxa de erro 5xx
- Cache hit/miss
- Dedup hit rate
- Concorrência ativa e fila

Playbook para incidentes (ex.: 502/timeouts):
1. Confirmar saturação por rota e janela temporal.
2. Verificar Sankhya auth/token/latência externa.
3. Verificar cache hit rate e dedup.
4. Reduzir paralelismo e aplicar fallback controlado.
5. Comunicar erro funcional claro no front sem mascarar incidente.

---

## 10) Testes e homologação obrigatórios

Antes de release:
- `npm.cmd run type-check`
- `npm.cmd run build`
- Validar escopo por perfil (`SELLER`, `SUPERVISOR`, técnico)
- Validar autenticação, refresh, 2FA, logout e impersonação
- Validar endpoints de metas e PWA para mês corrente e meses passados
- Validar mensagens de erro de conectividade
- Validar telemetria e métricas de rotas críticas

Checklist funcional sensível:
- Segurança de cookies (`SameSite=Strict`, `HttpOnly`, `Secure` em prod)
- Rate limiting ativo
- Cron protegido com segredo válido
- Health sem vazamento de metadados sensíveis
- Export RH com autorização correta

---

## 11) Erros do passado a não repetir

- Cache de token com TTL maior que a validade real do token.
- Filtrar dados pesados no JavaScript em vez de filtrar no SQL.
- Disparar múltiplas queries pesadas simultâneas em ambiente de desenvolvimento.
- Migrar componente monolítico inteiro de uma vez sem quebra incremental.
- Tratar erro de backend como “sem pedidos/sem dados”.
- Divergir regras de cálculo entre dashboard web e PWA.
- Usar scripts de correção de dados sem avaliar efeitos colaterais (ex.: zerar targets críticos).

---

## 12) Regras de trabalho para o agente de IA

Sempre faça:
- Ler contexto local e documentação antes de alterar regras de metas.
- Preservar compatibilidade de negócio e escopo de segurança por perfil.
- Preferir mudanças pequenas, reversíveis e observáveis.
- Incluir logs/telemetria úteis em rotas críticas.
- Atualizar documentação de progresso após mudanças relevantes.

Nunca faça:
- Commit de segredo, token, URL sensível ou dado de cliente.
- Bypass de autenticação/autorização para “facilitar testes”.
- Alterações massivas sem plano de rollback.
- Otimização sem validação de impacto real (latência/custos/erros).

Critério de pronto (Definition of Done):
- Segurança preservada
- Escopo por perfil validado
- Performance não regrediu
- Build/type-check ok
- Documentação atualizada

---

## 13) Variáveis de ambiente e rotação de chaves

- `JWT_SECRET`: obrigatório
- `JWT_SECRET_LEGACY`: usar apenas em janela de rotação
- `CRON_SECRET`: obrigatório em produção
- Remover variáveis sem uso real (ex.: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, se não usados)

Rotação segura de JWT:
1. Publicar novo `JWT_SECRET` e manter antigo em `JWT_SECRET_LEGACY`.
2. Aguardar janela máxima de vida dos tokens.
3. Remover legado e redeploy.

---

## 14) Fontes consolidadas

Este manual foi consolidado dos documentos em `doc/`:
- `auditoria-performance-2026-04-29.md`
- `checklist-homologacao.md`
- `importa-vendedor-produto.md`
- `otimizacao-performance.md`
- `progresso.md`
- `relatorio-seguranca-2026-04-27.md`
- `seguranca.md`
- `troca-segura-de-chaves.md`

---

## 15) Resumo executivo para execução imediata

Prioridade máxima contínua:
1. Segurança (authz, rate limit, SQL seguro, cron/health hardening)
2. Escopo de dados correto por perfil
3. Performance em rotas Sankhya (cache, dedup, concorrência, SQL eficiente)
4. Estabilidade de UX no PWA e alinhamento com dashboard web
5. Refatoração incremental dos monólitos para reduzir risco de manutenção

Se houver dúvida entre velocidade e segurança, escolha segurança.
Se houver dúvida entre mudança grande e incremental, escolha incremental.
Se houver divergência entre docs antigas e comportamento atual em produção, validar no código e registrar atualização documental.
