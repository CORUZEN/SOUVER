# Módulo de Metas e PWA — Progresso Técnico

> Última atualização: 06/05/2026  
> Front principal: `src/components/metas/MetasWorkspace.tsx` e `src/app/(pwa)/app/supervisor/page.tsx`  
> APIs núcleo: `src/app/api/metas/sellers-performance/*` e `src/app/api/pwa/summary/route.ts`

---

## Status executivo da fase

Fase atual focada em quatro pilares: clareza de indicadores, estabilidade em produção (502/latência), controle de carga no Sankhya e governança de acesso por perfil (`DEVELOPER`, `IT_ANALYST`, `SALES_SUPERVISOR`, `SELLER`).

---

## Melhorias consolidadas (inclui últimas rodadas)

### 1) Distribuição de itens (regra de negócio e UX)
- Card reestruturado para leitura profissional, com melhor aproveitamento de espaço.
- Ajustes de texto e hierarquia visual em:
  - `Vendedores` (antes “Consolidado”).
  - `Cobertura da base`.
- Regra de cobertura revisada para refletir objetivo real:
  - base alvo = `% da base geral de clientes`;
  - atingimento considera cliente com ao menos 1 item positivado (não exige todos os itens por cliente).
- Indicador de superação de meta com destaque visual (`+X acima da meta`).
- Remoção de ruídos no topo do card e reorganização dos elementos.

### 2) Configuração avançada do card de distribuição
- Clique no card abre modal de configuração para metas personalizadas:
  - `% da base de clientes`;
  - `% de itens positivados`.
- Acesso ao modal restrito por perfil técnico (`DEVELOPER` e `IT_ANALYST`).
- Botão de diagnóstico adicionado no cabeçalho de “Metas gerais consolidadas” também com restrição por perfil técnico.

### 3) Diagnóstico operacional de cobertura
- Modal de diagnóstico para identificar clientes fora da cobertura esperada.
- Objetivo: explicar diferenças entre `Clientes únicos atendidos` e `Cobertura da base`, com evidência detalhada.

### 4) Cards executivos com descrições padronizadas
- Inseridas descrições empresariais no rodapé dos cards:
  - Clientes únicos atendidos;
  - Metas conquistadas;
  - Pedidos no mês.
- Textos revisados para linguagem mais objetiva e consistente.

### 5) Controle de erros e mensagens de falha
- Quando ocorre falha real de backend/conectividade, a UI deixa de exibir mensagem de “sem pedidos”.
- Novo padrão de comunicação de incidente:
  - “Instabilidade de conexão com a base comercial”;
  - orientação para tentar novamente em alguns minutos.
- Padronização de alerta em múltiplos blocos do módulo para não mascarar erro técnico como dado operacional.

### 6) PWA: rolagem mobile e comportamento de carregamento
- Correções de rolagem em Android/navegador para evitar travamento de scroll por região da tela.
- Ajustes na troca de mês:
  - evitar persistência de dados antigos enquanto novos dados carregam;
  - estado de carregamento visual centralizado com “Carregando...”;
  - refinamento de estilo para eliminar fundo escuro inadequado.
- Ajustes de loading para reduzir sensação de falha (barra/progresso e transição de fases).
- Texto de loading atualizado para `Carregando sistema`.

### 7) PWA: unificação de interface por perfil
- Página de vendedor unificada com a mesma experiência visual do supervisor.
- Vendedor passa a acessar o mesmo layout de painel (`/app/supervisor`), mantendo escopo de dados por perfil.

### 8) Vinculação obrigatória de usuários a vendedor/supervisor
- Gestão de usuários reforçada:
  - `SELLER` exige “Vendedor vinculado”;
  - `SALES_SUPERVISOR` exige “Supervisor de vendas”.
- Validação ponta a ponta (front + API) para impedir cadastro/edição inconsistente.
- `sellerCode` normalizado e validado contra allowlist ativa.

### 9) Escopo de dados por perfil nas APIs de metas/PWA
- Escopo por perfil aplicado nos endpoints principais:
  - `metas:sellers-performance`
  - `brand-weight`
  - `product-focus`
  - `item-distribution`
  - `pwa/summary`
- Chaves de cache passaram a incluir token de escopo (`SUP:<code>`, `SELLER:<code>`), evitando vazamento de contexto entre perfis.
- Respostas de erro explícitas quando perfil `SELLER` não possui vínculo válido.

### 10) Telemetria técnica e observabilidade
- Tela de telemetria criada para monitorar:
  - requisições por rota;
  - erros 5xx;
  - latência média/máxima/última;
  - cache hit rate;
  - deduplicação in-flight;
  - métricas de concorrência.
- Ações de operação disponíveis:
  - atualizar métricas;
  - zerar métricas.
- Breadcrumb removido da tela de telemetria para visual mais limpo.

### 11) Mitigação de avalanche concorrente no Sankhya
- Introdução/uso de controles de concorrência e cache de requisição em rotas críticas.
- Deduplicação de chamadas idênticas em janelas curtas para reduzir pressão no banco.
- Estrutura de telemetria para validar efetividade do cache e identificar gargalos.

### 12) Qualidade visual e consistência de layout
- Ajustes de separadores, espaçamento e truncamento de conteúdo em cards de metas.
- Remoção/organização de elementos que cortavam texto e números em telas compactas.
- Revisões de nomenclatura e microcopy em múltiplos pontos para padrão corporativo.

### 13) Alinhamento de weight targets entre PWA e Dashboard Web
- **Problema**: volume do vendedor Erivaldo Ferreira aparecia `0%` no PWA, mas corretamente no dashboard web.
- **Causa raiz**: o script `fix-erivaldo-meta.ts` zerou os `weightTargets` no banco local Prisma; o Dashboard Web faz fallback para os targets do Sankhya (`sankhya-targets`), mas o PWA usava apenas os dados locais.
- **Correção**: `src/app/api/pwa/summary/route.ts` agora também busca os `weightTargets` do Sankhya e aplica a mesma hierarquia de fallback do Dashboard Web:
  1. Sankhya live data por marca (`targetKg`);
  2. `manualKgByPeriod` (quando Sankhya conectado mas sem dado para o período);
  3. Legacy `targetKg` do bloco local.
- Isso elimina divergências permanentes entre PWA e Dashboard para qualquer vendedor cujos targets locais tenham sido alterados/zerados.

### 14) Filtro de base de clientes por data de cadastro (DTCAD)
- **Problema**: o card "Clientes únicos atendidos" mostrava o total atual de clientes (2.777) como denominador, mesmo quando o usuário selecionava meses anteriores (ex: abril).
- **Causa**: a query SQL em `buildSellerBaseSqlCandidates` (API `sellers-performance`) não recebia o período e retornava sempre o total atual de clientes ativos no Sankhya.
- **Correção**: `src/app/api/metas/sellers-performance/route.ts` agora recebe `endDateExclusive` e filtra `TGFPAR.DTCAD < TO_DATE(...)` nas 4 variantes de query. Isso garante que o denominador reflita apenas clientes cadastrados até o final do período selecionado.
- Afeta tanto o **Dashboard Web** quanto o **PWA**, pois ambos consomem a mesma API.

### 15) Indicador de novos clientes no card de cobertura
- **Melhoria**: a descrição do card "Clientes únicos atendidos" agora mostra quantos clientes foram **novos no mês selecionado** (ex: "15 clientes novos cadastrados em Março de 2026").
- **Cálculo**: simples subtração entre `totalBaseClients` do período atual e do período anterior (`previousPeriodScopedTotals`), usando dados que o Dashboard Web já carrega.
- Quando não há período anterior ou não há novos clientes, mantém a descrição padrão de cobertura.

### 16) Redesign dos cards executivos do PWA (Supervisor, Vendedor, Diretoria)
- **Card Item Foco** (substitui "Peso Total Bruto") em todas as interfaces PWA:
  - Mostra a meta do item foco agregada do escopo atual (clientes ou kg, conforme configuração do bloco).
  - Exibe realizado / meta com percentual de atingimento.
  - Ícone `Star`, layout compacto e profissional.
  - No app da **Diretoria**, respeita os filtros de supervisor/vendedor selecionados.
- **Card Volume Geral** (substitui "Valor Total dos Pedidos") em todas as interfaces PWA:
  - Label centralizado "Meta de Volume dos Grupos" com seta discreta indicando expansão.
  - **Clique para expandir** e revelar progresso detalhado por grupo de produto (CAFÉS, GRÃOS, etc.), com barras de progresso coloridas, metas e vendidos em kg.
  - Filtra apenas grupos com meta configurada (`targetKg > 0`), eliminando grupos indesejados.
  - Dados agregados do escopo atual, mês completo (não por semana).
  - Ícone `BarChart2`, transição suave, design consistente.

### 17) Melhorias no menu lateral (Sidebar)
- **Logística auto-expandida**: ao acessar a página "Previsão de Pedidos" (`/previsao`), o menu "Logística" expande automaticamente, mostrando a origem da página.
- **Badge "Novo!" em Logística**: indicador elegante e profissional ao lado do item "Logística", com cor âmbar/dourada e leve glow, destacando que há novidade disponível.

### 18) Redesign dos stats da Área Dev
- **Card "Extensões"** substituiu "Grupos" na Central do Desenvolvedor.
- Ordem dos cards ajustada: **Usuários → Cargos → Módulos → Extensões** (Extensões como último).
- Valores atualizados para refletir a realidade atual do sistema.

### 19) Bump de versão do PWA para invalidação de cache
- Versão atualizada de `v1.01.632` → `v1.01.633` em `src/generated/app-version.ts` e `public/sw.js`.
- Isso força o service worker a reinstalar e limpar caches antigos nos dispositivos dos usuários no próximo acesso.

---

## Correções técnicas críticas tratadas

1. Persistência e validações de vínculo de usuário:
- endurecimento da regra para papéis que exigem `sellerCode`.

2. Incidentes de 502/timeout em rotas pesadas:
- melhorias de cache, dedup e concorrência;
- retorno de erro funcional mais claro para o usuário final.

3. Inconsistência de feedback operacional:
- separação entre “sem dados do período” e “falha de conexão/infra”.

---

## Arquivos-chave desta etapa

- `src/components/metas/MetasWorkspace.tsx`
- `src/app/(pwa)/app/page.tsx`
- `src/app/(pwa)/app/vendedor/page.tsx`
- `src/app/(pwa)/app/supervisor/page.tsx`
- `src/lib/client/auth-me-cache.ts`
- `src/lib/server/request-cache.ts`
- `src/lib/server/concurrency-limit.ts`
- `src/lib/server/telemetry.ts`
- `src/app/api/pwa/summary/route.ts`
- `src/app/api/metas/sellers-performance/route.ts`
- `src/app/api/metas/sellers-performance/brand-weight/route.ts`
- `src/app/api/metas/sellers-performance/product-focus/route.ts`
- `src/app/api/metas/sellers-performance/item-distribution/route.ts`
- `src/app/(dashboard)/dev/gestao-usuarios/page.tsx`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/components/ui/Breadcrumb.tsx`

---

## Riscos e pendências ativas

1. Validar sessão ativa após alteração de vínculo (`sellerCode`) para evitar cache de identidade desatualizado no login.
2. Consolidar testes automatizados para:
- escopo por perfil (`SELLER`/`SUPERVISOR`);
- mensagens de erro de conectividade;
- dedup/cache/concurrency em rotas críticas.
3. Evoluir playbook operacional de incidentes 502 (thresholds e ações recomendadas).
4. Considerar reavaliação do script `fix-erivaldo-meta.ts`: se o objetivo era apenas zerar a meta financeira, o script não deveria zerar `weightTargets` (ou deveria sincronizar com Sankhya em seguida).

---

## Checklist rápido de release (Metas + PWA)

- [ ] `npm.cmd run type-check`
- [ ] `npm.cmd run build`
- [ ] validar login `SELLER` com vínculo e escopo individual de dados
- [ ] validar login `SALES_SUPERVISOR` com escopo da equipe
- [ ] validar card de distribuição (regras, textos e modal)
- [ ] validar mensagens de erro de conectividade em todos os blocos
- [ ] validar rolagem mobile (Android/iOS + navegador mobile)
- [ ] validar telemetria (`/metas/telemetria`) com métricas atualizando
