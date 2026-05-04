export type ModuleStatus = 'Planejamento' | 'Em desenvolvimento' | 'Validação'

export interface ModuleRoadmapItem {
  title: string
  description: string
  status: ModuleStatus
}

export interface ModulePlan {
  key: string
  label: string
  section: 'Módulos' | 'Sistema'
  headline: string
  description: string
  capabilities: string[]
  tools: string[]
  roadmap: ModuleRoadmapItem[]
}

export const MODULE_MENU_SECTIONS: Array<{
  label: 'Módulos' | 'Sistema'
  itemKeys: string[]
}> = [
  {
    label: 'Módulos',
    itemKeys: [
      'painel-executivo',
      'metas',
      'producao',
      'logistica',
      'qualidade',
      'rh',
      'contabilidade',
      'comunicacao',
    ],
  },
  {
    label: 'Sistema',
    itemKeys: ['configuracoes', 'integracoes'],
  },
]

export const MODULE_PLANS: Record<string, ModulePlan> = {
  'painel-executivo': {
    key: 'painel-executivo',
    label: 'Painel Executivo',
    section: 'Módulos',
    headline: 'Visão executiva consolidada da operação industrial.',
    description:
      'Construção de cockpit gerencial com indicadores unificados para diretoria, produção e gestão de resultados.',
    capabilities: [
      'KPIs estratégicos por unidade, turno e período.',
      'Comparativos de desempenho com metas e alertas.',
      'Monitoramento de riscos operacionais em tempo real.',
      'Resumo inteligente para decisões de curto prazo.',
    ],
    tools: ['Painel de indicadores', 'Alertas executivos', 'Análises comparativas', 'Exportação de visão gerencial'],
    roadmap: [
      {
        title: 'Arquitetura de indicadores',
        description: 'Definição de métricas críticas e fontes de dados corporativas.',
        status: 'Validação',
      },
      {
        title: 'Painel interativo',
        description: 'Desenvolvimento de visualizações e filtros estratégicos por perfil.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Inteligência operacional',
        description: 'Implementação de recomendações e insights automatizados.',
        status: 'Planejamento',
      },
    ],
  },
  metas: {
    key: 'metas',
    label: 'Metas',
    section: 'Módulos',
    headline: 'Visão estratégica de metas e performance.',
    description:
      'Evolução de um sistema empresarial para metas da fábrica, equipe comercial e vendas, com regras claras, critérios de medição e acompanhamento por ciclo.',
    capabilities: [
      'Metas corporativas, setoriais e individuais por período.',
      'Acompanhamento de desempenho geral e por colaborador.',
      'Regras de apuração com pesos, faixas e critérios de elegibilidade.',
      'Painel de evolução com indicadores, desvios e ações corretivas.',
    ],
    tools: [
      'Cadastro de metas por área',
      'Medição individual e consolidada',
      'Motor de regras e pontuação',
      'Painel de acompanhamento de resultados',
    ],
    roadmap: [
      {
        title: 'Modelo de metas corporativas',
        description: 'Estruturação dos tipos de metas, periodicidade e governança de critérios.',
        status: 'Validação',
      },
      {
        title: 'Motor de apuração e desempenho',
        description: 'Implementação da lógica de cálculo para desempenho individual e geral.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Painel executivo de metas',
        description: 'Consolidação de progresso, desvios e visão por área, vendedor e unidade.',
        status: 'Planejamento',
      },
    ],
  },
  producao: {
    key: 'producao',
    label: 'Produção',
    section: 'Módulos',
    headline: 'Gestão de lotes, apontamentos e eficiência fabril.',
    description:
      'Evolução do módulo para rastreabilidade total da produção com foco em produtividade, qualidade e redução de perdas.',
    capabilities: [
      'Controle completo do ciclo de vida dos lotes.',
      'Apontamentos por operador, linha e evento operacional.',
      'Painel de eficiência com OEE e gargalos de produção.',
      'Rastreabilidade ponta a ponta por código de lote.',
    ],
    tools: ['Ordem de produção', 'Rastreio de lotes', 'Apontamento operacional', 'Mapa de eficiência'],
    roadmap: [
      {
        title: 'Modelagem operacional',
        description: 'Padronização de eventos de chão de fábrica e status produtivos.',
        status: 'Validação',
      },
      {
        title: 'Fluxo de produção digital',
        description: 'Automação dos registros de início, pausa, retomada e encerramento.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Eficiência avançada',
        description: 'Camada analítica com indicadores de performance por turno.',
        status: 'Planejamento',
      },
    ],
  },
  logistica: {
    key: 'logistica',
    label: 'Logística',
    section: 'Módulos',
    headline: 'Controle de estoque, movimentações e expedição.',
    description:
      'Implantação de fluxo logístico integrado para entrada, saída, inventário e rastreabilidade de materiais.',
    capabilities: [
      'Gestão de itens com níveis mínimo, máximo e ponto de reposição.',
      'Registro de movimentações com trilha de auditoria.',
      'Processo de conferência e expedição assistida.',
      'Visibilidade de estoque por local e categoria.',
    ],
    tools: ['Cadastro de itens', 'Movimentações', 'Expedição', 'Inventário assistido'],
    roadmap: [
      {
        title: 'Base de materiais',
        description: 'Unificação do catálogo de itens e regras de estoque.',
        status: 'Validação',
      },
      {
        title: 'Movimentação controlada',
        description: 'Fluxo operacional de entradas e saídas com governança.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Otimização logística',
        description: 'Planejamento de rotinas de reposição e previsão de ruptura.',
        status: 'Planejamento',
      },
    ],
  },
  qualidade: {
    key: 'qualidade',
    label: 'Qualidade',
    section: 'Módulos',
    headline: 'Inspeções, não conformidades e tratamento de desvios.',
    description:
      'Fortalecimento da governança de qualidade com registros estruturados, priorização de riscos e ações corretivas.',
    capabilities: [
      'Registro de inspeções com critérios e evidências.',
      'Gestão de não conformidades por severidade e status.',
      'Acompanhamento de plano de ação e resolução.',
      'Indicadores de qualidade por lote e período.',
    ],
    tools: ['Inspeções', 'NCs', 'Tratativas', 'Matriz de severidade'],
    roadmap: [
      {
        title: 'Padronização técnica',
        description: 'Definição de protocolos e classificações de inspeção.',
        status: 'Validação',
      },
      {
        title: 'Fluxo de NCs',
        description: 'Implementação do ciclo completo de abertura até encerramento.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Inteligência preventiva',
        description: 'Previsão de reincidência e alertas de risco.',
        status: 'Planejamento',
      },
    ],
  },
  rh: {
    key: 'rh',
    label: 'RH',
    section: 'Módulos',
    headline: 'Dados de colaboradores, performance e conformidade.',
    description:
      'Construção de um ambiente de RH orientado a dados para apoiar liderança, compliance e desenvolvimento de equipes.',
    capabilities: [
      'Gestão cadastral e organizacional de colaboradores.',
      'Indicadores de engajamento, absenteísmo e produtividade.',
      'Acompanhamento de permissões e trilhas de responsabilidade.',
      'Relatórios gerenciais para decisões de pessoas.',
    ],
    tools: ['Cadastros de RH', 'Indicadores de pessoas', 'Painel de liderança', 'Relatórios de equipe'],
    roadmap: [
      {
        title: 'Estrutura organizacional',
        description: 'Consolidação da hierarquia e vínculos por departamento.',
        status: 'Validação',
      },
      {
        title: 'Painel de pessoas',
        description: 'Desenvolvimento dos indicadores-chave de RH.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Gestão preditiva',
        description: 'Planejamento de análises preditivas para retenção e capacidade.',
        status: 'Planejamento',
      },
    ],
  },
  relatorios: {
    key: 'relatorios',
    label: 'Relatórios',
    section: 'Módulos',
    headline: 'Relatórios operacionais, executivos e compliance.',
    description:
      'Conjunto de relatórios profissionais para suportar auditoria, gestão e tomada de decisão baseada em dados.',
    capabilities: [
      'Relatórios operacionais por módulo e período.',
      'Modelos executivos para diretoria e governança.',
      'Exportações em PDF, planilha e formatos compartilháveis.',
      'Trilhas de geração e histórico de execução.',
    ],
    tools: ['Relatórios operacionais', 'Relatórios executivos', 'Exportação', 'Histórico de geração'],
    roadmap: [
      {
        title: 'Matriz de relatórios',
        description: 'Catalogação dos relatórios essenciais por área.',
        status: 'Validação',
      },
      {
        title: 'Motor de exportação',
        description: 'Padronização de saída em múltiplos formatos.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Agendamento inteligente',
        description: 'Planejamento de disparo automatizado por público e periodicidade.',
        status: 'Planejamento',
      },
    ],
  },
  contabilidade: {
    key: 'contabilidade',
    label: 'Contabilidade',
    section: 'Módulos',
    headline: 'Visão financeira integrada com a operação.',
    description:
      'Evolução do módulo para apoiar consolidação financeira, centros de custo e análise de desempenho econômico.',
    capabilities: [
      'Acompanhamento de custos operacionais por processo.',
      'Consolidação por centro de custo e competência.',
      'Painel de variação entre planejado e realizado.',
      'Base para integração com ERP financeiro.',
    ],
    tools: ['Custos por processo', 'Centros de custo', 'Consolidação mensal', 'Interface com ERP'],
    roadmap: [
      {
        title: 'Estrutura contábil',
        description: 'Definição de entidades e classificações financeiras.',
        status: 'Validação',
      },
      {
        title: 'Painel econômico',
        description: 'Desenvolvimento de indicadores e comparativos financeiros.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Integração contábil',
        description: 'Planejamento de sincronização automática com sistemas externos.',
        status: 'Planejamento',
      },
    ],
  },
  comunicacao: {
    key: 'comunicacao',
    label: 'Comunicação',
    section: 'Módulos',
    headline: 'Canal interno para colaboração entre áreas.',
    description:
      'Estruturação de comunicação corporativa segura para alinhamento de times, incidentes e decisões operacionais.',
    capabilities: [
      'Conversas por equipe, departamento e contexto operacional.',
      'Mensagens com histórico e rastreabilidade.',
      'Notificações para eventos críticos.',
      'Integração com alertas do sistema.',
    ],
    tools: ['Chat interno', 'Canais por setor', 'Alertas', 'Histórico de comunicação'],
    roadmap: [
      {
        title: 'Base de comunicação',
        description: 'Definição de canais, permissões e política de retenção.',
        status: 'Validação',
      },
      {
        title: 'Fluxo colaborativo',
        description: 'Implementação de troca de mensagens com foco operacional.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Comando central',
        description: 'Planejamento de sala de operação para eventos críticos.',
        status: 'Planejamento',
      },
    ],
  },
  integracoes: {
    key: 'integracoes',
    label: 'Integrações',
    section: 'Módulos',
    headline: 'Conectividade com ERP, BI e serviços externos.',
    description:
      'Camada de integração corporativa para sincronizar dados críticos com plataformas internas e parceiros.',
    capabilities: [
      'Cadastro e gestão de conectores por provedor.',
      'Sincronização segura com monitoramento de execução.',
      'Logs técnicos para auditoria e troubleshooting.',
      'Política de retries e contingência.',
    ],
    tools: ['Conectores', 'Logs de integração', 'Testes de conexão', 'Monitor de sincronização'],
    roadmap: [
      {
        title: 'Fundação de conectores',
        description: 'Estrutura de autenticação e mapeamento de payloads.',
        status: 'Validação',
      },
      {
        title: 'Sincronização operacional',
        description: 'Implementação de rotinas de importação e exportação.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Orquestração inteligente',
        description: 'Planejamento de governança automática e observabilidade avançada.',
        status: 'Planejamento',
      },
    ],
  },
  usuarios: {
    key: 'usuarios',
    label: 'Colaboradores',
    section: 'Sistema',
    headline: 'Gestão de identidades, perfis e acessos.',
    description:
      'Fortalecimento da segurança corporativa com políticas de acesso, trilhas e governança de usuários.',
    capabilities: [
      'Cadastro e gestão de usuários por perfil.',
      'Controle de status, sessão e autenticação forte.',
      'Delegação de permissões por função.',
      'Visão consolidada de acessos ativos.',
    ],
    tools: ['Gestão de usuários', 'Perfis e roles', 'Sessões', 'Políticas de acesso'],
    roadmap: [
      {
        title: 'Modelo de identidade',
        description: 'Refino da estrutura de perfis e regras de autorização.',
        status: 'Validação',
      },
      {
        title: 'Painel administrativo',
        description: 'Fluxos de criação, edição e governança de contas.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Segurança avançada',
        description: 'Planejamento de controles adicionais de risco e auditoria.',
        status: 'Planejamento',
      },
    ],
  },
  departamentos: {
    key: 'departamentos',
    label: 'Departamentos',
    section: 'Sistema',
    headline: 'Estrutura organizacional e responsabilidade funcional.',
    description:
      'Gestão de departamentos para dar visibilidade organizacional e melhorar accountability entre equipes.',
    capabilities: [
      'Cadastro e hierarquia de departamentos.',
      'Associação de usuários, líderes e responsabilidades.',
      'Visão de indicadores por área organizacional.',
      'Base para governança de processos internos.',
    ],
    tools: ['Cadastro de departamentos', 'Hierarquia', 'Lideranças', 'Painel organizacional'],
    roadmap: [
      {
        title: 'Governança estrutural',
        description: 'Definição de padrões para áreas e gestão responsável.',
        status: 'Validação',
      },
      {
        title: 'Gestão operacional',
        description: 'Implementação de fluxos administrativos por departamento.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Indicadores por área',
        description: 'Planejamento de visão comparativa interdepartamental.',
        status: 'Planejamento',
      },
    ],
  },
  auditoria: {
    key: 'auditoria',
    label: 'Auditoria',
    section: 'Sistema',
    headline: 'Trilha corporativa de eventos e conformidade.',
    description:
      'Consolidação das trilhas de auditoria para compliance, investigação de incidentes e rastreabilidade total.',
    capabilities: [
      'Registro detalhado de ações por usuário e módulo.',
      'Filtros por período, entidade e tipo de evento.',
      'Exportação para análises de compliance.',
      'Base de evidências para governança corporativa.',
    ],
    tools: ['Logs de auditoria', 'Filtros avançados', 'Exportação', 'Monitor de eventos'],
    roadmap: [
      {
        title: 'Padrão de trilhas',
        description: 'Definição de criticidade e taxonomia de eventos.',
        status: 'Validação',
      },
      {
        title: 'Consulta avançada',
        description: 'Desenvolvimento de busca e correlação de eventos.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Compliance contínuo',
        description: 'Planejamento de alertas automáticos de inconformidade.',
        status: 'Planejamento',
      },
    ],
  },
  analytics: {
    key: 'analytics',
    label: 'Analytics',
    section: 'Sistema',
    headline: 'Inteligência analítica para tomada de decisão.',
    description:
      'Estruturação de analytics corporativo com visão integrada de desempenho operacional e gerencial.',
    capabilities: [
      'Modelos analíticos por domínio de negócio.',
      'Dashboards temáticos com drill-down.',
      'Medições de tendência e performance histórica.',
      'Base para análises preditivas.',
    ],
    tools: ['Dashboards analíticos', 'Tendências', 'Comparativos', 'Medições estratégicas'],
    roadmap: [
      {
        title: 'Modelagem analítica',
        description: 'Curadoria de dados e dicionário de métricas.',
        status: 'Validação',
      },
      {
        title: 'Visualização corporativa',
        description: 'Desenvolvimento de painéis analíticos por tema.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Predição e recomendações',
        description: 'Planejamento de análises inteligentes para decisão.',
        status: 'Planejamento',
      },
    ],
  },
  configuracoes: {
    key: 'configuracoes',
    label: 'Configurações',
    section: 'Sistema',
    headline: 'Governança do sistema, políticas e segurança.',
    description:
      'Central de configurações corporativas para políticas de acesso, sessão, autenticação e parâmetros globais.',
    capabilities: [
      'Gestão de parâmetros institucionais do sistema.',
      'Configuração de segurança e sessão por perfil.',
      'Controle de autenticação e políticas de senha.',
      'Padronização operacional por ambiente.',
    ],
    tools: ['Parâmetros globais', 'Políticas de acesso', 'Configuração de sessão', 'Administração de segurança'],
    roadmap: [
      {
        title: 'Catálogo de políticas',
        description: 'Definição de controles e parâmetros estratégicos.',
        status: 'Validação',
      },
      {
        title: 'Console administrativo',
        description: 'Implementação da central de configuração corporativa.',
        status: 'Em desenvolvimento',
      },
      {
        title: 'Gestão adaptativa',
        description: 'Planejamento de automações de política por risco.',
        status: 'Planejamento',
      },
    ],
  },
}

export function getModulePlan(moduleKey: string | null): ModulePlan {
  if (moduleKey && MODULE_PLANS[moduleKey]) {
    return MODULE_PLANS[moduleKey]
  }
  return MODULE_PLANS['painel-executivo']
}


