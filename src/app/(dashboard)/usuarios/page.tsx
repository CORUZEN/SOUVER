'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, Plus, Pencil, UserX, UserCheck, Search, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { ErrorState } from '@/components/ui/Skeleton'
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

interface RoleOption { id: string; name: string; code: string }
interface DeptOption { id: string; name: string; code: string }

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
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function UsuariosPage() {
  // ── Data state ───────────────────────────────────────────
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ── Filter state ─────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // ── Reference data ───────────────────────────────────────
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [departments, setDepartments] = useState<DeptOption[]>([])

  // ── User modal ───────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // ── Confirm modal ────────────────────────────────────────
  const [confirm, setConfirm] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null })
  const [isConfirming, setIsConfirming] = useState(false)

  // ── Fetch users ──────────────────────────────────────────
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
      if (!res.ok) throw new Error('Erro ao carregar usuários')
      const data = await res.json()
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [page, search, filterRole, filterDept, filterStatus])

  // Fetch roles + departments once
  useEffect(() => {
    Promise.all([fetch('/api/roles'), fetch('/api/departments')])
      .then(([r, d]) => Promise.all([r.json(), d.json()]))
      .then(([rolesData, deptData]) => {
        setRoles(rolesData.roles ?? [])
        setDepartments(deptData.departments ?? [])
      })
      .catch(console.error)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, filterRole, filterDept, filterStatus])

  // ── Modal helpers ────────────────────────────────────────
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

  async function handleSave() {
    setFormError(null)
    if (!form.fullName.trim()) return setFormError('Nome completo é obrigatório.')
    if (!form.login.trim()) return setFormError('Login é obrigatório.')
    if (!form.email.trim()) return setFormError('E-mail é obrigatório.')
    if (!editingUser && !form.password.trim()) return setFormError('Senha é obrigatória para novos usuários.')

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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) {
        setFormError(result.message ?? 'Erro ao salvar.')
        return
      }
      setModalOpen(false)
      fetchUsers()
    } catch {
      setFormError('Erro inesperado. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleStatus() {
    if (!confirm.user) return
    setIsConfirming(true)
    try {
      const res = await fetch(`/api/users/${confirm.user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !confirm.user.isActive }),
      })
      if (res.ok) {
        setConfirm({ open: false, user: null })
        fetchUsers()
      }
    } catch {
      console.error('Erro ao alterar status')
    } finally {
      setIsConfirming(false)
    }
  }

  // ── Table columns ────────────────────────────────────────
  const columns: Column<UserRow>[] = [
    {
      key: 'fullName',
      header: 'Usuário',
      sortable: true,
      render(_, row) {
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
              {getInitials(row.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-surface-900 truncate">{row.fullName}</p>
              <p className="text-xs text-surface-400 truncate">{row.login}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'email',
      header: 'E-mail',
      render: (val) => <span className="text-surface-600 text-xs">{String(val)}</span>,
    },
    {
      key: 'role',
      header: 'Perfil',
      render(_, row) {
        return row.role ? (
          <Badge variant="secondary">{row.role.name}</Badge>
        ) : (
          <span className="text-surface-400 text-xs italic">Sem perfil</span>
        )
      },
    },
    {
      key: 'department',
      header: 'Departamento',
      render(_, row) {
        return <span className="text-surface-600 text-xs">{row.department?.name ?? '—'}</span>
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
      header: '',
      width: 'w-20',
      render(_, row) {
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => openEdit(row)}
              className="w-7 h-7 flex items-center justify-center rounded text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Editar usuário"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirm({ open: true, user: row })}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded transition-colors',
                row.isActive
                  ? 'text-surface-400 hover:text-error-600 hover:bg-error-50'
                  : 'text-surface-400 hover:text-green-600 hover:bg-green-50'
              )}
              title={row.isActive ? 'Desativar usuário' : 'Ativar usuário'}
            >
              {row.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            </button>
          </div>
        )
      },
    },
  ]

  const roleOptions = [
    { value: '', label: 'Todos os perfis' },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ]
  const deptOptions = [
    { value: '', label: 'Todos os departamentos' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ]
  const roleFormOptions = [
    { value: '', label: 'Sem perfil' },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ]
  const deptFormOptions = [
    { value: '', label: 'Sem departamento' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900">Gestão de Usuários</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {total} {total === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, login ou e-mail..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-surface-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <Select options={roleOptions} value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-48" />
        <Select options={deptOptions} value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="w-52" />
        <Select options={STATUS_OPTIONS} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-40" />
        <button
          onClick={fetchUsers}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-surface-300 text-surface-500 hover:bg-surface-100 transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      {fetchError ? (
        <ErrorState title="Erro ao carregar usuários" description={fetchError} onRetry={fetchUsers} />
      ) : (
        <Table<UserRow>
          columns={columns}
          data={users}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="Nenhum usuário encontrado."
          emptyIcon={<Users className="w-12 h-12" />}
          totalCount={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* ─── Create / Edit Modal ─────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => !isSaving && setModalOpen(false)}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        description={editingUser ? `Editando: ${editingUser.fullName}` : 'Preencha os dados para criar um novo usuário.'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-error-50 border border-error-200 text-sm text-error-700">
              {formError}
            </div>
          )}

          <Input
            label="Nome Completo"
            value={form.fullName}
            onChange={(e) => updateForm('fullName', e.target.value)}
            placeholder="Ex.: João da Silva"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Login"
              value={form.login}
              onChange={(e) => updateForm('login', e.target.value)}
              placeholder="Ex.: joao.silva"
              required
              hint="Apenas letras, números, . - _"
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => updateForm('email', e.target.value)}
              placeholder="joao@exemplo.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Telefone"
              type="tel"
              value={form.phone}
              onChange={(e) => updateForm('phone', e.target.value)}
              placeholder="(11) 99999-9999"
            />
            <Input
              label={editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
              type="password"
              value={form.password}
              onChange={(e) => updateForm('password', e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required={!editingUser}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Perfil de Acesso"
              value={form.roleId}
              onChange={(e) => updateForm('roleId', e.target.value)}
              options={roleFormOptions}
            />
            <Select
              label="Departamento"
              value={form.departmentId}
              onChange={(e) => updateForm('departmentId', e.target.value)}
              options={deptFormOptions}
            />
          </div>

          {editingUser && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-50 border border-surface-200">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateForm('isActive', e.target.checked)}
                  className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-surface-700">Usuário ativo</span>
              </label>
              <p className="text-xs text-surface-500">
                Usuários inativos não conseguem fazer login no sistema.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Confirm Toggle Status ───────────────────────────── */}
      <Modal
        open={confirm.open}
        onClose={() => !isConfirming && setConfirm({ open: false, user: null })}
        title={confirm.user?.isActive ? 'Desativar Usuário' : 'Ativar Usuário'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm({ open: false, user: null })} disabled={isConfirming}>
              Cancelar
            </Button>
            <Button
              variant={confirm.user?.isActive ? 'danger' : 'primary'}
              onClick={handleToggleStatus}
              loading={isConfirming}
            >
              {confirm.user?.isActive ? 'Desativar' : 'Ativar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-surface-700">
          {confirm.user?.isActive ? (
            <>
              Tem certeza que deseja <strong>desativar</strong> o usuário{' '}
              <strong>{confirm.user?.fullName}</strong>?{' '}
              Ele não conseguirá mais acessar o sistema.
            </>
          ) : (
            <>
              Tem certeza que deseja <strong>ativar</strong> novamente o usuário{' '}
              <strong>{confirm.user?.fullName}</strong>?
            </>
          )}
        </p>
      </Modal>
    </div>
  )
}
