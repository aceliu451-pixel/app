import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { get, put } from '@vercel/blob';
import { isSnapshot } from '../src/sync-data';

const pathname = 'taskflow/snapshot-v1.json';
const maximumBytes = 4_000_000;

function reply(response: ServerResponse, status: number, body: unknown, etag?: string) {
  if (etag) response.setHeader('ETag', etag);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(status === 304 ? undefined : JSON.stringify(body));
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  response.setHeader('Cache-Control', 'private, no-store');
  const verifier = process.env.TASKFLOW_SYNC_KEY_SHA256;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!verifier || !/^[a-f\d]{64}$/.test(verifier) || !token) {
    return reply(response, 503, { error: '同步服务尚未配置' });
  }

  const code = /^Bearer ([a-f\d]{64})$/.exec(request.headers.authorization ?? '')?.[1];
  if (!code || !timingSafeEqual(createHash('sha256').update(code).digest(), Buffer.from(verifier, 'hex'))) {
    return reply(response, 401, { error: '配对码不正确' });
  }

  const blobOptions = { access: 'private', useCache: false, token } as const;
  try {
    if (request.method === 'GET') {
      const known = request.headers['if-none-match'];
      const blob = await get(pathname, { ...blobOptions, ifNoneMatch: typeof known === 'string' ? known : undefined });
      if (!blob) return reply(response, 200, null);
      if (blob.statusCode === 304) return reply(response, 304, null, blob.blob.etag);
      return reply(response, 200, await new Response(blob.stream).json(), blob.blob.etag);
    }

    if (request.method !== 'PUT') {
      response.setHeader('Allow', 'GET, PUT');
      return reply(response, 405, { error: '不支持此操作' });
    }

    const previous = request.headers['if-match'];
    const creating = request.headers['if-none-match'] === '*';
    if (creating === (typeof previous === 'string')) return reply(response, 428, { error: '缺少版本条件' });

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!isSnapshot(body)) return reply(response, 400, { error: '同步数据格式有误' });
    const data = JSON.stringify(body);
    if (Buffer.byteLength(data) > maximumBytes) return reply(response, 413, { error: '同步数据超过 4 MB' });

    try {
      const blob = await put(pathname, data, {
        access: 'private',
        token,
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: !creating,
        ifMatch: typeof previous === 'string' ? previous : undefined,
      });
      return reply(response, 200, { ok: true }, blob.etag);
    } catch (error) {
      const latest = await get(pathname, blobOptions);
      if ((latest?.blob.etag ?? null) !== (creating ? null : previous)) {
        await latest?.stream?.cancel();
        return reply(response, 409, { error: '云端版本已更新' });
      }
      await latest?.stream?.cancel();
      throw error;
    }
  } catch {
    return reply(response, 503, { error: '同步服务暂不可用' });
  }
}
