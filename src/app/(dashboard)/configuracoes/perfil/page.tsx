'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, Phone, Image as ImageIcon, ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface Profile {
  id:               string
  fullName:         string
  email:            string
  login:            string
  phone:            string | null
  avatarUrl:        string | null
  twoFactorEnabled: boolean
  role:             string | null
  department:       string | null
}

type AlertType = 'success' | 'error' | null

export default function PerfilPage() {
  const router = useRouter()

  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [alert,    setAlert]    = useState<{ type: AlertType; msg: string } | null>(null)

  // Campos de perfil
  const [fullName,  setFullName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  // Campos de senha
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [savingPw,   setSavingPw]   = useState(false)
  const [pwAlert,    setPwAlert]    = useState<{ type: AlertType; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/users/me')
      .then(r => r.json())
      .then(d => {
        const u: Profile = d.user
        setProfile(u)
        setFullName(u.fullName ?? '')
        setPhone(u.phone ?? '')
        setAvatarUrl(u.avatarUrl ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function showAlert(type: AlertType, msg: string, setter: typeof setAlert) {
    setter({ type, msg })
    setTimeout(() => setter(null), 4000)
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const r = await fetch('/api/users/me', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fullName, phone: phone || null, avatarUrl: avatarUrl || null }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) {
      showAlert('error', d.error ?? 'Erro ao salvar perfil', setAlert)
    } else {
      setProfile(d.user)
      showAlert('success', 'Perfil atualizado com sucesso!', setAlert)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) {
      showAlert('error', 'As senhas não conferem', setPwAlert)
      return
    }
    if (newPw.length < 8) {
      showAlert('error', 'Nova senha deve ter no mínimo 8 caracteres', setPwAlert)
      return
    }
    setSavingPw(true)
    const r = await fetch('/api/users/me', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    })
    const d = await r.json()
    setSavingPw(false)
    if (!r.ok) {
      showAlert('error', d.error ?? 'Erro ao alterar senha', setPwAlert)
    } else {
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      showAlert('success', 'Senha alterada com sucesso!', setPwAlert)
    }
  }

  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400 text-sm">
        Carregando perfil…
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">
        Não foi possível carregar o perfil.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/configuracoes')}
        className="flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 transition-colors"
      >
        <ChevronLeft size={15} /> Configurações
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand-500 text-white flex items-center justify-center text-xl font-bold overflow-hidden shrink-0">
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
            : initials(profile.fullName)}
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-900">{profile.fullName}</h1>
          <p className="text-sm text-surface-500">
            {profile.role ?? 'Usuário'}
            {profile.department ? ` · ${profile.department}` : ''}
          </p>
          <p className="text-xs text-surface-400 mt-0.5">{profile.email}</p>
        </div>
      </div>

      {/* Card dados pessoais */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-brand-500" />
          <h2 className="font-semibold text-surface-900">Dados Pessoais</h2>
        </div>

        {alert && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            alert.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {alert.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {alert.msg}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">
                Nome completo *
              </label>
              <input
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">Email</label>
              <input
                disabled
                value={profile.email}
                className="w-full border border-surface-100 rounded-xl px-3 py-2.5 text-sm bg-surface-50 text-surface-400 cursor-not-allowed"
              />
              <p className="text-xs text-surface-400 mt-1">Email não pode ser alterado.</p>
            </div>

            <div>
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">
                <span className="flex items-center gap-1"><Phone size={12} /> Telefone</span>
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">
                <span className="flex items-center gap-1"><ImageIcon size={12} /> URL do avatar</span>
              </label>
              <input
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="https://exemplo.com/foto.jpg"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Card>

      {/* Card alterar senha */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={18} className="text-amber-500" />
          <h2 className="font-semibold text-surface-900">Alterar Senha</h2>
        </div>

        {pwAlert && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            pwAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {pwAlert.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {pwAlert.msg}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs text-surface-500 mb-1.5 font-medium">Senha atual *</label>
            <input
              type="password"
              required
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">Nova senha *</label>
              <input
                type="password"
                required
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="w-full border border-surface-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Mín. 8 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-500 mb-1.5 font-medium">Confirmar senha *</label>
              <input
                type="password"
                required
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  confirmPw && confirmPw !== newPw ? 'border-red-400' : 'border-surface-200'
                }`}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
              {confirmPw && confirmPw !== newPw && (
                <p className="text-xs text-red-500 mt-1">As senhas não conferem</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPw}
              className="px-5 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {savingPw ? 'Alterando…' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
