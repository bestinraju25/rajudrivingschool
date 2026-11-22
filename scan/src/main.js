import { cropImage } from './image.js';
import { createZipBlob, safeZipName } from './zip.js';
import { getConfiguredClientId, storeConfiguredClientId } from './config.js';
import { createLocalStudentRecord, saveLocalStudentDocument, saveLocalStudentManifest, listLocalArchive, listLocalStudentDocuments, saveLocalMergedFile, savePhoneDirectoryHandle, getPhoneDirectoryHandle, getLocalStudentRecord, updateLocalStudentRecord, deleteLocalStudentRecord, requestPersistentPhoneStorage } from './local-store.js';

const $ = id => document.getElementById(id);
const MAX_PDF_BYTES = 480 * 1024;
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
let currentArchiveSource = 'all';
let archiveLoadVersion = 0;
let editingStudent = null;
const documentObjectUrls = new Map();
let folderSetupReturnView = 'homeView';
let settingsReturnView = 'homeView';
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
function localDateKey(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }

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
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{showView(b.dataset.nav);if(b.dataset.nav==='archiveView')refreshArchive();if(b.dataset.nav==='homeView')refreshHome().catch(error=>toast(error.message,true));if(b.dataset.nav==='documentsView')refreshStudentDocuments().catch(error=>toast(error.message,true));}));
  document.querySelectorAll('[data-doc]').forEach(b=>b.addEventListener('click',()=>startDocument(b.dataset.doc)));
  $('signInButton').addEventListener('click',handleSignIn);
  $('phoneStorageButton').addEventListener('click',activatePhoneStorage);
  $('choosePhoneFolderButton').addEventListener('click',choosePhoneFolder);
  $('settingsChoosePhoneFolder').addEventListener('click',choosePhoneFolder);
  $('settingsSwitchPhone').addEventListener('click',activatePhoneStorage);
  $('settingsSwitchOneDrive').addEventListener('click',handleSignIn);
  $('saveMicrosoftIdButton').addEventListener('click',handleSaveMicrosoftId);
  $('changeFolderButton').addEventListener('click',()=>{
    if(storageMode==='local'){openSettings('homeView');}
    else openFolderSetup('homeView').catch(e=>toast(e.message,true));
  });
  $('folderRootButton').addEventListener('click',()=>{folderStack=[{id:'root',name:'OneDrive',path:'OneDrive'}];renderFolderBrowser();});
  $('useFolderButton').addEventListener('click',chooseCurrentFolder);
  $('createStudentButton').addEventListener('click',handleCreateStudent);
  $('finishStudentButton').addEventListener('click',()=>{activeStudent=null;revokeDocumentObjectUrls();showView('homeView');refreshHome().catch(e=>toast(e.message,true));});
  $('archiveButton').addEventListener('click',()=>{currentArchiveSource='all';showView('archiveView');refreshArchive().catch(e=>toast(e.message,true));});
  $('refreshRecentButton').addEventListener('click',()=>refreshHome().catch(e=>toast(e.message,true)));
  $('refreshDocsButton').addEventListener('click',()=>refreshStudentDocuments().catch(e=>toast(e.message,true)));
  $('archiveRefreshButton').addEventListener('click',()=>refreshArchive().catch(e=>toast(e.message,true)));
  $('downloadByDateButton').addEventListener('click',openDateExportModal);
  $('dateExportSelect').addEventListener('change',updateDateExportSummary);
  $('dateExportClose').addEventListener('click',closeDateExportModal);
  $('dateExportCancel').addEventListener('click',closeDateExportModal);
  $('dateExportDownload').addEventListener('click',()=>downloadDateArchiveZip($('dateExportSelect').value).catch(error=>{hideProgress();toast(error.message||'Could not create date ZIP.',true);}));
  $('downloadStudentZipButton').addEventListener('click',()=>activeStudent&&downloadStudentZip(activeStudent).catch(error=>{hideProgress();toast(error.message||'Could not create student ZIP.',true);}));
  $('archiveSearch').addEventListener('input',renderArchive);
  document.querySelectorAll('[data-archive-source]').forEach(button=>button.addEventListener('click',()=>selectArchiveSource(button.dataset.archiveSource)));
  $('archiveConnectOneDriveButton').addEventListener('click',connectOneDriveFromArchive);
  $('newStudentButton').addEventListener('click',()=>showView('studentView'));
  $('mergeButton').addEventListener('click',()=>showView('mergeView'));
  $('settingsButton').addEventListener('click',()=>openSettings('homeView'));
  $('welcomeSettingsButton').addEventListener('click',()=>openSettings('welcomeView'));
  $('settingsBackButton').addEventListener('click',()=>showView(settingsReturnView));
  $('settingsChangeFolder').addEventListener('click',()=>storageMode==='local'?choosePhoneFolder():openFolderSetup('homeView'));
  $('signOutButton').addEventListener('click',async()=>{if(authApi)await authApi.signOut();localStorage.removeItem('roviaw_cloud_base_folder_v1');localStorage.removeItem('roviaw_storage_mode');account=null;storageMode='';setCloudStatus('Choose storage');showView('welcomeView');});
  $('mergeCreateButton').addEventListener('click',handleMergeFiles);
  $('cameraInput').addEventListener('change',e=>handleCapturedFiles(e.target.files,'camera'));
  $('fileInput').addEventListener('change',e=>handleCapturedFiles(e.target.files,'file'));
  $('captureClose').addEventListener('click',closeCaptureModal);
  $('cropClose').addEventListener('click',()=> $('cropModal').classList.remove('open'));
  $('documentChecklist').addEventListener('click',()=>{});
  $('savedDocsList').addEventListener('click',e=>{
    const openButton=e.target.closest('[data-open-doc]');
    if(!openButton)return;
    const doc=savedDocs.find(x=>x.name===openButton.dataset.openDoc);
    if(!doc)return;
    if(doc.webUrl)window.open(doc.webUrl,'_blank','noopener');
    else if(doc.blob)window.open(documentThumbSource(doc),'_blank','noopener');
  });
  $('archiveList').addEventListener('click',e=>{
    const action=e.target.closest('[data-student-action]');
    if(action){
      e.preventDefault();e.stopPropagation();
      const student={folderId:action.dataset.folderId,name:action.dataset.name,folderName:action.dataset.folderName,source:action.dataset.source,date:action.dataset.date};
      if(action.dataset.studentAction==='edit')openStudentEditor(student).catch(error=>toast(error.message,true));
      if(action.dataset.studentAction==='delete')deleteStudent(student).catch(error=>toast(error.message,true));
      return;
    }
    const open=e.target.closest('[data-open-student]');
    if(open)openArchivedStudent(open.dataset.folderId,open.dataset.name,open.dataset.source,open.dataset.date,open.dataset.folderName).catch(error=>toast(error.message,true));
  });
  $('editActiveStudentButton').addEventListener('click',()=>activeStudent&&openStudentEditor(activeStudent).catch(error=>toast(error.message,true)));
  $('deleteActiveStudentButton').addEventListener('click',()=>activeStudent&&deleteStudent(activeStudent).catch(error=>toast(error.message,true)));
  $('studentEditClose').addEventListener('click',closeStudentEditor);
  $('studentEditCancel').addEventListener('click',closeStudentEditor);
  $('studentEditSave').addEventListener('click',saveStudentEdits);

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
  await openFolderSetup('homeView');
}

async function openFolderSetup(returnView='homeView') {
  folderSetupReturnView=returnView;
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
  if(folderSetupReturnView==='archiveView') {
    showView('archiveView');
    refreshArchive().catch(e=>toast(e.message,true));
  } else {
    showHome().catch(e=>toast(e.message,true));
  }
}

function openSettings(returnView='homeView') { settingsReturnView=returnView; fillSettings(); showView('settingsView'); }

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
  $('recentList').innerHTML=recent.length?recent.map(s=>`<button class="record-row" data-folder="${escapeAttr(s.folderId)}" data-folder-name="${escapeAttr(s.folderName||s.name)}" data-date="${escapeAttr(s.date)}"><span class="record-avatar">${escapeHtml(s.name.charAt(0).toUpperCase())}</span><span class="record-copy"><strong>${escapeHtml(s.name)}</strong><small>${humanDate(s.date)}</small></span><span>›</span></button>`).join(''):'<div class="empty-state">No students saved yet. Create your first customer.</div>';
  $('recentList').querySelectorAll('[data-folder]').forEach(b=>b.addEventListener('click',()=>openArchivedStudent(b.dataset.folder,b.querySelector('strong').textContent,storageMode==='local'?'phone':'onedrive',b.dataset.date,b.dataset.folderName)));
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
    revokeDocumentObjectUrls();activeStudent={...student,storage:storageMode==='local'?'phone':'onedrive'};savedDocs=[];
    $('studentName').value='';$('studentMobile').value='';$('studentAddress').value='';
    updateStudentHeader();renderStudentDocuments();
    hideProgress();showView('documentsView');toast(storageMode==='local'?'Student created on this phone.':'Student created successfully in OneDrive.');
  } catch(error) { hideProgress();toast(error.message,true); }
  finally { $('createStudentButton').disabled=false; }
}

function isPhoneStudent(student=activeStudent) { return student?.storage==='phone' || student?.local===true; }
function updateStudentHeader() {
  $('activeStudentName').textContent=activeStudent?.name||'Student';
  const source=isPhoneStudent(activeStudent)?'Phone storage':'OneDrive';
  const contact=activeStudent?.mobile?` · ${activeStudent.mobile}`:'';
  $('activeStudentMeta').textContent=activeStudent?`${activeStudent.date||''} · ${source}${contact}`:'Choose a storage source to begin.';
}
function revokeDocumentObjectUrls() {
  for(const url of documentObjectUrls.values())URL.revokeObjectURL(url);
  documentObjectUrls.clear();
}
function documentThumbSource(doc) {
  if(doc.thumbnailUrl)return doc.thumbnailUrl;
  if(doc.blob) {
    if(!documentObjectUrls.has(doc.name))documentObjectUrls.set(doc.name,URL.createObjectURL(doc.blob));
    return documentObjectUrls.get(doc.name);
  }
  return '';
}
function renderStudentDocuments() {
  const expected=['Photo.jpg','Signature.jpg','Aadhaar.pdf','Licence.pdf'];
  $('documentChecklist').innerHTML=expected.map(n=>`<span class="check-item ${savedDocs.some(x=>x.name===n)?'done':''}"><i>${savedDocs.some(x=>x.name===n)?'✓':'•'}</i>${n.replace('.jpg','').replace('.pdf','')}</span>`).join('');
  $('documentCount').textContent=`${savedDocs.length} saved`;
  $('savedDocsList').innerHTML=savedDocs.length?savedDocs.map(x=>{
    const status=isPhoneStudent(activeStudent)?(x.writtenToFolder?'Phone folder':'Phone app storage'):'OneDrive';
    const thumb=documentThumbSource(x);
    const preview=thumb?`<img class="doc-thumb" src="${escapeAttr(thumb)}" alt="${escapeAttr(x.name)} preview" data-file-name="${escapeAttr(x.name)}" loading="lazy" />`:`<span class="doc-thumb doc-thumb-fallback ${x.name.toLowerCase().endsWith('.pdf')?'pdf':''}">${x.name.toLowerCase().endsWith('.pdf')?'PDF':'IMG'}</span>`;
    return `<div class="saved-document-row"><button class="doc-preview-button" type="button" data-open-doc="${escapeAttr(x.name)}" aria-label="Open ${escapeAttr(x.name)}">${preview}</button><span class="record-copy"><strong>${escapeHtml(x.name)}</strong><small>${formatBytes(x.size)} · ${status}</small></span></div>`;
  }).join(''):'<div class="empty-state">No documents saved yet.</div>';
  $('savedDocsList').querySelectorAll('img.doc-thumb').forEach(img=>img.addEventListener('error',()=>{
    const fallback=document.createElement('span');const isPdf=(img.dataset.fileName||'').toLowerCase().endsWith('.pdf');fallback.className=`doc-thumb doc-thumb-fallback ${isPdf?'pdf':''}`;fallback.textContent=isPdf?'PDF':'IMG';img.replaceWith(fallback);
  },{once:true}));
  $('downloadStudentZipButton').disabled=savedDocs.length===0;
  $('downloadStudentZipButton').textContent=savedDocs.length?`Download all documents (.ZIP · ${savedDocs.length})`:'No documents to download';
}

let captureState=null;
function startDocument(type) {
  if(!activeStudent){toast('Create a student first.',true);return;}
  if(type==='Other') {
    const name=prompt('Enter the document name (for example: Eye Test, Existing Licence):');
    if(!name?.trim())return;
    const pageCountRaw=prompt('How many pages should this document contain? Enter 1–8.','1');
    if(pageCountRaw===null)return;
    const pageCount=Number(pageCountRaw);
    if(!Number.isInteger(pageCount)||pageCount<1||pageCount>8){toast('Choose a page count from 1 to 8.',true);return;}
    captureState={type:'Other',name:name.trim(),files:[],maxPages:pageCount};
    $('captureTitle').textContent=`${name.trim()} · Page 1`;$('captureEyebrow').textContent=`NAMED DOCUMENT · PAGE 1 OF ${pageCount}`;
    $('captureHelp').textContent=`Capture ${pageCount} page(s) in order or select the images together. Each page opens in a four-corner crop and straightening editor.`;
    $('pagePrompt').hidden=true;$('pagePrompt').innerHTML='';
    $('cameraInput').multiple=false;$('fileInput').multiple=true;
    $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent='📷 Capture page 1';
    $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose pages';
    openCaptureModal();return;
  }
  captureState={type,files:[],page:0};
  $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent='📷 Open camera';
  $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose image';
  $('pagePrompt').hidden=true;$('pagePrompt').innerHTML='';
  $('captureTitle').textContent=type==='Photo'?'Photograph':type==='Signature'?'Signature':type;
  $('captureEyebrow').textContent='CAPTURE DOCUMENT';
  $('captureHelp').textContent=type==='Photo'?'Capture a clear passport-style photo. You can adjust the crop before saving.':type==='Signature'?'Capture the signature on plain white paper. Adjust the crop before saving.':'Capture the front side. Crop it, then capture the reverse side.';
  $('cameraInput').multiple=false;$('fileInput').multiple=false;
  openCaptureModal();
}
function openCaptureModal(){ $('captureModal').classList.add('open'); }
function closeCaptureModal(){ $('captureModal').classList.remove('open'); $('pagePrompt').hidden=true;$('pagePrompt').innerHTML=''; captureState=null; }

async function handleCapturedFiles(fileList,source) {
  const files=Array.from(fileList||[]);$('cameraInput').value='';$('fileInput').value='';
  if(!files.length||!captureState)return;
  const state=captureState;
  if(state.type==='Other') {
    if(state.files.length+files.length>state.maxPages){toast(`This document was set for ${state.maxPages} page(s). Select only the remaining page(s).`,true);return;}
    $('captureModal').classList.remove('open');
    try {
      for(let i=0;i<files.length;i++) {
        const pageNumber=state.files.length+1;
        const cropped=await cropImage(files[i],null,()=>{
          $('cropTitle').textContent=`${state.name} · Page ${pageNumber} of ${state.maxPages}`;
          $('cropInstructions').textContent='Adjust all four green corners to fit the page. The scanner will straighten the page automatically.';
        },{perspective:true});
        if(!cropped){$('captureModal').classList.add('open');return;}
        state.files.push(cropped);
      }
    } catch(error) { $('captureModal').classList.add('open');toast(error.message,true);return; }
    if(state.files.length<state.maxPages) {
      const nextPage=state.files.length+1;
      $('captureTitle').textContent=`${state.name} · Page ${nextPage}`;
      $('captureEyebrow').textContent=`NAMED DOCUMENT · ${state.files.length} OF ${state.maxPages} CROPPED`;
      $('captureHelp').textContent=`${state.files.length} of ${state.maxPages} pages are ready. Capture or choose the remaining pages; each page gets four-corner adjustment.`;
      $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent=`📷 Capture page ${nextPage}`;
      $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose remaining pages';
      $('pagePrompt').hidden=false;
      $('pagePrompt').innerHTML=`<strong>${state.files.length} of ${state.maxPages} pages ready.</strong> <button type="button" id="retakeNamedPageButton" class="text-btn">Retake last page</button>`;
      $('retakeNamedPageButton').addEventListener('click',()=>{
        state.files.pop();
        const page=state.files.length+1;
        $('captureTitle').textContent=`${state.name} · Page ${page}`;
        $('captureEyebrow').textContent=`NAMED DOCUMENT · ${state.files.length} OF ${state.maxPages} READY`;
        $('captureHelp').textContent='Retake the current page. It will open in the four-corner crop editor.';
        $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent=`📷 Capture page ${page}`;
        $('pagePrompt').hidden=true;$('pagePrompt').innerHTML='';
      });
      $('captureModal').classList.add('open');
      return;
    }
    closeCaptureModal();await saveOtherPdf(state);return;
  }
  $('captureModal').classList.remove('open');
  const profile=state.type==='Photo'?{width:205,height:286,preferredMin:10*1024,preferredMax:18*1024}:state.type==='Signature'?{width:312,height:243,preferredMin:10*1024,preferredMax:18*1024}:null;
  try {
    const sideName=state.page===0?'Front':'Back';
    const blob=await cropImage(files[0],profile,()=>{
      $('cropTitle').textContent=profile?`${state.type} · Crop image`:`${state.type} · ${sideName} side`;
      $('cropInstructions').textContent=profile?'Adjust the crop and confirm to save the image.':'Adjust the page crop, then confirm this side.';
    });
    if(!blob){ $('captureModal').classList.add('open'); return; }
    if(state.type==='Photo'||state.type==='Signature') {
      await uploadSingleImage(state.type,blob); closeCaptureModal();
    } else {
      state.files.push(blob); state.page++;
      if(state.page===1) {
        $('captureModal').classList.add('open');
        $('captureTitle').textContent=`${state.type} · Front saved`;
        $('captureHelp').textContent='Front side cropped and saved for this document. Place the reverse side and tap Capture second side.';
        $('captureEyebrow').textContent='PAGE 1 OF 2';
        $('cameraInput').multiple=false;$('fileInput').multiple=false;
        $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent='📷 Capture second side';
        $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose second side';
        $('pagePrompt').hidden=false;
        $('pagePrompt').innerHTML='<strong>Front side accepted.</strong> You can retake it before continuing. <button type="button" id="retakeFirstSideButton" class="text-btn">Retake first side</button>';
        $('retakeFirstSideButton').addEventListener('click',()=>{
          state.files=[];state.page=0;$('pagePrompt').hidden=true;$('pagePrompt').innerHTML='';
          $('captureTitle').textContent=`${state.type} · Front side`;
          $('captureHelp').textContent='Capture and crop the front side again.';
          $('captureEyebrow').textContent='PAGE 1 OF 2';
          $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent='📷 Capture front side';
          $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose front side';
        });
      } else {
        await saveTwoSidedPdf(state);
      }
    }
  } catch(error) {
    $('captureModal').classList.add('open');
    toast(error.message,true);
    if((state.type==='Aadhaar'||state.type==='Licence') && state.page===2 && state.files.length===2) showTwoSidedRecovery(state);
  }
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

async function saveTwoSidedPdf(state) {
  const layout=confirm('Both sides are ready.\nOK = Keep front and back on separate PDF pages.\nCancel = Arrange both sides on one A4 page.');
  const pdf=await createPdf(state.files,layout?'separate':'single');
  await saveDocument(`${state.type}.pdf`,pdf);
  closeCaptureModal();
}

function showTwoSidedRecovery(state) {
  $('captureTitle').textContent=`${state.type} · Both sides captured`;
  $('captureHelp').textContent='The PDF was not saved. Retry saving the same two sides or retake the reverse side.';
  $('pagePrompt').hidden=false;
  $('pagePrompt').innerHTML='<strong>Both sides are ready.</strong> <button type="button" id="retryTwoSidedSaveButton" class="text-btn">Retry PDF save</button> <button type="button" id="retakeSecondSideButton" class="text-btn">Retake second side</button>';
  $('retryTwoSidedSaveButton').addEventListener('click',async()=>{
    $('pagePrompt').hidden=true;$('pagePrompt').innerHTML='';
    try { await saveTwoSidedPdf(state); }
    catch(error) { toast(error.message,true); showTwoSidedRecovery(state); }
  });
  $('retakeSecondSideButton').addEventListener('click',()=>{
    state.files=state.files.slice(0,1);state.page=1;
    $('pagePrompt').hidden=true;$('pagePrompt').innerHTML='';
    $('captureTitle').textContent=`${state.type} · Second side`;
    $('captureEyebrow').textContent='PAGE 2 OF 2';
    $('captureHelp').textContent='Retake the reverse side. The accepted front side is preserved.';
    $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent='📷 Capture second side';
    $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose second side';
  });
}

async function saveOtherPdf(state) {
  const separate=confirm('Named document pages are ready.\nOK = Keep each page separate.\nCancel = Arrange all pages on one A4 page.');
  showProgress('Preparing named document','Combining pages into a compressed PDF…',15);
  try {
    const pdf=await createPdf(state.files,separate?'separate':'single');
    await saveDocument(`${sanitizeFileName(state.name)}.pdf`,pdf);
  } catch(error) { hideProgress();toast(error.message,true); }
}

async function saveDocument(filename,blob) {
  validateOutputSize(filename, blob);
  const saveToPhone=isPhoneStudent(activeStudent);
  showProgress(`Saving ${filename}`,saveToPhone?'Saving to this phone…':'Uploading directly to OneDrive…',0);
  try {
    if(saveToPhone) {
      const saved=await saveLocalStudentDocument(activeStudent,filename,blob);
      const oldUrl=documentObjectUrls.get(filename);if(oldUrl){URL.revokeObjectURL(oldUrl);documentObjectUrls.delete(filename);}
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
    await refreshStudentDocuments();hideProgress();toast(`${filename} saved successfully.`);
  } catch(error) { hideProgress();throw error; }
}

async function refreshStudentDocuments() {
  if(!activeStudent)return;
  $('savedDocsList').innerHTML='<div class="loading-line">Loading saved documents and previews…</div>';
  revokeDocumentObjectUrls();
  if(isPhoneStudent(activeStudent)) {
    savedDocs=await listLocalStudentDocuments(activeStudent.folderId);
  } else {
    const items=await oneDriveApi.listStudentDocuments(activeStudent.folderId);
    savedDocs=await Promise.all(items.map(async item=>({
      name:item.name,size:item.size,webUrl:item.webUrl,id:item.id,
      thumbnailUrl:await graphApi.getThumbnailUrl(item.id)
    })));
  }
  renderStudentDocuments();
}

function closeDateExportModal() {
  $('dateExportModal').classList.remove('open');
}

function openDateExportModal() {
  const dates=currentArchive.filter(group=>(group.students||[]).length>0);
  if(!dates.length) { toast('No student records are available in the selected archive source.',true); return; }
  $('dateExportSelect').innerHTML=dates.map(group=>`<option value="${escapeAttr(group.date)}">${escapeHtml(humanDate(group.date))} · ${group.students.length} ${group.students.length===1?'student':'students'}</option>`).join('');
  updateDateExportSummary();
  $('dateExportModal').classList.add('open');
}

function updateDateExportSummary() {
  const date=$('dateExportSelect').value;
  const group=currentArchive.find(x=>x.date===date);
  const count=group?.students?.length||0;
  $('dateExportSummary').textContent=`${count} ${count===1?'student':'students'} will be included from ${date?humanDate(date):'the selected date'}. The ZIP contains each student's available saved documents.`;
}

async function collectStudentFiles(student, onProgress=()=>{}) {
  const folderName=safeZipName(student.folderName||student.name||'Student');
  const source=student.source||student.storage||'onedrive';
  let docs=[];
  if(source==='phone'||student.storage==='phone'||student.local===true) {
    docs=await listLocalStudentDocuments(student.folderId||student.id);
    docs=docs.filter(doc=>doc.blob instanceof Blob);
  } else {
    await loadCloudApis();
    const items=await oneDriveApi.listStudentDocuments(student.folderId);
    for(let i=0;i<items.length;i++) {
      const item=items[i];
      if(!item.id||!item.file) continue;
      onProgress(`Downloading ${item.name}…`);
      const blob=await graphApi.downloadFileBlob(item.id);
      docs.push({name:item.name,blob,size:blob.size});
    }
  }
  if(!docs.length) return [];
  return docs.map(doc=>({path:`${folderName}/${safeZipName(doc.name)}`,blob:doc.blob}));
}

function zipDownloadName(prefix, name, date) {
  const clean=[prefix,safeZipName(name),date].filter(Boolean).join('-').replace(/[^A-Za-z0-9 _.-]/g,'-').replace(/\s+/g,'_');
  return `${clean || 'ROVIAW_Export'}.zip`;
}

async function downloadStudentZip(student) {
  if(!student?.folderId&&!student?.id) throw new Error('Student folder could not be identified.');
  showProgress('Preparing student ZIP','Collecting saved documents…',5);
  try {
    const files=await collectStudentFiles(student,message=>updateProgress(message,35));
    if(!files.length) throw new Error('No saved documents were found for this student.');
    updateProgress(`Creating ZIP with ${files.length} document(s)…`,75);
    const zip=await createZipBlob(files);
    updateProgress('Preparing download…',95);
    downloadBlob(zip,zipDownloadName('ROVIAW',student.name||student.folderName,student.date));
    hideProgress();
    toast(`Downloaded ${files.length} document(s) for ${student.name||'student'}.`);
  } catch(error) {
    hideProgress();
    throw error;
  }
}

async function downloadDateArchiveZip(date) {
  if(!date) throw new Error('Choose a date first.');
  const group=currentArchive.find(x=>x.date===date);
  if(!group?.students?.length) throw new Error('There are no students for this date in the selected source.');
  closeDateExportModal();
  showProgress('Preparing date-wise ZIP',`Collecting documents for ${group.students.length} students…`,3);
  const files=[];
  let completed=0;
  try {
    for(const student of group.students) {
      const source=student.source||'onedrive';
      const folderPrefix=currentArchiveSource==='all'?`${source==='phone'?'Phone':'OneDrive'}/`:'';
      const studentFiles=await collectStudentFiles(student,message=>updateProgress(`${student.name}: ${message}`,Math.min(75,5+Math.round((completed/group.students.length)*65))));
      for(const file of studentFiles) files.push({path:`${folderPrefix}${file.path}`,blob:file.blob});
      completed++;
      updateProgress(`Collected ${completed} of ${group.students.length} students…`,Math.min(75,5+Math.round((completed/group.students.length)*65)));
    }
    if(!files.length) throw new Error('No saved documents were found for the selected date.');
    updateProgress(`Creating ZIP with ${files.length} file(s)…`,82);
    const zip=await createZipBlob(files);
    updateProgress('Preparing download…',96);
    downloadBlob(zip,zipDownloadName('ROVIAW-Date',date,date));
    hideProgress();
    toast(`Downloaded ${files.length} document(s) from ${group.students.length} student(s).`);
  } catch(error) {
    hideProgress();
    throw error;
  }
}

function setArchiveNote(message='', action='') {
  const note=$('archiveSourceNote');
  note.hidden=!message;
  $('archiveSourceNoteText').textContent=message;
  const button=$('archiveConnectOneDriveButton');
  button.hidden=!action;
  button.textContent=action==='settings'?'Set up OneDrive':'Connect OneDrive';
  button.dataset.action=action;
}

function updateArchiveTabs() {
  document.querySelectorAll('[data-archive-source]').forEach(button=>{
    const selected=button.dataset.archiveSource===currentArchiveSource;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-selected',selected?'true':'false');
  });
}

async function selectArchiveSource(source) {
  if(!['all','phone','onedrive'].includes(source))return;
  currentArchiveSource=source;
  updateArchiveTabs();
  await refreshArchive();
}

async function connectOneDriveForArchive(interactive=false) {
  try {
    const configuredId=getConfiguredClientId();
    if(!configuredId||configuredId.includes('PASTE_')) {
      setArchiveNote('Add your Microsoft Client ID in Settings to access the OneDrive archive.','settings');
      if(interactive)openSettings('archiveView');
      return false;
    }
    const state=await prepareAuth();
    if(!state.configured) {
      setArchiveNote('Add your Microsoft Client ID in Settings to access the OneDrive archive.','settings');
      if(interactive)openSettings('archiveView');
      return false;
    }
    account=state.account||authApi?.getAccount()||account;
    if(!account&&interactive)account=await authApi.signIn();
    if(!account) {
      setArchiveNote('Sign in to view people saved in the shared OneDrive folder.','connect');
      return false;
    }
    await loadCloudApis();
    await graphApi.getDrive();
    baseFolder=oneDriveApi.getSavedBaseFolder();
    if(!baseFolder?.id) {
      if(interactive)await openFolderSetup('archiveView');
      else setArchiveNote('Choose the shared OneDrive folder to include its people in the archive.','connect');
      return false;
    }
    return true;
  } catch(error) {
    setArchiveNote(`OneDrive archive could not be loaded: ${error.message}`,'connect');
    if(interactive)toast(error.message,true);
    return false;
  }
}

async function connectOneDriveFromArchive() {
  if($('archiveConnectOneDriveButton').dataset.action==='settings') {openSettings('archiveView');return;}
  const connected=await connectOneDriveForArchive(true);
  if(connected) {
    if(currentArchiveSource==='all')await refreshArchive();
    else {currentArchiveSource='onedrive';updateArchiveTabs();await refreshArchive();}
  }
}

async function refreshArchive() {
  const requestVersion=++archiveLoadVersion;
  const refreshButton=$('archiveRefreshButton');
  refreshButton.disabled=true;
  $('archiveList').innerHTML='<div class="loading-line">Loading saved people…</div>';
  setArchiveNote('');
  const groupsByDate=new Map();
  const addGroups=(groups,source)=>{
    for(const group of groups||[]) {
      const list=groupsByDate.get(group.date)||[];
      for(const student of group.students||[])list.push({...student,source:student.source||source,date:student.date||group.date});
      groupsByDate.set(group.date,list);
    }
  };
  try {
    if(currentArchiveSource==='phone'||currentArchiveSource==='all')addGroups(await listLocalArchive(),'phone');
    if(requestVersion!==archiveLoadVersion)return;

    if(currentArchiveSource==='onedrive'||currentArchiveSource==='all') {
      const connected=await connectOneDriveForArchive(false);
      if(requestVersion!==archiveLoadVersion)return;
      if(connected) {
        const cloudGroups=await oneDriveApi.listArchive(baseFolder);
        if(requestVersion!==archiveLoadVersion)return;
        addGroups(cloudGroups,'onedrive');
        setArchiveNote(currentArchiveSource==='all'
          ?'All sources combines this phone’s local records with the shared OneDrive archive. Refresh to check for cloud changes.'
          :'Live OneDrive archive. Changes made in OneDrive appear after Refresh. Delete the full student folder to remove that person.');
      } else if(currentArchiveSource==='all') {
        const phoneCount=[...groupsByDate.values()].reduce((n,list)=>n+list.length,0);
        if(phoneCount===0) setArchiveNote($('archiveSourceNoteText').textContent||'Connect OneDrive to load student records.',$('archiveConnectOneDriveButton').dataset.action||'connect');
      }
    } else {
      setArchiveNote('Phone archive shows records saved by this app in this browser on this device. Files copied outside the app are not automatically indexed.');
    }

    if(requestVersion!==archiveLoadVersion)return;
    currentArchive=[...groupsByDate.entries()]
      .sort((a,b)=>b[0].localeCompare(a[0]))
      .map(([date,students])=>({date,id:date,students:students.sort((a,b)=>a.name.localeCompare(b.name))}));
    renderArchive();
  } catch(error) {
    if(requestVersion!==archiveLoadVersion)return;
    currentArchive=[...groupsByDate.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,students])=>({date,id:date,students}));
    renderArchive();
    setArchiveNote(`The archive could not finish loading: ${error.message}. Tap Refresh to try again.`,'connect');
    toast(error.message,true);
  } finally {
    if(requestVersion===archiveLoadVersion)refreshButton.disabled=false;
  }
}

function renderArchive() {
  const term=$('archiveSearch').value.trim().toLowerCase();
  let html='';
  const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  for(const group of currentArchive) {
    const matches=group.students.filter(student=>(student.name||'').toLowerCase().includes(term));
    if(term&&!matches.length)continue;
    const open=!!term||group.date===today;
    html+=`<details class="date-group" ${open?'open':''}><summary><span>${humanDate(group.date)}</span><b>${matches.length} ${matches.length===1?'person':'people'}</b></summary><div class="date-records">${matches.map(student=>{
      const source=student.source||'onedrive';
      const attrs=`data-folder-id="${escapeAttr(student.folderId)}" data-name="${escapeAttr(student.name)}" data-folder-name="${escapeAttr(student.folderName||student.name)}" data-source="${source}" data-date="${escapeAttr(group.date)}"`;
      return `<div class="archive-person-row"><button class="archive-open-button" data-open-student data-folder-id="${escapeAttr(student.folderId)}" data-name="${escapeAttr(student.name)}" data-folder-name="${escapeAttr(student.folderName||student.name)}" data-source="${source}" data-date="${escapeAttr(group.date)}"><span class="record-avatar">${escapeHtml((student.name||'?').charAt(0).toUpperCase())}</span><span class="record-copy"><strong>${escapeHtml(student.name||'Unnamed student')}</strong><small>${source==='phone'?'Phone · This device':'OneDrive · Shared folder'}</small></span><span>›</span></button><div class="archive-person-actions"><button class="mini-action" ${attrs} data-student-action="edit" title="Edit student" aria-label="Edit student">✎</button><button class="mini-action danger" ${attrs} data-student-action="delete" title="Delete student" aria-label="Delete student">×</button></div></div>`;
    }).join('')}</div></details>`;
  }
  $('archiveList').innerHTML=html||'<div class="empty-state">No matching people found in this source.</div>';
}

async function openArchivedStudent(folderId,name,source='onedrive',date='',folderName='') {
  const phoneSource=source==='phone';
  revokeDocumentObjectUrls();
  if(phoneSource) {
    const localRecord=await getLocalStudentRecord(folderId);
    activeStudent={...(localRecord||{}),folderId,id:folderId,local:true,storage:'phone',name:localRecord?.name||name,date:localRecord?.date||date};
  } else {
    activeStudent=await oneDriveApi.getStudentRecord(folderId,{folderId,name,folderName:folderName||name,date,storage:'onedrive'});
  }
  updateStudentHeader();
  $('documentChecklist').innerHTML='';$('documentCount').textContent='Loading…';
  showView('documentsView');
  try { await refreshStudentDocuments(); }
  catch(error) { savedDocs=[];renderStudentDocuments();toast(`Could not load saved documents: ${error.message}`,true); }
}

async function openStudentEditor(student) {
  const phoneSource=student.source==='phone'||student.storage==='phone'||student.local===true;
  editingStudent=phoneSource
    ? await getLocalStudentRecord(student.folderId||student.id)
    : await oneDriveApi.getStudentRecord(student.folderId,{...student,storage:'onedrive'});
  if(!editingStudent)throw new Error('Student record not found. Refresh the archive and try again.');
  editingStudent.storage=phoneSource?'phone':'onedrive';
  $('editStudentName').value=editingStudent.name||student.name||'';
  $('editStudentMobile').value=editingStudent.mobile||'';
  $('editStudentAddress').value=editingStudent.address||'';
  $('studentEditModal').classList.add('open');
}

function closeStudentEditor() {
  $('studentEditModal').classList.remove('open');
  editingStudent=null;
}

async function saveStudentEdits() {
  if(!editingStudent)return;
  const details={name:$('editStudentName').value.trim(),mobile:$('editStudentMobile').value.trim(),address:$('editStudentAddress').value.trim()};
  if(!details.name){toast('Student name is required.',true);$('editStudentName').focus();return;}
  const button=$('studentEditSave');button.disabled=true;
  try {
    const updated=editingStudent.storage==='phone'
      ? await updateLocalStudentRecord(editingStudent.id,details)
      : await oneDriveApi.updateStudentRecord(editingStudent,details);
    if(activeStudent&&activeStudent.folderId===updated.folderId) {
      activeStudent={...activeStudent,...updated};updateStudentHeader();
    }
    closeStudentEditor();
    await refreshArchive();
    if(baseFolder)await refreshHome();
    toast('Student details updated successfully.');
  } catch(error) { toast(error.message||'Could not update student details.',true); }
  finally { button.disabled=false; }
}

async function deleteStudent(student) {
  const phoneSource=student.source==='phone'||student.storage==='phone'||student.local===true;
  const label=student.name||'this student';
  if(!confirm(`Delete ${label} and all saved documents?\n\n${phoneSource?'This removes the record from this phone.':'This deletes the student folder from OneDrive (it may remain in the OneDrive recycle bin).'} This action cannot be undone from this scanner.`))return;
  showProgress('Deleting student record',phoneSource?'Removing phone record and documents…':'Deleting student folder from OneDrive…',20);
  try {
    const localResult=phoneSource?await deleteLocalStudentRecord(student.folderId||student.id):null;
    if(!phoneSource)await oneDriveApi.deleteStudentRecord(student.folderId);
    if(activeStudent&&(activeStudent.folderId===(student.folderId||student.id))) {
      activeStudent=null;savedDocs=[];revokeDocumentObjectUrls();showView('archiveView');
    }
    hideProgress();
    await refreshArchive();
    if(baseFolder)await refreshHome();
    toast(localResult?.directoryCopyRemoved===false
      ?'Phone app record deleted. The optional folder copy could not be removed; delete that copy manually in Files.'
      :'Student and saved documents deleted.');
  } catch(error) { hideProgress();toast(error.message||'Could not delete student record.',true); }
}

async function handleMergeFiles() {
  const files=Array.from($('mergeInput').files||[]);const name=sanitizeFileName($('mergeName').value||'Merged Files');
  if(!files.length){toast('Choose at least one image.',true);return;}
  if(files.length>10){toast('Merge Files supports a maximum of 10 images.',true);return;}
  try {
    const reviewed=[];
    for(let i=0;i<files.length;i++) {
      updateProgress(`Review image ${i+1} of ${files.length}…`,Math.round((i/files.length)*55));
      const crop=await cropImage(files[i],null,()=>{
        $('cropTitle').textContent=`Merge Files · Image ${i+1} of ${files.length}`;
        $('cropInstructions').textContent='Adjust the crop area, then confirm to continue to the next image.';
      });
      if(!crop){hideProgress();$('mergeInput').value='';return;}
      reviewed.push(crop);
    }
    showProgress('Creating compressed PDF','Compressing the reviewed pages…',65);
    const pdf=await createPdf(reviewed,$('mergeLayout').value);
    validateOutputSize(`${name}.pdf`, pdf);
    if(storageMode==='local') {
      const saved=await saveLocalMergedFile(`${name}.pdf`,pdf);
      hideProgress();
      if(!saved.writtenToFolder) downloadBlob(pdf,`${name}.pdf`);
      toast(saved.writtenToFolder?`Merged PDF saved to selected phone folder · ${formatBytes(pdf.size)}.`:`Merged PDF downloaded to your phone · ${formatBytes(pdf.size)}.`);
    } else {
      const date=localDateKey();
      const mergeFolder=await graphApi.createFolder(baseFolder.id,`Merged Files`);
      const dayFolder=await graphApi.createFolder(mergeFolder.id,date);
      const outFolder=await graphApi.createFolder(dayFolder.id,name+'__'+crypto.randomUUID().slice(0,8));
      await graphApi.uploadFile(outFolder.id,`${name}.pdf`,pdf,p=>updateProgress('Uploading PDF to OneDrive…',p));
      hideProgress();toast(`Merged PDF saved to OneDrive · ${formatBytes(pdf.size)}.`);
    }
    $('mergeInput').value='';$('mergeName').value='';
  } catch(error){hideProgress();toast(error.message,true);}
}

async function fillSettings() {
  $('settingsAccount').textContent=storageMode==='local'?'Not required · This phone':storageMode==='onedrive'?displayNameForAccount():'Not connected';
  $('settingsPath').textContent=storageMode==='local'?(phoneDirectoryName||'Saved inside this app'):baseFolder?.path||'Not selected';
  $('settingsMode').textContent=storageMode==='local'?'Phone storage':storageMode==='onedrive'?'OneDrive':'Not connected';
  const ua=navigator.userAgent; const label=/Android/i.test(ua)?'Android phone':/iPhone|iPad/i.test(ua)?'Apple mobile device':'Mobile browser';
  $('deviceLabel').textContent=label;
  $('settingsSwitchPhone').hidden=storageMode==='local';
  $('settingsSwitchOneDrive').hidden=storageMode==='onedrive';
  $('settingsChangeFolder').textContent=storageMode==='local'?'Change folder':'Change';
  $('settingsChangeFolder').hidden=!storageMode;
  $('signOutButton').hidden=storageMode!=='onedrive';
  const currentId=getConfiguredClientId();
  const configured=!!currentId && !currentId.includes('PASTE_');
  $('settingsClientId').value=configured?currentId:'';
  $('settingsMicrosoftStatus').textContent=configured?'Client ID is saved on this phone.':'Enter the Client ID from Microsoft Entra to enable OneDrive.';
  $('settingsMicrosoftStatus').classList.toggle('success-text',configured);
}

async function handleSaveMicrosoftId() {
  const value=$('settingsClientId').value.trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    toast('Enter a valid Microsoft Application (client) ID in GUID format.',true);return;
  }
  try {
    storeConfiguredClientId(value);
    if(authApi) {
      authStateCache=await authApi.configureClientId(value);
      authInitialized=true;
    } else {
      authStateCache=null;
      authInitialized=false;
    }
    account=null;
    if(storageMode==='onedrive') {
      storageMode='';
      localStorage.removeItem('roviaw_storage_mode');
    }
    await fillSettings();
    setCloudStatus('OneDrive ready to connect');
    toast('Client ID saved on this phone. Tap Use OneDrive to sign in with the new setting.');
  } catch(error) { toast(error.message||'Could not save the Microsoft Client ID.',true); }
}

function validateOutputSize(filename, blob) {
  const lower=String(filename||'').toLowerCase();
  if(lower.endsWith('.pdf') && blob.size>MAX_PDF_BYTES) {
    throw new Error(`This PDF is ${formatBytes(blob.size)}. The maximum allowed is 480 KB. It was not saved or uploaded.`);
  }
  if((lower==='photo.jpg'||lower==='signature.jpg') && (blob.size<10*1024 || blob.size>18*1024)) {
    throw new Error(`Photo and signature files must be between 10 KB and 18 KB. Current size: ${formatBytes(blob.size)}. Please capture again.`);
  }
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
