import { PublicClientApplication, BrowserCacheLocation, InteractionRequiredAuthError } from '@azure/msal-browser';
import { CONFIG, getConfiguredClientId, storeConfiguredClientId } from './config.js';

let msal;
let account = null;
let activeClientId = '';

export async function initializeAuth() {
  const clientId = getConfiguredClientId();
  if (!clientId || clientId.includes('PASTE_')) {
    msal = null; account = null; activeClientId = '';
    return { configured: false, account: null, clientId };
  }
  if (msal && activeClientId === clientId) {
    return { configured: true, account: account || msal.getActiveAccount() || msal.getAllAccounts()[0] || null, clientId };
  }
  msal = new PublicClientApplication({
    auth: {
      clientId,
      authority: CONFIG.authority,
      redirectUri: CONFIG.redirectUri,
      postLogoutRedirectUri: CONFIG.redirectUri,
      navigateToLoginRequestUrl: true
    },
    cache: { cacheLocation: BrowserCacheLocation.LocalStorage, storeAuthStateInCookie: false },
    system: { allowRedirectInIframe: false }
  });
  activeClientId = clientId;
  await msal.initialize();
  const redirectResult = await msal.handleRedirectPromise();
  account = redirectResult?.account || msal.getActiveAccount() || msal.getAllAccounts()[0] || null;
  if (account) msal.setActiveAccount(account);
  return { configured: true, account, clientId };
}

export async function configureClientId(value) {
  const clientId = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    throw new Error('Enter a valid Microsoft Application (client) ID in GUID format.');
  }
  storeConfiguredClientId(clientId);
  // A different Client ID requires a new MSAL instance. Existing account cache is
  // retained under the old Client ID, but is not reused for this new configuration.
  msal = null;
  account = null;
  activeClientId = '';
  return initializeAuth();
}

export function getSavedClientId() { return getConfiguredClientId(); }

export async function signIn() {
  if (!msal) await initializeAuth();
  if (!msal) throw new Error('Microsoft sign-in is not configured. Enter the Client ID in Settings first.');
  const result = await msal.loginPopup({ scopes: CONFIG.scopes, prompt: 'select_account' });
  account = result.account;
  msal.setActiveAccount(account);
  return account;
}

export async function getAccessToken() {
  if (!msal) await initializeAuth();
  if (!msal) throw new Error('Microsoft sign-in is not configured.');
  account ||= msal.getActiveAccount() || msal.getAllAccounts()[0] || null;
  if (!account) throw new Error('Connect your OneDrive account first.');
  try {
    const result = await msal.acquireTokenSilent({ account, scopes: CONFIG.scopes });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError || error?.name === 'InteractionRequiredAuthError') {
      const result = await msal.acquireTokenPopup({ account, scopes: CONFIG.scopes });
      return result.accessToken;
    }
    throw error;
  }
}

export function getAccount() { return account; }

export async function signOut() {
  if (!msal || !account) return;
  await msal.logoutPopup({ account, postLogoutRedirectUri: CONFIG.redirectUri });
  account = null;
}
