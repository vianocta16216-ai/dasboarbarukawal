from pathlib import Path
p=Path('/mnt/data/kawal_work_next/functions/myCloudinaryHandler.js');s=p.read_text()
s=s.replace("'getQaApipData','getQaApipChecklistData','getEvidenceWorkflow',\n  'getBpkpOfficialScore'", "'getQaApipData','getQaApipChecklistData','getEvidenceWorkflow','previewEvidence','createEvidencePreviewLink','downloadEvidence',\n  'getBpkpOfficialScore'",1)
s=s.replace("const secret=String(env.EVIDENCE_PREVIEW_SECRET||env.GOOGLE_DRIVE_CLIENT_SECRET||'');", "const secret=String(env.EVIDENCE_PREVIEW_SECRET||env.KK_MASTER_SYNC_SECRET||env.KAWAL_SPIP_SYNC_SECRET||env.GOOGLE_DRIVE_CLIENT_SECRET||'');",1)
# add shared R2 response helper after evidencePreviewPayload
needle="function evidencePreviewPayload(year,opdId,uploadId,expires){return `${String(year)}|${String(opdId)}|${String(uploadId)}|${String(expires)}`;}\n"
add=needle+'''async function evidencePreviewStreamResponse(env,request,file,{signed=false}={}){\n  const key=String(file?.r2Key||'');if(!key)return new Response('File tidak tersedia',{status:404});\n  const head=await env.EVIDENCE_BUCKET.head(key);if(!head)return new Response('File tidak ditemukan',{status:404});\n  const size=Math.max(0,Number(head.size||0));let offset=0,length=size,status=200,object=null;\n  const range=String(request.headers.get('Range')||'').match(/^bytes=(\\d*)-(\\d*)$/i);\n  if(range&&size>0){\n    let start=range[1]===''?Math.max(0,size-Number(range[2]||0)):Number(range[1]);\n    let end=range[1]===''?size-1:(range[2]===''?size-1:Number(range[2]));\n    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`,'Accept-Ranges':'bytes'}});\n    end=Math.min(end,size-1);offset=start;length=end-start+1;status=206;object=await env.EVIDENCE_BUCKET.get(key,{range:{offset,length}});\n  }else if(request.method!=='HEAD'){object=await env.EVIDENCE_BUCKET.get(key);}\n  const contentType=String(file.fileType||head.httpMetadata?.contentType||'application/octet-stream').split(';')[0].trim().toLowerCase();\n  const name=String(file.fileName||'evidence').replace(/[\\r\\n"\\\\]/g,'_').slice(0,180)||'evidence';\n  const headers=new Headers({'Content-Type':contentType,'Content-Disposition':`inline; filename="${name.replace(/[^\\x20-\\x7E]/g,'_')}"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});\n  if(size)headers.set('Content-Length',String(length));if(status===206)headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${size}`);\n  if(signed){headers.set('Access-Control-Allow-Origin','*');headers.set('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');headers.set('Access-Control-Allow-Headers','Range, Content-Type');headers.set('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');}\n  else{headers.set('Referrer-Policy','no-referrer');headers.set('Content-Security-Policy',\"default-src 'none'; frame-ancestors 'self'; sandbox\");}\n  if(head.httpEtag)headers.set('ETag',head.httpEtag);\n  return new Response(request.method==='HEAD'?null:object?.body||null,{status,headers});\n}\n'''
if needle not in s: raise SystemExit('payload helper not found')
s=s.replace(needle,add,1)
# simplify preview cases stream; include permission on authenticated route
old="""      case 'previewEvidence': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)return jsonResponse({status:'error',message:'Berkas belum tersedia di penyimpanan privat.'},404);
        const object=await env.EVIDENCE_BUCKET.get(file.r2Key);if(!object)return jsonResponse({status:'error',message:'Berkas tidak ditemukan pada penyimpanan R2.'},404);
        const contentType=String(file.fileType||object.httpMetadata?.contentType||'application/octet-stream').split(';')[0].trim().toLowerCase();
        const headers=new Headers({'Content-Type':contentType,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'self'; sandbox"});
        if(object.httpEtag)headers.set('ETag',object.httpEtag);return new Response(request.method==='HEAD'?null:object.body,{status:200,headers});
      }
      case 'previewPublicEvidence': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||''),expires=Number(params.expires||0),sig=String(params.sig||'');
        const now=Math.floor(Date.now()/1000);if(!opdId||!uploadId||!Number.isInteger(expires)||expires<now||expires>now+660||!/^[a-f0-9]{64}$/i.test(sig))return jsonResponse({status:'error',message:'Tautan preview Office tidak valid atau sudah kedaluwarsa.'},403);
        let expected='';try{expected=await previewSignature(env,evidencePreviewPayload(year,opdId,uploadId,expires));}catch{return jsonResponse({status:'error',message:'Preview Office belum dikonfigurasi.'},503);}
        if(!constantTimeTextEqual(expected.toLowerCase(),sig.toLowerCase()))return jsonResponse({status:'error',message:'Tanda tangan preview tidak valid.'},403);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)return jsonResponse({status:'error',message:'File preview tidak ditemukan.'},404);
        const object=await env.EVIDENCE_BUCKET.get(file.r2Key);if(!object)return jsonResponse({status:'error',message:'File preview sudah tidak tersedia.'},404);
        const name=String(file.fileName||'evidence').replace(/[\\r\\n"\\\\]/g,'_').slice(0,180)||'evidence';const contentType=String(file.fileType||object.httpMetadata?.contentType||'application/octet-stream').split(';')[0].trim().toLowerCase();
        const headers=new Headers({'Content-Type':contentType,'Content-Disposition':`inline; filename="${name.replace(/[^\\x20-\\x7E]/g,'_')}"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Range, Content-Type','Accept-Ranges':'bytes'});
        if(object.httpEtag)headers.set('ETag',object.httpEtag);return new Response(request.method==='HEAD'?null:object.body,{status:200,headers});
      }
"""
new="""      case 'previewEvidence': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||'');
        await assertSessionCanAccessOpd(env,authSession,year,opdId);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)return jsonResponse({status:'error',message:'Berkas belum tersedia di penyimpanan privat.'},404);
        return await evidencePreviewStreamResponse(env,request,file,{signed:false});
      }
      case 'previewPublicEvidence': {
        const opdId=String(params.opdId||''),uploadId=String(params.uploadId||''),expires=Number(params.expires||0),sig=String(params.sig||'');
        const now=Math.floor(Date.now()/1000);if(!opdId||!uploadId||!Number.isInteger(expires)||expires<now||expires>now+660||!/^[a-f0-9]{64}$/i.test(sig))return jsonResponse({status:'error',message:'Tautan preview Office tidak valid atau sudah kedaluwarsa.'},403);
        let expected='';try{expected=await previewSignature(env,evidencePreviewPayload(year,opdId,uploadId,expires));}catch{return jsonResponse({status:'error',message:'Preview Office belum dikonfigurasi. Tetapkan EVIDENCE_PREVIEW_SECRET (minimal 32 karakter).'},503);}
        if(!constantTimeTextEqual(expected.toLowerCase(),sig.toLowerCase()))return jsonResponse({status:'error',message:'Tanda tangan preview tidak valid.'},403);
        const file=await assertUploadBelongsToOpd(env,year,opdId,uploadId);if(!file?.r2Key)return jsonResponse({status:'error',message:'File preview tidak ditemukan.'},404);
        return await evidencePreviewStreamResponse(env,request,file,{signed:true});
      }
"""
if old not in s: raise SystemExit('preview cases not found for replacement')
s=s.replace(old,new,1)
# Ensure workflow updates with notes affect green display.
p.write_text(s)
print('Patched preview streaming and permissions')
