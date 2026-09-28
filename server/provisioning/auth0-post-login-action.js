/** Auth0 Post Login Action. Roles and tenancy must never be added here. */
exports.onExecutePostLogin = async (event, api) => {
  const platformClientId = event.secrets?.PLATFORM_CLIENT_ID;
  if (typeof platformClientId !== 'string' || platformClientId.length === 0) {
    api.access.deny('BibendIA Platform client is not configured');
    return;
  }
  if (event.client.client_id === platformClientId) {
    api.multifactor.enable('any', { allowRememberBrowser: false });
  }
  const userId = event.user.app_metadata?.bibendia_user_id;
  if (typeof userId === 'string') api.idToken.setCustomClaim('https://bibendia.com/user_id', userId);
};
