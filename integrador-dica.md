# Guia de Integração ERP — PALETIN

> Documento de referência técnica baseado na implementação do integrador Sankhya.
> Use como modelo para adicionar novos ERPs (TOTVS, SAP, Bling, etc.).

---

## 1. Arquitetura Adotada

O PALETIN **não conecta diretamente ao banco de dados do ERP**. Toda comunicação é feita via **HTTP/REST** usando a API oficial do fornecedor, que executa as queries internamente. O sistema age como cliente HTTP.

```
PALETIN (Next.js) → HTTP POST → API do ERP → Banco do ERP (Oracle/SQL Server/etc.)
```

Vantagens desse padrão:
- Sem necessidade de abrir portas de banco de dados
- Segue as políticas de segurança do fornecedor
- Compatível com ERPs hospedados em nuvem ou on-premise

---

## 2. Estrutura de Arquivos (padrão a seguir)

```
src/
├── lib/
│   └── sankhya-client.ts          ← Núcleo: autenticação + queries + parse
└── app/api/integracoes/
    ├── route.ts                   ← CRUD de credenciais (salvar/editar/listar)
    ├── [id]/route.ts              ← Operações por ID (ativar/testar/deletar)
    └── sankhya/
        ├── buscar-ordem/route.ts  ← Endpoint de importação de dados
        └── diagnostico/route.ts   ← Endpoint de diagnóstico/inspeção
```

### Ao criar um novo integrador

1. Criar `src/lib/{erp}-client.ts` — cliente HTTP do novo ERP
2. Criar `src/app/api/integracoes/{erp}/buscar-{entidade}/route.ts` — endpoint de importação
3. Adicionar o novo `tipo` no campo `tipo` da tabela `integracao_org` (schema)
4. Reutilizar `route.ts` principal para salvar credenciais (já suporta campos genéricos)

---

## 3. Tabela de Credenciais — `integracao_org` (PostgreSQL)

Definida em `src/db/schema.ts`. Todos os integradores compartilham a mesma tabela.

| Coluna | Tipo | Uso |
|---|---|---|
| `tipo` | varchar(50) | Identificador do ERP: `"sankhya"`, `"totvs"`, etc. |
| `nome` | varchar(100) | Nome amigável: `"Sankhya"`, `"TOTVS Protheus"` |
| `service_url` | varchar(500) | URL base da API ou servidor do ERP |
| `username` | varchar(255) | Usuário da API (opcional no modo OAuth) |
| `password_encrypted` | text | Senha codificada com `encryptPassword()` |
| `token_integracao` | text | Token/appkey adicional do ERP |
| `client_id` | varchar(500) | Client ID para OAuth 2.0 |
| `client_secret_encrypted` | text | Client Secret OAuth codificado |
| `codigo_empresa` | varchar(50) | Tenant/empresa no ERP (ex: `"1"`) |
| `ativo` | boolean | Liga/desliga sem deletar configuração |
| `ultimo_teste_em` | timestamp | Quando foi o último teste de conexão |
| `ultimo_teste_status` | varchar(20) | `"ok"` ou `"erro"` |
| `ultimo_teste_erro` | text | Mensagem do último erro de teste |

**Unicidade**: `(org_id, tipo)` — cada organização tem no máximo uma integração por tipo de ERP.

---

## 4. Armazenamento de Senhas e Secrets

Funções em `src/app/api/integracoes/route.ts`:

```ts
function encryptPassword(plain: string): string {
  return "b64:" + Buffer.from(plain, "utf-8").toString("base64");
}

export function decryptPassword(encrypted: string): string {
  if (encrypted.startsWith("b64:")) {
    return Buffer.from(encrypted.slice(4), "base64").toString("utf-8");
  }
  return encrypted; // compatibilidade com valores antigos sem prefixo
}
```

> **Atenção**: o esquema atual usa Base64 (obfuscação, não criptografia). Para novos integradores com requisitos mais críticos de segurança, considere substituir por AES-256 com uma `SECRET_KEY` do ambiente. A interface da função (`encryptPassword` / `decryptPassword`) já está pronta para essa troca sem alterar o restante do código.

**Regra de ouro**: nunca retornar senha ou client secret pela API. Retornar apenas flags booleanas:
```ts
senhaConfigurada: !!integracao.passwordEncrypted,
clientSecretConfigurado: !!integracao.clientSecretEncrypted,
```

---

## 5. Padrão de Autenticação Dual (OAuth + Legado)

O integrador Sankhya suporta dois modos com **seleção e fallback automático**. Replicar este padrão quando o ERP alvo estiver em transição de autenticação.

```ts
function hasOAuthCredentials(config): boolean {
  return !!(config.clientId && config.clientSecret && config.tokenIntegracao);
}

function hasLegacyCredentials(config): boolean {
  return !!(config.username && config.password && config.serviceUrl);
}

// Na função principal:
if (hasOAuthCredentials(config)) {
  try {
    // tenta OAuth primeiro
    const token = await loginOAuth(config);
    return await executarConsulta(urlGateway, headersOAuth(token), dados);
  } catch {
    if (!hasLegacyCredentials(config)) throw;
    // fallback automático para modo legado
    const session = await loginLegado(config);
    try {
      return await executarConsulta(urlLegado(session), headersLegado, dados);
    } finally {
      await logoutLegado(config, session); // sempre executar
    }
  }
} else {
  // somente legado
  const session = await loginLegado(config);
  try {
    return await executarConsulta(urlLegado(session), headersLegado, dados);
  } finally {
    await logoutLegado(config, session);
  }
}
```

---

## 6. Autenticação OAuth 2.0 — Client Credentials

Padrão usado pelo Sankhya Gateway e comum em ERPs modernos.

```
POST https://api.{erp}.com.br/authenticate
Content-Type: application/x-www-form-urlencoded
Headers: X-Token: {tokenIntegracao}
         client_id: {clientId}
         client_secret: {clientSecret}
Body:    grant_type=client_credentials

← { access_token: "JWT...", expires_in: 300, token_type: "Bearer" }
```

**Técnica de múltiplas estratégias** — quando a documentação do ERP for ambígua sobre onde enviar as credenciais, implementar tentativas em cascata:

```ts
const attempts = [
  { label: "header_credentials", headers: { client_id, client_secret }, body: "grant_type=client_credentials" },
  { label: "body_credentials",   headers: {},                            body: "grant_type=client_credentials&client_id=...&client_secret=..." },
  { label: "basic_auth",         headers: { Authorization: "Basic ..." }, body: "grant_type=client_credentials" },
];

for (const attempt of attempts) {
  const resp = await fetch(endpoint, { method: "POST", headers: attempt.headers, body: attempt.body, signal: AbortSignal.timeout(15_000) });
  if (resp.ok) {
    const data = await resp.json();
    if (data?.access_token) return data.access_token;
  }
  // loga e continua para próxima tentativa
}
throw new Error("OAuth: todas as estratégias falharam");
```

---

## 7. Autenticação Legada — Sessão com Token

Padrão common em ERPs on-premise (SankhyaW, TOTVS Protheus, etc.).

```
POST {serviceUrl}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json
Body: { serviceName: "MobileLoginSP.login", requestBody: { NOMUSU: { $: user }, INTERNO: { $: pass } } }

← { status: "1", responseBody: { jsessionid: { $: "abc123..." } } }
```

Uso em chamadas subsequentes:
```
?jsessionid={id}&appkey={tokenIntegracao}
```

**Logout obrigatório em `finally`**:
```ts
const session = await login(config);
try {
  return await executarConsulta(...);
} finally {
  await logout(config, session).catch(() => {}); // silencioso — não é crítico
}
```

---

## 8. Execução de Queries SQL via API

O Sankhya expõe o serviço `DbExplorerSP.executeQuery` que aceita SQL puro. Muitos ERPs REST têm equivalentes. O payload é sempre:

```json
{
  "serviceName": "DbExplorerSP.executeQuery",
  "requestBody": {
    "sql": "SELECT ... FROM TGFCAB WHERE ORDEMCARGA = 12345"
  }
}
```

A resposta retorna linhas como `string[][]` (array posicional — sem nomes de coluna):
```json
{
  "status": "1",
  "responseBody": {
    "rows": [
      ["12345", "100", "CLIENTE X", "12.345.678/0001-99", ...]
    ]
  }
}
```

Parse por posição (documentar sempre os índices com comentários):
```ts
// Posições: 0=NUMORDEM, 1=CODPARC, 2=NOMEPARC, 3=CGC_CPF, 4=NOMECID...
const numOrdem   = String(row[0] ?? "");
const codParc    = String(row[1] ?? "");
const nomeParceiro = String(row[2] ?? "");
```

---

## 9. Tabelas Principais do Sankhya (Oracle)

| Tabela | Descrição |
|---|---|
| `TGFCAB` | Cabeçalho das notas fiscais (NF, série, chave, parceiro, datas, peso, valor) |
| `TGFITE` | Itens das notas fiscais (produto, quantidade, unidade, valor unitário, valor total) |
| `TGFPRO` | Cadastro de produtos (código, descrição, unidade, código de volume/EAN) |
| `TGFPAR` | Cadastro de parceiros/clientes (nome, CNPJ/CPF, endereço, cidade, bairro) |
| `TSICID` | Cadastro de municípios (código IBGE — `CODMUNFIS`, nome) |
| `TSIBAI` | Cadastro de bairros (nome variável: `NOMEBAI` ou `BAIRRO` dependendo da versão) |

### Campos importantes de `TGFCAB`

| Campo | Descrição |
|---|---|
| `ORDEMCARGA` | Número da ordem de carga (filtro principal) |
| `NUNOTA` | ID interno da nota (usado para download de XML) |
| `NUMNOTA` | Número visível da nota fiscal |
| `SERIENOTA` | Série da nota fiscal |
| `CHAVENFE` | Chave de acesso NF-e (44 dígitos) |
| `TIPMOV` | Tipo de movimento: `'V'` = venda |
| `STATUSNOTA` | Status: `'L'` = liberada (usar como filtro) |
| `DTFATUR` | Data de faturamento (pode ser `NULL` — usar `COALESCE(DTFATUR, DTNEG)`) |
| `DTNEG` | Data de negociação (fallback de data) |
| `PESOBRUTO` | Peso bruto (preferir sobre `PESO` quando disponível) |
| `VLRNOTA` | Valor total da nota |
| `QTDVOL` | Quantidade de volumes |

### Campos importantes de `TGFITE`

| Campo | Descrição |
|---|---|
| `CODPROD` | Código do produto |
| `QTDNEG` | Quantidade negociada |
| `QTDFAT` | Quantidade faturada (preferir: `COALESCE(NULLIF(QTDFAT,0), NULLIF(QTDENTREGUE,0), QTDNEG)`) |
| `QTDENTREGUE` | Quantidade entregue |
| `UNIDADE` | Unidade de medida do item (pode ser vazia) |
| `CODVOL` | Código de volume (fallback de unidade) |
| `VLRUNIT` | Valor unitário |
| `VLRTOT` | Valor total do item |
| `SEQUENCIA` | Número sequencial do item na nota |

---

## 10. Padrão de Fallback de Query em Cascata

Diferentes clientes podem ter versões diferentes do ERP ou configurações distintas que fazem certas colunas não existirem. Implementar uma cascata de compatibilidade:

```ts
const attempts = [
  { label: "completo",      sql: sqlCompleto },        // tudo — bairro, dtfatur, unidade
  { label: "sem_bairro",    sql: sqlSemBairro },       // remove join TSIBAI
  { label: "sem_dtfatur",   sql: sqlSemDtFatur },      // usa apenas DTNEG
  { label: "compat",        sql: sqlCompat },           // simplifica unidade e datas
  { label: "ultra_compat",  sql: sqlUltraCompat },     // mínimo absoluto
];

let rows: string[][] = [];
let ultimoErro: unknown;

for (const attempt of attempts) {
  try {
    rows = await executarQuery(url, headers, attempt.sql);
    if (attempt.label !== "completo") {
      console.warn(`[ERP] Query em modo compatibilidade: ${attempt.label}`);
    }
    break;
  } catch (err) {
    ultimoErro = err;
    console.warn(`[ERP] Falha na query (${attempt.label}):`, err);
  }
}

if (!rows.length && ultimoErro) throw ultimoErro;
```

---

## 11. Consolidação de Itens (Deduplicação)

Quando o ERP retorna um produto em múltiplas linhas (rateios de desconto, complementos), agrupe antes de salvar:

```ts
function consolidarItens(itens: Item[]): Item[] {
  const grouped = new Map<string, Item>();

  for (const item of itens) {
    // Chave de agrupamento: produto + unidade + valor unitário + descrição + EAN
    const key = `${item.codProd}|${item.unidade}|${item.vlrUnit}|${item.descricao}|${item.ean}`;

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...item });
    } else {
      existing.qtd    = round(existing.qtd + item.qtd, 6);
      existing.vlrTot = round(existing.vlrTot + item.vlrTot, 6);
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.numItem - b.numItem);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
```

---

## 12. Timeouts e Robustez

Sempre usar `AbortSignal.timeout()` — nunca chamadas sem timeout:

| Operação | Timeout recomendado |
|---|---|
| Login / autenticação | 15.000 ms (15s) |
| Logout | 5.000 ms (5s) — silencioso |
| Query cabeçalho | 20.000 ms (20s) |
| Query itens (pode ser grande) | 30.000 ms (30s) |
| Download de XML/arquivo | 30.000 ms (30s) |

```ts
const resp = await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(30_000),
});
```

---

## 13. Segurança — Prevenção de SQL Injection

O ERP remoto executa o SQL — validar **sempre** os parâmetros interpolados antes de construir a string:

```ts
// ✅ CORRETO: validar tipo e intervalo antes de interpolar
const numOrdemInt = parseInt(numOrdem, 10);
if (!Number.isInteger(numOrdemInt) || numOrdemInt <= 0) {
  throw new Error(`Número de ordem inválido: ${numOrdem}`);
}
const sql = `SELECT * FROM TGFCAB WHERE ORDEMCARGA = ${numOrdemInt}`;

// ✅ CORRETO: nomes de tabela — validar com regex restrito
function sanitizarNomeTabela(raw: string): string {
  if (!/^[A-Z0-9_]+$/i.test(raw.trim())) {
    throw new Error(`Nome de tabela inválido: ${raw}`);
  }
  return raw.trim().toUpperCase();
}

// ❌ ERRADO: nunca interpolar string diretamente sem validação
const sql = `SELECT * FROM TGFCAB WHERE ORDEMCARGA = '${numOrdem}'`; // risco de injection
```

---

## 14. Controle de Importação Duplicada

Antes de criar uma tarefa/registro a partir de dados do ERP, verificar duplicidade:

```ts
// Janela de "importando agora" — evita race condition entre dois usuários
const JANELA_MS = 20 * 60 * 1000; // 20 minutos
const agora = Date.now();

const tarefasAtivas = tarefasExistentes
  .filter(t => t.status === "criada")
  .filter(t => agora - t.createdAt.getTime() <= JANELA_MS);

if (tarefasAtivas.length > 0) {
  // retornar 409 — importação em andamento, não criar duplicata
}

// Se existem tarefas finalizadas, exigir confirmação do usuário (reimport)
if (tarefasFinalizadas.length > 0 && !confirmReimport) {
  // retornar 409 com requiresConfirmation: true
}
```

---

## 15. Endpoint de Diagnóstico

Criar sempre um endpoint de diagnóstico para facilitar suporte e depuração em campo:

```
GET /api/integracoes/{erp}/diagnostico
  ?tables=TGFCAB,TGFITE    → inspecionar colunas de tabelas específicas
  &sample=1                 → incluir amostra de dados (ROWNUM <= N)
  &sampleLimit=3            → quantas linhas na amostra (1-20)
  &catalog=1                → listar todas as tabelas e sinônimos disponíveis
```

Este endpoint:
- Autentica com as mesmas credenciais configuradas
- Executa `SELECT ... FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'X'` para cada tabela
- Retorna colunas, tipos, precisão e nullable
- É protegido por sessão (apenas owner/superadmin)
- Não altera nenhum dado — somente leitura

---

## 16. Conversões Auxiliares Úteis

### Código IBGE de estado (prefixo do CODMUNFIS) → sigla UF

```ts
function ibgeCodeToUf(code: string): string {
  const map: Record<string, string> = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
    "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF",
  };
  return map[code] ?? code;
}
// Uso: ibgeCodeToUf(SUBSTR(TO_CHAR(CODMUNFIS), 1, 2))
```

### Parse de data vinda do Sankhya

```ts
function parseSankhyaDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value); // aceita ISO 8601: "2024-03-15T00:00:00"
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
```

---

## 17. Normalização da URL Base

O campo `serviceUrl` pode vir com ou sem `/mge/` no final. Normalizar antes de compor chamadas:

```ts
function normalizeBaseUrl(serviceUrl: string): string {
  return serviceUrl
    .replace(/\/mge\/?$/, "")   // remove /mge ou /mge/ do final
    .replace(/\/$/, "");         // remove barra final
}

// Uso:
const base = normalizeBaseUrl(config.serviceUrl);
const loginUrl = `${base}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json`;
```

---

## 18. Checklist para Novo Integrador

- [ ] Criar `src/lib/{erp}-client.ts` com interfaces públicas tipadas
- [ ] Implementar `login()` / `logout()` com `AbortSignal.timeout`
- [ ] Implementar `testarConexao()` — retorna `{ ok, erro, modo }`
- [ ] Implementar a função principal de busca de dados
- [ ] Validar todos os parâmetros interpolados em SQL contra injection
- [ ] Implementar fallback em cascata de queries (pelo menos 2 níveis)
- [ ] Adicionar o novo `tipo` nos selects do endpoint `GET /api/integracoes`
- [ ] Criar endpoint `buscar-{entidade}/route.ts` com verificação de duplicidade
- [ ] Criar endpoint `diagnostico/route.ts` para suporte
- [ ] Garantir que senhas/secrets nunca aparecem nas respostas JSON
- [ ] Documentar as tabelas e colunas usadas do ERP alvo (como a seção 9 deste arquivo)
- [ ] Testar com `preview=true` antes de criar dados definitivos

---

## 19. Variáveis de Ambiente Relevantes

```env
# Feature flags de integração (adicionar no .env.example ao criar novos)
SANKHYA_IMPORT_USE_XML=false   # ativa download de XML NF-e (desativado por padrão)
```

Padrão para novas feature flags de integração:
- Nomear como `{ERP}_IMPORT_{FUNCIONALIDADE}=true/false`
- Desativar por padrão — ativar explicitamente em produção quando validado

---

*Referência: implementação completa em `src/lib/sankhya-client.ts` e `src/app/api/integracoes/sankhya/`.*
