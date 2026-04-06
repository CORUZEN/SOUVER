# Importação de Vendedores e Produtos — Sankhya ERP

> Documentação técnica do fluxo de sincronização de vendedores e produtos do Sankhya para o módulo de Metas do sistema Ouro Verde.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [Montagem de headers](#montagem-de-headers)
4. [Endpoints SQL (DbExplorerSP)](#endpoints-sql-dbexplorersp)
5. [Particularidades do Oracle](#particularidades-do-oracle)
6. [Limite de 5000 linhas da API](#limite-de-5000-linhas-da-api)
7. [Parsing da resposta (fieldsMetadata)](#parsing-da-resposta-fieldsmetadata)
8. [Consulta de produtos](#consulta-de-produtos)
9. [Consulta de vendedores](#consulta-de-vendedores)
10. [Padrão de fallback em cascata](#padrão-de-fallback-em-cascata)
11. [Comportamento da UI (importação read-only)](#comportamento-da-ui-importação-read-only)
12. [Referência de arquivos](#referência-de-arquivos)

---

## Visão geral

O módulo de Metas importa duas entidades do Sankhya via API REST:

| Entidade    | Tabela principal | Filtros aplicados                                           |
|-------------|------------------|-------------------------------------------------------------|
| **Produtos**   | `TGFPRO`         | Mobilidade = SIM, Marca dentro da lista permitida           |
| **Vendedores** | `TGFVEN`         | Tipo = Vendedor ou Supervisor (`TIPVEND IN ('V','S')`), Ativo = Sim (`ATIVO = 'S'`) |

Ambos os fluxos seguem a mesma arquitetura:

```
OAuth2 → buildHeaders → queryRows (SQL via DbExplorerSP) → parse → merge com estado existente → salvar
```

---

## Autenticação

### OAuth2 (modo principal)

```
POST {origin}/authenticate
Content-Type: application/x-www-form-urlencoded
X-Token: {config.token}

grant_type=client_credentials
&client_id={config.clientId}
&client_secret={config.clientSecret}
```

- **Origins tentados** (em ordem): `https://api.sankhya.com.br` → `https://api.sandbox.sankhya.com.br` → URL on-premise.
- A resposta retorna um JWT (bearer token) em campos variados: `access_token`, `bearerToken`, `token` ou `jwt`.
- O token tem ~2163 caracteres e é necessário para acessar o cloud gateway.

### Session fallback (MobileLoginSP.login)

Se OAuth2 falhar (ex: sem `clientId`/`clientSecret`), tenta login de sessão via on-premise:

```
POST {baseUrl}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json

{
  "serviceName": "MobileLoginSP.login",
  "requestBody": {
    "NOMUSU": { "$": "{username}" },
    "INTERNO": { "$": "{password}" },
    "KEEPCONNECTED": { "$": "S" }
  }
}
```

Retorna `jsessionid` ou `bearerToken` no `responseBody`.

### Credenciais atuais (Ouro Verde)

| Campo          | Valor                                    |
|----------------|------------------------------------------|
| `token`        | `b1ea155e-a82a-4752-b955-98a88051dbbc`   |
| `clientId`     | `81e6c345-7fe3-4d6b-80b8-ef0cc0d18bfd`  |
| `clientSecret` | `xyo19h6n0iowsmXBl2lJoRHnRGGMhXB3`     |
| `authMode`     | `OAUTH2`                                 |
| On-premise     | `http://ouroverde.nuvemdatacom.com.br:10089` |

---

## Montagem de headers

Após obter o bearer token, os headers devem ser montados assim:

```typescript
function buildHeaders(config, bearerToken) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  // CRÍTICO: o header `token` deve receber o bearer JWT (não o API key estático)
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`
    headers.token = bearerToken           // ← Sankhya cloud exige isso
  } else if (config.token) {
    headers.token = config.token
  }

  // X-Token sempre envia o API key estático
  if (config.token) headers['X-Token'] = config.token

  // appkey: usar config.appKey ou fallback para config.token
  // IMPORTANTE: config.appKey pode ser null/vazio; sem appkey o cloud gateway rejeita
  const appKeyValue = config.appKey || config.token
  if (appKeyValue) {
    headers.appkey = appKeyValue
    headers.AppKey = appKeyValue
  }

  return headers
}
```

### Erros comuns de headers

| Sintoma | Causa | Solução |
|---------|-------|---------|
| `NullPointerException` | `appkey` header ausente (config.appKey era null) | Fallback `appkey` para `config.token` |
| `Não autorizado` / HTTP 401 | `token` header continha API key em vez do bearer JWT | Enviar bearer no header `token` |
| HTTP 403 no gateway | Sem `Authorization: Bearer` | Sempre enviar quando disponível |

---

## Endpoints SQL (DbExplorerSP)

Para executar SQL no Sankhya, usa-se o serviço `DbExplorerSP.executeQuery`:

```
POST {endpoint}?serviceName=DbExplorerSP.executeQuery&outputType=json&appkey={appKey}

{
  "serviceName": "DbExplorerSP.executeQuery",
  "requestBody": { "sql": "SELECT ..." }
}
```

### Priorização de endpoints

```typescript
function getSqlEndpoints(baseUrl, appKey, hasBearer = false) {
  if (hasBearer) {
    return [
      // Cloud gateway primeiro (mais rápido e confiável com bearer)
      `https://api.sankhya.com.br/gateway/v1/mge/service.sbr?...`,
      // On-premise como fallback
      `${baseUrl}/mge/service.sbr?...`,
    ]
  }
  // Sem bearer, só tenta on-premise
  return [`${baseUrl}/mge/service.sbr?...`]
}
```

> **Regra**: com bearer → priorizar cloud gateway (2 endpoints). Sem bearer → apenas on-premise (1 endpoint). Antes usávamos 5 endpoints indiscriminadamente, o que era lento e desnecessário.

### Variantes de payload

Tentar 3 formatos de payload em ordem, pois versões diferentes do Sankhya aceitam formatos diferentes:

1. `{ serviceName: '...', requestBody: { sql } }` — formato padrão
2. `{ requestBody: { sql } }` — sem serviceName no body
3. `{ serviceName: '...', requestBody: { statement: sql } }` — campo `statement` em vez de `sql`

---

## Particularidades do Oracle

### `''` (string vazia) é NULL no Oracle

No Oracle, uma string vazia é tratada como `NULL`. Isso significa que filtros como:

```sql
-- ❌ ERRADO: sempre retorna 0 linhas no Oracle
WHERE NVL(TRIM(V.APELIDO), '') <> ''
```

A expressão `NVL(TRIM(X), '')` **sempre** retorna `''` quando `X` é NULL (pois `'' = NULL` no Oracle), e `''` comparado com `<> ''` é `NULL <> NULL`, que é falso.

```sql
-- ✅ CORRETO: funciona no Oracle
WHERE TRIM(V.APELIDO) IS NOT NULL
```

### Regra geral

| Padrão errado (Oracle)              | Padrão correto                   |
|--------------------------------------|----------------------------------|
| `NVL(TRIM(X), '') <> ''`            | `TRIM(X) IS NOT NULL`           |
| `NVL(X, '') <> ''`                  | `X IS NOT NULL`                 |
| `COALESCE(TRIM(X), '') <> ''`       | `TRIM(X) IS NOT NULL`           |

---

## Limite de 5000 linhas da API

A API do Sankhya retorna **no máximo 5000 linhas** por consulta. Se a tabela tiver mais que 5000 registros, a resposta será truncada silenciosamente (sem erro).

### Impacto

Se fizermos consultas separadas (ex: uma para produtos, outra para marcas, outra para mobilidade), cada uma retorna um subconjunto diferente de 5000 linhas. Os registros-alvo podem ficar fora de todos os subconjuntos.

### Solução: consulta combinada com filtros no SQL

Em vez de múltiplas consultas separadas + cruzamento em JS, usar uma **única query SQL** que já aplica todos os filtros e traz todas as colunas necessárias:

```sql
-- Produtos: ~73 linhas (bem abaixo de 5000)
SELECT
  TO_CHAR(P.CODPROD) AS CODIGO,
  TRIM(P.DESCRPROD) AS DESCRICAO,
  TRIM(P.MARCA) AS MARCA,
  UPPER(TRIM(TO_CHAR(P.CODVOL))) AS UNIDADE,
  UPPER(TRIM(TO_CHAR(P.AD_MOBILIDADE))) AS MOBILIDADE
FROM TGFPRO P
WHERE TRIM(P.DESCRPROD) IS NOT NULL
  AND UPPER(TRIM(TO_CHAR(P.AD_MOBILIDADE))) IN ('SIM', 'S', '1', 'Y')
ORDER BY TRIM(P.DESCRPROD)
```

```sql
-- Vendedores: ~19 linhas (bem abaixo de 5000)
SELECT
  TO_CHAR(V.CODVEND) AS CODVEND,
  TRIM(V.APELIDO) AS APELIDO,
  TO_CHAR(MAX(CAB.CODPARC)) AS CODPARC
FROM TGFVEN V
LEFT JOIN TGFCAB CAB
  ON CAB.CODVEND = V.CODVEND
 AND CAB.TIPMOV IN ('V', 'P')
 AND NVL(CAB.STATUSNOTA, 'L') <> 'C'
WHERE TRIM(V.APELIDO) IS NOT NULL
  AND UPPER(TRIM(V.TIPVEND)) IN ('V', 'S', 'VENDEDOR', 'SUPERVISOR')
  AND V.ATIVO = 'S'
GROUP BY V.CODVEND, TRIM(V.APELIDO)
ORDER BY TRIM(V.APELIDO)
```

> **Princípio**: mover a filtragem para o SQL para que o resultado caiba folgadamente dentro do limite de 5000 linhas.

---

## Parsing da resposta (fieldsMetadata)

A API do Sankhya retorna dados em dois formatos:

### Formato objeto (rows como `{ CAMPO: valor }`)
```json
{
  "responseBody": {
    "rows": [
      { "CODPROD": "123", "DESCRPROD": "Cafe Especial" }
    ]
  }
}
```

### Formato array (rows como `[valor1, valor2]`)
```json
{
  "responseBody": {
    "fieldsMetadata": [
      { "name": "CODPROD" },
      { "name": "DESCRPROD" }
    ],
    "rows": [
      ["123", "Cafe Especial"]
    ]
  }
}
```

> **IMPORTANTE**: o campo de metadados pode vir como `fields` **ou** `fieldsMetadata`. O parser deve verificar ambos:

```typescript
const fieldsRaw = Array.isArray(body.fields) ? body.fields
  : Array.isArray(body.fieldsMetadata) ? body.fieldsMetadata
  : []
```

Cada item de `fieldsMetadata` pode ser:
- String direta: `"CODPROD"`
- Objeto: `{ name: "CODPROD" }` ou `{ fieldName: "CODPROD" }` ou `{ FIELD_NAME: "CODPROD" }`

---

## Consulta de produtos

### Tabela: `TGFPRO` (Produtos)

| Coluna | Descrição | Variantes de nome |
|--------|-----------|-------------------|
| `CODPROD` | Código do produto | — |
| `DESCRPROD` | Descrição | — |
| `MARCA` / `AD_MARCA` | Marca | Depende do schema |
| `CODVOL` / `UNIDPADRAO` | Unidade | Várias variantes |
| `AD_MOBILIDADE` / `AD_MOBILIDA` | Flag de mobilidade | Varia por instalação |

### Marcas permitidas

```
CAFES, COLORIFICOS/TEMPEROS, GRAOS, RACAO PASSAROS, RACAO PET - CACHORRO, RACAO PET - GATO
```

### Estratégia de colunas dinâmicas

Como os nomes de colunas de mobilidade, marca e unidade variam entre instalações, testamos combinações:

```typescript
const mobilityCandidates = ['AD_MOBILIDADE', 'AD_MOBILIDA', 'MOBILIDADE', 'MOBILIDA']
const brandCandidates = ['MARCA', 'AD_MARCA']
const unitCandidates = ['CODVOL', 'UNIDPADRAO', 'UNDPADRAO', 'UNIDADEPADRAO', 'CODVOLPADRAO']
```

Se uma combinação gera erro SQL (coluna inexistente), tenta-se a próxima.

### Resultado esperado: **51 produtos** (Ouro Verde, abril/2026)

---

## Consulta de vendedores

### Tabela: `TGFVEN` (Vendedores)

| Coluna | Descrição |
|--------|-----------|
| `CODVEND` | Código do vendedor |
| `APELIDO` | Nome/apelido do vendedor |
| `TIPVEND` | Tipo: `V` (Vendedor), `S` (Supervisor) |
| `ATIVO` | Status: `S` (Sim/Ativo) |

### JOIN com `TGFCAB` (Cabeçalho de Notas)

Para obter o código parceiro (`CODPARC`) mais recente, faz-se LEFT JOIN:

```sql
LEFT JOIN TGFCAB CAB
  ON CAB.CODVEND = V.CODVEND
 AND CAB.TIPMOV IN ('V', 'P')      -- Vendas e Pedidos
 AND NVL(CAB.STATUSNOTA, 'L') <> 'C'  -- Excluir canceladas
```

### Filtros aplicados

```sql
WHERE TRIM(V.APELIDO) IS NOT NULL              -- Tem nome
  AND UPPER(TRIM(V.TIPVEND)) IN ('V', 'S', 'VENDEDOR', 'SUPERVISOR')  -- Apenas vendedores e supervisores
  AND V.ATIVO = 'S'                             -- Apenas ativos
```

### Cascata de fallback

1. **Combinado** — `TGFVEN` + `TGFCAB` com filtros de tipo e ativo
2. **Somente TGFVEN** — Sem JOIN, com filtros de tipo e ativo
3. **Último recurso** — Somente `TGFVEN` com filtro de ativo (sem tipo, caso `TIPVEND` não exista)

### Resultado esperado: **19 vendedores** (Ouro Verde, abril/2026)

---

## Padrão de fallback em cascata

Toda consulta ao Sankhya segue esta hierarquia de tentativas:

```
1. Para cada SQL candidato (do mais completo ao mais simples):
   2. Para cada endpoint (cloud gateway primeiro se tiver bearer):
      3. Para cada variante de payload (3 formatos):
         → Se retornou dados → usar
         → Se erro de serviço → próxima variante
         → Se HTTP error → próximo endpoint
   → Se nenhum endpoint funcionou → próximo SQL
→ Se nenhum SQL funcionou → lançar erro com detalhes
```

A função `queryRows` centraliza essa lógica e é reutilizada por ambos os fluxos (produtos e vendedores).

---

## Comportamento da UI (importação read-only)

### Princípio

Os dados importados do Sankhya são **somente leitura** — nome, código, marca, unidade etc. não podem ser editados manualmente. Os únicos controles disponíveis são:

| Controle | Função |
|----------|--------|
| **Checkbox ativo** | Ativar/desativar o item na meta |
| **Botão Remover** | Remove o item da lista (com auto-save) |
| **Sincronizar Sankhya** | Re-importa todos os itens do ERP |
| **Salvar lista** | Persiste alterações de ativo/inativo |

### Auto-save no Remover

O botão "Remover" salva a lista atualizada automaticamente no servidor via `PUT`, para que o item não "volte" ao recarregar a página:

```typescript
async function removeSellerAndSave(removeIndex: number) {
  const updated = allowlist.filter((_, i) => i !== removeIndex)
  setAllowlist(updated)  // atualiza UI imediatamente

  // persiste no servidor
  await fetch('/api/metas/sellers-allowlist', {
    method: 'PUT',
    body: JSON.stringify({ sellers: updated }),
  })
}
```

Se o save falhar, recarrega do servidor para manter consistência.

---

## Referência de arquivos

| Arquivo | Função |
|---------|--------|
| `src/app/api/metas/products-allowlist/sync/route.ts` | Sync de produtos do Sankhya |
| `src/app/api/metas/sellers-allowlist/sync/route.ts` | Sync de vendedores do Sankhya |
| `src/app/api/metas/products-allowlist/route.ts` | CRUD da allowlist de produtos (GET/PUT) |
| `src/app/api/metas/sellers-allowlist/route.ts` | CRUD da allowlist de vendedores (GET/PUT) |
| `src/components/metas/MetasWorkspace.tsx` | UI do painel de metas |
| `src/lib/integrations/config.ts` | Config/auth do Sankhya (parseStoredConfig, SankhyaConfig) |
| `src/lib/metas/product-allowlist.ts` | Marcas permitidas, normalização |
| `src/lib/metas/product-allowlist-store.ts` | Leitura/escrita da allowlist de produtos |
| `src/lib/metas/seller-allowlist-store.ts` | Leitura/escrita da allowlist de vendedores |
| `src/lib/metas/seller-allowlist.ts` | Tipos e utilitários de vendedores |

---

## Checklist para novas importações de entidades Sankhya

- [ ] Usar `authenticateOAuth` com fallback para `authenticateSession`
- [ ] Montar headers com `buildHeaders` (bearer no `token`, appkey fallback)
- [ ] Priorizar cloud gateway quando tiver bearer
- [ ] Usar `TRIM(X) IS NOT NULL` (nunca `NVL(TRIM(X), '') <> ''`)
- [ ] Aplicar filtros no SQL para ficar abaixo de 5000 linhas
- [ ] Verificar `fieldsMetadata` além de `fields` no parsing
- [ ] Testar 3 variantes de payload
- [ ] Implementar fallback em cascata (SQL completo → simplificado → mínimo)
- [ ] UI read-only para dados importados
- [ ] Auto-save no botão Remover
