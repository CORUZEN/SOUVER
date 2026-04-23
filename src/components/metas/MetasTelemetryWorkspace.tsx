'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/Card'

type RouteStats = {
  requests: number
  statuses: Record<string, number>
  totalDurationMs: number
  maxDurationMs: number
  lastDurationMs: number
  avgDurationMs: number
  errors: number
  updatedAt: string
}

type CacheStats = {
  hit: number
  inflightHit: number
  miss: number
  loadSuccess: number
  loadError: number
  updatedAt: string
}

type ConcurrencyStats = {
  immediate: number
  queued: number
  waitCount: number
  totalWaitMs: number
  avgWaitMs: number
  maxWaitMs: number
  updatedAt: string
}

type TelemetrySnapshot = {
  generatedAt: string
  routes: Record<string, RouteStats>
  cache: Record<string, CacheStats>
  concurrency: Record<string, ConcurrencyStats>
}

const REFRESH_INTERVAL_MS = 15_000

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatPercent(value: number) {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR')
}

export default function MetasTelemetryWorkspace() {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusCode, setStatusCode] = useState<number | null>(null)

  const loadTelemetry = useCallback(async (opts?: { reset?: boolean; silent?: boolean }) => {
    const reset = opts?.reset ?? false
    const silent = opts?.silent ?? false
    if (!silent) setRefreshing(true)
    try {
      const url = reset ? '/api/metas/telemetry?reset=1' : '/api/metas/telemetry'
      const response = await fetch(url, { cache: 'no-store' })
      setStatusCode(response.status)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof data?.message === 'string' && data.message
          ? data.message
          : 'Falha ao carregar telemetria.'
        setErrorMessage(message)
        if (!silent) setSnapshot(null)
        return
      }
      setErrorMessage('')
      setSnapshot(data as TelemetrySnapshot)
    } catch (error) {
      setStatusCode(500)
      setErrorMessage(error instanceof Error ? error.message : 'Falha inesperada ao consultar telemetria.')
    } finally {
      setLoading(false)
      if (!silent) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadTelemetry()
    const timer = window.setInterval(() => {
      void loadTelemetry({ silent: true })
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [loadTelemetry])

  const routeRows = useMemo(() => {
    if (!snapshot) return []
    return Object.entries(snapshot.routes)
      .map(([route, stats]) => ({ route, ...stats }))
      .sort((a, b) => {
        if (b.errors !== a.errors) return b.errors - a.errors
        return b.avgDurationMs - a.avgDurationMs
      })
  }, [snapshot])

  const cacheRows = useMemo(() => {
    if (!snapshot) return []
    return Object.entries(snapshot.cache)
      .map(([scope, stats]) => ({ scope, ...stats }))
      .sort((a, b) => (b.hit + b.inflightHit + b.miss) - (a.hit + a.inflightHit + a.miss))
  }, [snapshot])

  const concurrencyRows = useMemo(() => {
    if (!snapshot) return []
    return Object.entries(snapshot.concurrency)
      .map(([pool, stats]) => ({ pool, ...stats }))
      .sort((a, b) => b.queued - a.queued)
  }, [snapshot])

  const summary = useMemo(() => {
    if (!snapshot) {
      return {
        requests: 0,
        serverErrors: 0,
        cacheHitRatio: 0,
        dedupeRatio: 0,
      }
    }
    const requests = routeRows.reduce((acc, row) => acc + row.requests, 0)
    const serverErrors = routeRows.reduce((acc, row) => acc + row.errors, 0)
    const cacheHit = cacheRows.reduce((acc, row) => acc + row.hit, 0)
    const cacheMiss = cacheRows.reduce((acc, row) => acc + row.miss, 0)
    const inflightHit = cacheRows.reduce((acc, row) => acc + row.inflightHit, 0)
    const totalCacheAttempts = cacheHit + cacheMiss
    const cacheHitRatio = totalCacheAttempts > 0 ? (cacheHit / totalCacheAttempts) * 100 : 0
    const dedupeBase = inflightHit + cacheMiss
    const dedupeRatio = dedupeBase > 0 ? (inflightHit / dedupeBase) * 100 : 0
    return { requests, serverErrors, cacheHitRatio, dedupeRatio }
  }, [snapshot, routeRows, cacheRows])

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="border-surface-200">
          <div className="flex items-center gap-3 text-surface-700">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <p className="text-sm font-medium">Carregando telemetria operacional...</p>
          </div>
        </Card>
      </div>
    )
  }

  if (errorMessage && !snapshot) {
    return (
      <div className="space-y-4">
        <Card className="border-rose-200 bg-rose-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-600" />
            <div>
              <p className="text-sm font-semibold text-rose-700">Falha ao consultar telemetria</p>
              <p className="mt-1 text-sm text-rose-700">{errorMessage}</p>
              {statusCode === 403 ? (
                <p className="mt-1 text-xs text-rose-700">Acesso permitido somente para Desenvolvedor e Analista de TI.</p>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-surface-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Monitoramento Técnico</p>
            <h1 className="mt-1 text-2xl font-semibold">Telemetria de Metas e PWA</h1>
            <p className="mt-1 text-sm text-white/80">
              Visão consolidada de desempenho, cache, deduplicação e concorrência.
            </p>
            <p className="mt-2 text-xs text-white/70">Última coleta: {formatDateTime(snapshot?.generatedAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadTelemetry()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => void loadTelemetry({ reset: true })}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/30 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Zerar métricas
            </button>
            <Link
              href="/metas"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/15"
            >
              Voltar ao painel
            </Link>
          </div>
        </div>
      </Card>

      {errorMessage ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
            <p className="text-sm font-medium text-amber-800">{errorMessage}</p>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-cyan-200 bg-cyan-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Requisições</p>
          <p className="mt-1 text-3xl font-bold text-cyan-900">{formatNumber(summary.requests)}</p>
          <p className="text-xs text-cyan-700">Total observado nas rotas monitoradas.</p>
        </Card>
        <Card className="border-rose-200 bg-rose-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Erros 5xx</p>
          <p className="mt-1 text-3xl font-bold text-rose-900">{formatNumber(summary.serverErrors)}</p>
          <p className="text-xs text-rose-700">Ocorrências críticas de backend.</p>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Cache Hit Rate</p>
          <p className="mt-1 text-3xl font-bold text-emerald-900">{formatPercent(summary.cacheHitRatio)}</p>
          <p className="text-xs text-emerald-700">Eficiência de resposta com cache quente.</p>
        </Card>
        <Card className="border-sky-200 bg-sky-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Deduplicação</p>
          <p className="mt-1 text-3xl font-bold text-sky-900">{formatPercent(summary.dedupeRatio)}</p>
          <p className="text-xs text-sky-700">Solicitações absorvidas por in-flight cache.</p>
        </Card>
      </div>

      <Card className="border-surface-200">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-surface-900">Rotas monitoradas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wider text-surface-500">
                <th className="px-2 py-2">Rota</th>
                <th className="px-2 py-2">Requests</th>
                <th className="px-2 py-2">Erros 5xx</th>
                <th className="px-2 py-2">Média (ms)</th>
                <th className="px-2 py-2">Máximo (ms)</th>
                <th className="px-2 py-2">Último (ms)</th>
                <th className="px-2 py-2">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {routeRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-surface-500">Sem dados de rota até o momento.</td>
                </tr>
              ) : (
                routeRows.map((row) => (
                  <tr key={row.route} className="border-b border-surface-100">
                    <td className="px-2 py-2 font-medium text-surface-800">{row.route}</td>
                    <td className="px-2 py-2 text-surface-700">{formatNumber(row.requests)}</td>
                    <td className={`px-2 py-2 font-semibold ${row.errors > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {formatNumber(row.errors)}
                    </td>
                    <td className="px-2 py-2 text-surface-700">{formatNumber(row.avgDurationMs)}</td>
                    <td className="px-2 py-2 text-surface-700">{formatNumber(row.maxDurationMs)}</td>
                    <td className="px-2 py-2 text-surface-700">{formatNumber(row.lastDurationMs)}</td>
                    <td className="px-2 py-2 text-surface-500">{formatDateTime(row.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-surface-200">
          <h2 className="mb-3 text-sm font-semibold text-surface-900">Cache e deduplicação</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wider text-surface-500">
                  <th className="px-2 py-2">Escopo</th>
                  <th className="px-2 py-2">Hit</th>
                  <th className="px-2 py-2">In-flight</th>
                  <th className="px-2 py-2">Miss</th>
                  <th className="px-2 py-2">Load OK</th>
                  <th className="px-2 py-2">Load erro</th>
                </tr>
              </thead>
              <tbody>
                {cacheRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-surface-500">Sem dados de cache.</td>
                  </tr>
                ) : (
                  cacheRows.map((row) => (
                    <tr key={row.scope} className="border-b border-surface-100">
                      <td className="px-2 py-2 font-medium text-surface-800">{row.scope}</td>
                      <td className="px-2 py-2 text-emerald-700">{formatNumber(row.hit)}</td>
                      <td className="px-2 py-2 text-sky-700">{formatNumber(row.inflightHit)}</td>
                      <td className="px-2 py-2 text-surface-700">{formatNumber(row.miss)}</td>
                      <td className="px-2 py-2 text-emerald-700">{formatNumber(row.loadSuccess)}</td>
                      <td className={`px-2 py-2 font-semibold ${row.loadError > 0 ? 'text-rose-700' : 'text-surface-700'}`}>
                        {formatNumber(row.loadError)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="border-surface-200">
          <h2 className="mb-3 text-sm font-semibold text-surface-900">Fila de concorrência</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wider text-surface-500">
                  <th className="px-2 py-2">Pool</th>
                  <th className="px-2 py-2">Exec. imediata</th>
                  <th className="px-2 py-2">Enfileirada</th>
                  <th className="px-2 py-2">Esperas</th>
                  <th className="px-2 py-2">Média (ms)</th>
                  <th className="px-2 py-2">Máximo (ms)</th>
                </tr>
              </thead>
              <tbody>
                {concurrencyRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-surface-500">Sem dados de concorrência.</td>
                  </tr>
                ) : (
                  concurrencyRows.map((row) => (
                    <tr key={row.pool} className="border-b border-surface-100">
                      <td className="px-2 py-2 font-medium text-surface-800">{row.pool}</td>
                      <td className="px-2 py-2 text-emerald-700">{formatNumber(row.immediate)}</td>
                      <td className={`px-2 py-2 ${row.queued > 0 ? 'font-semibold text-amber-700' : 'text-surface-700'}`}>
                        {formatNumber(row.queued)}
                      </td>
                      <td className="px-2 py-2 text-surface-700">{formatNumber(row.waitCount)}</td>
                      <td className="px-2 py-2 text-surface-700">{formatNumber(row.avgWaitMs)}</td>
                      <td className="px-2 py-2 text-surface-700">{formatNumber(row.maxWaitMs)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

