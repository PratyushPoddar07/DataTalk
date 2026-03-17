import { create } from 'zustand';
import type { DatabaseConnection, Query, SchemaInfo } from '@/types';

interface AppState {
  // Database state
  databases: DatabaseConnection[];
  selectedDatabase: DatabaseConnection | null;
  schema: SchemaInfo | null;
  
  // Query state
  queries: Query[];
  currentQuery: string;
  isLoading: boolean;
  
  // UI state
  theme: 'dark' | 'light';
  
  // Actions
  setDatabases: (databases: DatabaseConnection[]) => void;
  setSelectedDatabase: (database: DatabaseConnection | null) => void;
  setSchema: (schema: SchemaInfo | null) => void;
  setQueries: (queries: Query[]) => void;
  addQuery: (query: Query) => void;
  setCurrentQuery: (query: string) => void;
  setIsLoading: (loading: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  databases: [],
  selectedDatabase: null,
  schema: null,
  queries: [],
  currentQuery: '',
  isLoading: false,
  theme: 'dark',
  
  // Actions
  setDatabases: (databases) => set({ databases }),
  
  setSelectedDatabase: (database) => set({ selectedDatabase: database }),
  
  setSchema: (schema) => set({ schema }),
  
  setQueries: (queries) => set({ queries }),
  
  addQuery: (query) => set((state) => ({ 
    queries: [query, ...state.queries] 
  })),
  
  setCurrentQuery: (query) => set({ currentQuery: query }),
  
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  setTheme: (theme) => set({ theme }),
}));
