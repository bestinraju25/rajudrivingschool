import { cropImage } from './image.js';
import { getConfiguredClientId, storeConfiguredClientId } from './config.js';
import { createLocalStudentRecord, saveLocalStudentDocument, saveLocalStudentManifest, listLocalArchive, listLocalStudentDocuments, saveLocalMergedFile, savePhoneDirectoryHandle, getPhoneDirectoryHandle, getLocalStudentRecord, requestPersistentPhoneStorage } from './local-store.js';

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
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.nav)));
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
  $('finishStudentButton').addEventListener('click',()=>{activeStudent=null;showView('homeView');refreshHome().catch(e=>toast(e.message,true));});
  $('archiveButton').addEventListener('click',()=>{currentArchiveSource='all';showView('archiveView');refreshArchive().catch(e=>toast(e.message,true));});
  $('refreshRecentButton').addEventListener('click',()=>refreshHome().catch(e=>toast(e.message,true)));
  $('refreshDocsButton').addEventListener('click',()=>refreshStudentDocuments().catch(e=>toast(e.message,true)));
  $('archiveRefreshButton').addEventListener('click',()=>refreshArchive().catch(e=>toast(e.message,true)));
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
  $('recentList').innerHTML=recent.length?recent.map(s=>`<button class="record-row" data-folder="${s.folderId}"><span class="record-avatar">${escapeHtml(s.name.charAt(0).toUpperCase())}</span><span class="record-copy"><strong>${escapeHtml(s.name)}</strong><small>${humanDate(s.date)}</small></span><span>›</span></button>`).join(''):'<div class="empty-state">No students saved yet. Create your first customer.</div>';
  $('recentList').querySelectorAll('[data-folder]').forEach(b=>b.addEventListener('click',()=>openArchivedStudent(b.dataset.folder,b.querySelector('strong').textContent,storageMode==='local'?'phone':'onedrive')));
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
    activeStudent={...student,storage:storageMode==='local'?'phone':'onedrive'};savedDocs=[];
    $('studentName').value='';$('studentMobile').value='';$('studentAddress').value='';
    updateStudentHeader();renderStudentDocuments();
    hideProgress();showView('documentsView');toast(storageMode==='local'?'Student created on this phone.':'Student created successfully in OneDrive.');
  } catch(error) { hideProgress();toast(error.message,true); }
  finally { $('createStudentButton').disabled=false; }
}

function isPhoneStudent(student=activeStudent) { return student?.storage==='phone' || student?.local===true; }
function updateStudentHeader() {
  $('activeStudentName').textContent=activeStudent?.name||'Student';
  $('activeStudentMeta').textContent=activeStudent?`${activeStudent.date||''} · ${isPhoneStudent(activeStudent)?'Phone storage':'OneDrive'} · ${activeStudent.folderName||''}`:'Choose a storage source to begin.';
}
function renderStudentDocuments() {
  const expected=['Photo.jpg','Signature.jpg','Aadhaar.pdf','Licence.pdf'];
  $('documentChecklist').innerHTML=expected.map(n=>`<span class="check-item ${savedDocs.some(x=>x.name===n)?'done':''}"><i>${savedDocs.some(x=>x.name===n)?'✓':'•'}</i>${n.replace('.jpg','').replace('.pdf','')}</span>`).join('');
  $('documentCount').textContent=`${savedDocs.length} saved`;
  $('savedDocsList').innerHTML=savedDocs.length?savedDocs.map(x=>{
    const status=isPhoneStudent(activeStudent)?(x.writtenToFolder?'Saved to phone folder':'Saved in app storage'):'Saved to OneDrive';
    const action=isPhoneStudent(activeStudent)&&x.blob?`<button class="text-btn" data-download-doc="${escapeAttr(x.name)}">Download</button>`:'';
    return `<div class="record-row"><span class="record-avatar">${x.name.endsWith('.pdf')?'PDF':'JPG'}</span><span class="record-copy"><strong>${escapeHtml(x.name)}</strong><small>${formatBytes(x.size)} · ${status}</small></span>${action}</div>`;
  }).join(''):'<div class="empty-state">No documents saved yet.</div>';
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
    $('captureHelp').textContent=`Capture ${pageCount} full page(s) in order or select the images together. Named document pages are not cropped.`;
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
    state.files.push(...files);
    if(state.files.length<state.maxPages) {
      const nextPage=state.files.length+1;
      $('captureTitle').textContent=`${state.name} · Page ${nextPage}`;
      $('captureEyebrow').textContent=`NAMED DOCUMENT · ${state.files.length} OF ${state.maxPages} CAPTURED`;
      $('captureHelp').textContent=`${state.files.length} of ${state.maxPages} pages captured. Capture the next full page or choose the remaining images. No crop is applied.`;
      $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent=`📷 Capture page ${nextPage}`;
      $('captureModal').querySelector('.capture-actions label[for="fileInput"]').textContent='Choose remaining pages';
      $('pagePrompt').hidden=false;
      $('pagePrompt').innerHTML=`<strong>Page ${state.files.length} of ${state.maxPages} captured.</strong> <button type="button" id="retakeNamedPageButton" class="text-btn">Retake last page</button>`;
      $('retakeNamedPageButton').addEventListener('click',()=>{
        state.files.pop();
        const page=state.files.length+1;
        $('captureTitle').textContent=`${state.name} · Page ${page}`;
        $('captureEyebrow').textContent=`NAMED DOCUMENT · ${state.files.length} OF ${state.maxPages} CAPTURED`;
        $('captureHelp').textContent='Retake the current full page. Named document pages are kept uncropped.';
        $('captureModal').querySelector('.capture-actions label[for="cameraInput"]').textContent=`📷 Capture page ${page}`;
        $('pagePrompt').hidden=true;$('pagePrompt').innerHTML='';
      });
      return;
    }
    closeCaptureModal(); await saveOtherPdf(state); return;
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
  if(isPhoneStudent(activeStudent)) {
    savedDocs=await listLocalStudentDocuments(activeStudent.folderId);
  } else {
    const items=await oneDriveApi.listStudentDocuments(activeStudent.folderId);
    savedDocs=items.map(x=>({name:x.name,size:x.size,webUrl:x.webUrl}));
  }
  renderStudentDocuments();
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

async function getCachedOneDriveArchive() {
  const state=await prepareAuth();
  account=state.account||authApi?.getAccount()||account;
  if(!state.configured||!account) return { connected:false, groups:[] };
  await loadCloudApis();
  await graphApi.getDrive();
  baseFolder=oneDriveApi.getSavedBaseFolder();
  if(!baseFolder?.id) return { connected:false, needsFolder:true, groups:[] };
  await graphApi.listChildren(baseFolder.id);
  const groups=await oneDriveApi.listArchive(baseFolder);
  return { connected:true, groups };
}

async function selectArchiveSource(source) {
  if(!['all','phone','onedrive'].includes(source)) return;
  currentArchiveSource=source;
  updateArchiveTabs();
  if(source==='onedrive') {
    $('archiveList').innerHTML='<div class="loading-line">Connecting to OneDrive…</div>';
    const connected=await connectOneDriveForArchive(true);
    if(connected) await refreshArchive();
    return;
  }
  await refreshArchive();
}

async function connectOneDriveForArchive(interactive=false) {
  try {
    const state=await prepareAuth();
    if(!state.configured) {
      setArchiveNote('Add your Microsoft Client ID in Settings to access the OneDrive archive.','settings');
      if(interactive) openSettings('archiveView');
      return false;
    }
    account=state.account||authApi?.getAccount()||account;
    if(!account && interactive) account=await authApi.signIn();
    if(!account) {
      setArchiveNote('Sign in to view people saved in the shared OneDrive folder.','connect');
      return false;
    }
    await loadCloudApis();
    await graphApi.getDrive();
    baseFolder=oneDriveApi.getSavedBaseFolder();
    if(!baseFolder?.id) {
      if(interactive) await openFolderSetup('archiveView');
      else setArchiveNote('Choose the shared OneDrive folder to include its people in the archive.','connect');
      return false;
    }
    await graphApi.listChildren(baseFolder.id);
    return true;
  } catch(error) {
    setArchiveNote(`OneDrive archive could not be loaded: ${error.message}`,'connect');
    if(interactive) toast(error.message,true);
    return false;
  }
}

async function connectOneDriveFromArchive() {
  if($('archiveConnectOneDriveButton').dataset.action==='settings') {
    openSettings('archiveView');
    return;
  }
  const connected=await connectOneDriveForArchive(true);
  if(connected) {
    if(currentArchiveSource==='all') await refreshArchive();
    else { currentArchiveSource='onedrive'; updateArchiveTabs(); await refreshArchive(); }
  }
}

async function refreshArchive() {
  updateArchiveTabs();
  $('archiveList').innerHTML='<div class="loading-line">Loading saved records…</div>';
  setArchiveNote('');
  const phoneGroups=(currentArchiveSource==='phone'||currentArchiveSource==='all')
    ? await listLocalArchive() : [];
  const groupsByDate=new Map();
  const addGroups=(groups,source)=>{
    for(const group of groups||[]) {
      const existing=groupsByDate.get(group.date)||[];
      for(const student of group.students||[]) existing.push({...student,source:student.source||source});
      groupsByDate.set(group.date,existing);
    }
  };
  addGroups(phoneGroups,'phone');

  if(currentArchiveSource==='phone') {
    setArchiveNote('Phone archive shows records saved by this app in this browser on this device. It does not include files copied into a phone folder outside the app.');
  }

  if(currentArchiveSource==='onedrive') {
    const connected=await connectOneDriveForArchive(false);
    if(!connected) {
      currentArchive=[];
      renderArchive();
      return;
    }
    addGroups(await oneDriveApi.listArchive(baseFolder),'onedrive');
    setArchiveNote('Live OneDrive archive. Changes made in OneDrive appear after Refresh. Delete the full student folder to remove that person.');
  } else if(currentArchiveSource==='all') {
    try {
      const cloud=await getCachedOneDriveArchive();
      if(cloud.connected) {
        addGroups(cloud.groups,'onedrive');
        setArchiveNote('All sources combines this phone’s local records with the shared OneDrive archive. Refresh to check for cloud changes.');
      }
      else if(cloud.needsFolder) setArchiveNote('Phone records are shown. Choose a OneDrive folder to include shared cloud records.','connect');
      else {
        const clientId=getConfiguredClientId();
        setArchiveNote(clientId&&!clientId.includes('PASTE_')?'Phone records are shown. Connect OneDrive to include shared records from your other phones.':'Phone records are shown. Add your Microsoft Client ID to include OneDrive records.','settings');
      }
    } catch(error) {
      setArchiveNote(`Phone records are shown. OneDrive could not be refreshed: ${error.message}`,'connect');
    }
  }
  currentArchive=[...groupsByDate.entries()]
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .map(([date,students])=>({date,id:date,students:students.sort((a,b)=>a.name.localeCompare(b.name))}));
  renderArchive();
}

function renderArchive() {
  const term=$('archiveSearch').value.trim().toLowerCase();
  let html='';
  const now=new Date(); const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  for(const group of currentArchive) {
    const matches=group.students.filter(s=>s.name.toLowerCase().includes(term));
    if(term && !matches.length)continue;
    const open=!!term || group.date===today;
    html+=`<details class="date-group" ${open?'open':''}><summary><span>${humanDate(group.date)}</span><b>${matches.length} ${matches.length===1?'person':'people'}</b></summary><div class="date-records">${matches.map(s=>`<button class="record-row" data-student-folder="${escapeAttr(s.folderId)}" data-student-name="${escapeAttr(s.name)}" data-student-source="${s.source||'onedrive'}"><span class="record-avatar">${escapeHtml(s.name[0].toUpperCase())}</span><span class="record-copy"><strong>${escapeHtml(s.name)}</strong><small>${s.source==='phone'?'Phone':'OneDrive'} · ${escapeHtml(s.folderName)}</small></span><span>›</span></button>`).join('')}</div></details>`;
  }
  $('archiveList').innerHTML=html||'<div class="empty-state">No matching people found in this source.</div>';
  $('archiveList').querySelectorAll('[data-student-folder]').forEach(b=>b.addEventListener('click',()=>openArchivedStudent(b.dataset.studentFolder,b.dataset.studentName,b.dataset.studentSource)));
}

async function openArchivedStudent(folderId,name,source='onedrive') {
  const phoneSource=source==='phone';
  const files=phoneSource?await listLocalStudentDocuments(folderId):await oneDriveApi.listStudentDocuments(folderId);
  savedDocs=phoneSource?files:files.map(x=>({name:x.name,size:x.size,webUrl:x.webUrl}));
  $('activeStudentName').textContent=name;
  $('activeStudentMeta').textContent=phoneSource?'Saved on this phone':'Saved in OneDrive archive';
  $('documentChecklist').innerHTML='';$('documentCount').textContent=`${files.length} saved`;
  $('savedDocsList').innerHTML=phoneSource?files.map(f=>`<div class="record-row"><span class="record-avatar">${f.name.endsWith('.pdf')?'PDF':'JPG'}</span><span class="record-copy"><strong>${escapeHtml(f.name)}</strong><small>${formatBytes(f.size)} · Saved on this phone</small></span><button class="text-btn" data-download-doc="${escapeAttr(f.name)}">Download</button></div>`).join('')||'<div class="empty-state">No documents found for this student.</div>':files.map(f=>`<a class="record-row file-link" href="${f.webUrl}" target="_blank" rel="noopener"><span class="record-avatar">${f.name.endsWith('.pdf')?'PDF':'JPG'}</span><span class="record-copy"><strong>${escapeHtml(f.name)}</strong><small>${formatBytes(f.size)}</small></span><span>↗</span></a>`).join('')||'<div class="empty-state">No documents found for this student.</div>';
  const localRecord=phoneSource?await getLocalStudentRecord(folderId):null;
  activeStudent=phoneSource?{...localRecord,folderId,id:folderId,local:true,storage:'phone'}:{folderId,id:folderId,name,documents:[],storage:'onedrive'};
  showView('documentsView');
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
        $('cropInstructions').textContent='Adjust the crop for this image. Confirm to continue to the next image.';
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
