# SOUVER - Sistema Ouro Verde
## Plano Executivo de Progresso e Conclusao

---

**Empresa:** Fabrica Cafe Ouro Verde  
**Documento:** Controle Mestre de Execucao  
**Versao:** 3.0  
**Data de referencia:** 19/03/2026  
**Status geral do programa:** Em andamento (entrega funcional ampla, com pendencias criticas de integracao e consolidacao final)

---

## 1) Objetivo deste documento

Este documento e a fonte oficial de controle do desenvolvimento do SOUVER.  
Ele consolida:

- escopo aprovado no `instructions.md`;
- classificacao das etapas por fase;
- status atual de execucao;
- backlog obrigatorio de fechamento;
- ordem de passos para conclusao completa do projeto.

---

## 2) Escopo oficial consolidado (base: `instructions.md`)

O projeto deve entregar uma plataforma corporativa integrada com:

- autenticacao, usuarios, perfis e RBAC granular;
- dashboard executivo e indicadores por setor;
- producao, logistica/estoque, qualidade e RH;
- contabilidade gerencial e relatorios executivos;
- comunicacao interna em tempo real;
- auditoria completa e rastreabilidade ponta a ponta;
- integracoes externas (Sankhya + APIs futuras);
- jobs, eventos e processamento assincrono;
- seguranca empresarial (2FA, sessoes, hardening, logs);
- preparacao para modo desktop e expansao modular.

---

## 3) Painel executivo de fases

| Fase | Nome | Status | Avanco estimado | Observacao executiva |
|---|---|---|---:|---|
| 1 | Fundacao | Concluida | 100% | Base arquitetural, auth, RBAC, dashboard inicial, auditoria e design system base entregues |
| 2 | Operacao Essencial | Concluida | 100% | Producao, logistica, chat, relatorios iniciais e exportacoes entregues |
| 3 | Controle Avancado | Concluida | 100% | Qualidade, RH, contabilidade, seguranca avancada e notificacoes evoluidas entregues |
| 4 | Integracoes e Inteligencia | Em andamento | 78% | Estrutura pronta; falta sincronizacao real com Sankhya e APIs corporativas adicionais |
| 5 | Expansao e Consolidacao | Em andamento | 62% | Observabilidade/compliance/analytics avancaram; faltam carga, desktop e expansoes finais |

**Avanco global estimado do programa:** **88%**

---

## 4) Classificacao completa das etapas (roadmap corporativo)

### Fase 1 - Fundacao

| Etapa | Escopo | Status |
|---|---|---|
| 1.1 | Setup e arquitetura base | Concluida |
| 1.2 | Design System corporativo inicial | Concluida |
| 1.3 | Banco de dados (modelagem inicial) | Concluida |
| 1.4 | Autenticacao e seguranca base | Concluida |
| 1.5 | Usuarios, perfis e permissoes (RBAC) | Concluida |
| 1.6 | Layout base e navegacao | Concluida |
| 1.7 | Dashboard executivo inicial | Concluida |
| 1.8 | Auditoria e logs obrigatorios | Concluida |

### Fase 2 - Operacao Essencial

| Etapa | Escopo | Status |
|---|---|---|
| 2.1 | Modulo de Producao | Concluida |
| 2.2 | Modulo de Logistica/Deposito/Armazenamento | Concluida |
| 2.3 | Relatorios iniciais e exportacoes | Concluida |
| 2.4 | Comunicacao interna em tempo real | Concluida |

### Fase 3 - Controle Avancado

| Etapa | Escopo | Status |
|---|---|---|
| 3.1 | Qualidade e nao conformidades | Concluida |
| 3.2 | Recursos Humanos | Concluida |
| 3.3 | Contabilidade e gestao administrativa | Concluida |
| 3.4 | Indicadores comparativos e dashboard refinado | Concluida |
| 3.5 | Seguranca avancada e politicas de sessao | Concluida |
| 3.6 | Notificacoes avancadas | Concluida |

### Fase 4 - Integracoes e Inteligencia

| Etapa | Escopo | Status |
|---|---|---|
| 4.1 | Integracao com Sankhya (ERP) | Parcial |
| 4.2 | Integracoes adicionais + eventos/jobs | Parcial |
| 4.3 | Relatorios executivos evoluidos e BI | Concluida |
| 4.4 | Automacao de rotinas | Concluida |

### Fase 5 - Expansao e Consolidacao

| Etapa | Escopo | Status |
|---|---|---|
| 5.1 | Performance e escalabilidade em producao | Parcial |
| 5.2 | Empacotamento desktop | Nao iniciado |
| 5.3 | Compliance e refinamento de auditoria | Concluida |
| 5.4 | Analytics avancado e modulos adicionais | Parcial |

---

## 5) Backlog oficial de fechamento (o que falta desenvolver)

### Prioridade critica (bloqueia conclusao da Fase 4 e go-live corporativo completo)

| ID | Item pendente | Fase/Etapa | Prioridade | Dependencias | Resultado esperado |
|---|---|---|---|---|---|
| P1 | Autenticacao real com API Sankhya | 4.1 | Critica | Credenciais, contrato tecnico, ambiente de homologacao | Integracao autenticada e estavel |
| P2 | Rotina real de sincronizacao Sankhya (import/sync) | 4.1 | Critica | P1 | Sincronizacao funcional com logs, retry e monitoramento |
| P3 | Sincronizacao com APIs corporativas adicionais | 4.2 | Alta | Definicao de provedores e contratos | Camada de integracao reutilizavel em producao |

### Prioridade alta (estabilidade operacional e readiness empresarial)

| ID | Item pendente | Fase/Etapa | Prioridade | Dependencias | Resultado esperado |
|---|---|---|---|---|---|
| P4 | Testes de carga e stress com relatorio formal | 5.1 | Alta | Ambiente de teste e cenarios | Capacidade validada para uso intensivo |
| P5 | Definir estrategia desktop (Electron ou equivalente) | 5.2 | Alta | Decisao de arquitetura | Diretriz tecnica aprovada |
| P6 | Adaptacao para empacotamento desktop | 5.2 | Alta | P5 | Build desktop funcional |
| P7 | Testes de desktop (instalacao, atualizacao, estabilidade) | 5.2 | Alta | P6 | Operacao desktop validada |

### Prioridade estrategica (expansao de longo prazo)

| ID | Item pendente | Fase/Etapa | Prioridade | Dependencias | Resultado esperado |
|---|---|---|---|---|---|
| P8 | Inclusao de novos modulos conforme operacao real | 5.4 | Media | Descoberta funcional com areas de negocio | Backlog de expansao priorizado |
| P9 | Expansao de integracoes externas | 5.4 | Media | P3 e roadmap corporativo | Ecossistema integrado progressivamente |

---

## 6) Plano de execucao ate conclusao completa

### Onda 1 - Fechar Integracoes Core (Fase 4)

| Ordem | Acao | Entrega |
|---|---|---|
| 1 | Validar contrato tecnico Sankhya (auth, endpoints, limites, payloads) | Documento tecnico aprovado |
| 2 | Implementar autenticacao real e gestao de token | Integracao autenticada |
| 3 | Implementar jobs de sincronizacao real (idempotencia + retry + logs) | Sync operacional |
| 4 | Criar testes de integracao e painel de saude de sync | Operacao monitorada |
| 5 | Integrar 1 API corporativa adicional piloto | Modelo replicavel aprovado |

### Onda 2 - Hardening final (Fase 5.1)

| Ordem | Acao | Entrega |
|---|---|---|
| 6 | Planejar cenarios de carga (pico e uso simultaneo por perfil) | Plano de testes |
| 7 | Executar testes e identificar gargalos | Relatorio tecnico com evidencias |
| 8 | Aplicar otimizacoes finais (DB/API/filas/cache) | Baseline de performance aprovada |

### Onda 3 - Consolidacao desktop (Fase 5.2)

| Ordem | Acao | Entrega |
|---|---|---|
| 9 | Decidir stack desktop e arquitetura de distribuicao | ADR aprovado |
| 10 | Criar build desktop inicial + pipeline de release | Pacote instalavel |
| 11 | Validar instalacao/atualizacao/operacao em ambiente real | Homologacao desktop |

### Onda 4 - Expansao dirigida por negocio (Fase 5.4)

| Ordem | Acao | Entrega |
|---|---|---|
| 12 | Priorizar modulos novos com diretoria e operacao | Roadmap trimestral |
| 13 | Priorizar novas integracoes externas por ROI operacional | Plano de integracoes |

---

## 7) Critério de conclusao do programa (Definition of Done)

O desenvolvimento completo do SOUVER sera considerado finalizado quando:

- Fase 4 estiver 100% concluida com sincronizacao real Sankhya em producao;
- Fase 5.1 possuir testes de carga aprovados com relatorio formal;
- Fase 5.2 possuir versao desktop funcional com ciclo de atualizacao validado;
- backlog critico (P1-P7) estiver encerrado;
- compliance e auditoria permanecerem ativos em todos os modulos;
- aprovacao tecnica e operacional for registrada pela gestao do projeto.

---

## 8) Riscos principais e mitigacao

| Risco | Impacto | Mitigacao executiva |
|---|---|---|
| Dependencia externa da Sankhya (credencial/contrato/API) | Alto | Tratar como trilha critica com SLA e ambiente dedicado |
| Ausencia de testes de carga formais | Alto | Congelar go-live ampliado ate relatorio de capacidade |
| Decisao tardia sobre desktop | Medio/Alto | Definir ADR imediatamente apos fechamento das integracoes core |
| Crescimento de escopo sem priorizacao | Medio | Operar backlog trimestral com comite de priorizacao |

---

## 9) Governanca de atualizacao deste arquivo

Regras de manutencao do `progress.md`:

- atualizar status por etapa ao final de cada entrega relevante;
- registrar data da ultima atualizacao e resumo da sessao;
- nao marcar item como concluido sem evidencia tecnica validada;
- manter backlog de pendencias com prioridade e dependencia claras;
- usar este documento como referencia unica para planejamento.

---

## 10) Resumo executivo final (19/03/2026)

O SOUVER ja possui base corporativa robusta e ampla cobertura funcional.  
As pendencias restantes estao concentradas em **integracao real com ecossistema externo** e **consolidacao final de escala/desktop**.

Porta de saida para fechamento completo:

1. concluir Sankhya real + APIs adicionais;
2. validar carga e stress com evidencias;
3. concluir trilha desktop (decisao, implementacao e homologacao);
4. fechar backlog critico e formalizar aprovacao final.

---

---

## 11) Log de sessoes de desenvolvimento

### Sessao 15/04/2026 — Correcoes de dados Sankhya + PWA completo

#### Correcoes de precisao de dados (Modulo Metas)

**Bug: CODTIPOPER incorreto nos relatorios de performance**
- Arquivos corrigidos: `sellers-performance/route.ts`, `item-distribution/route.ts`, `product-focus/route.ts`
- Problema: as consultas usavam `CODTIPOPER = 1101` (Nota Fiscal de venda) em vez de `CODTIPOPER = 1001` (Pedido de venda), que e o tipo utilizado pelo Portal de Vendas da Sankhya
- Impacto: contagem de pedidos, faturamento e peso bruto estava divergindo do Portal de Vendas (ex.: sistema mostrava 150 pedidos, Sankhya mostrava 243)
- Solucao: substituicao global de `1101` por `1001` nos tres arquivos de rota

**Bug: Contagem de clientes atendidos subestimada**
- Arquivo corrigido: `MetasWorkspace.tsx`
- Problema: `totalDistinctClients` usava `stageMetrics.FULL.clientCodes.size`, que excluia pedidos feitos fora das datas de ciclo (finais de semana, feriados, dias sem etapa configurada), pois o loop continha `if (!stage) continue`
- Impacto: sistema mostrava 119 clientes atendidos, Sankhya mostrava 138
- Solucao: adicao de `allMonthClientCodes` — um `Set<string>` construido antes do filtro de ciclo iterando todos os pedidos do mes sem restricao de etapa

**Bug: Permissoes de modulo nao salvas corretamente**
- Arquivo corrigido: `api/dev/permissions/role/[id]/route.ts`
- Problema: o handler PUT chamava `ensureMetasPermissionCatalog()` mas nao `ensureModulePermissionCatalog()`, fazendo com que os registros de permissao de modulo nao existissem no banco. O `deleteMany` limpava tudo e o `createMany` nao criava nada
- Solucao: adicao de `await ensureModulePermissionCatalog()` no handler PUT

**Bug: Flash de seguranca na sidebar (todos os itens visiveis durante carregamento)**
- Arquivo corrigido: `Sidebar.tsx`
- Problema: estado `modulePermissions` inicializado como `null` fazia com que todos os itens do menu aparecessem antes da API responder, depois sumissem — risco de seguranca visual
- Solucao: introducao de flag `modulePermissionsLoaded: boolean`; todos os itens ocultados com `if (!modulePermissionsLoaded) return null` ate confirmacao da API; secoes de cabecalho ocultadas quando sem itens visiveis; handler `.catch()` agora define `setModulePermissionsLoaded(true)` para nao travar o estado em erro de rede

---

#### Feature: PWA (Progressive Web App) completo

**Infraestrutura base**
- `public/manifest.json` — manifest PWA com `name`, `short_name`, `start_url: /app`, `display: standalone`, `theme_color: #10b981`, `background_color: #0f172a`, icones e atalho para `/app/supervisor`
- `public/sw.js` — service worker completo com:
  - estrategia cache-first para assets estaticos (`/branding/`, `/_next/static/`, `/manifest.json`)
  - estrategia network-first com TTL de 2 min para `/api/pwa/summary`
  - fallback offline para `/app`
  - limpeza automatica de versoes antigas de cache no `activate`
- `src/app/layout.tsx` — adicionados: link `rel=manifest`, metas `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `theme-color`, e script inline de registro do service worker

**Rotas PWA (grupo `(pwa)` — layout sem sidebar)**
- `src/app/(pwa)/layout.tsx` — layout standalone minimal (sem sidebar, sem header de desktop)
- `src/app/(pwa)/app/page.tsx` — roteador de cargo: `COMMERCIAL_SUPERVISOR` → `/app/supervisor`, `SELLER` → `/app/vendedor`, demais cargos → `/metas`
- `src/app/(pwa)/app/supervisor/page.tsx` — painel mobile do Supervisor Comercial:
  - barra superior com nome, cargo, botoes de atualizar/voltar/sair, indicador online/offline
  - seletor de periodo (mes/ano) com navegacao por chevrons
  - cartao de meta consolidada com barra de progresso colorida (emerald/amber/rose)
  - grid de metricas: pedidos, peso bruto, faturamento total
  - lista ranqueada de vendedores com badge de status (Superou / Meta Batida / Em Andamento / Critico)
  - expansao por vendedor com metricas detalhadas: valor, meta, pedidos, clientes, peso, ticket medio, gap para meta
  - estado de loading com skeleton, estado de erro com retry
- `src/app/(pwa)/app/vendedor/page.tsx` — painel mobile do Vendedor:
  - mesmo padrao de barra superior e seletor de periodo
  - cartao principal de progresso vs meta com porcentagem e barra colorida
  - grid de metricas: pedidos, clientes atendidos vs base, peso bruto, ticket medio
  - lista colapsavel de pedidos do mes (ordenada por data decrescente, codigo, cliente, valor, peso)

**API leve para PWA**
- `src/app/api/pwa/summary/route.ts` — endpoint GET sem chamadas ao Sankhya; le `metasConfig` do banco; retorna: `year`, `month`, `roleCode`, `isSupervisor`, `cycle`, `sellers[]` (com `monthlyTarget`), `totalMonthlyTarget`, `sellerCount`, `configuredAt`

**Banner de instalacao**
- `src/components/ui/PwaInstallBanner.tsx` — bottom sheet de instalacao visivel apenas em dispositivos moveis (< 768px):
  - detecta se ja esta instalado via `display-mode: standalone` (nao exibe se sim)
  - Android/Chrome: captura evento `beforeinstallprompt`, exibe botao "Instalar App" com animacao de loading
  - iOS/Safari: exibe instrucoes passo a passo (Safari nao suporta o evento nativo)
  - chips de beneficio: "Funciona offline", "Acesso rapido", "Sem navegador"
  - animacao `slideUp` ao aparecer, descarte por sessao via `sessionStorage`
- `src/app/(auth)/layout.tsx` — banner adicionado ao layout de autenticacao (aparece nas paginas de login e recuperacao de senha)

**Redirecionamento automatico mobile**
- `src/components/layout/MobilePwaRedirect.tsx` — componente client sem UI; injetado no layout do dashboard; redireciona `COMMERCIAL_SUPERVISOR` e `SELLER` mobile (< 768px) automaticamente para `/app` quando acessam qualquer pagina desktop

---

#### Resultado final da sessao
- Build produtivo (`npx next build`) passou sem erros em todas as entregas
- Rotas ativas apos build: `/app`, `/app/supervisor`, `/app/vendedor`
- Nenhuma regressao identificada nos modulos existentes

---

### Sessao 16-17/04/2026 — Evolucao PWA: scoring completo, visuais, versionamento e performance

#### Modulo Metas — PWA supervisor: paridade completa com o sistema web

**Bug: Est. Premiacao exibindo R$0,00 para todos os vendedores**
- Arquivo corrigido: `src/app/api/pwa/summary/route.ts`
- Causa raiz: `cycleWeeks` retornava `null` quando `week1StartDate` nao estava configurado diretamente; o calculo de pontuacao dependia das semanas e colapsava para zero
- Solucao: `cycleWeeks` agora le primeiro `weekPeriods` salvo diretamente no `monthConfig` (exatamente o que o `MetasWorkspace` persiste), com fallback de reconstrucao a partir de `week1StartDate` + `closingWeekEndDate`

**Bug: maxReward zerado para perfis ANTIGO_1 / ANTIGO_15**
- Arquivo corrigido: `src/app/api/pwa/summary/route.ts`
- Causa: curto-circuito `isPercentProfile ? 0 : ...` impedia o calculo correto do premio maximo
- Solucao: calculo sempre soma os `rewardValue` de todas as regras, independente do tipo de perfil

**Feature: scoring KPI completo no PWA (paridade com web)**
- Arquivo: `src/app/(pwa)/app/supervisor/page.tsx`
- Implementados no cliente PWA os mesmos algoritmos de pontuacao do sistema web para todos os tipos de KPI:
  - `META_FINANCEIRA`: progressao linear entre faixas de faturamento
  - `BASE_CLIENTES`: clientes unicos atendidos vs meta de base
  - `VOLUME`: integracao com API `/api/metas/sellers-performance/brand-weight`; logica `getVolumeProgressByClosestTargets` com multiplas marcas
  - `DEVOLUCAO`: valor de devolucoes vs faturamento (percentual invertido)
  - `INADIMPLENCIA`: titulos em aberto e vencidos vs faturamento
  - `DISTRIBUICAO`, `ITEM_FOCO`, `RENTABILIDADE`: marcados como `isComputable: false` (requerem dados adicionais nao disponiveis no cliente)

**Feature: painel de KPI por semana no detalhe do vendedor**
- Componente adicionado: `KpiStagesPanel`
- Agrupa KPIs por etapa (W1 / W2 / W3 / FECHAMENTO) com badge de status (em andamento / encerrada / aguardando)
- Barra de progresso individual por KPI com icone de check quando atingido
- KPIs nao computaveis exibem "?" com legenda "Requer dados adicionais"
- Mapa de icones por tipo: `DollarSign`, `Users`, `Package`, `LayoutGrid`, `Star`, `RotateCcw`, `Ban`, `BarChart2`

**Feature: estimativa de premiacao com formula correta por perfil**
- `estimatePremioEarned`: ANTIGO_1/ANTIGO_15 agora usa scoring KPI real em vez de progressao linear; exibe em percentual (ex.: `0,87%`)
- `estimatePremioMax`: ANTIGO_1/ANTIGO_15 exibe o maximo em percentual; outros perfis exibem em BRL

**Feature: hierarquia visual da celula de premiacao**
- Componente `PremioCell`: valor ganho exibido com destaque; valor maximo como sufixo discreto (`text-[10px] font-normal text-surface-500`)

**Feature: fracao de clientes unicos no cartao do sistema web**
- Arquivo: `src/components/metas/MetasWorkspace.tsx`
- Cartao "Clientes Unicos Atendidos" agora exibe `atendidos / base_total` (ex.: `138 / 412`)
- Calculo: `filteredTotalBaseClients` soma `baseClientCount` de cada vendedor no filtro ativo
- Estilo: fracao em `font-bold text-indigo-300` para diferenciar sem perder legibilidade

---

#### Infraestrutura PWA: versionamento automatico de cache

**Feature: CACHE_VERSION do service worker sincronizado com a versao do app**
- Arquivo modificado: `scripts/sync-app-version.mjs`
- Problema: `public/sw.js` tinha `CACHE_VERSION = 'ov-pwa-v1'` hardcoded; caches antigos nao eram invalidados em novos deploys
- Solucao: o script de sincronizacao agora tambem faz patch na linha `CACHE_VERSION` do `sw.js`, substituindo pelo padrao `ov-pwa-v{APP_VERSION}` (ex.: `ov-pwa-v1.00.282`)
- Fluxo automatico: `predev` / `prebuild` → `version:sync` → `app-version.ts` atualizado + `sw.js` CACHE_VERSION atualizado → browser detecta SW alterado → reinstala SW → activate deletes caches antigos com prefixo `ov-pwa-` → PWA busca assets frescos

---

#### Performance PWA: conversao de logos para WebP

**Feature: logos convertidos para WebP com reducao significativa de tamanho**
- Ferramenta: `sharp` (ja disponivel no projeto), qualidade 90, effort 6
- Resultados:

| Arquivo | PNG | WebP | Reducao |
|---|---|---|---|
| `ouroverde.png` | 115 KB | 38 KB | -67% |
| `ouroverde-badge.png` | 43 KB | 9 KB | -79% |
| `graoverde.png` | 124 KB | 41 KB | -67% |

- Arquivos PNG originais mantidos em disco para uso no `manifest.json` (compatibilidade maxima com instalacao PWA no iOS/Android)
- Todos os `<Image>` nas paginas PWA atualizados para `.webp`

**Fix: aviso de LCP (Largest Contentful Paint) no PWA**
- Arquivos corrigidos: `src/components/pwa/PwaLoadingScreen.tsx`, `src/app/(pwa)/app/supervisor/page.tsx`, `src/app/(pwa)/app/vendedor/page.tsx`
- Causa: logo principal (256px) no `PwaLoadingScreen` e logos de header (48px) nao tinham `priority`, gerando aviso de LCP e carregamento subotimo
- Solucao: adicionado `priority` em todos os `<Image>` acima do fold nas paginas PWA; Next.js injeta automaticamente `fetchpriority="high"` e `loading="eager"`
- Service worker (`public/sw.js`): lista de precache atualizada de `.png` para `.webp`

---

#### Resultado final da sessao
- Nenhuma regressao introduzida nos modulos existentes
- PWA com scoring 100% pareado ao sistema web para KPIs computaveis
- Cache do PWA versionado automaticamente a cada commit/deploy
- Tempo de carregamento inicial do PWA reduzido com logos WebP e LCP otimizado

---

**Ultima atualizacao:** 17/04/2026  
**Responsavel pelo controle:** Time de Desenvolvimento SOUVER
