import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../public/script.js',import.meta.url),'utf8');
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{id,value:'',style:{},dataset:{},textContent:'',disabled:false,listeners:{},classList:{add(){},remove(){}},addEventListener(type,fn){this.listeners[type]=fn;}});return elements.get(id);}
let failData=true,offlineInit=0;
const sandbox={document:{getElementById:el},console:{error(){},warn(){}},setTimeout,clearTimeout,Promise,Date,Set,Map,appInitializedAfterAuth:false,appInitializationPromise:null,authEpoch:0,currentUser:null,opdUnlocked:false,SUBUNSUR_DATA:{},PARAM_LIST:[],initOfflineAutosave(){offlineInit++;},callServer:async(action)=>action==='login'?{status:'success',user:{username:'test',role:'opd'}}:{},loadYears:async()=>{},loadData:async()=>{if(failData)throw new Error('D1 sementara gagal');},showOpdList(){},showDashboard(){}};
vm.createContext(sandbox);
vm.runInContext(source.slice(source.indexOf('async function initializeAppAfterAuth(){'),source.indexOf('(async function bootstrapAuth(){')),sandbox);
vm.runInContext(source.slice(source.indexOf('async function finishLogin(user){'),source.indexOf("document.getElementById('opdAccessPassword').addEventListener('keyup'")),sandbox);
el('opdAccessUsername').value='test';el('opdAccessPassword').value='test-only';
const button=el('btnOpdAccess');
await button.listeners.click.call(button);
assert.equal(button.disabled,false);assert.equal(button.textContent,'Masuk');assert.equal(el('opdAccessOverlay').style.display,'flex');assert.match(el('opdAccessError').textContent,/D1 sementara gagal/);assert.equal(sandbox.appInitializedAfterAuth,false);
failData=false;
await button.listeners.click.call(button);
assert.equal(button.disabled,false);assert.equal(sandbox.appInitializedAfterAuth,true);assert.equal(el('opdAccessOverlay').style.display,'none');
console.log(JSON.stringify({status:'PASS',failedDashboardReturnsUsableLogin:true,buttonRestored:true,retryCanCompleteInitialization:true,note:'VM DOM fixture, not a real browser'},null,2));
