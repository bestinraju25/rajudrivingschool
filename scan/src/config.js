// Microsoft Entra app registration Client ID. This is a public identifier, NOT a secret.
// Register a Single-page application (SPA) and add:
// https://www.rajudrivingschool.com/scan/
// http://localhost:5173/scan/ (local testing only)
export const CONFIG = {
  clientId: 'PASTE_MICROSOFT_CLIENT_ID_HERE',
  authority: 'https://login.microsoftonline.com/consumers',
  redirectUri: `${window.location.origin}/scan/`,
  scopes: ['User.Read', 'Files.ReadWrite'],
  graphBase: 'https://graph.microsoft.com/v1.0'
};
