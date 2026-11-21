import { createFolder, listChildren, uploadFile } from './graph.js';

const BASE_KEY = 'roviaw_cloud_base_folder_v1';
const DEVICE_KEY = 'roviaw_cloud_device_id_v1';
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const safeName = value => value.trim().replace(/[\\/:*?"<>|#%{}~]/g, '-').replace(/\s+/g, ' ').slice(0, 70) || 'Unnamed';
const shortId = value => value.replace(/-/g, '').slice(0, 8).toUpperCase();

export function getSavedBaseFolder() {
  try { return JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); } catch { return null; }
}
export function saveBaseFolder(folder) { localStorage.setItem(BASE_KEY, JSON.stringify(folder)); }
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

export async function createStudentRecord(baseFolder, details) {
  const id = crypto.randomUUID();
  const date = todayKey();
  const dateFolder = await createFolder(baseFolder.id, date);
  const folderName = `${safeName(details.name)}__${shortId(id)}`;
  const studentFolder = await createFolder(dateFolder.id, folderName);
  const record = {
    id, name: details.name.trim(), mobile: details.mobile.trim(), address: details.address.trim(),
    createdAt: new Date().toISOString(), date, deviceId: getDeviceId(), documents: []
  };
  await uploadFile(studentFolder.id, 'student.json', new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  return { ...record, folderId: studentFolder.id, folderName, dateFolderId: dateFolder.id };
}

export async function saveStudentDocument(student, filename, blob, onProgress) {
  const result = await uploadFile(student.folderId, filename, blob, onProgress);
  return { name: filename, size: blob.size, webUrl: result.webUrl || null, id: result.id || null, savedAt: new Date().toISOString() };
}

export async function saveStudentManifest(student, documents) {
  const record = {
    id: student.id, name: student.name, mobile: student.mobile, address: student.address,
    createdAt: student.createdAt, date: student.date, deviceId: student.deviceId,
    documents
  };
  await uploadFile(student.folderId, 'student.json', new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
}

export async function listArchive(baseFolder) {
  const children = await listChildren(baseFolder.id);
  const dateFolders = children.filter(x => x.folder && /^\d{4}-\d{2}-\d{2}$/.test(x.name)).sort((a,b) => b.name.localeCompare(a.name));
  const result = [];
  for (const dateFolder of dateFolders) {
    const students = (await listChildren(dateFolder.id)).filter(x => x.folder).sort((a,b) => a.name.localeCompare(b.name));
    result.push({ date: dateFolder.name, id: dateFolder.id, students: students.map(s => ({ id:s.id, folderId:s.id, folderName:s.name, name:s.name.replace(/__[A-F0-9]{8}$/i,'') })) });
  }
  return result;
}

export async function listStudentDocuments(studentFolderId) {
  return (await listChildren(studentFolderId)).filter(x => x.file && x.name !== 'student.json');
}

export async function createNamedDocumentFolder(student, name) {
  return createFolder(student.folderId, safeName(name));
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
