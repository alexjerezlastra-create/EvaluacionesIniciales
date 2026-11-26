/* --- GOOGLE DRIVE: FUENTE DE VERDAD + CIFRADO --- */
const CLIENT_ID='503984601918-tv238rrh2fksfrlfi8cjsj5edqjqeud3.apps.googleusercontent.com';
const SCOPES='https://www.googleapis.com/auth/drive.file';
const DRIVE_FILE_NAME='evaluaciones_iniciales_data.enc';
const LEGACY_DRIVE_FILE_NAME='sistema_evaluacion_V26_drive.json';
const KDF_ITERATIONS=250000;
let tokenClient,gapiInited=false,gisInited=false,driveFileId=null,driveFileName='',driveDisplayName='',driveReady=false,cryptoPassword='',driveSaveTimer=null,pendingLegacyDb=null,pendingNewFileName='',storageProvider=null,localDirectoryHandle=null,localFileHandle=null,localFileName='',localDisplayName='';

async function initGisOnly(){
  if(gisInited&&tokenClient)return true;
  if(!window.google?.accounts?.oauth2)return false;
  try{
    tokenClient=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPES,callback:()=>{}});
    gisInited=true;
    return true;
  }catch(e){console.warn('GIS init error',e);return false;}
}

async function initGapiClientOnly(){
  if(gapiInited&&window.gapi?.client?.drive)return true;
  if(!window.gapi?.load)return false;
  try{
    await new Promise((resolve,reject)=>gapi.load('client',{callback:resolve,onerror:()=>reject(Error('gapi.load error')),timeout:6000,ontimeout:()=>reject(Error('gapi.load timeout'))}));
    if(!window.gapi?.client?.init)return false;
    await gapi.client.init({discoveryDocs:['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']});
    gapiInited=true;
    return true;
  }catch(e){console.warn('GAPI init error',e);return false;}
}

async function initializeGoogleLibraries(){
  if(location.protocol==='file:'){
    gateStatus('Estás abriendo el archivo como file://. Google bloquea el acceso en local sin servidor; ábrelo por http://localhost o HTTPS.',true);
    return false;
  }
  gateStatus('Preparando acceso a Google…');
  const started=Date.now();
  let lastErr='';
  while(Date.now()-started<15000){
    const okGis=await initGisOnly();
    const okGapi=await initGapiClientOnly();
    if(okGis&&okGapi){
      gateStatus('Google preparado ✓');
      return true;
    }
    if(!okGis)lastErr='Esperando Google Identity Services (gsi/client)…';
    else if(!okGapi)lastErr='Esperando Google API Client (gapi/client)…';
    gateStatus(lastErr);
    await new Promise(r=>setTimeout(r,300));
  }
  gateStatus('Tiempo de espera agotado al cargar Google ('+(lastErr||'sin detalle')+'). Revisa bloqueadores de anuncios/scripts o la consola (F12).',true);
  return false;
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initializeGoogleLibraries,50),{once:true});
}else{
  setTimeout(initializeGoogleLibraries,50);
}
async function waitGoogleReady(){if(gapiInited&&gisInited)return true;return initializeGoogleLibraries()}

function gateStatus(t,error=false){const el=document.getElementById('driveGateStatus');if(el){el.textContent=t||'';el.classList.toggle('error',error)}if(t)console.log('[DriveGate]',error?'ERROR:':'INFO:',t)}
function gateBody(html){const el=document.getElementById('driveGateBody');if(el)el.innerHTML=html}
function showDriveGate(title,text,bodyHtml,statusText='',isError=false){
  const gate=document.getElementById('driveGate');
  if(!gate)return;
  gate.classList.remove('hidden');
  const tEl=document.getElementById('driveGateTitle');
  const pEl=document.getElementById('driveGateText');
  if(tEl&&title)tEl.textContent=title;
  if(pEl&&text)pEl.textContent=text;
  if(bodyHtml!==null)gateBody(bodyHtml);
  gateStatus(statusText,isError);
}
function hideDriveGate(){
  const gate=document.getElementById('driveGate');
  if(gate)gate.classList.add('hidden');
  gateStatus('');
}



// Web Crypto: PBKDF2 + AES-GCM
function bytesToB64(bytes){
  let bin='';
  for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64){
  const bin=atob(b64);
  const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}
async function deriveAesKey(password,saltBytes,iterations=KDF_ITERATIONS){
  const enc=new TextEncoder();
  const keyMaterial=await crypto.subtle.importKey('raw',enc.encode(password),{name:'PBKDF2'},false,['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt:saltBytes,iterations,hash:'SHA-256'},
    keyMaterial,
    {name:'AES-GCM',length:256},
    false,
    ['encrypt','decrypt']
  );
}
async function encryptDatabase(obj,password){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveAesKey(password,salt,KDF_ITERATIONS);
  const plaintext=new TextEncoder().encode(JSON.stringify(obj));
  const cipherBuffer=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext);
  return JSON.stringify({
    v:1,
    kdf:'PBKDF2-SHA256',
    iterations:KDF_ITERATIONS,
    salt:bytesToB64(salt),
    iv:bytesToB64(iv),
    ciphertext:bytesToB64(new Uint8Array(cipherBuffer))
  },null,2);
}
async function decryptDatabase(rawText,password){
  const pkg=JSON.parse(rawText);
  if(!pkg||!pkg.salt||!pkg.iv||!pkg.ciphertext)throw new Error('Formato de archivo cifrado no válido.');
  const salt=b64ToBytes(pkg.salt);
  const iv=b64ToBytes(pkg.iv);
  const cipherBytes=b64ToBytes(pkg.ciphertext);
  const iterations=Number(pkg.iterations)||KDF_ITERATIONS;
  const key=await deriveAesKey(password,salt,iterations);
  const plainBuffer=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipherBytes);
  const parsed=JSON.parse(new TextDecoder().decode(plainBuffer));
  if(!parsed||!Array.isArray(parsed.courses)||!Array.isArray(parsed.students)||!Array.isArray(parsed.evaluations)){
    throw new Error('Los datos descifrados no tienen la estructura esperada.');
  }
  return parsed;
}

function showStorageProviderSelector(){
  driveReady=false;cryptoPassword='';driveFileId=null;localFileHandle=null;storageProvider=null;
  showDriveGate('Evaluaciones Iniciales','Elige dónde quieres guardar y abrir los archivos cifrados.',`<div class="storageProviderGrid"><button type="button" class="storageProviderCard" onclick="chooseGoogleDriveStorage()"><span class="storageProviderIcon">G</span><b>Google Drive</b><small>Acceso mediante Google y guardado cifrado en Drive.</small></button><button type="button" class="storageProviderCard" onclick="chooseLocalStorage()"><span class="storageProviderIcon">PC</span><b>Equipo / unidad de red</b><small>Carpeta local, NAS o unidad compartida del PC.</small></button></div>`,'');
}
async function chooseGoogleDriveStorage(){storageProvider='drive';showDriveGate('Google Drive','Inicia sesión para acceder a tus archivos cifrados.',`<div class="driveGateButtons"><button type="button" class="driveGateSecondary" onclick="showStorageProviderSelector()">Atrás</button><button type="button" class="driveGatePrimary" onclick="startDriveLogin()">Continuar con Google</button></div>`,'')}
function localApiAvailable(){return typeof window.showDirectoryPicker==='function'&&window.isSecureContext}
async function chooseLocalStorage(){
  if(!localApiAvailable()){showDriveGate('Equipo / unidad de red','Esta opción necesita Edge o Chrome de escritorio y una página servida por HTTPS o localhost.',`<div class="driveGateButtons"><button type="button" class="driveGateSecondary" onclick="showStorageProviderSelector()">Atrás</button><button type="button" class="driveGatePrimary" onclick="chooseLocalStorage()">Reintentar</button></div>`,'File System Access API no está disponible en este navegador u origen.',true);return}
  try{localDirectoryHandle=await window.showDirectoryPicker({id:'evaluaciones-iniciales',mode:'readwrite'});storageProvider='local';await showLocalFileSelector()}catch(e){if(e.name!=='AbortError')gateStatus('No se pudo abrir la carpeta: '+e.message,true)}
}
async function verifyPermission(handle,mode='readwrite'){const opts={mode};if((await handle.queryPermission(opts))==='granted')return true;return (await handle.requestPermission(opts))==='granted'}
async function listLocalEvaluationFiles(){
  if(!localDirectoryHandle||!await verifyPermission(localDirectoryHandle))throw Error('No hay permiso para acceder a la carpeta.');
  const files=[];for await(const [name,handle] of localDirectoryHandle.entries()){if(handle.kind==='file'&&/\.enc$/i.test(name)){const file=await handle.getFile();files.push({name,handle,modifiedTime:new Date(file.lastModified).toISOString(),size:file.size})}}
  return files.sort((a,b)=>String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
}
async function showLocalFileSelector(){gateStatus('Leyendo la carpeta…');try{renderLocalFileSelector(await listLocalEvaluationFiles())}catch(e){gateStatus(e.message,true)}}
function localFriendlyName(name){return name.replace(/\.enc$/i,'').replace(/^evaluaciones_/i,'').replace(/[_-]+/g,' ')}
function renderLocalFileSelector(files){const cards=files.map(f=>`<article class="drivePickerCard"><button type="button" class="drivePickerOpen" onclick="chooseLocalFile('${esc(f.name)}')"><span class="drivePickerIcon">PC</span><span><b>${esc(localFriendlyName(f.name))}</b><small>Modificado: ${esc(formatDriveModified(f.modifiedTime))}</small></span></button><div class="drivePickerActions"><button type="button" onclick="renameLocalFileUI('${esc(f.name)}')">Renombrar</button><button type="button" class="danger" onclick="deleteLocalFile('${esc(f.name)}')">Eliminar</button></div></article>`).join('');showDriveGate('Archivos de la unidad','Carpeta seleccionada: '+localDirectoryHandle.name,`<div class="drivePickerGrid">${cards||'<div class="drivePickerEmpty">Todavía no hay archivos de evaluación.</div>'}</div><div class="driveGateButtons"><button type="button" class="driveGateSecondary" onclick="showStorageProviderSelector()">Cambiar ubicación</button><button type="button" class="driveGatePrimary" onclick="showNewLocalFileForm()">+ Nuevo archivo</button></div>`,'')}
async function chooseLocalFile(name){try{localFileHandle=await localDirectoryHandle.getFileHandle(name);localFileName=name;localDisplayName=localFriendlyName(name);showDriveGate('Desbloquear '+localDisplayName,'Introduce la contraseña maestra de este archivo.',`<div class="drivePasswordFields"><label>Contraseña maestra<input id="localUnlockPassword" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')submitLocalUnlock()"></label></div><div class="driveGateButtons"><button type="button" class="driveGateSecondary" onclick="showLocalFileSelector()">Atrás</button><button type="button" class="driveGatePrimary" onclick="submitLocalUnlock()">Desbloquear</button></div>`,'');setTimeout(()=>document.getElementById('localUnlockPassword')?.focus(),20)}catch(e){gateStatus('No se pudo abrir el archivo: '+e.message,true)}}
async function submitLocalUnlock(){const pwd=document.getElementById('localUnlockPassword')?.value||'';if(!pwd)return gateStatus('Introduce la contraseña.',true);try{gateStatus('Leyendo y descifrando…');const text=await(await localFileHandle.getFile()).text(),decrypted=await decryptDatabase(text,pwd);cryptoPassword=pwd;storageProvider='local';applyLoadedDatabase(decrypted);setSaveStatus('Conectado a unidad local ✓')}catch(e){console.error(e);gateStatus('Contraseña incorrecta o archivo dañado.',true)}}
function showNewLocalFileForm(){showDriveGate('Nuevo archivo local','Se creará una base vacía y cifrada en la carpeta seleccionada.',`<div class="drivePasswordFields"><label>Nombre del archivo<input id="newLocalFileName" type="text" value="Evaluaciones colegio" maxlength="80"></label><label>Nueva contraseña maestra<input id="localPass1" type="password" autocomplete="new-password"></label><label>Repetir contraseña maestra<input id="localPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')createNewLocalFile()"></label></div><div class="drivePasswordHint">Mínimo 12 caracteres. La contraseña no podrá recuperarse.</div><div class="driveGateButtons"><button type="button" class="driveGateSecondary" onclick="showLocalFileSelector()">Atrás</button><button type="button" class="driveGatePrimary" onclick="createNewLocalFile()">Crear archivo</button></div>`,'');setTimeout(()=>document.getElementById('newLocalFileName')?.select(),20)}
function safeLocalFilename(value){const cleaned=value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');return (cleaned||'evaluaciones')+'.enc'}
async function createNewLocalFile(){const name=(document.getElementById('newLocalFileName')?.value||'').trim(),p1=document.getElementById('localPass1')?.value||'',p2=document.getElementById('localPass2')?.value||'';if(!name)return gateStatus('Escribe un nombre.',true);if(p1.length<12)return gateStatus('Usa una contraseña de al menos 12 caracteres.',true);if(p1!==p2)return gateStatus('Las contraseñas no coinciden.',true);try{localFileName=safeLocalFilename(name);localDisplayName=name;localFileHandle=await localDirectoryHandle.getFileHandle(localFileName,{create:true});cryptoPassword=p1;storageProvider='local';const initialDb=emptyDatabase(),enc=await encryptDatabase(initialDb,p1);await writeLocalText(enc);applyLoadedDatabase(initialDb);setSaveStatus('Guardado en unidad local ✓')}catch(e){console.error(e);gateStatus('No se pudo crear el archivo: '+e.message,true)}}
async function writeLocalText(text){if(!localFileHandle||!await verifyPermission(localFileHandle))throw Error('No hay permiso de escritura.');const writable=await localFileHandle.createWritable();await writable.write(text);await writable.close()}
async function syncDatabaseToLocalNow(){if(!driveReady||storageProvider!=='local'||!cryptoPassword||!localFileHandle)return;try{setSaveStatus('Cifrando y guardando en unidad…');await writeLocalText(await encryptDatabase(db,cryptoPassword));setSaveStatus('Guardado en unidad local ✓')}catch(e){console.error(e);setSaveStatus('Error al guardar en unidad local')}}
async function renameLocalFileUI(name){const next=prompt('Nuevo nombre:',localFriendlyName(name));if(!next?.trim())return;try{const oldHandle=await localDirectoryHandle.getFileHandle(name),text=await(await oldHandle.getFile()).text(),newName=safeLocalFilename(next),newHandle=await localDirectoryHandle.getFileHandle(newName,{create:true}),w=await newHandle.createWritable();await w.write(text);await w.close();await localDirectoryHandle.removeEntry(name);showLocalFileSelector()}catch(e){gateStatus('No se pudo renombrar: '+e.message,true)}}
async function deleteLocalFile(name){if(!confirm(`¿Eliminar "${localFriendlyName(name)}" de la carpeta?\n\nEsta acción no se puede deshacer.`))return;try{await localDirectoryHandle.removeEntry(name);showLocalFileSelector()}catch(e){gateStatus('No se pudo eliminar: '+e.message,true)}}

async function startDriveLogin(){
  storageProvider='drive';
  if(location.protocol==='file:'){
    gateStatus('No funciona desde file://. Súbelo a HTTPS o ábrelo con un servidor local (localhost).',true);
    return;
  }
  await initGisOnly();
  if(!tokenClient){
    await waitGoogleReady();
  }
  if(!tokenClient){
    gateStatus('No se ha podido inicializar Google Identity Services. Comprueba bloqueadores (uBlock/Brave Shields) o la consola (F12).',true);
    return;
  }
  gateStatus('Abriendo ventana de inicio de sesión de Google…');
  tokenClient.callback=async(resp)=>{
    if(resp&&resp.error){
      gateStatus('Error de autorización de Google: '+resp.error,true);
      return;
    }
    await loadDriveStateAfterLogin();
  };
  let existingToken=null;
  try{existingToken=window.gapi?.client?.getToken?.()||null;}catch(_e){existingToken=null;}
  try{
    tokenClient.requestAccessToken({prompt:existingToken?'':'consent'});
  }catch(err){
    console.error('requestAccessToken error:',err);
    gateStatus('No se pudo abrir la ventana de Google: '+(err?.message||err)+'. Revisa si el navegador bloquea ventanas emergentes.',true);
  }
}

function getAccessToken(){
  return gapi.client.getToken()?.access_token||'';
}

async function listEvaluationDriveFiles(){
  const res=await gapi.client.drive.files.list({q:"trashed=false",fields:'files(id,name,modifiedTime,appProperties)',orderBy:'modifiedTime desc',spaces:'drive',pageSize:100});
  return (res.result?.files||[]).filter(f=>f.appProperties?.app==='evaluaciones-iniciales'||f.name===DRIVE_FILE_NAME||/^evaluaciones_.*\.enc$/i.test(f.name));
}
function formatDriveModified(v){try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return v||''}}
function renderDriveFileSelector(files){
  const cards=files.map(f=>{const label=f.appProperties?.displayName||f.name.replace(/\.enc$/i,'');return`<article class="drivePickerCard"><button type="button" class="drivePickerOpen" onclick="chooseDriveFile('${f.id}','${esc(f.name)}','${esc(label)}')"><span class="drivePickerIcon">EI</span><span><b>${esc(label)}</b><small>Modificado: ${esc(formatDriveModified(f.modifiedTime))}</small></span></button><div class="drivePickerActions"><button type="button" onclick="renameEvaluationFile('${f.id}','${esc(label)}')">Renombrar</button><button type="button" class="danger" onclick="trashEvaluationFile('${f.id}','${esc(label)}')">Eliminar</button></div></article>`}).join('');
  showDriveGate('Mis archivos de evaluación','Selecciona una base de datos cifrada o crea una nueva.',`<div class="drivePickerGrid">${cards||'<div class="drivePickerEmpty">Todavía no hay archivos de evaluación.</div>'}</div><button type="button" class="driveGatePrimary" onclick="showNewEvaluationFileForm()">+ Nuevo archivo</button>`,'');
}
async function showDriveFileSelector(){storageProvider='drive';gateStatus('Buscando archivos cifrados…');const files=await listEvaluationDriveFiles();renderDriveFileSelector(files)}
function chooseDriveFile(fileId,fileName,displayName){driveFileId=fileId;driveFileName=fileName;driveDisplayName=displayName;showDriveGate('Desbloquear '+displayName,'Introduce la contraseña maestra de este archivo.',`<div class="drivePasswordFields"><label>Contraseña maestra<input id="unlockPasswordInput" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')submitUnlockPassword()"></label></div><div class="driveGateButtons"><button type="button" class="driveGateSecondary" onclick="showDriveFileSelector()">Atrás</button><button type="button" class="driveGatePrimary" onclick="submitUnlockPassword()">Desbloquear</button></div>`,'');setTimeout(()=>document.getElementById('unlockPasswordInput')?.focus(),20)}
function showNewEvaluationFileForm(){pendingNewFileName='';showDriveGate('Nuevo archivo de evaluación','Crea una base de datos vacía e independiente.',`<div class="drivePasswordFields"><label>Nombre del archivo<input id="newEvaluationFileName" type="text" value="Evaluaciones colegio" maxlength="80"></label><label>Nueva contraseña maestra<input id="createPass1" type="password" autocomplete="new-password"></label><label>Repetir contraseña maestra<input id="createPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')submitCreatePassword()"></label></div><div class="drivePasswordHint">La contraseña debe tener al menos 12 caracteres y no podrá recuperarse.</div><div class="driveGateButtons"><button type="button" class="driveGateSecondary" onclick="showDriveFileSelector()">Atrás</button><button type="button" class="driveGatePrimary" onclick="submitCreatePassword()">Crear archivo</button></div>`,'');setTimeout(()=>document.getElementById('newEvaluationFileName')?.select(),20)}
async function renameEvaluationFile(fileId,current){const next=prompt('Nuevo nombre:',current);if(!next?.trim())return;const token=getAccessToken();const r=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({appProperties:{app:'evaluaciones-iniciales',displayName:next.trim()}})});if(!r.ok)return gateStatus('No se pudo renombrar el archivo.',true);showDriveFileSelector()}
async function trashEvaluationFile(fileId,label){if(!confirm(`¿Eliminar "${label}"?\n\nEl archivo irá a la papelera de Google Drive.`))return;const token=getAccessToken();const r=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});if(!r.ok)return gateStatus('No se pudo eliminar el archivo.',true);showDriveFileSelector()}
async function findDriveFileByName(name){
  const res=await gapi.client.drive.files.list({
    q:`name='${name.replace(/'/g,"\'")}' and trashed=false`,
    fields:'files(id,name,modifiedTime)',
    spaces:'drive'
  });
  const files=res.result?.files||[];
  return files[0]||null;
}

async function downloadDriveFileText(fileId){
  const token=getAccessToken();
  const r=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{
    headers:{Authorization:'Bearer '+token}
  });
  if(!r.ok)throw new Error('No se pudo descargar el archivo de Google Drive ('+r.status+')');
  return r.text();
}

function buildMultipartBody(metadata,blob){
  const form=new FormData();
  form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
  form.append('file',blob);
  return form;
}

async function createEncryptedDriveFile(encText){
  const token=getAccessToken();
  const metadata={name:driveFileName||DRIVE_FILE_NAME,mimeType:'application/json',appProperties:{app:'evaluaciones-iniciales',displayName:driveDisplayName||'Evaluaciones'}};
  const blob=new Blob([encText],{type:'application/json'}),r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{Authorization:'Bearer '+token},body:buildMultipartBody(metadata,blob)});
  if(!r.ok)throw new Error('No se pudo crear el archivo cifrado en Drive ('+r.status+')');const created=await r.json();driveFileId=created.id;return created
}

async function updateEncryptedDriveFile(fileId,encText){
  const token=getAccessToken(),metadata={name:driveFileName||DRIVE_FILE_NAME,mimeType:'application/json',appProperties:{app:'evaluaciones-iniciales',displayName:driveDisplayName||'Evaluaciones'}},blob=new Blob([encText],{type:'application/json'}),r=await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart`,{method:'PATCH',headers:{Authorization:'Bearer '+token},body:buildMultipartBody(metadata,blob)});
  if(!r.ok)throw new Error('No se pudo actualizar el archivo cifrado en Drive ('+r.status+')');return r.json()
}

async function syncDatabaseToDriveNow(){
  if(!driveReady||!cryptoPassword)return;
  const token=getAccessToken();
  if(!token){
    setSaveStatus('Sesión de Google caducada · Pulsa para reconectar');
    return;
  }
  try{
    setSaveStatus('Cifrando y guardando en Drive…');
    const encText=await encryptDatabase(db,cryptoPassword);
    if(driveFileId){
      await updateEncryptedDriveFile(driveFileId,encText);
    }else{
      const existing=await findDriveFileByName(DRIVE_FILE_NAME);
      if(existing){
        driveFileId=existing.id;
        await updateEncryptedDriveFile(driveFileId,encText);
      }else{
        await createEncryptedDriveFile(encText);
      }
    }
    setSaveStatus('Sincronizado en Drive ✓');
  }catch(e){
    console.error('Error sincronizando con Drive:',e);
    setSaveStatus('Error al guardar en Drive');
  }
}
async function syncDatabaseNow(){return storageProvider==='local'?syncDatabaseToLocalNow():syncDatabaseToDriveNow()}


function scheduleDriveSync(){
  if(!driveReady||!cryptoPassword)return;
  clearTimeout(driveSaveTimer);
  driveSaveTimer=setTimeout(()=>{
    driveSaveTimer=null;
    syncDatabaseNow();
  },700);
}

// Envolvemos save() y changed() para persistir localmente y programar sincronización cifrada con Drive
const _baseSave=save;
save=function(){
  _baseSave();
  if(driveReady&&cryptoPassword)scheduleDriveSync();
};
const _baseChanged=changed;
changed=function(){
  _baseChanged();
  if(driveReady&&cryptoPassword)scheduleDriveSync();
};

async function loadDriveStateAfterLogin(){
  try{
    gateStatus('Buscando archivos cifrados en Google Drive…');
    const files=await listEvaluationDriveFiles();
    if(files.length){renderDriveFileSelector(files);return}
    const legacyFile=await findDriveFileByName(LEGACY_DRIVE_FILE_NAME);
    if(legacyFile){const rawLegacy=await downloadDriveFileText(legacyFile.id),parsedLegacy=JSON.parse(rawLegacy);if(!parsedLegacy||!Array.isArray(parsedLegacy.courses))throw new Error('El archivo anterior no tiene un formato válido.');pendingLegacyDb=parsedLegacy;pendingNewFileName='Evaluaciones migradas';renderCreatePasswordGate('Se encontró una copia anterior sin cifrar. Crea una contraseña para migrarla.');return}
    renderDriveFileSelector([]);
  }catch(e){console.error(e);showDriveGate('Error al conectar con Google Drive','No se pudieron consultar los archivos.',`<button type="button" class="driveGatePrimary" onclick="startDriveLogin()">Reintentar conexión</button>`,e.message||String(e),true)}
}

function renderCreatePasswordGate(description){
  showDriveGate(
    'Crear contraseña maestra',
    description,
    `<div class="drivePasswordFields">
      <label>Nueva contraseña maestra<input id="createPass1" type="password" autocomplete="new-password"></label>
      <label>Repetir contraseña maestra<input id="createPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')submitCreatePassword()"></label>
    </div>
    <div class="drivePasswordHint">Esta contraseña cifra tus datos en tu navegador antes de subirlos a Drive. Si la pierdes, no podrán recuperarse.</div>
    <button type="button" class="driveGatePrimary" onclick="submitCreatePassword()">Crear y guardar en Drive</button>`,
    ''
  );
  setTimeout(()=>document.getElementById('createPass1')?.focus(),20);
}

async function submitUnlockPassword(){
  const input=document.getElementById('unlockPasswordInput');
  const pwd=input?.value||'';
  if(!pwd){gateStatus('Introduce la contraseña maestra.',true);return;}
  try{
    gateStatus('Descifrando datos…');
    const rawEnc=await downloadDriveFileText(driveFileId);
    const decrypted=await decryptDatabase(rawEnc,pwd);
    cryptoPassword=pwd;
    applyLoadedDatabase(decrypted);
  }catch(e){
    console.error(e);
    gateStatus('Contraseña incorrecta o archivo dañado.',true);
    input?.focus();
    input?.select();
  }
}

async function submitCreatePassword(){
  const p1=document.getElementById('createPass1')?.value||'',p2=document.getElementById('createPass2')?.value||'',name=(document.getElementById('newEvaluationFileName')?.value||pendingNewFileName||'Evaluaciones').trim();
  if(!name){gateStatus('Escribe un nombre para el archivo.',true);return}if(p1.length<12){gateStatus('Usa una contraseña de al menos 12 caracteres.',true);return}if(p1!==p2){gateStatus('Las contraseñas no coinciden.',true);return}
  try{gateStatus('Cifrando y creando archivo en Google Drive…');cryptoPassword=p1;driveDisplayName=name;driveFileName=`evaluaciones_${id().replace(/[^a-z0-9]/gi,'')}.enc`;driveFileId=null;const initialDb=pendingLegacyDb?clone(pendingLegacyDb):emptyDatabase();pendingLegacyDb=null;const encText=await encryptDatabase(initialDb,cryptoPassword);await createEncryptedDriveFile(encText);applyLoadedDatabase(initialDb)}catch(e){console.error(e);gateStatus('Error al crear el archivo cifrado: '+(e.message||e),true)}
}

function applyLoadedDatabase(loaded){
  db=loaded;
  migrate();
  db.classes.forEach(ensureRoomProfessionals);
  db.evaluations.forEach(ev=>ev.data=normalizeEvaluationData(ev.data));
  if(!byId(db.courses,db.selected.courseId)&&db.courses[0]){
    db.selected.courseId=db.courses[0].id;
  }
  driveReady=true;
  hideDriveGate();
  _baseSave();
  render();
  setSaveStatus('Conectado a Drive ✓');
}

function handleAuthClick(){startDriveLogin()}
window.addEventListener('beforeunload',e=>{if(driveSaveTimer){e.preventDefault();e.returnValue=''}});
async function exportEncryptedBackup(){if(!driveReady||!cryptoPassword)return alert('Primero desbloquea los datos.');const content=await encryptDatabase(db,cryptoPassword),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'application/json'}));a.download=driveFileName||'evaluaciones_iniciales_data.enc';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
