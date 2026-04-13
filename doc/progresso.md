# Módulo de Metas — Progresso Técnico

> Última atualização: 13/04/2026  
> Workspace principal: `src/components/metas/MetasWorkspace.tsx`  
> APIs núcleo: `src/app/api/metas/sellers-performance/*`

---

## Status executivo da fase

Fase atual com foco em fechamento operacional e confiabilidade do painel: regras de KPI consolidadas, auditoria visual por KPI, consistência entre configuração x cálculo x dashboard, e melhora de performance nas consultas Sankhya com filtros no SQL (evitando carga excessiva no front/back).

---

## Melhorias e correções consolidadas

### 1) Configuração mensal e calendário operacional
- Fluxo de configuração estabilizado por mês/ano.
- Contagem de dias úteis no mês e suporte a exceções:
  - desconsiderar data global;
  - considerar data específica por vendedor.
- Escopo de empresa aplicado corretamente (`1`, `2`, `all`) e refletido no carregamento de dados.

### 2) Grupos de parâmetros por vendedor
- Inclusão/edição de grupos com melhor UX para selecionar vendedor e compor bloco ativo.
- Ações de produtividade:
  - `Restaurar padrões`;
  - `Novo KPI`;
  - `Excluir grupo`;
  - `Aplicar a todos os vendedores` para metas de peso e item foco.
- Totais de bloco consistentes no rodapé (quantidade de KPIs, meta financeira e vendedores no bloco).

### 3) KPIs com regra de negócio refinada
- `VOLUME`: parâmetro inteiro representando quantidade mínima de grupos de produto batidos.
- `ITEM_FOCO`: exigência combinada de volume e devolução máxima para considerar KPI conquistado.
- `DEVOLUCAO`: cálculo sobre faturado no período, com validação percentual estável.
- `META FINANCEIRA` e `BASE DE CLIENTES`: ajustes de descrição e semântica dos parâmetros por etapa.
- `INADIMPLENCIA`: permanece com regra provisória (pendência formal abaixo).

### 4) Auditoria visual de KPI (Sankhya)
- Painel de auditoria por KPI exibindo:
  - período;
  - vendedor;
  - base de cálculo (ex.: clientes únicos, base total, meta parametrizada);
  - valor apurado final.
- Melhora direta na rastreabilidade operacional para suporte e validação de regra.

### 5) Painel “Metas de peso por grupo de produto”
- Tabela de metas por marca/grupo com:
  - meta em kg;
  - vendido em kg;
  - progresso percentual;
  - total consolidado do bloco.
- Correção de aplicação em lote para reduzir retrabalho quando múltiplos vendedores compartilham a mesma estratégia.

### 6) Painel “Item foco do mês”
- Bloco dedicado com produto foco + meta (kg).
- Tabela por vendedor com indicadores de venda e positivação da base.
- Exibição de contexto da meta (% base e quantidade de clientes necessária), melhorando interpretação de resultado.

### 7) Premiação e estabilidade de entrada de dados
- Edição de parâmetros financeiros com menor risco de truncamento/valor inválido.
- Melhor consistência entre formato percentual e valor fixo nas campanhas.
- Cartões e resumo de premiação por vendedor alinhados ao KPI conquistado no ciclo.

### 8) Carregamento e consistência geral
- Correção de loops de efeito e estados de carregamento em configurações.
- Sincronização de allowlists (vendedores/produtos) mais previsível.
- Integração de dados em cascata para reduzir falhas por variação de ambiente Sankhya.

---

## Tabelas e fontes de dados usadas corretamente (eficiência)

### Sankhya (consulta operacional)

| Tabela | Uso no módulo | Estratégia aplicada |
|---|---|---|
| `TGFCAB` | Pedidos/vendas do período, devoluções e filtros por empresa | Filtro por data, vendedor, empresa e tipo de movimento já no SQL |
| `TGFVEN` | Cadastro/nome do vendedor | JOIN para identificação e padronização de exibição |
| `TGFITE` | Itens da nota para cálculos por produto/grupo | JOIN com `TGFCAB` para KPI de peso e item foco |
| `TGFPRO` | Produto, peso bruto, marca e atributos | Base para metas de peso e item foco |
| `TGFFIN` | Títulos em aberto/inadimplência e valores financeiros | Variações SQL com fallback por colunas disponíveis |
| `TGFPAR` | Base total de clientes por vendedor | Cálculo da cobertura/positivação da base |
| `ALL_TAB_COLUMNS` | Descoberta de colunas disponíveis em `TGFFIN` | Evita quebrar query em ambientes com schema diferente |

### Base local (aplicação)

| Estrutura | Finalidade | Observação |
|---|---|---|
| `metas_config` (Prisma `MetasConfig`) | Persistência das configurações por escopo/mês | Upsert por `scopeKey` (`1`, `2`, `all`) |
| `integrations` (Prisma `Integration`) | Credenciais e endpoint Sankhya ativo | Busca da integração ativa mais recente |
| `src/generated/metas-sellers-allowlist.json` | Controle de vendedores considerados | Normalização + deduplicação antes de salvar |
| `src/generated/metas-products-allowlist.json` | Controle de produtos considerados | Filtra mobilidade e marca permitida |

---

## Boas práticas já adotadas (dicas importantes)

- Aplicar filtro por vendedor diretamente no SQL (`IN (...)`) para evitar trazer massa desnecessária da API Sankhya.
- Manter fallback em camadas para tipo de movimento:
  - `TIPMOV='V' + CODTIPOPER=1101`;
  - `TIPMOV='V'`;
  - movimento amplo como último recurso.
- Usar fallback de parsing para `fields` e `fieldsMetadata` na resposta Sankhya.
- Tratar variações de ambiente em títulos financeiros (`TGFFIN`) detectando colunas em tempo de execução.
- Garantir que vendedor ativo sem pedido no mês continue aparecendo no painel com zero (evita “sumiço” de gestão).
- Centralizar normalização de dados de allowlist antes de persistir para reduzir inconsistência funcional.

---

## Arquivos-chave envolvidos nesta rodada

- `src/components/metas/MetasWorkspace.tsx`
- `src/app/api/metas/config/route.ts`
- `src/app/api/metas/sellers-performance/route.ts`
- `src/app/api/metas/sellers-performance/product-focus/route.ts`
- `src/app/api/metas/sellers-performance/brand-weight/route.ts`
- `src/app/api/metas/sellers-allowlist/route.ts`
- `src/app/api/metas/sellers-allowlist/sync/route.ts`
- `src/app/api/metas/products-allowlist/route.ts`
- `src/app/api/metas/products-allowlist/sync/route.ts`
- `src/lib/metas/seller-allowlist-store.ts`
- `src/lib/metas/product-allowlist-store.ts`

---

## Qualidade e build (Vercel)

- Em **13/04/2026**, o build de produção foi executado localmente para simular a Vercel (`npm.cmd run build`).
- Status: **falha no type-check** em rota fora do módulo de metas:
  - `src/app/api/dev/permissions/route.ts` retornando `null` em handler (`GET`), incompatível com contrato de retorno do Next 16.
- Impacto: bloqueia pipeline de build/deploy até ajuste do retorno para `Response | void`.

---

## Pendências conhecidas

1. Finalizar regra oficial do KPI `INADIMPLENCIA` (fonte de dados + fórmula de negócio).
2. Ajustar erro de tipagem na rota `api/dev/permissions` para destravar build da Vercel.
3. Validar em homologação variações de devolução entre ambientes Sankhya (`TIPMOV='D'` e possíveis variações de operação).
4. Executar rodada com casos reais para comparar auditoria por KPI versus expectativa da operação comercial.

---

## Próximos passos recomendados

1. Corrigir o type-check de rotas API para liberar deploy contínuo.
2. Fechar a definição de `INADIMPLENCIA` com área de negócio e registrar no documento.
3. Criar checklist de homologação mensal (escopo, metas, item foco, devolução, premiação, fechamento).
4. Adicionar testes automatizados para validação das regras de KPI críticas (volume, item foco, devolução).
