/* Raju HPT PDF analysis report generator — compact 2-page evidence report */
(function(){
  'use strict';
  function fmtTime(s){
    if(s==null || isNaN(Number(s))) return '—';
    s=Number(s); var sign=s<0?'-':''; s=Math.abs(s), m=Math.floor(s/60), sec=(s%60).toFixed(1);
    return sign+String(m).padStart(2,'0')+':'+sec.padStart(4,'0');
  }
  function safeName(s){return String(s||'Candidate').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'Candidate'}
  function imgData(url){return new Promise(function(resolve,reject){
    var img=new Image(); img.crossOrigin='anonymous';
    img.onload=function(){try{var c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;var x=c.getContext('2d');x.drawImage(img,0,0);resolve(c.toDataURL('image/jpeg',.80))}catch(e){reject(e)}};
    img.onerror=reject; img.src=url+(url.indexOf('?')>=0?'&':'?')+'report='+Date.now();
  })}
  function captureFrame(url,time){return new Promise(function(resolve,reject){
    var v=document.createElement('video'); v.muted=true; v.playsInline=true; v.preload='auto'; v.crossOrigin='anonymous';
    var done=false, timer=setTimeout(function(){if(!done){done=true;cleanup();reject(new Error('Video frame timeout'))}},9000);
    function cleanup(){clearTimeout(timer);try{v.pause();v.removeAttribute('src');v.load()}catch(e){}}
    function fail(e){if(done)return;done=true;cleanup();reject(e||new Error('Frame capture failed'))}
    v.onerror=function(){fail(new Error('Video unavailable'))};
    v.onloadedmetadata=function(){try{v.currentTime=Math.max(0,Math.min(Number(time)||0,(v.duration||Number(time)||0)))}catch(e){fail(e)}};
    v.onseeked=function(){if(done)return;try{var c=document.createElement('canvas'),w=640,h=360;if(v.videoWidth&&v.videoHeight){var r=Math.min(w/v.videoWidth,h/v.videoHeight);w=Math.max(1,Math.round(v.videoWidth*r));h=Math.max(1,Math.round(v.videoHeight*r))}c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);var data=c.toDataURL('image/jpeg',.76);done=true;cleanup();resolve(data)}catch(e){fail(e)}};
    v.src=url;try{v.load()}catch(e){fail(e)}
  })}
  async function frameFor(clip,time){
    if(!clip||!clip.file||time==null)return null;
    try{return await captureFrame(clip.file,time)}catch(e){
      var n=String(clip.clip_code||'').replace(/\D/g,'');
      if(n){try{return await imgData('thumbnails/'+Number(n)+'.jpg')}catch(err){}}
      return null;
    }
  }
  function header(doc,W,page,total){
    doc.setFillColor(5,10,15);doc.rect(0,0,W,17,'F');
    doc.setTextColor(255,196,0);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('RAJU DRIVING SCHOOL',12,8);
    doc.setTextColor(190,202,210);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('HAZARD PERCEPTION TEST • COMPLETE ANALYSIS REPORT',12,13);
    doc.setTextColor(130,145,155);doc.setFontSize(7);doc.text('Page '+page+' / '+total,W-12,10,{align:'right'});
  }
  function footer(doc,W,H){doc.setDrawColor(55,70,80);doc.line(10,H-9,W-10,H-9);doc.setTextColor(110,122,132);doc.setFont('helvetica','normal');doc.setFontSize(6.3);doc.text('Raju Motor Driving School • Chalakudy • Hazard Perception Test',10,H-4.5);doc.text('Generated electronically',W-10,H-4.5,{align:'right'})}
  function txt(doc,s,x,y,size,bold,color,align){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor.apply(doc,color||[35,50,62]);doc.text(String(s==null?'':s),x,y,{align:align||'left'})}
  function cell(doc,x,y,w,h,fill,stroke){doc.setFillColor.apply(doc,fill);doc.rect(x,y,w,h,'F');if(stroke){doc.setDrawColor.apply(doc,stroke);doc.rect(x,y,w,h,'S')}}
  async function generate(exam){
    if(!exam||!window.jspdf||!window.jspdf.jsPDF)throw new Error('PDF generator is not available.');
    var jsPDF=window.jspdf.jsPDF,clips=exam.clips||[],name=exam.candidate_name||exam.candidate?.name||'Candidate',phone=exam.phone||exam.candidate?.phone||'—';
    var total=Number(exam.total_score||exam.total||0),passed=!!exam.passed||total>=60,d=new Date(exam.completed_at||Date.now());
    var rows=[];
    clips.forEach(function(c,i){
      var hazards=(c.hazards||[]).slice().sort(function(a,b){return Number(a.hazard_no)-Number(b.hazard_no)}),rs=c.responses||[];
      hazards.forEach(function(h,hi){var match=rs.find(function(r){return Number(r.hazard_no)===Number(h.hazard_no)});var ht=Number(h.t)||0,ct=match?Number(match.t):null,pts=match?Number(match.points||0):0;rows.push({clip:c,clipIndex:i+1,hazard:h,hazardIndex:hi+1,match:match,ht:ht,ct:ct,reaction:match?ct-ht:null,points:pts,max:hazards.length===1?10:5,status:pts>0?'IDENTIFIED':'MISSED'})});
      rs.filter(function(r){return !hazards.some(function(h){return Number(h.hazard_no)===Number(r.hazard_no)})}).forEach(function(r){rows.push({clip:c,clipIndex:i+1,hazard:null,hazardIndex:null,match:r,ht:null,ct:Number(r.t),reaction:null,points:Number(r.points||0),max:0,status:'EXTRA CLICK'})});
    });
    var doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),W=297,H=210,totalPages=2;
    header(doc,W,1,totalPages);
    txt(doc,'HPT COMPLETE ANALYSIS',14,28,17,true,[20,34,48]);
    txt(doc,'Candidate: '+name,14,36,8.5,true,[50,64,75]);txt(doc,'Phone: '+phone,14,42,7.5,false,[90,105,115]);txt(doc,'Completed: '+d.toLocaleString('en-IN'),14,48,7.5,false,[90,105,115]);
    txt(doc,passed?'PASS':'NOT PASSED',250,29,12,true,passed?[20,135,70]:[210,60,75],'right');txt(doc,total+' / 100',250,40,20,true,[184,132,12],'right');txt(doc,'Pass mark: 60 / 100',250,47,7.5,false,[90,105,115],'right');
    var totalHazards=clips.reduce(function(a,c){return a+(c.hazards||[]).length},0),identified=0,missed=0,clicks=0;clips.forEach(function(c){clicks+=(c.responses||[]).length;(c.hazards||[]).forEach(function(h){var r=(c.responses||[]).find(function(x){return Number(x.hazard_no)===Number(h.hazard_no)});if(r&&Number(r.points)>0)identified++;else missed++})});
    var metrics=[['CLIPS',clips.length],['OFFICIAL HAZARDS',totalHazards],['IDENTIFIED',identified],['MISSED',missed],['CLICKS',clicks]];metrics.forEach(function(m,i){var x=14+i*48;cell(doc,x,53,43,18,[10,25,36],[50,70,82]);txt(doc,m[0],x+21.5,60,5.4,true,[155,168,176],'center');txt(doc,m[1],x+21.5,68.5,11,true,[255,196,0],'center')});
    txt(doc,'Hazard evidence analysis',14,80,10.5,true,[20,34,48]);txt(doc,'Actual hazard frame + timestamp compared with the candidate response frame + click timestamp.',14,86,6.5,false,[95,108,118]);
    var tableY=90,headerH=8,rowH=11.2,cols=[14,37,68,91,114,137,157,179,227,282];
    cell(doc,14,tableY,269,headerH,[12,31,43],[50,70,82]);
    ['CLIP','HAZARD','OFFICIAL','CLICK','REACTION','MARKS','STATUS','EVIDENCE'].forEach(function(v,i){txt(doc,v,cols[i]+1.5,tableY+5.5,5.2,true,[190,202,210])});
    async function drawRows(from,to,startY){var y=startY;for(var ri=from;ri<to;ri++){var r=rows[ri];cell(doc,14,y,269,rowH,ri%2===0?[244,247,249]:[232,238,242]);txt(doc,'Clip '+String(r.clip.clip_code||r.clipIndex).padStart(2,'0'),cols[0]+1.5,y+7,5.7,true,[35,50,62]);txt(doc,r.hazard?'Hazard '+r.hazard.hazard_no:'Extra',cols[1]+1.5,y+7,5.5,false,[55,68,78]);txt(doc,r.ht==null?'—':fmtTime(r.ht),cols[2]+1.5,y+7,5.5,false,[55,68,78]);txt(doc,r.ct==null?'—':fmtTime(r.ct),cols[3]+1.5,y+7,5.5,false,[55,68,78]);txt(doc,r.reaction==null?'—':fmtTime(r.reaction),cols[4]+1.5,y+7,5.5,false,[55,68,78]);txt(doc,r.max?((r.points||0)+' / '+r.max):String(r.points||0),cols[5]+1.5,y+7,5.5,true,[184,132,12]);txt(doc,r.status,cols[6]+1.5,y+7,5.2,true,r.status==='IDENTIFIED'?[25,125,65]:r.status==='MISSED'?[190,50,65]:[100,100,100]);
        if(r.hazard){var actual=await frameFor(r.clip,r.ht),response=r.match?await frameFor(r.clip,r.ct):null;var ix=cols[7]+1.5,iy=y+0.6;if(actual)doc.addImage(actual,'JPEG',ix,iy,17,10);else{cell(doc,ix,iy,17,10,[205,211,215]);txt(doc,'A',ix+8.5,iy+6,5,true,[100,110,118],'center')}if(response)doc.addImage(response,'JPEG',ix+19,iy,17,10);else{cell(doc,ix+19,iy,17,10,[205,211,215]);txt(doc,r.match?'R':'—',ix+27.5,iy+6,5,true,[100,110,118],'center')}txt(doc,'A '+(r.ht==null?'—':fmtTime(r.ht)),ix+39,iy+4.2,4.8,true,[65,80,90]);txt(doc,'R '+(r.ct==null?'—':fmtTime(r.ct)),ix+39,iy+8.8,4.8,true,[65,80,90]);}
        else txt(doc,'—',cols[7]+35,y+7,5.5,false,[120,130,138],'center');y+=rowH;}return y;}
    var first=Math.min(10,rows.length);await drawRows(0,first,tableY+headerH);txt(doc,'A = actual hazard frame   R = candidate response frame   Reaction = candidate click time − official hazard time',14,202,5.7,false,[100,112,122]);footer(doc,W,H);
    doc.addPage();header(doc,W,2,totalPages);txt(doc,'Hazard evidence analysis — continued',14,29,14,true,[20,34,48]);txt(doc,'Remaining clips / hazards and candidate responses',14,36,6.5,false,[95,108,118]);cell(doc,14,42,269,headerH,[12,31,43],[50,70,82]);['CLIP','HAZARD','OFFICIAL','CLICK','REACTION','MARKS','STATUS','EVIDENCE'].forEach(function(v,i){txt(doc,v,cols[i]+1.5,47.5,5.2,true,[190,202,210])});await drawRows(first,rows.length,50);
    txt(doc,'Scoring rule: one official hazard in a clip = up to 10 marks; two official hazards = up to 5 marks each. Candidate clicks are recorded independently from the official hazard timestamps.',14,199,5.7,false,[100,112,122]);footer(doc,W,H);
    doc.save('Raju-HPT-Analysis-'+safeName(name)+'-'+d.toISOString().slice(0,10)+'.pdf');
  }
  window.RajuHPTReport={generate:generate};
})();
