import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { Select } from '@openai/apps-sdk-ui/components/Select';
import { RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export function LogsPanel() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Mock data
  const logs: LogEntry[] = [
    { id: '1', timestamp: '2023-11-25 10:30:01', level: 'info', message: 'Agent initialized successfully' },
    { id: '2', timestamp: '2023-11-25 10:30:05', level: 'debug', message: 'Loading context from vector store' },
    { id: '3', timestamp: '2023-11-25 10:31:12', level: 'warn', message: 'Response time > 500ms' },
    { id: '4', timestamp: '2023-11-25 10:32:45', level: 'info', message: 'User request processed' },
    { id: '5', timestamp: '2023-11-25 10:35:00', level: 'error', message: 'Connection timeout to MCP server' },
  ];

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter;
    const matchesSearch = log.message.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 h-[calc(100vh-12rem)] flex flex-col">
      <div className="flex gap-4 items-center bg-cortex-surface p-4 rounded-xl border border-cortex-border shadow-sm">
        <div className="w-48">
          <Select
            value={filter}
            onChange={(option) => setFilter(option.value)}
            options={[
              { label: 'All Levels', value: 'all' },
              { label: 'Debug', value: 'debug' },
              { label: 'Info', value: 'info' },
              { label: 'Warning', value: 'warn' },
              { label: 'Error', value: 'error' },
            ]}
            triggerClassName="bg-cortex-bg border-cortex-border text-cortex-text"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="relative group">
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-cortex-bg border-cortex-border text-cortex-text placeholder:text-cortex-muted focus:ring-cortex-accent transition-all duration-200"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted group-focus-within:text-cortex-accent transition-colors duration-200 pointer-events-none" />
          </div>
        </div>
        <Button variant="outline" color="secondary" onClick={() => console.log('Refresh')} className="border-cortex-border text-cortex-text hover:bg-cortex-bg hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex-1 bg-cortex-bg rounded-xl border border-cortex-border shadow-inner overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-cortex-border bg-cortex-surface/50 flex justify-between items-center">
          <span className="text-xs font-mono text-cortex-muted">Showing {filteredLogs.length} events</span>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-1 font-mono text-sm custom-scrollbar">
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex gap-4 hover:bg-cortex-surface/50 p-1.5 rounded transition-colors duration-150 group">
              <span className="text-cortex-muted min-w-[150px] select-none">{log.timestamp}</span>
              <span className={`
                font-bold min-w-[60px] uppercase text-xs tracking-wider py-0.5 px-1.5 rounded
                ${log.level === 'error' ? 'bg-red-500/10 text-red-400' :
                  log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-400' :
                    log.level === 'info' ? 'bg-blue-500/10 text-blue-400' : 'text-cortex-muted'}
              `}>
                {log.level}
              </span>
              <span className="text-cortex-text group-hover:text-white transition-colors">{log.message}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-cortex-muted opacity-50">
              <Search className="w-12 h-12 mb-4" />
              <p>No logs found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
