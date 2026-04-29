# Checklist de Homologação — SOUVER

> **Data:** 2026-04-27  
> **Versão:** 1.0.1  
> **Escopo:** Validação das mudanças de segurança e otimizações de build

---

## 1. Autenticação e Sessão

### 1.1 Login
- [ ] Acessar `/app/login` e fazer login com credenciais válidas
- [ ] Verificar que o cookie `souver_token` é criado (DevTools → Application → Cookies)
- [ ] Verificar que o cookie `souver_refresh_token` é criado
- [ ] Confirmar que ambos os cookies têm `SameSite=Strict`
- [ ] Confirmar que ambos os cookies têm `HttpOnly`
- [ ] Em produção, confirmar `Secure` flag nos cookies

### 1.2 Refresh Token (nova funcionalidade)
- [ ] Fazer login, anotar o valor do `souver_token`
- [ ] Aguardar o tempo de expiração do access token (ou simular removendo o cookie `souver_token`)
- [ ] Navegar para uma página protegida — o sistema deve renovar o token automaticamente
- [ ] Verificar que um novo `souver_token` foi emitido (valor diferente)
- [ ] Verificar que o `souver_refresh_token` permanece o mesmo
- [ ] Verificar que a sessão continua ativa após o refresh

### 1.3 Logout
- [ ] Clicar em "Sair"
- [ ] Confirmar que os cookies `souver_token`, `souver_refresh_token` e `souver_impersonator_token` foram removidos
- [ ] Tentar acessar uma página protegida após logout → deve redirecionar para login

### 1.4 2FA / TOTP
- [ ] Fazer login com usuário que tenha 2FA ativado
- [ ] Confirmar que o cookie `souver_2fa_challenge` é criado (SameSite=Strict, HttpOnly)
- [ ] Inserir código TOTP válido → login completo
- [ ] Inserir código TOTP inválido → erro, sem vazamento de token

### 1.5 Personificação (Impersonate)
- [ ] Como administrador, personificar um vendedor
- [ ] Confirmar que o cookie `souver_impersonator_token` é criado
- [ ] Sair da personificação → cookie removido

### 1.6 Recuperação de Senha
- [ ] Acessar "Esqueci minha senha"
- [ ] Inserir e-mail válido
- [ ] Em desenvolvimento: confirmar que o token `_dev` é exibido no console/response
- [ ] Em produção: confirmar que NENHUM token é exposto na resposta
- [ ] Usar o link de reset com token válido → senha alterada com sucesso
- [ ] Usar token expirado/inválido → erro apropriado

---

## 2. Rate Limiting

### 2.1 Login
- [ ] Tentar login com senha errada 5 vezes em 15 minutos
- [ ] A 6ª tentativa deve retornar erro de rate limit (429)
- [ ] Aguardar 15 minutos ou limpar o cache → tentativa deve funcionar

### 2.2 Esqueci minha senha
- [ ] Solicitar recuperação 3 vezes em 60 minutos
- [ ] A 4ª solicitação deve retornar 429

### 2.3 Reset de senha
- [ ] Tentar reset com token inválido 5 vezes em 15 minutos
- [ ] A 6ª tentativa deve retornar 429

---

## 3. Autorização e Permissões

### 3.1 Departamentos (POST /api/departments)
- [ ] Tentar criar departamento como `SELLER` → deve retornar 403
- [ ] Tentar criar departamento como `IT_ANALYST` → deve funcionar
- [ ] Tentar criar departamento como `DEVELOPER` → deve funcionar

### 3.2 Relatórios RH (/api/reports/export?module=hr)
- [ ] Acessar como usuário sem permissão `hr:read` → 403
- [ ] Acessar como `DIRECTORATE` ou `HR_MANAGER` → deve funcionar
- [ ] Acessar como `DEVELOPER` → deve funcionar

---

## 4. Segurança de APIs

### 4.1 Health Check
- [ ] GET `/api/health` → deve retornar apenas `{ status: "healthy", timestamp: "..." }`
- [ ] Confirmar que NÃO há campos `memory`, `uptime`, `version` na resposta

### 4.2 Cron Jobs
- [ ] GET `/api/cron/cleanup` sem header `x-cron-secret` → 401
- [ ] GET `/api/cron/cleanup` com header `x-cron-secret` inválido → 401
- [ ] GET `/api/cron/cleanup` com header `x-cron-secret` correto → 200

### 4.3 Proxy / Middleware
- [ ] Acessar página pública (ex: `/app/login`) sem token → deve carregar
- [ ] Acessar página protegida sem token → redirecionar para login
- [ ] Acessar página protegida com token inválido → redirecionar para login, cookie limpo

---

## 5. Build e Deploy

### 5.1 Build Local
- [ ] Executar `npm run build` localmente
- [ ] Confirmar que não há erros de TypeScript
- [ ] Confirmar que não há warnings críticos de ESLint
- [ ] Verificar que o `.env.local` não é copiado para `.next/`

### 5.2 Deploy Vercel
- [ ] Fazer push para a branch de deploy
- [ ] Confirmar que o build completa com sucesso
- [ ] Verificar que não há warnings de peer dependencies (eslint)
- [ ] Confirmar que o cache foi utilizado (se não for o primeiro deploy da branch)

---

## 6. Performance

### 6.1 PWA
- [ ] Acessar `/app/login` em dispositivo móvel
- [ ] Verificar que o service worker está registrado
- [ ] Confirmar que o manifest está carregando corretamente

### 6.2 Navegação
- [ ] Navegar entre páginas do dashboard
- [ ] Confirmar que não há flickers de autenticação
- [ ] Confirmar que o `fetchWithRefresh` funciona silenciosamente

---

## 7. Integração Sankhya (Metas)

### 7.1 Validação de Códigos
- [ ] Acessar relatório de metas com código de vendedor válido → dados carregam
- [ ] Tentar injetar SQL via parâmetro de vendedor (ex: `123 OR 1=1`) → rejeitado
- [ ] Confirmar que apenas códigos numéricos puros são aceitos

---

## Ambientes

| Ambiente | URL | Status |
|----------|-----|--------|
| Desenvolvimento | http://localhost:3001 | ⬜ |
| Homologação | [inserir URL da Vercel] | ⬜ |
| Produção | [inserir URL da Vercel] | ⬜ |

---

## Observações

- **bcryptjs → bcrypt**: A primeira execução após o deploy pode ter um leve delay na criação de hashes (compilação do módulo nativo). Isto é normal.
- **JWT Key Rotation**: Se `JWT_SECRET` for alterado, tokens antigos ainda funcionam durante 24h se `JWT_SECRET_LEGACY` estiver configurado.
- **CRON_SECRET**: Deve estar configurado nas variáveis de ambiente da Vercel para produção.
- **NEXTAUTH_SECRET/NEXTAUTH_URL**: Podem ser removidos das variáveis de ambiente da Vercel (não são mais utilizados).

---

## Aprovação

| Responsável | Data | Assinatura |
|-------------|------|------------|
| | | |
