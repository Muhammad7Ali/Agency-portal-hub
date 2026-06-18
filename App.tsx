import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MetricCard } from './components/MetricCard';
import { Card } from './components/Card';
import { TaskBoard } from './components/TaskBoard';
import { DashboardOverview } from './components/DashboardOverview';
import { StatusDonut } from './components/StatusDonut';
import { DocumentsCard } from './components/DocumentsCard';
import { ClientsView } from './components/ClientsView';
import { getPhaseData } from './components/phaseUtils';
import { ClickUpList, ClickUpTask, Metrics } from './types';
import { fetchLists, fetchTasks } from './services/clickup';
import { generateExecutiveSummary } from './services/gemini';
import { 
  Layers, 
  CheckCircle2, 
  Activity, 
  Cpu, 
  AlertCircle, 
  Search,
  Bell,
  Filter,
  ArrowUpRight,
  MoreHorizontal,
  Menu,
  Command
} from 'lucide-react';

const App: React.FC = () => {
  // State
  const [lists, setLists] = useState<ClickUpList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ClickUpTask[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [allTasks, setAllTasks] = useState<ClickUpTask[]>([]);
  const [loadingAllTasks, setLoadingAllTasks] = useState(false);
  const [overallAiSummary, setOverallAiSummary] = useState<string>('');
  const [loadingOverallSummary, setLoadingOverallSummary] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 768);
  const [activeView, setActiveView] = useState<'dashboard' | 'external'>('dashboard');
  
  useEffect(() => {
    // Fetch clients
    fetch('/api/clients', {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
      .then(async res => {
          if (!res.ok) {
              const text = await res.text();
              throw new Error(`HTTP ${res.status}: ${text.substring(0, 50)}`);
          }
          return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(err => console.error("Failed to load clients in App", err));
  }, [selectedListId, activeView]);

  useEffect(() => {
    // Just refresh date occasionally
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Derived Metrics
  const metrics: Metrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => 
      ['complete', 'closed', 'done', 'finished'].includes(t.status.status.toLowerCase())
    ).length;
    
    const inProgress = total - completed;

    // Group by status for chart
    const statusCounts: Record<string, { count: number; color: string }> = {};
    tasks.forEach(t => {
      const s = t.status.status;
      if (!statusCounts[s]) {
        statusCounts[s] = { count: 0, color: t.status.color };
      }
      statusCounts[s].count++;
    });

    // Transform for Chart
    const byStatus = Object.entries(statusCounts).map(([name, data]) => ({
      name: name.toUpperCase(),
      value: data.count,
      fill: data.color || '#3f3f46'
    })).sort((a, b) => b.value - a.value);

    return { total, completed, inProgress, byStatus };
  }, [tasks]);

  const currentPhaseData = useMemo(() => getPhaseData(tasks), [tasks]);

  const currentListName = useMemo(() => 
    lists?.find(l => l.id === selectedListId)?.name || 'N/A', 
  [lists, selectedListId]);

  // Handlers
  const fetchAllProjectsTasks = async () => {
    if (lists.length === 0) return;
    setLoadingAllTasks(true);
    try {
      const allPromises = lists.map(list => 
        fetchTasks(list.id).then(tasks => 
          tasks.map(t => ({ ...t, listId: list.id, listName: list.name }))
        )
      );
      const results = await Promise.all(allPromises);
      const combinedTasks = results.flat();
      setAllTasks(combinedTasks);

      setLoadingOverallSummary(true);
      generateExecutiveSummary('All Client Projects', combinedTasks)
        .then(summary => setOverallAiSummary(summary))
        .catch(e => console.error(e))
        .finally(() => setLoadingOverallSummary(false));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAllTasks(false);
    }
  };

  useEffect(() => {
    if (lists.length > 0 && selectedListId === null && activeView === 'dashboard') {
      if (allTasks.length === 0) {
        fetchAllProjectsTasks();
      }
    }
  }, [lists, selectedListId, activeView]);

  const handleFetchLists = async () => {
    setLoadingLists(true);
    setError(null);
    try {
      const fetchedLists = await fetchLists();
      setLists(fetchedLists);
      if (fetchedLists.length === 0) {
        setError("No lists found in this folder.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch lists");
    } finally {
      setLoadingLists(false);
    }
  };

  useEffect(() => {
    handleFetchLists();
  }, []);

  const handleSelectList = async (listId: string) => {
    setActiveView('dashboard');
    setSelectedListId(listId);
    setLoadingTasks(true);
    setLoadingSummary(true);
    setAiSummary('');
    setError(null);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }

    try {
      const fetchedTasks = await fetchTasks(listId);
      setTasks(fetchedTasks);

      const listName = lists?.find(l => l.id === listId)?.name || 'Client';
      
      generateExecutiveSummary(listName, fetchedTasks)
        .then(summary => {
          setAiSummary(summary);
          setLoadingSummary(false);
        })
        .catch(e => {
          console.error(e);
          setAiSummary("Error generating executive report.");
          setLoadingSummary(false);
        });

    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
      setLoadingTasks(false);
      setLoadingSummary(false);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleNavigateDashboard = () => {
    setActiveView('dashboard');
    setSelectedListId(null);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };

  const handleNavigateClients = () => {
    setActiveView('all-clients');
    setSelectedListId(null);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#040404] text-white font-sans selection:bg-[#ff4d00]/30">
      
      {/* Mobile Overlay */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={handleSelectList}
        isLoadingLists={loadingLists}
        onFetchLists={handleFetchLists}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeView={activeView}
        onSelectExternal={() => {
          setActiveView('external');
          if (window.innerWidth < 768) setIsSidebarCollapsed(true);
        }}
        onNavigateDashboard={handleNavigateDashboard}
        onNavigateClients={handleNavigateClients}
      />

      {/* Main Content */}
      <main className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-72'} p-4 md:p-6 lg:px-8 lg:pt-6 lg:pb-4 overflow-y-auto min-h-screen relative flex flex-col`}>
        {/* Background Effects */}
        <div className="fixed inset-0 bg-[#040404] -z-20"></div>
        {/* Subtle grid instead of high contrast */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none -z-10 opacity-30"></div>
        <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-[#ff4d00]/5 blur-[150px] pointer-events-none -z-10"></div>

        {/* Header System */}
        {activeView !== 'all-clients' && (
        <header className="mb-12 relative shrink-0">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
             <div className="w-full flex items-center justify-between md:hidden mb-2">
                <div className="flex items-center gap-2">
                  <img 
                    src="https://raw.githubusercontent.com/Muhammad7Ali/IDE-MIND-Assest-/main/IDE%20MIND%20Logo(2000%20x%201000%20px).png" 
                    alt="IDE MIND Logo" 
                    className="w-24 h-auto object-contain" 
                  />
                </div>
                <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 text-zinc-400 hover:text-white">
                  <Menu size={24} />
                </button>
             </div>
             <div className="relative w-full md:w-[400px]">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
               <input 
                 type="text" 
                 placeholder="Search projects, tasks, or metrics..." 
                 className="w-full bg-[#070707] border border-white/5 rounded-full py-3 pl-12 pr-6 text-sm focus:outline-none focus:border-zinc-700 transition-all text-zinc-300 placeholder-zinc-600 shadow-sm"
               />
             </div>
             <div className="flex items-center gap-6">
                <span className="text-xs font-medium text-zinc-500">{currentTime}</span>
                
                <div className="flex items-center gap-3 pl-6 border-l border-white/5">
                   <button className="w-10 h-10 rounded-full bg-[#070707] border border-white/5 flex items-center justify-center hover:bg-white/5 transition-colors group">
                     <Bell className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                   </button>
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">JD</span>
                   </div>
                </div>
             </div>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
               <div className="flex items-center gap-2 mb-2">
                 <h2 className="text-zinc-500 text-[11px] font-semibold uppercase tracking-widest">
                  {activeView === 'external' ? 'Integration' : (selectedListId ? 'Project Dashboard' : currentTime)}
                 </h2>
                 {error && (
                    <span className="text-red-400 text-[10px] font-medium flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" /> {error}
                    </span>
                 )}
               </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-none font-display">
                {activeView === 'external' ? 'Zite Website' : (selectedListId ? currentListName : 'Dashboard')}
              </h1>
            </div>
            <div className="flex gap-2">
               <a href="https://wa.me/923110484556"
                 target="_blank"
                 rel="noopener noreferrer"
                 style={{
                   display: 'inline-flex',
                   alignItems: 'center',
                   gap: '10px',
                   background: '#ffffff',
                   color: '#111111',
                   fontSize: '14px',
                   fontWeight: 500,
                   padding: '11px 20px',
                   borderRadius: '10px',
                   textDecoration: 'none',
                   letterSpacing: '0.02em',
                   cursor: 'pointer'
                 }}
               >
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="#111111" xmlns="http://www.w3.org/2000/svg">
                   <path d="M20.52 3.48A11.93 11.93 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.97L0 24l6.22-1.57A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.22-3.48-8.52ZM12 21.94a9.89 9.89 0 0 1-5.04-1.38l-.36-.21-3.7.93.99-3.6-.24-.38A9.93 9.93 0 0 1 2.06 12C2.06 6.5 6.5 2.06 12 2.06S21.94 6.5 21.94 12 17.5 21.94 12 21.94Zm5.44-7.44c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35Z"/>
                 </svg>
                 CONTACT ON WHATSAPP
               </a>
            </div>
          </div>
        </header>
        )}

        <div className="flex-1 flex flex-col">
          {activeView === 'all-clients' ? (
             <ClientsView lists={lists} allTasks={allTasks} />
          ) : activeView === 'external' ? (
            <div className="flex-1 w-full rounded-lg overflow-hidden border border-white/10 bg-white min-h-[70vh] shadow-2xl">
              <iframe 
                src="https://6f3oseamt6.zite.so" 
                className="w-full h-full min-h-[70vh] border-0"
                title="Zite Integration"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : selectedListId ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {/* 1. Top Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="col-span-1 min-h-[160px]">
                  <MetricCard 
                    title="Total Tasks" 
                    value={metrics.total} 
                    subValue="All phases"
                    icon={<Layers className="w-5 h-5" />}
                  />
                </div>
                <div className="col-span-1 min-h-[160px]">
                  <MetricCard 
                    title="Active Work" 
                    value={metrics.inProgress} 
                    subValue={`${metrics.total > 0 ? ((metrics.inProgress / metrics.total) * 100).toFixed(1) : 0}% of workload`}
                    icon={<Activity className="w-5 h-5" />}
                    active={false}
                  />
                </div>
                <div className="col-span-1 min-h-[160px]">
                  <MetricCard 
                    title="Completion Rate" 
                    value={`${metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}%`} 
                    subValue="Target: 80%"
                    icon={<CheckCircle2 className="w-5 h-5" />}
                  />
                </div>
                 <div className="col-span-1 min-h-[160px]">
                  <MetricCard 
                    title="Upcoming Deadlines" 
                    value={`${currentPhaseData.count}`} 
                    subValue={currentPhaseData.daysText.toUpperCase()}
                    icon={<MoreHorizontal className="w-5 h-5" />}
                  />
                </div>
              </div>

              {/* 2. Graphs Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Provide placeholder for left span or just don't center it. We can just center StatusDonut or make it span half */}
                 <div className="lg:col-span-1">
                    <Card className="h-full min-h-[380px]" title="STATUS DISTRIBUTION">
                       <StatusDonut data={metrics.byStatus} total={metrics.total} />
                    </Card>
                 </div>
                 <div className="lg:col-span-1">
                    <DocumentsCard clientId={selectedListId || 'global'} mode="admin" className="h-full min-h-[380px]" />
                 </div>
              </div>

              {/* 3. AI Summary Module */}
              <div className="bg-gradient-to-r from-[#070707] to-[#0a0a0a] border border-white/5 rounded-lg p-8 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                 
                 <div className="flex gap-6 items-start relative z-10">
                   <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-white/10">
                      <Cpu className="w-6 h-6 text-black" />
                   </div>
                   <div className="flex-1 pt-1">
                      <div className="flex items-center gap-3 mb-4">
                         <h3 className="text-white font-bold uppercase tracking-wide text-xs">Executive Summary</h3>
                         <div className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                           AI ANALYSIS
                         </div>
                      </div>
                      {loadingSummary ? (
                         <div className="flex items-center gap-3 text-zinc-500 text-sm animate-pulse">
                           <div className="h-4 w-2/3 bg-white/5 rounded"></div>
                         </div>
                      ) : (
                        <p className="text-zinc-300 text-sm leading-7 max-w-4xl font-normal">
                          {aiSummary || "Select a project to generate an intelligence report."}
                        </p>
                      )}
                   </div>
                 </div>
              </div>

              {/* 4. Modular Task Board */}
              <div className="pt-6">
                 <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                   <div className="flex items-center gap-3">
                     <h2 className="text-lg font-bold text-white tracking-tight">Project Phases</h2>
                     <span className="text-zinc-500 text-sm">/</span>
                     <span className="text-zinc-500 text-sm font-medium">Kanban View</span>
                   </div>
                 </div>
                 
                 {loadingTasks ? (
                   <div className="h-64 flex flex-col items-center justify-center text-zinc-500 space-y-4 rounded-lg bg-[#070707]/50">
                      <div className="w-8 h-8 border-2 border-zinc-800 border-t-white rounded-full animate-spin"></div>
                      <p className="text-xs font-medium uppercase tracking-widest">Loading tasks...</p>
                   </div>
                 ) : (
                   <TaskBoard tasks={tasks} />
                 )}
              </div>

            </div>
          ) : (
            <DashboardOverview 
              lists={lists} 
              allTasks={allTasks} 
              loadingAllTasks={loadingAllTasks} 
              overallAiSummary={overallAiSummary} 
              loadingOverallSummary={loadingOverallSummary} 
              onNavigateToList={handleSelectList} 
            />
          )}
        </div>

        {/* Global Footer */}
        <footer className="mt-4 border-t border-white/5 pt-4 pb-0 flex flex-col md:flex-row items-center justify-between relative gap-4 text-zinc-600">
           <div className="flex items-center gap-6 text-[11px] font-medium tracking-wide">
             <span>&copy; 2026 IDE MIND</span>
             <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
             <span>Privacy Policy</span>
             <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
             <span>Terms of Service</span>
           </div>

           <div className="flex items-center gap-4">
              <span className="text-[11px] font-mono font-medium text-zinc-600">v2.4.0 (Stable)</span>
           </div>
        </footer>

      </main>
    </div>
  );
};

export default App;