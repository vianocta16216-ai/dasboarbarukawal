import {
  runSetdaCompilationSchedule,
  getGoogleDriveConfigurationStatus,
  dispatchDueDriveBackupJobs,
  drainDriveBackupQueue,
  processDriveBackupQueueMessage,
  recoverStalledDriveBackupJobs
} from '../functions/myCloudinaryHandler.js';

const MESSAGE_CONCURRENCY = 2;

async function runLimited(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export default {
  async queue(batch, env, ctx) {
    const messages = Array.isArray(batch?.messages) ? batch.messages : [];
    const results = await runLimited(messages, MESSAGE_CONCURRENCY, async (message) => {
      const uploadId = String(message?.body?.uploadId || '').trim();
      if (!uploadId) {
        message.ack();
        return { ack: true, invalid: true };
      }
      try {
        const result = await processDriveBackupQueueMessage(env, uploadId, ctx);
        // D1 is the durable retry source. Queue delivery is acknowledged after
        // the next_attempt_at and error state have been safely recorded in D1.
        message.ack();
        return result;
      } catch (error) {
        console.error('Drive queue consumer could not persist job state:', error?.message || error);
        // If D1 itself is unavailable, use Queue's own retry mechanism as well.
        message.retry({ delaySeconds: 30 });
        return { ack: false, retry: true };
      }
    });
    console.log('KAWAL SPIP Drive queue batch:', JSON.stringify({ received: messages.length, concurrency: MESSAGE_CONCURRENCY, results }));
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runSetdaCompilationSchedule(env).catch(e=>console.error("SETDA scheduler:",e.message)));
    ctx.waitUntil((async () => {
      const result = env.DRIVE_BACKUP_QUEUE?.sendBatch
        ? await dispatchDueDriveBackupJobs(env, 100)
        : await drainDriveBackupQueue(env, 4, true, ctx);
      // If Queue is unavailable or its plan quota is exhausted, continue draining
      // the durable D1 outbox directly at a conservative rate. This keeps Drive
      // backup moving instead of treating Queue as a single point of failure.
      const fallback = (result?.error || result?.queueUnavailable)
        ? await drainDriveBackupQueue(env, 10, true, ctx)
        : null;
      // If Queue accepted dispatches but stopped consuming, a small D1 watchdog
      // repairs overdue jobs without waiting for users to re-upload their files.
      const watchdog = await recoverStalledDriveBackupJobs(env, 2, ctx).catch(e=>({error:String(e?.message||e)}));
      console.log('KAWAL SPIP D1 outbox dispatcher:', JSON.stringify({ result, fallback, watchdog }));
    })());
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/health') return new Response('Not found', { status: 404 });
    let database = 'unknown';
    let backupQueue = { pending: null, retrying: null, due: null, oldestPendingAt: null };
    try {
      await env.DB.prepare('SELECT 1 AS ok').first();
      database = 'ok';
      const stats=await env.DB.prepare(`SELECT
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='retrying' THEN 1 ELSE 0 END) AS retrying,
        SUM(CASE WHEN status IN ('pending','retrying') AND next_attempt_at<=? THEN 1 ELSE 0 END) AS due,
        MIN(CASE WHEN status IN ('pending','retrying') THEN created_at END) AS oldest_pending_at
        FROM drive_backup_jobs`).bind(Date.now()).first();
      backupQueue={pending:Number(stats?.pending||0),retrying:Number(stats?.retrying||0),due:Number(stats?.due||0),oldestPendingAt:stats?.oldest_pending_at?new Date(Number(stats.oldest_pending_at)).toISOString():null};
    } catch (_) {
      database = 'error';
    }
    const r2Bound=!!env.EVIDENCE_BUCKET;
    const queueProducerBound=!!env.DRIVE_BACKUP_QUEUE?.sendBatch;
    const driveConfiguration=getGoogleDriveConfigurationStatus(env);
    const googleDriveConfigured=driveConfiguration.configured;
    const realtimeBound=!!env.REALTIME;
    const healthy=database==='ok'&&r2Bound&&queueProducerBound&&realtimeBound&&googleDriveConfigured;
    return Response.json({
      status: healthy ? 'ok' : 'degraded',
      service: 'kawal-spip-drive-backup-worker',
      database,
      queueProducerBound,
      realtimeBound,
      r2Bound,
      googleDriveConfigured,
      missingGoogleDriveVariables: driveConfiguration.missing,
      googleDriveAuthenticationVerified: false,
      configurationHelp: googleDriveConfigured
        ? 'Runtime lengkap. Health ini tidak menguji OAuth atau izin folder; pastikan satu upload mencapai syncStatus done dan file terlihat di Drive.'
        : 'Isi empat GOOGLE_DRIVE_* di Settings > Variables and Secrets (Runtime / Production) worker ini, bukan Build. Secrets Pages tidak diwariskan. Simpan dan deploy.',
      build: '20261103-drive-runtime-diagnostics', 
      backupQueue,
      d1OutboxFallback: true,
      at: new Date().toISOString()
    }, { status: healthy ? 200 : 503 });
  }
};
