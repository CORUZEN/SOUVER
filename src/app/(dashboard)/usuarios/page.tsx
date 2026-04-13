'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users,
  Plus,
  Pencil,
  UserX,
  UserCheck,
  Search,
  RefreshCw,
  Eye,
  X,
  ShieldCheck,
  Clock,
  KeyRound,
  LogIn,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { ErrorState, Spinner } from '@/components/ui/Skeleton'
import { cn, formatDateTime } from '@/lib/utils'

interface UserRow {
  id: string
  fullName: string
  email: string
  login: string
  phone: string | null
  isActive: boolean
  status: string
  twoFactorEnabled: boolean
  lastLoginAt: string | null
  createdAt: string
  role: { id: string; name: string; code: string } | null
  department: { id: string; name: string; code: string } | null
}

interface RoleOption {
  id: string
  name: string
  code: string
}

interface DeptOption {
  id: string
  name: string
  code: string
}

interface CurrentUser {
  id: string
  roleCode?: string | null
}

interface UserFormData {
  fullName: string
  login: string
  email: string
  phone: string
  password: string
  departmentId: string
  roleId: string
  isActive: boolean
  status: string
}

interface ConfirmActionState {
  open: boolean
  type: 'toggle' | 'delete' | 'impersonate' | 'save'
  user: UserRow | null
}

interface AuditEntry {
  id: string
  action: string
  module: string
  description: string | null
  createdAt: string
  ipAddress: string | null
}

const EMPTY_FORM: UserFormData = {
  fullName: '',
  login: '',
  email: '',
  phone: '',
  password: '',
  departmentId: '',
  roleId: '',
  isActive: true,
  status: 'ACTIVE',
}

const PAGE_SIZE = 20
const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
]

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length <= 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function UsuariosPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [roles, setRoles] = useState<RoleOption[]>([])
  const [departments, setDepartments] = useState<DeptOption[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>({
    open: false,
    type: 'toggle',
    user: null,
  })
  const [isConfirming, setIsConfirming] = useState(false)

  const [profileUser, setProfileUser] = useState<UserRow | null>(null)
  const [profileLogs, setProfileLogs] = useState<AuditEntry[]>([])
  const [loadingProfile, setLoadingProfile] = useState(false)

  const canUseDevActions = currentUser?.roleCode === 'DEVELOPER'

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(search && { search }),
        ...(filterRole && { roleId: filterRole }),
        ...(filterDept && { departmentId: filterDept }),
        ...(filterStatus && { status: filterStatus }),
      })

      const res = await fetch(`/api/users?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? 'Erro ao carregar usuários.')
      }

      const data = await res.json()
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Erro desconhecido.')
    } finally {
      setIsLoading(false)
    }
  }, [page, search, filterRole, filterDept, filterStatus])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser({
            id: data.user.id,
            roleCode: data.user.roleCode ?? null,
          })
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    Promise.all([fetch('/api/roles'), fetch('/api/departments')])
      .then(([r, d]) => Promise.all([r.json(), d.json()]))
      .then(([rolesData, deptData]) => {
        setRoles(rolesData.roles ?? [])
        setDepartments(deptData.departments ?? [])
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    setPage(1)
  }, [search, filterRole, filterDept, filterStatus])

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === form.roleId) ?? null,
    [roles, form.roleId]
  )

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
      phone: user.phone ?? '',
      password: '',
      departmentId: user.department?.id ?? '',
      roleId: user.role?.id ?? '',
      isActive: user.isActive,
      status: user.status,
    })
    setFormError(null)
    setModalOpen(true)
  }

  function updateForm(field: keyof UserFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function requestSave() {
    setFormError(null)
    if (!form.fullName.trim()) return setFormError('Nome completo é obrigatório.')
    if (!form.login.trim()) return setFormError('Login é obrigatório.')
    if (!form.email.trim()) return setFormError('E-mail é obrigatório.')
    if (!editingUser && !form.password.trim()) return setFormError('Senha é obrigatória para novos usuários.')

    setConfirmAction({ open: true, type: 'save', user: editingUser })
  }

  async function executeSave() {
    setIsConfirming(true)
    setIsSaving(true)

    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        login: form.login,
        email: form.email,
        phone: form.phone || null,
        departmentId: form.departmentId || null,
        roleId: form.roleId || null,
      }

      if (form.password) payload.password = form.password

      if (editingUser) {
        payload.isActive = form.isActive
        payload.status = form.status
      }

      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFormError(result.message ?? 'Erro ao salvar usuário.')
        return
      }

      setModalOpen(false)
      setConfirmAction({ open: false, type: 'save', user: null })
      await fetchUsers()
    } catch {
      setFormError('Erro inesperado ao salvar usuário.')
    } finally {
      setIsConfirming(false)
      setIsSaving(false)
    }
  }

  async function executeToggleStatus(user: UserRow) {
    const response = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message ?? 'Não foi possível alterar o status do usuário.')
    }
  }

  async function executeDelete(user: UserRow) {
    const response = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message ?? 'Não foi possível excluir o usuário.')
    }
  }

  async function executeImpersonate(user: UserRow) {
    const response = await fetch('/api/auth/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message ?? 'Não foi possível locar como este usuário.')
    }

    window.location.href = '/'
  }

  async function handleConfirmAction() {
    if (!confirmAction.user && confirmAction.type !== 'save') return

    setIsConfirming(true)
    try {
      if (confirmAction.type === 'save') {
        await executeSave()
        return
      }

      if (confirmAction.type === 'toggle' && confirmAction.user) {
        await executeToggleStatus(confirmAction.user)
      }

      if (confirmAction.type === 'delete' && confirmAction.user) {
        await executeDelete(confirmAction.user)
      }

      if (confirmAction.type === 'impersonate' && confirmAction.user) {
        await executeImpersonate(confirmAction.user)
        return
      }

      setConfirmAction({ open: false, type: 'toggle', user: null })
      await fetchUsers()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'A ação falhou.')
    } finally {
      setIsConfirming(false)
    }
  }

  async function openProfile(user: UserRow) {
    setProfileUser(user)
    setProfileLogs([])
    setLoadingProfile(true)

    try {
      const res = await fetch(`/api/audit?userId=${user.id}&limit=10`)
      if (res.ok) {
        const json = await res.json()
        setProfileLogs(json.logs ?? [])
      }
    } catch {
      setProfileLogs([])
    } finally {
      setLoadingProfile(false)
    }
  }

  const columns: Column<UserRow>[] = [
    {
      key: 'fullName',
      header: 'Usuário',
      sortable: true,
      render(_, row) {
        return (
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
              {getInitials(row.fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-surface-900">{row.fullName}</p>
              <p className="truncate text-xs text-surface-400">{row.login}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'email',
      header: 'E-mail',
      render: (val) => <span className="text-xs text-surface-600">{String(val)}</span>,
    },
    {
      key: 'role',
      header: 'Cargo',
      render(_, row) {
        if (!row.role) return <span className="text-xs text-surface-400 italic">Sem cargo</span>
        return <Badge variant="secondary">{row.role.name}</Badge>
      },
    },
    {
      key: 'role.code',
      header: 'Grupo de permissões',
      render(_, row) {
        if (!row.role?.code) return <span className="text-xs text-surface-400">—</span>
        return <span className="text-xs font-semibold text-surface-700">{row.role.code}</span>
      },
    },
    {
      key: 'department',
      header: 'Departamento',
      render(_, row) {
        return <span className="text-xs text-surface-600">{row.department?.name ?? '—'}</span>
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      render(_, row) {
        return <Badge variant={row.isActive ? 'success' : 'error'}>{row.isActive ? 'Ativo' : 'Inativo'}</Badge>
      },
    },
    {
      key: 'lastLoginAt',
      header: 'Último acesso',
      render: (val) =>
        val ? (
          <span className="text-xs text-surface-500">{formatDateTime(String(val))}</span>
        ) : (
          <span className="text-xs text-surface-400">Nunca</span>
        ),
    },
    {
      key: 'id',
      header: 'Ações',
      width: 'w-44',
      render(_, row) {
        const isSelf = row.id === currentUser?.id

        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => openProfile(row)}
              className="h-7 w-7 rounded flex items-center justify-center text-surface-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Ver perfil"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => openEdit(row)}
              className="h-7 w-7 rounded flex items-center justify-center text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Editar usuário"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            {canUseDevActions && !isSelf && (
              <button
                onClick={() => setConfirmAction({ open: true, type: 'impersonate', user: row })}
                className="h-7 w-7 rounded flex items-center justify-center text-surface-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                title="Locar como"
              >
                <LogIn className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              onClick={() => setConfirmAction({ open: true, type: 'toggle', user: row })}
              className={cn(
                'h-7 w-7 rounded flex items-center justify-center transition-colors',
                row.isActive
                  ? 'text-surface-400 hover:text-error-600 hover:bg-error-50'
                  : 'text-surface-400 hover:text-green-600 hover:bg-green-50'
              )}
              title={row.isActive ? 'Desativar usuário' : 'Ativar usuário'}
            >
              {row.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
            </button>

            {canUseDevActions && !isSelf && (
              <button
                onClick={() => setConfirmAction({ open: true, type: 'delete', user: row })}
                className="h-7 w-7 rounded flex items-center justify-center text-surface-400 hover:text-error-700 hover:bg-error-50 transition-colors"
                title="Excluir usuário"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  const roleOptions = [
    { value: '', label: 'Todos os cargos' },
    ...roles.map((role) => ({ value: role.id, label: role.name })),
  ]

  const deptOptions = [
    { value: '', label: 'Todos os departamentos' },
    ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
  ]

  const roleFormOptions = [
    { value: '', label: 'Sem cargo' },
    ...roles.map((role) => ({ value: role.id, label: `${role.name} (${role.code})` })),
  ]

  const deptFormOptions = [
    { value: '', label: 'Sem departamento' },
    ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
  ]

  const confirmCopy = (() => {
    if (confirmAction.type === 'save') {
      return {
        title: editingUser ? 'Confirmar atualização do usuário' : 'Confirmar cadastro do usuário',
        body: editingUser
          ? `Você está prestes a atualizar os dados de ${editingUser.fullName}. Revise as permissões e confirme para continuar.`
          : 'Você está prestes a cadastrar um novo usuário no sistema com as permissões definidas. Confirme para prosseguir.',
        buttonLabel: editingUser ? 'Confirmar atualização' : 'Confirmar cadastro',
        buttonVariant: 'primary' as const,
      }
    }

    if (confirmAction.type === 'toggle') {
      const target = confirmAction.user
      const turningOff = Boolean(target?.isActive)
      return {
        title: turningOff ? 'Confirmação crítica: desativar usuário' : 'Confirmação crítica: ativar usuário',
        body: turningOff
          ? `A conta de ${target?.fullName} ficará sem acesso imediato ao sistema. Esta ação impacta a operação do usuário.`
          : `A conta de ${target?.fullName} voltará a ter acesso ao sistema imediatamente.`,
        buttonLabel: turningOff ? 'Desativar agora' : 'Ativar agora',
        buttonVariant: turningOff ? ('danger' as const) : ('primary' as const),
      }
    }

    if (confirmAction.type === 'impersonate') {
      return {
        title: 'Confirmação crítica: locar como usuário',
        body: `Você vai assumir a sessão de ${confirmAction.user?.fullName}. Todas as ações ficarão registradas em auditoria como locação de desenvolvedor.`,
        buttonLabel: 'Locar como usuário',
        buttonVariant: 'primary' as const,
      }
    }

    return {
      title: 'Confirmação crítica: excluir usuário',
      body: `A exclusão de ${confirmAction.user?.fullName} pode ser irreversível e pode bloquear acessos, histórico operacional e integrações relacionadas. Confirme apenas se estiver certo.`,
      buttonLabel: 'Excluir permanentemente',
      buttonVariant: 'danger' as const,
    }
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900">Painel Dev de Usuários</h1>
          <p className="mt-0.5 text-sm text-surface-500">
            Gestão empresarial de contas, cargos, grupos de permissões e controle de acesso.
          </p>
          <p className="mt-1 text-xs text-surface-500">
            {total} {total === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo usuário
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 max-w-80 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, login ou e-mail..."
            className="h-10 w-full rounded-lg border border-surface-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <Select options={roleOptions} value={filterRole} onChange={(event) => setFilterRole(event.target.value)} className="w-48" />
        <Select options={deptOptions} value={filterDept} onChange={(event) => setFilterDept(event.target.value)} className="w-52" />
        <Select options={STATUS_OPTIONS} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="w-40" />

        <button
          onClick={fetchUsers}
          className="h-10 w-10 rounded-lg border border-surface-300 text-surface-500 flex items-center justify-center hover:bg-surface-100 transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {fetchError ? (
        <ErrorState title="Erro ao carregar usuários" description={fetchError} onRetry={fetchUsers} />
      ) : (
        <Table<UserRow>
          columns={columns}
          data={users}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="Nenhum usuário encontrado."
          emptyIcon={<Users className="h-12 w-12" />}
          totalCount={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !isSaving && setModalOpen(false)}
        title={editingUser ? 'Editar usuário' : 'Cadastrar novo usuário'}
        description={
          editingUser
            ? `Ajuste os dados, cargo e grupo de permissões de ${editingUser.fullName}.`
            : 'Defina os dados principais e permissões para criar uma nova conta.'
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={requestSave} loading={isSaving}>
              {editingUser ? 'Salvar alterações' : 'Cadastrar usuário'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
              {formError}
            </div>
          )}

          <Input
            label="Nome completo"
            value={form.fullName}
            onChange={(event) => updateForm('fullName', event.target.value)}
            placeholder="Ex.: João da Silva"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Login"
              value={form.login}
              onChange={(event) => updateForm('login', event.target.value)}
              placeholder="Ex.: joao.silva"
              required
              hint="Use apenas letras, números, ponto, hífen ou underscore."
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(event) => updateForm('email', event.target.value)}
              placeholder="joao@empresa.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Telefone"
              type="tel"
              value={form.phone}
              onChange={(event) => updateForm('phone', event.target.value)}
              placeholder="(11) 99999-9999"
            />
            <Input
              label={editingUser ? 'Nova senha (opcional)' : 'Senha'}
              type="password"
              value={form.password}
              onChange={(event) => updateForm('password', event.target.value)}
              placeholder="Mínimo de 8 caracteres"
              required={!editingUser}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Cargo"
              value={form.roleId}
              onChange={(event) => updateForm('roleId', event.target.value)}
              options={roleFormOptions}
            />
            <Select
              label="Departamento"
              value={form.departmentId}
              onChange={(event) => updateForm('departmentId', event.target.value)}
              options={deptFormOptions}
            />
          </div>

          <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">Grupo de permissões</p>
            <p className="mt-1 text-sm text-surface-700">
              {selectedRole ? `${selectedRole.code} (derivado do cargo selecionado)` : 'Sem grupo de permissões definido.'}
            </p>
          </div>

          {editingUser && (
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateForm('isActive', event.target.checked)}
                  className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-surface-700">Usuário ativo</span>
              </label>
              <p className="mt-1 text-xs text-surface-500">Usuários inativos não conseguem acessar o sistema.</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={confirmAction.open}
        onClose={() => !isConfirming && setConfirmAction({ open: false, type: 'toggle', user: null })}
        title={confirmCopy.title}
        description="Aviso importante: confirme somente se estiver ciente do impacto operacional."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmAction({ open: false, type: 'toggle', user: null })}
              disabled={isConfirming}
            >
              Cancelar
            </Button>
            <Button variant={confirmCopy.buttonVariant} onClick={handleConfirmAction} loading={isConfirming}>
              {confirmCopy.buttonLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-800">{confirmCopy.body}</p>
          </div>
          {confirmAction.type === 'delete' && (
            <p className="text-xs text-surface-500">
              Após confirmar, esta ação pode não ser desfeita dependendo dos vínculos históricos do usuário.
            </p>
          )}
        </div>
      </Modal>

      {profileUser && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setProfileUser(null)}>
          <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

          <div
            className="relative h-full w-full max-w-md overflow-hidden bg-white shadow-2xl flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-200 bg-surface-50 px-6 py-4">
              <h2 className="font-semibold text-surface-900">Perfil do usuário</h2>
              <button
                onClick={() => setProfileUser(null)}
                className="h-8 w-8 rounded-lg text-surface-500 hover:bg-surface-200 transition-colors flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 shrink-0 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-lg font-bold">
                  {getInitials(profileUser.fullName)}
                </div>
                <div>
                  <p className="text-lg font-semibold leading-tight text-surface-900">{profileUser.fullName}</p>
                  <p className="text-sm text-surface-500">{profileUser.login} · {profileUser.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={profileUser.isActive ? 'success' : 'error'}>
                      {profileUser.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {profileUser.twoFactorEnabled && <Badge variant="secondary">2FA ativo</Badge>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Cargo', value: profileUser.role?.name ?? '—', icon: ShieldCheck },
                  { label: 'Grupo de permissões', value: profileUser.role?.code ?? '—', icon: ShieldCheck },
                  { label: 'Departamento', value: profileUser.department?.name ?? '—', icon: Users },
                  { label: 'Telefone', value: profileUser.phone ?? '—', icon: KeyRound },
                  {
                    label: 'Último acesso',
                    value: profileUser.lastLoginAt ? formatDateTime(profileUser.lastLoginAt) : 'Nunca',
                    icon: Clock,
                  },
                  { label: 'Criado em', value: formatDateTime(profileUser.createdAt), icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-lg border border-surface-200 bg-surface-50 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-surface-500">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </div>
                    <p className="text-xs font-medium leading-tight text-surface-800">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-surface-900">Histórico de atividade recente</h3>
                {loadingProfile ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-surface-400">
                    <Spinner />
                    Carregando histórico...
                  </div>
                ) : profileLogs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-surface-400">Nenhuma atividade registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {profileLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 rounded-lg border border-surface-200 bg-surface-50 p-3">
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-surface-700">
                            {log.description ?? `${log.action} em ${log.module}`}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-[11px] text-surface-400">{formatDateTime(log.createdAt)}</span>
                            {log.ipAddress && <span className="text-[11px] text-surface-400">· {log.ipAddress}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-surface-200 bg-surface-50 px-6 py-3">
              <button
                onClick={() => openEdit(profileUser)}
                className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar este usuário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
