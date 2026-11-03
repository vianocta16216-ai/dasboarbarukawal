/* Parsing runs outside the UI thread. Never execute formulas or macros. */
importScripts('/vendor/xlsx.full.min.js','/vendor/jszip.min.js');
let book;
self.onmessage=async({data})=>{try{
 if(data.kind==='load'){
  const bytes=new Uint8Array(data.buffer);
  if(bytes[0]===80&&bytes[1]===75){const zip=await JSZip.loadAsync(data.buffer);const entries=Object.values(zip.files);if(entries.length>8000||entries.reduce((n,f)=>n+(f._data?.uncompressedSize||0),0)>80*1024*1024)throw Error('Dokumen terlalu kompleks untuk pratinjau lokal yang aman. Buka file asli.');}
  book=XLSX.read(data.buffer,{type:'array',cellDates:true,cellStyles:true,cellHTML:false,sheetRows:10001});
  self.postMessage({kind:'loaded',names:book.SheetNames});
 }else if(data.kind==='page'){
  const sheet=book.Sheets[book.SheetNames[data.sheet]];const range=XLSX.utils.decode_range(sheet['!ref']||'A1');
  const row=Math.max(0,Math.min(data.row||0,range.e.r)),col=Math.max(0,Math.min(data.col||0,range.e.c));
  const endRow=Math.min(range.e.r,row+99),endCol=Math.min(range.e.c,col+39);
  const cells=[];for(let r=row;r<=endRow;r++){const values=[];for(let c=col;c<=endCol;c++){const merge=(sheet['!merges']||[]).find(m=>r===Math.max(row,m.s.r)&&c===Math.max(col,m.s.c)&&r<=m.e.r&&c<=m.e.c);const cell=sheet[XLSX.utils.encode_cell(merge?merge.s:{r,c})];values.push(cell?{text:String(cell.w??cell.v??''),formula:cell.f||'',fill:/^[a-f0-9]{6}$/i.test(cell.s?.fgColor?.rgb||'')?cell.s.fgColor.rgb:null}:null);}cells.push(values);}
  self.postMessage({kind:'page',sheet:data.sheet,row,col,endRow,endCol,maxRow:range.e.r,maxCol:range.e.c,names:book.SheetNames,cells,merges:(sheet['!merges']||[]).filter(m=>m.s.r<=endRow&&m.e.r>=row&&m.s.c<=endCol&&m.e.c>=col),widths:Array.from({length:endCol-col+1},(_,i)=>Math.min(420,Math.max(65,sheet['!cols']?.[i+col]?.wpx||((sheet['!cols']?.[i+col]?.wch||15)*7)))),limited:!!sheet['!fullref']});
 }
}catch(e){self.postMessage({kind:'error',message:e.message||'File spreadsheet tidak dapat dibaca.'});}};
