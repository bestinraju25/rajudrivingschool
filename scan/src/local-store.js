const DB_NAME = 'roviaw-phone-scanner-v1';
const DB_VERSION = 1;
const STORES = { students: 'students', documents: 'documents', settings: 'settings' };
let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.students)) db.createObjectStore(STORES.students, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.documents)) db.createObjectStore(STORES.documents, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open phone storage.'));
  });
  return dbPromise;
}

async function requestStore(storeName, mode, operation) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let request;
    try { request = operation(store); } catch (error) { reject(error); return; }
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Phone storage operation failed.'));
    } else {
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error || new Error('Phone storage operation failed.'));
    }
  });
}

const get = (store, key) => requestStore(store, 'readonly', s => s.get(key));
const getAll = store => requestStore(store, 'readonly', s => s.getAll());
const put = (store, value) => requestStore(store, 'readwrite', s => s.put(value));

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const safeName = value => value.trim().replace(/[\\/:*?"<>|#%{}~]/g, '-').replace(/\s+/g, ' ').slice(0, 70) || 'Unnamed';
const shortId = value => value.replace(/-/g, '').slice(0, 8).toUpperCase();

export async function savePhoneDirectoryHandle(handle) {
  await put(STORES.settings, { key: 'directoryHandle', value: handle, name: handle.name || 'Selected folder' });
}
export async function getPhoneDirectoryHandle() {
  const setting = await get(STORES.settings, 'directoryHandle');
  return setting?.value || null;
}

async function writeDirectoryFile(parts, filename, blob) {
  const root = await getPhoneDirectoryHandle();
  if (!root) return false;
  try {
    if (root.queryPermission && await root.queryPermission({ mode: 'readwrite' }) !== 'granted') return false;
    let current = root;
    for (const part of parts.filter(Boolean)) current = await current.getDirectoryHandle(part, { create: true });
    const fileHandle = await current.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    console.warn('Could not write directly to selected phone folder; saved in app storage instead.', error);
    return false;
  }
}

export async function createLocalStudentRecord(baseFolder, details) {
  const id = crypto.randomUUID();
  const date = todayKey();
  const folderName = `${safeName(details.name)}__${shortId(id)}`;
  const record = {
    id,
    name: details.name.trim(),
    mobile: (details.mobile || '').trim(),
    address: (details.address || '').trim(),
    createdAt: new Date().toISOString(),
    date,
    deviceId: 'this-phone',
    folderName,
    documents: [],
    storage: 'local'
  };
  await put(STORES.students, record);
  await writeDirectoryFile([date, folderName], 'student.json', new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  return { ...record, folderId: id, local: true };
}

export async function saveLocalStudentDocument(student, filename, blob) {
  const key = `${student.id}::${filename}`;
  const doc = { key, studentId: student.id, name: filename, size: blob.size, type: blob.type, blob, savedAt: new Date().toISOString() };
  await put(STORES.documents, doc);
  const record = await get(STORES.students, student.id);
  if (record) {
    record.documents = Array.isArray(record.documents) ? record.documents : [];
    const entry = { name: filename, size: blob.size, savedAt: doc.savedAt };
    const index = record.documents.findIndex(x => x.name === filename);
    if (index >= 0) record.documents[index] = entry; else record.documents.push(entry);
    await put(STORES.students, record);
  }
  const writtenToFolder = await writeDirectoryFile([student.date, student.folderName], filename, blob);
  doc.writtenToFolder = writtenToFolder;
  await put(STORES.documents, doc);
  return doc;
}

export async function saveLocalStudentManifest(student, documents) {
  const record = await get(STORES.students, student.id);
  if (!record) return;
  record.documents = documents.map(x => ({ name: x.name, size: x.size, savedAt: x.savedAt || new Date().toISOString() }));
  await put(STORES.students, record);
  await writeDirectoryFile([record.date, record.folderName], 'student.json', new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
}

export async function listLocalArchive() {
  const all = await getAll(STORES.students);
  const sorted = all.sort((a,b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const groups = new Map();
  for (const s of sorted) {
    if (!groups.has(s.date)) groups.set(s.date, []);
    groups.get(s.date).push({ id: s.id, folderId: s.id, folderName: s.folderName, name: s.name });
  }
  return [...groups.entries()].map(([date, students]) => ({ date, id: date, students }));
}

export async function getLocalStudentRecord(studentId) { return get(STORES.students, studentId); }

export async function listLocalStudentDocuments(studentId) {
  return (await getAll(STORES.documents)).filter(x => x.studentId === studentId).sort((a,b) => a.name.localeCompare(b.name));
}

export async function saveLocalMergedFile(filename, blob) {
  const id = crypto.randomUUID();
  const date = todayKey();
  const key = `merge:${id}`;
  await put(STORES.documents, { key, studentId: key, name: filename, size: blob.size, type: blob.type, blob, savedAt: new Date().toISOString(), category: 'merge' });
  const writtenToFolder = await writeDirectoryFile(['Merged Files', date], filename, blob);
  return { writtenToFolder, blob, filename };
}

export async function getLocalStorageSummary() {
  const students = await getAll(STORES.students);
  const directory = await getPhoneDirectoryHandle();
  return { studentCount: students.length, folderName: directory?.name || null };
}

export async function requestPersistentPhoneStorage() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* browser may not grant persistent storage */ }
  return false;
}
