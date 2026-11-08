export function isTaskFlowSnapshot(value) {
  if (!value || typeof value !== 'object') return false;
  const { tasks, memos } = value;
  if (!Array.isArray(tasks) || !memos || typeof memos !== 'object' || Array.isArray(memos)) return false;
  const date = (input) => typeof input === 'string' && Number.isFinite(Date.parse(input));
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

