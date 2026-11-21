import { initializeAuth, signIn, signOut, getAccount } from './auth.js';
import { getDrive, listChildren, createFolder, uploadFile } from './graph.js';
import { getSavedBaseFolder, saveBaseFolder, createStudentRecord, saveStudentDocument, saveStudentManifest, listArchive, listStudentDocuments, formatBytes } from './onedrive.js';
import { cropImage } from './image.js';
import { imagesToPdf } from './pdf.js';

const $ = id => document.getElementById(id);
const views = ['welcomeView','folderView','homeView','studentView','documentsView','archiveView','mergeView','settingsView'];
let account = null;
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

async function boot() {
  document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.back)));
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.nav)));
  document.querySelectorAll('[data-doc]').forEach(b=>b.addEventListener('click',()=>startDocument(b.dataset.doc)));
  $('signInButton').addEventListener('click',handleSignIn);
  $('changeFolderButton').addEventListener('click',openFolderSetup);
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
  $('settingsChangeFolder').addEventListener('click',openFolderSetup);
  $('signOutButton').addEventListener('click',async()=>{await signOut();localStorage.removeItem('roviaw_cloud_base_folder_v1');account=null;setCloudStatus('Not connected');showView('welcomeView');});
  $('mergeCreateButton').addEventListener('click',handleMergeFiles);
  $('cameraInput').addEventListener('change',e=>handleCapturedFiles(e.target.files,'camera'));
  $('fileInput').addEventListener('change',e=>handleCapturedFiles(e.target.files,'file'));
  $('captureClose').addEventListener('click',closeCaptureModal);
  $('cropClose').addEventListener('click',()=> $('cropModal').classList.remove('open'));
  $('documentChecklist').addEventListener('click',()=>{});

  try {
    const authState=await initializeAuth();
    if(!authState.configured) {
      $('signInButton').disabled=true;
      $('signInButton').textContent='Microsoft app setup required';
      toast('Add your Microsoft Client ID in scan/src/config.js before signing in.',true);
      showView('welcomeView'); return;
    }
    account=authState.account;
    if(!account){setCloudStatus('Not connected');showView('welcomeView');return;}
    await afterLogin();
  } catch(error) { toast(error.message,true); showView('welcomeView'); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/scan/sw.js').catch(()=>{});
}

async function handleSignIn() {
  try { account=await signIn(); await afterLogin(); }
  catch(error) { toast(error.message,true); }
}

async function afterLogin() {
  if(!account) account=getAccount();
  setCloudStatus('OneDrive connected',true);
  $('accountLabel').textContent=displayNameForAccount();
  try { await getDrive(); }
  catch(error) { setCloudStatus('OneDrive unavailable'); throw error; }
  baseFolder=getSavedBaseFolder();
  if(baseFolder?.id) {
    try { await listChildren(baseFolder.id); await showHome(); return; }
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
    const items=await listChildren(current.id);
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
  saveBaseFolder(baseFolder);
  showHome().catch(e=>toast(e.message,true));
}

async function showHome() {
  $('storageName').textContent=baseFolder?.name || 'OneDrive';
  $('storagePath').textContent=baseFolder?.path || 'OneDrive root';
  $('accountLabel').textContent=displayNameForAccount();
  showView('homeView');
  await refreshHome();
}

async function refreshHome() {
  if(!baseFolder)return;
  const groups=await listArchive(baseFolder);
  const recent=groups.flatMap(g=>g.students.map(s=>({...s,date:g.date}))).slice(0,5);
  $('recentList').innerHTML=recent.length?recent.map(s=>`<button class="record-row" data-folder="${s.folderId}"><span class="record-avatar">${escapeHtml(s.name.charAt(0).toUpperCase())}</span><span class="record-copy"><strong>${escapeHtml(s.name)}</strong><small>${humanDate(s.date)}</small></span><span>›</span></button>`).join(''):'<div class="empty-state">No students saved yet. Create your first customer.</div>';
  $('recentList').querySelectorAll('[data-folder]').forEach(b=>b.addEventListener('click',()=>openArchivedStudent(b.dataset.folder,b.querySelector('strong').textContent)));
}

async function handleCreateStudent() {
  const name=$('studentName').value.trim();
  if(!name){toast('Enter the student name.',true);$('studentName').focus();return;}
  if(!baseFolder){toast('Choose a OneDrive save location first.',true);return;}
  $('createStudentButton').disabled=true;
  showProgress('Creating student folder','Preparing date-wise OneDrive folder…',10);
  try {
    const student=await createStudentRecord(baseFolder,{name,mobile:$('studentMobile').value,address:$('studentAddress').value});
    activeStudent=student;savedDocs=[];
    $('studentName').value='';$('studentMobile').value='';$('studentAddress').value='';
    updateStudentHeader();renderStudentDocuments();
    hideProgress();showView('documentsView');toast('Student created successfully in OneDrive.');
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
  $('savedDocsList').innerHTML=savedDocs.length?savedDocs.map(x=>`<div class="record-row"><span class="record-avatar">${x.name.endsWith('.pdf')?'PDF':'JPG'}</span><span class="record-copy"><strong>${escapeHtml(x.name)}</strong><small>${formatBytes(x.size)} · Saved to OneDrive</small></span></div>`).join(''):'<div class="empty-state">No documents saved yet.</div>';
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
        const pdf=await imagesToPdf(state.files,layout?'separate':'single');
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
    const pdf=await imagesToPdf(state.files,'separate');
    await saveDocument(`${sanitizeFileName(state.name)}.pdf`,pdf);
  } catch(error) { hideProgress();toast(error.message,true); }
}

async function saveDocument(filename,blob) {
  showProgress(`Saving ${filename}`,'Uploading directly to OneDrive…',0);
  try {
    const saved=await saveStudentDocument(activeStudent,filename,blob,percent=>updateProgress(`Uploading ${filename}…`,percent));
    const index=savedDocs.findIndex(x=>x.name===filename);
    if(index>=0)savedDocs[index]=saved;else savedDocs.push(saved);
    await saveStudentManifest(activeStudent,savedDocs);
    updateProgress('Verifying file in OneDrive…',100);
    const items=await listChildren(activeStudent.folderId);
    if(!items.some(x=>x.name===filename && x.file))throw new Error('OneDrive did not confirm the saved file. Please retry.');
    renderStudentDocuments();hideProgress();toast(`${filename} saved successfully.`);
  } catch(error) { hideProgress();throw error; }
}

async function refreshStudentDocuments() {
  if(!activeStudent)return;
  const items=await listStudentDocuments(activeStudent.folderId);
  savedDocs=items.map(x=>({name:x.name,size:x.size,webUrl:x.webUrl}));renderStudentDocuments();
}

async function refreshArchive() {
  $('archiveList').innerHTML='<div class="loading-line">Loading OneDrive archive…</div>';
  currentArchive=await listArchive(baseFolder);renderArchive();
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
  const files=await listStudentDocuments(folderId);
  savedDocs=files.map(x=>({name:x.name,size:x.size,webUrl:x.webUrl}));
  $('activeStudentName').textContent=name;
  $('activeStudentMeta').textContent='Saved in OneDrive archive';
  $('documentChecklist').innerHTML='';$('documentCount').textContent=`${files.length} saved`;
  $('savedDocsList').innerHTML=files.map(f=>`<a class="record-row file-link" href="${f.webUrl}" target="_blank" rel="noopener"><span class="record-avatar">${f.name.endsWith('.pdf')?'PDF':'JPG'}</span><span class="record-copy"><strong>${escapeHtml(f.name)}</strong><small>${formatBytes(f.size)}</small></span><span>↗</span></a>`).join('')||'<div class="empty-state">No documents found for this student.</div>';
  activeStudent={folderId,id:folderId,name,documents:[]};showView('documentsView');
}

async function handleMergeFiles() {
  const files=Array.from($('mergeInput').files||[]);const name=sanitizeFileName($('mergeName').value||'Merged Files');
  if(!files.length){toast('Choose at least one image.',true);return;}
  showProgress('Creating PDF','Preparing selected images…',10);
  try {
    const pdf=await imagesToPdf(files,$('mergeLayout').value);
    const date=new Date().toISOString().slice(0,10);
    const mergeFolder=await createFolder(baseFolder.id,`Merged Files`);
    const dayFolder=await createFolder(mergeFolder.id,date);
    const outFolder=await createFolder(dayFolder.id,name+'__'+crypto.randomUUID().slice(0,8));
    await uploadFile(outFolder.id,`${name}.pdf`,pdf,p=>updateProgress('Uploading PDF to OneDrive…',p));
    hideProgress();toast('Merged PDF saved to OneDrive.');$('mergeInput').value='';$('mergeName').value='';
  } catch(error){hideProgress();toast(error.message,true);}
}

function fillSettings() {
  $('settingsAccount').textContent=displayNameForAccount();
  $('settingsPath').textContent=baseFolder?.path||'Not selected';
  const ua=navigator.userAgent; const label=/Android/i.test(ua)?'Android phone':/iPhone|iPad/i.test(ua)?'Apple mobile device':'Mobile browser';
  $('deviceLabel').textContent=label;
}
function sanitizeFileName(v){return v.trim().replace(/[\\/:*?"<>|#%{}~]/g,'-').replace(/\s+/g,' ').slice(0,70)||'Document';}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;');}

boot();
