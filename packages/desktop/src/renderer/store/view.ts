import { create } from 'zustand'

export type AppView = 'chat' | 'skills' | 'templates'

interface ViewState {
  currentView: AppView
  setView: (view: AppView) => void
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'chat',
  setView: (view) => set({ currentView: view }),
}))
