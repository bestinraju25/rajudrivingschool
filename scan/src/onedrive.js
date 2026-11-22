import { createFolder, listChildren, uploadFile, getFileText, updateItem, deleteItem } from './graph.js';

const BASE_KEY = 'roviaw_cloud_base_folder_v1';
const DEVICE_KEY = 'roviaw_cloud_device_id_v1';
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const safeName = value => String(value || '').trim().replace(/[\\/:*?"<>|#%{}~]/g, '-').replace(/\s+/g, ' ').slice(0, 70) || 'Unnamed';
const shortId = value => String(value || '').replace(/-/g, '').slice(0, 8).toUpperCase();

export function getSavedBaseFolder() {
  try { return JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); } catch { return null; }
}
export function saveBaseFolder(folder) { try { localStorage.setItem(BASE_KEY, JSON.stringify(folder)); } catch { throw new Error('This browser could not remember the selected OneDrive folder. Enable site storage and select the folder again.'); } }
let memoryDeviceId = null;
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch {
    if (!memoryDeviceId) memoryDeviceId = crypto.randomUUID();
    return memoryDeviceId;
  }
}

export async function createStudentRecord(baseFolder, details) {
  const id = crypto.randomUUID();
  const date = todayKey();
  const dateFolder = await createFolder(baseFolder.id, date);
  const folderName = `${safeName(details.name)}__${shortId(id)}`;
  const studentFolder = await createFolder(dateFolder.id, folderName);
  const record = {
    id, name: details.name.trim(), mobile: (details.mobile || '').trim(), address: (details.address || '').trim(),
    createdAt: new Date().toISOString(), date, deviceId: getDeviceId(), documents: []
  };
  await uploadFile(studentFolder.id, 'student.json', new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  return { ...record, folderId: studentFolder.id, folderName, dateFolderId: dateFolder.id, storage: 'onedrive' };
}

export async function saveStudentDocument(student, filename, blob, onProgress) {
  const result = await uploadFile(student.folderId, filename, blob, onProgress);
  return { name: filename, size: blob.size, webUrl: result.webUrl || null, id: result.id || null, savedAt: new Date().toISOString() };
}

export async function saveStudentManifest(student, documents) {
  const record = {
    id: student.id || student.folderId, name: student.name, mobile: student.mobile || '', address: student.address || '',
    createdAt: student.createdAt || new Date().toISOString(), date: student.date || todayKey(), deviceId: student.deviceId || getDeviceId(),
    documents: documents.map(x => ({ name: x.name, size: x.size, savedAt: x.savedAt || new Date().toISOString() }))
  };
  await uploadFile(student.folderId, 'student.json', new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
}

export async function getStudentRecord(folderId, fallback = {}) {
  const items = await listChildren(folderId);
  const manifest = items.find(x => x.file && x.name.toLowerCase() === 'student.json');
  let record = {};
  if (manifest) {
    try { record = JSON.parse(await getFileText(manifest.id)); }
    catch (error) { console.warn('Could not parse the OneDrive student manifest; using folder details.', error); }
  }
  const folder = fallback.folderName || fallback.name || 'Student';
  return {
    ...fallback,
    ...record,
    id: record.id || fallback.id || folderId,
    folderId,
    folderName: folder,
    name: record.name || fallback.name || folder.replace(/__[A-F0-9]{8}$/i, ''),
    mobile: record.mobile ?? fallback.mobile ?? '',
    address: record.address ?? fallback.address ?? '',
    date: record.date || fallback.date || todayKey(),
    storage: 'onedrive'
  };
}

export async function updateStudentRecord(student, details) {
  const current = await getStudentRecord(student.folderId, student);
  const updated = {
    ...current,
    name: String(details.name || '').trim(),
    mobile: String(details.mobile || '').trim(),
    address: String(details.address || '').trim(),
    updatedAt: new Date().toISOString(),
    documents: Array.isArray(current.documents) ? current.documents : []
  };
  const items = await listChildren(student.folderId);
  const manifest = items.find(x => x.file && x.name.toLowerCase() === 'student.json');
  if (!manifest) updated.id = crypto.randomUUID();

  // Rename first so the archive folder label is updated only after Graph confirms it.
  // If writing the manifest then fails, attempt to roll the folder name back.
  const suffix = (current.folderName || '').match(/__[A-F0-9]{8}$/i)?.[0] || `__${shortId(crypto.randomUUID())}`;
  const nextFolderName = `${safeName(updated.name)}${suffix}`;
  let renamedFolder = false;
  if (nextFolderName !== current.folderName) {
    const renamed = await updateItem(student.folderId, { name: nextFolderName });
    updated.folderName = renamed?.name || nextFolderName;
    renamedFolder = true;
  }
  try {
    await uploadFile(student.folderId, 'student.json', new Blob([JSON.stringify(updated, null, 2)], { type: 'application/json' }));
  } catch (error) {
    if (renamedFolder && current.folderName) {
      try { await updateItem(student.folderId, { name: current.folderName }); }
      catch (rollbackError) { console.warn('The student folder was renamed, but automatic rollback failed.', rollbackError); }
    }
    throw error;
  }
  return { ...updated, folderId: student.folderId, storage: 'onedrive' };
}

export async function deleteStudentRecord(folderId) {
  await deleteItem(folderId);
}

export async function listArchive(baseFolder) {
  const children = await listChildren(baseFolder.id);
  const dateFolders = children.filter(x => x.folder && /^\d{4}-\d{2}-\d{2}$/.test(x.name)).sort((a,b) => b.name.localeCompare(a.name));
  const groups = new Map();
  for (const dateFolder of dateFolders) {
    const folders = (await listChildren(dateFolder.id)).filter(x => x.folder).sort((a,b) => a.name.localeCompare(b.name));
    const students = folders.map(s => ({
      id: s.id, folderId: s.id, folderName: s.name,
      name: s.name.replace(/__[A-F0-9]{8}$/i,''), source: 'onedrive', date: dateFolder.name
    }));
    if (students.length) groups.set(dateFolder.name, students);
  }

  const looseFolders = children.filter(x => x.folder && !/^\d{4}-\d{2}-\d{2}$/.test(x.name) && x.name.toLowerCase() !== 'merged files');
  for (const folder of looseFolders) {
    const contents = await listChildren(folder.id);
    if (!contents.some(x => x.file && x.name.toLowerCase() !== 'student.json')) continue;
    const stamp = folder.createdDateTime || folder.lastModifiedDateTime;
    const date = stamp ? stamp.slice(0,10) : todayKey();
    const students = groups.get(date) || [];
    students.push({ id: folder.id, folderId: folder.id, folderName: folder.name, name: folder.name.replace(/__[A-F0-9]{8}$/i,''), source: 'onedrive', date });
    groups.set(date, students);
  }

  return [...groups.entries()]
    .sort((a,b) => b[0].localeCompare(a[0]))
    .map(([date, students]) => ({ date, id: date, students: students.sort((a,b) => a.name.localeCompare(b.name)) }));
}

export async function listStudentDocuments(studentFolderId) {
  return (await listChildren(studentFolderId)).filter(x => x.file && x.name.toLowerCase() !== 'student.json');
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
