(function () {
  const LOGIN_PATH = '/student/';
  const client = window.supabase?.createClient?.(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const currentPath = window.location.pathname + window.location.search + window.location.hash;

  function goToLogin() {
    const target = currentPath.startsWith('/') ? currentPath : '/';
    window.location.replace(LOGIN_PATH + '?redirect=' + encodeURIComponent(target));
  }

  if (!client) {
    goToLogin();
    return;
  }

  client.auth.getSession().then(({ data }) => {
    if (!data.session) {
      goToLogin();
      return;
    }
    document.documentElement.classList.add('student-auth-ready');
  }).catch(goToLogin);

  client.auth.onAuthStateChange((_event, session) => {
    if (!session) goToLogin();
  });
})();
