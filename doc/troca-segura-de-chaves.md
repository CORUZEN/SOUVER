# 🔐 Guia de Troca Segura de Chaves Secretas — SOUVER

> Data: 29/04/2026  
> Escopo: JWT_SECRET, JWT_SECRET_LEGACY, NEXTAUTH_SECRET

---

## ❓ Por que trocar as chaves?

As chaves `JWT_SECRET` e `NEXTAUTH_SECRET` aparecem no painel da Vercel com **"Needs Attention"** porque:
- Podem ser valores padrão/gerados automaticamente (menos seguros)
- Podem ter sido expostas em logs, screenshots, ou compartilhamentos
- Boas práticas de segurança recomendam rotação periódica de secrets

---

## 🧹 NEXTAUTH_SECRET — pode remover!

**O SOUVER NÃO usa NextAuth.** Verificamos todo o código-fonte e não existe nenhuma importação do `next-auth`.

| Variável | Uso real no SOUVER | Ação recomendada |
|----------|-------------------|------------------|
| `NEXTAUTH_SECRET` | ❌ Nenhum | **Remover** do painel Vercel e do `.env.local` |
| `NEXTAUTH_URL` | ❌ Nenhum | **Remover** do painel Vercel e do `.env.local` |
| `JWT_SECRET` | ✅ Essencial (tokens de sessão) | **Trocar** seguindo o playbook abaixo |
| `JWT_SECRET_LEGACY` | ✅ Transição suave | Usar apenas durante rotação |

---

## 🔄 Playbook: Troca do JWT_SECRET SEM deslogar usuários

Implementamos **suporte a múltiplas chaves** no código. Isso permite uma transição suave:

### Fase 1 — Preparação (agora)

1. **Gere novas chaves** executando:
   ```bash
   node scripts/generate-secrets.mjs
   ```

2. **Anote 3 valores**:
   - `JWT_SECRET` → **nova chave** (vai substituir a atual)
   - `JWT_SECRET_LEGACY` → **chave atual/antiga** (vai permitir que tokens antigos continuem funcionando)
   - `CRON_SECRET` → se ainda não tiver configurado

### Fase 2 — Deploy com duas chaves (hora de baixo tráfego)

3. No painel da **Vercel** (ou `.env.local` para dev):
   - Substitua `JWT_SECRET` pela **nova chave**
   - Adicione `JWT_SECRET_LEGACY` com a **chave antiga**
   - (Opcional) Adicione `CRON_SECRET`

4. **Faça deploy**

5. **O que acontece:**
   - ✅ Tokens **novos** são assinados com a nova chave
   - ✅ Tokens **antigos** ainda são aceitos via chave legada
   - ✅ Nenhum usuário é deslogado!

### Fase 3 — Remoção da chave legada (após 30 dias)

6. Aguarde **30 dias** (tempo máximo de vida do refresh token)

7. Remova a variável `JWT_SECRET_LEGACY` do painel Vercel

8. Faça **novo deploy**

9. ✅ Apenas tokens assinados com a **nova chave** são aceitos

---

## 📋 Checklist Visual

```
Dia 0:  JWT_SECRET = [NOVA]      JWT_SECRET_LEGACY = [ANTIGA]  → Deploy
Dia 1-29:  Sistema aceita AMBAS as chaves (transição suave)
Dia 30:  Remova JWT_SECRET_LEGACY  →  Deploy final
```

---

## ⚠️ Importante: Se trocar DE UMA VEZ (sem legado)

Se você simplesmente trocar o `JWT_SECRET` sem usar `JWT_SECRET_LEGACY`:
- **TODOS os usuários serão deslogados imediatamente**
- Os tokens antigos não passarão mais na verificação
- Isso pode ser aceitável em horário de baixo tráfego (ex: domingo de madrugada)

**Recomendamos usar a transição suave (JWT_SECRET_LEGACY) para evitar impacto operacional.**

---

## 🔧 Comandos úteis

### Gerar chaves manualmente (sem o script):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

### Testar se a nova chave está funcionando (local):
1. Atualize `.env.local`
2. Reinicie o servidor: `npm run dev`
3. Faça login — deve funcionar normalmente
4. Verifique os cookies no navegador (DevTools → Application → Cookies)

---

## 📁 Arquivos relacionados

| Arquivo | Função |
|---------|--------|
| `scripts/generate-secrets.mjs` | Gera secrets seguros |
| `src/lib/auth/jwt-edge.ts` | Verifica tokens com chave atual + legada |
| `src/lib/auth/jwt.ts` | Verifica tokens (Node.js) com chave atual + legada |
| `src/lib/auth/refresh-token.ts` | Verifica refresh tokens com chave atual + legada |
| `.env.example` | Documentação das variáveis |

---

> Dúvidas? Pergunte antes de executar a troca em produção.
