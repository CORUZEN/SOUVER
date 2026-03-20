#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SISTEMA OURO VERDE — SOUVER
#  Script de Inicialização do Servidor de Desenvolvimento
#  Versão: 1.0.0
#  Porta: 3001
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Cores para output ────────────────────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
WHITE='\033[1;37m'

# ─── Funções de logging ───────────────────────────────────────────────────────
log_header()  { echo -e "\n${BOLD}${WHITE}$1${RESET}"; }
log_info()    { echo -e "  ${CYAN}→${RESET}  $1"; }
log_success() { echo -e "  ${GREEN}✔${RESET}  $1"; }
log_warn()    { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
log_error()   { echo -e "  ${RED}✖${RESET}  $1" >&2; }
log_sep()     { echo -e "${GRAY}───────────────────────────────────────────────────────────────${RESET}"; }

# ─── Banner ───────────────────────────────────────────────────────────────────
clear
echo -e ""
echo -e "${BOLD}${GREEN}  ╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}  ║         SISTEMA OURO VERDE  —  SOUVER v1.0.0            ║${RESET}"
echo -e "${BOLD}${GREEN}  ║       Plataforma Corporativa · Café Ouro Verde           ║${RESET}"
echo -e "${BOLD}${GREEN}  ╚══════════════════════════════════════════════════════════╝${RESET}"
echo -e ""

APP_PORT=3001
REQUIRED_NODE_MAJOR=18

# ─── 1. Verificar Node.js ─────────────────────────────────────────────────────
log_header "[ 1/5 ] Verificando ambiente Node.js"
log_sep

if ! command -v node &>/dev/null; then
  log_error "Node.js não encontrado. Instale em https://nodejs.org (mínimo v${REQUIRED_NODE_MAJOR})"
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
  log_error "Node.js v${NODE_VERSION} detectado. Versão mínima exigida: v${REQUIRED_NODE_MAJOR}"
  exit 1
fi

log_success "Node.js v${NODE_VERSION} detectado"
log_success "NPM v$(npm --version) detectado"

# ─── 2. Verificar dependências ────────────────────────────────────────────────
echo ""
log_header "[ 2/5 ] Verificando dependências"
log_sep

if [ ! -d "node_modules" ]; then
  log_warn "node_modules não encontrado. Instalando dependências..."
  npm install --silent
  log_success "Dependências instaladas com sucesso"
else
  log_success "Dependências já instaladas"
fi

# ─── 3. Verificar variáveis de ambiente ───────────────────────────────────────
echo ""
log_header "[ 3/5 ] Verificando variáveis de ambiente"
log_sep

if [ ! -f ".env.local" ]; then
  if [ -f ".env.example" ]; then
    log_warn ".env.local não encontrado. Criando a partir do .env.example..."
    cp .env.example .env.local
    log_warn "Configure o arquivo .env.local antes de usar o sistema em produção."
  else
    log_error ".env.local e .env.example não encontrados. Abortando."
    exit 1
  fi
else
  log_success ".env.local encontrado"
fi

# Verificar JWT_SECRET mínimo
if grep -q "TROQUE_POR_UMA_CHAVE_SEGURA" .env.local 2>/dev/null; then
  log_warn "JWT_SECRET ainda usa valor padrão. Troque em produção."
fi

# ─── 4. Verificar porta disponível ────────────────────────────────────────────
echo ""
log_header "[ 4/5 ] Verificando disponibilidade da porta ${APP_PORT}"
log_sep

if command -v lsof &>/dev/null; then
  if lsof -i:"$APP_PORT" &>/dev/null; then
    log_warn "Porta ${APP_PORT} já está em uso. Tentando liberar..."
    EXISTING_PID=$(lsof -ti:"$APP_PORT" 2>/dev/null || true)
    if [ -n "$EXISTING_PID" ]; then
      kill "$EXISTING_PID" 2>/dev/null || true
      sleep 1
      log_success "Processo anterior finalizado (PID: ${EXISTING_PID})"
    fi
  else
    log_success "Porta ${APP_PORT} disponível"
  fi
elif command -v netstat &>/dev/null; then
  if netstat -an 2>/dev/null | grep -q ":${APP_PORT}.*LISTEN"; then
    log_warn "Porta ${APP_PORT} pode estar em uso. Prosseguindo mesmo assim."
  else
    log_success "Porta ${APP_PORT} disponível"
  fi
else
  log_info "Verificação de porta ignorada (lsof/netstat não disponíveis)"
fi

# ─── 5. Iniciar servidor ──────────────────────────────────────────────────────
echo ""
log_header "[ 5/5 ] Iniciando servidor de desenvolvimento"
log_sep

echo ""
echo -e "  ${BOLD}Sistema Ouro Verde${RESET} — Servidor iniciando..."
echo -e "  ${GRAY}URL Local:${RESET}    ${GREEN}${BOLD}http://localhost:${APP_PORT}${RESET}"
echo -e "  ${GRAY}Ambiente:${RESET}     ${CYAN}development${RESET}"
echo -e "  ${GRAY}Hot Reload:${RESET}   ${CYAN}ativado${RESET}"
echo ""
echo -e "  ${GRAY}Pressione ${BOLD}Ctrl+C${RESET}${GRAY} para encerrar o servidor.${RESET}"
echo ""
log_sep
echo ""

# Iniciar servidor em background para poder executar pré-compilação de rotas
npm run dev &
DEV_PID=$!

# Repassar INT/TERM para o processo filho (Ctrl+C encerra o servidor corretamente)
trap "kill ${DEV_PID} 2>/dev/null; wait ${DEV_PID} 2>/dev/null; exit 0" INT TERM HUP

# ─── Pré-compilação de rotas (warmup) ─────────────────────────────────────────
# Aguarda o servidor estar pronto, gera um JWT de warmup e dispara requests para
# todas as rotas principais em paralelo. Isso faz o webpack compilar todos os
# bundles durante a inicialização, eliminando o atraso de 3-8s no primeiro acesso.
(
  set +e

  # Aguardar health check responder (máximo 90s)
  SERVER_READY=0
  for i in $(seq 1 90); do
    sleep 1
    if curl -sf "http://localhost:${APP_PORT}/api/health" > /dev/null 2>&1; then
      SERVER_READY=1
      break
    fi
  done
  [ "${SERVER_READY}" -eq 0 ] && exit 0

  # Extrair JWT_SECRET do .env.local
  JWT_VAL=$(grep "^JWT_SECRET=" .env.local 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs 2>/dev/null || true)
  [ -z "${JWT_VAL}" ] && exit 0

  # Gerar token de warmup via jsonwebtoken (CommonJS, já instalado nas dependências)
  WARMUP_TOKEN=$(JWT_SECRET="${JWT_VAL}" node -e "
    try {
      const j = require('jsonwebtoken');
      process.stdout.write(j.sign(
        { sub: 'warmup', sessionId: 'warmup' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      ));
    } catch (e) { process.exit(1); }
  " 2>/dev/null || true)
  [ -z "${WARMUP_TOKEN}" ] && exit 0

  log_info "Pré-compilando rotas do sistema em segundo plano..."

  # Páginas (page routes)
  PAGE_ROUTES=(
    "/dashboard" "/producao" "/logistica" "/qualidade" "/rh"
    "/auditoria" "/usuarios" "/departamentos" "/relatorios"
    "/configuracoes" "/contabilidade" "/comunicacao" "/integracoes" "/analytics"
  )
  # API routes — compiladas separadamente pelo webpack (cada arquivo route.ts é um bundle)
  API_ROUTES=(
    "/api/health"
    "/api/auth/me"
    "/api/dashboard/kpis?period=today&variation=true"
    "/api/dashboard/trend?days=7"
    "/api/notifications?limit=10"
    "/api/production/batches?page=1&pageSize=20"
    "/api/departments"
    "/api/inventory/items?page=1&pageSize=20&isActive=true"
    "/api/dashboard/kpis?period=today&module=inventory"
    "/api/quality/kpis"
    "/api/quality/nonconformances?page=1&pageSize=15"
    "/api/hr/kpis"
    "/api/hr/collaborators?page=1&pageSize=20"
    "/api/audit?page=1&limit=50&period=7d"
    "/api/analytics?period=30"
    "/api/users?page=1&limit=20"
    "/api/roles"
    "/api/integrations/summary"
    "/api/integrations"
    "/api/chat/conversations"
    "/api/reports"
  )

  # Disparar todas as rotas em paralelo — webpack compilará todos os bundles de uma vez
  ALL_ROUTES=("${PAGE_ROUTES[@]}" "${API_ROUTES[@]}")
  for route in "${ALL_ROUTES[@]}"; do
    curl -sf "http://localhost:${APP_PORT}${route}" \
      -H "Cookie: souver_token=${WARMUP_TOKEN}" \
      --max-time 90 -o /dev/null 2>&1 &
  done
  wait

  log_success "Pré-compilação concluída — todas as rotas carregarão instantaneamente"
) &

wait $DEV_PID || true
