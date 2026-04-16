import { useState } from 'react'
import { Search, Plus, ChevronRight, ChevronDown, Copy, Pencil, Trash2, X, BookOpen, BarChart3, Wand2 } from 'lucide-react'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import type { KnowledgeEntry } from '@/types'

interface SidebarProps {
  onOpenKB: () => void
  onOpenStats: () => void
  onOpenLearner: () => void
  onOpenInitializer: () => void
  activePanel?: string
}

export default function Sidebar({ onOpenKB, onOpenStats, onOpenLearner, onOpenInitializer, activePanel }: SidebarProps) {
  const {
    knowledgeBase,
    searchQuery,
    selectedCategory,
    setSearchQuery,
    setSelectedCategory,
    getFilteredEntries,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useKnowledgeStore()

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null)
  const [newEntry, setNewEntry] = useState({ category: '', title: '', content: '', keywords: '' })
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const filteredEntries = getFilteredEntries()
  const categories = knowledgeBase?.categories || []

  const toggleCategory = (cat: string) => {
    const newSet = new Set(expandedCategories)
    if (newSet.has(cat)) {
      newSet.delete(cat)
    } else {
      newSet.add(cat)
    }
    setExpandedCategories(newSet)

    if (selectedCategory === cat) {
      setSelectedCategory(null)
    } else {
      setSelectedCategory(cat)
    }
  }

  const handleCopy = async (text: string, entryId: string) => {
    await window.electronAPI?.copyToClipboard(text)
    setCopyFeedback(entryId)
    setTimeout(() => setCopyFeedback(null), 1500)
  }

  const handleAdd = async () => {
    if (!newEntry.title || !newEntry.content || !newEntry.category) return
    await addEntry({
      category: newEntry.category,
      title: newEntry.title,
      content: newEntry.content,
      keywords: newEntry.keywords.split(/[,，、\s]+/).filter(Boolean),
      scenario: newEntry.category,
    })
    setNewEntry({ category: '', title: '', content: '', keywords: '' })
    setShowAddForm(false)
  }

  const handleUpdate = async () => {
    if (!editingEntry) return
    await updateEntry(editingEntry.id, {
      title: editingEntry.title,
      content: editingEntry.content,
      keywords: editingEntry.keywords,
    })
    setEditingEntry(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm('确认删除此话术？')) {
      await deleteEntry(id)
    }
  }

  // Group entries by category
  const grouped = filteredEntries.reduce<Record<string, KnowledgeEntry[]>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push(entry)
    return acc
  }, {})

  const isKBActive = !activePanel

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">
      {/* 话术库 nav button */}
      <div className="px-2 pt-2">
        <button
          onClick={onOpenKB}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
            isKBActive
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Search className="w-4 h-4" />
          话术库
          <span className="ml-auto text-[10px] text-gray-400">{filteredEntries.length}</span>
        </button>
      </div>

      {/* KB expanded: search + list, directly under 话术库 button */}
      {isKBActive && (
        <>
          <div className="px-3 py-2 border-t border-gray-100 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索话术..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                title="新增话术"
              >
                {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="p-3 border-b border-gray-100 bg-blue-50 space-y-2">
              <select
                value={newEntry.category}
                onChange={e => setNewEntry({ ...newEntry, category: e.target.value })}
                className="w-full px-2 py-1 text-xs border rounded-md"
              >
                <option value="">选择分类</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__new__">+ 新分类</option>
              </select>
              {newEntry.category === '__new__' && (
                <input
                  placeholder="输入新分类名称"
                  onChange={e => setNewEntry({ ...newEntry, category: e.target.value })}
                  className="w-full px-2 py-1 text-xs border rounded-md"
                />
              )}
              <input
                placeholder="话术标题"
                value={newEntry.title}
                onChange={e => setNewEntry({ ...newEntry, title: e.target.value })}
                className="w-full px-2 py-1 text-xs border rounded-md"
              />
              <textarea
                placeholder="话术正文"
                value={newEntry.content}
                onChange={e => setNewEntry({ ...newEntry, content: e.target.value })}
                rows={3}
                className="w-full px-2 py-1 text-xs border rounded-md resize-none"
              />
              <input
                placeholder="关键词（逗号分隔）"
                value={newEntry.keywords}
                onChange={e => setNewEntry({ ...newEntry, keywords: e.target.value })}
                className="w-full px-2 py-1 text-xs border rounded-md"
              />
              <button
                onClick={handleAdd}
                className="w-full py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          )}
        </>
      )}

      {/* Entry list — only when KB is active */}
      {isKBActive && (
      <div className="overflow-y-auto">
        {(searchQuery ? Object.keys(grouped) : categories).map(cat => {
          const entries = grouped[cat] || []
          if (searchQuery && entries.length === 0) return null
          const isExpanded = expandedCategories.has(cat) || !!searchQuery

          return (
            <div key={cat} className="mb-0.5">
              <button
                onClick={() => toggleCategory(cat)}
                className={`w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                  isExpanded
                    ? 'text-blue-700 bg-blue-50/50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                )}
                <span>{cat}</span>
                <span className="ml-auto text-[10px] font-normal text-gray-400">{entries.length}</span>
              </button>

              {isExpanded && (
                <div className="ml-3 border-l-2 border-blue-100">
                  {entries.map(entry => (
                <div key={entry.id} className="border-b border-gray-50/80">
                  <button
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    className={`w-full text-left pl-4 pr-3 py-1.5 text-xs transition-colors truncate ${
                      expandedEntry === entry.id
                        ? 'text-blue-700 bg-blue-50/40 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    {entry.title}
                  </button>

                  {expandedEntry === entry.id && (
                    <div className="pl-4 pr-3 pb-2.5 bg-gray-50/50">
                      {editingEntry?.id === entry.id ? (
                        <div className="space-y-1.5">
                          <input
                            value={editingEntry.title}
                            onChange={e => setEditingEntry({ ...editingEntry, title: e.target.value })}
                            className="w-full px-2 py-1 text-xs border rounded"
                          />
                          <textarea
                            value={editingEntry.content}
                            onChange={e => setEditingEntry({ ...editingEntry, content: e.target.value })}
                            rows={4}
                            className="w-full px-2 py-1 text-xs border rounded resize-none"
                          />
                          <div className="flex gap-1">
                            <button onClick={handleUpdate} className="px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded">保存</button>
                            <button onClick={() => setEditingEntry(null)} className="px-2 py-0.5 text-[10px] bg-gray-200 rounded">取消</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                            {entry.content}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <button
                              onClick={() => handleCopy(entry.content, entry.id)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                            >
                              <Copy className="w-3 h-3" />
                              {copyFeedback === entry.id ? '已复制' : '复制'}
                            </button>
                            <button
                              onClick={() => setEditingEntry({ ...entry })}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-50 rounded hover:bg-gray-100"
                            >
                              <Pencil className="w-3 h-3" />
                              编辑
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-red-500 bg-red-50 rounded hover:bg-red-100"
                            >
                              <Trash2 className="w-3 h-3" />
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {/* Other nav buttons — after KB list */}
      <div className="px-2 pb-2 space-y-0.5" style={isKBActive ? {} : { marginTop: '0.125rem' }}>
        <button
          onClick={onOpenInitializer}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
            activePanel === 'initializer'
              ? 'bg-indigo-50 text-indigo-700 font-semibold'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          初始化工作区
        </button>
        <button
          onClick={onOpenLearner}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
            activePanel === 'learner'
              ? 'bg-purple-50 text-purple-700 font-semibold'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          从对话学习话术
        </button>
        <button
          onClick={onOpenStats}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
            activePanel === 'stats'
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          使用统计
        </button>
      </div>
    </div>
  )
}
