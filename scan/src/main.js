import { cropImage } from './image.js';
import { createLocalStudentRecord, saveLocalStudentDocument, saveLocalStudentManifest, listLocalArchive, listLocalStudentDocuments, saveLocalMergedFile, savePhoneDirectoryHandle, getPhoneDirectoryHandle, getLocalStudentRecord, requestPersistentPhoneStorage } from './local-store.js';

const $ = id => document.getElementById(id);
const views = ['welcomeView','folderView','homeView','studentView','documentsView','archiveView','mergeView','settingsView'];
let account = null;
let authApi = null, authStateCache = null, authInitialized = false;
let graphApi = null, oneDriveApi = null;
let storageMode = localStorage.getItem('roviaw_storage_mode') || '';
let phoneDirectoryName = '';
let phoneFolderWriteAvailable = false;
let baseFolder = null;
let folderStack = [{ id:'root', name:'OneDrive', path:'OneDrive' }];
let activeStudent = null;
let pendingMulti = null;
let savedDocs = [];
let currentArchive = [];
let toastTimer;

function showView(id) {
  views.forEach(v => $(v).classList.toggle('active', v === id));
  $('bottomNav').hidden = !['homeView','studentView','archiveView','mergeView','documentsView'].includes(id);
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
  window.scrollTo({ top:0, behavior:'instant' });
}
function toast(message, error=false) {
  const el=$('toast'); el.textContent=message; el.classList.toggle('error',error); el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),4300);
}
function setCloudStatus(text, connected=false) {
  $('cloudStatus').innerHTML=`<i class="${connected?'connected':''}"></i><span>${text}</span>`;
}
function showProgress(title, message, percent=0) {
  $('progressTitle').textContent=title; $('progressMessage').textContent=message;
  $('progressBar').style.width=`${percent}%`; $('progressPercent').textContent=`${percent}%`;
  $('progressModal').classList.add('open');
}
function updateProgress(message, percent) {
  $('progressMessage').textContent=message; $('progressBar').style.width=`${percent}%`; $('progressPercent').textContent=`${percent}%`;
}
function hideProgress() { $('progressModal').classList.remove('open'); }
function displayNameForAccount() { return account?.name || account?.username || 'Microsoft account connected'; }
function humanDate(date) { return new Date(`${date}T00:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}); }

async function prepareAuth() {
  if(!authApi) authApi=await import('./auth.js');
  if(!authInitialized) { authStateCache=await authApi.initializeAuth(); authInitialized=true; }
  return authStateCache;
}
async function loadCloudApis() {
  if(!graphApi) graphApi=await import('./graph.js');
  if(!oneDriveApi) oneDriveApi=await import('./onedrive.js');
}
async function createPdf(files,layout) {
  const pdfModule=await import('./pdf.js');
  return pdfModule.imagesToPdf(files,layout);
}
function formatBytes(bytes) {
  if(bytes<1024)return `${bytes} B`;
  return `${(bytes/1024).toFixed(1)} KB`;
}

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/scan/sw.js').catch(()=>{});
  document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.back)));
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.nav)));
  document.querySelectorAll('[data-doc]').forEach(b=>b.addEventListener('click',()=>startDocument(b.dataset.doc)));
  $('signInButton').addEventListener('click',handleSignIn);
  $('phoneStorageButton').addEventListener('click',activatePhoneStorage);
  $('choosePhoneFolderButton').addEventListener('click',choosePhoneFolder);
  $('settingsChoosePhoneFolder').addEventListener('click',choosePhoneFolder);
  $('settingsSwitchPhone').addEventListener('click',activatePhoneStorage);
  $('settingsSwitchOneDrive').addEventListener('click',handleSignIn);
  $('changeFolderButton').addEventListener('click',()=>{
    if(storageMode==='local'){fillSettings();showView('settingsView');}
    else openFolderSetup().catch(e=>toast(e.message,true));
  });
  $('folderRootButton').addEventListener('click',()=>{folderStack=[{id:'root',name:'OneDrive',path:'OneDrive'}];renderFolderBrowser();});
  $('useFolderButton').addEventListener('click',chooseCurrentFolder);
  $('createStudentButton').addEventListener('click',handleCreateStudent);
  $('finishStudentButton').addEventListener('click',()=>{activeStudent=null;showView('homeView');refreshHome().catch(e=>toast(e.message,true));});
  $('archiveButton').addEventListener('click',()=>{showView('archiveView');refreshArchive().catch(e=>toast(e.message,true));});
  $('refreshRecentButton').addEventListener('click',()=>refreshHome().catch(e=>toast(e.message,true)));
  $('refreshDocsButton').addEventListener('click',()=>refreshStudentDocuments().catch(e=>toast(e.message,true)));
  $('archiveRefreshButton').addEventListener('click',()=>refreshArchive().catch(e=>toast(e.message,true)));
  $('archiveSearch').addEventListener('input',renderArchive);
  $('newStudentButton').addEventListener('click',()=>showView('studentView'));
  $('mergeButton').addEventListener('click',()=>showView('mergeView'));
  $('settingsButton').addEventListener('click',()=>{fillSettings();showView('settingsView');});
  $('settingsChangeFolder').addEventListener('click',()=>storageMode==='local'?choosePhoneFolder():openFolderSetup());
  $('signOutButton').addEventListener('click',async()=>{if(authApi)await authApi.signOut();localStorage.removeItem('roviaw_cloud_base_folder_v1');localStorage.removeItem('roviaw_storage_mode');account=null;storageMode='';setCloudStatus('Choose storage');showView('welcomeView');});
  $('mergeCreateButton').addEventListener('click',handleMergeFiles);
  $('cameraInput').addEventListener('change',e=>handleCapturedFiles(e.target.files,'camera'));
  $('fileInput').addEventListener('change',e=>handleCapturedFiles(e.target.files,'file'));
  $('captureClose').addEventListener('click',closeCaptureModal);
  $('cropClose').addEventListener('click',()=> $('cropModal').classList.remove('open'));
  $('documentChecklist').addEventListener('click',()=>{});
  $('savedDocsList').addEventListener('click',e=>{
    const button=e.target.closest('[data-download-doc]');
    if(!button)return;
    const doc=savedDocs.find(x=>x.name===button.dataset.downloadDoc);
    if(doc?.blob)downloadBlob(doc.blob,doc.name);
  });

  if(storageMode==='local') {
    await activatePhoneStorage(false);
    return;
  }
  if(storageMode==='onedrive') {
    try {
      const authState=await prepareAuth();
      if(authState.configured && authState.account) {
        account=authState.account;
        await afterLogin();
        return;
      }
      $('signInButton').textContent='OneDrive setup required';
    } catch(error) {
      console.warn('OneDrive could not initialize. Phone storage remains available.',error);
    }
  }
  setCloudStatus('Choose storage');
  showView('welcomeView');
}

async function activatePhoneStorage(showMessage=true) {
  storageMode='local';
  localStorage.setItem('roviaw_storage_mode','local');
  baseFolder={id:'phone-root',name:'Phone storage',path:'This phone',local:true};
  try {
    const handle=await getPhoneDirectoryHandle();
    phoneDirectoryName=handle?.name||'';
    phoneFolderWriteAvailable=!!handle;
    await requestPersistentPhoneStorage();
  } catch { phoneFolderWriteAvailable=false; }
  account=null;
  setCloudStatus('Saved on this phone',true);
  await showHome();
  if(showMessage) toast(phoneFolderWriteAvailable?`Phone storage ready · ${phoneDirectoryName}`:'Phone storage ready. Files stay in this app until downloaded or a folder is selected.');
}

async function choosePhoneFolder() {
  if(!('showDirectoryPicker' in window)) {
    if(storageMode!=='local') await activatePhoneStorage(false);
    toast('This browser cannot write directly to a chosen folder. Student files will stay in this app; use Download to save them into your phone storage.',true);
    return;
  }
  try {
    const handle=await window.showDirectoryPicker({id:'roviaw-scan-folder',mode:'readwrite'});
    const permission=handle.requestPermission?await handle.requestPermission({mode:'readwrite'}):'granted';
    if(permission!=='granted') throw new Error('Folder access was not granted. Choose the folder again to allow saving.');
    await savePhoneDirectoryHandle(handle);
    phoneDirectoryName=handle.name||'Selected folder';
    phoneFolderWriteAvailable=true;
    if(storageMode!=='local') await activatePhoneStorage(false);
    fillSettings();
    toast(`Phone folder selected: ${phoneDirectoryName}`);
  } catch(error) {
    if(error.name==='AbortError')return;
    toast(error.message||'Could not select that folder.',true);
  }
}

async function handleSignIn() {
  try {
    const authState=await prepareAuth();
    if(!authState.configured) throw new Error('OneDrive setup is not finished yet. Add the Microsoft Client ID in scan/src/config.js, or continue using Phone storage.');
    account=await authApi.signIn();
    await afterLogin();
  } catch(error) { toast(error.message,true); }
}

async function afterLogin() {
  await loadCloudApis();
  if(!account) account=authApi?.getAccount();
  storageMode='onedrive';
  localStorage.setItem('roviaw_storage_mode','onedrive');
  setCloudStatus('OneDrive connected',true);
  $('accountLabel').textContent=displayNameForAccount();
  try { await graphApi.getDrive(); }
  catch(error) { setCloudStatus('OneDrive unavailable'); throw error; }
  baseFolder=oneDriveApi.getSavedBaseFolder();
  if(baseFolder?.id) {
    try { await graphApi.listChildren(baseFolder.id); await showHome(); return; }
    catch { baseFolder=null; localStorage.removeItem('roviaw_cloud_base_folder_v1'); }
  }
  await openFolderSetup();
}

async function openFolderSetup() {
  folderStack=[{id:'root',name:'OneDrive',path:'OneDrive'}];
  showView('folderView');
  await renderFolderBrowser();
}

async function renderFolderBrowser() {
  const current=folderStack[folderStack.length-1];
  $('folderPathLabel').textContent=current.path;
  $('folderCrumbs').innerHTML=folderStack.map((x,i)=>`<button data-crumb="${i}">${escapeHtml(x.name)}</button>`).join('<span>›</span>');
  $('folderCrumbs').querySelectorAll('[data-crumb]').forEach(b=>b.addEventListener('click',()=>{folderStack=folderStack.slice(0,Number(b.dataset.crumb)+1);renderFolderBrowser().catch(e=>toast(e.message,true));}));
  $('folderList').innerHTML='<div class="loading-line">Loading folders…</div>';
  try {
    const items=await graphApi.listChildren(current.id);
    const folders=items.filter(x=>x.folder).sort((a,b)=>a.name.localeCompare(b.name));
    $('folderList').innerHTML=folders.length?folders.map(f=>`<button class="folder-row" data-folder-id="${f.id}" data-folder-name="${escapeAttr(f.name)}"><span>📁</span><strong>${escapeHtml(f.name)}</strong><span>›</span></button>`).join(''):'<div class="empty-state">No folders here. You can use this folder or create a folder in OneDrive first.</div>';
    $('folderList').querySelectorAll('[data-folder-id]').forEach(b=>b.addEventListener('click',()=>{
      const name=b.dataset.folderName; folderStack.push({id:b.dataset.folderId,name,path:`${current.path} / ${name}`}); renderFolderBrowser().catch(e=>toast(e.message,true));
    }));
  } catch(error) { $('folderList').innerHTML=`<div class="empty-state error-text">${escapeHtml(error.message)}</div>`; }
}

function chooseCurrentFolder() {
  const current=folderStack[folderStack.length-1];
  baseFolder={id:current.id,name:current.name,path:current.path};
  oneDriveApi.saveBaseFolder(baseFolder);
  showHome().catch(e=>toast(e.message,true));
}

async function showHome() {
  $('storageName').textContent=storageMode==='local'?'Phone storage':(baseFolder?.name || 'OneDrive');
  document.querySelector('.storage-icon').textContent=storageMode==='local'?'📱':'☁';
  $('storagePath').textContent=storageMode==='local'?(phoneDirectoryName?`Folder: ${phoneDirectoryName}`:'Saved inside this app'):(baseFolder?.path || 'OneDrive root');
  $('accountLabel').textContent=storageMode==='local'?'This phone · Local storage':displayNameForAccount();
  showView('homeView');
  await refreshHome();
}

async function refreshHome() {
  if(!baseFolder)return;
  const groups=storageMode==='local'?await listLocalArchive():await oneDriveApi.listArchive(baseFolder);
  const recent=groups.flatMap(g=>g.students.map(s=>({...s,date:g.date}))).slice(0,5);
  $('recentList').innerHTML=recent.length?recent.map(s=>`<button class="record-row" data-folder="${s.folderId}"><span class="record-avatar">${escapeHtml(s.name.charAt(0).toUpperCase())}</span><span class="record-copy"><strong>${escapeHtml(s.name)}</strong><small>${humanDate(s.date)}</small></span><span>›</span></button>`).join(''):'<div class="empty-state">No students saved yet. Create your first customer.</div>';
  $('recentList').querySelectorAll('[data-folder]').forEach(b=>b.addEventListener('click',()=>openArchivedStudent(b.dataset.folder,b.querySelector('strong').textContent)));
}

async function handleCreateStudent() {
  const name=$('studentName').value.trim();
  if(!name){toast('Enter the student name.',true);$('studentName').focus();return;}
  if(!baseFolder){toast('Choose a storage location first.',true);return;}
  $('createStudentButton').disabled=true;
  showProgress('Creating student folder',storageMode==='local'?'Preparing phone storage…':'Preparing date-wise OneDrive folder…',10);
  try {
    const details={name,mobile:$('studentMobile').value,address:$('studentAddress').value};
    const student=storageMode==='local'?await createLocalStudentRecord(baseFolder,details):await oneDriveApi.createStudentRecord(baseFolder,details);
    activeStudent=student;savedDocs=[];
    $('studentName').value='';$('studentMobile').value='';$('studentAddress').value='';
    updateStudentHeader();renderStudentDocuments();
    hideProgress();showView('documentsView');toast(storageMode==='local'?'Student created on this phone.':'Student created successfully in OneDrive.');
  } catch(error) { hideProgress();toast(error.message,true); }
  finally { $('createStudentButton').disabled=false; }
}

function updateStudentHeader() {
  $('activeStudentName').textContent=activeStudent?.name||'Student';
  $('activeStudentMeta').textContent=activeStudent?`${activeStudent.date} · ${activeStudent.folderName}`:'Documents upload directly to OneDrive.';
}
function renderStudentDocuments() {
  const expected=['Photo.jpg','Signature.jpg','Aadhaar.pdf','Licence.pdf'];
  $('documentChecklist').innerHTML=expected.map(n=>`<span class="check-item ${savedDocs.some(x=>x.name===n)?'done':''}"><i>${savedDocs.some(x=>x.name===n)?'✓':'•'}</i>${n.replace('.jpg','').replace('.pdf','')}</span>`).join('');
  $('documentCount').textContent=`${savedDocs.length} saved`;
  $('savedDocsList').innerHTML=savedDocs.length?savedDocs.map(x=>{
    const status=storageMode==='local'?(x.writtenToFolder?'Saved to phone folder':'Saved in app storage'):'Saved to OneDrive';
    const action=storageMode==='local'&&x.blob?`<button class="text-btn" data-download-doc="${escapeAttr(x.name)}">Download</button>`:'';
    return `<div class="record-row"><span class="record-avatar">${x.name.endsWith('.pdf')?'PDF':'JPG'}</span><span class="record-copy"><strong>${escapeHtml(x.name)}</strong><small>${formatBytes(x.size)} · ${status}</small></span>${action}</div>`;
  }).join(''):'<div class="empty-state">No documents saved yet.</div>';
}

let captureState=null;
function startDocument(type) {
  if(!activeStudent){toast('Create a student first.',true);return;}
  if(type==='Other') {
    const name=prompt('Enter the document name (for example: Eye Test, Existing Licence):');
    if(!name?.trim())return;
    captureState={type:'Other',name:name.trim(),files:[]};
    $('captureTitle').textContent=name.trim();$('captureEyebrow').textContent='NAMED DOCUMENT';
    $('captureHelp').textContent='Choose or capture one or more pages. Pages are combined into a PDF without opening the crop editor.';
    $('cameraInput').multiple=false;$('fileInput').multiple=true;
    openCaptureModal();return;
  }
  captureState={type,files:[],page:0};
  $('captureTitle').textContent=type==='Photo'?'Photograph':type==='Signature'?'Signature':type;
  $('captureEyebrow').textContent='CAPTURE DOCUMENT';
  $('captureHelp').textContent=type==='Photo'?'Capture a clear passport-style photo. You can adjust the crop before saving.':type==='Signature'?'Capture the signature on plain white paper. Adjust the crop before saving.':'Capture the front side. Crop it, then capture the reverse side.';
  $('cameraInput').multiple=false;$('fileInput').multiple=false;
  openCaptureModal();
}
function openCaptureModal(){ $('captureModal').classList.add('open'); }
function closeCaptureModal(){ $('captureModal').classList.remove('open'); captureState=null; }

async function handleCapturedFiles(fileList,source) {
  const files=Array.from(fileList||[]);$('cameraInput').value='';$('fileInput').value='';
  if(!files.length||!captureState)return;
  const state=captureState;
  if(state.type==='Other') { state.files.push(...files); closeCaptureModal(); await saveOtherPdf(state); return; }
  $('captureModal').classList.remove('open');
  const profile=state.type==='Photo'?{width:205,height:286,preferredMin:13*1024,preferredMax:18*1024}:state.type==='Signature'?{width:312,height:243,preferredMin:13*1024,preferredMax:18*1024}:null;
  try {
    const blob=await cropImage(files[0],profile);
    if(!blob){ $('captureModal').classList.add('open'); return; }
    if(state.type==='Photo'||state.type==='Signature') {
      await uploadSingleImage(state.type,blob); closeCaptureModal();
    } else {
      state.files.push(blob); state.page++;
      if(state.page===1) {
        $('captureModal').classList.add('open');
        $('captureTitle').textContent=`${state.type} · Front saved`;
        $('captureHelp').textContent='Front side cropped and ready. Place the reverse side and tap Capture second side.';
        $('captureEyebrow').textContent='PAGE 1 OF 2';
        $('cameraInput').multiple=false;$('fileInput').multiple=false;
        $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent='📷 Capture second side';
        $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose second side';
      } else {
        const layout=confirm('Both sides are ready.\nOK = Keep front and back on separate PDF pages.\nCancel = Arrange both sides on one A4 page.');
        const pdf=await createPdf(state.files,layout?'separate':'single');
        await saveDocument(`${state.type}.pdf`,pdf);
        closeCaptureModal();
      }
    }
  } catch(error) { $('captureModal').classList.add('open');toast(error.message,true); }
  finally {
    if (!captureState || captureState.page !== 1) {
      $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent='📷 Open camera';
      $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose image';
    }
  }
}

async function uploadSingleImage(type,blob) {
  const filename=`${type}.jpg`;
  await saveDocument(filename,blob);
}

async function saveOtherPdf(state) {
  showProgress('Preparing named document','Combining pages into PDF…',15);
  try {
    const pdf=await createPdf(state.files,'separate');
    await saveDocument(`${sanitizeFileName(state.name)}.pdf`,pdf);
  } catch(error) { hideProgress();toast(error.message,true); }
}

async function saveDocument(filename,blob) {
  showProgress(`Saving ${filename}`,storageMode==='local'?'Saving to this phone…':'Uploading directly to OneDrive…',0);
  try {
    if(storageMode==='local') {
      const saved=await saveLocalStudentDocument(activeStudent,filename,blob);
      const index=savedDocs.findIndex(x=>x.name===filename);
      if(index>=0)savedDocs[index]=saved;else savedDocs.push(saved);
      await saveLocalStudentManifest(activeStudent,savedDocs);
      updateProgress('Saved on this phone',100);
      renderStudentDocuments();hideProgress();
      toast(saved.writtenToFolder?`${filename} saved to selected phone folder.`:`${filename} saved in app storage. Download it from the document list.`);
      return;
    }
    const saved=await oneDriveApi.saveStudentDocument(activeStudent,filename,blob,percent=>updateProgress(`Uploading ${filename}…`,percent));
    const index=savedDocs.findIndex(x=>x.name===filename);
    if(index>=0)savedDocs[index]=saved;else savedDocs.push(saved);
    await oneDriveApi.saveStudentManifest(activeStudent,savedDocs);
    updateProgress('Verifying file in OneDrive…',100);
    const items=await graphApi.listChildren(activeStudent.folderId);
    if(!items.some(x=>x.name===filename && x.file))throw new Error('OneDrive did not confirm the saved file. Please retry.');
    renderStudentDocuments();hideProgress();toast(`${filename} saved successfully.`);
  } catch(error) { hideProgress();throw error; }
}

async function refreshStudentDocuments() {
  if(!activeStudent)return;
  if(storageMode==='local') {
    savedDocs=await listLocalStudentDocuments(activeStudent.folderId);
  } else {
    const items=await oneDriveApi.listStudentDocuments(activeStudent.folderId);
    savedDocs=items.map(x=>({name:x.name,size:x.size,webUrl:x.webUrl}));
  }
  renderStudentDocuments();
}

async function refreshArchive() {
  $('archiveList').innerHTML='<div class="loading-line">Loading saved records…</div>';
  currentArchive=storageMode==='local'?await listLocalArchive():await oneDriveApi.listArchive(baseFolder);renderArchive();
}
function renderArchive() {
  const term=$('archiveSearch').value.trim().toLowerCase();
  let html='';
  const now=new Date(); const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  for(const group of currentArchive) {
    const matches=group.students.filter(s=>s.name.toLowerCase().includes(term));
    if(term && !matches.length)continue;
    const open=term || group.date===today;
    html+=`<details class="date-group" ${open?'open':''}><summary><span>${humanDate(group.date)}</span><b>${matches.length} ${matches.length===1?'student':'students'}</b></summary><div class="date-records">${matches.map(s=>`<button class="record-row" data-student-folder="${s.folderId}" data-student-name="${escapeAttr(s.name)}"><span class="record-avatar">${escapeHtml(s.name[0].toUpperCase())}</span><span class="record-copy"><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.folderName)}</small></span><span>›</span></button>`).join('')}</div></details>`;
  }
  $('archiveList').innerHTML=html||'<div class="empty-state">No matching student records found.</div>';
  $('archiveList').querySelectorAll('[data-student-folder]').forEach(b=>b.addEventListener('click',()=>openArchivedStudent(b.dataset.studentFolder,b.dataset.studentName)));
}

async function openArchivedStudent(folderId,name) {
  const files=storageMode==='local'?await listLocalStudentDocuments(folderId):await oneDriveApi.listStudentDocuments(folderId);
  savedDocs=storageMode==='local'?files:files.map(x=>({name:x.name,size:x.size,webUrl:x.webUrl}));
  $('activeStudentName').textContent=name;
  $('activeStudentMeta').textContent=storageMode==='local'?'Saved on this phone':'Saved in OneDrive archive';
  $('documentChecklist').innerHTML='';$('documentCount').textContent=`${files.length} saved`;
  $('savedDocsList').innerHTML=storageMode==='local'?files.map(f=>`<div class="record-row"><span class="record-avatar">${f.name.endsWith('.pdf')?'PDF':'JPG'}</span><span class="record-copy"><strong>${escapeHtml(f.name)}</strong><small>${formatBytes(f.size)} · Saved on this phone</small></span><button class="text-btn" data-download-doc="${escapeAttr(f.name)}">Download</button></div>`).join('')||'<div class="empty-state">No documents found for this student.</div>':files.map(f=>`<a class="record-row file-link" href="${f.webUrl}" target="_blank" rel="noopener"><span class="record-avatar">${f.name.endsWith('.pdf')?'PDF':'JPG'}</span><span class="record-copy"><strong>${escapeHtml(f.name)}</strong><small>${formatBytes(f.size)}</small></span><span>↗</span></a>`).join('')||'<div class="empty-state">No documents found for this student.</div>'; 
  activeStudent=storageMode==='local'?{...(await getLocalStudentRecord(folderId)),folderId,local:true}:{folderId,id:folderId,name,documents:[]};showView('documentsView');
}

async function handleMergeFiles() {
  const files=Array.from($('mergeInput').files||[]);const name=sanitizeFileName($('mergeName').value||'Merged Files');
  if(!files.length){toast('Choose at least one image.',true);return;}
  showProgress('Creating PDF','Preparing selected images…',10);
  try {
    const pdf=await createPdf(files,$('mergeLayout').value);
    if(storageMode==='local') {
      const saved=await saveLocalMergedFile(`${name}.pdf`,pdf);
      hideProgress();
      if(!saved.writtenToFolder) downloadBlob(pdf,`${name}.pdf`);
      toast(saved.writtenToFolder?'Merged PDF saved to selected phone folder.':'Merged PDF downloaded to your phone.');
    } else {
      const date=new Date().toISOString().slice(0,10);
      const mergeFolder=await graphApi.createFolder(baseFolder.id,`Merged Files`);
      const dayFolder=await graphApi.createFolder(mergeFolder.id,date);
      const outFolder=await graphApi.createFolder(dayFolder.id,name+'__'+crypto.randomUUID().slice(0,8));
      await graphApi.uploadFile(outFolder.id,`${name}.pdf`,pdf,p=>updateProgress('Uploading PDF to OneDrive…',p));
      hideProgress();toast('Merged PDF saved to OneDrive.');
    }
    $('mergeInput').value='';$('mergeName').value='';
  } catch(error){hideProgress();toast(error.message,true);}
}

async function fillSettings() {
  $('settingsAccount').textContent=storageMode==='local'?'Not required · This phone':displayNameForAccount();
  $('settingsPath').textContent=storageMode==='local'?(phoneDirectoryName||'Saved inside this app'):baseFolder?.path||'Not selected';
  $('settingsMode').textContent=storageMode==='local'?'Phone storage':'OneDrive';
  const ua=navigator.userAgent; const label=/Android/i.test(ua)?'Android phone':/iPhone|iPad/i.test(ua)?'Apple mobile device':'Mobile browser';
  $('deviceLabel').textContent=label;
  $('settingsSwitchPhone').hidden=storageMode==='local';
  $('settingsSwitchOneDrive').hidden=storageMode==='onedrive';
  $('settingsChangeFolder').textContent=storageMode==='local'?'Change folder':'Change';
  $('signOutButton').hidden=storageMode!=='onedrive';
}

function downloadBlob(blob,filename) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

function sanitizeFileName(v){return v.trim().replace(/[\\/:*?"<>|#%{}~]/g,'-').replace(/\s+/g,' ').slice(0,70)||'Document';}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;');}

boot();
