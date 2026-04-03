'use client'

import { useState, useEffect } from 'react'
import { User, Lock, Phone, Camera, CheckCircle, AlertCircle } from 'lucide-react'
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

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<{ type: AlertType; msg: string } | null>(null)

  // Campos de perfil
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Campos de senha
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwAlert, setPwAlert] = useState<{ type: AlertType; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        const u: Profile = d.user
        setProfile(u)
        setFullName(u.fullName ?? '')
        setPhone(u.phone ?? '')
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-surface-400">
        Carregando perfil...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-red-500">
        Não foi possível carregar o perfil.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-surface-200 bg-surface-100 text-surface-500">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.fullName} className="h-full w-full object-cover" />
          ) : (
            <Camera size={24} />
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-900">{profile.fullName}</h1>
          <p className="text-sm text-surface-500">{profile.role ?? 'Usuário'}</p>
          <p className="mt-0.5 text-xs text-surface-400">{profile.email}</p>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <User size={18} className="text-brand-500" />
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

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-surface-500">Nome completo *</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-surface-500">E-mail</label>
              <input
                disabled
                value={profile.email}
                className="w-full cursor-not-allowed rounded-xl border border-surface-100 bg-surface-50 px-3 py-2.5 text-sm text-surface-400"
              />
              <p className="mt-1 text-xs text-surface-400">E-mail não pode ser alterado.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-surface-500">
                <span className="flex items-center gap-1">
                  <Phone size={12} /> Telefone
                </span>
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Card>

      <Card>
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

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-surface-500">Senha atual *</label>
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-surface-500">Nova senha *</label>
              <input
                type="password"
                required
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  confirmPw && confirmPw !== newPw ? 'border-red-400' : 'border-surface-200'
                }`}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
              {confirmPw && confirmPw !== newPw && <p className="mt-1 text-xs text-red-500">As senhas não conferem</p>}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPw}
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {savingPw ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
