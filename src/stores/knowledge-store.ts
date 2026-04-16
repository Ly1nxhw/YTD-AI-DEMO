import { create } from 'zustand'
import type { KnowledgeBase, KnowledgeEntry } from '@/types'
import { parseMarkdownToKnowledgeBase } from '@/lib/markdown-parser'

interface KnowledgeStore {
  knowledgeBase: KnowledgeBase | null
  loading: boolean
  searchQuery: string
  selectedCategory: string | null

  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: string | null) => void
  loadKnowledgeBase: () => Promise<void>
  importFromMarkdown: (markdown: string) => Promise<void>
  addEntry: (entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  addEntries: (entries: Array<Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  updateEntry: (id: string, updates: Partial<KnowledgeEntry>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  getFilteredEntries: () => KnowledgeEntry[]
  getActiveEntries: () => KnowledgeEntry[]
}

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  knowledgeBase: null,
  loading: false,
  searchQuery: '',
  selectedCategory: null,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),

  loadKnowledgeBase: async () => {
    set({ loading: true })
    try {
      const data = await window.electronAPI.readKnowledgeBase()
      if (data) {
        set({ knowledgeBase: data })
      } else {
        set({
          knowledgeBase: {
            version: '1.0.0',
            entries: [],
            categories: [],
          },
        })
      }
    } catch (error) {
      console.error('Failed to load knowledge base:', error)
    } finally {
      set({ loading: false })
    }
  },

  importFromMarkdown: async (markdown) => {
    const kb = parseMarkdownToKnowledgeBase(markdown)
    await window.electronAPI.writeKnowledgeBase(JSON.stringify(kb, null, 2))
    set({ knowledgeBase: kb })
  },

  addEntry: async (entryData) => {
    const { knowledgeBase } = get()
    if (!knowledgeBase) return

    const newEntry: KnowledgeEntry = {
      ...entryData,
      id: `entry-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated: KnowledgeBase = {
      ...knowledgeBase,
      entries: [...knowledgeBase.entries, newEntry],
      categories: knowledgeBase.categories.includes(entryData.category)
        ? knowledgeBase.categories
        : [...knowledgeBase.categories, entryData.category],
    }

    await window.electronAPI.writeKnowledgeBase(JSON.stringify(updated, null, 2))
    set({ knowledgeBase: updated })
  },

  addEntries: async (entriesData) => {
    const { knowledgeBase } = get()
    if (!knowledgeBase || entriesData.length === 0) return

    const now = new Date().toISOString()
    const newEntries: KnowledgeEntry[] = entriesData.map((entryData, index) => ({
      ...entryData,
      id: `entry-${Date.now()}-${index}`,
      createdAt: now,
      updatedAt: now,
    }))

    const categories = new Set(knowledgeBase.categories)
    for (const entry of newEntries) {
      categories.add(entry.category)
    }

    const updated: KnowledgeBase = {
      ...knowledgeBase,
      entries: [...knowledgeBase.entries, ...newEntries],
      categories: Array.from(categories),
    }

    await window.electronAPI.writeKnowledgeBase(JSON.stringify(updated, null, 2))
    set({ knowledgeBase: updated })
  },

  updateEntry: async (id, updates) => {
    const { knowledgeBase } = get()
    if (!knowledgeBase) return

    const updated: KnowledgeBase = {
      ...knowledgeBase,
      entries: knowledgeBase.entries.map(e =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      ),
    }

    await window.electronAPI.writeKnowledgeBase(JSON.stringify(updated, null, 2))
    set({ knowledgeBase: updated })
  },

  deleteEntry: async (id) => {
    const { knowledgeBase } = get()
    if (!knowledgeBase) return

    const updated: KnowledgeBase = {
      ...knowledgeBase,
      entries: knowledgeBase.entries.map(e =>
        e.id === id ? { ...e, deleted: true, updatedAt: new Date().toISOString() } : e
      ),
    }

    await window.electronAPI.writeKnowledgeBase(JSON.stringify(updated, null, 2))
    set({ knowledgeBase: updated })
  },

  getActiveEntries: () => {
    const { knowledgeBase } = get()
    if (!knowledgeBase) return []
    return knowledgeBase.entries.filter(e => !e.deleted)
  },

  getFilteredEntries: () => {
    const { knowledgeBase, searchQuery, selectedCategory } = get()
    if (!knowledgeBase) return []

    let entries = knowledgeBase.entries.filter(e => !e.deleted)

    if (selectedCategory) {
      entries = entries.filter(e => e.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      entries = entries.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.content.toLowerCase().includes(query) ||
        e.keywords.some(k => k.includes(query))
      )
    }

    return entries
  },
}))
