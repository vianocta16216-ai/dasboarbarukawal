/* Runs inside an opaque-origin sandbox. No application cookies or network file access. */
let port,viewer,scale=1,kind,slideHeight=540;
const host=document.getElementById('pages'),label=document.getElementById('position');
function fit(){
 const width=kind==='pptx'?960:Math.max(794,host.querySelector('section.docx')?.offsetWidth||794);
 scale=Math.max(.2,Math.min(1.6,(innerWidth-40)/width,kind==='pptx'?(innerHeight-100)/slideHeight:1.6));host.style.zoom=scale;
}
function scrub(){host.querySelectorAll('a').forEach(a=>a.removeAttribute('href'));host.querySelectorAll('iframe,object,embed,script').forEach(e=>e.remove());}
window.addEventListener('message',async event=>{
 if(event.source!==parent||!event.ports[0]||port)return;port=event.ports[0];const data=event.data;kind=data.ext;
 try{
  const archive=await JSZip.loadAsync(data.buffer);const entries=Object.values(archive.files);
  if(entries.length>8000||entries.reduce((n,f)=>n+(f._data?.uncompressedSize||0),0)>80*1024*1024)throw Error('Isi dokumen melebihi batas pratinjau aman.');
  if(kind==='docx'){
   await docx.renderAsync(data.buffer,host,null,{inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false,renderAltChunks:false,useBase64URL:true,ignoreFonts:true,renderComments:false});
   label.textContent='Word · '+host.querySelectorAll('section.docx').length+' halaman tampilan';
   document.getElementById('previous').hidden=true;document.getElementById('next').hidden=true;
  }else{
   const presentation=new DOMParser().parseFromString(await archive.file('ppt/presentation.xml').async('string'),'application/xml');const size=presentation.getElementsByTagNameNS('*','sldSz')[0];slideHeight=960*Number(size?.getAttribute('cy')||6858000)/Number(size?.getAttribute('cx')||12192000);
   viewer=pptxPreview.init(host,{width:960,height:slideHeight,mode:'slide'});await viewer.preview(data.buffer);
   label.textContent='Slide 1 / '+viewer.slideCount;
   document.getElementById('previous').onclick=()=>{if(viewer.currentIndex>0)viewer.renderPreSlide();update();};
   document.getElementById('next').onclick=()=>{if(viewer.currentIndex<viewer.slideCount-1)viewer.renderNextSlide();update();};
  }
  scrub();fit();document.getElementById('status').remove();port.postMessage({kind:'ready'});
 }catch(e){document.getElementById('status').textContent='Dokumen tidak dapat dirender: '+e.message;port.postMessage({kind:'error',message:e.message});}
});
function update(){label.textContent='Slide '+(viewer.currentIndex+1)+' / '+viewer.slideCount;scrub();}
document.getElementById('fit').onclick=fit;
document.getElementById('plus').onclick=()=>{scale=Math.min(2.5,scale+.15);host.style.zoom=scale;};
document.getElementById('minus').onclick=()=>{scale=Math.max(.25,scale-.15);host.style.zoom=scale;};
window.addEventListener('resize',fit);

parent.postMessage({kind:'office-ready'},'*');
