# Módulo de Metas e PWA — Progresso Técnico

> Última atualização: 23/04/2026  
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
