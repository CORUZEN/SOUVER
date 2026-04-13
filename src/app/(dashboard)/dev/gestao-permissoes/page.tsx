'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Lock, Shield } from 'lucide-react'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Skeleton'

interface PermissionOption {
  id: string
  module: string
  action: string
  code: string
  description: string | null
}
interface DevRoleData {
  id: string
  name: string
  code: string
  permissionCodes: string[]
}
interface DevUserData {
  id: string
  fullName: string
  login: string
  roleId: string | null
}
interface CurrentUser {
  id: string
  roleCode?: string | null
}

export default function GestaoPermissoesPage() {
  const [authLoaded, setAuthLoaded] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const [devRoles, setDevRoles] = useState<DevRoleData[]>([])
  const [devUsers, setDevUsers] = useState<DevUserData[]>([])
  const [permissions, setPermissions] = useState<PermissionOption[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedRolePermissionCodes, setSelectedRolePermissionCodes] = useState<string[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUserRoleId, setSelectedUserRoleId] = useState('')
  const [hasAdministrationGroup, setHasAdministrationGroup] = useState(false)
  const [permMessage, setPermMessage] = useState<string | null>(null)
  const [savingRolePermissions, setSavingRolePermissions] = useState(false)
  const [savingUserRole, setSavingUserRole] = useState(false)
  const [creatingAdminGroup, setCreatingAdminGroup] = useState(false)

  const isDeveloper = currentUser?.roleCode === 'DEVELOPER'

  const fetchPermissionsPanel = useCallback(async () => {
    if (!isDeveloper) return
    const r = await fetch('/api/dev/permissions')
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.message ?? 'Erro ao carregar painel de permissões.')

    setDevRoles(d.roles ?? [])
    setDevUsers(d.users ?? [])
    setPermissions(d.permissions ?? [])
    setHasAdministrationGroup(Boolean(d.hasAdministrationGroup))

    if (!selectedRoleId && d.roles?.length) {
      const role = d.roles.find((it: DevRoleData) => it.code !== 'DEVELOPER') ?? d.roles[0]
      setSelectedRoleId(role.id)
      setSelectedRolePermissionCodes(role.permissionCodes ?? [])
    }

    if (!selectedUserId && d.users?.length) {
      setSelectedUserId(d.users[0].id)
      setSelectedUserRoleId(d.users[0].roleId ?? '')
    }
  }, [isDeveloper, selectedRoleId, selectedUserId])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setCurrentUser({ id: d.user.id, roleCode: d.user.roleCode ?? null })
      })
      .finally(() => setAuthLoaded(true))
  }, [])

  useEffect(() => {
    if (isDeveloper) {
      fetchPermissionsPanel().catch((e) => setPermMessage((e as Error).message))
    }
  }, [fetchPermissionsPanel, isDeveloper])

  const selectedRoleData = useMemo(() => devRoles.find((r) => r.id === selectedRoleId) ?? null, [devRoles, selectedRoleId])

  const groupedPermissions = useMemo(() => {
    const map: Record<string, PermissionOption[]> = {}
    permissions.forEach((p) => {
      if (!map[p.module]) map[p.module] = []
      map[p.module].push(p)
    })
    return map
  }, [permissions])

  useEffect(() => {
    if (selectedRoleData) setSelectedRolePermissionCodes(selectedRoleData.permissionCodes ?? [])
  }, [selectedRoleData])

  useEffect(() => {
    const user = devUsers.find((it) => it.id === selectedUserId)
    setSelectedUserRoleId(user?.roleId ?? '')
  }, [devUsers, selectedUserId])

  async function createAdministrationGroup() {
    setCreatingAdminGroup(true)
    try {
      const r = await fetch('/api/dev/permissions', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? 'Falha ao criar grupo Administração.')
      setPermMessage(d.message ?? 'Grupo Administração criado com sucesso.')
      await fetchPermissionsPanel()
    } catch (e) {
      setPermMessage(e instanceof Error ? e.message : 'Falha ao criar grupo.')
    } finally {
      setCreatingAdminGroup(false)
    }
  }

  async function saveRolePermissions() {
    if (!selectedRoleId) return
    setSavingRolePermissions(true)
    try {
      const r = await fetch(`/api/dev/permissions/role/${selectedRoleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionCodes: selectedRolePermissionCodes }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? 'Falha ao salvar permissões do grupo.')
      setPermMessage('Permissões do grupo atualizadas com sucesso.')
      await fetchPermissionsPanel()
    } catch (e) {
      setPermMessage(e instanceof Error ? e.message : 'Falha ao salvar permissões.')
    } finally {
      setSavingRolePermissions(false)
    }
  }

  async function saveUserGroup() {
    if (!selectedUserId) return
    setSavingUserRole(true)
    try {
      const r = await fetch(`/api/users/${selectedUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: selectedUserRoleId || null }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? 'Falha ao salvar grupo do usuário.')
      setPermMessage('Grupo de permissões do usuário atualizado.')
      await fetchPermissionsPanel()
    } catch (e) {
      setPermMessage(e instanceof Error ? e.message : 'Falha ao salvar grupo do usuário.')
    } finally {
      setSavingUserRole(false)
    }
  }

  if (!authLoaded) return <div className="flex items-center gap-2 text-sm text-surface-500"><Spinner />Validando acesso Dev...</div>

  if (!isDeveloper) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-2 text-red-700"><Lock className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold">Acesso restrito</h1>
            <p className="mt-1 text-sm text-surface-600">Esta página Dev é exclusiva do usuário Desenvolvedor.</p>
          </div>
        </div>
      </div>
    )
  }

  const groupedRoleOptions = [{ value: '', label: 'Sem grupo' }, ...devRoles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Gestão de Permissões</h1>
          <p className="text-sm text-surface-500">Definição de acessos por grupo e por usuário.</p>
        </div>
        <Link href="/dev">
          <Button variant="outline"><ArrowLeft className="h-4 w-4" />Voltar para Central</Button>
        </Link>
      </div>

      <div className="rounded-xl border border-surface-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Painel de Permissões</h2>
            <p className="text-sm text-surface-600">Ajuste permissões por grupo e por usuário.</p>
          </div>
          {!hasAdministrationGroup && <Button variant="outline" onClick={createAdministrationGroup} loading={creatingAdminGroup}>Criar grupo Administração</Button>}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Grupo Administração não acessa esta página Dev. Esta página é exclusiva do Desenvolvedor.
        </div>

        {permMessage && <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm">{permMessage}</div>}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-surface-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Permissões por grupo</h3>
              <Select options={devRoles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))} value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} className="w-72" />
            </div>
            <div className="max-h-90 space-y-3 overflow-y-auto rounded-lg border border-surface-200 p-3">
              {Object.entries(groupedPermissions).map(([module, list]) => (
                <div key={module} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">{module}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((p) => (
                      <label key={p.code} className="flex items-start gap-2 rounded border border-surface-200 px-2 py-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedRolePermissionCodes.includes(p.code)}
                          onChange={() => setSelectedRolePermissionCodes((prev) => prev.includes(p.code) ? prev.filter((x) => x !== p.code) : [...prev, p.code])}
                          disabled={selectedRoleData?.code === 'DEVELOPER'}
                          className="mt-0.5 h-4 w-4"
                        />
                        <span><strong>{p.code}</strong><span className="block text-surface-500">{p.description ?? 'Sem descrição'}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={saveRolePermissions} loading={savingRolePermissions} disabled={!selectedRoleId || selectedRoleData?.code === 'DEVELOPER'}>
                Salvar permissões do grupo
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-surface-200 p-4">
            <h3 className="text-sm font-semibold">Permissões por usuário</h3>
            <p className="text-xs text-surface-500">Defina qual grupo de permissões o usuário vai usar.</p>
            <Select label="Usuário" options={devUsers.map((u) => ({ value: u.id, label: `${u.fullName} (${u.login})` }))} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} />
            <Select label="Grupo de permissões" options={groupedRoleOptions} value={selectedUserRoleId} onChange={(e) => setSelectedUserRoleId(e.target.value)} />
            <div className="flex justify-end">
              <Button onClick={saveUserGroup} loading={savingUserRole} disabled={!selectedUserId}>Salvar grupo do usuário</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600">
        <p className="inline-flex items-center gap-2 font-medium text-surface-700">
          <Shield className="h-4 w-4" />
          Gestão de permissões em ambiente crítico: revise antes de salvar.
        </p>
      </div>
    </div>
  )
}
