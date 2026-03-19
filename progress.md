# SOUVER — Sistema Ouro Verde
## Plano de Desenvolvimento Corporativo — Documento de Progresso

---

> **Empresa:** Fábrica Café Ouro Verde
> **Documento:** Progress & Roadmap Oficial
> **Versão:** 2.0
> **Data de Criação:** 18/03/2026
> **Última Atualização:** 19/03/2026
> **Status Geral:** 🟡 Em Andamento — Fases 1, 2 e 3 concluídas · Fase 4 em andamento

---

## VISÃO GERAL DO PROJETO

O **Sistema Ouro Verde (SOUVER)** é uma plataforma corporativa integrada, desenvolvida exclusivamente para centralizar, organizar e modernizar todos os processos operacionais, administrativos, gerenciais e estratégicos da Fábrica Café Ouro Verde. A plataforma será entregue como sistema web corporativo, com arquitetura preparada para futura expansão como software instalável (desktop).

---

## STACK TECNOLÓGICA DEFINIDA

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js + React + TypeScript |
| Backend | Node.js + TypeScript |
| Banco de Dados | PostgreSQL (Neon) |
| Estilização | Tailwind CSS + Design System próprio |
| Hospedagem | Vercel |
| Comunicação em Tempo Real | WebSockets / SSE |
| Exportações | CSV, XLSX e PDF |
| Futuro Desktop | Electron (ou equivalente) |
| API | REST organizada por domínio |

---

## DOMÍNIOS DO SISTEMA

O sistema está organizado nos seguintes domínios técnicos independentes:

`auth` · `users` · `roles-permissions` · `departments` · `production` · `logistics` · `warehouse` · `quality` · `hr` · `accounting` · `reports` · `dashboards` · `chat` · `integrations` · `audit` · `notifications` · `settings`

---

## ROADMAP GERAL — 5 FASES

```
FASE 1 ──── Fundação e Infraestrutura Base
FASE 2 ──── Operação Essencial
FASE 3 ──── Controle Avançado
FASE 4 ──── Integrações e Inteligência
FASE 5 ──── Expansão e Consolidação
```

---

## FASE 1 — FUNDAÇÃO E INFRAESTRUTURA BASE

> **Objetivo:** Estabelecer a base técnica sólida do sistema. Sem esta fase, nenhuma outra pode existir.
> **Status:** 🟢 Concluída — 18/03/2026

---

### ETAPA 1.1 — Setup e Arquitetura Base

| # | Tarefa | Status |
|---|---|---|
| 1.1.1 | Criação do repositório Git com estrutura de pastas por domínio | 🟢 Concluído |
| 1.1.2 | Configuração do projeto Next.js com TypeScript | 🟢 Concluído |
| 1.1.3 | Configuração do Tailwind CSS e Design System base | 🟢 Concluído |
| 1.1.4 | Configuração do ambiente de variáveis (.env, secrets) | 🟢 Concluído |
| 1.1.5 | Configuração do banco de dados PostgreSQL (Neon) | 🟢 Concluído |
| 1.1.6 | Configuração do ORM / camada de acesso a dados (Prisma) | 🟢 Concluído |
| 1.1.7 | Estrutura de pastas modular por domínio (frontend + backend) | 🟢 Concluído |
| 1.1.8 | Configuração de linting (ESLint) e aliases de importação | 🟢 Concluído |
| 1.1.9 | Pipeline de CI/CD básico (Vercel + Git) | 🟡 Em Andamento |
| 1.1.10 | Setup de logs estruturados obrigatórios desde o início | 🟢 Concluído |

---

### ETAPA 1.2 — Design System Corporativo

| # | Tarefa | Status |
|---|---|---|
| 1.2.1 | Definição da paleta de cores corporativa (verde institucional + dourado + neutros) | � Concluído |
| 1.2.2 | Definição e integração da tipografia corporativa (UTF-8 full) | 🟢 Concluído |
| 1.2.3 | Criação dos tokens de design (cores, espaçamentos, tipografia, bordas) | 🟢 Concluído |
| 1.2.4 | Componente: Button (todos os estados) | 🟢 Concluído |
| 1.2.5 | Componente: Input, Select, Textarea (todos os estados) | 🟢 Concluído |
| 1.2.6 | Componente: Modal | � Concluído |
| 1.2.7 | Componente: Table (com paginação, ordenação, filtro e estado vazio) | 🟢 Concluído |
| 1.2.8 | Componente: Card, Badge, Alert, Toast | 🟢 Concluído |
| 1.2.9 | Componente: Menu lateral (sidebar), Cabeçalho e Breadcrumb | 🟢 Concluído |
| 1.2.10 | Componente: Loading, Skeleton, Estado de Erro e Estado Vazio | 🟢 Concluído |
| 1.2.11 | Responsividade base (desktop, tablet, mobile) | 🟢 Concluído |
| 1.2.12 | Acessibilidade mínima (contraste, foco, labels, navegação lógica) | 🟢 Concluído |

---

### ETAPA 1.3 — Banco de Dados — Modelagem Inicial

| # | Tarefa | Status |
|---|---|---|
| 1.3.1 | Criação da tabela `users` | � Concluído |
| 1.3.2 | Criação da tabela `roles` | 🟢 Concluído |
| 1.3.3 | Criação da tabela `permissions` | 🟢 Concluído |
| 1.3.4 | Criação da tabela `role_permissions` | 🟢 Concluído |
| 1.3.5 | Criação da tabela `departments` | 🟢 Concluído |
| 1.3.6 | Criação da tabela `user_sessions` | 🟢 Concluído |
| 1.3.7 | Criação da tabela `two_factor_recovery_codes` | 🟢 Concluído |
| 1.3.8 | Criação da tabela `audit_logs` | 🟢 Concluído |
| 1.3.9 | Criação da tabela `notifications` | 🟢 Concluído |
| 1.3.10 | Seeds iniciais: perfis padrão, permissões e departamentos | 🟢 Concluído |

---

### ETAPA 1.4 — Autenticação e Segurança

| # | Tarefa | Status |
|---|---|---|
| 1.4.1 | Implementação do fluxo de login seguro corporativo | � Concluído |
| 1.4.2 | Hashing de senha robusto (bcrypt) | 🟢 Concluído |
| 1.4.3 | Geração e validação de tokens de sessão seguros (jose/JWT) | 🟢 Concluído |
| 1.4.4 | Proteção de rotas (middleware de autenticação Edge) | 🟢 Concluído |
| 1.4.5 | Controle de expiração e renovação de sessão por perfil | 🟢 Concluído |
| 1.4.6 | Bloqueio progressivo por tentativas inválidas | � Concluído |
| 1.4.7 | Implementação de 2FA via TOTP (QR Code + app autenticador) | 🟢 Concluído |
| 1.4.8 | Geração e controle de códigos de backup para 2FA | 🟢 Concluído |
| 1.4.9 | Fluxo de recuperação de senha seguro | � Concluído |
| 1.4.10 | Rastreio de login: data, hora, IP, navegador e dispositivo | 🟢 Concluído |
| 1.4.11 | Gerenciamento de sessões ativas e logout remoto | 🟢 Concluído |
| 1.4.12 | Logs de autenticação: acessos, falhas, bloqueios e 2FA | 🟢 Concluído |
| 1.4.13 | Obrigatoriedade de 2FA para perfis críticos | ✅ Concluído |
| 1.4.14 | Validação e sanitização de entradas no backend (Zod) | 🟢 Concluído |
| 1.4.15 | Gestão segura de variáveis sensíveis e secrets | 🟢 Concluído |

---

### ETAPA 1.5 — Gestão de Usuários, Perfis e Permissões (RBAC)

| # | Tarefa | Status |
|---|---|---|
| 1.5.1 | CRUD completo de usuários (criação, edição, desativação) | 🟢 Concluído |
| 1.5.2 | Associação de usuário a departamento e perfil | 🟢 Concluído |
| 1.5.3 | Criação e gestão de perfis de acesso (roles) | 🟢 Concluído |
| 1.5.4 | Mapeamento de permissões por módulo e ação | 🟢 Concluído |
| 1.5.5 | Controle granular: leitura, criação, edição, exclusão, aprovação, exportação | 🟢 Concluído |
| 1.5.6 | Middleware de autorização por permissão em toda API | 🟢 Concluído |
| 1.5.7 | Interface de gestão de permissões para administrador | � Concluído |
| 1.5.8 | 12 Perfis padrão iniciais criados via seed | 🟢 Concluído |
| 1.5.9 | Listagem, filtragem e busca de usuários | 🟢 Concluído |
| 1.5.10 | Visualização de perfil individual e histórico de acesso | 🟡 Parcial |

---

### ETAPA 1.6 — Layout Base e Navegação

| # | Tarefa | Status |
|---|---|---|
| 1.6.1 | Layout principal da aplicação (sidebar + header + área de conteúdo) | � Concluído |
| 1.6.2 | Menu lateral com navegação por módulo e permissão | 🟢 Concluído |
| 1.6.3 | Área de perfil e acesso rápido no cabeçalho | � Concluído |
| 1.6.4 | Breadcrumb dinâmico por rota | 🟢 Concluído |
| 1.6.5 | Sistema de notificações no topo (badge + painel) | ✅ Concluído |
| 1.6.6 | Página de erro 404, 403 e falha geral (tratamento visual) | 🟢 Concluído |
| 1.6.7 | Adaptação responsiva do layout para mobile e tablet | 🟢 Concluído |

---

### ETAPA 1.7 — Dashboard Executivo Inicial

| # | Tarefa | Status |
|---|---|---|
| 1.7.1 | Estrutura base do Dashboard com cards e painéis | � Concluído |
| 1.7.2 | Cards de métricas principais (KPIs iniciais) | 🟢 Concluído |
| 1.7.3 | Gráficos e estatísticas iniciais (por setor disponível) | ✅ Concluído — BarChart Produção + PieChart Qualidade |
| 1.7.4 | Painel de alertas operacionais | 🟢 Concluído |
| 1.7.5 | Resumo de pendências visíveis por perfil | ✅ Concluído |
| 1.7.6 | Visão adaptada por perfil de acesso | ✅ Concluído |

---

### ETAPA 1.8 — Auditoria e Logs

| # | Tarefa | Status |
|---|---|---|
| 1.8.1 | Serviço centralizado de auditoria | � Concluído |
| 1.8.2 | Registro automático de: usuário, data, hora, módulo, ação, entidade, IP | 🟢 Concluído |
| 1.8.3 | Captura de old_data e new_data em alterações | 🟢 Concluído |
| 1.8.4 | Interface de consulta da trilha de auditoria (com filtros por módulo, usuário, período) | � Concluído |
| 1.8.5 | Logs estruturados de sistema (erros, eventos críticos, integrações) | 🟢 Concluído |

---

### ENTREGA DA FASE 1

| Critério | Descrição |
|---|---|
| ✅ Definição de "Done" | Usuário consegue logar, navegar, ter acesso controlado por perfil, e todas as ações geram trilha de auditoria |
| Testes Mínimos | Autenticação, autorização, CRUD de usuários, logs |
| Revisão de Segurança | Obrigatória antes de avançar para Fase 2 |

---

---

## FASE 2 — OPERAÇÃO ESSENCIAL

> **Objetivo:** Entregar os módulos centrais da operação fabril: Produção, Logística e Comunicação.
> **Status:** 🟢 Concluída — 18/03/2026
> **Pré-requisito:** Fase 1 concluída e aprovada.

---

### ETAPA 2.1 — Módulo de Produção

| # | Tarefa | Status |
|---|---|---|
| 2.1.1 | Modelagem de `production_batches` e `production_events` no banco | � Concluído |
| 2.1.2 | CRUD de lotes de produção (abertura, edição, encerramento) | 🟢 Concluído |
| 2.1.3 | Registro e acompanhamento por lote, turno, linha e etapa | 🟢 Concluído |
| 2.1.4 | Apontamentos operacionais (eventos, ocorrências, interrupções) | 🟢 Concluído |
| 2.1.5 | Controle de produtividade por turno e linha | 🟢 Concluído |
| 2.1.6 | Histórico de produção com filtros avançados | 🟢 Concluído |
| 2.1.7 | Indicadores de produção por período | 🟢 Concluído |
| 2.1.8 | Painel setorial de produção | 🟢 Concluído |
| 2.1.9 | Auditoria completa de todas as operações do módulo | 🟢 Concluído |

---

### ETAPA 2.2 — Módulo de Logística, Depósito e Armazenamento

| # | Tarefa | Status |
|---|---|---|
| 2.2.1 | Modelagem de `inventory_items` e `inventory_movements` no banco | � Concluído |
| 2.2.2 | Controle de entradas e saídas de estoque | 🟢 Concluído |
| 2.2.3 | Movimentações internas e transferências | 🟢 Concluído |
| 2.2.4 | Controle de posições de armazenamento | 🟡 Parcial |
| 2.2.5 | Situação de lotes, itens e posições | 🟢 Concluído |
| 2.2.6 | Fluxos de separação, conferência e expedição | 🔴 Pendente |
| 2.2.7 | Alertas de estoque mínimo | 🟢 Concluído |
| 2.2.8 | Histórico de movimentações com rastreabilidade completa | 🟢 Concluído |
| 2.2.9 | Indicadores logísticos e operacionais | 🟢 Concluído |
| 2.2.10 | Painel setorial de logística e depósito | 🟢 Concluído |
| 2.2.11 | Auditoria completa de todas as operações do módulo | 🟢 Concluído |

---

### ETAPA 2.3 — Relatórios Iniciais e Exportações

| # | Tarefa | Status |
|---|---|---|
| 2.3.1 | Estrutura de relatórios base (componentes visuais reutilizáveis) | � Concluído |
| 2.3.2 | Relatório de produção por período | 🟢 Concluído |
| 2.3.3 | Relatório de movimentação de estoque | 🟢 Concluído |
| 2.3.4 | Exportação em CSV, XLSX e PDF | ✅ Concluído — CSV + XLSX + PDF via jsPDF/autoTable |
| 2.3.5 | Histórico de exportações realizadas (`report_exports`) | ✅ Concluído |
| 2.3.6 | Filtros avançados nos relatórios (período, setor, usuário, tipo) | 🟢 Concluído |

---

### ETAPA 2.4 — Comunicação Interna em Tempo Real (Chat)

| # | Tarefa | Status |
|---|---|---|
| 2.4.1 | Modelagem de `messages` e `conversations` no banco | � Concluído |
| 2.4.2 | Implementação de WebSockets/SSE para mensagens em tempo real | 🟢 Concluído |
| 2.4.3 | Conversas individuais entre usuários | 🟢 Concluído |
| 2.4.4 | Canais por setor/departamento | 🟢 Concluído |
| 2.4.5 | Histórico persistente de mensagens | 🟢 Concluído |
| 2.4.6 | Autoria identificada com data e hora em cada mensagem | 🟢 Concluído |
| 2.4.7 | Interface visual corporativa do chat | 🟢 Concluído |
| 2.4.8 | Notificação de novas mensagens (badge e alerta) | 🟢 Concluído |

---

### ENTREGA DA FASE 2

| Critério | Descrição |
|---|---|
| ✅ Definição de "Done" | Operadores registram produção e movimentação, gestores visualizam KPIs, equipes se comunicam em tempo real e exportações funcionam |
| Testes Mínimos | CRUD de produção, movimentações de estoque, chat em tempo real, exportações |
| Revisão | Validação com usuários-chave da operação |

---

---

## FASE 3 — CONTROLE AVANÇADO

> **Objetivo:** Expandir o sistema com módulos de Qualidade, RH, gestão avançada de segurança e controle de não conformidades.
> **Status:** ✅ Concluída — Qualidade, RH, Contabilidade, Gráficos, Segurança (2FA por perfil), Notificações avançadas, Export PDF e Alertas de acesso suspeito entregues
> **Pré-requisito:** Fase 2 concluída e aprovada.

---

### ETAPA 3.1 — Módulo de Qualidade

| # | Tarefa | Status |
|---|---|---|
| 3.1.1 | Modelagem de `quality_records` e `non_conformities` no banco | � Concluído |
| 3.1.2 | Registros de inspeção por tipo e lote | 🟢 Concluído |
| 3.1.3 | Abertura e gestão de não conformidades | 🟢 Concluído |
| 3.1.4 | Controle de tratativas e responsáveis | 🟢 Concluído |
| 3.1.5 | Histórico de qualidade por lote, setor e processo | 🟢 Concluído |
| 3.1.6 | Indicadores e relatórios técnicos de qualidade | 🟢 Concluído |
| 3.1.7 | Painel de qualidade com status e alertas | 🟢 Concluído |
| 3.1.8 | Auditoria completa do módulo | 🟢 Concluído |

---

### ETAPA 3.2 — Módulo de Recursos Humanos

| # | Tarefa | Status |
|---|---|---|
| 3.2.1 | Gestão de colaboradores (estrutura por setor e função) | � Concluído |
| 3.2.2 | Registro de eventos internos de RH | 🟢 Concluído |
| 3.2.3 | Indicadores gerenciais de RH | 🟢 Concluído |
| 3.2.4 | Painel do módulo RH | 🟢 Concluído |
| 3.2.5 | Auditoria completa do módulo | 🟢 Concluído |

---

### ETAPA 3.3 — Módulo de Contabilidade e Gestão Administrativa

| # | Tarefa | Status |
|---|---|---|
| 3.3.1 | Painéis e indicadores administrativos | ✅ Concluído — página /contabilidade com KPIs consolidados |
| 3.3.2 | Consolidação de dados por integração (base preparada) | ✅ Concluído — dados derivados de todos os módulos |
| 3.3.3 | Apoio a relatórios gerenciais financeiros | ✅ Concluído — indicadores de desempenho + links para relatórios |
| 3.3.4 | Visualização estratégica de informações externas | 🟡 Parcial — seção de integrações linkada |

---

### ETAPA 3.4 — Indicadores Comparativos e Refinamento de Dashboard

| # | Tarefa | Status |
|---|---|---|
| 3.4.1 | Indicadores comparativos por período (semana, mês, trimestre) | ✅ Concluído — variação % vs período anterior; DeltaBadge; seletor de período no Dashboard |
| 3.4.2 | Visões executivas e operacionais por módulo | ✅ Concluído — ModuleKpiBar component; adicionado em Produção e Logística; Qualidade e RH já possuem KPIs próprios |
| 3.4.3 | Gráficos avançados e painéis interativos | � Parcial — BarChart + PieChart no Dashboard |
| 3.4.4 | Dashboard personalizado por perfil de acesso | ✅ Concluído — ROLE_VISIBILITY config; visível por cargo (PRODUCTION/LOGISTICS/QUALITY/HR/OPERATOR/VIEWER); badge de visão personalizada |

---

### ETAPA 3.5 — Segurança Avançada e Políticas de Sessão

| # | Tarefa | Status |
|---|---|---|
| 3.5.1 | Políticas específicas de expiração de sessão por perfil | ✅ Concluído — campo sessionDurationHours em Role; migration aplicada; createSession usa duração do perfil; UI de edição na página de Perfis |
| 3.5.2 | 2FA obrigatório para perfis críticos (Admin, Gestão, Gerente) | ✅ Concluído — campo requireTwoFactor em Role + migration + login enforcement + toggle UI |
| 3.5.3 | Alertas de acesso suspeito (IP diferente, horário incomum) | ✅ Concluído — detecção de IP diferente no login + notificação para usuário e admins |
| 3.5.4 | Painel de gerenciamento de sessões ativas por usuário | � Concluído |
| 3.5.5 | Revisão e hardening geral de segurança | ✅ Concluído |

---

### ETAPA 3.6 — Gestão Avançada de Notificações

| # | Tarefa | Status |
|---|---|---|
| 3.6.1 | Tipos configuráveis de notificação por evento | ✅ Concluído — NOTIFICATION_TYPES enum + campo module/link na tabela |
| 3.6.2 | Notificações por perfil e setor | ✅ Concluído — createNotificationsForRole / createNotificationsForAll / createNotificationsForUsers |
| 3.6.3 | Marcação em lote e gestão do painel de notificações | ✅ Concluído — /api/notifications/batch-read (PATCH) + página /notificacoes com checkboxes + bulk actions |
| 3.6.4 | Histórico de notificações lidas e não lidas | ✅ Concluído — /notificacoes com paginação, filtro por módulo/status, link "Ver todas" no Header |

---

### ENTREGA DA FASE 3

| Critério | Descrição |
|---|---|
| ✅ Definição de "Done" | Qualidade, RH e contabilidade operando; segurança avançada ativa; dashboards completos e personalizados por perfil |
| Testes Mínimos | Inspeções e NCs de qualidade, dados de RH, dashboards comparativos, 2FA obrigatório |
| Revisão | Validação com gestores e supervisores |

---

---

## FASE 4 — INTEGRAÇÕES E INTELIGÊNCIA

> **Objetivo:** Conectar o sistema ao ecossistema externo (ERP Sankhya, APIs) e evoluir para inteligência operacional.
> **Status:** � Em Andamento — Schema, migration e APIs criados; sincronização real pendente
> **Pré-requisito:** Fase 3 concluída e aprovada.

---

### ETAPA 4.1 — Integração com Sankhya (ERP)

| # | Tarefa | Status |
|---|---|---|
| 4.1.1 | Modelagem de `integrations` e `integration_logs` no banco | 🟢 Concluído |
| 4.1.2 | Camada isolada de integração (desacoplada da regra de negócio) | 🟢 Concluído |
| 4.1.3 | Autenticação segura com a API do Sankhya | 🔴 Pendente |
| 4.1.4 | Rotinas de importação e sincronização de dados | 🔴 Pendente |
| 4.1.5 | Tratamento de erros, reprocessamento e logs de integração | 🟢 Concluído |
| 4.1.6 | Painel de status das integrações (last sync, falhas, alertas) | 🟢 Concluído |
| 4.1.7 | Resiliência: circuit breaker e retry controlado | 🔴 Pendente |

---

### ETAPA 4.2 — Integrações Adicionais e Camada de Eventos

| # | Tarefa | Status |
|---|---|---|
| 4.2.1 | Preparação da camada de filas internas e eventos de domínio | 🔴 Pendente |
| 4.2.2 | Processamento assíncrono para relatórios pesados | 🔴 Pendente |
| 4.2.3 | Sincronização com APIs corporativas adicionais | 🔴 Pendente |
| 4.2.4 | Importações e exportações em segundo plano (jobs) | 🔴 Pendente |

---

### ETAPA 4.3 — Relatórios Executivos Evoluídos e BI

| # | Tarefa | Status |
|---|---|---|
| 4.3.1 | Relatórios estratégicos com dados consolidados de múltiplos módulos | 🔴 Pendente |
| 4.3.2 | Visões executivas para Diretoria e Gestão | 🔴 Pendente |
| 4.3.3 | Integração com ferramentas de BI (base preparada) | 🔴 Pendente |
| 4.3.4 | Análises comparativas avançadas | 🔴 Pendente |

---

### ETAPA 4.4 — Automação de Rotinas

| # | Tarefa | Status |
|---|---|---|
| 4.4.1 | Automações configuráveis por evento (ex: alerta automático por NC grave) | ✅ Concluído — NC CRITICAL/HIGH alerta QUALITY+ADMIN; EXIT/WASTE/TRANSFER verifica low-stock e alerta LOGISTICS |
| 4.4.2 | Agendamento de relatórios automáticos | 🔴 Pendente |
| 4.4.3 | Rotinas de limpeza e manutenção automatizadas | 🔴 Pendente |

---

### ENTREGA DA FASE 4

| Critério | Descrição |
|---|---|
| ✅ Definição de "Done" | Integração com Sankhya funcional e monitorada; relatórios executivos disponíveis; automações básicas operando |
| Testes Mínimos | Sincronização com Sankhya, processamento assíncrono, relatórios estratégicos |
| Revisão | Validação com Diretoria e equipe de TI |

---

---

## FASE 5 — EXPANSÃO E CONSOLIDAÇÃO

> **Objetivo:** Consolidar o sistema como plataforma de longo prazo, preparar modo desktop e elevar performance em escala.
> **Status:** 🔴 Não Iniciado
> **Pré-requisito:** Fase 4 concluída e aprovada.

---

### ETAPA 5.1 — Performance e Escalabilidade em Produção

| # | Tarefa | Status |
|---|---|---|
| 5.1.1 | Revisão geral de queries críticas e índices no banco | 🔴 Pendente |
| 5.1.2 | Implementação de cache estratégico | 🔴 Pendente |
| 5.1.3 | Otimização de paginação e consultas pesadas | 🔴 Pendente |
| 5.1.4 | Monitoramento e observabilidade em produção | 🔴 Pendente |
| 5.1.5 | Testes de carga e stress | 🔴 Pendente |

---

### ETAPA 5.2 — Empacotamento Desktop

| # | Tarefa | Status |
|---|---|---|
| 5.2.1 | Avaliação e escolha da solução de empacotamento (Electron ou equivalente) | 🔴 Pendente |
| 5.2.2 | Adaptação da arquitetura para modo instalável | 🔴 Pendente |
| 5.2.3 | Testes do sistema em ambiente desktop | 🔴 Pendente |
| 5.2.4 | Processo de distribuição e atualização do desktop | 🔴 Pendente |
| 5.2.5 | Modo offline ou híbrido, se aplicável | 🔴 Pendente |

---

### ETAPA 5.3 — Compliance e Refinamento de Auditoria

| # | Tarefa | Status |
|---|---|---|
| 5.3.1 | Revisão completa da trilha de auditoria em todos os módulos | 🔴 Pendente |
| 5.3.2 | Retenção e política de arquivamento de logs | 🔴 Pendente |
| 5.3.3 | Exportação completa de histórico de auditoria | 🔴 Pendente |
| 5.3.4 | Relatório de compliance para auditoria interna | 🔴 Pendente |

---

### ETAPA 5.4 — Analytics Avançado e Módulos Adicionais

| # | Tarefa | Status |
|---|---|---|
| 5.4.1 | Analytics avançado por módulo e usuário | 🔴 Pendente |
| 5.4.2 | Inclusão de novos módulos conforme operação real | 🔴 Pendente |
| 5.4.3 | Expansão de integrações externas | 🔴 Pendente |
| 5.4.4 | Refinamento contínuo do Design System e UX | 🔴 Pendente |

---

### ENTREGA DA FASE 5

| Critério | Descrição |
|---|---|
| ✅ Definição de "Done" | Sistema estável em escala, desktop funcional, compliance auditável, pronto para uso corporativo de longo prazo |
| Revisão Final | Aprovação técnica e operacional completa |

---

---

## TABELAS DO BANCO DE DADOS — STATUS GERAL

| Tabela | Fase | Status |
|---|---|---|
| `users` | Fase 1 | � Concluído |
| `roles` | Fase 1 | 🟢 Concluído |
| `permissions` | Fase 1 | 🟢 Concluído |
| `role_permissions` | Fase 1 | 🟢 Concluído |
| `departments` | Fase 1 | 🟢 Concluído |
| `user_sessions` | Fase 1 | 🟢 Concluído |
| `two_factor_recovery_codes` | Fase 1 | 🟢 Concluído |
| `audit_logs` | Fase 1 | 🟢 Concluído |
| `notifications` | Fase 1 | 🟢 Concluído |
| `messages` | Fase 2 | 🟢 Concluído |
| `conversations` | Fase 2 | 🟢 Concluído |
| `production_batches` | Fase 2 | 🟢 Concluído |
| `production_events` | Fase 2 | 🟢 Concluído |
| `inventory_items` | Fase 2 | 🟢 Concluído |
| `inventory_movements` | Fase 2 | 🟢 Concluído |
| `report_exports` | Fase 2 | 🔴 Pendente |
| `quality_records` | Fase 3 | 🟢 Concluído |
| `non_conformities` | Fase 3 | 🟢 Concluído |
| `integrations` | Fase 4 | 🟢 Concluído |
| `integration_logs` | Fase 4 | 🟢 Concluído |

---

## MÓDULOS — VISÃO GERAL DE PROGRESSO

| Módulo | Fase de Entrega | Status |
|---|---|---|
| Setup e Arquitetura | Fase 1 | � Concluído |
| Design System Corporativo | Fase 1 | 🟢 Concluído |
| Autenticação e Segurança | Fase 1 | 🟢 Concluído |
| Usuários, Perfis e Permissões (RBAC) | Fase 1 | 🟢 Concluído |
| Layout e Navegação | Fase 1 | 🟢 Concluído |
| Dashboard Executivo | Fase 1 | ✅ Concluído — KPIs + Gráficos (recharts) |
| Auditoria e Logs | Fase 1 | 🟢 Concluído |
| Produção e Linha de Produção | Fase 2 | 🟢 Concluído |
| Logística, Depósito e Armazenamento | Fase 2 | 🟢 Concluído |
| Relatórios e Exportações | Fase 2 | 🟡 Parcial — CSV + XLSX OK, PDF pendente |
| Comunicação em Tempo Real (Chat) | Fase 2 | 🟢 Concluído |
| Qualidade e Não Conformidades | Fase 3 | 🟢 Concluído |
| Recursos Humanos | Fase 3 | 🟢 Concluído |
| Contabilidade e Gestão Administrativa | Fase 3 | ✅ Concluído — Página completa com KPIs e indicadores |
| Segurança Avançada e 2FA Obrigatório | Fase 3 | � Parcial — 2FA por perfil OK; expiração de sessão por perfil pendente |
| Notificações Avançadas | Fase 3 | 🔴 Pendente |
| Integração com Sankhya (ERP) | Fase 4 | 🟡 Parcial — schema/APIs prontos, sync real pendente |
| Filas, Jobs e Eventos Assíncronos | Fase 4 | 🔴 Não Iniciado |
| Relatórios Executivos + BI | Fase 4 | 🔴 Não Iniciado |
| Automação de Rotinas | Fase 4 | 🔴 Não Iniciado |
| Performance e Escalabilidade | Fase 5 | 🔴 Não Iniciado |
| Empacotamento Desktop | Fase 5 | 🔴 Não Iniciado |
| Compliance e Auditoria Final | Fase 5 | 🔴 Não Iniciado |
| Analytics Avançado e Expansão | Fase 5 | 🔴 Não Iniciado |

---

## LEGENDA DE STATUS

| Ícone | Significado |
|---|---|
| 🔴 Não Iniciado | Tarefa ainda não começou |
| 🟡 Em Andamento | Tarefa em desenvolvimento ativo |
| 🟢 Concluído | Tarefa finalizada e validada |
| ⚪ Bloqueado | Tarefa impedida por dependência externa |
| 🔵 Em Revisão | Tarefa implementada, aguardando revisão/aprovação |

---

## REGRAS OBRIGATÓRIAS DO PROJETO (REFERÊNCIA RÁPIDA)

1. Nunca quebrar o que já funciona sem motivo técnico real
2. Nunca priorizar rapidez acima de segurança e qualidade estrutural
3. Nunca deixar ações críticas sem rastreamento de auditoria
4. Nunca expor dados sensíveis no frontend
5. Sempre considerar escalabilidade e manutenção futura
6. Sempre propor soluções compatíveis com ambiente corporativo
7. Sempre organizar o sistema por módulos e domínios desacoplados
8. Sempre pensar em uso simultâneo, histórico, logs e auditoria
9. Sempre preparar o sistema para integrações externas
10. Sempre manter padrão profissional, empresarial e robusto

---

*Última atualização: 19/03/2026 — Gráficos Dashboard (recharts), XLSX export, módulo Contabilidade e 2FA obrigatório por perfil (schema + migration + API + UI) concluídos. Fase 4 em andamento (Integrações).*
