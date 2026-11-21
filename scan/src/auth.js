import { PublicClientApplication, BrowserCacheLocation, InteractionRequiredAuthError } from '@azure/msal-browser';
import { CONFIG } from './config.js';

let msal;
let account = null;

export async function initializeAuth() {
  if (!CONFIG.clientId || CONFIG.clientId.includes('PASTE_')) return { configured: false, account: null };
  msal = new PublicClientApplication({
    auth: {
      clientId: CONFIG.clientId,
      authority: CONFIG.authority,
      redirectUri: CONFIG.redirectUri,
      postLogoutRedirectUri: CONFIG.redirectUri,
      navigateToLoginRequestUrl: true
    },
    cache: { cacheLocation: BrowserCacheLocation.LocalStorage, storeAuthStateInCookie: false },
    system: { allowRedirectInIframe: false }
  });
  await msal.initialize();
  const redirectResult = await msal.handleRedirectPromise();
  account = redirectResult?.account || msal.getActiveAccount() || msal.getAllAccounts()[0] || null;
  if (account) msal.setActiveAccount(account);
  return { configured: true, account };
}

export async function signIn() {
  if (!msal) throw new Error('Microsoft sign-in is not configured. Add the Client ID in src/config.js first.');
  const result = await msal.loginPopup({ scopes: CONFIG.scopes, prompt: 'select_account' });
  account = result.account;
  msal.setActiveAccount(account);
  return account;
}

export async function getAccessToken() {
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
