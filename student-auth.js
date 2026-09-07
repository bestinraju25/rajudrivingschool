(function () {
  const message = document.getElementById('authMessage');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const tabs = document.querySelectorAll('.auth-tab');
  const forgot = document.getElementById('forgotPassword');

  function configured() {
    return window.RAJU_SUPABASE_URL && window.RAJU_SUPABASE_ANON_KEY &&
      !window.RAJU_SUPABASE_URL.includes('YOUR-PROJECT') && !window.RAJU_SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  }
  function show(text, type = '') { message.textContent = text; message.className = 'auth-message ' + type; }
  function setTab(tab) {
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    loginForm.classList.toggle('active', tab === 'login');
    signupForm.classList.toggle('active', tab === 'signup');
    show('');
  }
  tabs.forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  if (!configured()) {
    show('Supabase is not configured yet. Add your project URL and publishable/anon key to student-config.js.', 'error');
    return;
  }
  if (!window.supabase?.createClient) { show('The authentication service could not be loaded. Please refresh and try again.', 'error'); return; }
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);

  client.auth.getSession().then(({ data }) => { if (data.session) window.location.href = '../student-dashboard/'; });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm), email = fd.get('email').trim(), password = fd.get('password');
    if (!email || !password) return show('Please enter your email and password.', 'error');
    const button = loginForm.querySelector('.auth-submit'); button.disabled = true; show('Signing you in…');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { show(error.message, 'error'); button.disabled = false; return; }
    window.location.href = '../student-dashboard/';
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(signupForm);
    const full_name = fd.get('full_name').trim(), phone = fd.get('phone').trim(), email = fd.get('email').trim();
    const password = fd.get('password'), confirm = fd.get('confirm_password');
    if (password !== confirm) return show('Passwords do not match.', 'error');
    if (!fd.get('terms')) return show('Please accept the account terms to continue.', 'error');
    const button = signupForm.querySelector('.auth-submit'); button.disabled = true; show('Creating your student account…');
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name, phone } } });
    if (error) { show(error.message, 'error'); button.disabled = false; return; }
    if (data.session) {
      window.location.href = '../student-dashboard/';
    } else {
      show('Account created. Please check your email to confirm your account, then log in.', 'success');
      signupForm.reset(); setTab('login');
    }
  });

  forgot.addEventListener('click', async () => {
    const email = new FormData(loginForm).get('email')?.trim();
    if (!email) return show('Enter your email address first, then tap “Forgot your password?”.', 'error');
    const redirectTo = window.location.origin + '/student/reset-password.html';
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return show(error.message, 'error');
    show('Password reset instructions have been sent to your email.', 'success');
  });
})();
