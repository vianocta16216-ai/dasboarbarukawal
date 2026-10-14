from pathlib import Path
p=Path('/mnt/data/kawal_work_next/functions/myCloudinaryHandler.js')
s=p.read_text()
# Safe public action for expiring Office Online viewer URLs
s=s.replace("const SAFE_PUBLIC_ACTIONS = new Set(['authMe','login','verifyAccess']);", "const SAFE_PUBLIC_ACTIONS = new Set(['authMe','login','verifyAccess','previewPublicEvidence']);")
s=s.replace("'getEvidenceWorkflow','downloadEvidence','getLheFollowups'", "'getEvidenceWorkflow','downloadEvidence','previewEvidence','createEvidencePreviewLink','getLheFollowups'",1)
s=s.replace("'saveKkPmMeta','saveKkRpjmdMapping','getKkRpjmdMappings','getWorkbookEvidenceFiles'", "'saveKkPmMeta','saveKkRpjmdMapping','getKkRpjmdMappings','createEvidencePreviewLink','previewEvidence','getWorkbookEvidenceFiles'",1)
s=s.replace("'verifyAccess', 'verifyDelete', 'login', 'logout', 'saveEvidenceWorkflowStep'", "'verifyAccess', 'verifyDelete', 'login', 'logout', 'createEvidencePreviewLink', 'saveEvidenceWorkflowStep'",1)
# Insert verified score helpers after calculateSAFromSubunsur
needle="""function calculateSAFromSubunsur(subunsurs) {
  return structureProcessBreakdown(subunsurs || {}).value;
}
"""
insert=needle+'''\n// Nilai Struktur & Proses resmi internal dihitung hanya dari bukti yang telah\n// diterima oleh verifikator. Level bersumber dari kolom files1..files5, bukan\n// dari angka yang dipilih sendiri sebelum bukti diverifikasi. Bila satu parameter\n// mempunyai beberapa file pada beberapa level, digunakan level tertinggi yang\n// memiliki minimal satu file berstatus Diterima/Diterima dengan Catatan.\nconst VERIFIED_STRUCTURE_STATUSES = new Set(['diterima','diterima_catatan']);\nfunction normalizedFileArray(value){\n  if(Array.isArray(value))return value;\n  if(typeof value==='string'){try{const p=JSON.parse(value);return Array.isArray(p)?p:[];}catch{return [];}}\n  if(value&&typeof value==='object'&&Array.isArray(value.files))return value.files;\n  return [];\n}\nfunction calculateVerifiedStructureProcessBreakdown(subunsurs, workbookRows=[]){\n  const totalParams=countTotalParameters();\n  const verifiedLevels=new Map();\n  for(const [subCode,subInfo] of Object.entries(SUBUNSUR_DATA||{})){\n    for(const param of (Array.isArray(subInfo?.params)?subInfo.params:[])){\n      let maxLevel=0;\n      for(let lv=1;lv<=5;lv++){\n        const files=normalizedFileArray(subunsurs?.[subCode]?.[param.id]?.['files'+lv]);\n        if(files.some(file=>{const v=normalizeVerificationRecord(file?.verification||file);return VERIFIED_STRUCTURE_STATUSES.has(v.status);} ))maxLevel=lv;\n      }\n      if(maxLevel>0)verifiedLevels.set(`${subCode}|${param.id}`,maxLevel);\n    }\n  }\n  for(const file of (Array.isArray(workbookRows)?workbookRows:[])){\n    const status=String(file?.verification_status||file?.verificationStatus||'');\n    const lv=Math.max(0,Math.min(5,Number(file?.level)||0));\n    const sub=String(file?.subunsur||''),param=String(file?.param_id||file?.paramId||'');\n    if(!VERIFIED_STRUCTURE_STATUSES.has(status)||lv<1||!sub||!param)continue;\n    const key=`${sub}|${param}`;\n    if(!SUBUNSUR_DATA?.[sub]?.params?.some(x=>String(x.id)===param))continue;\n    verifiedLevels.set(key,Math.max(Number(verifiedLevels.get(key)||0),lv));\n  }\n  const byLevel={1:0,2:0,3:0,4:0,5:0};let sumLevels=0;\n  for(const lv of verifiedLevels.values()){if(lv>=1&&lv<=5){byLevel[lv]++;sumLevels+=lv;}}\n  return {totalParams,verifiedParams:verifiedLevels.size,selectedParams:verifiedLevels.size,sumLevels,byLevel,value:totalParams?Math.round((sumLevels/totalParams)*100)/100:0,source:'verified_evidence_only'};\n}\nasync function refreshVerifiedStructureProcessScore(env,year,opdId){\n  for(let attempt=0;attempt<6;attempt++){\n    const row=await env.DB.prepare('SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId),String(year)).first();\n    if(!row)throw new Error('OPD tidak ditemukan saat menghitung Nilai Struktur dan Proses.');\n    const raw=String(row.subunsurs||'{}');let obj={};try{obj=JSON.parse(raw||'{}')}catch{obj={};}\n    const files=await env.DB.prepare('SELECT subunsur,param_id,level,verification_status,updated_at FROM opd_workbook_evidence_items WHERE year=? AND opd_id=?').bind(String(year),String(opdId)).all();\n    const maxUpdated=Number((await env.DB.prepare('SELECT COALESCE(MAX(updated_at),0) AS t FROM opd_workbook_evidence_items WHERE year=? AND opd_id=?').bind(String(year),String(opdId)).first())?.t||0);\n    const breakdown=calculateVerifiedStructureProcessBreakdown(obj,files.results||[]);\n    const status=breakdown.verifiedParams>=breakdown.totalParams&&breakdown.totalParams>0?'Selesai':(breakdown.verifiedParams>0?'Proses':'Belum');\n    const write=await runD1WithRetry(()=>env.DB.prepare(`UPDATE opd_data SET sa=?,nilai_struktur_proses=?,struktur_proses_status=? WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=? AND COALESCE((SELECT MAX(updated_at) FROM opd_workbook_evidence_items WHERE year=? AND opd_id=?),0)=?`).bind(breakdown.value,breakdown.value,status,String(opdId),String(year),raw,String(year),String(opdId),maxUpdated));\n    if(Number(write.meta?.changes||0)>0)return {...breakdown,status};\n    await new Promise(resolve=>setTimeout(resolve,15*(attempt+1)));\n  }\n  throw new Error('Nilai Struktur dan Proses sedang diperbarui operator lain. Muat ulang sebentar lagi.');\n}\nasync function saveLegacyEvidenceVerificationAtomic(env,year,opdId,subunsur,paramId,level,uploadId,verification){\n  for(let attempt=0;attempt<6;attempt++){\n    const row=await env.DB.prepare('SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId),String(year)).first();\n    if(!row)throw new Error('OPD tidak ditemukan.');\n    const raw=String(row.subunsurs||'{}');let obj={};try{obj=JSON.parse(raw||'{}')}catch{obj={};}\n    const arr=obj?.[subunsur]?.[paramId]?.['files'+level];\n    if(!Array.isArray(arr))throw new Error('Daftar file evidence tidak ditemukan.');\n    const file=arr.find(x=>x&&typeof x==='object'&&String(x.uploadId||'')===String(uploadId));\n    if(!file)throw new Error('File evidence tidak ditemukan pada OPD/parameter/level yang sama.');\n    file.verification=verification;if(file.replacementStatus==='menunggu_verifikasi')file.replacementStatus=null;\n    const write=await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?").bind(JSON.stringify(obj),String(opdId),String(year),raw));\n    if(Number(write.meta?.changes||0)>0){const score=await refreshVerifiedStructureProcessScore(env,year,opdId);return {verification,summary:calculateVerificationSummaryServer(arr),score};}\n    await new Promise(resolve=>setTimeout(resolve,12*(attempt+1)));\n  }\n  const e=new Error('Data evidence berubah karena operator lain sedang menyimpan. Muat ulang dan ulangi verifikasi.');e.status=409;throw e;\n}\nasync function syncStructureVerificationForUpload(env,year,opdId,uploadId,status,examinerName,note,now){\n  // Update the legacy nested evidence with CAS, if this upload belongs to it.\n  for(let attempt=0;attempt<5;attempt++){\n    const row=await env.DB.prepare('SELECT subunsurs FROM opd_data WHERE id=? AND year=? LIMIT 1').bind(String(opdId),String(year)).first();if(!row)break;\n    const raw=String(row.subunsurs||'{}');let obj={};try{obj=JSON.parse(raw||'{}')}catch{obj={};}\n    let found=null;\n    for(const [sub,paramGroup] of Object.entries(obj||{})){for(const [param,data] of Object.entries(paramGroup||{})){for(let lv=1;lv<=5;lv++){const arr=normalizedFileArray(data?.['files'+lv]);const f=arr.find(x=>x&&typeof x==='object'&&String(x.uploadId||'')===String(uploadId));if(f){found={sub,param,level:lv,file:f};break;}}if(found)break;}if(found)break;}\n    if(!found)break;\n    found.file.verification={examinerName,note,status,verifiedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};\n    if(found.file.replacementStatus==='menunggu_verifikasi')found.file.replacementStatus=null;\n    const write=await runD1WithRetry(()=>env.DB.prepare("UPDATE opd_data SET subunsurs=? WHERE id=? AND year=? AND COALESCE(subunsurs,'{}')=?").bind(JSON.stringify(obj),String(opdId),String(year),raw));\n    if(Number(write.meta?.changes||0)>0)break;\n  }\n  const workbook=await env.DB.prepare('SELECT upload_id FROM opd_workbook_evidence_items WHERE upload_id=? AND year=? AND opd_id=? LIMIT 1').bind(String(uploadId),String(year),String(opdId)).first();\n  if(workbook){await runD1WithRetry(()=>env.DB.prepare('UPDATE opd_workbook_evidence_items SET verification_status=?,verification_examiner=?,verification_note=?,verification_at=?,updated_at=? WHERE upload_id=? AND year=? AND opd_id=?').bind(status,examinerName,note,now,now,String(uploadId),String(year),String(opdId)));}\n  await refreshVerifiedStructureProcessScore(env,year,opdId).catch(err=>{console.error('Pembaruan skor verifikasi tertunda:',err?.message||err);throw err;});\n}\n'''
if needle not in s: raise SystemExit('helper insertion needle not found')
s=s.replace(needle,insert,1)
# include stage label status and accepted-note handling server
s=s.replace("const allowedStatuses=stage==='auditor'?['dikirim']:['diterima','dikembalikan'];", "const allowedStatuses=stage==='auditor'?['dikirim']:['diterima','diterima_catatan','dikembalikan'];")
s=s.replace("if(status==='dikembalikan'&&note.trim().length<2)throw new Error('Catatan wajib diisi jika bukti dikembalikan.');", "if(['diterima_catatan','dikembalikan'].includes(status)&&note.trim().length<2)throw new Error('Catatan wajib diisi untuk Diterima dengan Catatan atau Dikembalikan.');",1)
# stage previous prerequisites allow accepted with notes for BPKP
old="""        const previousStage=stage==='irban'?'auditor':(stage==='bpkp'?'irban':'');
        const previousStatus=stage==='irban'?'dikirim':(stage==='bpkp'?'diterima':'');
        const baseValues=[String(year),opdId,uploadId,stage,status,examinerName,note,String(authSession.username||''),now];
        let write;
        if(previousStage){
          // Check the prerequisite in the same atomic D1 statement as the write. A
          // separate SELECT-then-INSERT allowed a downstream reviewer to commit a
          // stale decision while an upstream reviewer was returning the same file.
          write=await env.DB.prepare(`INSERT INTO evidence_verification_steps(year,opd_id,upload_id,stage,status,examiner_name,note,updated_by,updated_at)
            SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (
              SELECT 1 FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=? AND stage=? AND status=?
            ) ON CONFLICT(year,opd_id,upload_id,stage) DO UPDATE SET status=excluded.status,examiner_name=excluded.examiner_name,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
            .bind(...baseValues,String(year),opdId,uploadId,previousStage,previousStatus).run();
          if(!Number(write.meta?.changes||0))return jsonResponse({status:'error',code:'VERIFICATION_STAGE_CONFLICT',message:stage==='irban'?'Status Auditor belum Dikirim atau sudah berubah. Muat ulang status evidence sebelum memverifikasi.':'Status Irban bukan Diterima lagi. Muat ulang status evidence sebelum verifikasi akhir BPKP.'},409);
        }else{"""
new="""        const previousStage=stage==='irban'?'auditor':(stage==='bpkp'?'irban':'');
        const previousStatuses=stage==='irban'?['dikirim']:(stage==='bpkp'?['diterima','diterima_catatan']:[]);
        const baseValues=[String(year),opdId,uploadId,stage,status,examinerName,note,String(authSession.username||''),now];
        let write;
        if(previousStage){
          // Atomic prerequisite check: Irban may proceed only after Auditor sends;
          // BPKP may proceed after Irban accepts with or without notes.
          const statusClause=previousStatuses.length===1?'status=?':'status IN (?,?)';
          write=await env.DB.prepare(`INSERT INTO evidence_verification_steps(year,opd_id,upload_id,stage,status,examiner_name,note,updated_by,updated_at)
            SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (
              SELECT 1 FROM evidence_verification_steps WHERE year=? AND opd_id=? AND upload_id=? AND stage=? AND ${statusClause}
            ) ON CONFLICT(year,opd_id,upload_id,stage) DO UPDATE SET status=excluded.status,examiner_name=excluded.examiner_name,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
            .bind(...baseValues,String(year),opdId,uploadId,previousStage,...previousStatuses).run();
          if(!Number(write.meta?.changes||0))return jsonResponse({status:'error',code:'VERIFICATION_STAGE_CONFLICT',message:stage==='irban'?'Status Auditor belum Dikirim atau sudah berubah. Muat ulang status evidence sebelum memverifikasi.':'Status Irban belum Diterima atau Diterima dengan Catatan lagi. Muat ulang status evidence sebelum verifikasi akhir BPKP.'},409);
        }else{"""
if old not in s: raise SystemExit('workflow prerequisite block not found')
s=s.replace(old,new,1)
# after audit insert apply Irban decision to evidence tables and score
needle2="""        await env.DB.prepare('INSERT INTO evidence_verification_audit(year,opd_id,upload_id,stage,status,examiner_name,note,updated_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(String(year),opdId,uploadId,stage,status,examinerName,note,String(authSession.username||''),now).run();
        if(fileRecord?.sourceType==='lhe_evidence'){"""
repl2="""        await env.DB.prepare('INSERT INTO evidence_verification_audit(year,opd_id,upload_id,stage,status,examiner_name,note,updated_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(String(year),opdId,uploadId,stage,status,examinerName,note,String(authSession.username||''),now).run();
        if(stage==='irban'){
          // Keep the score-bearing evidence metadata and dashboard score synchronized
          // with the authoritative Irban decision. Auditor's 'dikirim' is not a score.
          await syncStructureVerificationForUpload(env,year,opdId,uploadId,status,examinerName,note,now);
        }
        if(fileRecord?.sourceType==='lhe_evidence'){"""
if needle2 not in s: raise SystemExit('audit insertion needle not found')
s=s.replace(needle2,repl2,1)
# replace direct verification case contents with atomic CAS and score result
start=s.index("      case 'saveEvidenceVerification': {")
end=s.index("      case 'saveRtpEvidenceVerification': {",start)
oldcase=s[start:end]
newcase='''      case 'saveEvidenceVerification': {
        const opdId=String(params.opdId||'');
        const subunsur=String(params.subunsur||'');
        const paramId=String(params.paramId||'');
        const level=String(params.level||'');
        const uploadId=String(params.uploadId||'');
        const status=String(params.status||'');
        const examinerName=sanitizeVerificationField(params.examinerName,100);
        const note=sanitizeVerificationField(params.note,1000);
        if(!opdId||!subunsur||!paramId||!/^[1-5]$/.test(level)||!uploadId)throw new Error('Lokasi evidence tidak lengkap.');
        if(!VERIFICATION_STATUS_SET.has(status))throw new Error('Hasil verifikasi tidak valid.');
        if(!examinerName)throw new Error('Nama pemeriksa wajib diisi.');
        if((status==='diterima_catatan'||status==='dikembalikan')&&!note)throw new Error('Catatan pemeriksa wajib diisi untuk status ini.');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const now=new Date().toISOString();
        const saved=await saveLegacyEvidenceVerificationAtomic(env,year,opdId,subunsur,paramId,level,uploadId,{examinerName,note,status,verifiedAt:now,updatedAt:now});
        notifyRealtime(env,ctx,year,{action:'saveEvidenceVerification',opdId,subunsur,paramId,level,uploadId,status,nilaiStrukturProses:saved.score.value});
        return jsonResponse({status:'success',verification:saved.verification,summary:saved.summary,nilaiStrukturProses:saved.score.value,strukturProsesStatus:saved.score.status,structureProcessBreakdown:saved.score});
      }

'''
s=s[:start]+newcase+s[end:]
# enhance saveWorkbookEvidenceVerification to refresh computed score and validate access
old="""      case 'saveWorkbookEvidenceVerification': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');if(!opdId||!uploadId)throw new Error('Identitas evidence tidak lengkap.');
        const verificationStatus=sanitizeQaText(params.verificationStatus,30),verificationExaminer=sanitizeQaText(params.verificationExaminer,100),verificationNote=sanitizeQaText(params.verificationNote,2000);
        if(verificationStatus&&!['diterima','diterima_catatan','dikembalikan'].includes(verificationStatus))throw new Error('Status verifikasi tidak valid.');
        if(!verificationStatus)throw new Error('Status verifikasi wajib dipilih.');
        if(verificationStatus!=='dikembalikan'&&verificationExaminer.length<2)throw new Error('Nama pemeriksa wajib diisi untuk evidence yang diverifikasi.');
        if(['diterima_catatan','dikembalikan'].includes(verificationStatus)&&verificationNote.length<2)throw new Error('Catatan verifikasi wajib diisi untuk status tersebut.');
        const now=Date.now();const res=await env.DB.prepare('UPDATE opd_workbook_evidence_items SET verification_status=?,verification_examiner=?,verification_note=?,verification_at=?,updated_at=? WHERE upload_id=? AND year=? AND opd_id=?').bind(verificationStatus,verificationExaminer,verificationNote,now,now,uploadId,String(year),opdId).run();
        if(!res.meta?.changes)throw new Error('Evidence tidak ditemukan pada OPD/tahun yang sama.');notifyRealtime(env,ctx,year,{action:'saveWorkbookEvidenceVerification',opdId,uploadId});return jsonResponse({status:'success',uploadId,verificationStatus,verificationExaminer,verificationNote,verificationAt:now});
      }
"""
new="""      case 'saveWorkbookEvidenceVerification': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');if(!opdId||!uploadId)throw new Error('Identitas evidence tidak lengkap.');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const verificationStatus=sanitizeQaText(params.verificationStatus,30),verificationExaminer=sanitizeQaText(params.verificationExaminer,100),verificationNote=sanitizeQaText(params.verificationNote,2000);
        if(!['diterima','diterima_catatan','dikembalikan'].includes(verificationStatus))throw new Error('Status verifikasi tidak valid.');
        if(verificationExaminer.length<2)throw new Error('Nama pemeriksa wajib diisi untuk evidence yang diverifikasi.');
        if(['diterima_catatan','dikembalikan'].includes(verificationStatus)&&verificationNote.length<2)throw new Error('Catatan verifikasi wajib diisi untuk status tersebut.');
        const now=Date.now();const res=await runD1WithRetry(()=>env.DB.prepare('UPDATE opd_workbook_evidence_items SET verification_status=?,verification_examiner=?,verification_note=?,verification_at=?,updated_at=? WHERE upload_id=? AND year=? AND opd_id=?').bind(verificationStatus,verificationExaminer,verificationNote,now,now,uploadId,String(year),opdId).run());
        if(!res.meta?.changes)throw new Error('Evidence tidak ditemukan pada OPD/tahun yang sama.');
        const score=await refreshVerifiedStructureProcessScore(env,year,opdId);
        notifyRealtime(env,ctx,year,{action:'saveWorkbookEvidenceVerification',opdId,uploadId,verificationStatus,nilaiStrukturProses:score.value});
        return jsonResponse({status:'success',uploadId,verificationStatus,verificationExaminer,verificationNote,verificationAt:now,nilaiStrukturProses:score.value,strukturProsesStatus:score.status,structureProcessBreakdown:score});
      }
"""
if old not in s: raise SystemExit('saveWorkbookEvidenceVerification block not found')
s=s.replace(old,new,1)
# insert secure preview helpers after privateEvidenceUrl
needle3="""function privateEvidenceUrl(year,opdId,uploadId){
  const q=new URLSearchParams({action:'downloadEvidence',year:String(year),opdId:String(opdId),uploadId:String(uploadId)});
  return `/myCloudinaryHandler?${q.toString()}`;
}
"""
insert3=needle3+'''async function previewSignature(env,payload){\n  const secret=String(env.EVIDENCE_PREVIEW_SECRET||env.GOOGLE_DRIVE_CLIENT_SECRET||'');\n  if(secret.length<32)throw new Error('Preview Office memerlukan EVIDENCE_PREVIEW_SECRET minimal 32 karakter atau GOOGLE_DRIVE_CLIENT_SECRET yang valid.');\n  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);\n  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));\n  return Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');\n}\nfunction constantTimeTextEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}\nfunction evidencePreviewPayload(year,opdId,uploadId,expires){return `${String(year)}|${String(opdId)}|${String(uploadId)}|${String(expires)}`;}\n'''
if needle3 not in s: raise SystemExit('private url function not found')
s=s.replace(needle3,insert3,1)
# cases before downloadEvidence
needle4="""      case 'downloadEvidence': {
"""
cases='''      case 'createEvidencePreviewLink': {\n        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');\n        if(!opdId||!uploadId)throw new Error('Identitas file untuk preview belum lengkap.');\n        await assertSessionCanAccessOpd(env,authSession,year,opdId);\n        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)throw new Error('Berkas belum tersedia di penyimpanan privat.');\n        const expires=Math.floor(Date.now()/1000)+600;const payload=evidencePreviewPayload(year,opdId,uploadId,expires);const sig=await previewSignature(env,payload);\n        const previewUrl=new URL('/myCloudinaryHandler',url.origin);previewUrl.searchParams.set('action','previewPublicEvidence');previewUrl.searchParams.set('year',String(year));previewUrl.searchParams.set('opdId',opdId);previewUrl.searchParams.set('uploadId',uploadId);previewUrl.searchParams.set('expires',String(expires));previewUrl.searchParams.set('sig',sig);\n        return jsonResponse({status:'success',url:previewUrl.toString(),expiresAt:expires*1000,expiresInSeconds:600,fileName:file.fileName||'Evidence',fileType:file.fileType||'application/octet-stream'});\n      }\n      case 'previewEvidence': {\n        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');\n        await assertSessionCanAccessOpd(env,authSession,year,opdId);\n        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)return jsonResponse({status:'error',message:'Berkas belum tersedia di penyimpanan privat.'},404);\n        const object=await env.EVIDENCE_BUCKET.get(file.r2Key);if(!object)return jsonResponse({status:'error',message:'Berkas tidak ditemukan pada penyimpanan R2.'},404);\n        const contentType=String(file.fileType||object.httpMetadata?.contentType||'application/octet-stream').split(';')[0].trim().toLowerCase();\n        const headers=new Headers({'Content-Type':contentType,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':\"default-src 'none'; frame-ancestors 'self'; sandbox\"});\n        if(object.httpEtag)headers.set('ETag',object.httpEtag);return new Response(request.method==='HEAD'?null:object.body,{status:200,headers});\n      }\n      case 'previewPublicEvidence': {\n        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||''),expires=Number(params.expires||0),sig=String(params.sig||'');\n        const now=Math.floor(Date.now()/1000);if(!opdId||!uploadId||!Number.isInteger(expires)||expires<now||expires>now+660||!/^[a-f0-9]{64}$/i.test(sig))return jsonResponse({status:'error',message:'Tautan preview Office tidak valid atau sudah kedaluwarsa.'},403);\n        let expected='';try{expected=await previewSignature(env,evidencePreviewPayload(year,opdId,uploadId,expires));}catch{return jsonResponse({status:'error',message:'Preview Office belum dikonfigurasi.'},503);}\n        if(!constantTimeTextEqual(expected.toLowerCase(),sig.toLowerCase()))return jsonResponse({status:'error',message:'Tanda tangan preview tidak valid.'},403);\n        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)return jsonResponse({status:'error',message:'File preview tidak ditemukan.'},404);\n        const object=await env.EVIDENCE_BUCKET.get(file.r2Key);if(!object)return jsonResponse({status:'error',message:'File preview sudah tidak tersedia.'},404);\n        const name=String(file.fileName||'evidence').replace(/[\\r\\n\"\\\\]/g,'_').slice(0,180)||'evidence';const contentType=String(file.fileType||object.httpMetadata?.contentType||'application/octet-stream').split(';')[0].trim().toLowerCase();\n        const headers=new Headers({'Content-Type':contentType,'Content-Disposition':`inline; filename=\"${name.replace(/[^\\x20-\\x7E]/g,'_')}\"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Range, Content-Type','Accept-Ranges':'bytes'});\n        if(object.httpEtag)headers.set('ETag',object.httpEtag);return new Response(request.method==='HEAD'?null:object.body,{status:200,headers});\n      }\n'''+needle4
if needle4 not in s: raise SystemExit('download evidence case not found')
s=s.replace(needle4,cases,1)
# Replace direct verification case as above was inserted. Make sure score reset/status refresh when direct workbook status update.
p.write_text(s)
print('Patched backend:',p)
