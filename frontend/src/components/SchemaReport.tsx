import React from 'react';
import { motion } from 'framer-motion';
import { Table, Download, Info, CheckCircle2, AlertCircle, Cpu, Eye } from 'lucide-react';
import type { SchemaInfo } from '@/types';
import toast from 'react-hot-toast';

interface SchemaReportProps {
  schema: SchemaInfo;
  analysis: any;
  isLoadingAnalysis: boolean;
}

const SchemaReport: React.FC<SchemaReportProps> = ({ schema, analysis, isLoadingAnalysis }) => {
  const exportToCSV = () => {
    try {
      let csvContent = "";
      
      // SECTION 1: AI ANALYSIS
      csvContent += "=== DATABASE AI ANALYSIS ===\n";
      csvContent += `Summary,"${(analysis?.summary || 'N/A').replace(/"/g, '""')}"\n`;
      csvContent += `Core Entities,"${(analysis?.core_entities || []).join(', ')}"\n`;
      csvContent += `Relationships,"${(analysis?.relationship_overview || 'N/A').replace(/"/g, '""')}"\n`;
      csvContent += `Complexity Rating,"${analysis?.complexity_rating || 'N/A'}/10"\n\n`;

      csvContent += "=== NORMALIZATION & BEST PRACTICES ===\n";
      (analysis?.normalization_tips || []).forEach((tip: string) => {
        csvContent += `Tip,"${tip.replace(/"/g, '""')}"\n`;
      });
      (analysis?.best_practices || []).forEach((practice: string) => {
        csvContent += `Best Practice,"${practice.replace(/"/g, '""')}"\n`;
      });
      csvContent += "\n";

      // SECTION 2: SCHEMA DEFINITION
      csvContent += "=== SCHEMA DEFINITION ===\n";
      csvContent += "Table Name,Column Name,Data Type,Nullable,Primary Key\n";

      Object.entries(schema.tables).forEach(([tableName, table]) => {
        table.columns.forEach(col => {
          csvContent += `"${tableName}","${col.name}","${col.type}","${col.nullable}","${col.primary_key}"\n`;
        });
      });
      csvContent += "\n";

      // SECTION 3: DATA SAMPLES
      csvContent += "=== DATA SAMPLES ===\n";
      Object.entries(schema.tables).forEach(([tableName, table]) => {
        if (table.sample_data && table.sample_data.length > 0) {
          csvContent += `TABLE: ${tableName}\n`;
          const headers = Object.keys(table.sample_data[0]);
          csvContent += headers.join(",") + "\n";
          
          table.sample_data.forEach(row => {
            const values = headers.map(h => {
              const val = row[h];
              return `"${(val === null || val === undefined ? '' : String(val)).replace(/"/g, '""')}"`;
            });
            csvContent += values.join(",") + "\n";
          });
          csvContent += "\n";
        }
      });

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `database_full_report_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Full report exported to CSV!');
    } catch (error) {
      console.error('Export Error:', error);
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header Info */}
      <div className="p-6 border-b border-white/10 bg-gradient-to-r from-primary-600/20 to-transparent flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Table className="w-5 h-5 text-primary-400" />
            Detailed Schema & Analysis Report
          </h2>
          <p className="text-sm text-gray-400">Deep structural overview with AI-generated feedback and data previews</p>
        </div>
        <button
          onClick={exportToCSV}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm shadow-lg shadow-primary-500/20"
        >
          <Download className="w-4 h-4" />
          Export Full Report
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar pb-20">
        {/* AI Analysis Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary-400 font-bold uppercase tracking-wider text-[10px]">
            <Cpu className="w-3.5 h-3.5" />
            AI Database Intelligence
          </div>

          {isLoadingAnalysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
              <div className="h-32 bg-white/5 rounded-xl border border-white/5" />
              <div className="h-32 bg-white/5 rounded-xl border border-white/5" />
            </div>
          ) : analysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 glass-effect rounded-2xl border border-white/10 space-y-3 shadow-xl"
              >
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Info className="w-4 h-4 text-blue-400" />
                  Architectural Summary
                </div>
                <p className="text-sm text-gray-400 leading-relaxed italic">"{analysis.summary}"</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {analysis.core_entities?.map((entity: string) => (
                    <span key={entity} className="px-2 py-1 bg-primary-500/10 text-primary-300 rounded text-[9px] font-mono border border-primary-500/20">
                      {entity}
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-5 glass-effect rounded-2xl border border-white/10 space-y-3 shadow-xl"
              >
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  AI Engineering Feedback
                </div>
                <ul className="space-y-2">
                  {analysis.normalization_tips?.slice(0, 3).map((tip: string, i: number) => (
                    <li key={i} className="text-[11px] text-gray-400 flex items-start gap-2">
                      <span className="text-primary-500 shrink-0">→</span> {tip}
                    </li>
                  ))}
                  {analysis.best_practices?.slice(0, 2).map((practice: string, i: number) => (
                    <li key={i} className="text-[11px] text-gray-300 flex items-start gap-2">
                      <span className="text-green-500 shrink-0">✓</span> {practice}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          ) : (
            <div className="p-10 text-center glass-effect rounded-2xl border border-white/5 text-gray-500 flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 opacity-20" />
              <p>Database analysis engine is warming up...</p>
            </div>
          )}
        </section>

        {/* Tables & Previews */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="text-white font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
              <Table className="w-3.5 h-3.5 text-primary-400" />
              Structural Definition & Previews ({schema.total_tables})
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-12">
            {Object.entries(schema.tables).map(([tableName, table], tableIdx) => (
              <motion.div
                key={tableName}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: tableIdx * 0.05 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                  <h3 className="text-lg font-bold text-white tracking-tight">{tableName}</h3>
                  <div className="flex gap-2">
                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-md border border-white/5 uppercase font-mono tracking-tighter">
                      {table.columns.length} Fields
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Column List */}
                  <div className="lg:col-span-5 rounded-xl border border-white/10 bg-black/20 overflow-hidden h-fit">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-gray-500 text-[10px] uppercase font-bold border-b border-white/5">
                        <tr>
                          <th className="px-3 py-2">Field</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2 text-center">Key</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-400">
                        {table.columns.map(col => (
                          <tr key={col.name} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2 font-medium text-gray-200">{col.name}</td>
                            <td className="px-3 py-2 font-mono text-[10px] opacity-60 italic">{col.type}</td>
                            <td className="px-3 py-2 text-center">
                              {col.primary_key && <span className="text-[8px] bg-primary-500/20 text-primary-400 px-1 rounded border border-primary-500/20 font-bold uppercase">PK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Data Preview */}
                  <div className="lg:col-span-7 space-y-2">
                    <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-widest pl-1">
                      <Eye className="w-3 h-3" />
                      Live Data Preview
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden backdrop-blur-sm">
                      {table.sample_data && table.sample_data.length > 0 ? (
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/10">
                                {Object.keys(table.sample_data[0]).map(h => (
                                  <th key={h} className="px-3 py-2 font-bold text-primary-300/70 border-r border-white/5 last:border-0">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {table.sample_data.slice(0, 5).map((row, i) => (
                                <tr key={i} className="hover:bg-white/[0.05] transition-colors">
                                  {Object.values(row).map((v, j) => (
                                    <td key={j} className="px-3 py-2 text-gray-400 border-r border-white/5 last:border-0 truncate max-w-[150px]">
                                      {v === null ? <span className="text-red-500/30">NULL</span> : String(v)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-xs text-gray-500 italic">No matching records found in this table.</div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SchemaReport;
