'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Shield, ShieldCheck, ShieldOff, Copy, Check, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Skeleton'

type Step = 'status' | 'setup' | 'backup-codes'

interface SetupData {
  secret: string
  qrDataUrl: string
  otpauthUrl: string
}

export default function TwoFactorPage() {
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean | null>(null)
  const [step, setStep] = useState<Step>('status')
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [totp, setTotp] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Check current 2FA status
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) setIs2FAEnabled(data.user.twoFactorEnabled ?? false)
      })
      .catch(() => null)
  }, [])

  async function startSetup() {
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/setup')
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setSetupData(data)
      setStep('setup')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar configuraÃ§Ã£o.')
    } finally {
      setIsLoading(false)
    }
  }

  async function verifyAndEnable() {
    if (!totp.trim()) return setError('Digite o cÃ³digo do aplicativo.')
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setBackupCodes(data.backupCodes ?? [])
      setIs2FAEnabled(true)
      setStep('backup-codes')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CÃ³digo invÃ¡lido.')
    } finally {
      setIsLoading(false)
    }
  }

  async function disable2FA() {
    if (!totp.trim()) return setError('Digite o cÃ³digo para desabilitar.')
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setIs2FAEnabled(false)
      setTotp('')
      setStep('status')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CÃ³digo invÃ¡lido.')
    } finally {
      setIsLoading(false)
    }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (is2FAEnabled === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/configuracoes" className="text-surface-400 hover:text-surface-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary-600" />
            AutenticaÃ§Ã£o de Dois Fatores
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            ProteÃ§Ã£o adicional para sua conta com TOTP.
          </p>
        </div>
      </div>

      {/* â”€â”€ Status / enable screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {step === 'status' && (
        <Card>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${is2FAEnabled ? 'bg-green-50' : 'bg-surface-100'}`}>
              {is2FAEnabled ? (
                <ShieldCheck className="w-6 h-6 text-green-600" />
              ) : (
                <ShieldOff className="w-6 h-6 text-surface-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-surface-900">
                {is2FAEnabled ? '2FA Habilitado' : '2FA Desabilitado'}
              </p>
              <p className="text-xs text-surface-500 mt-0.5">
                {is2FAEnabled
                  ? 'Sua conta estÃ¡ protegida com autenticaÃ§Ã£o de dois fatores.'
                  : 'Habilite o 2FA para aumentar a seguranÃ§a da sua conta.'}
              </p>
            </div>
            <Button
              variant={is2FAEnabled ? 'danger' : 'primary'}
              size="sm"
              onClick={() => { setError(null); setTotp(''); setStep(is2FAEnabled ? 'status' : 'status') }}
            >
              {is2FAEnabled ? 'Desabilitar' : 'Habilitar'}
            </Button>
          </div>

          {is2FAEnabled && (
            <div className="mt-4 pt-4 border-t border-surface-100 space-y-3">
              <p className="text-sm text-surface-700">
                Para desabilitar, confirme com o cÃ³digo do seu aplicativo autenticador:
              </p>
              {error && (
                <p className="text-xs text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <Input
                label="CÃ³digo TOTP"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                placeholder="000 000"
                maxLength={6}
                className="font-mono text-center tracking-widest"
              />
              <Button variant="danger" loading={isLoading} onClick={disable2FA} className="w-full">
                Confirmar e Desabilitar 2FA
              </Button>
            </div>
          )}

          {!is2FAEnabled && (
            <div className="mt-4 pt-4 border-t border-surface-100">
              <p className="text-sm text-surface-600 mb-3">
                VocÃª precisarÃ¡ de um aplicativo autenticador como{' '}
                <strong>Google Authenticator</strong>, <strong>Authy</strong> ou{' '}
                <strong>Microsoft Authenticator</strong>.
              </p>
              <Button loading={isLoading} onClick={startSetup} className="w-full">
                <Shield className="w-4 h-4" />
                ComeÃ§ar ConfiguraÃ§Ã£o
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* â”€â”€ Setup screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {step === 'setup' && setupData && (
        <Card>
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-surface-900 mb-1">
                1. Escaneie o QR Code
              </h2>
              <p className="text-xs text-surface-500">
                Abra seu aplicativo autenticador e escaneie o cÃ³digo abaixo.
              </p>
            </div>

            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setupData.qrDataUrl}
                alt="QR Code para configuraÃ§Ã£o do 2FA"
                className="w-48 h-48 rounded-lg border border-surface-200"
              />
            </div>

            <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
              <p className="text-xs text-surface-500 mb-1">Ou insira o cÃ³digo manualmente:</p>
              <p className="text-xs font-mono text-surface-800 break-all">{setupData.secret}</p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-surface-900 mb-3">
                2. Digite o cÃ³digo gerado
              </h2>
              {error && (
                <p className="text-xs text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2 mb-3">
                  {error}
                </p>
              )}
              <Input
                label="CÃ³digo TOTP (6 dÃ­gitos)"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="font-mono text-center tracking-widest text-lg"
                maxLength={6}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('status')} disabled={isLoading} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={verifyAndEnable} loading={isLoading} disabled={totp.length !== 6} className="flex-1">
                Verificar e Ativar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* â”€â”€ Backup codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {step === 'backup-codes' && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-green-600 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-surface-900">2FA habilitado com sucesso!</h2>
                <p className="text-xs text-surface-500 mt-0.5">
                  Guarde seus cÃ³digos de backup em local seguro.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800 font-medium">
                âš ï¸ AtenÃ§Ã£o: estes cÃ³digos serÃ£o exibidos apenas uma vez. Cada cÃ³digo pode ser usado apenas uma vez caso vocÃª perca acesso ao seu aplicativo autenticador.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <div key={code} className="bg-surface-50 border border-surface-200 rounded px-3 py-2 font-mono text-sm text-surface-800 text-center">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={copyBackupCodes} className="flex-1">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar cÃ³digos'}
              </Button>
              <Link href="/configuracoes" className="flex-1">
                <Button className="w-full">Concluir</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

