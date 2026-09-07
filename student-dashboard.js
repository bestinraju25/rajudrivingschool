(async function () {
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const msg = document.getElementById('dashboardMessage');
  const show = (t, c='') => { msg.textContent=t; msg.className='auth-message dashboard-message '+c; };
  const { data: { session } } = await client.auth.getSession();
  if (!session) { window.location.href='../student/'; return; }

  const { data: profile, error: profileError } = await client
    .from('student_profiles')
    .select('full_name, phone, email, license_category, course, student_status')
    .eq('id', session.user.id)
    .single();

  if (profileError) show('Your account is signed in, but your student profile could not be loaded.', 'error');

  const name = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Student';
  document.getElementById('studentName').textContent = name.split(' ')[0];
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileEmail').textContent = profile?.email || session.user.email || '—';
  document.getElementById('profilePhone').textContent = profile?.phone || session.user.user_metadata?.phone || '—';
  document.getElementById('profileCourse').textContent = profile?.course || 'Not assigned yet';
  document.getElementById('profileCategory').textContent = profile?.license_category || 'Not assigned yet';
  document.getElementById('profileStatus').textContent = profile?.student_status || 'Active';

  const { data: attempts, error: attemptsError } = await client
    .from('student_mock_test_results')
    .select('id, language, score, total_questions, pass_mark, passed, completed_at')
    .eq('student_id', session.user.id)
    .order('completed_at', { ascending: false })
    .limit(20);

  if (attemptsError) {
    document.getElementById('attemptsList').innerHTML = '<div class="dashboard-empty">Your mock-test history is not available yet. Run the student-learning SQL migration in Supabase, then try again.</div>';
  } else {
    const list = attempts || [];
    document.getElementById('attemptCount').textContent = list.length;
    const best = list.length ? Math.max(...list.map(a => Number(a.score))) : null;
    document.getElementById('bestScore').textContent = best === null ? '—' : `${best}/30`;
    document.getElementById('lastScore').textContent = list.length ? `${list[0].score}/${list[0].total_questions}` : '—';
    const passed = list.filter(a => a.passed).length;
    document.getElementById('passRate').textContent = list.length ? `${Math.round((passed/list.length)*100)}%` : '—';

    const formatDate = value => new Intl.DateTimeFormat('en-IN', {dateStyle:'medium', timeStyle:'short'}).format(new Date(value));
    const langName = value => value === 'malayalam' ? 'Malayalam' : 'English';
    document.getElementById('attemptsList').innerHTML = list.length ? list.map(a => `
      <div class="dashboard-attempt">
        <div class="dashboard-attempt-main"><strong>${langName(a.language)} mock test</strong><span>${formatDate(a.completed_at)} · Pass mark ${a.pass_mark}/${a.total_questions}</span></div>
        <div class="dashboard-attempt-score ${a.passed ? 'pass' : 'fail'}">${a.score}/${a.total_questions}</div>
        <div class="dashboard-attempt-badge ${a.passed ? 'pass' : ''}">${a.passed ? 'PASSED' : 'KEEP PRACTISING'}</div>
      </div>`).join('') : '<div class="dashboard-empty">No mock tests yet. Take your first test from the Mock Test card above and your score will appear here.</div>';
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); window.location.href='../student/'; });
  client.auth.onAuthStateChange((_event, nextSession) => { if (!nextSession) window.location.href='../student/'; });
  document.documentElement.classList.add('student-dashboard-ready');
})();
