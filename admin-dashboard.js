(async function () {
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const msg = document.getElementById('adminMessage');
  const show=(t,c='')=>{msg.textContent=t;msg.className='notice '+c;};
  const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt=iso=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
  const esc=s=>String(s??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const {data:{session}}=await client.auth.getSession();
  if(!session){location.href='../admin/';return;}
  const {data:admin}=await client.from('admin_users').select('full_name,email').eq('id',session.user.id).eq('active',true).maybeSingle();
  if(!admin){await client.auth.signOut();location.href='../admin/';return;}
  document.getElementById('adminName').textContent=admin.full_name||admin.email||'Admin';
  let instructors=[];

  async function loadInstructors(){
    const {data,error}=await client.from('instructors').select('id,name,active').order('name');
    if(error)throw error; instructors=data||[];
    document.getElementById('blockInstructor').innerHTML=instructors.filter(i=>i.active).map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('');
  }
  async function loadSettings(){const {data}=await client.from('school_settings').select('hourly_class_fee').eq('id',1).maybeSingle();if(data)document.getElementById('hourlyFee').value=Number(data.hourly_class_fee||0);}

  async function load(){
    const [br,pr,ar,sr]=await Promise.all([
      client.from('bookings').select('id,student_id,requested_start,requested_end,duration_minutes,status,class_fee,student_note,admin_note,assigned_instructor_id,preferred_instructor_id,student_profiles(full_name,email,phone),assigned:assigned_instructor_id(name),preferred:preferred_instructor_id(name)').order('requested_start',{ascending:true}),
      client.from('fee_payments').select('id,student_id,booking_id,amount,paid_on,payment_method,receipt_number,note,student_profiles(full_name,email)').order('paid_on',{ascending:false}).limit(500),
      client.from('instructor_unavailability').select('id,instructor_id,start_at,end_at,reason,instructors(name)').order('start_at',{ascending:true}).limit(300),
      client.from('student_profiles').select('id,full_name,email,phone,date_of_birth,blood_group,address,pincode,applying_for,total_course_fee').order('full_name')
    ]);
    if(br.error)throw br.error;if(pr.error)throw pr.error;if(ar.error)throw ar.error;if(sr.error)throw sr.error;
    const bookings=br.data||[],payments=pr.data||[],blocks=ar.data||[];
    document.getElementById('statPending').textContent=bookings.filter(b=>b.status==='pending_payment').length;
    document.getElementById('statApproved').textContent=bookings.filter(b=>b.status==='approved').length;
    document.getElementById('statCollected').textContent=money(payments.reduce((s,p)=>s+Number(p.amount||0),0));
    document.getElementById('statBlocks').textContent=blocks.filter(b=>new Date(b.end_at)>new Date()).length;
    renderBookings(bookings,payments);renderPayments(payments);renderBlocks(blocks);renderStudents(sr.data||[],payments);
  }

  function renderBookings(bookings,payments){
    const root=document.getElementById('bookingTable');
    if(!bookings.length){root.innerHTML='<div class="empty">No student booking requests yet.</div>';return;}
    root.innerHTML=`<table class="admin-table"><thead><tr><th>Student</th><th>Requested class</th><th>Instructor</th><th>Fee / paid</th><th>Status</th><th>Actions</th></tr></thead><tbody>${bookings.map(b=>{
      const paid=payments.filter(p=>p.booking_id===b.id).reduce((s,p)=>s+Number(p.amount||0),0);
      const opts='<option value="">Unassigned</option>'+instructors.filter(i=>i.active).map(i=>`<option value="${i.id}" ${i.id===b.assigned_instructor_id?'selected':''}>${esc(i.name)}</option>`).join('');
      return `<tr><td><strong>${esc(b.student_profiles?.full_name||'Student')}</strong><br><small>${esc(b.student_profiles?.phone||'')}<br>${esc(b.student_profiles?.email||'')}</small></td>
      <td><strong>${fmt(b.requested_start)}</strong><br><small>${b.duration_minutes/60} hour${b.duration_minutes===60?'':'s'}${b.student_note?' · '+esc(b.student_note):''}</small></td>
      <td><select class="assign-instructor" data-id="${b.id}">${opts}</select>${b.preferred?.name?`<small>Preferred: ${esc(b.preferred.name)}</small>`:''}<br><button class="admin-btn secondary save-assignment" data-id="${b.id}">Save instructor</button></td>
      <td><input class="booking-fee" data-id="${b.id}" type="number" min="0" step="0.01" value="${Number(b.class_fee||0)}"><br><button class="admin-btn secondary save-fee" data-id="${b.id}">Save fee</button><br><small>Paid: ${money(paid)} / ${money(b.class_fee)}</small></td>
      <td><span class="status-pill status-${esc(b.status)}">${esc(b.status.replaceAll('_',' '))}</span></td>
      <td><div class="admin-actions"><button class="admin-btn record-payment" data-id="${b.id}" data-student="${b.student_id}" data-fee="${Number(b.class_fee||0)}">Payment</button>${b.status==='pending_payment'||b.status==='payment_recorded'?`<button class="admin-btn approve-booking" data-id="${b.id}">Approve</button>`:''}${b.status==='approved'?`<button class="admin-btn complete-booking" data-id="${b.id}">Complete</button>`:''}${!['cancelled','completed','rejected'].includes(b.status)?`<button class="admin-btn danger cancel-booking" data-id="${b.id}">Cancel</button>`:''}</div></td></tr>`;
    }).join('')}</tbody></table>`;

    root.querySelectorAll('.save-assignment').forEach(btn=>btn.onclick=async()=>{const s=root.querySelector(`.assign-instructor[data-id="${btn.dataset.id}"]`);const {error}=await client.from('bookings').update({assigned_instructor_id:s.value||null}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Instructor assigned.','success');load();}});
    root.querySelectorAll('.save-fee').forEach(btn=>btn.onclick=async()=>{const i=root.querySelector(`.booking-fee[data-id="${btn.dataset.id}"]`);const {error}=await client.from('bookings').update({class_fee:Number(i.value)}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Class fee updated.','success');load();}});
    root.querySelectorAll('.approve-booking').forEach(btn=>btn.onclick=async()=>{if(!confirm('Approve this class? Make sure the instructor is assigned and the full manual fee has been recorded.'))return;const {error}=await client.rpc('approve_booking',{p_booking_id:btn.dataset.id});if(error)show(error.message,'error');else{show('Class approved.','success');load();}});
    root.querySelectorAll('.complete-booking').forEach(btn=>btn.onclick=async()=>{const {error}=await client.from('bookings').update({status:'completed'}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else load();});
    root.querySelectorAll('.cancel-booking').forEach(btn=>btn.onclick=async()=>{if(!confirm('Cancel this booking?'))return;const {error}=await client.from('bookings').update({status:'cancelled'}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else load();});
    root.querySelectorAll('.record-payment').forEach(btn=>btn.onclick=()=>openPayment(btn.dataset.student,btn.dataset.id,btn.dataset.fee));
  }

  function renderPayments(payments){const root=document.getElementById('paymentTable');if(!payments.length){root.innerHTML='<div class="empty">No payments recorded yet.</div>';return;}root.innerHTML=`<table class="admin-table"><thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Note</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${esc(p.paid_on)}</td><td>${esc(p.student_profiles?.full_name||p.student_profiles?.email||'Student')}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method||'—')}</td><td>${esc(p.receipt_number||'—')}</td><td>${esc(p.note||'')}</td></tr>`).join('')}</tbody></table>`;}
  function renderBlocks(blocks){const root=document.getElementById('blockTable');if(!blocks.length){root.innerHTML='<div class="empty">No unavailable periods recorded.</div>';return;}root.innerHTML=`<table class="admin-table"><thead><tr><th>Instructor</th><th>From</th><th>To</th><th>Reason</th><th></th></tr></thead><tbody>${blocks.map(b=>`<tr><td>${esc(b.instructors?.name||'Instructor')}</td><td>${fmt(b.start_at)}</td><td>${fmt(b.end_at)}</td><td>${esc(b.reason||'—')}</td><td><button class="admin-btn danger delete-block" data-id="${b.id}">Remove</button></td></tr>`).join('')}</tbody></table>`;root.querySelectorAll('.delete-block').forEach(btn=>btn.onclick=async()=>{if(!confirm('Remove this unavailable period?'))return;const {error}=await client.from('instructor_unavailability').delete().eq('id',btn.dataset.id);if(error)show(error.message,'error');else load();});}
  function renderStudents(students,payments){const root=document.getElementById('studentFeeTable');if(!students.length){root.innerHTML='<div class="empty">No student profiles yet.</div>';return;}root.innerHTML=`<table class="admin-table"><thead><tr><th>Student</th><th>Registration details</th><th>Applying for</th><th>Total course fee</th><th>Paid</th><th></th></tr></thead><tbody>${students.map(s=>{const paid=payments.filter(p=>p.student_id===s.id).reduce((sum,p)=>sum+Number(p.amount||0),0);return `<tr><td><strong>${esc(s.full_name||'Student')}</strong><br><small>${esc(s.email||'')}<br>${esc(s.phone||'')}</small></td><td><small>DOB: ${esc(s.date_of_birth||'—')}<br>Blood: ${esc(s.blood_group||'—')}<br>Pincode: ${esc(s.pincode||'—')}<br>${esc(s.address||'—')}</small></td><td><strong>${esc(s.applying_for||'—')}</strong></td><td><input class="student-total-fee" data-id="${s.id}" type="number" min="0" step="0.01" value="${Number(s.total_course_fee||0)}" style="width:120px"><br><button class="admin-btn secondary save-student-fee" data-id="${s.id}">Save</button></td><td><strong>${money(paid)}</strong></td><td><button class="admin-btn record-student-payment" data-id="${s.id}">Payment</button></td></tr>`;}).join('')}</tbody></table>`;root.querySelectorAll('.save-student-fee').forEach(btn=>btn.onclick=async()=>{const input=root.querySelector(`.student-total-fee[data-id="${btn.dataset.id}"]`);const {error}=await client.from('student_profiles').update({total_course_fee:Number(input.value)}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else show('Course fee updated.','success');});root.querySelectorAll('.record-student-payment').forEach(btn=>btn.onclick=()=>openPayment(btn.dataset.id,'',''));}

  function openPayment(studentId,bookingId,fee){document.getElementById('paymentStudent').value=studentId;document.getElementById('paymentBooking').value=bookingId||'';document.getElementById('paymentStudentDisplay').value=studentId;document.getElementById('paymentBookingDisplay').value=bookingId||'General course payment';document.querySelector('#paymentForm [name="amount"]').value=Number(fee||0)||'';document.getElementById('paymentFormCard').scrollIntoView({behavior:'smooth',block:'center'});}
  document.getElementById('paymentForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),studentId=fd.get('student_id'),bookingId=fd.get('booking_id')||null,amount=Number(fd.get('amount'));if(!studentId||!amount||amount<=0){show('Choose a student and enter a valid payment amount.','error');return;}const {error}=await client.from('fee_payments').insert({student_id:studentId,booking_id:bookingId,amount,paid_on:fd.get('payment_date'),payment_method:fd.get('payment_method'),receipt_number:fd.get('receipt_number')||null,note:fd.get('notes')||null,recorded_by:session.user.id});if(error){show(error.message,'error');return;}show('Payment recorded successfully.','success');e.target.reset();document.getElementById('paymentDate').value=new Date().toISOString().slice(0,10);load();};
  document.getElementById('blockForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),start=new Date(fd.get('start_at')),end=new Date(fd.get('end_at'));if(end<=start){show('The end time must be after the start time.','error');return;}const {error}=await client.from('instructor_unavailability').insert({instructor_id:fd.get('instructor_id'),start_at:start.toISOString(),end_at:end.toISOString(),reason:fd.get('reason')||null,created_by:session.user.id});if(error)show(error.message,'error');else{show('Instructor time blocked.','success');e.target.reset();load();}};
  document.getElementById('settingsForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),{error}=await client.from('school_settings').upsert({id:1,hourly_class_fee:Number(fd.get('hourly_class_fee')),updated_at:new Date().toISOString()});if(error)show(error.message,'error');else show('Hourly fee updated.','success');};
  document.getElementById('logoutBtn').onclick=async()=>{await client.auth.signOut();location.href='../admin/';};document.getElementById('refreshBtn').onclick=async()=>{try{await load();show('Admin dashboard refreshed.','success');}catch(e){show(e.message,'error');}};document.getElementById('paymentDate').value=new Date().toISOString().slice(0,10);
  try{await loadInstructors();await loadSettings();await load();}catch(e){show(e.message||'Could not load admin data.','error');}
})();
