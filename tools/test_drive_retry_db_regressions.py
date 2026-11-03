import sqlite3, tempfile, os, concurrent.futures

db=sqlite3.connect(':memory:')
db.executescript("""
CREATE TABLE opd_workbook_evidence_items(upload_id TEXT, year TEXT, opd_id TEXT, evidence_key TEXT, target_code TEXT, subunsur TEXT, param_id TEXT, grade TEXT, level INTEGER, file_name TEXT, file_type TEXT, r2_key TEXT, gdrive_id TEXT);
CREATE TABLE opd_data(id TEXT, year TEXT, opd TEXT);
INSERT INTO opd_data VALUES('opd-1','2026','Dinas X');
INSERT INTO opd_workbook_evidence_items VALUES('u1','2026','opd-1','T1|1.1|1.1.1','T1','1.1','1.1.1','A',5,'a.pdf','application/pdf','kawal/a.pdf',NULL);
""")
query="""SELECT o.opd,e.upload_id,e.evidence_key,e.target_code,e.subunsur,e.param_id,e.grade,e.level,e.file_name,e.file_type,e.r2_key,e.gdrive_id
FROM opd_workbook_evidence_items e JOIN opd_data o ON o.id=e.opd_id AND o.year=e.year
WHERE e.upload_id=? AND e.year=? AND e.opd_id=? LIMIT 1"""
assert db.execute(query,('u1','2026','opd-1')).fetchone()[0]=='Dinas X'

tmp=tempfile.mktemp(suffix='.db')
def insert_claim(_):
    c=sqlite3.connect(tmp,timeout=10)
    c.execute('PRAGMA busy_timeout=10000')
    c.execute('CREATE TABLE IF NOT EXISTS evidence_upload_registry(upload_id TEXT PRIMARY KEY, year TEXT, opd_id TEXT, subunsur TEXT, param_id TEXT, level TEXT, type TEXT)')
    c.execute("INSERT OR IGNORE INTO evidence_upload_registry VALUES(?,?,?,?,?,?,?)",('same-upload','2026','opd-1','1.1','1.1.1','5','evidence'))
    c.commit()
    row=c.execute('SELECT year,opd_id,subunsur,param_id,level,type FROM evidence_upload_registry WHERE upload_id=?',('same-upload',)).fetchone()
    c.close()
    return row
with concurrent.futures.ThreadPoolExecutor(max_workers=25) as pool:
    rows=list(pool.map(insert_claim,range(25)))
c=sqlite3.connect(tmp)
assert c.execute('SELECT COUNT(*) FROM evidence_upload_registry WHERE upload_id=?',('same-upload',)).fetchone()[0]==1
assert all(r==('2026','opd-1','1.1','1.1.1','5','evidence') for r in rows)
c.execute("INSERT OR IGNORE INTO evidence_upload_registry VALUES(?,?,?,?,?,?,?)",('same-upload','2026','opd-2','1.1','1.1.1','5','evidence'))
conflict=c.execute('SELECT opd_id FROM evidence_upload_registry WHERE upload_id=?',('same-upload',)).fetchone()[0]
assert conflict!='opd-2'
c.close(); os.remove(tmp)
print('PASS: retry JOIN query and 25-way idempotent upload registry claim')


# Exact durable outbox UPSERT extracted from the deployed handler source. Replaying
# an identical uploadId is idempotent; reusing it for another OPD/R2 key must not
# redirect the saved Drive job.
from pathlib import Path
import json, re
project_root=Path(__file__).resolve().parents[1]
handler=(project_root/'functions'/'myCloudinaryHandler.js').read_text()
start=handler.index('INSERT INTO drive_backup_jobs')
end=handler.index('  `).bind(',start)
outbox_sql=handler[start:end]
assert outbox_sql.count('?')==6, f'Unexpected outbox bind count: {outbox_sql.count("?")}'
queue_db=sqlite3.connect(':memory:')
queue_db.executescript((project_root/'database/migrations/20261102_durable_drive_backup_queue.sql').read_text())
queue_db.executescript((project_root/'database/migrations/20261103_durable_drive_queue_dispatch_and_pacing.sql').read_text())
stamp=1700000000000
def upsert(job):
    return queue_db.execute(outbox_sql,(
        job['uploadId'],json.dumps(job,separators=(',',':')),stamp,'',stamp,stamp
    ))
job={'type':'workbook_evidence','uploadId':'same-job','year':'2026','opdId':'opd-a','r2Key':'r2/opd-a/a.pdf','evidenceKey':'T1|1.1|1.1.1'}
upsert(job)
upsert(dict(job))
stored=json.loads(queue_db.execute('SELECT job_json FROM drive_backup_jobs WHERE upload_id=?',('same-job',)).fetchone()[0])
assert stored==job
conflict=dict(job,opdId='opd-b',r2Key='r2/opd-b/b.pdf')
upsert(conflict)
stored_after_conflict=json.loads(queue_db.execute('SELECT job_json FROM drive_backup_jobs WHERE upload_id=?',('same-job',)).fetchone()[0])
assert stored_after_conflict==job, 'A colliding uploadId must not overwrite a Drive job belonging to another OPD'
assert stored_after_conflict['opdId']=='opd-a'
print('PASS: exact durable outbox UPSERT is idempotent and rejects cross-OPD uploadId collisions')
