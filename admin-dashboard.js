(async function () {
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const msg = document.getElementById('adminMessage');
  const show = (text, type = '') => { msg.textContent = text; msg.className = 'notice ' + type; };
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = iso => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const esc = s => String(s ?? '').replace(/[&<>\'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));

  const { data: { session } } = await client.auth.getSession();
  if (!session) { location.href = '../admin/'; return; }
  const { data: admin, error: adminError } = await client.from('admin_users').select('full_name,email').eq('id', session.user.id).eq('active', true).maybeSingle();
  if (adminError || !admin) { await client.auth.signOut(); location.href = '../admin/'; return; }
  document.getElementById('adminName').textContent = admin.full_name || admin.email || 'Admin';

  let instructors = [];

  async function loadInstructors() {
    const { data, error } = await client.from('instructors').select('id,name,active').order('name');
    if (error) throw error;
    instructors = data || [];
    document.getElementById('blockInstructor').innerHTML = instructors.filter(i => i.active).map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
  }

  async function loadSettings() {
    const { data, error } = await client.from('school_settings').select('hourly_class_fee').eq('id', 1).maybeSingle();
    if (!error && data) document.getElementById('hourlyFee').value = Number(data.hourly_class_fee || 0);
  }

  async function load() {
    const [br, pr, ar, sr] = await Promise.all([
      client.from('bookings').select('id,student_id,start_at,end_at,duration_minutes,status,fee_amount,student_note,admin_notes,instructor_id,preferred_instructor_id,student_profiles(full_name,email,phone),assigned:instructor_id(name),preferred:preferred_instructor_id(name)').order('start_at', { ascending: true }),
      client.from('student_payments').select('id,student_id,booking_id,amount,payment_date,payment_method,receipt_number,notes,student_profiles(full_name,email)').order('payment_date', { ascending: false }).limit(200),
      client.from('instructor_availability').select('id,instructor_id,start_at,end_at,availability_type,reason,instructors(name)').order('start_at', { ascending: true }).limit(200),
      client.from('student_profiles').select('id,full_name,email,phone,date_of_birth,blood_group,address,pincode,applying_for,course,total_course_fee').order('full_name')
    ]);
    if (br.error) { show(br.error.message, 'error'); return; }
    if (pr.error) { show(pr.error.message, 'error'); return; }
    if (ar.error) { show(ar.error.message, 'error'); return; }
    if (sr.error) { show(sr.error.message, 'error'); return; }

    const bookings = br.data || [], payments = pr.data || [], blocks = ar.data || [];
    document.getElementById('statPending').textContent = bookings.filter(b => b.status === 'pending').length;
    document.getElementById('statApproved').textContent = bookings.filter(b => b.status === 'approved').length;
    document.getElementById('statCollected').textContent = money(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
    document.getElementById('statBlocks').textContent = blocks.filter(b => new Date(b.end_at) > new Date()).length;
    renderBookings(bookings, payments);
    renderPayments(payments);
    renderBlocks(blocks);
    renderStudents(sr.data || [], payments);
  }

  function renderBookings(bookings, payments) {
    const root = document.getElementById('bookingTable');
    if (!bookings.length) { root.innerHTML = '<div class="empty">No student booking requests yet.</div>'; return; }
    root.innerHTML = `<table class="admin-table"><thead><tr><th>Student</th><th>Requested time</th><th>Instructor</th><th>Fee / paid</th><th>Status</th><th>Actions</th></tr></thead><tbody>${bookings.map(b => {
      const paid = payments.filter(p => p.booking_id === b.id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const opts = '<option value="">Unassigned</option>' + instructors.filter(i => i.active).map(i => `<option value="${i.id}" ${i.id === b.instructor_id ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
      return `<tr>
        <td><strong>${esc(b.student_profiles?.full_name || 'Student')}</strong><br><small>${esc(b.student_profiles?.email || '')}</small><br><small>${esc(b.student_profiles?.phone || '')}</small></td>
        <td><strong>${fmt(b.start_at)}</strong><br><small>${b.duration_minutes} min</small><br><small>Preferred: ${esc(b.preferred?.name || 'Any')}</small>${b.student_note ? `<br><small>Note: ${esc(b.student_note)}</small>` : ''}</td>
        <td><select class="assign-instructor" data-id="${b.id}">${opts}</select><button class="admin-btn secondary save-assignment" data-id="${b.id}" style="margin-top:6px">Save</button></td>
        <td><input class="booking-fee" data-id="${b.id}" type="number" min="0" step="0.01" value="${Number(b.fee_amount || 0)}" style="width:120px"><button class="admin-btn secondary save-fee" data-id="${b.id}" style="margin-top:6px">Save fee</button><br><small>Paid: ${money(paid)} / ${money(b.fee_amount)}</small></td>
        <td><span class="status-pill status-${esc(b.status)}">${esc(b.status.replaceAll('_',' '))}</span></td>
        <td><div class="admin-actions">
          <button class="admin-btn record-payment" data-id="${b.id}" data-student="${b.student_id}" data-fee="${Number(b.fee_amount || 0)}">Payment</button>
          ${b.status === 'pending' ? `<button class="admin-btn approve-booking" data-id="${b.id}">Approve</button>` : ''}
          ${b.status === 'approved' ? `<button class="admin-btn complete-booking" data-id="${b.id}">Complete</button>` : ''}
          ${!['cancelled','completed','rejected'].includes(b.status) ? `<button class="admin-btn danger cancel-booking" data-id="${b.id}">Cancel</button>` : ''}
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;

    root.querySelectorAll('.save-assignment').forEach(btn => btn.onclick = async () => {
      const select = root.querySelector(`.assign-instructor[data-id="${btn.dataset.id}"]`);
      const { error } = await client.from('bookings').update({ instructor_id: select.value || null }).eq('id', btn.dataset.id);
      if (error) show(error.message, 'error'); else { show('Instructor assignment saved.', 'success'); load(); }
    });
    root.querySelectorAll('.save-fee').forEach(btn => btn.onclick = async () => {
      const input = root.querySelector(`.booking-fee[data-id="${btn.dataset.id}"]`);
      const { error } = await client.from('bookings').update({ fee_amount: Number(input.value) }).eq('id', btn.dataset.id);
      if (error) show(error.message, 'error'); else { show('Booking fee updated.', 'success'); load(); }
    });
    root.querySelectorAll('.approve-booking').forEach(btn => btn.onclick = async () => {
      if (!confirm('Approve this class? The system will require an instructor and full booking fee payment.')) return;
      const { error } = await client.rpc('approve_booking', { p_booking_id: btn.dataset.id });
      if (error) show(error.message, 'error'); else { show('Class approved.', 'success'); load(); }
    });
    root.querySelectorAll('.complete-booking').forEach(btn => btn.onclick = async () => { const { error } = await client.from('bookings').update({ status: 'completed' }).eq('id', btn.dataset.id); if (error) show(error.message, 'error'); else load(); });
    root.querySelectorAll('.cancel-booking').forEach(btn => btn.onclick = async () => { if (!confirm('Cancel this booking?')) return; const { error } = await client.from('bookings').update({ status: 'cancelled' }).eq('id', btn.dataset.id); if (error) show(error.message, 'error'); else load(); });
    root.querySelectorAll('.record-payment').forEach(btn => btn.onclick = () => openPayment(btn.dataset.student, btn.dataset.id, btn.dataset.fee));
  }

  function renderPayments(payments) {
    const root = document.getElementById('paymentTable');
    if (!payments.length) { root.innerHTML = '<div class="empty">No payments recorded yet.</div>'; return; }
    root.innerHTML = `<table class="admin-table"><thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Note</th></tr></thead><tbody>${payments.map(p => `<tr><td>${esc(p.payment_date)}</td><td>${esc(p.student_profiles?.full_name || p.student_profiles?.email || 'Student')}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method || '—')}</td><td>${esc(p.receipt_number || '—')}</td><td>${esc(p.notes || '')}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderBlocks(blocks) {
    const root = document.getElementById('blockTable');
    if (!blocks.length) { root.innerHTML = '<div class="empty">No unavailable periods recorded.</div>'; return; }
    root.innerHTML = `<table class="admin-table"><thead><tr><th>Instructor</th><th>Type</th><th>From</th><th>To</th><th>Reason</th><th></th></tr></thead><tbody>${blocks.map(b => `<tr><td>${esc(b.instructors?.name || 'Instructor')}</td><td>${esc(b.availability_type)}</td><td>${fmt(b.start_at)}</td><td>${fmt(b.end_at)}</td><td>${esc(b.reason || '—')}</td><td><button class="admin-btn danger delete-block" data-id="${b.id}">Remove</button></td></tr>`).join('')}</tbody></table>`;
    root.querySelectorAll('.delete-block').forEach(btn => btn.onclick = async () => { if (!confirm('Remove this unavailable period?')) return; const { error } = await client.from('instructor_availability').delete().eq('id', btn.dataset.id); if (error) show(error.message, 'error'); else load(); });
  }

  function renderStudents(students, payments) {
    const root = document.getElementById('studentFeeTable');
    if (!students.length) { root.innerHTML = '<div class="empty">No student profiles yet.</div>'; return; }
    root.innerHTML = `<table class="admin-table"><thead><tr><th>Student</th><th>Contact</th><th>Registration details</th><th>Course</th><th>Total fee</th><th>Paid</th><th></th></tr></thead><tbody>${students.map(s => {
      const paid = payments.filter(p => p.student_id === s.id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return `<tr><td><strong>${esc(s.full_name || 'Student')}</strong><br><small>${esc(s.email || '')}</small></td><td>${esc(s.phone || '—')}<br><small>Pincode: ${esc(s.pincode || '—')}</small></td><td><small>DOB: ${esc(s.date_of_birth || '—')}<br>Blood: ${esc(s.blood_group || '—')}<br>Address: ${esc(s.address || '—')}</small></td><td>${esc(s.course || '—')}<br><strong>${esc(s.applying_for || '—')}</strong></td><td><input class="student-total-fee" data-id="${s.id}" type="number" min="0" step="0.01" value="${Number(s.total_course_fee || 0)}" style="width:120px"></td><td><strong>${money(paid)}</strong></td><td><button class="admin-btn secondary save-student-fee" data-id="${s.id}">Save</button></td></tr>`;
    }).join('')}</tbody></table>`;
    root.querySelectorAll('.save-student-fee').forEach(btn => btn.onclick = async () => { const input = root.querySelector(`.student-total-fee[data-id="${btn.dataset.id}"]`); const { error } = await client.from('student_profiles').update({ total_course_fee: Number(input.value) }).eq('id', btn.dataset.id); if (error) show(error.message, 'error'); else show('Student course fee updated.', 'success'); });
  }

  function openPayment(studentId, bookingId, fee) {
    document.getElementById('paymentStudent').value = studentId;
    document.getElementById('paymentBooking').value = bookingId || '';
    document.getElementById('paymentStudentDisplay').value = studentId;
    document.getElementById('paymentBookingDisplay').value = bookingId || '';
    document.querySelector('#paymentForm [name="amount"]').value = Number(fee || 0) || '';
    document.getElementById('paymentFormCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.getElementById('paymentForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const studentId = fd.get('student_id'), bookingId = fd.get('booking_id') || null, amount = Number(fd.get('amount'));
    if (!studentId || !amount || amount <= 0) { show('Choose a booking/student and enter a valid payment amount.', 'error'); return; }
    const { error } = await client.from('student_payments').insert({ student_id: studentId, booking_id: bookingId, amount, payment_date: fd.get('payment_date'), payment_method: fd.get('payment_method'), receipt_number: fd.get('receipt_number') || null, notes: fd.get('notes') || null, collected_by: session.user.id });
    if (error) { show(error.message, 'error'); return; }
    show('Payment recorded successfully.', 'success'); e.target.reset(); document.getElementById('paymentDate').value = new Date().toISOString().slice(0,10); load();
  };

  document.getElementById('blockForm').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    const start = new Date(fd.get('start_at')), end = new Date(fd.get('end_at'));
    if (end <= start) { show('The end time must be after the start time.', 'error'); return; }
    const { error } = await client.from('instructor_availability').insert({ instructor_id: fd.get('instructor_id'), start_at: start.toISOString(), end_at: end.toISOString(), availability_type: fd.get('availability_type'), reason: fd.get('reason') || null, created_by: session.user.id });
    if (error) show(error.message, 'error'); else { show('Instructor time blocked.', 'success'); e.target.reset(); load(); }
  };

  document.getElementById('settingsForm').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    const { error } = await client.from('school_settings').upsert({ id: 1, hourly_class_fee: Number(fd.get('hourly_class_fee')), updated_at: new Date().toISOString() });
    if (error) show(error.message, 'error'); else show('Hourly fee updated.', 'success');
  };

  document.getElementById('logoutBtn').onclick = async () => { await client.auth.signOut(); location.href = '../admin/'; };
  document.getElementById('refreshBtn').onclick = async () => { await load(); show('Admin dashboard refreshed.', 'success'); };
  document.getElementById('paymentDate').value = new Date().toISOString().slice(0,10);

  try { await loadInstructors(); await loadSettings(); await load(); }
  catch (e) { show(e.message || 'Could not load admin data.', 'error'); }
})();
