import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Plus, CheckCircle2, Trophy, Flag, ChevronLeft, Calendar as CalendarIcon, X, ChevronRight, List, Image as ImageIcon, Trash2, Bold, Heading2, Quote, Minus, ClipboardList } from 'lucide-react';
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
  retrospective?: {
    content: string;
    updatedAt: string;
  };
}

function readJsonFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function memoTextToHtml(value: string): string {
  if (!value.trim()) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value;
  return value
    .split('\n')
    .map(line => line.trim() ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>')
    .join('');
}

function isEmptyHtml(value: string): boolean {
  const withoutImages = value.replace(/<img\b[^>]*>/gi, '');
  const plainText = withoutImages.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return plainText.length === 0 && !/<img\b/i.test(value) && !/memo-check-item/i.test(value);
}

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('无法读取图片'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('无法加载图片'));
      image.onload = () => {
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / image.width);
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('无法处理图片'));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function createMemoTaskItemHtml(text = ''): string {
  const content = text ? escapeHtml(text) : '';
  return `<div class="memo-check-item" data-checked="false"><button type="button" class="memo-check-toggle" contenteditable="false" aria-checked="false" aria-label="切换完成状态"></button><span class="memo-check-text" data-placeholder="任务项">${content}</span></div>`;
}

const completionEncouragement = '你把这件事真正推进到了终点，这不是好运气，是持续行动累积出来的结果。';

const taskStatusLabels: Record<TaskData['status'], string> = {
  ongoing: '进行中',
  paused: '已暂停',
  completed: '已完成',
};

const screenTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
} as const;

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
    return readJsonFromStorage('taskflow-tasks', initialTasks);
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [memos, setMemos] = useState<Record<string, string>>(() => {
    return readJsonFromStorage('taskflow-memos', {});
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

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.taskId !== taskId));
    setSelectedTaskId(null);
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
    <div className="app-canvas min-h-[100dvh] font-sans text-gray-900 flex justify-center">
      <div className="app-shell w-full max-w-6xl md:my-8 md:rounded-3xl border overflow-hidden flex flex-col min-h-[100dvh] h-[100dvh] md:h-[calc(100dvh-4rem)] relative">
        <AnimatePresence initial={false}>
          {!selectedTaskId ? (
            <motion.div 
              key="list"
              {...screenTransition}
              className="flex flex-col h-full transform-gpu"
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
              {...screenTransition}
              className="flex flex-col h-full transform-gpu"
            >
              <TaskDetailView 
                task={selectedTask!} 
                onBack={() => setSelectedTaskId(null)} 
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
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
  const initialHtml = memoTextToHtml(initialContent);
  const [content, setContent] = useState(initialHtml);
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastSelectionRef = useRef<Range | null>(null);
  const dateStr = format(date, 'yyyy年M月d日 EEEE', { locale: zhCN });

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml;
    }
    setContent(initialHtml);
  }, [initialHtml]);

  const syncContent = () => {
    setContent(editorRef.current?.innerHTML || '');
  };

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      lastSelectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const range = lastSelectionRef.current;
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) return false;

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  };

  const placeCaretInside = (element: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    lastSelectionRef.current = range.cloneRange();
    focusEditor();
  };

  const insertHtmlIntoEditor = (html: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    focusEditor();
    restoreSelection();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const shouldInsertAtCursor = !!range && editor.contains(range.commonAncestorContainer);

    if (shouldInsertAtCursor && range) {
      range.deleteContents();
      const fragment = range.createContextualFragment(html);
      const lastNode = fragment.lastChild;
      range.insertNode(fragment);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        lastSelectionRef.current = range.cloneRange();
      }
    } else {
      editor.insertAdjacentHTML('beforeend', html);
      const lastElement = editor.lastElementChild;
      if (lastElement instanceof HTMLElement) {
        placeCaretInside(lastElement);
      }
    }

    syncContent();
  };

  const handleToggleList = () => {
    focusEditor();
    document.execCommand('insertUnorderedList');
    syncContent();
  };

  const runEditorCommand = (command: string, value?: string) => {
    focusEditor();
    restoreSelection();
    document.execCommand(command, false, value);
    rememberSelection();
    syncContent();
  };

  const handleInsertHeading = () => {
    runEditorCommand('formatBlock', 'h2');
  };

  const handleInsertQuote = () => {
    runEditorCommand('formatBlock', 'blockquote');
  };

  const handleInsertDivider = () => {
    insertHtmlIntoEditor('<hr><div><br></div>');
  };

  const handleInsertTaskItem = () => {
    insertHtmlIntoEditor(`${createMemoTaskItemHtml()}<div><br></div>`);
  };

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const toggle = target.closest<HTMLButtonElement>('.memo-check-toggle');
    if (!toggle) return;

    event.preventDefault();
    const item = toggle.closest<HTMLElement>('.memo-check-item');
    if (!item) return;

    const isChecked = item.dataset.checked === 'true';
    const nextChecked = !isChecked;
    item.dataset.checked = String(nextChecked);
    toggle.setAttribute('aria-checked', String(nextChecked));
    syncContent();
  };

  const exitBlockIfEmpty = (element: HTMLElement) => {
    const text = element.textContent?.replace(/\u200B/g, '').trim() || '';
    if (text) return false;

    const paragraph = document.createElement('div');
    paragraph.innerHTML = '<br>';
    element.replaceWith(paragraph);
    placeCaretInside(paragraph);
    syncContent();
    return true;
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const anchorElement = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
    const item = anchorElement?.closest<HTMLElement>('.memo-check-item');
    const editor = editorRef.current;

    if (!item || !editor?.contains(item)) {
      const block = anchorElement?.closest<HTMLElement>('h2, blockquote');
      if (block && editor?.contains(block)) {
        if (exitBlockIfEmpty(block)) {
          event.preventDefault();
        }
      }
      return;
    }

    event.preventDefault();
    const textElement = item.querySelector<HTMLElement>('.memo-check-text');
    const itemText = textElement?.textContent?.replace(/\u200B/g, '').trim() || '';

    if (!itemText) {
      const paragraph = document.createElement('div');
      paragraph.innerHTML = '<br>';
      item.replaceWith(paragraph);
      placeCaretInside(paragraph);
      syncContent();
      return;
    }

    item.insertAdjacentHTML('afterend', createMemoTaskItemHtml());
    const nextItem = item.nextElementSibling as HTMLElement | null;
    const nextText = nextItem?.querySelector<HTMLElement>('.memo-check-text');
    if (nextText) {
      placeCaretInside(nextText);
    }
    syncContent();
  };

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const dataUrl = await resizeImageFile(file);
    insertHtmlIntoEditor(`<img src="${dataUrl}" alt="备忘录图片">`);
  };

  const handleSave = () => {
    const html = editorRef.current?.innerHTML || content;
    onSave(isEmptyHtml(html) ? '' : html);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:p-12"
    >
      <div className="flex-1 bg-white md:rounded-2xl md:shadow-2xl overflow-hidden flex flex-col max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <button onClick={onClose} className="text-blue-500 text-[17px] flex items-center active:opacity-70 transition-opacity">
            <ChevronLeft className="w-5 h-5 mr-0.5" />
            返回
          </button>
          <div className="min-w-0 truncate text-sm font-semibold text-gray-900">{dateStr}</div>
          <button onClick={handleSave} className="text-blue-500 font-semibold text-[17px] active:opacity-70 transition-opacity">
            完成
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorCommand('bold')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
            title="加粗"
          >
            <Bold className="h-5 w-5" />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleInsertHeading}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
            title="标题"
          >
            <Heading2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleToggleList}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
            title="无序列表"
          >
            <List className="h-5 w-5" />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleInsertTaskItem}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
            title="任务项"
          >
            <CheckCircle2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => imageInputRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
            title="插入图片"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleInsertQuote}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
            title="引用"
          >
            <Quote className="h-5 w-5" />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleInsertDivider}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
            title="分割线"
          >
            <Minus className="h-5 w-5" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelected}
          />
        </div>
        {/* Body */}
        <div className="relative flex-1 overflow-y-auto bg-white p-6">
          {isEmptyHtml(content) && (
            <div className="pointer-events-none absolute left-6 top-6 text-[17px] leading-relaxed text-gray-400">
              添加备忘录...
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="memo-editor min-h-full outline-none text-[17px] leading-relaxed text-gray-900"
            onClick={handleEditorClick}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onInput={() => {
              rememberSelection();
              syncContent();
            }}
            onPaste={() => window.setTimeout(syncContent, 0)}
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

  const taskStats = {
    ongoing: tasks.filter(task => task.status === 'ongoing').length,
    paused: tasks.filter(task => task.status === 'paused').length,
    completed: tasks.filter(task => task.status === 'completed').length,
  };

  const getStatusLabel = (status: TaskData['status']) => {
    return taskStatusLabels[status];
  };

  const getStatusClasses = (status: TaskData['status']) => {
    if (status === 'ongoing') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (status === 'paused') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-blue-50 text-blue-700 border-blue-100';
  };

  const getProgressColor = (status: TaskData['status']) => {
    if (status === 'paused') return 'bg-amber-400';
    if (status === 'completed') return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="app-surface flex flex-col h-full">
      {/* Header */}
      <div className="app-header board-header px-4 py-3 md:px-8 md:py-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 shrink-0 z-10 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:pt-6">
        <div className="board-top-row flex items-center gap-2 md:gap-5 w-full md:w-auto">
          <h1 className="nav-title shrink-0 whitespace-nowrap font-bold tracking-tight text-gray-900">任务看板</h1>
          <div className="hidden md:block h-6 w-px bg-gray-200"></div>
          <div className="nav-date-group min-w-0 flex flex-1 md:flex-none items-center justify-end md:justify-start gap-1.5 md:gap-2">
            <button 
              onClick={handlePrev}
              className="nav-icon-btn shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="上一个周期"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="nav-date-pill min-w-0 flex items-center text-gray-700 font-medium bg-gray-100/80 px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl border border-gray-200/50 shadow-sm text-sm md:text-base md:min-w-[140px] justify-center">
              <CalendarIcon size={16} className="mr-1.5 md:mr-2 text-blue-500 shrink-0" />
              {viewMode === 'month' ? (
                <span className="truncate">{currentYearStr} <span className="text-gray-900 font-bold ml-1">{currentMonthStr}</span></span>
              ) : (
                <span className="truncate">{currentMonthStr} <span className="text-gray-900 font-bold ml-1">{currentWeekStr}</span></span>
              )}
            </div>
            <button 
              onClick={handleNext}
              className="nav-icon-btn shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="下一个周期"
            >
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={handleToday}
              className="nav-today-btn shrink-0 px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">回到今天</span>
              <span className="sm:hidden">今天</span>
            </button>
          </div>
        </div>
        <div className="board-action-row flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="nav-segmented grid grid-cols-2 items-stretch bg-gray-100/80 rounded-xl border border-gray-200/50">
            <button 
              onClick={() => setViewMode('week')}
              className={`nav-segment-btn inline-flex items-center justify-center rounded-lg text-xs md:text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              周视图
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`nav-segment-btn inline-flex items-center justify-center rounded-lg text-xs md:text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              月视图
            </button>
          </div>
          <button
            onClick={() => {
              const name = prompt('请输入任务名称：');
              if (name && name.trim()) onAddTask(name.trim());
            }}
            className="nav-primary-btn bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-colors flex items-center gap-1.5 md:gap-2 shadow-sm active:scale-95 whitespace-nowrap"
          >
            <Plus size={16} />
            新建<span className="hidden md:inline">任务</span>
          </button>
        </div>
      </div>

      {/* Mobile Dashboard */}
      <div className="mobile-dashboard md:hidden flex-1 overflow-y-auto px-4 py-4 pb-6">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="status-card status-card--ongoing rounded-xl border p-3">
            <div className="text-[11px] font-medium text-gray-500">{taskStatusLabels.ongoing}</div>
            <div className="mt-1 text-lg font-bold text-emerald-600">{taskStats.ongoing}</div>
          </div>
          <div className="status-card status-card--paused rounded-xl border p-3">
            <div className="text-[11px] font-medium text-gray-500">{taskStatusLabels.paused}</div>
            <div className="mt-1 text-lg font-bold text-amber-600">{taskStats.paused}</div>
          </div>
          <div className="status-card status-card--completed rounded-xl border p-3">
            <div className="text-[11px] font-medium text-gray-500">{taskStatusLabels.completed}</div>
            <div className="mt-1 text-lg font-bold text-blue-600">{taskStats.completed}</div>
          </div>
        </div>

        <div className="surface-card mb-4 rounded-xl border p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-gray-900">{viewMode === 'month' ? '本月日期' : '本周日期'}</div>
            <div className="text-xs font-medium text-gray-400">{days.length} 天</div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {days.map(day => {
              const isToday = isSameDay(day, today);
              const dateKey = format(day, 'yyyy-MM-dd');
              const hasMemo = !!memos[dateKey] && memos[dateKey].trim() !== '';
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onOpenMemo(day)}
                  className={`relative flex min-w-[52px] flex-col items-center rounded-xl border px-2 py-2 transition-colors ${
                    isToday
                      ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                      : 'border-gray-100 bg-gray-50 text-gray-700 active:bg-gray-100'
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${isToday ? 'text-blue-100' : 'text-gray-400'}`}>
                    {format(day, 'E', { locale: zhCN })}
                  </span>
                  <span className="mt-1 text-sm font-bold">{format(day, 'd')}</span>
                  {hasMemo && (
                    <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-amber-400'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {tasks.map(task => {
            const latestLog = task.historyLogs[task.historyLogs.length - 1];
            const daysSinceStart = Math.max(0, differenceInDays(today, parseISO(task.startDate)));
            return (
              <button
                key={task.taskId}
                onClick={() => onSelectTask(task.taskId)}
                className="task-card block w-full border p-4 text-left active:scale-[0.99]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-gray-900">{task.taskName}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      已跟踪 {daysSinceStart} 天 · {task.historyLogs.length} 条记录
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClasses(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </span>
                </div>

                <div className="mb-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${getProgressColor(task.status)}`}
                      style={{ width: `${task.currentProgress}%` }}
                    />
                  </div>
                  <div className="w-11 text-right text-sm font-bold text-gray-900">{task.currentProgress}%</div>
                </div>

                {latestLog && (
                  <div className="rounded-lg bg-slate-50/80 px-3 py-2">
                    <div className="truncate text-xs font-semibold text-gray-700">{latestLog.title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-gray-500">
                      {format(parseISO(latestLog.timestamp), 'MM月dd日 HH:mm', { locale: zhCN })}
                      {latestLog.note ? ` · ${latestLog.note}` : ''}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="hidden md:block flex-1 overflow-auto p-0 md:p-6">
        <div className={`surface-card ${viewMode === 'week' ? 'min-w-full' : 'min-w-[760px] md:min-w-[1000px]'} md:rounded-xl md:border overflow-hidden flex flex-col h-full`}>
          
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
function TaskDetailView({ task, onBack, onUpdateTask, onDeleteTask }: { task: TaskData, onBack: () => void, onUpdateTask: (t: TaskData) => void, onDeleteTask: (taskId: string) => void }) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean, type: 'update' | 'pause' | 'resume' | null }>({ isOpen: false, type: null });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isCompletionPromptOpen, setIsCompletionPromptOpen] = useState(false);
  const [isRetrospectiveOpen, setIsRetrospectiveOpen] = useState(false);
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

    const justCompleted = isComplete && task.status !== 'completed';

    if (justCompleted) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    onUpdateTask({
      ...task,
      currentProgress: newProgress,
      status: isComplete ? 'completed' : finalType === 'pause' ? 'paused' : 'ongoing',
      historyLogs: [...task.historyLogs, newLog]
    });

    if (justCompleted) {
      setIsCompletionPromptOpen(true);
    }
    
    setModalConfig({ isOpen: false, type: null });
  };

  const handleSaveRetrospective = (content: string) => {
    onUpdateTask({
      ...task,
      retrospective: {
        content,
        updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
      }
    });
    setIsRetrospectiveOpen(false);
  };

  const daysSinceStart = Math.max(0, differenceInDays(new Date(), parseISO(task.startDate)));
  const statusTone = task.status === 'completed' ? 'blue' : task.status === 'paused' ? 'amber' : 'emerald';
  const progressToneClass = statusTone === 'blue' ? 'bg-blue-500' : statusTone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="app-surface flex flex-col h-full relative">
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
      <div className="app-header border-b z-10 shrink-0">
        {/* Nav Bar - 返回按钮独立一行，增大触控区域 */}
        <div className="detail-nav flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] border-b border-gray-50">
          <button
            onClick={onBack}
            className="detail-back-btn flex items-center min-h-[44px] py-3 pr-6 text-gray-700 active:text-gray-950 transition-colors text-sm font-semibold -ml-1"
          >
            <ChevronLeft size={22} className="mr-0.5" /> 返回看板
          </button>
          <div className="detail-nav-actions flex items-center gap-1">
            <button
              onClick={() => setIsRetrospectiveOpen(true)}
              className={`detail-icon-btn flex h-10 w-10 items-center justify-center rounded-full active:bg-blue-50 ${task.retrospective?.content?.trim() ? 'text-blue-600' : 'text-gray-500'}`}
              title="任务复盘"
            >
              <ClipboardList className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="detail-icon-btn flex h-10 w-10 items-center justify-center rounded-full text-red-500 active:bg-red-50"
              title="删除任务"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="detail-hero px-4 py-4 md:px-8 md:py-6">
          <div className="min-w-0">
            <div className={`detail-status detail-status--${statusTone}`}>
              {task.status === 'ongoing' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              {task.status === 'paused' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
              {task.status === 'completed' && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              {taskStatusLabels[task.status]}
            </div>
            <h1 className="mt-3 text-lg md:text-3xl font-bold tracking-tight text-gray-900 leading-tight">{task.taskName}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-gray-500">
              <span className="rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-1">已跟踪 {daysSinceStart} 天</span>
              <span className="rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-1">{task.historyLogs.length} 条记录</span>
              {task.retrospective?.content?.trim() && (
                <span className="rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-1 text-blue-700">已有复盘</span>
              )}
            </div>
          </div>
          <div className="detail-progress-card">
            <div className="text-[11px] font-semibold text-gray-400">当前进度</div>
            <div className="mt-1 text-2xl md:text-5xl font-semibold tracking-tight text-gray-950">
              {task.currentProgress}<span className="ml-0.5 text-base md:text-2xl text-gray-400 font-medium">%</span>
            </div>
          </div>
        </div>
        
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${progressToneClass}`}
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
                        isPause ? 'timeline-card timeline-card--paused border' : 
                        isComplete ? 'timeline-card timeline-card--completed border' :
                        'timeline-card surface-card bg-white border'
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
      <div className="app-actionbar px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:p-6 border-t shrink-0">
        <div className="flex flex-row gap-3 md:gap-4 max-w-2xl mx-auto">
          <button 
            onClick={() => setModalConfig({ isOpen: true, type: 'update' })}
            disabled={task.status === 'completed'}
              className="flex-[1.5] flex items-center justify-center gap-1.5 md:gap-2 bg-gray-900 hover:bg-gray-800 text-white py-3 md:py-4 px-2 md:px-6 rounded-xl md:rounded-2xl font-semibold transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-sm text-xs md:text-base"
          >
            <Plus size={16} className="md:w-5 md:h-5" />
            推进进度
          </button>
          
          {task.status !== 'paused' && task.status !== 'completed' && (
            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'pause' })}
              className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 bg-white/80 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 py-3 md:py-4 px-2 md:px-6 rounded-xl md:rounded-2xl font-semibold transition-all active:scale-[0.98] shadow-sm text-xs md:text-base"
            >
              <Pause size={16} className="md:w-5 md:h-5" />
              阶段成就
            </button>
          )}
          
          {task.status === 'paused' && (
            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'resume' })}
              className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 md:py-4 px-2 md:px-6 rounded-xl md:rounded-2xl font-semibold transition-all active:scale-[0.98] shadow-sm text-xs md:text-base"
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

      <AnimatePresence>
        {isCompletionPromptOpen && (
          <CompletionReviewPrompt
            onWriteNow={() => {
              setIsCompletionPromptOpen(false);
              setIsRetrospectiveOpen(true);
            }}
            onLater={() => setIsCompletionPromptOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRetrospectiveOpen && (
          <RetrospectiveModal
            taskName={task.taskName}
            initialContent={task.retrospective?.content || ''}
            updatedAt={task.retrospective?.updatedAt}
            onClose={() => setIsRetrospectiveOpen(false)}
            onSave={handleSaveRetrospective}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <DeleteTaskModal
            taskName={task.taskName}
            onCancel={() => setIsDeleteConfirmOpen(false)}
            onConfirm={() => onDeleteTask(task.taskId)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DeleteTaskModal({ taskName, onCancel, onConfirm }: { taskName: string, onCancel: () => void, onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-900/40 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-center backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="modal-card w-full max-w-sm overflow-hidden rounded-2xl border"
      >
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <Trash2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">删除任务？</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            「{taskName}」和它的所有进度记录都会被删除。这个操作无法撤销。
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="py-4 text-sm font-semibold text-gray-700 active:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="border-l border-gray-100 py-4 text-sm font-semibold text-red-600 active:bg-red-50"
          >
            删除
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CompletionReviewPrompt({ onWriteNow, onLater }: { onWriteNow: () => void, onLater: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-gray-900/40 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-center backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="modal-card w-full max-w-sm overflow-hidden rounded-2xl border border-blue-100"
      >
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Flag className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">任务完成了</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{completionEncouragement}</p>
          <p className="mt-4 text-sm leading-6 text-gray-600">
            趁记忆还新鲜，可以简单复盘一下：做对了什么、哪里卡住了、下次怎么更顺。
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-gray-100">
          <button
            onClick={onLater}
            className="py-4 text-sm font-semibold text-gray-600 active:bg-gray-50"
          >
            之后再写
          </button>
          <button
            onClick={onWriteNow}
            className="border-l border-gray-100 py-4 text-sm font-semibold text-blue-600 active:bg-blue-50"
          >
            现在复盘
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function RetrospectiveModal({ taskName, initialContent, updatedAt, onClose, onSave }: {
  taskName: string,
  initialContent: string,
  updatedAt?: string,
  onClose: () => void,
  onSave: (content: string) => void
}) {
  const [content, setContent] = useState(initialContent);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col app-canvas pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:bg-gray-900/40 md:p-8 md:backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        className="modal-card mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border md:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <button onClick={onClose} className="flex min-h-[40px] items-center pr-4 text-blue-500">
            <ChevronLeft className="mr-0.5 h-5 w-5" />
            返回
          </button>
          <div className="min-w-0 text-center">
            <div className="truncate text-sm font-semibold text-gray-900">任务复盘</div>
            <div className="truncate text-[11px] text-gray-400">{taskName}</div>
          </div>
          <button
            onClick={() => onSave(content.trim())}
            className="min-h-[40px] pl-4 text-[17px] font-semibold text-blue-500"
          >
            保存
          </button>
        </div>

        <div className="border-b border-gray-100 bg-slate-50/80 px-5 py-4">
          <p className="text-sm leading-6 text-gray-600">{completionEncouragement}</p>
          {updatedAt && (
            <p className="mt-2 text-xs text-gray-400">
              上次更新：{format(parseISO(updatedAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={'可以从这几句开始：\n1. 这次最有效的做法是什么？\n2. 哪个地方比预想更难？\n3. 下次开始前，我要先准备什么？'}
            className="h-full min-h-[420px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-[16px] leading-7 text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400"
            autoFocus
          />
        </div>
      </motion.div>
    </div>
  );
}

// --- Progress Modal ---
function ProgressModal({ type, onClose, onSubmit }: { type: 'update' | 'pause' | 'resume', onClose: () => void, onSubmit: (title: string, note: string, progress: number) => void }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    onSubmit(title, note, progress);
  };

  const isPause = type === 'pause';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-y-auto bg-gray-900/40 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="modal-card w-full max-w-md max-h-full overflow-y-auto rounded-2xl border"
      >
        <div className="flex justify-between items-start gap-4 p-6 pb-4 border-b border-gray-100">
          <div>
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${
              isPause ? 'bg-amber-50 text-amber-600' : type === 'resume' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'
            }`}>
              {type === 'update' && <Plus size={20} />}
              {type === 'pause' && <Pause size={20} />}
              {type === 'resume' && <Play size={20} />}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {type === 'update' ? '记录新进展' : type === 'pause' ? '记录阶段成就并暂停' : '恢复任务'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {type === 'update' ? '把这次推进留下来，后面能清楚看到任务是怎样完成的。' : type === 'pause' ? '适合阶段性收尾，记录成果后暂时放下。' : '重新启动任务，并记录这次恢复带来的进度。'}
            </p>
          </div>
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
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
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
              className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {(type === 'update' || type === 'resume') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">增加进度 (%)</label>
              <div className="flex items-center gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
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
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
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
