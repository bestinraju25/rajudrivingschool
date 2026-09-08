(async function () {
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const msg = document.getElementById('dashboardMessage');
  const show = (text, type = '') => { msg.textContent = text; msg.className = 'notice ' + type; };
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s ?? '').replace(/[&<>\'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const localFmt = d => new Intl.DateTimeFormat('en-IN', { dateStyle:'medium', timeStyle:'short' }).format(new Date(d));
  const dateLabel = d => new Intl.DateTimeFormat('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' }).format(d);
  const timeLabel = d => new Intl.DateTimeFormat('en-IN', { hour:'numeric', minute:'2-digit' }).format(d);

  const { data: { session } } = await client.auth.getSession();
  if (!session) { location.href = '../student/'; return; }

  let profile = null, instructors = [], selectedDate = new Date(), selectedDuration = 60, slots = [], selectedStart = null;
  selectedDate.setHours(12,0,0,0);

  async function loadProfile() {
    const { data, error } = await client.from('student_profiles').select('full_name,phone,email,date_of_birth,blood_group,address,pincode,applying_for,total_course_fee').eq('id', session.user.id).single();
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
    document.getElementById('totalCourseFee').textContent = money(profile.total_course_fee);
  }

  function populateProfileEditor() {
    if (!profile) return;
    document.getElementById('editFullName').value = profile.full_name || '';
    document.getElementById('editEmail').value = profile.email || session.user.email || '';
    document.getElementById('editPhone').value = profile.phone || '';
    document.getElementById('editDob').value = profile.date_of_birth || '';
    document.getElementById('editBloodGroup').value = profile.blood_group || '';
    document.getElementById('editApplyingFor').value = profile.applying_for || '';
    document.getElementById('editPincode').value = profile.pincode || '';
    document.getElementById('editAddress').value = profile.address || '';
  }

  document.getElementById('editProfileBtn').onclick = () => {
    populateProfileEditor();
    document.getElementById('profileEditForm').hidden = false;
    document.getElementById('profileEditForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  document.getElementById('cancelProfileEdit').onclick = () => {
    document.getElementById('profileEditForm').hidden = true;
  };
  document.getElementById('profileEditForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const saveBtn = document.getElementById('saveProfileBtn');
    const fd = new FormData(form);
    const updates = {
      full_name: String(fd.get('full_name') || '').trim(),
      phone: String(fd.get('phone') || '').trim() || null,
      date_of_birth: String(fd.get('date_of_birth') || '') || null,
      blood_group: String(fd.get('blood_group') || '').trim() || null,
      applying_for: String(fd.get('applying_for') || '').trim() || null,
      pincode: String(fd.get('pincode') || '').trim() || null,
      address: String(fd.get('address') || '').trim() || null
    };
    if (!updates.full_name) { show('Please enter your full name.', 'error'); return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    const { error } = await client.from('student_profiles').update(updates).eq('id', session.user.id);
    if (error) {
      show(error.message, 'error');
    } else {
      await loadProfile();
      document.getElementById('profileEditForm').hidden = true;
      show('Your profile was updated successfully.', 'success');
    }
    saveBtn.disabled = false; saveBtn.textContent = 'Save changes';
  };

  async function loadInstructors() {
    const { data, error } = await client.from('instructors').select('id,name,active').eq('active', true).order('name');
    if (error) throw error;
    instructors = data || [];
    const select = document.getElementById('bookingInstructor');
    select.innerHTML = '<option value="">Select an instructor</option>' + instructors.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
    if (instructors.length) { select.value = instructors[0].id; }
  }

  function sameDay(a,b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function isPastDay(d) { const n = new Date(); n.setHours(0,0,0,0); const x = new Date(d); x.setHours(0,0,0,0); return x < n; }

  function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const month = selectedDate.getMonth(), year = selectedDate.getFullYear();
    document.getElementById('calendarMonth').textContent = new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(selectedDate);
    const first = new Date(year, month, 1), last = new Date(year, month+1, 0);
    grid.innerHTML = '';
    for (let i=0; i<first.getDay(); i++) grid.insertAdjacentHTML('beforeend','<span class="calendar-day empty-day"></span>');
    for (let day=1; day<=last.getDate(); day++) {
      const d = new Date(year, month, day); const disabled = isPastDay(d); const selected = sameDay(d, selectedDate);
      const button = document.createElement('button'); button.type='button'; button.className='calendar-day' + (selected?' selected':'') + (disabled?' disabled':''); button.textContent=day; button.disabled=disabled;
      button.onclick=()=>{ selectedDate=new Date(year,month,day,12); selectedStart=null; renderCalendar(); loadDaySlots(); };
      grid.appendChild(button);
    }
  }

  async function loadDaySlots() {
    selectedStart = null; updateSelection();
    const instructorId = document.getElementById('bookingInstructor').value;
    const root = document.getElementById('slotList');
    document.getElementById('selectedDateLabel').textContent = dateLabel(selectedDate);
    if (!instructorId) { root.innerHTML='<div class="empty">Select an instructor first.</div>'; return; }
    root.innerHTML='<div class="slot-loading">Checking live availability…</div>';
    const { data, error } = await client.rpc('get_instructor_day_slots', { p_instructor_id: instructorId, p_date: ymd(selectedDate) });
    if (error) { root.innerHTML='<div class="empty">Could not load availability. Please refresh.</div>'; show(error.message,'error'); return; }
    slots = data || [];
    renderSlots();
  }

  function slotDate(s) { return new Date(s.slot_start); }
  function renderSlots() {
    const root = document.getElementById('slotList');
    const available = slots.filter(s=>s.status==='available');
    if (!slots.length) { root.innerHTML='<div class="empty">No class slots are configured for this date.</div>'; return; }
    root.innerHTML = slots.map((s,idx)=>{
      const start=slotDate(s), label=timeLabel(start), cls='time-slot '+s.status+(selectedStart===s.slot_start?' selected':'');
      const isDisabled=s.status!=='available' || isPastTime(start);
      return `<button type="button" class="${cls}" data-index="${idx}" ${isDisabled?'disabled':''}><strong>${label}</strong><small>${s.status==='available'?'Available':s.status==='booked'?'Booked':s.status==='mine'?'Your booking':'Not available'}</small></button>`;
    }).join('');
    root.querySelectorAll('.time-slot:not(:disabled)').forEach(btn=>btn.onclick=()=>selectSlot(Number(btn.dataset.index)));
    if (available.length===0) root.insertAdjacentHTML('afterbegin','<div class="slot-info">No free hours for this instructor on this date. Try another instructor or date.</div>');
  }
  function isPastTime(d) { return d <= new Date(); }

  function selectSlot(index) {
    const slot=slots[index];
    if (!slot || slot.status!=='available') return;
    const needed=selectedDuration===120?2:1;
    const chosen=slots.slice(index,index+needed);
    if (chosen.length!==needed || chosen.some(s=>s.status!=='available')) { show(selectedDuration===120?'Two-hour classes need two consecutive available slots.':'That slot is no longer available.','error'); return; }
    selectedStart=slot.slot_start; renderSlots(); updateSelection();
  }

  function updateSelection() {
    const box=document.getElementById('bookingSelection'), btn=document.getElementById('bookSelectedBtn');
    if (!selectedStart) { box.hidden=true; btn.disabled=true; return; }
    const start=new Date(selectedStart), end=new Date(start.getTime()+selectedDuration*60000);
    const instructor=instructors.find(i=>i.id===document.getElementById('bookingInstructor').value);
    box.hidden=false; box.innerHTML=`<span>Selected</span><strong>${esc(instructor?.name||'Instructor')}</strong><b>${dateLabel(start)}</b><b>${timeLabel(start)} – ${timeLabel(end)} · ${selectedDuration/60} hour${selectedDuration===120?'s':''}</b>`;
    btn.disabled=false;
  }

  document.querySelectorAll('.duration-option').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('.duration-option').forEach(b=>b.classList.toggle('active',b===btn));
    selectedDuration=Number(btn.dataset.duration); selectedStart=null; renderSlots(); updateSelection();
  });

  document.getElementById('bookingInstructor').onchange=()=>{ selectedStart=null; loadDaySlots(); };
  document.getElementById('prevMonth').onclick=()=>{ selectedDate=new Date(selectedDate.getFullYear(),selectedDate.getMonth()-1,1,12); renderCalendar(); loadDaySlots(); };
  document.getElementById('nextMonth').onclick=()=>{ selectedDate=new Date(selectedDate.getFullYear(),selectedDate.getMonth()+1,1,12); renderCalendar(); loadDaySlots(); };

  document.getElementById('bookSelectedBtn').onclick=async()=>{
    if (!selectedStart) return;
    const instructorId=document.getElementById('bookingInstructor').value, btn=document.getElementById('bookSelectedBtn'); btn.disabled=true; btn.textContent='Booking…';
    try {
      const { data, error } = await client.rpc('create_booking_request', { p_instructor_id: instructorId, p_start: selectedStart, p_duration_minutes: selectedDuration, p_student_note: null });
      if(error) throw error;
      show('Booking request submitted successfully. It is reserved for you and is waiting for admin approval after fee collection.','success');
      selectedStart=null; updateSelection(); await loadDaySlots(); await loadBookings(); document.getElementById('my-bookings').scrollIntoView({behavior:'smooth',block:'start'});
    } catch(e) { show(e.message||'Could not create booking. Please choose another slot.','error'); await loadDaySlots(); }
    finally { btn.textContent='Book selected slot'; btn.disabled=!selectedStart; }
  };

  async function loadBookings() {
    const { data, error } = await client.from('bookings').select('id,requested_start,requested_end,duration_minutes,status,class_fee,admin_note,assigned_instructor_id,preferred_instructor_id,instructors:assigned_instructor_id(name)').eq('student_id',session.user.id).order('requested_start',{ascending:false});
    if(error){ document.getElementById('bookingList').innerHTML='<div class="empty">Could not load bookings.</div>'; return; }
    const root=document.getElementById('bookingList');
    if(!data?.length){ root.innerHTML='<div class="empty">No class bookings yet. Choose a date and hourly slot above to make your first booking.</div>'; return; }
    root.innerHTML=data.map(b=>`<div class="booking-row"><div><strong>${localFmt(b.requested_start)}</strong><small>${esc(b.instructors?.name||'Instructor')} · ${b.duration_minutes/60} hour${b.duration_minutes===60?'':'s'}</small></div><div><span class="status-pill status-${esc(b.status)}">${esc(String(b.status).replaceAll('_',' '))}</span><small>${Number(b.class_fee)?money(b.class_fee):'Fee pending'}</small></div><div>${['pending_payment','payment_recorded'].includes(b.status)?`<button class="booking-btn secondary cancel-booking" data-id="${b.id}">Cancel</button>`:''}</div></div>`).join('');
    root.querySelectorAll('.cancel-booking').forEach(btn=>btn.onclick=async()=>{if(!confirm('Cancel this booking request?'))return;const {error}=await client.rpc('cancel_own_booking',{p_booking_id:btn.dataset.id});if(error)show(error.message,'error');else{show('Booking cancelled.','success');loadBookings();loadDaySlots();}});
  }

  async function loadFees() {
    const { data, error } = await client.from('fee_payments').select('amount,paid_on,payment_method,receipt_number,note,booking_id').eq('student_id',session.user.id).order('paid_on',{ascending:false});
    if(error){show(error.message,'error');return;}
    const paid=(data||[]).reduce((sum,p)=>sum+Number(p.amount||0),0); document.getElementById('totalPaid').textContent=money(paid); document.getElementById('balanceDue').textContent=money(Math.max(0,Number(profile?.total_course_fee||0)-paid));
    const root=document.getElementById('paymentList'); if(!data?.length){root.innerHTML='<div class="empty">No manual payments have been recorded yet.</div>';return;}
    root.innerHTML=`<table class="payment-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Note</th></tr></thead><tbody>${data.map(p=>`<tr><td>${esc(p.paid_on)}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method||'—')}</td><td>${esc(p.receipt_number||'—')}</td><td>${esc(p.note||'')}</td></tr>`).join('')}</tbody></table>`;
  }

  document.getElementById('logoutBtn').onclick=async()=>{await client.auth.signOut();location.href='../student/';};
  document.getElementById('refreshBtn').onclick=async()=>{try{await Promise.all([loadBookings(),loadFees(),loadDaySlots()]);show('Dashboard refreshed.','success');}catch(e){show(e.message,'error');}};

  try { await loadProfile(); await loadInstructors(); renderCalendar(); await loadDaySlots(); await Promise.all([loadBookings(),loadFees()]); }
  catch(e){show(e.message||'Could not load your student dashboard.','error');}
  client.auth.onAuthStateChange((_event,s)=>{if(!s)location.href='../student/';});
})();
