(async function(){
  const A=window.RajuAdmin;if(!(await A.guard()))return;
  const db=A.client,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),id=params.get('id'),form=params.get('form')||'14';
  function esc(v){return A.esc(v||'')}
  function date(v){if(!v)return '';const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d)}
  function time(v){if(!v)return '';const d=new Date('1970-01-01T'+String(v).slice(0,5));return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}).format(d)}
  const q=await db.from('student_register_entries').select('*').eq('id',id).maybeSingle();
  if(q.error||!q.data){$('pages').innerHTML='<div class="sheet"><h1>Register entry not found</h1><p>'+esc(q.error?.message||'No record was found.')+'</p></div>';return}
  const s=q.data;
  const h=await db.from('student_driving_hours').select('*').eq('student_register_id',id).order('date',{ascending:true}).order('from_time',{ascending:true});
  const hours=h.data||[];
  const p=$('pages');

  function form14(){return `<section class="sheet f14-page">
    <div class="f14-head">
      <h1>FORM 14</h1><div class="rule">(See rule 27 (a) and (c))</div>
      <div class="form14-title">Register showing the enrolment of trainee(s) in the<br>driving school establishments</div>
    </div>
    <div class="top-year">Register for the Year........................................................</div>
    <div class="photo-box">${s.photo_data?`<img src="${esc(s.photo_data)}" alt="Photograph">`:'Photo'}</div>
    <div class="f14-body">
      <div class="f14-row"><span>1. Enrolment Number</span><b>:</b><span>${esc(s.enrolment_number)}</span></div>
      <div class="f14-row"><span>2. Name of the trainee with this Photograph</span><b>:</b><span>${esc(s.full_name)}</span></div>
      <div class="f14-row"><span>3. Son/Wife/Daughter of</span><b>:</b><span>${esc(s.parent_relation_name)}</span></div>
      <div class="f14-row"><span>4. Address</span><b>:</b><span></span></div>
      <div class="address-block">
        <div class="address-line"><span>(a) Permanent Address</span><b>:</b><span>${esc(s.permanent_address)}</span></div>
        <div class="address-line"><span>(b) Temporary Address</span><b>:</b><span>${esc(s.temporary_address)}</span></div>
        <div class="address-line official"><span>Official address<br>(if any)</span><b>:</b><span>${esc(s.official_address)}</span></div>
      </div>
      <div class="f14-row"><span>5. Date of Birth</span><b>:</b><span>${date(s.date_of_birth)}</span></div>
      <div class="f14-row"><span>6. Class of Vehicle for which<br>training imparted</span><b>:</b><span>${esc(s.vehicle_class)}</span></div>
      <div class="f14-row"><span>7. Date of enrolment</span><b>:</b><span>${date(s.enrollment_date)}</span></div>
      <div class="f14-row"><span>8. Learner’s licence number and date<br>of its expiry</span><b>:</b><span>${esc(s.learner_license_number)}${s.learner_license_expiry?' &nbsp; '+date(s.learner_license_expiry):''}</span></div>
      <div class="f14-row"><span>9. Date of completion of the course</span><b>:</b><span>${date(s.course_completion_date)}</span></div>
      <div class="f14-row"><span>10. Date of passing the test of competence<br>to drive</span><b>:</b><span>${date(s.competency_test_date)}</span></div>
      <div class="f14-row"><span>11. Driving licence number and date<br>of issue and the licensing authority<br>which issued the licence</span><b>:</b><span>${esc(s.driving_license_number)}${s.driving_license_issue_date?' &nbsp; '+date(s.driving_license_issue_date):''}${s.driving_license_authority?' &nbsp; '+esc(s.driving_license_authority):''}</span></div>
      <div class="f14-row"><span>12. Remarks</span><b>:</b><span>${esc(s.remarks)}</span></div>
      <div class="bottom-sign">13. Signature of the licence holder<br>instructor<br><span class="blank-line"></span></div>
    </div>
  </section>`}

  function form15(){
    let rows='';
    for(let i=0;i<Math.max(25,hours.length);i++){
      const x=hours[i]||{};
      rows+=`<tr><td>${date(x.date)}</td><td>${time(x.from_time)}</td><td>${time(x.to_time)}</td><td>${esc(x.vehicle_class)}</td><td></td></tr>`;
    }
    return `<section class="sheet f15-page">
      <div class="form15-title">FORM - 15</div>
      <div class="form15-sub">{See Rule 27(i).}<br>Register showing the driving hours spent by a trainee</div>
      <div class="f15-meta">
        <div><span>Name of school / Establishment</span><b>:</b> Raju Driving School</div>
        <div><span>Name of the Trainee</span><b>:</b> ${esc(s.full_name)}</div>
        <div><span>Enrolment Number</span><b>:</b> ${esc(s.enrolment_number)}</div>
        <div><span>Date of birth</span><b>:</b> ${date(s.date_of_birth)}</div>
        <div><span>Learner’s No.</span><b>:</b> ${esc(s.learner_license_number)}</div>
        <div><span>Driving licence No.</span><b>:</b> ${esc(s.driving_license_number)}</div>
        <div><span>Blood Group</span><b>:</b> ${esc(s.blood_group)}</div>
        <div><span>Behaviour</span><b>:</b></div>
      </div>
      <table class="hours-table"><thead>
        <tr><th rowspan="2">Date</th><th colspan="2" class="group">Hours Spent in actual driving</th><th rowspan="2">Class of vehicle</th><th rowspan="2">Signature<br>of the student</th></tr>
        <tr><th>From ........ hrs.</th><th>To........ hrs.</th></tr>
        <tr class="numbers"><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
      </thead><tbody>${rows}</tbody></table>
      <div class="instructor-sign">Signature<br>of instructor<br><span class="blank-line"></span></div>
    </section>`
  }

  const sections=[];
  if(form==='14'||form==='all')sections.push(form14());
  if(form==='15'||form==='all')sections.push(form15());
  p.innerHTML=sections.join('');

  function pdf(make){
    if(!window.jspdf?.jsPDF){alert('PDF library did not load.');return}
    const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});const pages=document.querySelectorAll('.sheet');let idx=0;
    function renderNext(){
      if(idx>=pages.length){doc.save(`${(s.enrolment_number||s.full_name||'student').replace(/[^a-z0-9_-]+/gi,'_')}_${make}.pdf`);return}
      const clone=pages[idx].cloneNode(true);clone.style.position='absolute';clone.style.left='-100000px';clone.style.top='0';clone.style.width='210mm';clone.style.minHeight='297mm';clone.style.margin='0';clone.style.boxShadow='none';document.body.appendChild(clone);
      html2canvas(clone,{scale:2,useCORS:true,backgroundColor:'#fff',logging:false}).then(c=>{if(idx)doc.addPage();doc.addImage(c.toDataURL('image/jpeg',.96),'JPEG',0,0,210,297);clone.remove();idx++;renderNext()}).catch(()=>{clone.remove();alert('Could not render the PDF. Use Print and choose Save as PDF.')});
    }
    renderNext();
  }
  function nav(target){location.href=`print.html?id=${encodeURIComponent(id)}&form=${target}`}
  $('back').onclick=()=>history.back();
  $('view14').onclick=()=>nav('14');
  $('view15').onclick=()=>nav('15');
  $('downloadCurrent').onclick=()=>pdf(form==='all'?'forms14-15':`form${form}`);
  $('downloadAll').onclick=()=>form==='all'?pdf('forms14-15'):nav('all');
  $('print').onclick=()=>window.print();
  if(form==='all'){$('downloadCurrent').style.display='none';$('downloadAll').textContent='Download Both PDFs'}
  else {$('downloadCurrent').textContent=`Download Form ${form} PDF`}
})();
