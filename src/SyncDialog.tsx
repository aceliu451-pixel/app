import { useRef, useState } from 'react';
import { emptySnapshot, isSnapshot, mergeSnapshots, type Snapshot } from './sync-data';
import type { useTaskFlowSync } from './use-taskflow-sync';

function downloadBackup(snapshot: Snapshot, source: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'TaskFlow-' + source + '-' + new Date().toISOString().slice(0, 10) + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SyncDialog({ controller, onClose }: {
  controller: ReturnType<typeof useTaskFlowSync>;
  onClose: () => void;
}) {
  const { device, status, busy, conflict, connect, sync, edit } = controller;
  const [code, setCode] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [changeCode, setChangeCode] = useState(false);
  const needsCode = changeCode || !device.code;

  async function importBackup(file: File) {
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!isSnapshot(data)) throw new Error('请选择 TaskFlow 导出的备份文件');
      const saved = await edit(current => {
        const result = mergeSnapshots(emptySnapshot, current, data);
        if (result.conflicts.length) throw new Error('备份与本机有重叠修改，已保留两份原始数据');
        return result.snapshot;
      });
      setImportStatus(saved ? '备份已导入本机' : '');
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : '无法导入备份');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="sync-title" className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="sync-title" className="text-lg font-bold">跨设备同步</h2>
          <button className="rounded-lg px-3 py-1.5 text-sm text-gray-600" onClick={onClose}>关闭</button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          先在有旧任务的设备上连接，再在其他设备输入同一个配对码。离线修改会保存在本机。
        </p>
        {needsCode ? (
          <form className="mt-4 flex gap-2" onSubmit={event => {
            event.preventDefault();
            void connect(code).then(() => { setCode(''); setChangeCode(false); });
          }}>
            <input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-label="同步配对码"
              value={code} onChange={event => setCode(event.target.value)} placeholder="输入同步配对码"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base" />
            <button type="submit" disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">连接</button>
          </form>
        ) : (
          <div className="mt-4 flex gap-3">
            <button disabled={busy} onClick={() => void sync()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">立即同步</button>
            <button disabled={busy} onClick={() => setChangeCode(true)} className="text-sm text-blue-700">重新输入配对码</button>
          </div>
        )}
        <p role="status" className="mt-3 text-sm text-gray-700">{busy ? '同步中…' : status || (device.code ? '等待同步' : '仅保存在本机')}</p>
        {conflict && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
            <p>以下记录在两端都有修改。请选择这些记录要保留的版本。</p>
            <ul className="my-2 list-disc pl-5">{conflict.names.map((name, index) => <li key={index}>{name}</li>)}</ul>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md border border-amber-700 px-2 py-1" disabled={busy}
                onClick={() => void sync({ conflict, choice: 'device', code: conflict.code })}>保留冲突中的本机版本</button>
              <button className="rounded-md border border-amber-700 px-2 py-1" disabled={busy}
                onClick={() => void sync({ conflict, choice: 'cloud', code: conflict.code })}>保留冲突中的云端版本</button>
              <button className="underline" onClick={() => downloadBackup(conflict.cloud.snapshot, '云端')}>下载云端备份</button>
            </div>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-4 border-t border-gray-200 pt-4 text-sm text-blue-700">
          <button onClick={() => downloadBackup(device.snapshot, '本机')}>下载本机备份</button>
          <button disabled={busy} onClick={() => input.current?.click()}>导入备份</button>
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void importBackup(file);
          }} />
        </div>
        {importStatus && <p role="status" className="mt-2 text-sm text-gray-700">{importStatus}</p>}
      </section>
    </div>
  );
}
