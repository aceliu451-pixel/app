import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySnapshot, equal, isSnapshot, mergeSnapshots, type ConflictChoice, type Snapshot, type TaskData } from './sync-data';

interface Baseline {
  etag: string;
  snapshot: Snapshot;
}

interface DeviceState {
  snapshot: Snapshot;
  code?: string;
  baseline?: Baseline;
}

interface Conflict {
  code: string;
  names: string[];
  device: Snapshot;
  cloud: Baseline;
}

const syncURL = '/api/sync';
const codePattern = /^[a-f\d]{64}$/;
const storageKey = 'current';

function createDeviceStore(initial: Snapshot) {
  let database: Promise<IDBDatabase> | undefined;
  return async function changeDevice(change: (state: DeviceState) => DeviceState = state => state) {
    database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('taskflow-device', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('data');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const db = await database;

    return new Promise<DeviceState>((resolve, reject) => {
      const transaction = db.transaction('data', 'readwrite');
      const store = transaction.objectStore('data');
      const request = store.get(storageKey);
      let next: DeviceState;
      request.onsuccess = () => {
        try {
          const current = request.result ?? { snapshot: initial };
          next = change(current);
          if (!request.result || next !== current) store.put(next, storageKey);
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve(next);
      transaction.onabort = () => reject(transaction.error ?? new Error('无法保存到设备'));
      transaction.onerror = () => reject(transaction.error);
    });
  };
}

async function checkResponse(response: Response) {
  if (response.ok) return;
  if (response.status === 401) throw new Error('配对码不正确，请重新输入');
  if (response.status === 413) throw new Error('数据超过 4 MB，保留在本机，暂时无法上传');
  throw new Error('同步服务暂不可用，本机数据已保留');
}

async function fetchCloud(code: string, baseline?: Baseline): Promise<Baseline | undefined> {
  const response = await fetch(syncURL, {
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + code,
      ...(baseline ? { 'If-None-Match': baseline.etag } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 304 && baseline) return baseline;
  await checkResponse(response);

  const snapshot: unknown = await response.json();
  if (snapshot === null) return undefined;
  const etag = response.headers.get('etag');
  if (!etag || !isSnapshot(snapshot)) throw new Error('无法读取云端数据，本机数据已保留');
  return { etag, snapshot };
}

async function writeCloud(code: string, snapshot: Snapshot, previous?: Baseline) {
  const response = await fetch(syncURL, {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + code,
      'Content-Type': 'application/json',
      ...(previous ? { 'If-Match': previous.etag } : { 'If-None-Match': '*' }),
    },
    body: JSON.stringify(snapshot),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 409 || response.status === 412) return undefined;
  await checkResponse(response);

  const etag = response.headers.get('etag');
  if (!etag) throw new Error('无法确认云端版本，稍后会重试');
  return { etag, snapshot };
}

export function useTaskFlowSync(initial: Snapshot, sampleTasks: TaskData[], paused: boolean) {
  const [changeDevice] = useState(() => createDeviceStore(initial));
  const [device, setDevice] = useState<DeviceState>({ snapshot: initial });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<Conflict>();
  const running = useRef(false);
  const editing = useRef(paused);
  const channel = useRef<BroadcastChannel>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  editing.current = paused;

  const refresh = useCallback(async () => {
    try {
      setDevice(await changeDevice());
    } catch {
      setStatus('无法打开设备存储，旧数据仍保留');
    }
  }, [changeDevice]);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('taskflow-device');
      channel.current.onmessage = () => void refresh();
    }
    void refresh();
    return () => {
      channel.current?.close();
      clearTimeout(timer.current);
    };
  }, [refresh]);

  const sync = useCallback(async (options?: { code?: string; choice?: ConflictChoice; conflict?: Conflict }) => {
    if (running.current || editing.current) return;
    running.current = true;
    setBusy(true);
    try {
      let before = await changeDevice();
      const code = options?.code ?? before.code;
      if (!code) return;
      if (!navigator.onLine) {
        setStatus('离线 · 本机修改将在联网后同步');
        return;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const cloud = await fetchCloud(code, before.baseline);
        if (editing.current) return;
        if (before.baseline && !cloud) throw new Error('找不到原有云端版本，本机数据已保留');

        let pending: Conflict | undefined;
        const reconciled = await changeDevice(current => {
          if (current.code !== before.code || current.baseline?.etag !== before.baseline?.etag || editing.current) {
            return current;
          }

          const approved = options?.conflict;
          const choice = approved?.code === code && approved.cloud.etag === cloud?.etag && equal(approved.device, current.snapshot)
            ? options?.choice
            : undefined;
          const local = !current.baseline && cloud ? {
            ...current.snapshot,
            tasks: current.snapshot.tasks.filter(task => !sampleTasks.some(sample => equal(sample, task))),
          } : current.snapshot;
          const result = mergeSnapshots(current.baseline?.snapshot ?? emptySnapshot, local, cloud?.snapshot ?? emptySnapshot, choice);
          if (result.conflicts.length && !choice && cloud) {
            pending = { code, names: result.conflicts, device: current.snapshot, cloud };
            return current;
          }
          return { snapshot: result.snapshot, code, baseline: cloud };
        });

        if (editing.current) return;
        if (pending) {
          setConflict(pending);
          setStatus('有修改冲突，待选择版本');
          return;
        }
        if (reconciled.code !== code || reconciled.baseline?.etag !== cloud?.etag) {
          before = reconciled;
          if (before.code !== code && !options?.code) return;
          continue;
        }
        setConflict(undefined);
        setDevice(reconciled);
        channel.current?.postMessage('change');

        if (!cloud || !equal(reconciled.snapshot, cloud.snapshot)) {
          const saved = await writeCloud(code, reconciled.snapshot, cloud);
          if (!saved) {
            before = await changeDevice();
            continue;
          }
          const latest = await changeDevice(current =>
            current.code === code && current.baseline?.etag === cloud?.etag ? { ...current, baseline: saved } : current);
          setDevice(latest);
          channel.current?.postMessage('change');
        }

        const latest = await changeDevice();
        setDevice(latest);
        if (equal(latest.snapshot, latest.baseline?.snapshot)) setStatus('已同步');
        else {
          setStatus('已保存到本机 · 待同步');
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void sync(), 600);
        }
        return;
      }
      setStatus('云端正在更新，稍后自动重试');
    } catch (error) {
      setStatus(error instanceof Error && error.name === 'Error' && /[一-鿿]/.test(error.message)
        ? error.message
        : '暂时无法同步，本机数据已保留');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [changeDevice, sampleTasks]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void sync(), 600);
  }, [sync]);

  useEffect(() => {
    if (!device.code || paused) return;
    const onOnline = () => void sync();
    const onOffline = () => setStatus('离线 · 本机修改将在联网后同步');
    const onVisible = () => {
      if (document.visibilityState === 'visible') onOnline();
    };
    const interval = setInterval(onVisible, 30_000);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    onOnline();
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [device.code, paused, sync]);

  const edit = async (change: (current: Snapshot) => Snapshot) => {
    try {
      const next = await changeDevice(current => ({ ...current, snapshot: change(current.snapshot) }));
      setDevice(next);
      channel.current?.postMessage('change');
      if (next.code) {
        setStatus(navigator.onLine ? '已保存到本机 · 待同步' : '离线 · 已保存到本机');
        schedule();
      }
      return true;
    } catch (error) {
      setStatus(error instanceof Error && /[一-鿿]/.test(error.message)
        ? error.message
        : '无法保存修改，请保留原有数据后重试');
      return false;
    }
  };

  const connect = async (input: string) => {
    const code = input.trim().toLowerCase();
    if (!codePattern.test(code)) {
      setStatus('请输入完整的 64 位配对码');
      return;
    }
    await sync({ code });
  };

  return { device, status, busy, conflict, edit, connect, sync };
}
