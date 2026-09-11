(async function(){
  const A=window.RajuAdmin;
  if(!(await A.guard()))return;
  A.bindShell();
  const db=A.client,$=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
  const fields=['enrolment_number','full_name','parent_relation_name','phone','permanent_address','temporary_address','official_address','date_of_birth','vehicle_class','enrollment_date','learner_license_number','learner_license_expiry','course_completion_date','competency_test_date','driving_license_number','driving_license_issue_date','driving_license_authority','remarks','blood_group'];
  function el(id){const node=$(id);if(!node) throw new Error('Register form field missing: '+id);return node}
  function val(id){return el(id).value||''}
  function msg(t,k='success'){const n=$('adminMessage');n.textContent=t;n.className='notice '+k;n.scrollIntoView({behavior:'smooth',block:'nearest'})}
  let photoData='';

  function row(x={}){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input type="date" data-k="date" value="${A.esc(x.date||'')}"></td><td><input type="time" data-k="from_time" value="${A.esc(x.from_time||'')}"></td><td><input type="time" data-k="to_time" value="${A.esc(x.to_time||'')}"></td><td><input data-k="vehicle_class" value="${A.esc(x.vehicle_class||'')}"></td><td><button type="button" data-remove>Remove</button></td>`;
    tr.querySelector('[data-remove]').onclick=()=>tr.remove();
    $('hoursBody').appendChild(tr);
  }
  function readHours(){return [...$('hoursBody').querySelectorAll('tr')].map(tr=>Object.fromEntries([...tr.querySelectorAll('[data-k]')].map(i=>[i.dataset.k,i.value||null]))).filter(x=>Object.values(x).some(Boolean))}
  function photoResize(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const maxW=500,maxH=650,s=Math.min(1,maxW/im.width,maxH/im.height),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};im.onerror=reject;im.src=r.result};r.onerror=reject;r.readAsDataURL(file)})}

  async function loadStudents(){
    const select=$('student_id');if(!select)return;
    const q=await db.from('student_profiles').select('id,full_name,phone,email,date_of_birth,blood_group,address,pincode,applying_for,course,enrollment_date').order('full_name');
    if(q.error){msg(q.error.message,'error');return}
    (q.data||[]).forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.full_name||'Student'}${s.phone?' · '+s.phone:''}`;o.dataset.json=JSON.stringify(s);select.appendChild(o)})
  }
  function prefill(){
    const select=$('student_id');if(!select)return;const o=select.selectedOptions[0];if(!o?.dataset.json)return;const s=JSON.parse(o.dataset.json);
    $('full_name').value=s.full_name||'';$('phone').value=s.phone||'';$('date_of_birth').value=s.date_of_birth||'';$('blood_group').value=s.blood_group||'';$('permanent_address').value=s.address||'';$('vehicle_class').value=s.applying_for||'';$('enrollment_date').value=s.enrollment_date||'';
  }
  $('student_id').onchange=prefill;
  $('photo').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{photoData=await photoResize(f);$('photoPreview').src=photoData}catch(err){msg('Could not read the photograph.','error')}};
  $('addHour').onclick=()=>row({vehicle_class:val('vehicle_class')});

  async function load(){
    try{
      await loadStudents();
      if(!id){row();return}
      const q=await db.from('student_register_entries').select('*').eq('id',id).maybeSingle();
      if(q.error||!q.data){msg(q.error?.message||'Register entry not found.','error');return}
      const st=q.data;$('pageTitle').textContent='Edit register entry';
      fields.forEach(k=>{if($(k))$(k).value=st[k]||''});
      if(st.student_id)$('student_id').value=st.student_id;
      photoData=st.photo_data||'';if(photoData)$('photoPreview').src=photoData;
      const h=await db.from('student_driving_hours').select('date,from_time,to_time,vehicle_class').eq('student_register_id',id).order('date',{ascending:true}).order('from_time',{ascending:true});
      if(h.error)msg(h.error.message,'error');
      (h.data||[]).forEach(row);if(!(h.data||[]).length)row({vehicle_class:st.vehicle_class||''});
    }catch(err){console.error(err);msg(err?.message||'Could not load the register entry.','error')}
  }

  $('form').onsubmit=async e=>{
    e.preventDefault();
    const button=$('form').querySelector('button[type="submit"]');
    const original=button?.textContent;
    if(button){button.disabled=true;button.textContent='Saving…'}
    try{
      const payload={};
      fields.forEach(k=>payload[k]=val(k));
      payload.student_id=val('student_id');
      payload.photo_data=photoData||'';
      const {data:registerId,error}=await db.rpc('admin_upsert_student_register',{p_id:id||null,p_payload:payload});
      if(error)throw error;
      const hq=await db.rpc('admin_replace_student_driving_hours',{p_register_id:registerId,p_hours:readHours()});
      if(hq.error)throw hq.error;

      msg(id?'Register entry updated successfully.':'New register entry created successfully.');
      const actions=$('saveActions');
      if(actions){
        actions.hidden=false;
        actions.innerHTML=`<strong>${id?'Updated':'Created'} successfully.</strong><a class="admin-btn secondary" href="print.html?id=${encodeURIComponent(registerId)}&form=14">View Form 14</a><a class="admin-btn secondary" href="print.html?id=${encodeURIComponent(registerId)}&form=15">View Form 15</a><a class="admin-btn" href="./">Back to register records</a>`;
      }
      $('pageTitle').textContent=id?'Register entry updated':'Register entry created';
      if(history.replaceState)history.replaceState(null,'',`edit.html?id=${encodeURIComponent(registerId)}`);
    }catch(err){
      console.error(err);msg(err?.message||'Could not save the register entry. Please try again.','error');
    }finally{
      if(button){button.disabled=false;button.textContent=original||'Save register entry'}
    }
  };
  load();
})();
