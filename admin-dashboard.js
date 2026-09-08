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
    const pending=bookings.filter(b=>['pending_payment','payment_recorded'].includes(b.status));
    const badge=pending.length?`<span class="request-count-badge">${pending.length} new</span>`:'';
    const heading=root.parentElement?.querySelector('.admin-section-title h2');
    if(heading)heading.innerHTML=`New booking requests ${badge}`;
    if(!pending.length){
      root.innerHTML='<div class="booking-inbox-empty"><div class="booking-inbox-icon">✓</div><div><strong>No new booking requests</strong><p>New student requests will appear here like notifications. Once you approve one, it leaves this inbox.</p></div></div>';
      return;
    }
    root.innerHTML=`<div class="booking-inbox">${pending.map(b=>{
      const student=studentMap.get(b.student_id)||{};
      const instructor=instructorMap.get(b.assigned_instructor_id)||instructorMap.get(b.preferred_instructor_id);
      const paid=payments.filter(p=>p.booking_id===b.id).reduce((sum,p)=>sum+Number(p.amount||0),0);
      const fee=Number(b.class_fee||0);
      const paymentReady=paid>=fee && fee>0;
      const statusLabel=b.status==='payment_recorded'?'Payment recorded':'Payment pending';
      return `<article class="booking-request-card">
        <div class="booking-request-main">
          <div class="booking-request-avatar">${esc((student.full_name||'S').trim().charAt(0).toUpperCase())}</div>
          <div class="booking-request-copy">
            <div class="booking-request-top"><strong>${esc(student.full_name||'Student')}</strong><span class="request-status ${paymentReady?'ready':''}">${esc(statusLabel)}</span></div>
            <div class="booking-request-class"><strong>${fmt(b.requested_start)}</strong><span>· ${b.duration_minutes/60} hour${b.duration_minutes===60?'':'s'}</span></div>
            <div class="booking-request-meta">${esc(instructor?.name||'Instructor not assigned')} · ${money(fee)} · Paid ${money(paid)}</div>
            ${student.phone||student.email?`<div class="booking-request-contact">${esc(student.phone||'')}${student.phone&&student.email?' · ':''}${esc(student.email||'')}</div>`:''}
          </div>
        </div>
        <div class="booking-request-action"><button class="admin-btn success-btn approve-booking" data-id="${b.id}">Approve</button></div>
      </article>`;
    }).join('')}</div>`;

    root.querySelectorAll('.approve-booking').forEach(btn=>btn.onclick=async()=>{
      if(!confirm('Approve this class?'))return;
      btn.disabled=true;btn.textContent='Approving…';
      const {error}=await client.rpc('approve_booking',{p_booking_id:btn.dataset.id});
      if(error){show(error.message,'error');btn.disabled=false;btn.textContent='Approve';}
      else{show('Class approved. The request has been cleared from the new-request inbox.','success');await load();}
    });
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

  const paymentStudentSearch=document.getElementById('paymentStudentSearch');
  const paymentStudentResults=document.getElementById('paymentStudentResults');
  const paymentStudentSelected=document.getElementById('paymentStudentSelected');
  const clearPaymentStudent=document.getElementById('clearPaymentStudent');
  let paymentSearchTimer=null;
  let paymentSearchToken=0;

  function setPaymentStudent(student){
    document.getElementById('paymentStudent').value=student?.id||'';
    paymentStudentSearch.value=student?(student.full_name||student.email||student.phone||''):'';
    paymentStudentSelected.textContent=student ? `${student.full_name||'Student'}${student.email?' · '+student.email:''}${student.phone?' · '+student.phone:''}` : 'No student selected';
    clearPaymentStudent.hidden=!student;
    paymentStudentResults.innerHTML='';
    paymentStudentResults.classList.remove('open');
  }

  function renderPaymentStudentResults(students){
    if(!students.length){
      paymentStudentResults.innerHTML='<div class="student-picker-empty">No students found.</div>';
    }else{
      paymentStudentResults.innerHTML=students.map(s=>`<button type="button" class="student-picker-option" data-student-id="${esc(s.id)}"><strong>${esc(s.full_name||'Student')}</strong><span>${esc(s.email||'')}${s.phone?' · '+esc(s.phone):''}</span></button>`).join('');
      paymentStudentResults.querySelectorAll('.student-picker-option').forEach(btn=>btn.onclick=()=>{
        const student=cached.studentMap?.get(btn.dataset.studentId);
        if(student)setPaymentStudent(student);
      });
    }
    paymentStudentResults.classList.add('open');
  }

  async function searchPaymentStudents(term){
    const q=String(term||'').trim();
    const token=++paymentSearchToken;
    if(q.length<2){paymentStudentResults.innerHTML='';paymentStudentResults.classList.remove('open');return;}
    paymentStudentResults.innerHTML='<div class="student-picker-loading">Searching students…</div>';
    paymentStudentResults.classList.add('open');
    const [byName,byEmail,byPhone]=await Promise.all([
      client.from('student_profiles').select('id,full_name,email,phone').ilike('full_name',`%${q}%`).limit(8),
      client.from('student_profiles').select('id,full_name,email,phone').ilike('email',`%${q}%`).limit(8),
      client.from('student_profiles').select('id,full_name,email,phone').ilike('phone',`%${q}%`).limit(8)
    ]);
    if(token!==paymentSearchToken)return;
    const firstError=byName.error||byEmail.error||byPhone.error;
    if(firstError){paymentStudentResults.innerHTML=`<div class="student-picker-empty">${esc(firstError.message)}</div>`;return;}
    const merged=new Map();[...(byName.data||[]),...(byEmail.data||[]),...(byPhone.data||[])].forEach(s=>merged.set(s.id,s));
    [...merged.values()].slice(0,12).forEach(s=>cached.studentMap?.set(s.id,s));
    renderPaymentStudentResults([...merged.values()].slice(0,12));
  }

  paymentStudentSearch.addEventListener('input',()=>{
    const value=paymentStudentSearch.value;
    if(document.getElementById('paymentStudent').value && value!==paymentStudentSelected.textContent.split(' · ')[0]){
      document.getElementById('paymentStudent').value='';
      paymentStudentSelected.textContent='No student selected';
      clearPaymentStudent.hidden=true;
    }
    clearTimeout(paymentSearchTimer);paymentSearchTimer=setTimeout(()=>searchPaymentStudents(value),220);
  });
  paymentStudentSearch.addEventListener('focus',()=>{if(paymentStudentSearch.value.trim().length>=2)searchPaymentStudents(paymentStudentSearch.value);});
  clearPaymentStudent.onclick=()=>{setPaymentStudent(null);paymentStudentSearch.focus();};
  document.addEventListener('click',e=>{if(!e.target.closest('.student-picker'))paymentStudentResults.classList.remove('open');});

  function openPayment(studentId,bookingId,fee){const student=cached.studentMap?.get(studentId);setPaymentStudent(student||null);document.getElementById('paymentBooking').value=bookingId||'';document.getElementById('paymentBookingDisplay').value=bookingId||'General course payment';document.querySelector('#paymentForm [name="amount"]').value=Number(fee||0)||'';document.getElementById('paymentFormCard').scrollIntoView({behavior:'smooth',block:'center'});}
  document.getElementById('paymentForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),studentId=fd.get('student_id'),bookingId=fd.get('booking_id')||null,amount=Number(fd.get('amount'));if(!studentId||!amount||amount<=0){show('Choose a student from the search results and enter a valid payment amount.','error');return;}const {error}=await client.from('fee_payments').insert({student_id:studentId,booking_id:bookingId,amount,paid_on:fd.get('payment_date'),payment_method:fd.get('payment_method'),receipt_number:fd.get('receipt_number')||null,note:fd.get('notes')||null,recorded_by:session.user.id});if(error){show(error.message,'error');return;}show('Payment recorded successfully.','success');e.target.reset();setPaymentStudent(null);document.getElementById('paymentDate').value=new Date().toISOString().slice(0,10);await load();};
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
