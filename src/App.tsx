import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Plus, CheckCircle2, Trophy, Flag, ChevronLeft, Calendar as CalendarIcon, X, ChevronRight } from 'lucide-react';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, getWeekOfMonth, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { zhCN } from 'date-fns/locale';

type LogType = 'start' | 'update' | 'pause' | 'resume' | 'complete';

interface HistoryLog {
  logId: string;
  type: LogType;
  timestamp: string;
  progressVal: number;
  title: string;
  note: string;
  isSegmentBreak?: boolean;
}

interface TaskData {
  taskId: string;
  taskName: string;
  totalProgress: number;
  currentProgress: number;
  status: 'ongoing' | 'paused' | 'completed';
  startDate: string;
  historyLogs: HistoryLog[];
}

const initialTasks: TaskData[] = [
  {
    taskId: "1001",
    taskName: "开发个人博客",
    totalProgress: 100,
    currentProgress: 40,
    status: "paused",
    startDate: "2024-03-01T09:00:00",
    historyLogs: [
      {
        logId: "1",
        type: "start",
        timestamp: "2024-03-01T09:00:00",
        progressVal: 0,
        title: "项目启动",
        note: "立项，开始干活！"
      },
      {
        logId: "2",
        type: "update",
        timestamp: "2024-03-05T18:00:00",
        progressVal: 20,
        title: "UI设计完成",
        note: "完成了整体的UI设计稿"
      },
      {
        logId: "3",
        type: "pause",
        timestamp: "2024-03-10T12:00:00",
        progressVal: 40,
        title: "前端页面完成",
        note: "阶段成就：前端静态页面完成！出差暂停几天。",
        isSegmentBreak: true
      }
    ]
  },
  {
    taskId: "1002",
    taskName: "学习React Native",
    totalProgress: 100,
    currentProgress: 15,
    status: "ongoing",
    startDate: "2024-03-08T10:00:00",
    historyLogs: [
      {
        logId: "1",
        type: "start",
        timestamp: "2024-03-08T10:00:00",
        progressVal: 0,
        title: "开始学习",
        note: "购买了课程，准备开始学习"
      },
      {
        logId: "2",
        type: "update",
        timestamp: "2024-03-12T20:00:00",
        progressVal: 15,
        title: "环境搭建",
        note: "完成了开发环境的搭建和Hello World"
      }
    ]
  }
];

export default function App() {
  const [tasks, setTasks] = useState<TaskData[]>(() => {
    const saved = localStorage.getItem('taskflow-tasks');
    return saved ? JSON.parse(saved) : initialTasks;
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [memos, setMemos] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('taskflow-memos');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedMemoDate, setSelectedMemoDate] = useState<Date | null>(null);

  useEffect(() => {
    localStorage.setItem('taskflow-tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('taskflow-memos', JSON.stringify(memos));
  }, [memos]);

  const selectedTask = tasks.find(t => t.taskId === selectedTaskId);

  const handleUpdateTask = (updatedTask: TaskData) => {
    setTasks(tasks.map(t => t.taskId === updatedTask.taskId ? updatedTask : t));
  };

  const handleAddTask = (taskName: string) => {
    const newTask: TaskData = {
      taskId: Date.now().toString(),
      taskName,
      totalProgress: 100,
      currentProgress: 0,
      status: 'ongoing',
      startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      historyLogs: [{
        logId: Date.now().toString(),
        type: 'start',
        timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        progressVal: 0,
        title: '项目启动',
        note: '新建任务，开始执行！'
      }]
    };
    setTasks([...tasks, newTask]);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex justify-center">
      <div className="w-full max-w-6xl bg-white md:my-8 md:rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-screen md:h-[calc(100vh-4rem)] relative">
        <AnimatePresence mode="wait">
          {!selectedTaskId ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full"
            >
              <TaskListView
                tasks={tasks}
                onSelectTask={setSelectedTaskId}
                onAddTask={handleAddTask}
                viewMode={viewMode}
                setViewMode={setViewMode}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                today={today}
                memos={memos}
                onOpenMemo={setSelectedMemoDate}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full"
            >
              <TaskDetailView 
                task={selectedTask!} 
                onBack={() => setSelectedTaskId(null)} 
                onUpdateTask={handleUpdateTask}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {selectedMemoDate && (
            <MemoModal
              date={selectedMemoDate}
              initialContent={memos[format(selectedMemoDate, 'yyyy-MM-dd')] || ''}
              onSave={(content) => {
                setMemos(prev => ({
                  ...prev,
                  [format(selectedMemoDate, 'yyyy-MM-dd')]: content
                }));
              }}
              onClose={() => setSelectedMemoDate(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Memo Modal (iOS Notes Style) ---
function MemoModal({ date, initialContent, onSave, onClose }: { date: Date, initialContent: string, onSave: (content: string) => void, onClose: () => void }) {
  const [content, setContent] = useState(initialContent);
  const dateStr = format(date, 'yyyy年M月d日 EEEE', { locale: zhCN });

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 z-50 flex flex-col bg-[#f2f2f7] md:p-12"
    >
      <div className="flex-1 bg-white md:rounded-2xl md:shadow-2xl overflow-hidden flex flex-col max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <button onClick={onClose} className="text-blue-500 text-[17px] flex items-center active:opacity-70 transition-opacity">
            <ChevronLeft className="w-5 h-5 mr-0.5" />
            返回
          </button>
          <div className="text-sm font-semibold text-gray-900">{dateStr}</div>
          <button onClick={() => { onSave(content); onClose(); }} className="text-blue-500 font-semibold text-[17px] active:opacity-70 transition-opacity">
            完成
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-white">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="添加备忘录..."
            className="w-full h-full resize-none outline-none text-[17px] leading-relaxed text-gray-900 placeholder-gray-400 bg-transparent"
            autoFocus
          />
        </div>
      </div>
    </motion.div>
  );
}

// --- Task List View (Timeline) ---
function TaskListView({ tasks, onSelectTask, onAddTask, viewMode, setViewMode, currentDate, setCurrentDate, today, memos, onOpenMemo }: {
  tasks: TaskData[],
  onSelectTask: (id: string) => void,
  onAddTask: (taskName: string) => void,
  viewMode: 'month' | 'week',
  setViewMode: (mode: 'month' | 'week') => void,
  currentDate: Date,
  setCurrentDate: (date: Date) => void,
  today: Date,
  memos: Record<string, string>,
  onOpenMemo: (date: Date) => void
}) {
  const startDate = viewMode === 'month' ? startOfMonth(currentDate) : startOfWeek(currentDate, { weekStartsOn: 1 });
  const endDate = viewMode === 'month' ? endOfMonth(currentDate) : endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const currentMonthStr = format(currentDate, 'M月', { locale: zhCN });
  const currentYearStr = format(currentDate, 'yyyy年', { locale: zhCN });
  const currentWeekStr = `第${getWeekOfMonth(currentDate, { weekStartsOn: 1 })}周`;

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="px-4 py-4 md:px-8 md:py-6 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 bg-white shadow-sm z-10">
        <div className="flex items-center gap-3 md:gap-5 w-full md:w-auto justify-between md:justify-start">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">任务看板</h1>
          <div className="hidden md:block h-6 w-px bg-gray-200"></div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrev}
              className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center text-gray-700 font-medium bg-gray-100/80 px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-gray-200/50 shadow-sm text-sm md:text-base min-w-[140px] justify-center">
              <CalendarIcon size={16} className="mr-1.5 md:mr-2 text-blue-500" />
              {viewMode === 'month' ? (
                <span>{currentYearStr} <span className="text-gray-900 font-bold ml-1">{currentMonthStr}</span></span>
              ) : (
                <span>{currentMonthStr} <span className="text-gray-900 font-bold ml-1">{currentWeekStr}</span></span>
              )}
            </div>
            <button 
              onClick={handleNext}
              className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={handleToday}
              className="ml-1 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              回到今天
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200/50">
            <button 
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 md:px-5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              周视图
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 md:px-5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              月视图
            </button>
          </div>
          <button
            onClick={() => {
              const name = prompt('请输入任务名称：');
              if (name && name.trim()) onAddTask(name.trim());
            }}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-colors flex items-center gap-1.5 md:gap-2 shadow-sm active:scale-95"
          >
            <Plus size={16} />
            新建<span className="hidden md:inline">任务</span>
          </button>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="flex-1 overflow-auto p-0 md:p-6">
        <div className="min-w-[800px] md:min-w-[1000px] bg-white md:rounded-2xl md:border border-gray-200 md:shadow-sm overflow-hidden flex flex-col h-full">
          
          {/* Timeline Header (Days) */}
          <div className="flex border-b border-gray-200 bg-gray-50/80 sticky top-0 z-30">
            <div className="w-28 md:w-72 shrink-0 px-3 md:px-6 py-3 md:py-4 font-bold text-gray-500 text-[10px] md:text-xs uppercase tracking-wider flex items-center border-r border-gray-200 sticky left-0 bg-gray-50/90 backdrop-blur-sm z-40">
              任务列表
            </div>
            <div className="flex-1 flex">
              {days.map(day => {
                const isToday = isSameDay(day, today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const dateKey = format(day, 'yyyy-MM-dd');
                const hasMemo = !!memos[dateKey] && memos[dateKey].trim() !== '';
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => onOpenMemo(day)}
                    className={`flex-1 flex flex-col items-center justify-center py-3 border-r border-gray-200 relative cursor-pointer hover:bg-gray-100/50 transition-colors active:bg-gray-200/50 ${isWeekend ? 'bg-gray-100/50' : ''}`}
                  >
                    <span className={`text-xs font-bold ${isToday ? 'text-white bg-blue-500 w-7 h-7 rounded-full flex items-center justify-center shadow-md' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                      {viewMode === 'week' ? format(day, 'E', { locale: zhCN }) : format(day, 'd')}
                    </span>
                    {viewMode === 'week' && (
                       <span className={`text-[10px] mt-1 font-semibold ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{format(day, 'MM/dd')}</span>
                    )}
                    {hasMemo && (
                      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-sm" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task Rows */}
          <div className="flex flex-col divide-y divide-gray-100 overflow-y-auto flex-1">
            {tasks.map(task => {
              const totalDays = days.length;
              
              const activeSegments: {start: string, end: string}[] = [];
              let currentSegStart: string | null = null;

              if (task.historyLogs.length === 0 && task.status === 'ongoing') {
                activeSegments.push({ start: task.startDate, end: today.toISOString() });
              } else {
                task.historyLogs.forEach(log => {
                  if (log.type === 'start' || log.type === 'resume') {
                    currentSegStart = log.timestamp;
                  } else if (log.type === 'pause' || log.type === 'complete') {
                    if (currentSegStart) {
                      activeSegments.push({ start: currentSegStart, end: log.timestamp });
                      currentSegStart = null;
                    } else {
                      activeSegments.push({ start: log.timestamp, end: log.timestamp });
                    }
                  }
                });

                if (currentSegStart) {
                  const endStr = task.status === 'ongoing' ? today.toISOString() : currentSegStart;
                  activeSegments.push({ start: currentSegStart, end: endStr });
                }
              }

              return (
                <div 
                  key={task.taskId} 
                  className="flex items-stretch group cursor-pointer hover:bg-blue-50/30 transition-colors relative min-h-[80px]"
                  onClick={() => onSelectTask(task.taskId)}
                >
                  {/* Task Info Sidebar */}
                  <div className="w-28 md:w-72 shrink-0 px-3 md:px-6 py-3 md:py-4 flex flex-col justify-center border-r border-gray-100 bg-white group-hover:bg-blue-50/30 transition-colors z-20 sticky left-0">
                    <div className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors text-xs md:text-sm">{task.taskName}</div>
                    <div className="text-[10px] md:text-xs text-gray-500 mt-1 md:mt-2 flex items-center gap-1 md:gap-2">
                      <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ${task.status === 'ongoing' ? 'bg-emerald-500' : task.status === 'paused' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <span className="font-semibold">{task.currentProgress}%</span>
                      <span className="text-gray-300 hidden md:inline">|</span>
                      <span className="font-medium hidden md:inline">{task.historyLogs.length} 条记录</span>
                    </div>
                  </div>

                  {/* Timeline Grid Area */}
                  <div className="flex-1 flex relative">
                    {/* Grid Lines */}
                    {days.map(day => {
                       const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                       const isToday = isSameDay(day, today);
                       return (
                         <div key={day.toISOString()} className={`flex-1 border-r border-gray-100 relative ${isWeekend ? 'bg-gray-50/50' : ''}`}>
                           {isToday && <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-blue-200 z-0" />}
                         </div>
                       )
                    })}
                    
                    {/* Task Line Segments */}
                    {activeSegments.map((seg, idx) => {
                      const segStart = parseISO(seg.start);
                      const segEnd = parseISO(seg.end);

                      let startIndex = days.findIndex(d => isSameDay(d, segStart));
                      let endIndex = days.findIndex(d => isSameDay(d, segEnd));

                      if (startIndex === -1 && segStart < startDate) startIndex = 0;
                      if (endIndex === -1 && segEnd > endDate) endIndex = totalDays - 1;

                      if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return null;

                      return (
                        <motion.div 
                          key={`seg-${idx}`}
                          initial={{ opacity: 0, scaleX: 0 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.1 }}
                          className="absolute top-0 bottom-0 z-10 origin-left"
                          style={{
                            left: `${(startIndex / totalDays) * 100}%`,
                            width: `${((endIndex - startIndex + 1) / totalDays) * 100}%`,
                          }}
                        >
                          <div className="absolute top-1/2 -translate-y-1/2 left-1.5 right-1.5 md:left-3 md:right-3 h-2 md:h-3 rounded-full flex items-center shadow-sm">
                            <div className={`w-full h-full rounded-full ${task.status === 'completed' ? 'bg-blue-400' : task.status === 'paused' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                          </div>
                        </motion.div>
                      );
                    })}
                    
                    {/* All Logs as Nodes */}
                    {task.historyLogs.filter(log => isWithinInterval(parseISO(log.timestamp), { start: startDate, end: endDate })).map((log, idx) => {
                      const logDate = parseISO(log.timestamp);
                      const nodeIndex = days.findIndex(d => isSameDay(d, logDate));
                      if (nodeIndex === -1) return null;
                      
                      const cellWidthPct = 100 / totalDays;
                      const relativePos = (nodeIndex * cellWidthPct) + (cellWidthPct / 2);

                      const isAchievement = log.type === 'pause' || log.type === 'complete';

                      if (isAchievement) {
                        return (
                          <motion.div 
                            key={log.logId}
                            initial={{ scale: 0, y: "-50%", x: "-50%", rotate: -45 }}
                            animate={{ scale: 1, y: "-50%", x: "-50%", rotate: 0 }}
                            whileHover={{ scale: 1.2, rotate: 10 }}
                            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 + idx * 0.05 }}
                            className={`absolute top-1/2 w-6 h-6 md:w-8 md:h-8 bg-white rounded-full shadow-lg border-[2px] md:border-[3px] flex items-center justify-center z-30 cursor-pointer ${log.type === 'complete' ? 'border-blue-500 text-blue-500' : 'border-amber-500 text-amber-500'}`}
                            style={{ left: `${relativePos}%` }}
                            title={`${log.title}\n进度: ${log.progressVal}%\n备注: ${log.note}`}
                          >
                            {log.type === 'complete' ? (
                              <Flag className="w-3 h-3 md:w-4 md:h-4" strokeWidth={3} />
                            ) : (
                              <Trophy className="w-3 h-3 md:w-4 md:h-4" strokeWidth={3} />
                            )}
                          </motion.div>
                        );
                      } else {
                        return (
                          <motion.div 
                            key={log.logId}
                            initial={{ scale: 0, y: "-50%", x: "-50%" }}
                            animate={{ scale: 1, y: "-50%", x: "-50%" }}
                            whileHover={{ scale: 1.5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25, delay: idx * 0.05 }}
                            className={`absolute top-1/2 w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-white rounded-full shadow-sm border-2 z-20 cursor-pointer ${task.status === 'completed' ? 'border-blue-500' : task.status === 'paused' ? 'border-amber-500' : 'border-emerald-500'}`}
                            style={{ left: `${relativePos}%` }}
                            title={`${log.title}\n进度: ${log.progressVal}%`}
                          />
                        );
                      }
                    })}
                  </div>
                  
                  {/* Hover Arrow */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-white rounded-full shadow-sm p-1.5 border border-gray-100">
                    <ChevronRight className="text-blue-500" size={18} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Task Detail View ---
function TaskDetailView({ task, onBack, onUpdateTask }: { task: TaskData, onBack: () => void, onUpdateTask: (t: TaskData) => void }) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean, type: 'update' | 'pause' | 'resume' | null }>({ isOpen: false, type: null });
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [task.historyLogs]);

  const handleAddLog = (title: string, note: string, progressAdd: number, type: 'update' | 'pause' | 'resume') => {
    const timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss", { locale: zhCN });
    
    let newProgress = task.currentProgress;
    if (type === 'update' || type === 'resume') {
      newProgress = Math.min(task.currentProgress + progressAdd, task.totalProgress);
    }
    
    const isComplete = newProgress >= task.totalProgress;
    const finalType = isComplete ? 'complete' : type;

    const newLog: HistoryLog = {
      logId: Date.now().toString(),
      type: finalType,
      timestamp,
      progressVal: newProgress,
      title: title || (finalType === 'complete' ? '任务完成' : finalType === 'pause' ? '阶段暂停' : '进度更新'),
      note,
      isSegmentBreak: finalType === 'pause' || finalType === 'complete'
    };

    if (isComplete) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    onUpdateTask({
      ...task,
      currentProgress: newProgress,
      status: isComplete ? 'completed' : finalType === 'pause' ? 'paused' : 'ongoing',
      historyLogs: [...task.historyLogs, newLog]
    });
    
    setModalConfig({ isOpen: false, type: null });
  };

  return (
    <div className="flex flex-col h-full relative bg-gray-50">
      {/* Confetti Overlay */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden"
          >
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className={`absolute w-3 h-3 rounded-full ${['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-purple-500'][i % 5]}`}
                initial={{ x: 0, y: 0, scale: 0 }}
                animate={{ 
                  x: (Math.random() - 0.5) * 600, 
                  y: (Math.random() - 0.5) * 600,
                  scale: Math.random() * 1.5 + 0.5,
                  opacity: [1, 1, 0]
                }}
                transition={{ duration: 2, ease: "easeOut" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 py-4 md:px-8 md:py-6 border-b border-gray-100 bg-white z-10 shrink-0">
        <button 
          onClick={onBack}
          className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-4 md:mb-6 transition-colors text-xs md:text-sm font-medium bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg"
        >
          <ChevronLeft size={16} className="mr-1" /> 返回看板
        </button>
        
        <div className="flex flex-col md:flex-row justify-between items-start mb-4 md:mb-6 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-[10px] md:text-xs font-semibold text-gray-600 mb-2 md:mb-4">
              {task.status === 'ongoing' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              {task.status === 'paused' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
              {task.status === 'completed' && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              {task.status === 'ongoing' ? '进行中' : task.status === 'paused' ? '已暂停' : '已完成'}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 leading-tight">{task.taskName}</h1>
          </div>
          <div className="text-left md:text-right">
            <div className="text-4xl md:text-5xl font-light tracking-tighter text-gray-900">
              {task.currentProgress}<span className="text-xl md:text-2xl text-gray-400 font-normal">%</span>
            </div>
          </div>
        </div>
        
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div 
            className={`h-full ${task.status === 'completed' ? 'bg-blue-500' : 'bg-emerald-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${task.currentProgress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Timeline Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-6 md:pt-8 scroll-smooth">
        <div className="flex flex-col max-w-2xl mx-auto">
          <AnimatePresence initial={false}>
            {task.historyLogs.map((log, index) => {
              const isLast = index === task.historyLogs.length - 1;
              const isPause = log.type === 'pause';
              const isResume = log.type === 'resume';
              const isStart = log.type === 'start';
              const isComplete = log.type === 'complete';

              return (
                <motion.div 
                  key={log.logId}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex flex-row relative"
                >
                  {/* Left: Node and Line */}
                  <div className="flex flex-col items-center w-12 md:w-16 mr-4 md:mr-6 shrink-0">
                    {/* Node */}
                    <motion.div 
                      className={`w-4 h-4 md:w-5 md:h-5 rounded-full z-10 flex items-center justify-center relative shadow-sm ${
                        isPause ? 'bg-amber-400 ring-4 ring-amber-50 scale-125' : 
                        isStart ? 'bg-gray-800' :
                        isResume ? 'bg-emerald-500' :
                        isComplete ? 'bg-blue-500 ring-4 ring-blue-50 scale-125' :
                        'bg-emerald-400'
                      }`}
                      whileHover={{ scale: 1.2 }}
                    >
                      {isPause && <Trophy className="w-2.5 h-2.5 md:w-3 md:h-3 text-white absolute" strokeWidth={3} />}
                      {isComplete && <Flag className="w-2.5 h-2.5 md:w-3 md:h-3 text-white absolute" strokeWidth={3} />}
                    </motion.div>
                    
                    {/* Line */}
                    {!isLast && (
                      <div className={`flex-1 w-[2px] -mt-2 md:-mt-2.5 z-0 min-h-[50px] md:min-h-[70px] ${
                        log.isSegmentBreak 
                          ? 'bg-transparent border-l-[2px] border-dashed border-gray-300 my-4' 
                          : 'bg-emerald-400'
                      }`} />
                    )}
                  </div>

                  {/* Right: Content */}
                  <div className={`flex-1 pb-8 md:pb-10 ${isLast ? 'pb-4' : ''}`}>
                    <span className="text-[10px] md:text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1.5 md:mb-2 block">
                      {format(parseISO(log.timestamp), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                    </span>
                    <motion.div 
                      className={`p-4 md:p-6 rounded-2xl ${
                        isPause ? 'bg-amber-50/80 border border-amber-200/50 shadow-sm' : 
                        isComplete ? 'bg-blue-50/80 border border-blue-200/50 shadow-sm' :
                        'bg-white border border-gray-200/80 shadow-sm'
                      }`}
                      whileHover={{ y: -2 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <h3 className={`text-base md:text-lg font-bold mb-1.5 md:mb-2 ${
                        isPause ? 'text-amber-900' : 
                        isComplete ? 'text-blue-900' :
                        'text-gray-900'
                      }`}>
                        {log.title}
                      </h3>
                      <p className={`text-sm md:text-[15px] leading-relaxed ${
                        isPause ? 'text-amber-800/90' : 
                        isComplete ? 'text-blue-800/90' :
                        'text-gray-600'
                      }`}>
                        {log.note}
                      </p>
                      {log.progressVal > 0 && (
                        <div className={`mt-4 md:mt-5 inline-flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold ${
                          isPause ? 'bg-amber-100 text-amber-800' :
                          isComplete ? 'bg-blue-100 text-blue-800' :
                          'bg-emerald-50 text-emerald-800'
                        }`}>
                          当前进度 {log.progressVal}%
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={timelineEndRef} />
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4 md:p-6 bg-white border-t border-gray-100 shrink-0 shadow-[0_-4px_20px_rgb(0,0,0,0.02)]">
        <div className="flex flex-row gap-3 md:gap-4 max-w-2xl mx-auto">
          <button 
            onClick={() => setModalConfig({ isOpen: true, type: 'update' })}
            disabled={task.status === 'completed'}
            className="flex-[1.5] flex items-center justify-center gap-1.5 md:gap-2 bg-gray-900 hover:bg-gray-800 text-white py-3 md:py-4 px-2 md:px-6 rounded-xl md:rounded-2xl font-semibold transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-sm text-sm md:text-base"
          >
            <Plus size={16} className="md:w-5 md:h-5" />
            推进进度
          </button>
          
          {task.status !== 'paused' && task.status !== 'completed' && (
            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'pause' })}
              className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 py-3 md:py-4 px-2 md:px-6 rounded-xl md:rounded-2xl font-semibold transition-all active:scale-[0.98] shadow-sm text-sm md:text-base"
            >
              <Pause size={16} className="md:w-5 md:h-5" />
              阶段成就
            </button>
          )}
          
          {task.status === 'paused' && (
            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'resume' })}
              className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 md:py-4 px-2 md:px-6 rounded-xl md:rounded-2xl font-semibold transition-all active:scale-[0.98] shadow-sm text-sm md:text-base"
            >
              <Play size={16} className="md:w-5 md:h-5" />
              恢复任务
            </button>
          )}
        </div>
      </div>

      {/* Progress Input Modal */}
      <AnimatePresence>
        {modalConfig.isOpen && (
          <ProgressModal 
            type={modalConfig.type!} 
            onClose={() => setModalConfig({ isOpen: false, type: null })}
            onSubmit={(title, note, progress) => handleAddLog(title, note, progress, modalConfig.type!)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Progress Modal ---
function ProgressModal({ type, onClose, onSubmit }: { type: 'update' | 'pause' | 'resume', onClose: () => void, onSubmit: (title: string, note: string, progress: number) => void }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(title, note, progress);
  };

  const isPause = type === 'pause';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
      >
        <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {type === 'update' ? '记录新进展' : type === 'pause' ? '记录阶段成就并暂停' : '恢复任务'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 pt-5 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">标题</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isPause ? "例如：完成第一阶段原型" : "例如：完成首页UI设计"}
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">详细备注</label>
            <textarea 
              required
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="记录一下具体完成了哪些工作，或者遇到了什么问题..."
              rows={3}
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {(type === 'update' || type === 'resume') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">增加进度 (%)</label>
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={progress}
                  onChange={e => setProgress(Number(e.target.value))}
                  className="flex-1 accent-gray-900 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-mono font-bold text-gray-900 w-12 text-right text-lg">+{progress}%</span>
              </div>
            </div>
          )}

          <div className="mt-4">
            <button 
              type="submit"
              className={`w-full py-4 rounded-xl font-bold text-white transition-all active:scale-[0.98] shadow-sm ${
                isPause ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              保存记录
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

