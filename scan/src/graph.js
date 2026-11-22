import { CONFIG } from './config.js';
import { getAccessToken } from './auth.js';

async function graphRequest(pathOrUrl, options = {}) {
  const token = await getAccessToken();
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${CONFIG.graphBase}${pathOrUrl}`;
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof Blob) && !(options.body instanceof ArrayBuffer) && typeof options.body !== 'string') {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(url, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error?.message || `OneDrive request failed (${response.status}).`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function getDrive() { return graphRequest('/me/drive?$select=id,name,driveType'); }

export async function listChildren(parentId = 'root') {
  let url = parentId === 'root'
    ? `${CONFIG.graphBase}/me/drive/root/children?$select=id,name,folder,file,size,webUrl,lastModifiedDateTime,createdDateTime&$top=200`
    : `${CONFIG.graphBase}/me/drive/items/${encodeURIComponent(parentId)}/children?$select=id,name,folder,file,size,webUrl,lastModifiedDateTime,createdDateTime&$top=200`;
  const items = [];
  while (url) {
    const page = await graphRequest(url);
    items.push(...(page.value || []));
    url = page['@odata.nextLink'] || null;
  }
  return items;
}

export async function createFolder(parentId, name) {
  const existing = (await listChildren(parentId)).find(x => x.folder && x.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const path = parentId === 'root' ? '/me/drive/root/children' : `/me/drive/items/${encodeURIComponent(parentId)}/children`;
  try {
    return await graphRequest(path, {
      method: 'POST',
      body: { name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }
    });
  } catch (error) {
    // Two phones may create the same date folder simultaneously. Re-read after a conflict.
    const retry = (await listChildren(parentId)).find(x => x.folder && x.name.toLowerCase() === name.toLowerCase());
    if (retry) return retry;
    throw error;
  }
}

export async function uploadFile(parentId, name, blob, onProgress = () => {}) {
  const token = await getAccessToken();
  const safeName = encodeURIComponent(name);
  const url = parentId === 'root'
    ? `${CONFIG.graphBase}/me/drive/root:/${safeName}:/content`
    : `${CONFIG.graphBase}/me/drive/items/${encodeURIComponent(parentId)}:/${safeName}:/content`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error('Network error while uploading to OneDrive.'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ name, size: blob.size }); }
      } else {
        let message = `OneDrive upload failed (${xhr.status}).`;
        try { message = JSON.parse(xhr.responseText)?.error?.message || message; } catch { /* keep default */ }
        reject(new Error(message));
      }
    };
    xhr.send(blob);
  });
}

export async function deleteItem(itemId) {
  return graphRequest(`/me/drive/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
}
