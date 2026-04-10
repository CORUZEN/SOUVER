# Módulo de Metas — Progresso Técnico

> Última atualização: 10/04/2026  
> Arquivo principal: `src/components/metas/MetasWorkspace.tsx`  
> APIs principais: `src/app/api/metas/sellers-performance/*`

---

## Resumo da fase atual

Nesta etapa, o módulo de metas recebeu refino forte de regra de negócio e interface para fechamento operacional: cálculo por KPI, item foco do mês, devolução, premiação por vendedor e consistência de configuração por bloco.

---

## Melhorias implementadas (concluídas)

### 1) Bloco "Desempenho individual de vendedores"
- Estrutura da grade reformulada para layout mais compacto e profissional.
- Inclusão de coluna de clientes atendidos (clientes únicos) por vendedor no período.
- Expansão por linha de vendedor mantida com painel interno reorganizado.
- Ajustes visuais de espaçamento, sombras, cabeçalho e microinterações de hover/click.

### 2) Tendência e aderência por etapa
- Blocos "Tendência de evolução" e "Aderência por etapa semanal" passaram a considerar **KPIs conquistados por etapa**, em vez de "meta batida" genérica.
- Rótulos e subtítulos alinhados ao novo cálculo.
- Correção de descrição ausente em etapa semanal.

### 3) Premiação por desempenho (pizza + cards)
- Mantido o valor central como **premiação atual (R$)**.
- Evolução visual preservada com semântica de dados corrigida.
- Cards de vendedores ajustados para ordenação/estilo corporativo.
- Grid de cards por vendedor ajustado para 4 colunas por linha.

### 4) KPI VOLUME (regra funcional)
- Campo de parâmetro convertido para **numérico puro (inteiro)**.
- Interpretação aplicada:
  - Ex.: `2` = bater meta de peso em pelo menos 2 grupos de produto.
  - Ex.: `4` = bater meta de peso em pelo menos 4 grupos.

### 5) KPI ITEM_FOCO (regra funcional completa)
- Parametrização no KPI alterada para dois campos objetivos:
  - `% vol.` (volume mínimo exigido)
  - `% dev.` (devolução máxima permitida)
- Regra aplicada: só bate o KPI se **volume mínimo** e **devolução máxima** forem atendidos simultaneamente.
- Cálculo de devolução do item foco consolidado sobre a **meta do item foco (kg)**.

### 6) Seção "Item foco do mês" (configuração)
- Novo bloco após "Metas de peso por grupo de produto".
- Seleção de produto foco baseada na lista de produtos considerados/ativos.
- Campo de meta do item em kg.
- Tabela reformulada para contexto do vendedor/bloco selecionado:
  - `SKU`
  - `Item foco`
  - `Meta (kg)`
  - `Vendido (kg)`
  - `Devolvido (kg)`
  - `Devolução (%)`
- Exibição do limite configurado de devolução em % e em kg.

### 7) KPI DEVOLUÇÃO (racional sobre faturado)
- Regra implementada conforme negócio:
  - `% devolução = devolvido_no_período / faturado_no_período`.
  - Se exceder o percentual limite, não bate o KPI.
- Campo de parâmetro para DEVOLUÇÃO ajustado para aceitar somente **porcentagem numérica**.

### 8) Campanhas e parâmetros de premiação
- Ajustes em campos de bônus extra e pontos mínimos com edição mais estável.
- Correções de entrada para evitar travamento/fracionamento indevido no input.
- Melhorias em valores financeiros e apresentação de percentual/valor fixo em campanhas.

### 9) Correções de carregamento e consistência
- Corrigido fluxo de carregamento da allowlist de produtos na visão de configuração.
- Corrigido loop de carregamento no item foco por dependências de efeito.
- Melhorias gerais de consistência entre configuração, dashboard e cálculo.

---

## APIs/arquivos alterados nesta fase

- `src/components/metas/MetasWorkspace.tsx`
- `src/app/api/metas/sellers-performance/route.ts`
- `src/app/api/metas/sellers-performance/product-focus/route.ts`

---

## Pendências conhecidas (fora do escopo desta rodada)

1. **Typecheck global do projeto ainda falha** por erros antigos em arquivos não relacionados ao módulo de metas (ex.: `scripts/unlock-login.ts` e rotas `api/*` com `implicit any`).
2. KPI `INADIMPLENCIA` permanece com cálculo placeholder (a definir regra final de negócio + fonte de dados).
3. Validar em homologação se todos os ambientes Sankhya usam o mesmo padrão de movimentação para devolução (`TIPMOV = 'D'`).

---

## Próximos passos recomendados

1. Finalizar cálculo do KPI `INADIMPLENCIA` com regra e fonte oficial.
2. Adicionar indicador textual de auditoria por KPI no painel expandido do vendedor (valor apurado x limite).
3. Rodar bateria de validação com casos reais de vendedor para ITEM_FOCO e DEVOLUÇÃO.
4. Limpar erros legados de TypeScript para liberar build de produção sem ressalvas.
