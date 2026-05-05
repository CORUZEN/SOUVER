'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Activity,
  Database,
  Lock,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  Wifi,
  KeyRound,
  Search,
  Code2,
  AlertTriangle,
  Server,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Skeleton'

/* ─── Types ─────────────────────────────────── */
type TestStatus = 'idle' | 'running' | 'ok' | 'error'

interface TestResult {
  status: TestStatus
  data: unknown
  elapsedMs?: number
  error?: string
  timestamp?: string
}

interface TestState {
  [key: string]: TestResult
}

/* ─── Helpers ───────────────────────────────── */
function StatusBadge({ status, elapsedMs }: { status: TestStatus; elapsedMs?: number }) {
  if (status === 'idle') return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-500">Aguardando</span>
  if (status === 'running') return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"><Spinner className="h-3 w-3" />Executando...</span>
  if (status === 'ok') return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" />OK {elapsedMs != null && `· ${elapsedMs}ms`}</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"><XCircle className="h-3 w-3" />Erro</span>
}

function JsonViewer({ data, maxRows }: { data: unknown; maxRows?: number }) {
  const [expanded, setExpanded] = useState(false)
  if (data == null) return null

  const rows = Array.isArray((data as Record<string, unknown>)?.rows) ? (data as Record<string, unknown>).rows as unknown[] : null
  const displayRows = rows && !expanded && maxRows ? rows.slice(0, maxRows) : rows
  const displayData = displayRows ? { ...(data as object), rows: displayRows } : data
  const str = JSON.stringify(displayData, null, 2)

  return (
    <div className="relative mt-3">
      <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-200 font-mono scrollbar-thin">
        {str}
      </pre>
      {rows && rows.length > (maxRows ?? 5) && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Mostrar menos' : `Ver todas as ${rows.length} linhas`}
        </button>
      )}
    </div>
  )
}

function TestCard({
  id,
  icon: Icon,
  title,
  description,
  result,
  onRun,
  children,
  accent = 'blue',
}: {
  id: string
  icon: React.ElementType
  title: string
  description: string
  result: TestResult
  onRun: () => void
  children?: React.ReactNode
  accent?: 'blue' | 'emerald' | 'amber' | 'purple' | 'red'
}) {
  const [open, setOpen] = useState(false)
  const accentClasses = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-700',
  }
  const hasResult = result.status !== 'idle'

  return (
    <div className="rounded-xl border border-surface-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 shrink-0 rounded-lg p-2 ${accentClasses[accent]}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-surface-900">{title}</h3>
              <p className="mt-0.5 text-sm text-surface-500">{description}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={result.status} elapsedMs={result.elapsedMs} />
            <button
              onClick={onRun}
              disabled={result.status === 'running'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {result.status === 'running' ? <Spinner className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              Executar
            </button>
          </div>
        </div>

        {children && <div className="mt-4 border-t border-surface-100 pt-4">{children}</div>}

        {hasResult && (
          <div className="mt-4 border-t border-surface-100 pt-3">
            <button
              onClick={() => setOpen(v => !v)}
              className="flex w-full items-center justify-between text-sm font-medium text-surface-600 hover:text-surface-900"
            >
              <span className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                {result.status === 'error' ? `Erro: ${result.error?.slice(0, 80)}` : `Resultado · ${result.timestamp}`}
              </span>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {open && <JsonViewer data={result.data} maxRows={10} />}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Field Table ──────────────────────────── */
function FieldsTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows?.length) return <p className="text-sm text-surface-500 italic mt-2">Sem linhas retornadas.</p>
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-surface-200">
      <table className="w-full text-xs">
        <thead className="bg-surface-50">
          <tr>
            {Object.keys(rows[0]).filter(k => !k.startsWith('_')).map(k => (
              <th key={k} className="px-3 py-2 text-left font-semibold text-surface-600 whitespace-nowrap">{k}</th>
            ))}
            {rows[0]._derived && <th className="px-3 py-2 text-left font-semibold text-emerald-700 bg-emerald-50 whitespace-nowrap">⚡ RESULTADO SOUVER</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-surface-50">
              {Object.entries(row).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                <td key={k} className="px-3 py-2 text-surface-700 whitespace-nowrap font-mono">{String(v ?? '—')}</td>
              ))}
              {row._derived && (
                <td className="px-3 py-2 bg-emerald-50">
                  <div className="font-bold text-emerald-800">{(row._derived as Record<string, unknown>).sankhya_portal_expects as string}</div>
                  <div className="text-emerald-600 text-[10px]">medaux={String((row._derived as Record<string, unknown>).medaux_effective)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Main page ─────────────────────────────── */
export default function DiagnosticoPage() {
  const [authOk, setAuthOk] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<'infra' | 'inspect' | 'sql'>('infra')
  const [tests, setTests] = useState<TestState>({})

  // params
  const [nunotaInput, setNunotaInput] = useState('243986')
  const [customSql, setCustomSql] = useState('SELECT 1 AS TEST FROM DUAL')

  const runningRef = useRef<Set<string>>(new Set())

  // Check auth on mount
  useState(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAuthOk(d?.user?.roleCode === 'DEVELOPER'))
      .finally(() => setChecking(false))
  })

  const run = useCallback(async (testId: string, action: string, params: Record<string, string> = {}) => {
    if (runningRef.current.has(testId)) return
    runningRef.current.add(testId)

    setTests(prev => ({ ...prev, [testId]: { status: 'running', data: null } }))
    const q = new URLSearchParams({ action, ...params })
    try {
      const res = await fetch(`/api/dev/diagnostico?${q}`)
      const data = await res.json()
      setTests(prev => ({
        ...prev,
        [testId]: {
          status: data.ok ? 'ok' : 'error',
          data,
          elapsedMs: data.elapsedMs,
          error: data.error,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
        },
      }))
    } catch (e) {
      setTests(prev => ({
        ...prev,
        [testId]: { status: 'error', data: null, error: e instanceof Error ? e.message : 'rede', timestamp: new Date().toLocaleTimeString('pt-BR') },
      }))
    } finally {
      runningRef.current.delete(testId)
    }
  }, [])

  const t = (id: string): TestResult => tests[id] ?? { status: 'idle', data: null }

  /* ─── Access guard ─────────────────────────── */
  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-surface-500 py-10 justify-center">
        <Spinner /> Verificando acesso...
      </div>
    )
  }

  if (!authOk) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-red-700 mt-0.5 shrink-0" />
          <div>
            <h1 className="font-semibold text-red-900">Acesso restrito</h1>
            <p className="mt-1 text-sm text-red-700">Esta página é exclusiva para o perfil <strong>Desenvolvedor</strong>.</p>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Page content ──────────────────────────── */
  const tabs = [
    { id: 'infra', label: 'Infraestrutura', icon: Server },
    { id: 'inspect', label: 'Inspecionar Pedido', icon: Database },
    { id: 'sql', label: 'SQL Livre', icon: Code2 },
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-900 p-2.5 text-white">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">Área Dev · SOUVER</p>
            <h1 className="text-2xl font-semibold text-surface-900">Central de Diagnóstico</h1>
          </div>
          <button
            onClick={() => run('status', 'status')}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-xs font-medium text-surface-600 hover:bg-surface-100 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${t('status').status === 'running' ? 'animate-spin' : ''}`} />
            Status do sistema
          </button>
        </div>

        {t('status').status === 'ok' && (() => {
          const d = t('status').data as Record<string, unknown>
          const sys = d?.system as Record<string, unknown>
          const int = d?.integration as Record<string, unknown> | null
          return (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Ambiente', value: String(sys?.appEnv ?? sys?.nodeEnv ?? '—') },
                { label: 'Usuários ativos', value: String(sys?.usersActive ?? '—') },
                { label: 'Sessões ativas', value: String(sys?.sessionsActive ?? '—') },
                { label: 'Integração Sankhya', value: int ? `${int.status} · ${String(int.baseUrl ?? '').replace(/^https?:\/\//, '')}` : 'Não configurada' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-surface-50 px-3 py-2.5 border border-surface-100">
                  <p className="text-xs text-surface-500">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-surface-800 truncate">{value}</p>
                </div>
              ))}
            </div>
          )
        })()}
      </section>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-surface-200 bg-surface-50 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              tab === id
                ? 'bg-white shadow-sm text-surface-900 border border-surface-200'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Infraestrutura ──────────────────── */}
      {tab === 'infra' && (
        <div className="space-y-4">
          <TestCard
            id="connection"
            icon={Wifi}
            title="Conectividade"
            description="Testa se o servidor Sankhya está acessível na URL configurada."
            result={t('connection')}
            onRun={() => run('connection', 'connection')}
            accent="blue"
          />

          <TestCard
            id="auth"
            icon={KeyRound}
            title="Autenticação OAuth2"
            description="Obtém bearer token via client_credentials e verifica se o fluxo OAuth está funcional."
            result={t('auth')}
            onRun={() => run('auth', 'auth')}
            accent="purple"
          >
            {t('auth').status === 'ok' && (() => {
              const d = t('auth').data as Record<string, unknown>
              return (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-surface-500">Modo:</span> <strong>{String(d.authMode)}</strong></div>
                  <div><span className="text-surface-500">Bearer:</span> <strong>{d.bearerObtained ? '✅ OK' : '❌ Falhou'}</strong></div>
                  <div><span className="text-surface-500">Preview:</span> <code className="text-xs bg-surface-100 px-1 rounded">{String(d.bearerPreview ?? '—')}</code></div>
                </div>
              )
            })()}
          </TestCard>
        </div>
      )}

      {/* ── TAB: Inspecionar Pedido ──────────────── */}
      {tab === 'inspect' && (
        <div className="space-y-4">
          {/* Unified inspect card */}
          <div className="rounded-xl border border-surface-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 rounded-lg bg-purple-50 p-2 text-purple-700">
                    <Search className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900">Inspecionar Pedido</h3>
                    <p className="mt-0.5 text-sm text-surface-500">
                      Analisa campos raw (TGFITE + TGFPRO) e simula a lógica do route.ts para um NUNOTA.
                    </p>
                  </div>
                </div>
                <StatusBadge status={t('inspect-pedido').status} elapsedMs={t('inspect-pedido').elapsedMs} />
              </div>

              {/* NUNOTA input + run button */}
              <div className="mt-4 flex items-center gap-3 border-t border-surface-100 pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <span className="shrink-0 font-medium text-surface-700">NUNOTA:</span>
                  <input
                    type="number"
                    value={nunotaInput}
                    onChange={e => setNunotaInput(e.target.value)}
                    placeholder="243986"
                    className="w-36 rounded-lg border border-surface-200 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
                  />
                </label>
                <button
                  onClick={() => run('inspect-pedido', 'inspect-pedido', { nunota: nunotaInput })}
                  disabled={t('inspect-pedido').status === 'running'}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('inspect-pedido').status === 'running' ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  Inspecionar
                </button>
              </div>

              {/* Error state */}
              {t('inspect-pedido').status === 'error' && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <strong>Erro:</strong> {t('inspect-pedido').error}
                </div>
              )}

              {/* Results */}
              {t('inspect-pedido').status === 'ok' && (() => {
                const d = t('inspect-pedido').data as Record<string, unknown>
                const raw = d?.raw as { ok: boolean; error: string | null; rows: Record<string, unknown>[] }
                const sim = d?.simulation as { ok: boolean; error: string | null; rows: Record<string, unknown>[] }

                return (
                  <div className="mt-5 space-y-5">
                    {/* Raw fields section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-surface-400">
                          Campos Raw — TGFITE + TGFPRO
                        </span>
                        {raw.ok
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                      </div>
                      {raw.error && (
                        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-mono mb-2">{raw.error}</div>
                      )}
                      {raw.rows?.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-surface-200">
                          <table className="w-full text-xs">
                            <thead className="bg-surface-50">
                              <tr>
                                {['SEQ', 'CODPROD', 'PRODUTO', 'ITE_CODVOL', 'PRD_CODVOL', 'MEDAUX', 'QTDNEG', 'QTDVOL', 'PESO'].map(h => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-surface-600 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                              {raw.rows.map((r, i) => (
                                <tr key={i} className="hover:bg-surface-50">
                                  <td className="px-3 py-2 font-mono text-surface-500">{String(r.SEQUENCIA ?? '—')}</td>
                                  <td className="px-3 py-2 font-mono">{String(r.CODPROD ?? '—')}</td>
                                  <td className="px-3 py-2 text-surface-700 max-w-48 truncate">{String(r.DESCRPROD ?? '—')}</td>
                                  <td className="px-3 py-2 font-mono font-semibold text-blue-700">{String(r.ITE_CODVOL ?? '—')}</td>
                                  <td className="px-3 py-2 font-mono text-surface-600">{String(r.PRD_CODVOL ?? '—')}</td>
                                  <td className="px-3 py-2 font-mono">{String(r.PRD_MEDAUX ?? '—')}</td>
                                  <td className="px-3 py-2 font-mono font-semibold">{String(r.QTDNEG ?? '—')}</td>
                                  <td className="px-3 py-2 font-mono">{String(r.QTDVOL ?? '—')}</td>
                                  <td className="px-3 py-2 font-mono">{String(r.PESO ?? '—')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Simulation / analysis section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-surface-400">
                          Simulação Route.ts + Diagnóstico
                        </span>
                        {sim.ok
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                      </div>
                      {sim.error && (
                        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-mono mb-2">{sim.error}</div>
                      )}
                      {sim.rows?.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-surface-200">
                          <table className="w-full text-xs">
                            <thead className="bg-surface-50">
                              <tr>
                                {['CODPROD', 'PRODUTO', 'ITE_CODVOL', 'PRD_CODVOL', 'CONVERVOL', 'FATTOTAL', 'MEDAUX', 'QTDNEG', 'QTDVOL'].map(h => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-surface-600 whitespace-nowrap">{h}</th>
                                ))}
                                <th className="px-3 py-2 text-left font-semibold text-emerald-700 bg-emerald-50 whitespace-nowrap">SOUVER EXIBE</th>
                                <th className="px-3 py-2 text-left font-semibold text-amber-700 bg-amber-50 whitespace-nowrap">DIAGNÓSTICO</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                              {sim.rows.map((r, i) => {
                                const a = r._analysis as Record<string, unknown>
                                const mismatch = a?.unit_mismatch as boolean
                                const noConversion = a?.conversion_source === 'none'
                                return (
                                  <tr key={i} className="hover:bg-surface-50">
                                    <td className="px-3 py-2 font-mono">{String(r.CODPROD)}</td>
                                    <td className="px-3 py-2 text-surface-700 max-w-48 truncate">{String(r.PRODUTO)}</td>
                                    <td className={`px-3 py-2 font-mono font-semibold ${mismatch ? 'text-amber-700' : 'text-blue-700'}`}>{String(r.ITE_CODVOL)}</td>
                                    <td className="px-3 py-2 font-mono text-surface-500">{String(r.PRD_CODVOL)}</td>
                                    <td className={`px-3 py-2 font-mono ${Number(a?.convervol) > 1 ? 'text-emerald-700 font-bold' : 'text-surface-400'}`}>{String(r.CONVERVOL ?? '—')}</td>
                                    <td className={`px-3 py-2 font-mono ${Number(a?.medaux) > 1 ? 'text-emerald-700 font-semibold' : 'text-surface-400'}`}>{String(r.MEDAUX)}</td>
                                    <td className="px-3 py-2 font-mono font-semibold">{String(a?.qtdneg ?? '—')}</td>
                                    <td className={`px-3 py-2 font-mono ${Number(a?.qtdvol) > 0 ? 'text-emerald-600 font-semibold' : 'text-surface-400'}`}>{String(a?.qtdvol ?? '—')}</td>
                                    <td className="px-3 py-2 bg-emerald-50 font-bold text-emerald-800">{String(a?.souver_displays ?? '—')}</td>
                                    <td className={`px-3 py-2 text-[11px] max-w-64 ${noConversion ? 'bg-amber-50 text-amber-800' : 'text-surface-600'}`}>
                                      {String(a?.diagnosis ?? '—')}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Se <strong>ITE_CODVOL ≠ PRD_CODVOL</strong>, a unidade exibida está errada — o route.ts usa a unidade do produto (PRD_CODVOL) mas deveria usar a unidade do item (ITE_CODVOL).
              Se <strong>MEDAUX = 1</strong> e <strong>QTDVOL = 0</strong>, nenhuma conversão está configurada no banco — use SQL Livre para consultar <code className="bg-amber-100 px-1 rounded text-xs">TGFUNI</code>.
            </p>
          </div>
        </div>
      )}

      {/* ── TAB: SQL Livre ───────────────────────── */}
      {tab === 'sql' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="h-4 w-4 text-surface-500" />
              <h3 className="font-semibold text-surface-900">SQL Livre — Sankhya Oracle</h3>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                <Lock className="h-3 w-3" /> Somente SELECT
              </span>
            </div>
            <textarea
              value={customSql}
              onChange={e => setCustomSql(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-surface-200 bg-slate-950 px-4 py-3 text-sm font-mono text-slate-200 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300 resize-y"
              spellCheck={false}
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => run('custom-sql', 'custom-sql', { sql: customSql })}
                disabled={t('custom-sql').status === 'running'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {t('custom-sql').status === 'running' ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                Executar Query
              </button>
              <StatusBadge status={t('custom-sql').status} elapsedMs={t('custom-sql').elapsedMs} />
              {t('custom-sql').status === 'ok' && (
                <span className="text-xs text-surface-500">
                  {((t('custom-sql').data as Record<string,unknown>)?.rowCount as number) ?? 0} linha(s)
                </span>
              )}
            </div>
          </div>

          {t('custom-sql').status !== 'idle' && (
            <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-surface-400 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" /> Output
              </p>
              {t('custom-sql').status === 'error' && (
                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <strong>Erro:</strong> {t('custom-sql').error}
                </div>
              )}
              {t('custom-sql').status === 'ok' && (() => {
                const rows = (t('custom-sql').data as Record<string, unknown>)?.rows as Record<string, unknown>[] | null
                return rows?.length
                  ? <FieldsTable rows={rows} />
                  : <p className="text-sm text-surface-500 italic">Query executada sem retornar linhas.</p>
              })()}
            </div>
          )}

          <div className="rounded-xl border border-surface-100 bg-surface-50 p-4">
            <p className="text-xs font-semibold text-surface-600 mb-2">Queries úteis:</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { label: 'Todos campos TGFITE (243986)', sql: 'SELECT I.* FROM TGFITE I WHERE I.NUNOTA = 243986 ORDER BY I.SEQUENCIA' },
                { label: 'TGFPRO completo prod 18,30', sql: 'SELECT P.* FROM TGFPRO P WHERE P.CODPROD IN (18, 30)' },
                { label: 'TGFUNI — tabela de unidades', sql: "SELECT U.CODVOL, U.DESCVOL FROM TGFUNI U ORDER BY U.CODVOL" },
                { label: 'Usuários Sankhya', sql: 'SELECT V.CODVEND, V.APELIDO FROM TGFVEN V WHERE ROWNUM <= 10 ORDER BY V.CODVEND' },
              ].map(({ label, sql }) => (
                <button
                  key={label}
                  onClick={() => setCustomSql(sql)}
                  className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-left text-xs text-surface-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 rounded-lg bg-surface-50 border border-surface-100 px-4 py-2.5 text-xs text-surface-500">
        <Clock className="h-3.5 w-3.5" />
        Diagnósticos são executados em tempo real no Sankhya. Não alteram dados.
      </div>
    </div>
  )
}
