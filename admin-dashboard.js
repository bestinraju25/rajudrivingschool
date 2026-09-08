(async function () {
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const msg = document.getElementById('adminMessage');
  const show=(t,c='')=>{msg.textContent=t;msg.className='notice '+c;};
  const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt=iso=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
  const esc=s=>String(s??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const dateKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const startOfWeek=d=>{const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-x.getDay());return x;};
  const dayTitle=d=>new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'numeric',month:'short'}).format(d);
  const hourLabel=h=>{const d=new Date(2000,0,1,h,0);return new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit'}).format(d);};

  const {data:{session}}=await client.auth.getSession();
  if(!session){location.href='../admin/';return;}
  const {data:admin}=await client.from('admin_users').select('full_name,email').eq('id',session.user.id).eq('active',true).maybeSingle();
  if(!admin){await client.auth.signOut();location.href='../admin/';return;}
  document.getElementById('adminName').textContent=admin.full_name||admin.email||'Admin';

  let instructors=[], adminWeekStart=new Date(), cached={bookings:[],blocks:[],students:[],payments:[]};

  async function loadInstructors(){
    const {data,error}=await client.from('instructors').select('id,name,active').order('name');
    if(error)throw error;
    instructors=data||[];
    document.getElementById('blockInstructor').innerHTML=instructors.filter(i=>i.active).map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('');
    renderInstructorTable();
  }
  async function loadSettings(){const {data,error}=await client.from('school_settings').select('hourly_class_fee').eq('id',1).maybeSingle();if(error)throw error;if(data)document.getElementById('hourlyFee').value=Number(data.hourly_class_fee||0);}

  async function load(){
    const [br,pr,ar,sr]=await Promise.all([
      client.from('bookings').select('id,student_id,requested_start,requested_end,duration_minutes,status,class_fee,student_note,admin_note,assigned_instructor_id,preferred_instructor_id').order('requested_start',{ascending:true}),
      client.from('fee_payments').select('id,student_id,booking_id,amount,paid_on,payment_method,receipt_number,note').order('paid_on',{ascending:false}).limit(500),
      client.from('instructor_unavailability').select('id,instructor_id,start_at,end_at,reason').order('start_at',{ascending:true}).limit(500),
      client.from('student_profiles').select('id,full_name,email,phone,date_of_birth,blood_group,address,pincode,applying_for,total_course_fee').order('full_name')
    ]);
    if(br.error)throw br.error;if(pr.error)throw pr.error;if(ar.error)throw ar.error;if(sr.error)throw sr.error;
    const bookings=br.data||[],payments=pr.data||[],blocks=ar.data||[],students=sr.data||[];
    const studentMap=new Map(students.map(s=>[s.id,s]));
    const instructorMap=new Map(instructors.map(i=>[i.id,i]));
    cached={bookings,blocks,students,payments,studentMap,instructorMap};
    document.getElementById('statPending').textContent=bookings.filter(b=>['pending_payment','payment_recorded'].includes(b.status)).length;
    document.getElementById('statApproved').textContent=bookings.filter(b=>b.status==='approved').length;
    document.getElementById('statCollected').textContent=money(payments.reduce((s,p)=>s+Number(p.amount||0),0));
    document.getElementById('statBlocks').textContent=blocks.filter(b=>new Date(b.end_at)>new Date()).length;
    renderBookings(bookings,payments,studentMap,instructorMap);renderPayments(payments,studentMap);renderBlocks(blocks,instructorMap);renderStudents(students,payments);renderAdminCalendar();renderInstructorTable();
  }

  function renderBookings(bookings,payments,studentMap,instructorMap){
    const root=document.getElementById('bookingTable');
    if(!bookings.length){root.innerHTML='<div class="empty">No student booking requests yet.</div>';return;}
    root.innerHTML=`<table class="admin-table"><thead><tr><th>Student</th><th>Requested class</th><th>Instructor</th><th>Fee / paid</th><th>Status</th><th>Admin note</th><th>Actions</th></tr></thead><tbody>${bookings.map(b=>{
      const student=studentMap.get(b.student_id)||{};
      const paid=payments.filter(p=>p.booking_id===b.id).reduce((s,p)=>s+Number(p.amount||0),0);
      const opts='<option value="">Unassigned</option>'+instructors.map(i=>`<option value="${i.id}" ${i.id===b.assigned_instructor_id?'selected':''}>${esc(i.name)}${i.active?'':' (inactive)'}</option>`).join('');
      const statusLabel=String(b.status||'').replaceAll('_',' ');
      return `<tr><td><strong>${esc(student.full_name||'Student')}</strong><br><small>${esc(student.phone||'')}<br>${esc(student.email||'')}</small></td>
      <td><strong>${fmt(b.requested_start)}</strong><br><small>${b.duration_minutes/60} hour${b.duration_minutes===60?'':'s'}${b.student_note?' · '+esc(b.student_note):''}</small></td>
      <td><select class="assign-instructor" data-id="${b.id}">${opts}</select>${b.preferred_instructor_id?`<small>Preferred: ${esc(instructorMap.get(b.preferred_instructor_id)?.name||'Instructor')}</small>`:''}<br><button class="admin-btn secondary save-assignment" data-id="${b.id}">Save</button></td>
      <td><input class="booking-fee" data-id="${b.id}" type="number" min="0" step="0.01" value="${Number(b.class_fee||0)}"><br><button class="admin-btn secondary save-fee" data-id="${b.id}">Save fee</button><br><small>Paid: ${money(paid)} / ${money(b.class_fee)}</small></td>
      <td><span class="status-pill status-${esc(b.status)}">${esc(statusLabel)}</span></td>
      <td><input class="admin-note-input booking-note" data-id="${b.id}" maxlength="300" value="${esc(b.admin_note||'')}" placeholder="Optional note"><br><button class="admin-btn secondary save-note" data-id="${b.id}">Save note</button></td>
      <td><div class="admin-actions"><button class="admin-btn record-payment" data-id="${b.id}" data-student="${b.student_id}" data-fee="${Number(b.class_fee||0)}">Payment</button>${!['approved','completed','cancelled','rejected'].includes(b.status)?`<button class="admin-btn success-btn approve-booking" data-id="${b.id}">Approve</button><button class="admin-btn warning-btn reject-booking" data-id="${b.id}">Reject</button>`:''}${b.status==='approved'?`<button class="admin-btn complete-booking" data-id="${b.id}">Complete</button>`:''}${!['cancelled','completed','rejected'].includes(b.status)?`<button class="admin-btn danger cancel-booking" data-id="${b.id}">Cancel</button>`:''}</div></td></tr>`;
    }).join('')}</tbody></table>`;

    root.querySelectorAll('.save-assignment').forEach(btn=>btn.onclick=async()=>{const s=root.querySelector(`.assign-instructor[data-id="${btn.dataset.id}"]`);const {error}=await client.from('bookings').update({assigned_instructor_id:s.value||null}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Instructor assignment saved.','success');await load();}});
    root.querySelectorAll('.save-fee').forEach(btn=>btn.onclick=async()=>{const i=root.querySelector(`.booking-fee[data-id="${btn.dataset.id}"]`);const {error}=await client.from('bookings').update({class_fee:Number(i.value)}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Class fee updated.','success');await load();}});
    root.querySelectorAll('.save-note').forEach(btn=>btn.onclick=async()=>{const i=root.querySelector(`.booking-note[data-id="${btn.dataset.id}"]`);const {error}=await client.from('bookings').update({admin_note:i.value.trim()||null}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Admin note saved.','success');await load();}});
    root.querySelectorAll('.approve-booking').forEach(btn=>btn.onclick=async()=>{if(!confirm('Approve this class? Make sure an instructor is assigned and the full booking fee has been recorded.'))return;const {error}=await client.rpc('approve_booking',{p_booking_id:btn.dataset.id});if(error)show(error.message,'error');else{show('Class approved.','success');await load();}});
    root.querySelectorAll('.reject-booking').forEach(btn=>btn.onclick=async()=>{const note=prompt('Optional reason for rejection:','');if(note===null)return;const {error}=await client.from('bookings').update({status:'rejected',assigned_instructor_id:null,admin_note:note.trim()||'Rejected by admin'}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Booking rejected.','success');await load();}});
    root.querySelectorAll('.complete-booking').forEach(btn=>btn.onclick=async()=>{if(!confirm('Mark this class as completed?'))return;const {error}=await client.from('bookings').update({status:'completed'}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Class marked completed.','success');await load();}});
    root.querySelectorAll('.cancel-booking').forEach(btn=>btn.onclick=async()=>{if(!confirm('Cancel this booking?'))return;const {error}=await client.from('bookings').update({status:'cancelled',assigned_instructor_id:null}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Booking cancelled.','success');await load();}});
    root.querySelectorAll('.record-payment').forEach(btn=>btn.onclick=()=>openPayment(btn.dataset.student,btn.dataset.id,btn.dataset.fee));
  }

  function renderAdminCalendar(){
    const root=document.getElementById('adminCalendar');
    const d=new Date(adminWeekStart);
    d.setHours(0,0,0,0);
    const date=dateKey(d);
    document.getElementById('adminCalendarDate').value=date;
    document.getElementById('adminWeekLabel').textContent=new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
    const active=instructors;
    const bookings=cached.bookings||[],blocks=cached.blocks||[];
    let html='<table class="admin-calendar"><thead><tr><th>Time</th>'+active.map(i=>`<th>${esc(i.name)}${i.active?'':' (inactive)'}</th>`).join('')+'</tr></thead><tbody>';
    for(let h=8;h<=18;h++){
      const slotStart=new Date(d);slotStart.setHours(h,0,0,0);
      const slotEnd=new Date(slotStart);slotEnd.setHours(h+1);
      html+=`<tr><td class="time-cell">${hourLabel(h)} – ${hourLabel(h+1)}</td>`;
      for(const inst of active){
        const b=bookings.find(x=>x.assigned_instructor_id===inst.id && ['pending_payment','payment_recorded','approved','completed'].includes(x.status) && new Date(x.requested_start)<slotEnd && new Date(x.requested_end)>slotStart);
        const u=blocks.find(x=>x.instructor_id===inst.id && new Date(x.start_at)<slotEnd && new Date(x.end_at)>slotStart);
        if(b){
          const student=cached.studentMap?.get(b.student_id);const pending=['pending_payment','payment_recorded'].includes(b.status);const cls=pending?'pending':'booked';
          html+=`<td><div class="calendar-cell ${cls}" title="${esc(student?.full_name||'Student')} — ${esc(b.status)}"><strong>${esc(student?.full_name||'Student')}</strong><small>${esc(b.status.replaceAll('_',' '))}${b.duration_minutes>60?' · '+(b.duration_minutes/60)+' hrs':''}</small></div></td>`;
        } else if(u){
          html+=`<td><div class="calendar-cell blocked" title="${esc(u.reason||'Blocked time')}"><strong>Blocked</strong><small>${esc(u.reason||'Unavailable')}</small></div></td>`;
        } else if(inst.active){
          html+='<td><div class="calendar-cell available"><strong>Available</strong><small>Open for booking</small></div></td>';
        } else {
          html+='<td><div class="calendar-cell blocked"><strong>Inactive</strong><small>Instructor disabled</small></div></td>';
        }
      }
      html+='</tr>';
    }
    html+='</tbody></table>';
    root.innerHTML=html;
  }

  function renderInstructorTable(){
    const root=document.getElementById('instructorTable');if(!root)return;
    if(!instructors.length){root.innerHTML='<div class="empty">No instructors yet.</div>';return;}
    root.innerHTML=`<table class="admin-table instructor-table"><thead><tr><th>Instructor</th><th>Status</th><th>Upcoming blocked time</th><th>Action</th></tr></thead><tbody>${instructors.map(i=>{const blocks=(cached.blocks||[]).filter(b=>b.instructor_id===i.id&&new Date(b.end_at)>new Date()).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));const next=blocks[0];return `<tr><td><strong>${esc(i.name)}</strong></td><td><label class="active-toggle"><input type="checkbox" class="instructor-active" data-id="${i.id}" ${i.active?'checked':''}> ${i.active?'Active':'Inactive'}</label></td><td>${next?`${fmt(next.start_at)} – ${fmt(next.end_at)}${next.reason?' · '+esc(next.reason):''}`:'—'}</td><td><button class="admin-btn secondary save-instructor-status" data-id="${i.id}">Save status</button></td></tr>`;}).join('')}</tbody></table>`;
    root.querySelectorAll('.save-instructor-status').forEach(btn=>btn.onclick=async()=>{const box=root.querySelector(`.instructor-active[data-id="${btn.dataset.id}"]`);const {error}=await client.from('instructors').update({active:box.checked}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Instructor status updated.','success');await loadInstructors();await load();}});
  }

  function renderPayments(payments,studentMap){const root=document.getElementById('paymentTable');if(!payments.length){root.innerHTML='<div class="empty">No payments recorded yet.</div>';return;}root.innerHTML=`<table class="admin-table"><thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Note</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${esc(p.paid_on)}</td><td>${esc(studentMap.get(p.student_id)?.full_name||studentMap.get(p.student_id)?.email||'Student')}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method||'—')}</td><td>${esc(p.receipt_number||'—')}</td><td>${esc(p.note||'')}</td></tr>`).join('')}</tbody></table>`;}
  function renderBlocks(blocks,instructorMap){const root=document.getElementById('blockTable');if(!blocks.length){root.innerHTML='<div class="empty">No unavailable periods recorded.</div>';return;}root.innerHTML=`<table class="admin-table"><thead><tr><th>Instructor</th><th>From</th><th>To</th><th>Reason</th><th></th></tr></thead><tbody>${blocks.map(b=>`<tr><td>${esc(instructorMap.get(b.instructor_id)?.name||'Instructor')}</td><td>${fmt(b.start_at)}</td><td>${fmt(b.end_at)}</td><td>${esc(b.reason||'—')}</td><td><button class="admin-btn danger delete-block" data-id="${b.id}">Remove</button></td></tr>`).join('')}</tbody></table>`;root.querySelectorAll('.delete-block').forEach(btn=>btn.onclick=async()=>{if(!confirm('Remove this unavailable period?'))return;const {error}=await client.from('instructor_unavailability').delete().eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Blocked time removed.','success');await load();}});}
  function renderStudents(students,payments){const root=document.getElementById('studentFeeTable');if(!students.length){root.innerHTML='<div class="empty">No student profiles yet.</div>';return;}root.innerHTML=`<table class="admin-table"><thead><tr><th>Student</th><th>Registration details</th><th>Applying for</th><th>Total course fee</th><th>Paid</th><th></th></tr></thead><tbody>${students.map(s=>{const paid=payments.filter(p=>p.student_id===s.id).reduce((sum,p)=>sum+Number(p.amount||0),0);return `<tr><td><strong>${esc(s.full_name||'Student')}</strong><br><small>${esc(s.email||'')}<br>${esc(s.phone||'')}</small></td><td><small>DOB: ${esc(s.date_of_birth||'—')}<br>Blood: ${esc(s.blood_group||'—')}<br>Pincode: ${esc(s.pincode||'—')}<br>${esc(s.address||'—')}</small></td><td><strong>${esc(s.applying_for||'—')}</strong></td><td><input class="student-total-fee" data-id="${s.id}" type="number" min="0" step="0.01" value="${Number(s.total_course_fee||0)}" style="width:120px"><br><button class="admin-btn secondary save-student-fee" data-id="${s.id}">Save</button></td><td><strong>${money(paid)}</strong></td><td><button class="admin-btn record-student-payment" data-id="${s.id}">Payment</button></td></tr>`;}).join('')}</tbody></table>`;root.querySelectorAll('.save-student-fee').forEach(btn=>btn.onclick=async()=>{const input=root.querySelector(`.student-total-fee[data-id="${btn.dataset.id}"]`);const {error}=await client.from('student_profiles').update({total_course_fee:Number(input.value)}).eq('id',btn.dataset.id);if(error)show(error.message,'error');else{show('Course fee updated.','success');await load();}});root.querySelectorAll('.record-student-payment').forEach(btn=>btn.onclick=()=>openPayment(btn.dataset.id,'',''));}

  function openPayment(studentId,bookingId,fee){document.getElementById('paymentStudent').value=studentId;document.getElementById('paymentBooking').value=bookingId||'';const student=cached.studentMap?.get(studentId);document.getElementById('paymentStudentDisplay').value=student?.full_name||student?.email||studentId;document.getElementById('paymentBookingDisplay').value=bookingId||'General course payment';document.querySelector('#paymentForm [name="amount"]').value=Number(fee||0)||'';document.getElementById('paymentFormCard').scrollIntoView({behavior:'smooth',block:'center'});}
  document.getElementById('paymentForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),studentId=fd.get('student_id'),bookingId=fd.get('booking_id')||null,amount=Number(fd.get('amount'));if(!studentId||!amount||amount<=0){show('Choose a student and enter a valid payment amount.','error');return;}const {error}=await client.from('fee_payments').insert({student_id:studentId,booking_id:bookingId,amount,paid_on:fd.get('payment_date'),payment_method:fd.get('payment_method'),receipt_number:fd.get('receipt_number')||null,note:fd.get('notes')||null,recorded_by:session.user.id});if(error){show(error.message,'error');return;}show('Payment recorded successfully.','success');e.target.reset();document.getElementById('paymentDate').value=new Date().toISOString().slice(0,10);await load();};
  document.getElementById('blockForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),start=new Date(fd.get('start_at')),end=new Date(fd.get('end_at'));if(end<=start){show('The end time must be after the start time.','error');return;}const {error}=await client.from('instructor_unavailability').insert({instructor_id:fd.get('instructor_id'),start_at:start.toISOString(),end_at:end.toISOString(),reason:fd.get('reason')||null,created_by:session.user.id});if(error)show(error.message,'error');else{show('Instructor time blocked.','success');e.target.reset();await load();}};
  document.getElementById('settingsForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),{error}=await client.from('school_settings').upsert({id:1,hourly_class_fee:Number(fd.get('hourly_class_fee')),updated_at:new Date().toISOString()});if(error)show(error.message,'error');else show('Hourly fee updated.','success');};
  document.getElementById('addInstructorForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),name=String(fd.get('name')||'').trim();if(!name)return;const {error}=await client.from('instructors').insert({name,active:true});if(error)show(error.message,'error');else{show('Instructor added.','success');e.target.reset();await loadInstructors();await load();}};
  document.getElementById('prevAdminDay').onclick=()=>{adminWeekStart.setDate(adminWeekStart.getDate()-1);renderAdminCalendar();};
  document.getElementById('nextAdminDay').onclick=()=>{adminWeekStart.setDate(adminWeekStart.getDate()+1);renderAdminCalendar();};
  document.getElementById('todayAdminDay').onclick=()=>{adminWeekStart=new Date();adminWeekStart.setHours(0,0,0,0);renderAdminCalendar();};
  document.getElementById('adminCalendarDate').onchange=(e)=>{if(e.target.value){const [y,m,day]=e.target.value.split('-').map(Number);adminWeekStart=new Date(y,m-1,day);adminWeekStart.setHours(0,0,0,0);renderAdminCalendar();}};
  document.getElementById('logoutBtn').onclick=async()=>{await client.auth.signOut();location.href='../admin/';};
  document.getElementById('refreshBtn').onclick=async()=>{try{await loadInstructors();await loadSettings();await load();show('Admin dashboard refreshed.','success');}catch(e){show(e.message,'error');}};
  document.getElementById('paymentDate').value=new Date().toISOString().slice(0,10);
  try{await loadInstructors();await loadSettings();await load();}catch(e){show(e.message||'Could not load admin data.','error');}
})();
