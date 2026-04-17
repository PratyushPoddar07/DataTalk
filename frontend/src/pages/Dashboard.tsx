import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Settings, Plus, Table, Search, Shield, ChevronRight, ChevronDown, ChevronLeft, X, Menu, User, LogOut, Moon, Sun, Clock, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';

import Background3D from '@/components/Background3D';
import QueryInput from '@/components/QueryInput';
import ResultsDisplay from '@/components/ResultsDisplay';
import SchemaVisualizer3D from '@/components/SchemaVisualizer3D';
import SchemaReport from '@/components/SchemaReport';
import { apiService } from '@/services/api';
import { useAppStore } from '@/store';
import type { DatabaseConnection, TableInfo } from '@/types';

const DB_TYPES = [
  { key: 'all', label: 'All', icon: '🗄️' },
  { key: 'postgresql', label: 'PostgreSQL', icon: '🐘' },
  { key: 'mongodb_atlas', label: 'MongoDB Atlas', icon: '☁️' },
  { key: 'mysql', label: 'MySQL', icon: '🐬' },
] as const;

type DbTypeFilter = typeof DB_TYPES[number]['key'];

export default function Dashboard() {
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [isAddDbOpen, setIsAddDbOpen] = useState(false);
  const [showMoreDbs, setShowMoreDbs] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const [selectedDbType, setSelectedDbType] = useState<DbTypeFilter>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteTableConfirmName, setDeleteTableConfirmName] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const [visualizerMode, setVisualizerMode] = useState<'3d' | 'report'>('3d');
  const [currentQuery, setCurrentQuery] = useState('');

  const [newDb, setNewDb] = useState({
    name: '',
    db_type: 'postgresql' as 'postgresql' | 'mysql' | 'mongodb' | 'mongodb_atlas' | 'sqlite',
    connection_string: ''
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  const {
    selectedDatabase,
    setSelectedDatabase,
    queries,
    addQuery,
  } = useAppStore();

  const queryClient = useQueryClient();

  // Fetch databases
  const { data: databases } = useQuery({
    queryKey: ['databases'],
    queryFn: apiService.getDatabases,
  });

  // Fetch complete query history for Sidebar
  const { data: historyQueries } = useQuery({
    queryKey: ['queries_history', selectedDatabase?.id],
    queryFn: () => apiService.getQueryHistory(selectedDatabase?.id || undefined),
    enabled: true,
  });

  // Fetch schema
  const { data: schema } = useQuery({
    queryKey: ['schema', selectedDatabase?.id],
    queryFn: () => apiService.getSchema(selectedDatabase!.id),
    enabled: !!selectedDatabase,
  });

  // Fetch AI schema analysis
  const { data: schemaAnalysis, isLoading: isLoadingAnalysis } = useQuery({
    queryKey: ['schema-analysis', selectedDatabase?.id],
    queryFn: () => apiService.getSchemaAnalysis(selectedDatabase!.id),
    enabled: !!selectedDatabase && showSchema && visualizerMode === 'report',
  });

  // Execute query mutation
  const executeMutation = useMutation({
    mutationFn: (query: string) => apiService.executeQuery({
      natural_language_query: query,
      database_id: selectedDatabase!.id,
      include_insights: true,
      explain_sql: true,
    }),
    onSuccess: (data) => {
      addQuery(data);
      queryClient.invalidateQueries({ queryKey: ['query-history'] });
      queryClient.invalidateQueries({ queryKey: ['schema', selectedDatabase?.id] });
      toast.success('Query executed successfully!');
    },
    onError: (error: any) => {
      console.error('Query Execution Error:', error);
      const msg = error.response?.data?.detail || error.message || JSON.stringify(error);
      toast.error(`Query Failed: ${msg}`);
    },
  });

  // Add database mutation
  const addDbMutation = useMutation({
    mutationFn: apiService.createDatabase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      setIsAddDbOpen(false);
      setNewDb({ name: '', db_type: 'postgresql', connection_string: '' });
      toast.success('Database added successfully!');
    },
    onError: (error: any) => {
      console.error('Add DB Error:', error);
      const msg = error.response?.data?.detail || error.message || 'Failed to add database';
      toast.error(`Error: ${msg}`);
    }
  });

  // Delete database mutation
  const deleteMutation = useMutation({
    mutationFn: (databaseId: number) => apiService.deleteDatabase(databaseId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      if (selectedDatabase?.id === deletedId) {
        setSelectedDatabase(null);
        setSelectedTable(null);
      }
      setDeleteConfirmId(null);
      toast.success('Database deleted successfully!');
    },
    onError: (error: any) => {
      console.error('Delete DB Error:', error);
      const msg = error.response?.data?.detail || error.message || 'Failed to delete database';
      toast.error(`Error: ${msg}`);
      setDeleteConfirmId(null);
    }
  });

  // Delete table mutation
  const deleteTableMutation = useMutation({
    mutationFn: (tableName: string) => apiService.deleteTable(selectedDatabase!.id, tableName),
    onSuccess: (_, deletedTableName) => {
      queryClient.invalidateQueries({ queryKey: ['schema', selectedDatabase?.id] });
      if (selectedTable?.name === deletedTableName) {
        setSelectedTable(null);
      }
      setDeleteTableConfirmName(null);
      toast.success(`Table '${deletedTableName}' deleted successfully!`);
    },
    onError: (error: any) => {
      console.error('Delete Table Error:', error);
      const msg = error.response?.data?.detail || error.message || 'Failed to delete table';
      toast.error(`Error: ${msg}`);
      setDeleteTableConfirmName(null);
    }
  });

  // Auto-select first database in filtered view
  useEffect(() => {
    const filteredDbs = databases?.filter(db => selectedDbType === 'all' || db.db_type === selectedDbType) || [];
    if (filteredDbs.length > 0) {
       // If current selection is not in the filtered view, pick the first available one
       const isSelectedInFiltered = filteredDbs.some(db => db.id === selectedDatabase?.id);
       if (!isSelectedInFiltered && !selectedDatabase) {
         setSelectedDatabase(filteredDbs[0]);
       }
    } else {
       // No databases in this view, clear selection
       setSelectedDatabase(null);
    }
  }, [databases, selectedDbType, selectedDatabase, setSelectedDatabase]);

  // Initial auto-select first database
  useEffect(() => {
    if (databases && databases.length > 0 && !selectedDatabase && selectedDbType === 'all') {
      setSelectedDatabase(databases[0]);
    }
  }, [databases, selectedDatabase, setSelectedDatabase, selectedDbType]);

  // Check scroll state
  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollState);
      window.addEventListener('resize', updateScrollState);
      return () => {
        el.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [databases]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setShowMoreDbs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  const handleQuerySubmit = (query: string) => {
    if (!selectedDatabase) {
      toast.error('Please select a database first');
      return;
    }
    executeMutation.mutate(query);
  };

  const handleAddDb = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDb.name || !newDb.connection_string) {
      toast.error('Please fill in all fields');
      return;
    }
    addDbMutation.mutate(newDb);
  };

  const handleSelectDb = (db: DatabaseConnection) => {
    setSelectedDatabase(db);
    setShowMoreDbs(false);
    setSelectedTable(null);
  };

  const handleDeleteDb = (e: React.MouseEvent, dbId: number) => {
    e.stopPropagation();
    setDeleteConfirmId(dbId);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
    }
  };

  const handleDeleteTable = (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    setDeleteTableConfirmName(tableName);
  };

  const confirmDeleteTable = () => {
    if (deleteTableConfirmName) {
      deleteTableMutation.mutate(deleteTableConfirmName);
    }
  };

  const handleTableSelect = (table: TableInfo) => {
    setSelectedTable(table);
    // Automatically trigger a query to show the data
    const query = `Show me all data from ${table.name}`;
    setCurrentQuery(query);
    handleQuerySubmit(query);
  };

  const latestQuery = queries[0];

  // Filter databases by selected type
  const filteredDbs = selectedDbType === 'all'
    ? (databases ?? [])
    : (databases ?? []).filter(db => db.db_type === selectedDbType);

  // For mobile "more" dropdown — show first 2 inline, rest in dropdown
  const MOBILE_VISIBLE_COUNT = 2;
  const visibleDbs = filteredDbs.slice(0, MOBILE_VISIBLE_COUNT);
  const overflowDbs = filteredDbs.slice(MOBILE_VISIBLE_COUNT);

  // Count databases per type
  const dbCounts = (databases ?? []).reduce((acc, db) => {
    acc[db.db_type] = (acc[db.db_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Handle theme toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0a0f]' : 'bg-slate-50'}`}>
      <Toaster position="top-right" />
      <Background3D />

      <div className="relative z-10 flex h-screen overflow-hidden">
        {/* Left Sidebar: Query History */}
        <AnimatePresence>
          {isHistoryOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="h-full glass-effect border-r border-slate-200 dark:border-white/10 flex flex-col z-30 shrink-0 backdrop-blur-2xl bg-white dark:bg-black/20"
            >
              <div className="p-4 border-b border-slate-200/50 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary-500" />
                  <span className="font-bold text-sm tracking-wide uppercase text-slate-600 dark:text-gray-400">Query History</span>
                </div>
                <button 
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4 history-scroll">
                {(!historyQueries || historyQueries.length === 0) ? (
                  <div className="text-center py-10 text-slate-400 dark:text-gray-500 text-sm italic">
                    No recent queries
                  </div>
                ) : (
                  <div className="space-y-1">
                    {historyQueries.map((q: any) => (
                      <button
                        key={q.id}
                        onClick={() => {
                          setCurrentQuery(q.natural_language_query);
                          toast.success('Query formula loaded');
                        }}
                        className="w-full text-left p-2.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/5 transition-all text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white flex flex-col gap-1 group"
                      >
                        <div className="truncate font-medium">{q.natural_language_query}</div>
                        <div className="text-[10px] text-slate-400 dark:text-gray-500 font-mono truncate">{new Date(q.created_at).toLocaleDateString()}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="glass-effect border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
            {/* Top row: title + actions */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {!isHistoryOpen && (
                  <button
                    onClick={() => setIsHistoryOpen(true)}
                    className="p-1.5 rounded-lg glass-effect hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all"
                    title="Open History"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                )}
                <h1 className="text-xl sm:text-2xl font-bold gradient-text tracking-tight">
                  QueryMind AI
                </h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setIsAddDbOpen(true)}
                  className="p-2 sm:px-3 sm:py-2 glass-effect rounded-lg hover:bg-primary-600/10 dark:hover:bg-primary-600/20 text-primary-600 dark:text-primary-400 transition-all flex items-center gap-1.5"
                  title="Add Database"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Add DB</span>
                </button>

                <button
                  onClick={() => setShowSchema(!showSchema)}
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 sm:px-3 ${showSchema ? 'bg-primary-600 shadow-lg shadow-primary-600/30 text-white' : 'glass-effect hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-gray-300'
                    }`}
                  title="Toggle Schema Visualizer"
                >
                  <Eye className="w-5 h-5" />
                  <span className="text-sm font-medium hidden sm:inline">Visualizer</span>
                </button>

                {/* Settings Dropdown Button */}
                <div className="relative" ref={settingsDropdownRef}>
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-2 rounded-lg glass-effect hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all"
                    title="Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {isSettingsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-56 glass-effect border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => {
                              toggleTheme();
                              setIsSettingsOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2.5 transition-all"
                          >
                            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            <span>Switch to {isDarkMode ? 'Light' : 'Dark'} Mode</span>
                          </button>

                          <button
                            onClick={() => {
                              setIsProfileOpen(true);
                              setIsSettingsOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2.5 transition-all"
                          >
                            <User className="w-4 h-4" />
                            <span>View Profile</span>
                          </button>

                          <div className="border-t border-white/5 my-1" />

                          <button
                            onClick={() => {
                              toast.success('Logged out (Mock)');
                              setIsSettingsOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-all"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Logout</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Database type tabs */}
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto db-scroll-bar pb-1">
              {DB_TYPES.map((type) => {
                const count = type.key === 'all'
                  ? (databases?.length ?? 0)
                  : (dbCounts[type.key] ?? 0);
                return (
                  <button
                    key={type.key}
                    onClick={() => {
                      setSelectedDbType(type.key);
                      setSelectedTable(null);
                      // Clear selection when switching to a category that might not have the DB
                      if (type.key !== 'all' && selectedDatabase?.db_type !== type.key) {
                        setSelectedDatabase(null);
                      }
                    }}
                    className={`db-type-tab shrink-0 ${
                      selectedDbType === type.key ? 'db-type-tab-active' : ''
                    }`}
                  >
                    <span className="text-sm">{type.icon}</span>
                    <span>{type.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      selectedDbType === type.key
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-gray-500'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Filtered database pills bar */}
            <div className="relative flex items-center gap-2">
              {/* Scroll left button */}
              {canScrollLeft && (
                <button
                  onClick={() => scrollBy('left')}
                  className="hidden sm:flex shrink-0 p-1.5 rounded-lg glass-effect hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              {/* Desktop/Tablet: scrollable row of filtered databases */}
              <div
                ref={scrollRef}
                className="hidden sm:flex items-center gap-2 overflow-x-auto db-scroll-bar flex-1"
              >
                {filteredDbs.length > 0 ? (
                  filteredDbs.map((db) => (
                    <div
                      key={db.id}
                      className={`db-pill shrink-0 group/pill ${selectedDatabase?.id === db.id ? 'db-pill-active' : ''}`}
                      onClick={() => handleSelectDb(db)}
                      role="button"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[140px]">{db.name}</span>
                      {selectedDbType === 'all' && (
                        <span className="text-[9px] opacity-50 uppercase font-mono">{db.db_type}</span>
                      )}
                      <button
                        onClick={(e) => handleDeleteDb(e, db.id)}
                        className="ml-0.5 p-0.5 rounded opacity-0 group-hover/pill:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title="Delete database"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 italic px-2 py-2">No databases of this type</span>
                )}
              </div>

              {/* Mobile: show first N pills + "more" dropdown */}
              <div className="flex sm:hidden items-center gap-2 flex-1 min-w-0">
                {visibleDbs.length > 0 ? (
                  visibleDbs.map((db) => (
                    <button
                      key={db.id}
                      onClick={() => handleSelectDb(db)}
                      className={`db-pill shrink-0 ${selectedDatabase?.id === db.id ? 'db-pill-active' : ''}`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[100px]">{db.name}</span>
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 italic px-2">No databases of this type</span>
                )}

                {overflowDbs.length > 0 && (
                  <div className="relative" ref={moreDropdownRef}>
                    <button
                      onClick={() => setShowMoreDbs(!showMoreDbs)}
                      className="db-pill shrink-0 gap-1"
                    >
                      <span className="text-xs">+{overflowDbs.length}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${showMoreDbs ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showMoreDbs && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-56 glass-effect border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden"
                        >
                          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                            {overflowDbs.map((db) => (
                              <button
                                key={db.id}
                                onClick={() => handleSelectDb(db)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2.5 ${selectedDatabase?.id === db.id
                                  ? 'bg-primary-600/20 text-white border border-primary-500/30'
                                  : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                                  }`}
                              >
                                <Database className={`w-4 h-4 shrink-0 ${selectedDatabase?.id === db.id ? 'text-primary-400' : 'text-gray-500'}`} />
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{db.name}</div>
                                  <div className="text-[10px] text-gray-500 font-mono uppercase">{db.db_type}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Scroll right button */}
              {canScrollRight && (
                <button
                  onClick={() => scrollBy('right')}
                  className="hidden sm:flex shrink-0 p-1.5 rounded-lg glass-effect hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Tables collapsible bar */}
        {selectedDatabase && schema?.tables && Object.keys(schema.tables).length > 0 && (
          <div className="glass-effect border-b border-slate-200/50 dark:border-white/10 shrink-0">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => setShowTables(!showTables)}
                className="w-full flex items-center justify-between py-2.5 text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-widest hover:text-slate-800 dark:hover:text-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Table className="w-3.5 h-3.5" />
                  <span>Tables ({Object.keys(schema.tables).length})</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTables ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showTables && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-3 flex flex-wrap gap-2">
                      {Object.keys(schema.tables).map((tableName) => (
                        <div
                          key={tableName}
                          onClick={() => handleTableSelect(schema.tables[tableName])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border group/table ${selectedTable?.name === tableName
                            ? 'bg-primary-600/20 text-primary-300 border-primary-500/40'
                            : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200'
                            }`}
                          role="button"
                        >
                          <Table className="w-3 h-3 opacity-60" />
                          <span>{tableName}</span>
                          <button
                            onClick={(e) => handleDeleteTable(e, tableName)}
                            className="ml-0.5 p-0.5 rounded opacity-0 group-hover/table:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all font-bold"
                            title="Delete table"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="max-w-7xl mx-auto p-6 space-y-6 pb-32">
            {/* Schema Visualizer */}
            <AnimatePresence>
              {showSchema && schema && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 600, y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  className="card h-[600px] relative overflow-hidden group shadow-2xl shadow-primary-900/10 flex flex-col"
                >
                  {/* View Toggle Bar */}
                  <div className="flex items-center gap-1 p-1 bg-black/20 rounded-lg absolute top-4 left-4 z-20 border border-white/5 backdrop-blur-md">
                    <button
                      onClick={() => setVisualizerMode('3d')}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                        visualizerMode === '3d' 
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' 
                        : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      3D Graph
                    </button>
                    <button
                      onClick={() => setVisualizerMode('report')}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                        visualizerMode === 'report' 
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' 
                        : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Report View
                    </button>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-b from-primary-500/5 to-transparent pointer-events-none" />
                  
                  {visualizerMode === '3d' ? (
                    <SchemaVisualizer3D
                      schema={schema}
                      onTableSelect={handleTableSelect}
                      selectedTable={selectedTable}
                    />
                  ) : (
                    <SchemaReport 
                      schema={schema} 
                      analysis={schemaAnalysis}
                      isLoadingAnalysis={isLoadingAnalysis}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Table Detail View */}
            <AnimatePresence>
              {selectedTable && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="card border-l-4 border-l-primary-500"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary-500/10 rounded-lg text-primary-400">
                        <Table className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-white">{selectedTable.name}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedTable(null)}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {selectedTable.columns.map((col) => (
                      <div key={col.name} className="glass-effect p-4 rounded-xl border border-white/5 hover:border-primary-500/30 transition-all">
                        <div className="text-sm font-bold text-gray-200 mb-1 flex items-center gap-2">
                          {col.name}
                          {col.primary_key && <span className="text-[10px] bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded uppercase font-mono">PK</span>}
                        </div>
                        <div className="text-xs text-gray-500 font-mono uppercase">{col.type}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Query Area */}
            <div className="max-w-4xl mx-auto space-y-6">
              <QueryInput
                onSubmit={handleQuerySubmit}
                isLoading={executeMutation.isPending}
                query={currentQuery}
                setQuery={setCurrentQuery}
              />

              {latestQuery && (
                <ResultsDisplay query={latestQuery} isDark={isDarkMode} />
              )}

              {!latestQuery && !executeMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="card text-center py-20 bg-gradient-to-b from-white/[0.02] to-transparent border-slate-200 dark:border-white/5"
                >
                  <div className="max-w-lg mx-auto">
                    <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary-400">
                      <Search className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">
                      Ready for Insights?
                    </h2>
                    <p className="text-slate-600 dark:text-gray-400 mb-10 leading-relaxed text-lg">
                      Connect your data and ask anything. Our AI will handle the
                      complex SQL, so you can focus on the answers.
                    </p>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        'Show me sales trends for the last quarter',
                        'Which customers have the highest lifetime value?',
                        'What are the most popular products this month?',
                      ].map((example, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuerySubmit(example)}
                          className="group p-5 glass-effect rounded-2xl border border-slate-200 dark:border-white/5 hover:border-primary-500/30 dark:hover:border-primary-500/50 hover:bg-primary-50 dark:hover:bg-primary-500/5 transition-all text-left flex items-center justify-between"
                        >
                          <span className="text-slate-600 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors capitalize px-2">
                            "{example}"
                          </span>
                          <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-primary-500 text-gray-500 group-hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                            <Plus className="w-4 h-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </main>

        {/* Add Database Modal */}
        <AnimatePresence>
          {isAddDbOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddDbOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg glass-effect border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary-500/10 rounded-xl text-primary-400">
                      <Plus className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Add New Database</h3>
                      <p className="text-sm text-gray-500">Connect a new data source to start querying</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddDbOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddDb} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Connection Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Production PostgreSQL"
                        value={newDb.name}
                        onChange={(e) => setNewDb({ ...newDb, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-gray-600"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">System Type</label>
                        <select
                          value={newDb.db_type}
                          onChange={(e) => setNewDb({ ...newDb, db_type: e.target.value as any })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="postgresql" className="bg-[#1a1a1f]">PostgreSQL</option>
                          <option value="mysql" className="bg-[#1a1a1f]">MySQL</option>
                          <option value="mongodb_atlas" className="bg-[#1a1a1f]">MongoDB Atlas</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Connection URI</label>
                      <div className="relative">
                        <input
                          type="password"
                          placeholder={
                            newDb.db_type === 'mongodb_atlas'
                              ? "mongodb+srv://user:pass@cluster.mongodb.net/dbname"
                              : newDb.db_type === 'postgresql'
                              ? "postgresql://user:pass@host:port/db"
                              : "mysql://user:pass@host:port/db"
                          }
                          value={newDb.connection_string}
                          onChange={(e) => setNewDb({ ...newDb, connection_string: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-gray-600"
                          required
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600">
                          <Shield className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-600 px-1 mt-1 font-medium">Your credentials are encrypted and stored securely.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsAddDbOpen(false)}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addDbMutation.isPending}
                      className="flex-[2] py-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xl shadow-primary-600/20 active:scale-[0.98]"
                    >
                      {addDbMutation.isPending ? 'Connecting...' : 'Test & Save Connection'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Profile Modal */}
        <AnimatePresence>
          {isProfileOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsProfileOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md glass-effect border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 z-10"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center font-bold text-xl border border-primary-500/20 shadow-lg shadow-primary-500/10">
                      PP
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Pratyush Poddar</h3>
                      <p className="text-xs text-gray-400">System Administrator</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsProfileOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Email Address</label>
                      <div className="text-sm font-medium text-gray-200">pratyush@example.com</div>
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <label className="text-xs text-gray-500 font-medium">Role Access</label>
                      <div className="text-sm font-medium text-gray-200">Super Admin / Root</div>
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <label className="text-xs text-gray-500 font-medium">Last Login</label>
                      <div className="text-sm font-medium text-gray-200">{new Date().toLocaleDateString()}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full btn-primary"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteConfirmId(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm glass-effect border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6"
              >
                <div className="text-center">
                  <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-7 h-7 text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Delete Database?</h3>
                  <p className="text-sm text-gray-400 mb-6">
                    This will permanently remove the database connection and all associated query history. This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all border border-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={deleteMutation.isPending}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Table Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteTableConfirmName && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteTableConfirmName(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm glass-effect border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6"
              >
                <div className="text-center">
                  <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-7 h-7 text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Delete Table?</h3>
                  <p className="text-sm text-gray-400 mb-6">
                    Are you sure you want to drop the table <span className="font-mono text-white">'{deleteTableConfirmName}'</span>? This action will permanently remove all data and structure and cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteTableConfirmName(null)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all border border-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeleteTable}
                      disabled={deleteTableMutation.isPending}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                    >
                      {deleteTableMutation.isPending ? 'Dropping...' : 'Drop'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
