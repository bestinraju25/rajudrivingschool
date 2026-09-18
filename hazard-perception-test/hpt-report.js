/* Raju HPT — compact evidence report. Safe when video frame capture is unavailable. */
(function(){
  'use strict';
  function fmtTime(v){
    if(v===null||v===undefined||isNaN(Number(v))) return '—';
    var s=Number(v), sign=s<0?'-':''; s=Math.abs(s);
    var m=Math.floor(s/60), sec=(s%60).toFixed(1);
    return sign+String(m).padStart(2,'0')+':'+sec.padStart(4,'0');
  }
  function safeName(s){return String(s||'Candidate').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'Candidate'}
  function imageData(url){return new Promise(function(resolve,reject){
    var img=new Image(); img.onload=function(){try{
      var c=document.createElement('canvas'),w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
      if(!w||!h)throw new Error('image has no size'); c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0);resolve(c.toDataURL('image/jpeg',.82));
    }catch(e){reject(e)}}; img.onerror=function(){reject(new Error('image unavailable'))}; img.src=url+(url.indexOf('?')>=0?'&':'?')+'report='+Date.now();
  })}
  function captureFrame(url,time){return new Promise(function(resolve,reject){
    var v=document.createElement('video'),done=false;
    var timer=setTimeout(function(){if(!done){done=true;cleanup();reject(new Error('frame timeout'))}},4500);
    v.muted=true; v.playsInline=true; v.preload='auto'; v.crossOrigin='anonymous';
    function cleanup(){clearTimeout(timer);try{v.pause();v.removeAttribute('src');v.load()}catch(e){}}
    function fail(e){if(done)return;done=true;cleanup();reject(e||new Error('frame failed'))}
    v.onerror=function(){fail(new Error('video unavailable'))};
    v.onloadedmetadata=function(){try{var t=Math.max(0,Math.min(Number(time)||0,(v.duration||Number(time)||0)-.05));v.currentTime=t}catch(e){fail(e)}};
    v.onseeked=function(){if(done)return;try{
      var c=document.createElement('canvas'),maxW=640,maxH=360,w=v.videoWidth||640,h=v.videoHeight||360,r=Math.min(maxW/w,maxH/h,1);
      c.width=Math.max(1,Math.round(w*r));c.height=Math.max(1,Math.round(h*r));c.getContext('2d').drawImage(v,0,0,c.width,c.height);var data=c.toDataURL('image/jpeg',.76);done=true;cleanup();resolve(data);
    }catch(e){fail(e)}};
    v.src=url;try{v.load()}catch(e){fail(e)}
  })}
  async function frameFor(clip,time,fallbackData){
    if(fallbackData)return fallbackData;
    if(clip&&clip.file&&time!==null&&time!==undefined){try{return await captureFrame(clip.file,time)}catch(e){}}
    var n=String(clip&&clip.clip_code||'').replace(/\D/g,'');
    if(n){try{return await imageData('thumbnails/'+Number(n)+'.jpg')}catch(e){}}
    return null;
  }
  function txt(doc,s,x,y,size,bold,color,align){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor.apply(doc,color||[45,58,68]);doc.text(String(s==null?'':s),x,y,{align:align||'left'});}
  function box(doc,x,y,w,h,fill,stroke){doc.setFillColor.apply(doc,fill);doc.rect(x,y,w,h,'F');if(stroke){doc.setDrawColor.apply(doc,stroke);doc.rect(x,y,w,h,'S')}}
  function header(doc,W,page,total){doc.setFillColor(5,10,15);doc.rect(0,0,W,16,'F');txt(doc,'RAJU DRIVING SCHOOL',11,7.5,10.5,true,[255,196,0]);txt(doc,'HAZARD PERCEPTION TEST • COMPLETE ANALYSIS REPORT',11,12.5,6.5,false,[190,202,210]);txt(doc,'Page '+page+' / '+total,W-11,9.5,6.5,false,[130,145,155],'right');}
  function footer(doc,W,H){doc.setDrawColor(55,70,80);doc.line(10,H-8,W-10,H-8);txt(doc,'Raju Motor Driving School • Chalakudy • Hazard Perception Test',10,H-4,6,false,[110,122,132]);txt(doc,'Generated electronically',W-10,H-4,6,false,[110,122,132],'right');}
  async function generate(exam){
    if(!exam||!window.jspdf||!window.jspdf.jsPDF)throw new Error('PDF generator is not available.');
    var jsPDF=window.jspdf.jsPDF,clips=exam.clips||[],name=exam.candidate_name||'Candidate',phone=exam.phone||'—',total=Number(exam.total_score||exam.total||0),passed=!!exam.passed||total>=60,d=new Date(exam.completed_at||Date.now());
    var rows=[];
    clips.forEach(function(c,i){
      var hs=(c.hazards||[]).slice().sort(function(a,b){return Number(a.hazard_no)-Number(b.hazard_no)}),rs=c.responses||[];
      hs.forEach(function(h,hi){var m=null;for(var j=0;j<rs.length;j++){if(Number(rs[j].hazard_no)===Number(h.hazard_no)){m=rs[j];break}}
        var ht=Number(h.t)||0,ct=m&&m.t!=null?Number(m.t):null,pts=m?Number(m.points||0):0;
        rows.push({clip:c,clipIndex:i+1,hazard:h,match:m,ht:ht,ct:ct,reaction:m?ct-ht:null,points:pts,max:hs.length===1?10:5,status:pts>0?'IDENTIFIED':'MISSED'});
      });
    });
    var totalHazards=rows.length,identified=rows.filter(function(r){return r.points>0}).length,missed=totalHazards-identified;
    var doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),W=297,H=210;
    var perPage=10,totalPages=Math.max(1,Math.ceil(rows.length/perPage));
    for(var page=0;page<totalPages;page++){
      if(page)doc.addPage();header(doc,W,page+1,totalPages);
      if(page===0){
        txt(doc,'HPT COMPLETE ANALYSIS',12,27,16,true,[20,34,48]);
        txt(doc,'Candidate: '+name,12,35,8.5,true,[50,64,75]);txt(doc,'Phone: '+phone,12,41,7.5,false,[90,105,115]);txt(doc,'Completed: '+d.toLocaleString('en-IN'),12,47,7.5,false,[90,105,115]);
        txt(doc,passed?'PASS':'NOT PASSED',250,28,11,true,passed?[20,135,70]:[210,60,75],'right');txt(doc,total+' / 100',250,39,18,true,[184,132,12],'right');txt(doc,'Pass mark: 60 / 100',250,46,7.5,false,[90,105,115],'right');
        var metrics=[['CLIPS',clips.length],['HAZARDS',totalHazards],['IDENTIFIED',identified],['MISSED',missed]];metrics.forEach(function(m,i){var x=12+i*63.5;box(doc,x,51,58,17,[10,25,36],[50,70,82]);txt(doc,m[0],x+29,58,5,true,[155,168,176],'center');txt(doc,m[1],x+29,66,10.5,true,[255,196,0],'center')});
        txt(doc,'Hazard evidence — actual hazard vs candidate response',12,76,9.5,true,[20,34,48]);txt(doc,'A = actual hazard frame/time   R = candidate response frame/time   Reaction = response time − official hazard time. Extra clicks are not included.',12,82,5.8,false,[95,108,118]);
      } else {txt(doc,'Hazard evidence analysis — continued',12,27,14,true,[20,34,48]);txt(doc,'Remaining hazards and candidate responses',12,34,6.5,false,[95,108,118]);}
      var tableY=page===0?86:40,rowH=12.7,headH=8;
      var x0=12,w=273, cols=[12,39,65,91,117,141,164,273];
      box(doc,x0,tableY,w,headH,[12,31,43],[50,70,82]);
      ['HAZARD','OFFICIAL','CLICK','REACTION','MARKS','STATUS','EVIDENCE'].forEach(function(v,i){txt(doc,v,cols[i]+1.5,tableY+5.3,5,true,[190,202,210])});
      var from=page*perPage,to=Math.min(rows.length,from+perPage),y=tableY+headH;
      for(var ri=from;ri<to;ri++){
        var r=rows[ri],bg=(ri%2===0)?[245,247,249]:[232,238,242];box(doc,x0,y,w,rowH,bg,[210,218,224]);
        txt(doc,'Hazard '+r.hazard.hazard_no,cols[0]+1.5,y+7.9,5.4,true,[35,50,62]);
        txt(doc,r.ht==null?'—':fmtTime(r.ht),cols[1]+1.5,y+7.9,5.2,false,[55,68,78]);txt(doc,r.ct==null?'—':fmtTime(r.ct),cols[2]+1.5,y+7.9,5.2,false,[55,68,78]);txt(doc,r.reaction==null?'—':fmtTime(r.reaction),cols[3]+1.5,y+7.9,5.2,false,[55,68,78]);
        txt(doc,r.max?(r.points+' / '+r.max):String(r.points||0),cols[4]+1.5,y+7.9,5.2,true,[184,132,12]);txt(doc,r.status,cols[5]+1.5,y+7.9,4.9,true,r.status==='IDENTIFIED'?[25,125,65]:[190,50,65]);
        if(r.hazard){var actual=await frameFor(r.clip,r.ht,null),response=r.match&&r.ct!=null?await frameFor(r.clip,r.ct,r.match.frameData||null):null;var ex=cols[6]+1.5,ey=y+1.4;
          if(actual)doc.addImage(actual,'JPEG',ex,ey,18,10.1);else box(doc,ex,ey,18,10.1,[215,220,224]);
          if(response)doc.addImage(response,'JPEG',ex+20,ey,18,10.1);else box(doc,ex+20,ey,18,10.1,[215,220,224]);
          txt(doc,'A '+fmtTime(r.ht),ex+40,ey+4.2,4.7,true,[65,80,90]);txt(doc,'R '+(r.ct==null?'—':fmtTime(r.ct)),ex+40,ey+8.6,4.7,true,[65,80,90]);
        }
        y+=rowH;
      }
      if(page===0)txt(doc,'Each clip is scored out of 10. One official hazard = up to 10 marks; two official hazards = up to 5 marks each. Extra clicks are excluded from this report.',12,199,5.7,false,[100,112,122]);
      else txt(doc,'Reaction time is calculated from the official hazard timestamp to the candidate click timestamp.',12,199,5.7,false,[100,112,122]);
      footer(doc,W,H);
    }
    doc.save('Raju-HPT-Analysis-'+safeName(name)+'-'+d.toISOString().slice(0,10)+'.pdf');
  }
  window.RajuHPTReport={generate:generate};
})();
