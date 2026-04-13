'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare,
  Send,
  Plus,
  Users,
  UserCircle,
  Building2,
  Search,
  X,
  Check,
  CheckCheck,
} from 'lucide-react'

// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ConversationType = 'DIRECT' | 'GROUP' | 'DEPARTMENT'

interface ConvUser {
  id:        string
  fullName:  string
  avatarUrl: string | null
  status:    string
}

interface LastMsg {
  id:        string
  content:   string
  senderId:  string
  createdAt: string
}

interface Conversation {
  id:           string
  type:         ConversationType
  name:         string | null
  participants: { user: ConvUser }[]
  messages:     LastMsg[]
  _count:       { messages: number }
  updatedAt:    string
}

interface Message {
  id:        string
  content:   string
  senderId:  string
  createdAt: string
  sender:    ConvUser
}

interface Me {
  id:       string
  fullName: string
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d     = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR')
}

function convLabel(conv: Conversation, meId: string) {
  if (conv.name) return conv.name
  if (conv.type === 'DIRECT') {
    const other = conv.participants.find(p => p.user.id !== meId)
    return other?.user.fullName ?? 'Desconhecido'
  }
  return `Grupo (${conv.participants.length})`
}

function convAvatar(conv: Conversation, meId: string) {
  if (conv.type === 'DIRECT') {
    const other = conv.participants.find(p => p.user.id !== meId)
    return other?.user ? initials(other.user.fullName) : '??'
  }
  if (conv.type === 'GROUP')      return <Users size={18} />
  if (conv.type === 'DEPARTMENT') return <Building2 size={18} />
  return <MessageSquare size={18} />
}

const CONV_TYPE_COLOR: Record<ConversationType, string> = {
  DIRECT:     'bg-sky-500',
  GROUP:      'bg-violet-500',
  DEPARTMENT: 'bg-amber-500',
}

// â”€â”€â”€ Componente principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ComunicacaoPage() {
  const [me,            setMe]            = useState<Me | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId,      setActiveId]      = useState<string | null>(null)
  const [messages,      setMessages]      = useState<Message[]>([])
  const [draft,         setDraft]         = useState('')
  const [search,        setSearch]        = useState('')
  const [sending,       setSending]       = useState(false)
  const [showModal,     setShowModal]     = useState(false)
  const [allUsers,      setAllUsers]      = useState<ConvUser[]>([])
  const [newType,       setNewType]       = useState<ConversationType>('DIRECT')
  const [newName,       setNewName]       = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [userSearch,    setUserSearch]    = useState('')

  const msgEndRef  = useRef<HTMLDivElement>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // Carrega usuÃ¡rio atual via token JWT
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).then(d => setMe(d.user ?? null))
  }, [])

  // Carrega conversas
  const loadConversations = useCallback(async () => {
    const r = await fetch('/api/chat/conversations')
    if (!r.ok) return
    const d = await r.json()
    setConversations(d.conversations ?? [])
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Carrega usuÃ¡rios disponÃ­veis para modal
  const loadUsers = useCallback(async () => {
    const r = await fetch('/api/hr/collaborators?pageSize=50&compact=true')
    if (!r.ok) return
    const d = await r.json()
    setAllUsers(d.collaborators ?? [])
  }, [])

  // Carrega mensagens da conversa ativa
  const loadMessages = useCallback(async (convId: string) => {
    const r = await fetch(`/api/chat/conversations/${convId}/messages`)
    if (!r.ok) return
    const d = await r.json()
    setMessages(d.messages ?? [])
  }, [])

  // Marca como lido + polling inteligente (pausa quando aba inativa)
  useEffect(() => {
    if (!activeId) return
    const currentId = activeId
    loadMessages(currentId)
    fetch(`/api/chat/conversations/${currentId}/messages`, { method: 'PATCH' })

    function startPoll() {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => {
        if (document.hidden) return
        loadMessages(currentId)
        loadConversations()
      }, 10000)
    }
    function handleVisibility() {
      if (!document.hidden) {
        loadMessages(currentId)
        loadConversations()
      }
    }

    startPoll()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [activeId, loadMessages, loadConversations])

  // Scroll automÃ¡tico
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Envia mensagem
  async function handleSend() {
    if (!activeId || !draft.trim() || sending) return
    setSending(true)
    await fetch(`/api/chat/conversations/${activeId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: draft.trim() }),
    })
    setDraft('')
    await loadMessages(activeId)
    await loadConversations()
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Cria nova conversa
  async function handleCreate() {
    if (selectedUsers.length === 0) return
    const r = await fetch('/api/chat/conversations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type: newType, name: newName || undefined, memberIds: selectedUsers }),
    })
    if (!r.ok) return
    const d = await r.json()
    await loadConversations()
    setActiveId(d.conversation.id)
    setShowModal(false)
    setSelectedUsers([])
    setNewName('')
    setNewType('DIRECT')
  }

  const activeConv    = conversations.find(c => c.id === activeId)
  const filteredConvs = conversations.filter(c =>
    convLabel(c, me?.id ?? '').toLowerCase().includes(search.toLowerCase()),
  )
  const filteredUsers = allUsers.filter(u =>
    u.fullName.toLowerCase().includes(userSearch.toLowerCase()),
  )

  // Agrupa mensagens por data
  const grouped: { date: string; msgs: Message[] }[] = []
  for (const msg of messages) {
    const d = formatDate(msg.createdAt)
    if (grouped.length === 0 || grouped[grouped.length - 1].date !== d) {
      grouped.push({ date: d, msgs: [msg] })
    } else {
      grouped[grouped.length - 1].msgs.push(msg)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* â”€â”€ Sidebar conversas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <aside className="w-72 shrink-0 bg-surface-50 border-r border-surface-200 flex flex-col">
        {/* Header sidebar */}
        <div className="p-4 border-b border-surface-200 flex items-center justify-between">
          <span className="font-bold text-surface-900 text-lg">ComunicaÃ§Ã£o</span>
          <button
            onClick={() => { setShowModal(true); loadUsers() }}
            className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors"
            title="Nova conversa"
          >
            <Plus size={18} className="text-surface-600" />
          </button>
        </div>

        {/* Busca */}
        <div className="px-3 py-2 border-b border-surface-200">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-surface-400" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-surface-100 border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Buscar conversaâ€¦"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Lista */}
        <ul className="flex-1 overflow-y-auto divide-y divide-surface-100">
          {filteredConvs.length === 0 && (
            <li className="p-6 text-center text-sm text-surface-400">
              Nenhuma conversa ainda.
            </li>
          )}
          {filteredConvs.map(conv => {
            const label   = convLabel(conv, me?.id ?? '')
            const avatar  = convAvatar(conv, me?.id ?? '')
            const lastMsg = conv.messages[0]
            const isActive = conv.id === activeId
            return (
              <li key={conv.id}>
                <button
                  onClick={() => setActiveId(conv.id)}
                  className={`w-full text-left px-3 py-3 flex gap-3 hover:bg-surface-100 transition-colors ${isActive ? 'bg-brand-50 border-r-2 border-brand-500' : ''}`}
                >
                  <div className={`${CONV_TYPE_COLOR[conv.type]} text-white w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold`}>
                    {typeof avatar === 'string' ? avatar : avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold text-surface-900 truncate">{label}</span>
                      {lastMsg && (
                        <span className="text-xs text-surface-400 shrink-0">
                          {formatTime(lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    {lastMsg ? (
                      <p className="text-xs text-surface-500 truncate">{lastMsg.content}</p>
                    ) : (
                      <p className="text-xs text-surface-400 italic">Sem mensagens</p>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* â”€â”€ Painel principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeConv && me ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header do chat */}
          <div className="h-14 border-b border-surface-200 bg-white px-5 flex items-center gap-3 shrink-0">
            <div className={`${CONV_TYPE_COLOR[activeConv.type]} text-white w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0`}>
              {convAvatar(activeConv, me.id)}
            </div>
            <div>
              <p className="font-semibold text-surface-900 text-sm">{convLabel(activeConv, me.id)}</p>
              <p className="text-xs text-surface-400">
                {activeConv.participants.length} participante{activeConv.participants.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-surface-50">
            {grouped.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-surface-400 gap-2">
                <MessageSquare size={40} className="opacity-30" />
                <p className="text-sm">Nenhuma mensagem ainda. Diga olÃ¡!</p>
              </div>
            )}
            {grouped.map(group => (
              <div key={group.date}>
                {/* Data separadora */}
                <div className="flex items-center gap-2 my-4">
                  <hr className="flex-1 border-surface-200" />
                  <span className="text-xs text-surface-400 px-2 bg-surface-50">{group.date}</span>
                  <hr className="flex-1 border-surface-200" />
                </div>
                {group.msgs.map((msg, idx) => {
                  const isMe    = msg.senderId === me.id
                  const prevMsg = idx > 0 ? group.msgs[idx - 1] : null
                  const sameSender = prevMsg?.senderId === msg.senderId
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} ${sameSender ? 'mt-0.5' : 'mt-3'}`}>
                      {!sameSender && !isMe ? (
                        <div className="bg-violet-400 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                          {initials(msg.sender.fullName)}
                        </div>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}
                      <div className={`max-w-sm ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        {!sameSender && !isMe && (
                          <span className="text-xs font-medium text-surface-600 mb-0.5 pl-1">
                            {msg.sender.fullName}
                          </span>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-brand-500 text-white rounded-tr-sm'
                            : 'bg-white border border-surface-200 text-surface-900 rounded-tl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span className="text-xs text-surface-400">{formatTime(msg.createdAt)}</span>
                          {isMe && <CheckCheck size={12} className="text-brand-400" />}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={msgEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-surface-200 bg-white px-4 py-3 flex items-end gap-2 shrink-0">
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-surface-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 max-h-32"
              placeholder="Digite uma mensagemâ€¦ (Enter para enviar)"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="w-10 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 flex items-center justify-center transition-colors"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-surface-400 gap-3">
          <MessageSquare size={52} className="opacity-20" />
          <p className="text-sm">Selecione uma conversa ou inicie uma nova</p>
          <button
            onClick={() => { setShowModal(true); loadUsers() }}
            className="mt-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm hover:bg-brand-600 transition-colors flex items-center gap-2"
          >
            <Plus size={15} /> Nova Conversa
          </button>
        </div>
      )}

      {/* â”€â”€ Modal nova conversa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
              <h3 className="font-bold text-surface-900">Nova Conversa</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-surface-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs text-surface-500 mb-1.5 font-medium">Tipo</label>
                <div className="flex gap-2">
                  {(['DIRECT', 'GROUP'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setNewType(t); setSelectedUsers([]) }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm border transition-colors ${
                        newType === t
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                      }`}
                    >
                      {t === 'DIRECT' ? <UserCircle size={15} /> : <Users size={15} />}
                      {t === 'DIRECT' ? 'Direto' : 'Grupo'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome (grupo) */}
              {newType === 'GROUP' && (
                <div>
                  <label className="block text-xs text-surface-500 mb-1.5 font-medium">Nome do grupo</label>
                  <input
                    className="w-full border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Ex: Equipe Colheita"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                </div>
              )}

              {/* Busca de usuÃ¡rios */}
              <div>
                <label className="block text-xs text-surface-500 mb-1.5 font-medium">
                  {newType === 'DIRECT' ? 'Selecione o usuÃ¡rio' : 'Adicionar membros'}
                </label>
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-surface-400" />
                  <input
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Buscar colaboradorâ€¦"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                  />
                </div>
                <ul className="space-y-1 max-h-52 overflow-y-auto">
                  {filteredUsers.filter(u => u.id !== me?.id).map(u => {
                    const selected = selectedUsers.includes(u.id)
                    return (
                      <li key={u.id}>
                        <button
                          onClick={() => {
                            if (newType === 'DIRECT') {
                              setSelectedUsers([u.id])
                            } else {
                              setSelectedUsers(prev =>
                                selected ? prev.filter(x => x !== u.id) : [...prev, u.id],
                              )
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                            selected ? 'bg-brand-50 border border-brand-200' : 'hover:bg-surface-50'
                          }`}
                        >
                          <div className="bg-surface-200 text-surface-700 w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold">
                            {initials(u.fullName)}
                          </div>
                          <span className="flex-1 text-left">{u.fullName}</span>
                          {selected && <Check size={14} className="text-brand-500" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {selectedUsers.length > 0 && (
                <p className="text-xs text-brand-600">
                  {selectedUsers.length} selecionado{selectedUsers.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Footer modal */}
            <div className="px-5 py-4 border-t border-surface-100 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-xl border border-surface-200 hover:bg-surface-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={selectedUsers.length === 0}
                className="px-4 py-2 text-sm rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 transition-colors"
              >
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

