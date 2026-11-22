// Public Microsoft Entra Application (client) ID. This is not a client secret.
// For all phones to use the same preconfigured ID, set it here and push the website.
// The Settings screen can also override it locally on the current browser/device.
export const CLIENT_ID_STORAGE_KEY = 'roviaw_microsoft_client_id_v1';
export const CONFIG = {
  clientId: 'PASTE_MICROSOFT_CLIENT_ID_HERE',
  authority: 'https://login.microsoftonline.com/consumers',
  redirectUri: `${window.location.origin}/scan/`,
  scopes: ['User.Read', 'Files.ReadWrite'],
  graphBase: 'https://graph.microsoft.com/v1.0'
};

export function getConfiguredClientId() {
  try { return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || CONFIG.clientId; }
  catch { return CONFIG.clientId; }
}

export function storeConfiguredClientId(value) {
  try { localStorage.setItem(CLIENT_ID_STORAGE_KEY, value.trim()); }
  catch { throw new Error('This browser is blocking site preferences. Enable website storage or use a normal browser tab before saving the Microsoft ID.'); }
}
