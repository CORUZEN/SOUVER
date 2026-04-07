# Módulo de Metas — Progresso Técnico Completo

> **Última atualização:** 06/04/2026  
> **Arquivo principal:** `src/components/metas/MetasWorkspace.tsx` (~2600 linhas)  
> **API:** `src/app/api/metas/sellers-performance/route.ts`  
> **URL:** `http://localhost:3001/em-desenvolvimento?modulo=metas`  
> **Storage:** localStorage key `metas-workspace-v2` (sem banco de dados)

---

## 1. Arquitetura Geral

```
MetasWorkspace.tsx          → Componente principal (config + dashboard + sellers + products)
  ├─ API sellers-performance → Busca pedidos do Sankhya (Oracle DB via REST)
  ├─ localStorage            → Persiste configuração por mês
  ├─ metas-sellers-allowlist.json → Lista de vendedores permitidos (gerado via script)
  └─ lib/metas/              → Helpers de allowlist (seller + product)
```

### Fluxo de dados
1. API busca pedidos do Sankhya filtrados por mês e vendedores da allowlist
2. Frontend recebe `sellers[]` com `orders[]` (cada order tem `clientCode`)
3. `buildCycle()` gera semanas do mês com dias úteis (feriados + off-dates)
4. Scoring calcula progresso de cada KPI por vendedor usando dados cumulativos por etapa
5. Dashboard exibe gráficos, heatmap, ranking e painel de detalhes

---

## 2. Tipos e Interfaces

### StageKey
```typescript
type StageKey = 'W1' | 'W2' | 'W3' | 'CLOSING' | 'FULL'
```

### KpiType (9 tipos)
```typescript
type KpiType = 'BASE_CLIENTES' | 'VOLUME' | 'META_FINANCEIRA' | 'DISTRIBUICAO'
  | 'DEVOLUCAO' | 'INADIMPLENCIA' | 'ITEM_FOCO' | 'RENTABILIDADE' | 'CUSTOM'
```

### GoalRule
```typescript
interface GoalRule {
  id: string
  stage: StageKey
  frequency: RuleFrequency    // 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' (não usado no scoring, apenas descritivo)
  kpiType: KpiType
  kpi: string                 // Nome exibido
  description: string
  targetText: string           // Ex: "40%", "120%", "6 categorias", "27|30" (DISTRIBUICAO)
  rewardValue: number          // Premiação em R$
  points: number               // Pontos para ranking
}
```

### RuleBlock
```typescript
interface RuleBlock {
  id: string
  title: string
  monthlyTarget: number       // Meta financeira do mês em R$
  sellerIds: string[]          // Vazio = bloco padrão (todos os vendedores não atribuídos)
  rules: GoalRule[]
}
```

### MetaConfig (por mês)
```typescript
interface MetaConfig {
  ruleBlocks: RuleBlock[]
  prizes: CampaignPrize[]
  includeNational: boolean
  salaryBase: number
  basePremiation: number
  extraBonus: number
  extraMinPoints: number
}
```

### CampaignPrize
```typescript
interface CampaignPrize {
  id: string
  title: string
  frequency: 'MONTHLY' | 'QUARTERLY'
  type: 'CASH' | 'BENEFIT'
  rewardValue: number           // Usado quando type = 'CASH'
  benefitDescription: string    // Usado quando type = 'BENEFIT' (ex: viagem, produto, voucher)
  minPoints: number
  active: boolean
}
```

### SellerSnapshot (resultado do scoring)
```typescript
interface SellerSnapshot {
  seller: SellerPerformance
  totalOrders: number
  totalValue: number
  totalGrossWeight: number
  averageTicket: number
  pointsAchieved: number
  pointsTarget: number         // Total de pontos de TODAS as regras do bloco
  rewardAchieved: number
  rewardTarget: number
  status: 'SUPEROU' | 'NO_ALVO' | 'ATENCAO' | 'CRITICO'
  gapToTarget: number
  ruleProgress: { ruleId: string; progress: number }[]
  blockId: string
}
```

### SellerOrder (da API)
```typescript
interface SellerOrder {
  orderNumber: string
  negotiatedAt: string         // ISO date
  totalValue: number
  grossWeight: number
  clientCode: string           // CODPARC do Sankhya — usado para clientes distintos
}
```

---

## 3. Constantes Padrão

### STAGES
| Key     | Label         | Descrição                   |
|---------|---------------|-----------------------------|
| W1      | 1ª Semana     | 5 dias úteis a partir do início |
| W2      | 2ª Semana     | Próximos 5 dias úteis       |
| W3      | 3ª Semana     | Próximos 5 dias úteis       |
| CLOSING | Fechamento    | Do fim da W3 até fim do mês |
| FULL    | Todo o período| Mês inteiro (meta global)   |

### DEFAULT_RULES (16 regras em 4 etapas)
- **W1:** Base clientes 40%, Volume 2 categorias, Meta financeira 30%
- **W2:** Base clientes 80%, Volume 3 categorias, Meta financeira 60%
- **W3:** Volume 4 categorias, Distribuição 50|30, Meta financeira 80%
- **CLOSING:** Base clientes 85%, Volume 6 cat, Distribuição 80|40, Devolução 0.5%, Inadimplência 3%, Item foco, Meta financeira 100%, Rentabilidade 33%, Meta financeira 120% (bônus superação)

### DEFAULT_PRIZES (2 campanhas)
- Mensal: R$ 1.000 (Financeira), mín. 0,6 pts
- Trimestral: Benefício (texto livre), mín. 18 pts

---

## 4. Scoring — Lógica Detalhada

### 4.1 Etapas que já começaram
```typescript
const stageStarted = new Set<StageKey>(
  cycle.weeks.filter(w => w.start && w.start <= todayIso).map(w => w.key)
)
```
- **Regras de etapas futuras retornam `progress: 0`** — não acumulam dados de semanas anteriores
- O `activePointsTarget` (apenas etapas iniciadas) é usado para calcular o ratio/status
- O `pointsTarget` total continua sendo exibido na UI para referência

### 4.2 Métricas cumulativas por etapa
Para cada vendedor, pedidos são classificados por etapa via `findStageForDate()`. Métricas cumulativas são acumuladas: W1 → W1, W2 → W1+W2, W3 → W1+W2+W3, CLOSING → todas.

Campos por etapa: `orderCount`, `totalValue`, `distinctClients` (via `clientCode`).

### 4.3 Stage-locked (KPIs passados não mudam retroativamente)
Cada regra usa `lockedValue`, `lockedOrders`, `lockedClients`, `lockedTicket` — derivados das métricas cumulativas até a etapa da regra. Dados futuros não alteram progresso de KPIs passados.

### 4.4 Cálculo por KPI

| KpiType | Fórmula | Notas |
|---------|---------|-------|
| **META_FINANCEIRA** | `cumValue / (monthlyTarget × target%)` | % auto-reconhecido |
| **BASE_CLIENTES** | `(cumDistinctClients / totalDistinctClients) / target%` | Denominador só cresce |
| **VOLUME** | `cumOrders / target` (numérico) ou `cumValue / cumValue / target%` | |
| **DISTRIBUICAO** | Parse `"X\|Y"` → itens vs % clientes | X pode ser `N%` do total de produtos |
| **RENTABILIDADE** | `(lockedTicket / teamAvgTicket) / target%` | Stage-locked |
| **ITEM_FOCO** | `stageValue / cumulativeValue` | Stage-locked |
| **DEVOLUCAO** | `0` (não implementado) | Aguarda dados |
| **INADIMPLENCIA** | `0` (não implementado) | Aguarda dados |
| **CUSTOM** | Fallback numérico ou % | |

- Progress é clamped: `Math.max(0, Math.min(progress, 1.4))`
- KPIs percentuais (BASE_CLIENTES, META_FINANCEIRA, RENTABILIDADE, DEVOLUCAO, INADIMPLENCIA) **auto-reconhecem %** — digitar `40` equivale a `40%`

### 4.5 Pontuação e Status

```
pointsAchieved = Σ(rule.points × min(progress, 1))
rewardAchieved = Σ(progress >= 1 ? rule.rewardValue : 0)
ratio = pointsAchieved / activePointsTarget
```

**Classificação de status:**
| Status | Condição |
|--------|----------|
| **SUPEROU** | Vendedor bateu META_FINANCEIRA com target > 100% (ex: 120%) |
| **NO_ALVO** (Meta Batida) | ratio ≥ 85% |
| **ATENCAO** | ratio ≥ 65% |
| **CRITICO** | ratio < 65% |

O "SUPEROU" é ativado **apenas** quando existe uma regra META_FINANCEIRA com alvo > 100% e o vendedor atingiu progress ≥ 1 nessa regra. Isso reflete superação real.

---

## 5. Multi-block System

### Blocos de regras
- Cada bloco tem seu próprio conjunto de KPIs, meta financeira e vendedores atribuídos
- Bloco com `sellerIds: []` é o **bloco padrão** (captura todos os vendedores não atribuídos)
- `findBlockForSeller()` busca bloco específico → fallback para bloco padrão

### Tab Selector
- Quando há > 1 bloco, aparece um seletor de abas no topo
- `selectedBlockId` controla qual bloco está visível (IIFE pattern no JSX)
- "Novo bloco" **clona** o bloco atual (deep copy de rules com novos IDs, sellerIds vazio)
- "Excluir bloco" remove e reseta `selectedBlockId` para o primeiro restante

---

## 6. Configuração por Mês

### Estrutura de armazenamento
```typescript
metaConfigs: Record<string, MetaConfig>  // chave: "YYYY-MM" (ex: "2026-04")
monthConfigs: Record<string, MonthConfig> // calendário: week1StartDate, customOffDates
```

### Comportamento ao trocar mês
1. Salva configuração do mês atual em `metaConfigs[oldKey]`
2. Carrega configuração do novo mês, ou **herda do mês anterior** se não existir
3. `prevActiveKeyRef` rastreia a troca
4. Auto-save em qualquer mudança de estado

### Migração legada
- Dados antigos sem `metaConfigs` → migra `ruleBlocks`, `prizes`, etc. do nível raiz
- `benefitDescription` ausente em prizes antigos → default `''`
- `kpiType` ausente em rules → inferido via `inferKpiType(rule.kpi)`

---

## 7. Campanhas de Premiação

### Dois tipos
| Tipo | Campo exibido | Comportamento |
|------|---------------|---------------|
| **CASH** (Financeira) | Valor (R$) | Input numérico |
| **BENEFIT** (Benefício) | Premiação | Input texto (ex: "Viagem para Cancún", "Kit de produtos premium") |

- Cada campanha tem: título, frequência (mensal/trimestral), tipo, pontos mínimos, ativa/inativa
- `benefitDescription` armazena a descrição textual do benefício

---

## 8. Dashboard — Componentes Visuais

### Cards de métricas
- Vendedores monitorados, Meta geral da fábrica, Meta batida ou acima, Risco operacional
- Pedidos no mês, Peso bruto total, Faturamento total, Ticket médio

### Gráficos
| Gráfico | Tipo | Dados |
|---------|------|-------|
| Tendência de evolução | Linha SVG | Atingido médio vs meta planejada por etapa |
| Pontuação por vendedor | Barras SVG | Top 6 vendedores por pontos |
| Composição de status | Donut SVG | 4 segmentos (Superou, Meta Batida, Atenção, Crítico) |
| Mapa de calor | Tabela | Top 5 vendedores × 4 etapas (% de conclusão) |
| Meta corporativa | Barra progresso | % de vendedores que bateram a meta |
| Distribuição por status | Barras horizontais | Contagem por status |
| Aderência por etapa | Barras progresso | Pontos atingidos vs target por semana |

### Painel de detalhes do vendedor
- Seleção via clique no ranking
- Mostra: pontuação, pedidos, faturamento, peso, premiação KPIs, campanhas elegíveis, gap
- Lista todos os KPIs com barra de progresso individual
- Indica grupo/bloco do vendedor

---

## 9. API — sellers-performance

### Endpoint
`GET /api/metas/sellers-performance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

### Fonte de dados
- **Sankhya ERP** via REST API (Oracle DB)
- Tabelas: `TGFCAB` (pedidos), `TGFVEN` (vendedores)
- Filtros SQL: `TIPMOV IN ('V','P','O')`, `STATUSNOTA ≠ 'C'`, date range, seller codes

### Autenticação
1. **OAuth2** (primário): `POST /authenticate` com `client_credentials`
2. **Session** (fallback): `MobileLoginSP.login` com user/password

### Resposta
```json
{
  "sellers": [{
    "id": "sankhya-34",
    "name": "ALEX SOUSA",
    "login": "alex.sousa",
    "totalValue": 123456.78,
    "totalGrossWeight": 5000.5,
    "totalOrders": 45,
    "orders": [{
      "orderNumber": "12345",
      "negotiatedAt": "2026-04-06",
      "totalValue": 2500.00,
      "grossWeight": 100.5,
      "clientCode": "14377"
    }]
  }]
}
```

### Allowlist
- Arquivo: `src/generated/metas-sellers-allowlist.json`
- Formato: `[{ code, partnerCode, name, active }]`
- ~21 vendedores ativos
- API filtra vendedores por códigos da allowlist na query SQL (IN clause)

---

## 10. Helpers e Utilitários

### `src/lib/metas/`
| Arquivo | Função |
|---------|--------|
| `seller-allowlist.ts` | `matchesAllowedSeller()`, `getActiveAllowedSellersFromList()` |
| `product-allowlist.ts` | `normalizeBrand()` (aliases: "CAFE"→"CAFES"), `isAllowedProductBrand()` |

### Funções internas do MetasWorkspace
| Função | Propósito |
|--------|-----------|
| `buildCycle()` | Gera semanas do mês com dias úteis (feriados BR + custom off-dates) |
| `nationalHolidays()` | 9 feriados fixos + Sexta-feira Santa |
| `findStageForDate()` | ISO date → StageKey |
| `findBlockForSeller()` | sellerId → RuleBlock (específico ou padrão) |
| `inferKpiType()` | Descrição textual → KpiType |
| `parseTargetNumber()` | "40%" → 40, "6 categorias" → 6 |
| `smoothLinePath()` | Gera SVG path com curvas suaves |

---

## 11. Coluna de FREQ removida

A coluna "Frequência" foi **removida** da tabela de configuração de KPIs. O período (1ª Semana, 2ª Semana, etc.) **já define** o escopo temporal. O scoring usa `rule.stage` diretamente — `rule.frequency` existe na interface mas é apenas descritivo.

Colunas atuais da tabela de config: **Período, KPI, Descrição, Parâmetro, Premiação, Pontos, Ações**

---

## 12. DISTRIBUICAO — Formato Especial

O targetText usa formato dual: `"X|Y"` onde:
- **X** = alvo de itens (número absoluto ou `N%` do total de produtos ativos)
- **Y** = % da base de clientes (sempre percentual)

Exemplos: `"27|30"` (27 itens, 30% clientes), `"50%|30"` (50% dos produtos, 30% clientes)

Na UI, há dois inputs + um botão toggle entre `%` e `Nº` para a parte de itens.

---

## 13. O que NÃO está implementado

| Item | Status | Notas |
|------|--------|-------|
| DEVOLUCAO scoring | `progress = 0` | Aguarda dados de devolução do Sankhya |
| INADIMPLENCIA scoring | `progress = 0` | Aguarda dados financeiros do Sankhya |
| Persistência em banco | Não existe | Tudo em localStorage |
| Exportação PDF/Excel | Não existe | |
| Notificações automáticas | Não existe | |
| Histórico de meses anteriores readonly | Parcial | Pode navegar mas não há lock |

---

## 14. Decisões de Design Importantes

1. **Stage-locked scoring**: KPIs passados nunca melhoram retroativamente com dados novos
2. **Etapas futuras = progress 0**: Vendedor só é avaliado por etapas que já começaram
3. **activePointsTarget para status**: O ratio usa apenas pontos de etapas iniciadas, evitando penalizar por semanas futuras
4. **SUPEROU via META_FINANCEIRA extra**: Status "Superou" exige batimento de regra com target > 100% — não é por ratio de pontos
5. **Clonagem de blocos**: Novo bloco clona o atual (deep copy) em vez de criar vazio
6. **Herança de mês anterior**: Ao criar config para novo mês, herda do mês anterior automaticamente
7. **Auto-reconhecimento de %**: KPIs percentuais tratam `40` igual a `40%`

---

## 15. Histórico de Fases Concluídas

| # | Fase | Descrição |
|---|------|-----------|
| 1 | Import Sankhya | Corrigido import de produtos/vendedores |
| 2 | Read-only tables | Tabelas de allowlist somente leitura |
| 3 | Auto-save | Salvar automaticamente ao remover item |
| 4 | Documentação | Criada documentação técnica |
| 5 | Segurança | Removidas credenciais expostas |
| 6 | Performance API | Otimizado de 665→370 linhas |
| 7 | Seletor de período | Adicionado ao dashboard |
| 8 | KPIs tipados | Sistema de KpiType com 9 tipos |
| 9 | Multi-block | RuleBlock com atribuição de vendedores |
| 10 | Per-month config | MetaConfig isolado por mês com herança |
| 11 | Rules/RuleBlocks sync | `rules` derivado via useMemo de `ruleBlocks` |
| 12 | META_FINANCEIRA fix | Usa `cumStage.totalValue` (cumulativo à etapa) |
| 13 | DISTRIBUICAO redesign | Formato dual `"X\|Y"`, tracking de clientes distintos |
| 14 | Auto-reconhecimento % | KPIs percentuais interpretam número como % |
| 15 | FREQ removida | Coluna redundante eliminada |
| 16 | Stage-locked scoring | Métricas travadas por etapa |
| 17 | Tab selector + clone | Seletor de abas para blocos + clonagem |
| 18 | Campanhas benefício | Campo texto para premiações não-financeiras |
| 19 | Status "Superou" | Baseado em META_FINANCEIRA > 100% |
| 20 | Etapas futuras | KPIs de semanas futuras = progress 0 |

---

## 16. Para Continuar

### Próximos passos naturais
- Implementar scoring de **DEVOLUCAO** e **INADIMPLENCIA** (requer dados do Sankhya)
- Lock de meses encerrados (read-only)
- Exportação de relatórios
- Persistência em banco de dados (migrar de localStorage)
- Testes automatizados para scoring

### Como retomar
1. Abrir `src/components/metas/MetasWorkspace.tsx` — é o arquivo principal
2. A API está em `src/app/api/metas/sellers-performance/route.ts`
3. Rodar com `npm run dev` — acessa em `http://localhost:3001/em-desenvolvimento?modulo=metas`
4. Config salva em localStorage key `metas-workspace-v2`
5. Para resetar config: limpar localStorage no DevTools
