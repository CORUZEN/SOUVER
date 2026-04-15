# Módulo de Metas — Progresso Técnico

> Última atualização: 15/04/2026  
> Workspace principal: `src/components/metas/MetasWorkspace.tsx`  
> APIs núcleo: `src/app/api/metas/sellers-performance/*`

---

## Status executivo da fase

Fase atual com foco em fechamento operacional, consistência de regras por perfil de vendedor e confiabilidade da persistência (UI + API + allowlists + configuração mensal).

---

## Melhorias consolidadas (últimas rodadas)

### 1) Perfis de vendedor e parametrização por tipo
- Cadastro de perfil de vendedor na allowlist com os tipos:
  - `NOVATO`
  - `ANTIGO_1` (antigo 1%)
  - `ANTIGO_15` (antigo 1,5%)
  - `SUPERVISOR`
- Coluna de tipo adicionada na lista de vendedores para facilitar identificação operacional.
- Fluxo de bloco de KPIs adaptado para respeitar o perfil do vendedor ativo.

### 2) Bloco “Grupos de parâmetros por vendedor”
- Ações de produtividade consolidadas:
  - `Aplicar a todos os vendedores`
  - `Restaurar padrões`
  - `Novo KPI`
  - `Excluir grupo`
- Remoção de ruídos visuais:
  - Removida linha “Perfil de KPIs: ...” abaixo do seletor.
  - Removido sufixo `(1)` ao lado dos nomes no seletor de grupo ativo.
  - Botão inline `Adicionar vendedor` (abaixo de “Vendedores neste bloco”) ocultado quando já existe vendedor no bloco.

### 3) “Aplicar para todos” com escopo profissional por perfil
- Modal de confirmação profissional para aplicar parâmetros.
- Lista de vendedores com seleção individual e “selecionar todos”.
- Escopo isolado por perfil do bloco ativo:
  - Se estiver em `Novato`, aplica somente em novatos.
  - Se estiver em `Antigo (1%)`, aplica somente nesse grupo.
  - Se estiver em `Antigo (1,5%)`, aplica somente nesse grupo.
  - Se estiver em `Supervisor`, aplica somente em supervisores.
- Proteções adicionais para impedir aplicação fora do grupo elegível.

### 4) Persistência de perfil e recuperação contra degradação
- Ajustes em `seller-allowlist-store` para evitar perda de `profileType` durante sincronização/salvamento.
- Lógica de recuperação para cenários em que tudo volta para `NOVATO` por inconsistência de dados legados.
- Fallback de resolução por `id`, `code`, `name` e nome curto para manter o perfil correto no carregamento.

### 5) Configuração mensal com fallback inteligente
- Se o mês alvo não tiver configuração salva, o sistema busca automaticamente a configuração mais próxima:
  - prioriza mês anterior;
  - usa próximo mês quando não houver anterior.
- Evita cenário de “sumiu tudo” ao alternar mês/ano.

### 6) Lista de produtos (UX de gestão)
- Ordenação clicável nas colunas da tabela:
  - ativo, código, descrição, grupo, unidade padrão, mobilidade.
- Ordenação padrão definida por `grupo` (ascendente).
- Ajuste de nomenclatura:
  - “Marca” -> “Grupo”
  - “Filtro por marca/categoria” -> “Filtro por grupo/categoria”.

### 7) Desempenho individual de vendedores
- Coluna lateral trocada de `Pontuação` para `Premiação atual`.
- Inclusão de `Clientes atendidos` no cabeçalho da linha de vendedor.
- Formato atualizado para `X/X` (ex.: `89/143`).

### 8) Premiação por perfil (dinheiro x percentual)
- `NOVATO`: mantém premiação em R$ (modelo atual).
- `ANTIGO_1` e `ANTIGO_15`: premiação por percentual acumulado (%), com teto por perfil:
  - `ANTIGO_1`: até 1,00%
  - `ANTIGO_15`: até 1,50%
- Tabela de KPIs adapta coluna para `Premiação (%)` nos perfis percentuais.
- Total do bloco mostra o acumulado percentual contra teto (ex.: `1,23% de 1,50%`).
- Cartões/resumos de premiação respeitam o modo do perfil na exibição.
- Custo total em R$ não mistura premiações percentuais dos perfis antigos.

### 9) Indicadores de origem Sankhya
- Remoção dos “cards/tag Sankhya” verdes em pontos onde estava poluindo visualmente a leitura principal.

### 10) Painel “Metas de peso por grupo de produto” (reformulação executiva)
- Substituição do bloco antigo de premiação por uma visão estratégica de metas de peso por grupo.
- Alternância entre:
  - `Visão geral`
  - `Por vendedor`
- Inclusão de:
  - cards executivos (`Meta total`, `Vendido`, `Atingimento geral`, `Grupos no alvo`);
  - tabela de grupos com progresso e status;
  - coluna lateral `Progresso por vendedor` com ranking clicável.

### 11) Item foco por vendedor (compacto e operacional)
- Bloco de item foco exibido somente no modo `Por vendedor`.
- Layout compacto em duas linhas com colunas:
  - `Item foco`
  - `Meta`
  - `Realizado`
  - `Progresso`
  - `Status`
- Remoção de cabeçalhos/elementos redundantes para reduzir ruído visual.
- Carregamento de descrição do produto foco com prefetch para melhorar consistência no dashboard.

### 12) Ajustes finos de UX/visual (ranking e tabelas)
- Correção do limite de altura do ranking para evitar cards cortados pela metade.
- Sincronização de altura com a coluna da esquerda no bloco de metas de peso.
- Padronização de labels/status:
  - `Crítico` -> `Atenção`
  - `Atenção` -> `Quase lá`
- Renomeação do título lateral:
  - `Ranking de atingimento por vendedor` -> `Progresso por vendedor`.

### 13) Supervisão por vendedor (novo recurso)
- Inclusão de coluna `Supervisão` na tela `Lista de vendedores liberados`.
- Definição do supervisor responsável por vendedor via seletor por linha.
- Regras de consistência:
  - vendedor do tipo `SUPERVISOR` não recebe supervisor (campo não aplicável);
  - mudança de tipo para `SUPERVISOR` limpa vínculo de supervisão.
- Persistência ponta a ponta implementada:
  - frontend -> API -> store -> banco.
- Campos adicionados:
  - `supervisor_code`
  - `supervisor_name`
- Migration aplicada com sucesso no ambiente alvo:
  - `20260415100000_metas_sellers_supervision_fields`.

---

## Correções técnicas críticas já tratadas

1. Erro de persistência `Unknown argument profileType`:
- Causa: schema/migration não alinhado com uso em `metasSeller.createMany`.
- Ação: alinhar schema + migrations + client gerado + store.

2. Erro `Cannot convert undefined or null to object` no save de vendedores:
- Causa associada à inconsistência no payload/estrutura após falha de `profileType`.
- Ação: normalização defensiva e correção da persistência.

3. Falha `prisma migrate deploy` por datasource ausente:
- Mensagem: `The datasource.url property is required in your Prisma config file when using prisma migrate deploy`.
- Ação operacional: garantir `DATABASE_URL` disponível no ambiente antes do deploy/migrate.

---

## Qualidade e build

- Type-check local validado nas últimas alterações do módulo.
- Build de produção local (`npm.cmd run build`) executado com sucesso nas últimas rodadas.
- Observação: manter validação de build após qualquer alteração em schema Prisma ou rotas API.

---

## Arquivos-chave desta etapa

- `src/components/metas/MetasWorkspace.tsx`
- `src/lib/metas/seller-allowlist-store.ts`
- `src/lib/metas/seller-allowlist.ts`
- `src/app/api/metas/sellers-allowlist/route.ts`
- `src/app/api/metas/sellers-allowlist/sync/route.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260415100000_metas_sellers_supervision_fields/migration.sql`
- `src/app/api/metas/config/route.ts`
- `src/app/api/metas/sellers-performance/route.ts`
- `src/app/api/metas/sellers-performance/product-focus/route.ts`
- `src/app/api/metas/sellers-performance/brand-weight/route.ts`
- `src/app/api/metas/products-allowlist/route.ts`
- `src/app/api/metas/products-allowlist/sync/route.ts`

---

## Dicas importantes para desenvolvimento (evitar regressões)

1. Sempre que alterar perfil/tipo de vendedor:
- validar persistência na allowlist;
- validar carregamento do bloco por perfil;
- validar escopo do modal “Aplicar para todos”.

2. Sempre que alterar Prisma/schema:
- executar `npx prisma migrate dev` (ambiente dev);
- executar `npx prisma generate`;
- validar `npm.cmd run build` antes de subir.

3. Em deploy com migration:
- garantir `DATABASE_URL` definido no ambiente;
- rodar `npm run db:migrate:deploy` somente após conferência de variáveis.

4. Em mudanças de cálculo de KPI/premiação:
- testar perfil `NOVATO` e perfis percentuais (`ANTIGO_1`/`ANTIGO_15`);
- conferir total do rodapé do bloco e cards do dashboard;
- validar consistência entre valor unitário dos KPIs e total acumulado.

5. Em mudanças de mês/ano:
- confirmar fallback para configuração mais próxima;
- validar se dados não “somem” na troca de período.

---

## Pendências ativas (próxima onda)

1. Formalizar regra definitiva de `INADIMPLENCIA` com operação/negócio.
2. Cobrir com testes automatizados os fluxos críticos:
- persistência de `profileType`;
- persistência de `supervisorCode/supervisorName`;
- aplicação em lote por perfil;
- cálculo de premiação percentual com teto.
3. Evoluir visão por supervisão no dashboard:
- filtro por supervisor;
- agregados por equipe/supervisão;
- ranking segmentado por supervisão.
4. Revisar mensagens de ajuda no rodapé dos blocos para reduzir dúvida operacional em cálculos percentuais.

---

## Checklist rápido de release (Metas)

- [ ] `npm.cmd run type-check`
- [ ] `npm.cmd run build`
- [ ] salvar/recarregar allowlist de vendedores e conferir perfis
- [ ] salvar/recarregar allowlist e conferir vínculo de supervisão por vendedor
- [ ] abrir bloco de cada perfil e validar colunas/formatos de premiação
- [ ] validar modal de aplicação em lote por perfil
- [ ] validar tela de produtos com ordenação e filtro por grupo

