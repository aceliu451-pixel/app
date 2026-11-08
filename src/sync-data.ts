export type LogType = 'start' | 'update' | 'pause' | 'resume' | 'complete';

export interface HistoryLog {
  logId: string;
  type: LogType;
  timestamp: string;
  progressVal: number;
  title: string;
  note: string;
  isSegmentBreak?: boolean;
}

export interface TaskData {
  taskId: string;
  taskName: string;
  totalProgress: number;
  currentProgress: number;
  status: 'ongoing' | 'paused' | 'completed';
  startDate: string;
  historyLogs: HistoryLog[];
  retrospective?: { content: string; updatedAt: string };
}

export interface Snapshot {
  tasks: TaskData[];
  memos: Record<string, string>;
}

export const emptySnapshot: Snapshot = { tasks: [], memos: {} };
export const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const { tasks, memos } = value as Snapshot;
  if (!Array.isArray(tasks) || !memos || typeof memos !== 'object' || Array.isArray(memos)) return false;
  const date = (input: unknown) => typeof input === 'string' && Number.isFinite(Date.parse(input));
  return new Set(tasks.map(task => task?.taskId)).size === tasks.length &&
    tasks.every(task => task && typeof task.taskId === 'string' && task.taskId &&
      typeof task.taskName === 'string' && Number.isFinite(task.totalProgress) && task.totalProgress > 0 &&
      Number.isFinite(task.currentProgress) && ['ongoing', 'paused', 'completed'].includes(task.status) &&
      date(task.startDate) && Array.isArray(task.historyLogs) && task.historyLogs.every(log =>
        log && typeof log.logId === 'string' && ['start', 'update', 'pause', 'resume', 'complete'].includes(log.type) &&
        date(log.timestamp) && Number.isFinite(log.progressVal) && typeof log.title === 'string' && typeof log.note === 'string') &&
      (task.retrospective === undefined || task.retrospective &&
        typeof task.retrospective.content === 'string' && date(task.retrospective.updatedAt))) &&
    Object.entries(memos).every(([key, memo]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && typeof memo === 'string');
}

export type ConflictChoice = 'device' | 'cloud';

export function mergeSnapshots(base: Snapshot, device: Snapshot, cloud: Snapshot, choice?: ConflictChoice) {
  const conflicts: string[] = [];

  function mergeRecords<T>(before: Map<string, T>, local: Map<string, T>, remote: Map<string, T>, label: (key: string, item: T) => string) {
    const merged = new Map<string, T>();
    for (const key of new Set([...remote.keys(), ...local.keys(), ...before.keys()])) {
      const original = before.get(key);
      const ours = local.get(key);
      const theirs = remote.get(key);
      let result = ours;
      if (equal(ours, original)) {
        result = theirs;
      } else if (!equal(theirs, original) && !equal(ours, theirs)) {
        conflicts.push(label(key, ours ?? theirs!));
        if (choice === 'cloud') result = theirs;
      }
      if (result !== undefined) merged.set(key, result);
    }
    return merged;
  }

  const tasksById = (data: Snapshot) => new Map(data.tasks.map(task => [task.taskId, task]));
  const memosByDate = (data: Snapshot) => new Map(Object.entries(data.memos));
  const tasks = mergeRecords(tasksById(base), tasksById(device), tasksById(cloud), (_, task) => task.taskName);
  const memos = mergeRecords(memosByDate(base), memosByDate(device), memosByDate(cloud), key => key + ' 备忘');
  return { snapshot: { tasks: [...tasks.values()], memos: Object.fromEntries(memos) }, conflicts };
}
