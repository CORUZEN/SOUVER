'use client'

import { useState, useEffect, useCallback } from 'react'
import { Monitor, Smartphone, Globe, ShieldX, CheckCircle2, ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'

interface Session {
  id:         string
  ipAddress:  string | null
  userAgent:  string | null
  deviceName: string | null
  startedAt:  string
  expiresAt:  string
  isCurrent:  boolean
}

// ─── helpers ─────────────────────────────────────────────────────

function parseDevice(ua: string | null): { label: string; icon: 'desktop' | 'mobile' } {
  if (!ua) return { label: 'Dispositivo desconhecido', icon: 'desktop' }
  const u = ua.toLowerCase()
  const isMobile = /mobile|android|iphone|ipad/.test(u)
  const browser =
    u.includes('firefox') ? 'Firefox' :
    u.includes('edg/')    ? 'Edge' :
    u.includes('chrome')  ? 'Chrome' :
    u.includes('safari')  ? 'Safari' :
    u.includes('opera')   ? 'Opera'  : 'Navegador desconhecido'
  const os =
    u.includes('windows') ? 'Windows' :
    u.includes('mac')     ? 'macOS' :
    u.includes('linux')   ? 'Linux' :
    u.includes('android') ? 'Android' :
    u.includes('iphone')  ? 'iOS' : ''
  return { label: `${browser}${os ? ` — ${os}` : ''}`, icon: isMobile ? 'mobile' : 'desktop' }
}

function formatRelative(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins < 1)   return 'agora mesmo'
  if (mins < 60)  return `há ${mins} min`
  if (hours < 24) return `há ${hours}h`
  return `há ${days} dia${days > 1 ? 's' : ''}`
}

// ─── página ──────────────────────────────────────────────────────

export default function SessoesPage() {
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [loading,   setLoading]   = useState(true)
  const [revoking,  setRevoking]  = useState<string | null>(null)
  const [message,   setMessage]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/users/me/sessions')
    if (r.ok) { const d = await r.json(); setSessions(d.sessions ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function revoke(id: string) {
    setRevoking(id)
    setMessage(null)
    const r = await fetch(`/api/users/me/sessions/${id}`, { method: 'DELETE' })
    const d = await r.json()
    if (r.ok) {
      setMessage({ type: 'ok', text: d.message })
      setSessions(prev => prev.filter(s => s.id !== id))
    } else {
      setMessage({ type: 'err', text: d.error ?? 'Erro ao encerrar sessão.' })
    }
    setRevoking(null)
  }

  const currentSession = sessions.find(s => s.isCurrent)
  const otherSessions  = sessions.filter(s => !s.isCurrent)

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/configuracoes" className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-surface-900 leading-tight">Sessões Ativas</h1>
            <p className="text-xs text-surface-500">{sessions.length} sessão{sessions.length !== 1 ? 'ões' : ''} ativa{sessions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
          message.type === 'ok'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'ok' ? <CheckCircle2 size={15} /> : <ShieldX size={15} />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-surface-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sessão atual */}
          {currentSession && (
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Sessão atual
              </p>
              <SessionCard session={currentSession} onRevoke={revoke} revoking={revoking} />
            </div>
          )}

          {/* Outras sessões */}
          {otherSessions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Outros dispositivos
              </p>
              <div className="space-y-2">
                {otherSessions.map(s => (
                  <SessionCard key={s.id} session={s} onRevoke={revoke} revoking={revoking} />
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <Card>
              <div className="text-center py-8 text-surface-400">
                <Monitor size={36} className="opacity-20 mx-auto mb-2" />
                <p className="text-sm">Nenhuma sessão ativa encontrada.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      <Card className="border-amber-200 bg-amber-50">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Dica de segurança:</strong> Se você reconhecer uma sessão suspeita ou que você não iniciou, clique em <em>&quot;Encerrar sessão&quot;</em> para revogá-la imediatamente. Se suspeitar de acesso não autorizado, altere sua senha em <Link href="/configuracoes/perfil" className="underline">Meu Perfil</Link>.
        </p>
      </Card>
    </div>
  )
}

// ─── componente de card de sessão ────────────────────────────────

function SessionCard({
  session,
  onRevoke,
  revoking,
}: {
  session:  Session
  onRevoke: (id: string) => void
  revoking: string | null
}) {
  const device = parseDevice(session.userAgent)
  const DeviceIcon = device.icon === 'mobile' ? Smartphone : Globe

  return (
    <Card className={session.isCurrent ? 'border-sky-200 bg-sky-50' : ''}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            session.isCurrent ? 'bg-sky-100' : 'bg-surface-100'
          }`}>
            <DeviceIcon size={18} className={session.isCurrent ? 'text-sky-600' : 'text-surface-500'} />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-surface-900">
              {session.deviceName ?? device.label}
              {session.isCurrent && (
                <span className="ml-1.5 text-[10px] bg-sky-200 text-sky-700 font-bold px-1.5 py-0.5 rounded-md">ATUAL</span>
              )}
            </p>
            {session.ipAddress && (
              <p className="text-surface-500 text-xs mt-0.5">{session.ipAddress}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-surface-400 mt-1">
              <Clock size={11} />
              Iniciada {formatRelative(session.startedAt)}
              <span className="mx-1">·</span>
              expira em {formatRelative(session.expiresAt)}
            </div>
          </div>
        </div>

        {!session.isCurrent && (
          <button
            disabled={revoking === session.id}
            onClick={() => onRevoke(session.id)}
            className="shrink-0 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ShieldX size={13} />
            {revoking === session.id ? 'Encerrando…' : 'Encerrar sessão'}
          </button>
        )}
      </div>
    </Card>
  )
}
