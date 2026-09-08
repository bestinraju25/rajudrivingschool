(async function () {
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const msg = document.getElementById('dashboardMessage');
  const show = (text, type = '') => { msg.textContent = text; msg.className = 'notice ' + type; };
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = iso => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const esc = s => String(s ?? '').replace(/[&<>\'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));

  const { data: { session } } = await client.auth.getSession();
  if (!session) { location.href = '../student/'; return; }

  let profile = null;
  let instructors = [];

  async function loadProfile() {
    const { data, error } = await client.from('student_profiles')
      .select('full_name,phone,email,date_of_birth,blood_group,address,pincode,applying_for,course,total_course_fee,student_status')
      .eq('id', session.user.id).single();
    if (error) throw error;
    profile = data;
    const name = profile.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Student';
    document.getElementById('studentName').textContent = name.split(' ')[0];
    document.getElementById('profileName').textContent = name;
    document.getElementById('profileEmail').textContent = profile.email || session.user.email || '—';
    document.getElementById('profilePhone').textContent = profile.phone || '—';
    document.getElementById('profileDob').textContent = profile.date_of_birth || '—';
    document.getElementById('profileBloodGroup').textContent = profile.blood_group || '—';
    document.getElementById('profileApplyingFor').textContent = profile.applying_for || '—';
    document.getElementById('profilePincode').textContent = profile.pincode || '—';
    document.getElementById('profileAddress').textContent = profile.address || '—';
    document.getElementById('profileCourse').textContent = profile.course || '—';
    document.getElementById('profileStatus').textContent = profile.student_status || 'active';
    document.getElementById('totalCourseFee').textContent = money(profile.total_course_fee);
  }

  async function loadInstructors() {
    const { data, error } = await client.from('instructors').select('id,name,active').eq('active', true).order('name');
    if (error) throw error;
    instructors = data || [];
    const select = document.getElementById('preferredInstructor');
    select.innerHTML = '<option value="">Any available instructor</option>' + instructors.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
  }

  async function loadFees() {
    const { data, error } = await client.from('student_payments')
      .select('amount,payment_date,payment_method,receipt_number,notes,booking_id')
      .eq('student_id', session.user.id).order('payment_date', { ascending: false });
    if (error) throw error;
    const paid = (data || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    document.getElementById('totalPaid').textContent = money(paid);
    document.getElementById('balanceDue').textContent = money(Math.max(0, Number(profile?.total_course_fee || 0) - paid));
    const root = document.getElementById('paymentList');
    if (!data?.length) { root.innerHTML = '<div class="empty">No payments have been recorded yet.</div>'; return; }
    root.innerHTML = `<table class="payment-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Note</th></tr></thead><tbody>${data.map(p => `<tr><td>${esc(p.payment_date)}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method || '—')}</td><td>${esc(p.receipt_number || '—')}</td><td>${esc(p.notes || '')}</td></tr>`).join('')}</tbody></table>`;
  }

  async function loadBlocks() {
    const { data, error } = await client.from('instructor_availability')
      .select('instructor_id,start_at,end_at,availability_type,reason,instructors(name)')
      .in('availability_type', ['unavailable','leave','blocked']);
    if (error) throw error;
    return data || [];
  }

  async function loadBookings() {
    const { data, error } = await client.from('bookings')
      .select('id,start_at,end_at,duration_minutes,status,fee_amount,admin_notes,instructor_id,preferred_instructor_id,instructors:instructor_id(name),preferred:preferred_instructor_id(name)')
      .eq('student_id', session.user.id).order('start_at', { ascending: false });
    if (error) throw error;
    const root = document.getElementById('bookingList');
    if (!data?.length) { root.innerHTML = '<div class="empty">No class booking requests yet. Your first booking can be made above.</div>'; return; }
    root.innerHTML = data.map(b => `<div class="booking-row">
      <div><strong>${fmt(b.start_at)}</strong><small>${b.duration_minutes} minutes · ${esc(b.instructors?.name || 'Instructor to be assigned')}${b.preferred?.name ? ` · Preferred: ${esc(b.preferred.name)}` : ''}</small></div>
      <div><span class="status-pill status-${esc(b.status)}">${esc(b.status.replaceAll('_',' '))}</span><small>${b.fee_amount ? money(b.fee_amount) : 'Fee to be confirmed'}</small></div>
      <div>${b.status === 'pending' ? `<button class="booking-btn secondary cancel-booking" data-id="${b.id}">Cancel</button>` : ''}</div>
    </div>`).join('');
    root.querySelectorAll('.cancel-booking').forEach(btn => btn.onclick = async () => {
      if (!confirm('Cancel this booking request?')) return;
      const { error } = await client.from('bookings').update({ status: 'cancelled' }).eq('id', btn.dataset.id).eq('student_id', session.user.id).eq('status', 'pending');
      if (error) show(error.message, 'error'); else { show('Booking request cancelled.', 'success'); loadBookings(); }
    });
  }

  function localDateTimeToISO(value) { return new Date(value).toISOString(); }

  document.getElementById('bookingForm').onsubmit = async e => {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      const startValue = document.getElementById('requestedStart').value;
      const duration = Number(document.getElementById('durationMinutes').value);
      if (!startValue) throw new Error('Choose a date and time.');
      const start = new Date(startValue);
      const end = new Date(start.getTime() + duration * 60000);
      if (start <= new Date()) throw new Error('Please choose a future time.');
      if (start.getHours() < 6 || start.getHours() > 20) throw new Error('Please choose a class start time between 6:00 AM and 8:00 PM.');

      // Check visible blocks before submitting. Database rules remain the final protection.
      const blocks = await loadBlocks();
      const preferred = document.getElementById('preferredInstructor').value || null;
      const overlap = preferred && blocks.some(b => b.instructor_id === preferred && new Date(b.start_at) < end && new Date(b.end_at) > start);
      if (overlap) throw new Error('The selected time is blocked for the preferred instructor. Choose another time or select Any available instructor.');

      const { error } = await client.from('bookings').insert({
        student_id: session.user.id,
        instructor_id: null,
        preferred_instructor_id: preferred,
        start_at: localDateTimeToISO(startValue),
        end_at: end.toISOString(),
        duration_minutes: duration,
        status: 'pending',
        fee_amount: 0,
        student_note: document.getElementById('studentNote').value.trim() || null,
        admin_notes: null
      });
      if (error) throw error;
      show('Booking request submitted. The school will assign an instructor and approve it after fee collection.', 'success');
      e.target.reset();
      loadBookings();
    } catch (err) { show(err.message || 'Could not create the booking.', 'error'); }
    finally { button.disabled = false; }
  };

  document.getElementById('logoutBtn').onclick = async () => { await client.auth.signOut(); location.href = '../student/'; };
  document.getElementById('refreshBtn').onclick = async () => { try { await Promise.all([loadBookings(), loadFees()]); show('Dashboard refreshed.', 'success'); } catch (e) { show(e.message, 'error'); } };

  try {
    await Promise.all([loadProfile(), loadInstructors()]);
    await Promise.all([loadBookings(), loadFees()]);
    const min = new Date(Date.now() + 60 * 60 * 1000);
    min.setMinutes(Math.ceil(min.getMinutes() / 30) * 30, 0, 0);
    document.getElementById('requestedStart').min = min.toISOString().slice(0, 16);
  } catch (e) { show(e.message || 'Could not load your student dashboard.', 'error'); }
  client.auth.onAuthStateChange((_event, s) => { if (!s) location.href = '../student/'; });
})();
