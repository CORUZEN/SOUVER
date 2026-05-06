'use client'

import { useState, useEffect } from 'react'
import { User, Lock, Phone, Camera, CheckCircle, AlertCircle, KeyRound, Shield, ShieldCheck, ShieldOff, QrCode, Copy, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface Profile {
  id: string
  fullName: string
  email: string
  login: string
  phone: string | null
  avatarUrl: string | null
  twoFactorEnabled: boolean
  role: string | null
  department: string | null
}

type AlertType = 'success' | 'error' | null
type TwoFactorStep = 'status' | 'setup' | 'backup-codes'

interface TwoFactorSetupData {
  secret: string
  qrDataUrl: string
  otpauthUrl: string
}

const PHONE_MASK_REGEX = /^\(\d{2}\)\s\d\s\d{4}-\d{4}$/

function formatBrazilPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

function formatTwoFactorCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 6)
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<{ type: AlertType; msg: string } | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwAlert, setPwAlert] = useState<{ type: AlertType; msg: string } | null>(null)

  const [twoFactorStep, setTwoFactorStep] = useState<TwoFactorStep>('status')
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupData | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [twoFactorAlert, setTwoFactorAlert] = useState<{ type: AlertType; msg: string } | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [backupCopied, setBackupCopied] = useState(false)

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        const u: Profile = d.user
        setProfile(u)
        setFullName(u.fullName ?? '')
        setPhone(formatBrazilPhone(u.phone ?? ''))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function showAlert(type: AlertType, msg: string, setter: typeof setAlert | typeof setPwAlert) {
    setter({ type, msg })
    setTimeout(() => setter(null), 4000)
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()

    if (phone && !PHONE_MASK_REGEX.test(phone)) {
      showAlert('error', 'Telefone inválido. Use o formato (XX) X XXXX-XXXX.', setAlert)
      return
    }

    setSaving(true)

    const r = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, phone: phone || null }),
    })

    const d = await r.json()
    setSaving(false)

    if (!r.ok) {
      showAlert('error', d.error ?? 'Erro ao salvar perfil', setAlert)
      return
    }

    setProfile((prev) => (prev ? { ...prev, ...d.user } : d.user))
    setPhone(formatBrazilPhone(d.user?.phone ?? phone))
    showAlert('success', 'Perfil atualizado com sucesso!', setAlert)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()

    if (newPw !== confirmPw) {
      showAlert('error', 'As senhas não conferem', setPwAlert)
      return
    }

    if (newPw.length < 8) {
      showAlert('error', 'A nova senha deve ter no mínimo 8 caracteres', setPwAlert)
      return
    }

    setSavingPw(true)

    const r = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    })

    const d = await r.json()
    setSavingPw(false)

    if (!r.ok) {
      showAlert('error', d.error ?? 'Erro ao alterar senha', setPwAlert)
      return
    }

    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    showAlert('success', 'Senha alterada com sucesso!', setPwAlert)
  }

  async function startTwoFactorSetup() {
    setTwoFactorLoading(true)
    setTwoFactorAlert(null)
    setTwoFactorCode('')

    try {
      const res = await fetch('/api/auth/2fa/setup')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.message ?? 'Não foi possível iniciar a configuração do 2FA.')
      }

      setTwoFactorSetup(data as TwoFactorSetupData)
      setTwoFactorStep('setup')
    } catch (error) {
      showAlert('error', error instanceof Error ? error.message : 'Falha ao iniciar configuração do 2FA.', setTwoFactorAlert)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  async function confirmTwoFactorSetup() {
    const code = formatTwoFactorCode(twoFactorCode)
    if (code.length !== 6) {
      showAlert('error', 'Digite um código válido de 6 dígitos.', setTwoFactorAlert)
      return
    }

    setTwoFactorLoading(true)
    setTwoFactorAlert(null)

    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp: code }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.message ?? 'Não foi possível ativar o 2FA.')
      }

      setProfile((prev) => (prev ? { ...prev, twoFactorEnabled: true } : prev))
      setBackupCodes(Array.isArray(data?.backupCodes) ? data.backupCodes : [])
      setTwoFactorCode('')
      setTwoFactorStep('backup-codes')
      showAlert('success', '2FA ativado com sucesso!', setTwoFactorAlert)
    } catch (error) {
      showAlert('error', error instanceof Error ? error.message : 'Falha ao validar código 2FA.', setTwoFactorAlert)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  async function disableTwoFactor() {
    const code = formatTwoFactorCode(twoFactorCode)
    if (code.length !== 6) {
      showAlert('error', 'Digite o código de 6 dígitos para desativar.', setTwoFactorAlert)
      return
    }

    setTwoFactorLoading(true)
    setTwoFactorAlert(null)

    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp: code }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.message ?? 'Não foi possível desativar o 2FA.')
      }

      setProfile((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev))
      setTwoFactorSetup(null)
      setTwoFactorCode('')
      setBackupCodes([])
      setTwoFactorStep('status')
      showAlert('success', data?.message ?? '2FA desativado com sucesso.', setTwoFactorAlert)
    } catch (error) {
      showAlert('error', error instanceof Error ? error.message : 'Falha ao desativar 2FA.', setTwoFactorAlert)
    } finally {
      setTwoFactorLoading(false)
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes.length) return

    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'))
      setBackupCopied(true)
      setTimeout(() => setBackupCopied(false), 2000)
    } catch {
      showAlert('error', 'Não foi possível copiar os códigos de recuperação.', setTwoFactorAlert)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-6xl items-center justify-center rounded-2xl border border-surface-200 bg-white text-sm text-surface-500 shadow-card">
        Carregando perfil...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-6xl items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 shadow-card">
        Não foi possível carregar o perfil.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <Card className="relative overflow-hidden border-surface-200">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary-600 to-cyan-500" />

        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-surface-200 bg-surface-100 text-surface-500">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.fullName} className="h-full w-full object-cover" />
              ) : (
                <Camera size={22} />
              )}
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-surface-900">{profile.fullName}</h1>
              <p className="text-sm font-medium text-surface-600">{profile.role ?? 'Usuário'}</p>
              <p className="text-xs text-surface-500">{profile.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-75">
            <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">Login</p>
              <p className="mt-1 text-sm font-semibold text-surface-800">{profile.login}</p>
            </div>

            <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">Segurança</p>
              <p className="mt-1 text-sm font-semibold text-surface-800">{profile.twoFactorEnabled ? '2FA ativo' : '2FA pendente'}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="h-fit">
          <div className="mb-4 flex items-center gap-2">
            <User size={18} className="text-primary-600" />
            <h2 className="font-semibold text-surface-900">Dados Pessoais</h2>
          </div>

          {alert && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                alert.type === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {alert.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {alert.msg}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-500">Nome completo *</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-500">E-mail</label>
                <input
                  disabled
                  value={profile.email}
                  className="w-full cursor-not-allowed rounded-xl border border-surface-100 bg-surface-50 px-3 py-2.5 text-sm text-surface-400"
                />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-500">
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> Telefone
                    </span>
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(formatBrazilPhone(e.target.value))}
                    className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="(00) 0 0000-0000"
                    inputMode="numeric"
                    maxLength={16}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </Card>

        <Card className="h-fit">
          <div className="mb-4 flex items-center gap-2">
            <Lock size={18} className="text-amber-500" />
            <h2 className="font-semibold text-surface-900">Alterar Senha</h2>
          </div>

          {pwAlert && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                pwAlert.type === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {pwAlert.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {pwAlert.msg}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-surface-500">Senha atual *</label>
              <input
                type="password"
                required
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-500">Nova senha *</label>
                <input
                  type="password"
                  required
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Mín. 8 caracteres"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-500">Confirmar senha *</label>
                <input
                  type="password"
                  required
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    confirmPw && confirmPw !== newPw ? 'border-red-400' : 'border-surface-200'
                  }`}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                />
                {confirmPw && confirmPw !== newPw && <p className="mt-1 text-xs text-red-500">As senhas não conferem</p>}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingPw}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {savingPw ? 'Alterando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </Card>
      </div>

      <Card className="border-surface-200">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-emerald-600" />
            <div>
              <h2 className="font-semibold text-surface-900">Autenticação em Dois Fatores (2FA)</h2>
              <p className="text-xs text-surface-500">Camada adicional de segurança com aplicativo autenticador e códigos de recuperação.</p>
            </div>
          </div>

          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              profile.twoFactorEnabled
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {profile.twoFactorEnabled ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
            {profile.twoFactorEnabled ? '2FA ativo' : '2FA pendente'}
          </span>
        </div>

        {twoFactorAlert && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
              twoFactorAlert.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {twoFactorAlert.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {twoFactorAlert.msg}
          </div>
        )}

        {twoFactorStep === 'status' && !profile.twoFactorEnabled && (
          <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
            <p className="text-sm text-surface-700">
              Para ativar o 2FA, você precisará de um autenticador compatível com TOTP, como Google Authenticator, Authy ou Microsoft Authenticator.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={twoFactorLoading}
                onClick={startTwoFactorSetup}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                <QrCode className="h-4 w-4" />
                {twoFactorLoading ? 'Iniciando...' : 'Iniciar configuração segura'}
              </button>
            </div>
          </div>
        )}

        {twoFactorStep === 'setup' && twoFactorSetup && (
          <div className="space-y-4 rounded-2xl border border-surface-200 bg-surface-50 p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-surface-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-500">Passo 1: escanear QR Code</p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={twoFactorSetup.qrDataUrl} alt="QR Code para ativação do 2FA" className="h-44 w-44 rounded-xl border border-surface-200 bg-white p-1" />
                </div>
                <p className="mt-3 text-xs text-surface-500">Se necessário, use a chave manual:</p>
                <p className="mt-1 rounded-lg bg-surface-100 px-2 py-1 font-mono text-[11px] text-surface-700 break-all">{twoFactorSetup.secret}</p>
              </div>

              <div className="rounded-xl border border-surface-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-500">Passo 2: confirmar código</p>
                <label className="mb-1.5 block text-xs font-medium text-surface-500">Código TOTP (6 dígitos)</label>
                <input
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(formatTwoFactorCode(e.target.value))}
                  className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-center font-mono text-lg tracking-[0.25em] focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                />
                <p className="mt-2 text-xs text-surface-500">O código muda a cada 30 segundos no seu aplicativo.</p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={twoFactorLoading}
                    onClick={() => {
                      setTwoFactorStep('status')
                      setTwoFactorCode('')
                      setTwoFactorSetup(null)
                    }}
                    className="rounded-xl border border-surface-300 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={twoFactorLoading || formatTwoFactorCode(twoFactorCode).length !== 6}
                    onClick={confirmTwoFactorSetup}
                    className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {twoFactorLoading ? 'Validando...' : 'Ativar 2FA'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {twoFactorStep === 'backup-codes' && (
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">2FA ativado com sucesso</p>
                <p className="text-xs text-emerald-700">Salve estes códigos de recuperação em local seguro. Eles são exibidos somente agora.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {backupCodes.map((code) => (
                <div key={code} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-center font-mono text-xs font-semibold text-emerald-800">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={copyBackupCodes}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-surface-300 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50"
              >
                {backupCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {backupCopied ? 'Códigos copiados' : 'Copiar códigos'}
              </button>
              <button
                type="button"
                onClick={() => setTwoFactorStep('status')}
                className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                Concluir
              </button>
            </div>
          </div>
        )}

        {twoFactorStep === 'status' && profile.twoFactorEnabled && (
          <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
            <p className="text-sm text-surface-700">
              O 2FA está ativo. Para desabilitar, confirme com um código atual do seu aplicativo autenticador.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-500">Código TOTP para desativar</label>
                <input
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(formatTwoFactorCode(e.target.value))}
                  className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-center font-mono text-lg tracking-[0.25em] focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
              <button
                type="button"
                disabled={twoFactorLoading || formatTwoFactorCode(twoFactorCode).length !== 6}
                onClick={disableTwoFactor}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                <ShieldOff className="h-4 w-4" />
                {twoFactorLoading ? 'Desativando...' : 'Desativar 2FA'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
