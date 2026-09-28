/** Auth0 Post Login Action. Roles and tenancy must never be added here. */
exports.onExecutePostLogin = async (event, api) => {
  const userId = event.user.app_metadata?.bibendia_user_id;
  if (typeof userId === 'string') api.idToken.setCustomClaim('https://bibendia.com/user_id', userId);
};
