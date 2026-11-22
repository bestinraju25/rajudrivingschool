const DB_NAME = 'roviaw-phone-scanner-v1';
const DB_VERSION = 1;
const STORES = { students: 'students', documents: 'documents', settings: 'settings' };
let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  const opening = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (cause) {
      reject(new Error(cause?.name === 'SecurityError'
        ? 'The browser has blocked website storage. Open the scanner in a normal tab and allow site data.'
        : 'This browser could not open phone storage. Allow website storage or use OneDrive.'));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.students)) db.createObjectStore(STORES.students, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.documents)) db.createObjectStore(STORES.documents, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { try { db.close(); } catch { /* ignore */ } dbPromise = null; };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      const cause = request.error;
      const message = cause?.name === 'QuotaExceededError'
        ? 'Phone storage is full. Free some space or switch to OneDrive.'
        : 'The browser could not open phone storage. Use a normal browser tab, allow website storage, and avoid private/incognito mode.';
      reject(new Error(message));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('Phone storage is busy in another scanner tab. Close other scanner tabs and try again.'));
    };
  });
  dbPromise = opening.catch(error => { dbPromise = null; throw error; });
  return dbPromise;
}

async function requestStore(storeName, mode, operation) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(storeName, mode); }
    catch (error) { reject(error); return; }
    const store = tx.objectStore(storeName);
    let result = null;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Phone storage operation failed.'));
    tx.onabort = () => reject(tx.error || new Error('Phone storage operation was cancelled.'));
    try {
      const request = operation(store);
      if (request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error || new Error('Phone storage operation failed.'));
      }
    } catch (error) {
      try { tx.abort(); } catch { /* transaction may already be closed */ }
      reject(error);
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
export async function getPhoneSetting(key) {
  const setting = await get(STORES.settings, key);
  return setting?.value ?? null;
}
export async function savePhoneSetting(key, value) {
  await put(STORES.settings, { key, value });
}
export async function deletePhoneSetting(key) {
  await requestStore(STORES.settings, 'readwrite', store => store.delete(key));
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
    groups.get(s.date).push({ id: s.id, folderId: s.id, folderName: s.folderName, name: s.name, mobile: s.mobile || '', address: s.address || '', source: 'phone' });
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

export async function updateLocalStudentRecord(studentId, details) {
  const record = await get(STORES.students, studentId);
  if (!record) throw new Error('This phone record could not be found. Refresh the archive and try again.');
  record.name = String(details.name || '').trim();
  record.mobile = String(details.mobile || '').trim();
  record.address = String(details.address || '').trim();
  record.updatedAt = new Date().toISOString();
  await put(STORES.students, record);
  await writeDirectoryFile([record.date, record.folderName], 'student.json', new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  return { ...record, folderId: record.id, local: true };
}

export async function deleteLocalStudentRecord(studentId) {
  const record = await get(STORES.students, studentId);
  const db = await openDb();
  const docs = await getAll(STORES.documents);
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.students, STORES.documents], 'readwrite');
    tx.objectStore(STORES.students).delete(studentId);
    for (const doc of docs) if (doc.studentId === studentId) tx.objectStore(STORES.documents).delete(doc.key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Could not delete the phone record.'));
    tx.onabort = () => reject(tx.error || new Error('Phone record deletion was cancelled.'));
  });
  let directoryCopyRemoved = null;
  if (record) {
    const root = await getPhoneDirectoryHandle();
    if (root && record.date && record.folderName && root.removeEntry) {
      try {
        const dateDir = await root.getDirectoryHandle(record.date);
        await dateDir.removeEntry(record.folderName, { recursive: true });
        directoryCopyRemoved = true;
      } catch (error) {
        directoryCopyRemoved = error.name === 'NotFoundError';
        if (!directoryCopyRemoved) console.warn('The app record was deleted, but the selected phone folder copy could not be removed.', error);
      }
    }
  }
  return { directoryCopyRemoved };
}
