import React, { useMemo, useState, useEffect } from 'react';
import { ClickUpTask, ClickUpStatus } from '../types';
import { Check, LayoutList, CircleDashed, X, Calendar, AlignLeft } from 'lucide-react';

interface TaskBoardProps {
  tasks: ClickUpTask[];
}

// Configuration for the 5 fixed stages
const STAGES = [
  { 
    id: 'planning', 
    label: 'Planning', 
    number: '01', 
    keywords: ['planning', 'strategy', 'discovery'], 
  },
  { 
    id: 'design', 
    label: 'Design', 
    number: '02', 
    keywords: ['design', 'wireframe', 'ui', 'ux'], 
  },
  { 
    id: 'revision', 
    label: 'Revision', 
    number: '03', 
    keywords: ['revision', 'feedback', 'review'], 
  },
  { 
    id: 'testing', 
    label: 'Testing', 
    number: '04', 
    keywords: ['testing', 'qa', 'staging'], 
  },
  { 
    id: 'handoff', 
    label: 'Handoff', 
    number: '05', 
    keywords: ['handoff', 'delivery', 'live', 'prod'], 
  }
];

export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks }) => {
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<ClickUpTask | null>(null); // Keep for backlog if needed or remove entirely. We'll keep it for backlog.
  
  useEffect(() => {
    const mainElement = document.querySelector('main');
    if (selectedPhase || selectedTask) {
      document.body.style.overflow = 'hidden';
      if (mainElement) {
        mainElement.style.overflow = 'hidden';
      }
    } else {
      document.body.style.overflow = '';
      if (mainElement) {
        mainElement.style.overflow = '';
      }
    }
    return () => {
      document.body.style.overflow = '';
      if (mainElement) {
        mainElement.style.overflow = '';
      }
    };
  }, [selectedPhase, selectedTask]);

  // Helper to safely extract parent ID
  const getParentId = (task: ClickUpTask): string | null => {
    if (!task.parent) return null;
    if (typeof task.parent === 'object' && (task.parent as any).id) {
      return (task.parent as any).id;
    }
    return String(task.parent);
  };

  // Helper status checkers
  const isStatusDone = (status?: string) => ['complete', 'closed', 'done', 'finished'].includes(status?.toLowerCase() || '');
  const isStatusInProgress = (status?: string) => ['in progress', 'running', 'doing', 'active', 'development', 'planning', 'in review', 'review'].includes(status?.toLowerCase() || '');

  // Group tasks logic
  const { boardData, backlog } = useMemo(() => {
    // 1. Build Parent-Child Map
    const tasksById = new Map<string, ClickUpTask>();
    const childrenByParent = new Map<string, ClickUpTask[]>();
    const roots: ClickUpTask[] = [];

    tasks.forEach(t => tasksById.set(t.id, t));

    tasks.forEach(t => {
      const pId = getParentId(t);
      if (pId && tasksById.has(pId)) {
        if (!childrenByParent.has(pId)) childrenByParent.set(pId, []);
        childrenByParent.get(pId)!.push(t);
      } else {
        roots.push(t);
      }
    });

    // 2. Initialize Buckets
    const buckets = STAGES.map(stage => ({
      ...stage,
      items: [] as ClickUpTask[],
      mainTaskStatus: null as ClickUpStatus | null
    }));
    
    const backlogTasks: ClickUpTask[] = [];

    // 3. Assign Roots + Descendants to Stages
    roots.forEach(root => {
      const statusLower = root.status.status.toLowerCase();
      const nameLower = root.name.toLowerCase();
      
      let targetBucketIndex = -1;
      
      // Find matching bucket based on Root Task
      for (let i = 0; i < buckets.length; i++) {
        if (buckets[i].keywords.some(k => statusLower.includes(k) || nameLower.includes(k))) {
          targetBucketIndex = i;
          break;
        }
      }

      // Gather the whole family (Root + Children)
      const family: ClickUpTask[] = [];
      family.push(root);
      if (childrenByParent.has(root.id)) {
        family.push(...childrenByParent.get(root.id)!);
      }

      if (targetBucketIndex !== -1) {
        buckets[targetBucketIndex].items.push(...family);
      } else {
        backlogTasks.push(...family);
      }
    });

    // 4. Identify Main Task Status & Cleanup
    const finalBuckets = buckets.map(bucket => {
        // Try to identify the "Main Task" / Header Task
        // Priority: Exact match name -> Contains name
        const mainTask = bucket.items.find(t => 
             t.name.trim().toLowerCase() === bucket.label.toLowerCase()
        );
        
        let processedItems = bucket.items;
        let status = null;

        if (mainTask) {
            status = mainTask.status;
            // Filter out the main task from the checklist
            processedItems = bucket.items.filter(t => t.id !== mainTask.id);
        } else {
            // Fallback: If no exact main task found, check for loose match
            const looseMatch = bucket.items.find(t => t.name.toLowerCase().includes(bucket.label.toLowerCase()));
            if (looseMatch) status = looseMatch.status;
        }

        return { 
            ...bucket, 
            items: processedItems,
            mainTaskStatus: status 
        };
    });

    return { boardData: finalBuckets, backlog: backlogTasks };
  }, [tasks]);

  const renderTaskRow = (task: ClickUpTask, isParentDone: boolean, isGrayMode: boolean) => {
    // If parent is visually done, subtasks appear done
    const realDone = isStatusDone(task.status.status);
    const visualDone = isParentDone || realDone;
    
    const statusColor = task.status.color || '#52525b';
    
    // Determine text/dot color based on status
    // If 'to do', usually gray. If active, use color.
    const isToDo = ['to do', 'open', 'pending'].includes(task.status.status.toLowerCase());
    const dotColor = visualDone ? '#52525b' : (isToDo ? '#71717a' : statusColor);
    const textColor = visualDone ? '#52525b' : (isToDo ? '#a1a1aa' : statusColor);

    return (
      <div key={task.id} className="flex items-center justify-between group mb-4 last:mb-0 relative z-10 py-1">
         <div className="flex items-center gap-4 min-w-0">
            {/* Custom Checkbox */}
            <div 
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-300 shrink-0 ${
                   visualDone 
                     ? 'bg-zinc-800 border-transparent' 
                     : `bg-transparent ${isGrayMode ? 'border-zinc-700' : 'border-zinc-700 group-hover:border-zinc-500'}`
                }`}
            >
               {visualDone && <Check className="w-3.5 h-3.5 text-zinc-500" />}
            </div>

            {/* Task Name */}
            <div 
              className={`text-sm text-left truncate transition-colors ${
                visualDone 
                  ? 'text-zinc-600 line-through font-normal' 
                  : `font-medium ${isGrayMode ? 'text-zinc-400' : 'text-zinc-200 group-hover:text-white'}`
              }`}
            >
              {task.name}
            </div>
         </div>

         {/* Right Side Status - Subtask Style (Dark Pill with Dot) */}
         <div className="flex items-center gap-3 shrink-0 ml-4">
             {/* Assignee Avatar */}
             {!visualDone && task.assignees.length > 0 && (
                <div className="flex -space-x-2">
                   {task.assignees.slice(0, 2).map(u => (
                      <div key={u.id} className="w-6 h-6 rounded-full bg-zinc-800 ring-2 ring-[#070707] flex items-center justify-center text-[9px] font-bold text-zinc-400">
                         {u.username.charAt(0)}
                      </div>
                   ))}
                </div>
             )}

             {/* Status Badge */}
             <div 
               className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-all duration-300 ${
                 visualDone 
                    ? 'bg-transparent border-transparent opacity-50' 
                    : 'bg-[#0a0a0a] border-[#27272a]'
               }`}
             >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }}></div>
                <span 
                    className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: textColor }}
                >
                    {task.status.status}
                </span>
             </div>
         </div>
      </div>
    );
  };

  return (
    <div className="space-y-12">
      {/* Main Stages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {boardData.map((stage) => {
          const mainStatus = stage.mainTaskStatus;
          const statusStr = mainStatus?.status || 'Pending';
          const statusColor = mainStatus?.color || '#52525b';
          
          const inProgress = isStatusInProgress(statusStr);
          const isDone = isStatusDone(statusStr);
          
          // Card is Orange ONLY when In Progress
          // Gray if To Do or Done
          const isOrangeTheme = inProgress;
          const accentColor = isOrangeTheme ? '#ff4d00' : '#52525b'; 
          
          const containerClasses = isOrangeTheme
            ? "bg-[#070707] border border-[#ff4d00]/20 shadow-[0_10px_40px_-15px_rgba(255,77,0,0.1)]"
            : "bg-[#070707] border border-zinc-800/60 hover:border-zinc-700"; 

          return (
            <div 
              key={stage.id} 
              onClick={() => setSelectedPhase(stage)}
              className={`${containerClasses} p-6 md:p-8 rounded-lg relative overflow-hidden group transition-all duration-500 flex flex-col min-h-[360px] cursor-pointer`}
            >
              {/* Interactive Gradient - Only for Orange Theme */}
              {isOrangeTheme && (
                 <>
                  <div className="absolute inset-0 bg-gradient-to-br from-[#ff4d00]/[0.03] to-transparent opacity-100 pointer-events-none"></div>
                  <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#ff4d00]/10 rounded-full blur-[60px] pointer-events-none"></div>
                 </>
              )}

              {/* Header Layout */}
              <div className="flex flex-col mb-10 relative z-10">
                  <div className="flex justify-between items-start">
                      {/* Big Number Top Left */}
                      <span className="text-6xl font-mono font-bold tracking-tighter leading-none select-none transition-colors duration-500" style={{ color: accentColor, opacity: isOrangeTheme ? 0.2 : 0.05 }}>
                          {stage.number}
                      </span>

                      {/* Top Right: Status Pill (Main Task Style) */}
                      <div 
                        className={`px-4 py-1.5 rounded-full border flex items-center gap-2 shadow-lg transition-all duration-500 bg-[#040404]`}
                        style={{
                            borderColor: isDone ? '#27272a' : (statusColor),
                            boxShadow: isDone ? 'none' : `0 0 15px -8px ${statusColor}40`
                        }}
                      >
                         <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: isDone ? '#52525b' : statusColor }}></div>
                         <span 
                            className={`text-[10px] font-bold uppercase tracking-wider`}
                            style={{ color: isDone ? '#52525b' : statusColor }}
                         >
                            {statusStr}
                         </span>
                      </div>
                  </div>

                  {/* Label */}
                  <div className="flex items-center gap-4 mt-6">
                      <div className={`w-0.5 h-6 ${isOrangeTheme ? 'bg-[#ff4d00]' : 'bg-zinc-700'}`}></div>
                      <h3 className={`text-lg font-bold uppercase tracking-widest transition-colors duration-300 ${isOrangeTheme ? 'text-white' : 'text-zinc-500'}`}>
                          {stage.label}
                      </h3>
                  </div>
              </div>

              {/* Content */}
              <div className="relative z-10 flex-1">
                 {stage.items.map(item => renderTaskRow(item, isDone, !isOrangeTheme))}
                 
                 {stage.items.length === 0 && (
                   <div className="h-full flex items-center justify-center -mt-8">
                      <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-800">No active tasks</span>
                   </div>
                 )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Backlog Section */}
      {backlog.length > 0 && (
        <div className="border-t border-white/5 pt-12 animate-in fade-in duration-700">
           <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 bg-[#070707] rounded-lg border border-white/5">
                 <LayoutList className="w-4 h-4 text-zinc-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Backlog</h3>
                <p className="text-[11px] text-zinc-500 mt-1">
                   <span className="font-mono">{backlog.length}</span> unassigned tasks
                </p>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {backlog.map(item => {
                 const isDone = isStatusDone(item.status.status);
                 const statusColor = item.status.color || '#52525b';
                 return (
                   <div key={item.id} className="bg-[#070707] border border-white/5 hover:border-zinc-700 p-5 rounded-lg transition-all group flex items-start gap-4">
                      <div className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${isDone ? 'bg-zinc-800 border-transparent' : 'border-zinc-800'}`}>
                          {isDone && <Check className="w-3 h-3 text-zinc-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <CircleDashed className="w-3 h-3 text-zinc-600" />
                                {/* Backlog also gets the nice badge */}
                                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#0a0a0a] border border-zinc-800">
                                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: statusColor }}></div>
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500">{item.status.status}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedTask(item)} className={`text-sm font-medium block text-left mb-1 truncate cursor-pointer ${isDone ? 'text-zinc-600 line-through' : 'text-zinc-300 group-hover:text-white'}`}>
                            {item.name}
                        </button>
                      </div>
                   </div>
                 )
              })}
           </div>
        </div>
      )}

      {/* Phase Modal */}
      {selectedPhase && (
        <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#040404]/95 backdrop-blur-md animate-in fade-in duration-200 custom-scrollbar" onClick={() => setSelectedPhase(null)}>
          <div className="min-h-full flex flex-col justify-start items-center p-4 py-8 sm:p-8">
            <div 
              className="w-full max-w-4xl bg-[#0a0a0a] border border-[#ff4d00]/20 shadow-[0_10px_50px_-15px_rgba(255,77,0,0.2)] rounded-2xl overflow-hidden relative flex flex-col shrink-0"
              onClick={e => e.stopPropagation()}
            >
             {/* Gradient Background */}
             <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff4d00]/10 rounded-full blur-[100px] pointer-events-none"></div>

             {/* Header */}
             <div className="flex flex-col p-5 sm:p-8 border-b border-white/5 relative z-10 shrink-0 bg-[#0a0a0a]/80 backdrop-blur-md">
                <div className="flex items-start justify-between">
                    {/* Big Number */}
                    <span className="text-3xl sm:text-4xl font-mono font-bold tracking-tighter leading-none select-none text-[#ff4d00] opacity-20">
                        {selectedPhase.number}
                    </span>
                    <button 
                      onClick={() => setSelectedPhase(null)}
                      className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex items-center gap-3 mt-4 sm:mt-5">
                    <div className="w-0.5 h-4 bg-[#ff4d00]"></div>
                    <h3 className="text-lg sm:text-xl font-bold uppercase tracking-widest text-white">
                        {selectedPhase.label}
                    </h3>
                    
                    {selectedPhase.mainTaskStatus && (
                      <div 
                        className={`ml-2 px-2.5 py-1 rounded-full border flex items-center gap-1.5 shadow-lg transition-all duration-500 bg-[#040404]`}
                        style={{
                            borderColor: isStatusDone(selectedPhase.mainTaskStatus.status) ? '#27272a' : (selectedPhase.mainTaskStatus.color || '#52525b'),
                            boxShadow: isStatusDone(selectedPhase.mainTaskStatus.status) ? 'none' : `0 0 15px -8px ${selectedPhase.mainTaskStatus.color}40`
                        }}
                      >
                         <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isStatusDone(selectedPhase.mainTaskStatus.status) ? '#52525b' : (selectedPhase.mainTaskStatus.color || '#52525b') }}></div>
                         <span 
                            className="text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: isStatusDone(selectedPhase.mainTaskStatus.status) ? '#52525b' : (selectedPhase.mainTaskStatus.color || '#52525b') }}
                         >
                            {selectedPhase.mainTaskStatus.status}
                         </span>
                      </div>
                    )}
                </div>
             </div>

             {/* Body / Tasks List */}
             <div className="p-5 sm:p-8 relative z-10 flex-1">
                  <div className="space-y-6">
                    {selectedPhase.items.length === 0 ? (
                        <p className="text-zinc-500 italic">No tasks in this phase.</p>
                    ) : (
                        selectedPhase.items.map((task: ClickUpTask) => {
                            const isDone = isStatusDone(task.status.status);
                            const dotColor = isDone ? '#52525b' : (task.status.color || '#52525b');
                            return (
                                <div key={task.id} className="bg-[#040404] border border-white/5 rounded-xl p-4 mb-4 last:mb-0 transition-colors hover:border-zinc-800">
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                        {/* Status Check / Icon */}
                                        <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${isDone ? 'bg-zinc-800 border-transparent' : 'border-zinc-700'}`}>
                                            {isDone && <Check className="w-3 h-3 text-zinc-500" />}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            {/* Task Header */}
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                                                <h4 className={`text-sm font-bold ${isDone ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
                                                    {task.name}
                                                </h4>
                                                
                                                {/* Badges */}
                                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                    {task.due_date && (
                                                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0a0a0a] border border-zinc-800 text-zinc-400">
                                                           <Calendar className="w-3 h-3" />
                                                           <span className="text-[9px] font-bold uppercase tracking-wider">
                                                               Due {new Date(parseInt(task.due_date)).toLocaleDateString()}
                                                           </span>
                                                       </div>
                                                    )}
                                                    <div className="px-2 py-0.5 rounded border flex items-center gap-1.5 bg-[#0a0a0a] border-[#27272a]">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }}></div>
                                                        <span 
                                                            className="text-[9px] font-bold uppercase tracking-wider"
                                                            style={{ color: isDone ? '#52525b' : (task.status.color || '#52525b') }}
                                                        >
                                                            {task.status.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            {(task.description || task.text_content) && (
                                                <div className="mt-2 text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                                                    {task.description || task.text_content}
                                                </div>
                                            )}

                                            {/* Assignees */}
                                            {task.assignees && task.assignees.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {task.assignees.map(u => (
                                                        <div key={u.id} className="flex items-center gap-1.5 bg-[#0a0a0a] border border-zinc-800 rounded-full pl-1 pr-2.5 py-1">
                                                            <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                                                                {u.profilePicture ? (
                                                                    <img src={u.profilePicture} alt={u.username} className="w-full h-full rounded-full object-cover" />
                                                                ) : (
                                                                    u.username.charAt(0)
                                                                )}
                                                            </div>
                                                            <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider">{u.username}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                 </div>
             </div>
          </div>
        </div>
      </div>
      )}

      {/* Task Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#040404]/95 backdrop-blur-md animate-in fade-in duration-200 custom-scrollbar" onClick={() => setSelectedTask(null)}>
          <div className="min-h-full flex flex-col justify-start items-center p-4 py-8 sm:p-8">
            <div 
              className="w-full max-w-2xl bg-[#0a0a0a] border border-[#ff4d00]/20 shadow-[0_10px_50px_-15px_rgba(255,77,0,0.2)] rounded-2xl overflow-hidden relative flex flex-col shrink-0"
              onClick={e => e.stopPropagation()}
            >
             {/* Gradient Background */}
             <div className="absolute top-0 right-0 w-80 h-80 bg-[#ff4d00]/10 rounded-full blur-[100px] pointer-events-none"></div>

             {/* Header */}
             <div className="flex items-start justify-between p-5 sm:p-8 border-b border-white/5 relative z-10 shrink-0 bg-[#0a0a0a]/80 backdrop-blur-md">
                <div className="flex-1 pr-4 sm:pr-6">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#040404] border border-zinc-800">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedTask.status.color || '#52525b' }}></div>
                            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: selectedTask.status.color || '#52525b' }}>
                                {selectedTask.status.status}
                            </span>
                        </div>
                        {selectedTask.due_date && (
                           <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#040404] border border-zinc-800 text-zinc-400">
                               <Calendar className="w-3 h-3" />
                               <span className="text-[9px] font-bold uppercase tracking-wider">
                                   Due {new Date(parseInt(selectedTask.due_date)).toLocaleDateString()}
                               </span>
                           </div>
                        )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide leading-snug">{selectedTask.name}</h2>
                </div>
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
             </div>

             {/* Body */}
             <div className="p-5 sm:p-8 relative z-10 flex-1">
                  <div className="space-y-6">
                    <div>
                        <div className="flex items-center gap-2 text-white mb-3">
                            <AlignLeft className="w-4 h-4 text-[#ff4d00]" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300">Description</h3>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none prose-p:text-zinc-400 prose-headings:text-zinc-200">
                            {selectedTask.description ? (
                                <p className="whitespace-pre-wrap leading-relaxed">{selectedTask.description}</p>
                            ) : selectedTask.text_content ? (
                                <p className="whitespace-pre-wrap leading-relaxed">{selectedTask.text_content}</p>
                            ) : (
                                <p className="italic text-zinc-600">No description provided.</p>
                            )}
                        </div>
                    </div>

                    {selectedTask.assignees && selectedTask.assignees.length > 0 && (
                        <div>
                           <div className="flex items-center gap-2 text-white mb-3">
                              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Assignees</h3>
                           </div>
                           <div className="flex flex-wrap gap-2">
                               {selectedTask.assignees.map(u => (
                                   <div key={u.id} className="flex items-center gap-2 bg-[#040404] border border-white/5 rounded-full pl-1 pr-3 py-1">
                                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                                         {u.profilePicture ? (
                                             <img src={u.profilePicture} alt={u.username} className="w-full h-full rounded-full object-cover" />
                                         ) : (
                                             u.username.charAt(0)
                                         )}
                                      </div>
                                      <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">{u.username}</span>
                                   </div>
                               ))}
                           </div>
                        </div>
                    )}
                </div>
             </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};