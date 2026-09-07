(async function () {
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const msg = document.getElementById('dashboardMessage');
  const show = (t, c='') => { msg.textContent=t; msg.className='auth-message dashboard-message '+c; };
  const { data: { session } } = await client.auth.getSession();
  if (!session) { window.location.href='../student/'; return; }
  const { data: profile, error } = await client.from('student_profiles').select('full_name, phone, email').eq('id', session.user.id).single();
  if (error) { show('Your account is signed in, but the student profile could not be loaded. Please check the Supabase database setup.', 'error'); }
  const name = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Student';
  document.getElementById('studentName').textContent = name.split(' ')[0];
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileEmail').textContent = profile?.email || session.user.email || '—';
  document.getElementById('profilePhone').textContent = profile?.phone || session.user.user_metadata?.phone || '—';
  document.getElementById('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); window.location.href='../student/'; });
  client.auth.onAuthStateChange((_event, nextSession) => { if (!nextSession) window.location.href='../student/'; });
})();
