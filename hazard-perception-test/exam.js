(function(){
const clips=[
 {n:1,src:'assets/videos/clip-01.mp4',haz:[{t:3.0,label:'Pedestrian near the left edge may cross'},{t:4.3,label:'Motorcycle crosses into the traffic path'}]},
 {n:2,src:'assets/videos/clip-02.mp4',haz:[{t:4.0,label:'Blue bus creates a developing traffic conflict'},{t:27.0,label:'Vehicles converge/merge near the bridge approach'}]},
 {n:3,src:'assets/videos/clip-03.mp4',haz:[{t:7.0,label:'Dense auto-rickshaw traffic compresses the lane'},{t:25.0,label:'Side-road traffic enters/converges with the stream'}]},
 {n:4,src:'assets/videos/clip-04.mp4',haz:[{t:4.3,label:'Pedestrian starts to cross the road'},{t:23.4,label:'Auto-rickshaw starts to enter/cross the road'}]},
 {n:5,src:'assets/videos/clip-05.mp4',haz:[{t:5.0,label:'Motorcycle travels close to the lane'},{t:20.0,label:'Large oncoming bus passes with limited lateral space'}]},
 {n:6,src:'assets/videos/clip-06.mp4',haz:[{t:7.0,label:'Roadworks and barriers narrow the usable roadway'},{t:16.0,label:'Construction machinery creates an obstruction hazard'}]},
 {n:7,src:'assets/videos/clip-07.mp4',haz:[{t:5.0,label:'Temporary cones/roadworks reduce the usable lane'},{t:22.0,label:'Motorcycle/roadside traffic creates a close-proximity conflict'}]},
 {n:8,src:'assets/videos/clip-08.mp4',haz:[{t:6.0,label:'Traffic compresses around the bridge approach'},{t:24.0,label:'Truck/auto-rickshaw movement creates a merging conflict'}]},
 {n:9,src:'assets/videos/clip-09.mp4',haz:[{t:8.0,label:'Large bus passes close on the bridge'},{t:14.0,label:'Motorcycle/side traffic creates a developing conflict'}]},
 {n:10,src:'assets/videos/clip-10.mp4',haz:[{t:6.0,label:'Roadside works/temporary narrowing affects the lane'},{t:25.0,label:'Large vehicle and surrounding traffic create a close-proximity conflict'}]}
];
const S={mode:'',i:0,clicks:[],scoresByClip:{},timer:null,candidate:null,order:[]};
const $=s=>document.querySelector(s);
const esc=x=>String(x).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function shuffled(){return [...clips].sort(()=>Math.random()-0.5)}
function logo(){return `<img src="logo.svg" class="examLogo" alt="Raju Motor Driving School">`}
function start(mode){S.mode=mode;S.i=0;S.clicks=[];S.scoresByClip={};S.candidate=null;S.order=shuffled();renderIntro()}
function renderIntro(){
 const root=$(S.mode==='actual'?'#actualApp':'#practiceApp');
 root.className='introPage';
 root.innerHTML=`<section class="introCard"><img src="logo.svg" class="introLogo" alt="Raju Motor Driving School"><div class="heroKicker" style="margin-top:22px;color:#e51f2a">${S.mode==='actual'?'COMPUTER-BASED EXAMINATION':'TRAINING & PRACTICE'}</div><h1>${S.mode==='actual'?'Hazard Perception Examination':'Hazard Perception Practice'}</h1><p>${S.mode==='actual'?'You will complete 10 randomized road-scene clips. Identify developing hazards by clicking/tapping the video. Your responses are timed and scored.':'Practise with all 10 road-scene clips in a new randomized order. Replay and review your hazard responses.'}</p>${S.mode==='actual'?`<div class="fields"><div class="field"><label>Candidate Name</label><input id="name" autocomplete="off" autofocus></div><div class="field"><label>Phone Number</label><input id="phone" inputmode="tel" autocomplete="off"></div></div>`:''}<div class="formatRow"><div class="formatBox"><small>CLIPS</small><b>10</b></div><div class="formatBox"><small>MAXIMUM</small><b>100 marks</b></div><div class="formatBox"><small>PASS</small><b>60 marks</b></div></div><div class="introActions"><a class="backBtn" href="index.html">← BACK</a><button id="begin" class="begin">${S.mode==='actual'?'BEGIN EXAMINATION':'START PRACTICE'}</button></div></section>`;
 $('#begin').onclick=()=>{if(S.mode==='actual'){const n=$('#name').value.trim(),p=$('#phone').value.trim();if(!n||!p){alert('Please enter candidate name and phone number.');return}S.candidate={name:n,phone:p}};renderExam()};
}
function renderExam(){
 const c=S.order[S.i], root=$(S.mode==='actual'?'#actualApp':'#practiceApp');
 root.className='examPage';
 const dots=S.order.map((x,k)=>`<span class="clipDot ${k<S.i?'done':''} ${k===S.i?'current':''}"></span>`).join('');
 const who=S.candidate?`<div class="candidateInfo"><div><small>CANDIDATE</small><strong>${esc(S.candidate.name)}</strong></div><div><small>PHONE</small><strong>${esc(S.candidate.phone)}</strong></div><div><small>MODE</small><strong>ACTUAL TEST</strong></div></div>`:`<div class="candidateInfo"><div><small>MODE</small><strong>PRACTICE TEST</strong></div></div>`;
 root.innerHTML=`<header class="examTop">${logo()}<div class="examRight"><span class="modePill">${S.mode==='actual'?'EXAMINATION MODE':'PRACTICE MODE'}</span><a class="exit" href="index.html">✕ EXIT</a></div></header><section class="candidateStrip">${who}<div class="examProgress">${dots}</div></section><main class="mainExam"><section class="stage"><video id="video" class="video" src="${c.src}" playsinline preload="auto"></video><div id="clickLayer" class="clickLayer" aria-label="Click when you identify a developing hazard"></div><div class="topOverlay"><div class="clipBadge">CLIP ${String(S.i+1).padStart(2,'0')} / 10</div><div id="timer" class="timer">01:00</div></div><div class="bottomOverlay"><div class="hint">CLICK / TAP WHEN YOU IDENTIFY A DEVELOPING HAZARD</div><div class="timeline"><div class="timelineTrack"></div><div id="flags"></div></div><div class="controlRow"><div id="count" class="responsePill">RESPONSES <b>0 / 5</b></div><div><button id="next" class="examBtn nextBtn">${S.i===9?'SUBMIT EXAMINATION':'NEXT CLIP'} →</button></div></div></div></section><aside class="side"><div class="sideCard"><div class="sideTitle">CURRENT CLIP</div><div class="sideScore"><span id="liveScore">—</span><span>/ 10 possible</span></div><div class="rules">Two developing hazards are annotated for this clip. Each can score up to <b>5 marks</b>.</div></div><div class="sideCard"><div class="sideTitle">EXAM PROGRESS</div><div class="clipList">${S.order.map((x,k)=>`<div class="clipBox ${k<S.i?'done':''} ${k===S.i?'current':''}">${String(k+1).padStart(2,'0')}</div>`).join('')}</div><div class="rules" style="margin-top:12px">Maximum <b>5 responses</b> per clip. A sixth response makes that clip <b>0</b>.</div></div><div class="sideBottom">${S.mode==='practice'?'<button id="replay" class="smallBtn">REPLAY</button><button id="prev" class="smallBtn">PREVIOUS</button>':''}<button id="home" class="smallBtn">HOME</button></div></aside></main>`;
 wire(c);
}
function wire(c){
 const v=$('#video'),layer=$('#clickLayer'),flags=$('#flags'),count=$('#count'),timer=$('#timer'),live=$('#liveScore');
 S.clicks=[];let locked=false,ended=false,startTime=Date.now();clearInterval(S.timer);
 const renderCount=()=>{count.innerHTML=`RESPONSES <b>${S.clicks.length} / 5</b>`};
 const addFlag=t=>{const x=Math.min(99,Math.max(1,(t/Math.max(v.duration||1,.1))*100));const f=document.createElement('div');f.className='flag';f.style.left=x+'%';f.textContent=S.clicks.length;flags.appendChild(f)};
 const scoreNow=()=>{let used=new Set(),score=0;S.clicks.forEach(t=>c.haz.forEach((h,idx)=>{if(used.has(idx))return;const d=t-h.t;if(d>=0&&d<=1.5){score+=5;used.add(idx)}else if(d>1.5&&d<=2.5){score+=4;used.add(idx)}else if(d>2.5&&d<=3.5){score+=3;used.add(idx)}else if(d>3.5&&d<=5){score+=2;used.add(idx)}}));return Math.min(10,score)};
 const grade=()=>{if(S.clicks.length>5)return 0;return scoreNow()};
 const finishClip=()=>{if(locked)return;locked=true;clearInterval(S.timer);const score=grade();S.scoresByClip[c.n]=score;live.textContent=score;layer.style.cursor='not-allowed';if(S.mode==='practice')showPracticeReview(c,score);};
 v.controls=false;v.currentTime=0;v.play().catch(()=>{});
 S.timer=setInterval(()=>{const remain=Math.max(0,60-(Date.now()-startTime)/1000);timer.textContent=remain<=0?'00:00':`00:${String(Math.ceil(remain)).padStart(2,'0')}`;if(remain<=10)timer.classList.add('warn');if(remain<=0){ended=true;finishClip()}},100);
 v.addEventListener('ended',()=>{ended=true;finishClip()},{once:true});
 layer.onclick=()=>{if(locked||ended)return;const t=v.currentTime;S.clicks.push(t);addFlag(t);renderCount();if(S.clicks.length===6){finishClip()}else live.textContent=scoreNow()};
 $('#next').onclick=()=>{finishClip();if(S.i<9){S.i++;renderExam()}else finishAll()};
 if($('#replay'))$('#replay').onclick=()=>{if(locked)return;v.currentTime=0;startTime=Date.now();timer.classList.remove('warn');v.play().catch(()=>{})};
 if($('#prev'))$('#prev').onclick=()=>{if(S.i>0){S.i--;renderExam()}};
 $('#home').onclick=()=>location.href='index.html';
 renderCount();
}
function showPracticeReview(c,score){
 const existing=document.querySelector('.reviewModal');if(existing)existing.remove();
 const clicks=S.clicks.map((t,i)=>`<span>${i+1}. ${fmt(t)}</span>`).join('');
 const hazards=c.haz.map((h,i)=>`<div class="reviewHaz"><b>Hazard ${i+1}</b><span>${esc(h.label)}</span><em>Developing point ≈ ${fmt(h.t)}</em></div>`).join('');
 const modal=document.createElement('div');modal.className='reviewModal';modal.innerHTML=`<div class="reviewCard"><div class="heroKicker" style="color:#e51f2a">CLIP ${String(c.n).padStart(2,'0')} REVIEW</div><h2>${score}/10</h2><div class="reviewHazards">${hazards}</div><div class="reviewClicks"><b>Your responses</b>${clicks||'<span>No responses</span>'}</div><button id="closeReview" class="begin">CONTINUE</button></div>`;document.body.appendChild(modal);$('#closeReview').onclick=()=>modal.remove();
}
function finishAll(){clearInterval(S.timer);const total=clips.reduce((sum,c)=>sum+(S.scoresByClip[c.n]??0),0);const root=$(S.mode==='actual'?'#actualApp':'#practiceApp');root.className='resultPage';const status=S.mode==='actual'?(total>=60?'PASS':'NOT PASSED'):'PRACTICE COMPLETE';const cls=S.mode==='actual'&&total>=60?'pass':'';root.innerHTML=`<section class="resultCard"><img src="logo.svg" class="introLogo" alt="Raju Motor Driving School"><div class="heroKicker" style="margin-top:18px;color:#e51f2a">${S.mode==='actual'?'EXAMINATION RESULT':'PRACTICE RESULT'}</div><h1>${S.mode==='actual'?'Test Complete':'Practice Complete'}</h1>${S.candidate?`<p><b>${esc(S.candidate.name)}</b> • ${esc(S.candidate.phone)}</p>`:''}<div class="bigScore">${total}<small> / 100</small></div><div class="resultStatus ${cls}">${status}</div><div class="resultGrid">${clips.map(c=>`<div class="resultClip">CLIP ${String(c.n).padStart(2,'0')}<b>${S.scoresByClip[c.n]??0}/10</b></div>`).join('')}</div><p style="font-size:11px;color:#718087">Scoring is based on the developing-hazard timings identified for each local training clip. The same clip can appear in a different position on the next randomized attempt.</p><a class="returnBtn" href="index.html">RETURN TO HPT HOME</a></section>`}
window.HPT={start};
})();
