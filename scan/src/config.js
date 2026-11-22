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
  return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || CONFIG.clientId;
}

export function storeConfiguredClientId(value) {
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, value.trim());
}
