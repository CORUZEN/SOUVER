'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Eye, Lock, LogIn, Pencil, Plus, RefreshCw, Search, Trash2, UserCheck, UserX, Users, ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { ErrorState, Spinner } from '@/components/ui/Skeleton'
import { clearAuthMeCache } from '@/lib/client/auth-me-cache'

interface UserRow {
  id: string
  fullName: string
  email: string
  login: string
  isActive: boolean
  lastLoginAt: string | null
  sellerCode: string | null
  role: { id: string; name: string; code: string } | null
  department: { id: string; name: string; code: string } | null
}
interface RoleOption { id: string; name: string; code: string }
interface DeptOption { id: string; name: string; code: string }
interface CurrentUser { id: string; roleCode?: string | null }
interface UserFormData {
  fullName: string
  login: string
  email: string
  phone: string
  password: string
  departmentId: string
  roleId: string
  sellerCode: string
  isActive: boolean
}

const EMPTY_FORM: UserFormData = {
  fullName: '',
  login: '',
  email: '',
  phone: '',
  password: '',
  departmentId: '',
  roleId: '',
  sellerCode: '',
  isActive: true,
}

export default function GestaoUsuariosPage() {
  const pathname = usePathname()
  const [authLoaded, setAuthLoaded] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [departments, setDepartments] = useState<DeptOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmType, setConfirmType] = useState<'save' | 'toggle' | 'delete' | 'impersonate'>('save')
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null)
  const [confirming, setConfirming] = useState(false)

  const [supervisorSellers, setSupervisorSellers] = useState<{ code: string; name: string }[]>([])
  const [sellerOptions, setSellerOptions] = useState<{ code: string; name: string }[]>([])

  const canManageUsers = currentUser?.roleCode === 'DEVELOPER' || currentUser?.roleCode === 'IT_ANALYST'
  const isDeveloper = currentUser?.roleCode === 'DEVELOPER'
  const basePath = pathname?.startsWith('/controle') ? '/controle' : '/dev'

  const fetchUsers = useCallback(async () => {
    if (!canManageUsers) return
    setLoadingUsers(true)
    setUsersError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(filterRole ? { roleId: filterRole } : {}),
        ...(filterDept ? { departmentId: filterDept } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
      })
      const r = await fetch(`/api/users?${params}`)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? 'Erro ao carregar usuários.')
      setUsers(d.users ?? [])
      setTotal(d.total ?? 0)
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Erro desconhecido.')
    } finally {
      setLoadingUsers(false)
    }
  }, [canManageUsers, isDeveloper, page, search, filterRole, filterDept, filterStatus])

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setCurrentUser({ id: d.user.id, roleCode: d.user.roleCode ?? null })
      })
      .finally(() => setAuthLoaded(true))
  }, [])

  useEffect(() => {
    if (!canManageUsers) return
    Promise.all([fetch('/api/roles'), fetch('/api/departments')])
      .then(([r1, r2]) => Promise.all([r1.json(), r2.json()]))
      .then(([d1, d2]) => {
        const allRoles = (d1.roles ?? []) as RoleOption[]
        setRoles(isDeveloper ? allRoles : allRoles.filter((r) => r.code !== 'DEVELOPER'))
        setDepartments(d2.departments ?? [])
      })
      .catch(() => null)
  }, [isDeveloper])

  useEffect(() => {
    if (!canManageUsers) return
    fetch('/api/metas/sellers-allowlist')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list: Array<{ code?: string | null; name: string; profileType?: string; active?: boolean }> = d?.sellers ?? d?.list ?? []
        const activeOnly = list.filter((s) => s.active !== false && s.code)
        const supervisors = list
          .filter((s) => s.profileType === 'SUPERVISOR' && s.code && s.active !== false)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => ({ code: String(s.code!), name: s.name }))
        const sellers = activeOnly
          .filter((s) => s.profileType !== 'SUPERVISOR')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => ({ code: String(s.code!), name: s.name }))
        setSupervisorSellers(supervisors)
        setSellerOptions(sellers)
      })
      .catch(() => null)
  }, [isDeveloper])

  useEffect(() => {
    if (canManageUsers) fetchUsers()
  }, [fetchUsers, canManageUsers])

  useEffect(() => {
    setPage(1)
  }, [search, filterRole, filterDept, filterStatus])

  const selectedRole = useMemo(() => roles.find((r) => r.id === form.roleId) ?? null, [roles, form.roleId])
  const isSalesSupervisor = selectedRole?.code === 'SALES_SUPERVISOR'
  const isSellerRole = selectedRole?.code === 'SELLER'
  const comercialDept = useMemo(() => departments.find((d) => d.name.toLowerCase().includes('comercial') || d.code?.toLowerCase().includes('comercial')) ?? null, [departments])

  function handleRoleChange(roleId: string) {
    const role = roles.find((r) => r.id === roleId) ?? null
    const updates: Partial<UserFormData> = { roleId }
    if (role?.code === 'SALES_SUPERVISOR' || role?.code === 'SELLER') {
      if (comercialDept) updates.departmentId = comercialDept.id
      // Clear sellerCode so user explicitly picks the linked seller/supervisor.
      updates.sellerCode = ''
    }
    setForm((p) => ({ ...p, ...updates }))
  }

  function openCreate() {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(user: UserRow) {
    setEditingUser(user)
    setForm({
      fullName: user.fullName,
      login: user.login,
      email: user.email,
      phone: '',
      password: '',
      departmentId: user.department?.id ?? '',
      roleId: user.role?.id ?? '',
      sellerCode: user.sellerCode ?? '',
      isActive: user.isActive,
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function saveUser() {
    setSaving(true)
    try {
      if (!form.fullName.trim() || !form.login.trim() || !form.email.trim()) throw new Error('Preencha nome, login e e-mail.')
      if (!editingUser && !form.password.trim()) throw new Error('Senha obrigatória para novo usuário.')
      const selectedRoleCode = selectedRole?.code ?? ''
      if ((selectedRoleCode === 'SALES_SUPERVISOR' || selectedRoleCode === 'SELLER') && !form.sellerCode.trim()) {
        throw new Error(selectedRoleCode === 'SELLER'
          ? 'Selecione o vendedor vinculado para este usuário.'
          : 'Selecione o supervisor vinculado para este usuário.')
      }
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        login: form.login,
        email: form.email,
        phone: form.phone || null,
        roleId: form.roleId || null,
        departmentId: form.departmentId || null,
        sellerCode: form.sellerCode.trim() || null,
      }
      if (form.password) payload.password = form.password
      if (editingUser) payload.isActive = form.isActive
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message ?? 'Falha ao salvar usuário.')
      setModalOpen(false)
      setConfirmOpen(false)
      await fetchUsers()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar usuário.')
    } finally {
      setSaving(false)
    }
  }

  async function doToggle(user: UserRow) {
    const r = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.message ?? 'Falha ao alterar status.')
  }

  async function doDelete(user: UserRow) {
    const r = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.message ?? 'Falha ao excluir usuário.')
  }

  async function doImpersonate(user: UserRow) {
    const r = await fetch('/api/auth/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.message ?? 'Falha ao locar como usuário.')
    clearAuthMeCache()
    window.location.href = '/'
  }

  async function confirmAction() {
    if (confirmType === 'save') return saveUser()
    if (!confirmUser) return
    setConfirming(true)
    try {
      if (confirmType === 'toggle') await doToggle(confirmUser)
      if (confirmType === 'delete') await doDelete(confirmUser)
      if (confirmType === 'impersonate') await doImpersonate(confirmUser)
      setConfirmOpen(false)
      await fetchUsers()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Falha na ação.')
    } finally {
      setConfirming(false)
    }
  }

  const columns: Column<UserRow>[] = [
    { key: 'fullName', header: 'Usuário', render: (_, row) => <span className="text-sm font-medium">{row.fullName}</span> },
    { key: 'email', header: 'E-mail', render: (v) => <span className="text-xs text-surface-600">{String(v)}</span> },
    { key: 'role', header: 'Cargo', render: (_, row) => row.role ? <Badge variant="secondary">{row.role.name}</Badge> : <span className="text-xs text-surface-400">Sem cargo</span> },
    { key: 'department', header: 'Departamento', render: (_, row) => <span className="text-xs">{row.department?.name ?? '-'}</span> },
    { key: 'isActive', header: 'Status', render: (_, row) => <Badge variant={row.isActive ? 'success' : 'error'}>{row.isActive ? 'Ativo' : 'Inativo'}</Badge> },
    { key: 'lastLoginAt', header: 'Último acesso', render: (v) => <span className="text-xs">{v ? new Date(String(v)).toLocaleString('pt-BR') : 'Nunca'}</span> },
    {
      key: 'id',
      header: 'Ações',
      render: (_, row) => {
        const self = row.id === currentUser?.id
        const isDevTarget = row.role?.code === 'DEVELOPER'

        // Analista de TI não pode interagir com usuários Desenvolvedor
        if (!isDeveloper && isDevTarget) {
          return <span className="text-[11px] text-surface-400">—</span>
        }

        return (
          <div className="flex items-center gap-1">
            <button className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-surface-100" title="Ver perfil"><Eye className="h-3.5 w-3.5" /></button>
            <button onClick={() => openEdit(row)} className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-surface-100" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
            {!self && isDeveloper && <button onClick={() => { setConfirmUser(row); setConfirmType('impersonate'); setConfirmOpen(true) }} className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-surface-100" title="Locar como"><LogIn className="h-3.5 w-3.5" /></button>}
            <button onClick={() => { setConfirmUser(row); setConfirmType('toggle'); setConfirmOpen(true) }} className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-surface-100" title="Ativar ou desativar">{row.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}</button>
            {isDeveloper && !self && <button onClick={() => { setConfirmUser(row); setConfirmType('delete'); setConfirmOpen(true) }} className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-surface-100" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        )
      },
    },
  ]

  if (!authLoaded) return <div className="flex items-center gap-2 text-sm text-surface-500"><Spinner />Validando acesso...</div>

  if (!canManageUsers) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-2 text-red-700"><Lock className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-semibold">Acesso restrito</h1>
            <p className="mt-1 text-sm text-surface-600">Esta área é exclusiva para administradores de usuários.</p>
          </div>
        </div>
      </div>
    )
  }

  const roleSelectOptions = [{ value: '', label: 'Todos os cargos' }, ...roles.map((r) => ({ value: r.id, label: r.name }))]
  const deptSelectOptions = [{ value: '', label: 'Todos os departamentos' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]
  const roleFormOptions = [{ value: '', label: 'Sem cargo' }, ...roles.map((r) => ({ value: r.id, label: r.name }))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Governança de Identidades</h1>
          <p className="text-sm text-surface-500">Operação central para cadastro, manutenção e ciclo de vida das contas corporativas.</p>
          <p className="mt-1 text-xs text-surface-500">{total} {total === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={basePath}>
            <Button variant="outline"><ArrowLeft className="h-4 w-4" />Voltar para Central</Button>
          </Link>
          <Button onClick={openCreate}><Plus className="h-4 w-4" />Novo usuário</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 max-w-80 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, login ou e-mail..." className="h-10 w-full rounded-lg border border-surface-300 pl-9 pr-3 text-sm" />
        </div>
        <Select options={roleSelectOptions} value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-48" />
        <Select options={deptSelectOptions} value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="w-52" />
        <Select options={[{ value: '', label: 'Todos os status' }, { value: 'active', label: 'Ativos' }, { value: 'inactive', label: 'Inativos' }]} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-40" />
        <button onClick={fetchUsers} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-surface-300"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {usersError ? (
        <ErrorState title="Erro ao carregar usuários" description={usersError} onRetry={fetchUsers} />
      ) : (
        <Table<UserRow> columns={columns} data={users} rowKey={(r) => r.id} isLoading={loadingUsers} emptyMessage="Nenhum usuário encontrado." emptyIcon={<Users className="h-10 w-10" />} totalCount={total} page={page} pageSize={20} onPageChange={setPage} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingUser ? 'Editar usuário' : 'Cadastrar novo usuário'}
        description={editingUser ? `Editando ${editingUser.fullName}` : 'Defina os dados para criar o usuário.'}
        size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button><Button onClick={() => { setConfirmType('save'); setConfirmOpen(true) }} loading={saving}>{editingUser ? 'Salvar alterações' : 'Cadastrar usuário'}</Button></>}
      >
        <div className="space-y-4">
          {formError && <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">{formError}</div>}
          <Input label="Nome completo" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Ex.: João da Silva" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Login" value={form.login} onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))} placeholder="joao.silva" required />
            <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="joao@empresa.com" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Telefone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            <Input label={editingUser ? 'Nova senha (opcional)' : 'Senha'} type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Mínimo 8 caracteres" required={!editingUser} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Cargo" value={form.roleId} onChange={(e) => handleRoleChange(e.target.value)} options={roleFormOptions} />
            <Select label="Departamento" value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))} options={[{ value: '', label: 'Sem departamento' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
          </div>
          {isSalesSupervisor && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">
                Supervisor de vendas <span className="text-error-500">*</span>
              </label>
              {supervisorSellers.length > 0 ? (
                <select
                  value={form.sellerCode}
                  onChange={(e) => setForm((p) => ({ ...p, sellerCode: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Selecione o supervisor...</option>
                  {supervisorSellers.map((s) => (
                    <option key={s.code} value={s.code}>{s.name} — código {s.code}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.sellerCode}
                  onChange={(e) => setForm((p) => ({ ...p, sellerCode: e.target.value }))}
                  placeholder="Código do supervisor na allowlist (ex.: 15)"
                  className="h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}
              <p className="text-xs text-surface-500">
                Define quais vendedores este usuário poderá ver no Painel de Metas.
              </p>
            </div>
          )}
          {isSellerRole && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">
                Vendedor vinculado <span className="text-error-500">*</span>
              </label>
              {sellerOptions.length > 0 ? (
                <select
                  value={form.sellerCode}
                  onChange={(e) => setForm((p) => ({ ...p, sellerCode: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Selecione o vendedor...</option>
                  {sellerOptions.map((s) => (
                    <option key={s.code} value={s.code}>{s.name} — código {s.code}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.sellerCode}
                  onChange={(e) => setForm((p) => ({ ...p, sellerCode: e.target.value }))}
                  placeholder="Código do vendedor na allowlist (ex.: 34)"
                  className="h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}
              <p className="text-xs text-surface-500">
                O vendedor verá somente os próprios dados no painel PWA.
              </p>
            </div>
          )}
          <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm">{selectedRole ? `Cargo selecionado: ${selectedRole.name}` : 'Sem cargo definido.'}</div>
          {editingUser && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4" />Usuário ativo</label>}
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => !confirming && setConfirmOpen(false)}
        title="Confirmação crítica"
        description="Esta ação pode impactar dados e acessos."
        size="sm"
        footer={<><Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={confirming}>Cancelar</Button><Button variant={confirmType === 'delete' ? 'danger' : 'primary'} onClick={confirmAction} loading={confirming}>{confirmType === 'delete' ? 'Excluir' : 'Confirmar'}</Button></>}
      >
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-800">
            {confirmType === 'save' && 'Confirme para salvar os dados do usuário.'}
            {confirmType === 'toggle' && `Confirme para alterar o status de ${confirmUser?.fullName ?? 'usuário'}.`}
            {confirmType === 'delete' && `Confirme para excluir ${confirmUser?.fullName ?? 'usuário'}.`}
            {confirmType === 'impersonate' && `Confirme para locar como ${confirmUser?.fullName ?? 'usuário'}.`}
          </p>
        </div>
      </Modal>
    </div>
  )
}
