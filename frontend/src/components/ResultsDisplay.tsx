import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Table, 
  BarChart3, 
  LineChart, 
  PieChart, 
  Download,
  Sparkles,
  Code,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart as RechartsLine, 
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { Query } from '@/types';
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-ignore
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ResultsDisplayProps {
  query: Query;
  isDark?: boolean;
}

type ViewMode = 'table' | 'bar' | 'line' | 'pie';

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function ResultsDisplay({ query, isDark = true }: ResultsDisplayProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showSQL, setShowSQL] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  
  if (!query.results || query.results.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">No results to display</p>
      </div>
    );
  }
  
  const columns = Object.keys(query.results[0]);
  
  // Prepare chart data
  const chartData = query.results.slice(0, 10).map(row => {
    const item: any = {};
    columns.forEach(col => {
      item[col] = row[col];
    });
    return item;
  });
  
  const downloadCSV = () => {
    const csv = [
      columns.join(','),
      ...query.results!.map(row => 
        columns.map(col => JSON.stringify(row[col])).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Results ({query.result_count})
            </h3>
            {query.execution_time_ms && (
              <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                {query.execution_time_ms}ms
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="btn-secondary p-2"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowSQL(!showSQL)}
              className={`p-2 rounded-lg transition-all ${
                showSQL ? 'bg-primary-600' : 'glass-effect hover:bg-white/10'
              }`}
              title="Show SQL"
            >
              <Code className="w-4 h-4" />
            </button>
            
            {query.insights && (
              <button
                onClick={() => setShowInsights(!showInsights)}
                className={`p-2 rounded-lg transition-all ${
                  showInsights ? 'bg-primary-600' : 'glass-effect hover:bg-white/10'
                }`}
                title="Show Insights"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* View mode selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'table' ? 'bg-primary-600' : 'glass-effect hover:bg-white/10'
            }`}
          >
            <Table className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('bar')}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'bar' ? 'bg-primary-600' : 'glass-effect hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('line')}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'line' ? 'bg-primary-600' : 'glass-effect hover:bg-white/10'
            }`}
          >
            <LineChart className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('pie')}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'pie' ? 'bg-primary-600' : 'glass-effect hover:bg-white/10'
            }`}
          >
            <PieChart className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* SQL Display */}
      {showSQL && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card"
        >
          <h4 className="text-sm font-semibold text-slate-600 dark:text-gray-300 mb-3">Generated SQL</h4>
          <div className="code-block">
            <SyntaxHighlighter language="sql" style={vscDarkPlus}>
              {query.generated_sql}
            </SyntaxHighlighter>
          </div>
          {query.sql_explanation && (
            <div className="mt-4 p-4 glass-effect rounded-lg">
              <p className="text-sm text-slate-600 dark:text-gray-300">{query.sql_explanation}</p>
            </div>
          )}
        </motion.div>
      )}
      
      {/* Insights */}
      {showInsights && query.insights && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card"
        >
          <h4 className="text-sm font-semibold text-slate-600 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-400" />
            AI Insights
          </h4>
          <div className="space-y-3">
            {query.insights.insights.map((insight, index) => (
              <div
                key={index}
                className="p-4 glass-effect rounded-lg border-l-4"
                style={{
                  borderLeftColor: insight.type === 'trend' ? '#0ea5e9' :
                                  insight.type === 'anomaly' ? '#ec4899' :
                                  insight.type === 'pattern' ? '#8b5cf6' : '#10b981'
                }}
              >
                <h5 className="font-semibold text-slate-800 dark:text-white mb-1">{insight.title}</h5>
                <p className="text-sm text-slate-600 dark:text-gray-300">{insight.description}</p>
                <div className="mt-2 text-xs text-slate-500 dark:text-gray-400">
                  Confidence: {(insight.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Results Display */}
      <div className="card">
        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-dark-700">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="text-left py-3 px-4 text-sm font-semibold text-slate-600 dark:text-gray-300"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.results.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 dark:border-dark-800 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col} className="py-3 px-4 text-sm text-slate-600 dark:text-gray-300">
                        {JSON.stringify(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {viewMode === 'bar' && (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
              <XAxis dataKey={columns[0]} stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  color: isDark ? '#f8fafc' : '#1e293b'
                }}
              />
              <Legend />
              {columns.slice(1).map((col, index) => (
                <Bar 
                  key={col} 
                  dataKey={col} 
                  fill={COLORS[index % COLORS.length]} 
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
        
        {viewMode === 'line' && (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsLine data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
              <XAxis dataKey={columns[0]} stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  color: isDark ? '#f8fafc' : '#1e293b'
                }}
              />
              <Legend />
              {columns.slice(1).map((col, index) => (
                <Line 
                  key={col} 
                  type="monotone" 
                  dataKey={col} 
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </RechartsLine>
          </ResponsiveContainer>
        )}
        
        {viewMode === 'pie' && columns.length >= 2 && (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsPie>
              <Pie
                data={chartData}
                dataKey={columns[1]}
                nameKey={columns[0]}
                cx="50%"
                cy="50%"
                outerRadius={120}
                label
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  color: isDark ? '#f8fafc' : '#1e293b'
                }}
              />
              <Legend />
            </RechartsPie>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
