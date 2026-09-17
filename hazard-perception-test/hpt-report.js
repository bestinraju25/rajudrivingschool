/* Raju HPT PDF analysis report generator */
(function(){
  'use strict';
  function fmtTime(s){
    s=Math.max(0,Number(s)||0);
    var m=Math.floor(s/60), sec=(s%60).toFixed(1);
    return String(m).padStart(2,'0')+':'+String(sec).padStart(4,'0');
  }
  function safeName(s){return String(s||'Candidate').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'Candidate'}
  function imgData(url){return new Promise(function(resolve,reject){var img=new Image();img.crossOrigin='anonymous';img.onload=function(){try{var c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;var x=c.getContext('2d');x.drawImage(img,0,0);resolve(c.toDataURL('image/jpeg',.82))}catch(e){reject(e)}};img.onerror=reject;img.src=url+(url.indexOf('?')>=0?'&':'?')+'report='+Date.now()})}
  function captureFrame(url,time){return new Promise(function(resolve,reject){var v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.crossOrigin='anonymous';var done=false;var timer=setTimeout(function(){if(!done){done=true;cleanup();reject(new Error('Video frame timeout'))}},10000);function cleanup(){clearTimeout(timer);v.pause();v.removeAttribute('src');try{v.load()}catch(e){}}function fail(e){if(done)return;done=true;cleanup();reject(e||new Error('Frame capture failed'))}v.onerror=function(){fail(new Error('Video unavailable'))};v.onloadedmetadata=function(){try{v.currentTime=Math.max(0,Math.min(Number(time)||0,(v.duration||Number(time)||0)))}catch(e){fail(e)}};v.onseeked=function(){if(done)return;try{var c=document.createElement('canvas');var w=640,h=360;if(v.videoWidth&&v.videoHeight){var ratio=Math.min(w/v.videoWidth,h/v.videoHeight);w=Math.max(1,Math.round(v.videoWidth*ratio));h=Math.max(1,Math.round(v.videoHeight*ratio))}c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);var data=c.toDataURL('image/jpeg',.78);done=true;cleanup();resolve(data)}catch(e){fail(e)}};v.src=url;try{v.load()}catch(e){fail(e)}})}
  async function frameFor(clip,time){
    if(!clip||!clip.file)return null;
    try{return await captureFrame(clip.file,time)}catch(e){
      var n=String(clip.clip_code||'').replace(/\D/g,'');
      if(n){try{return await imgData('thumbnails/'+Number(n)+'.jpg')}catch(err){}}
      return null;
    }
  }
  function addHeader(doc,W,H,exam,pageNo,totalPages){
    doc.setFillColor(5,10,15);doc.rect(0,0,W,20,'F');
    doc.setTextColor(255,196,0);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('RAJU DRIVING SCHOOL',12,9);
    doc.setTextColor(190,202,210);doc.setFontSize(7.5);doc.text('HAZARD PERCEPTION TEST • COMPLETE ANALYSIS REPORT',12,14);
    doc.setTextColor(100,115,126);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Page '+pageNo+' / '+totalPages,W-12,12,{align:'right'});
  }
  function addFooter(doc,W,H){doc.setDrawColor(43,58,69);doc.line(12,H-12,W-12,H-12);doc.setTextColor(100,115,126);doc.setFontSize(7);doc.text('Raju Motor Driving School • Chalakudy • Hazard Perception Test',12,H-7);doc.text('Generated electronically',W-12,H-7,{align:'right'})}
  function text(doc,text,x,y,maxWidth,size,bold){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size||9);var lines=doc.splitTextToSize(String(text||''),maxWidth);doc.text(lines,x,y);return y+lines.length*((size||9)*.45)}
  async function generate(exam){
    if(!exam||!window.jspdf||!window.jspdf.jsPDF)throw new Error('PDF generator is not available.');
    var jsPDF=window.jspdf.jsPDF, clips=exam.clips||[];
    var doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),W=210,H=297;
    var totalPages=1+clips.length;
    // Cover / summary
    addHeader(doc,W,H,exam,1,totalPages);
    var logo=null;try{logo=await imgData('raju-logo.png')}catch(e){}
    if(logo)doc.addImage(logo,'JPEG',W/2-20,29,40,31);
    doc.setTextColor(33,53,72);doc.setFont('helvetica','bold');doc.setFontSize(21);doc.text('HPT COMPLETE ANALYSIS',W/2,73,{align:'center'});
    doc.setTextColor(184,132,12);doc.setFontSize(10);doc.text('RAJU MOTOR DRIVING SCHOOL • CHALAKUDY',W/2,81,{align:'center'});
    doc.setTextColor(25,38,51);doc.setFontSize(16);doc.text(String(exam.candidate_name||exam.candidate?.name||'Candidate'),W/2,100,{align:'center'});
    doc.setTextColor(95,108,118);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Phone: '+String(exam.phone||exam.candidate?.phone||'—'),W/2,107,{align:'center'});
    var passed=!!exam.passed||Number(exam.total_score||exam.total||0)>=60;
    doc.setTextColor(passed?35:210,passed?126:60,passed?78:75);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(passed?'PASS':'NOT PASSED',W/2,120,{align:'center'});
    doc.setTextColor(33,53,72);doc.setFontSize(29);doc.text(String(Number(exam.total_score||exam.total||0))+' / 100',W/2,139,{align:'center'});
    doc.setTextColor(100,115,126);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Pass mark: 60 / 100',W/2,147,{align:'center'});
    var d=new Date(exam.completed_at||Date.now());doc.text('Completed: '+d.toLocaleString('en-IN'),W/2,154,{align:'center'});
    var totalHazards=clips.reduce(function(a,c){return a+(c.hazards||[]).length},0),identified=0,missed=0,clicks=0;
    clips.forEach(function(c){clicks+=(c.responses||[]).length;(c.hazards||[]).forEach(function(h){var r=(c.responses||[]).find(function(x){return Number(x.hazard_no)===Number(h.hazard_no)});if(r&&Number(r.points)>0)identified++;else missed++})});
    doc.setFillColor(10,25,36);doc.roundedRect(20,170,170,45,5,5,'F');
    var metrics=[['CLIPS',clips.length],['OFFICIAL HAZARDS',totalHazards],['IDENTIFIED',identified],['MISSED',missed],['CLICKS',clicks]];
    metrics.forEach(function(m,i){var x=30+i*36;doc.setTextColor(184,196,204);doc.setFontSize(7);doc.text(m[0],x,182,{align:'center'});doc.setTextColor(255,196,0);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(String(m[1]),x,193,{align:'center'})});
    doc.setTextColor(80,95,105);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('This report records the official hazard points configured for each clip,',W/2,231,{align:'center'});doc.text('the candidate response timestamps, reaction times, marks awarded and visual evidence.',W/2,237,{align:'center'});
    addFooter(doc,W,H);
    // Clip pages
    for(var i=0;i<clips.length;i++){
      doc.addPage();addHeader(doc,W,H,exam,i+2,totalPages);
      var c=clips[i], hazards=(c.hazards||[]).slice().sort(function(a,b){return Number(a.hazard_no)-Number(b.hazard_no)}),rs=c.responses||[];
      doc.setTextColor(33,53,72);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text('CLIP '+String(c.clip_code||String(i+1).padStart(2,'0')),14,32);
      doc.setTextColor(90,105,115);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(String(c.title||'Hazard Perception Clip'),14,39);
      var clipScore=Number(c.score||0),max=hazards.length===1?10:5*hazards.length;
      doc.setTextColor(255,196,0);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('Score: '+clipScore+' / 10',W-14,34,{align:'right'});
      doc.setTextColor(100,115,126);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(hazards.length+' official hazard'+(hazards.length===1?'':'s')+' • '+rs.length+' candidate click'+(rs.length===1?'':'s'),W-14,40,{align:'right'});
      var y=50;
      for(var hi=0;hi<hazards.length;hi++){
        var h=hazards[hi],match=rs.find(function(r){return Number(r.hazard_no)===Number(h.hazard_no)}),ht=Number(h.t)||0,ct=match?Number(match.t):null,reaction=match?ct-ht:null;
        var actual=await frameFor(c,ht),response=match?await frameFor(c,ct):null;
        if(y>235){addFooter(doc,W,H);doc.addPage();addHeader(doc,W,H,exam,i+2,totalPages);y=30;}
        doc.setFillColor(10,25,36);doc.roundedRect(12,y,186,70,4,4,'F');
        doc.setTextColor(255,196,0);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('HAZARD '+String(h.hazard_no||hi+1),18,y+9);
        doc.setTextColor(33,53,72);doc.setFontSize(8);doc.setTextColor(210,220,226);doc.text(String(h.label||'Developing hazard'),18,y+16);
        if(actual)doc.addImage(actual,'JPEG',18,y+21,73,41);else{doc.setFillColor(4,12,18);doc.rect(18,y+21,73,41,'F');doc.setTextColor(110,125,135);doc.setFontSize(7);doc.text('Hazard frame unavailable',54.5,y+43,{align:'center'})}
        if(response)doc.addImage(response,'JPEG',99,y+21,73,41);else{doc.setFillColor(4,12,18);doc.rect(99,y+21,73,41,'F');doc.setTextColor(110,125,135);doc.setFontSize(7);doc.text(match?'Response frame unavailable':'NO RESPONSE / MISSED',135.5,y+43,{align:'center'})}
        doc.setTextColor(100,115,126);doc.setFontSize(6.5);doc.text('OFFICIAL HAZARD • '+fmtTime(ht),54.5,y+66,{align:'center'});doc.text(match?'CANDIDATE CLICK • '+fmtTime(ct):'CANDIDATE CLICK • —',135.5,y+66,{align:'center'});
        var pts=match?Number(match.points||0):0, status=pts>0?'IDENTIFIED':'MISSED';
        doc.setTextColor(33,53,72);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Status: '+status,177,y+12,{align:'right'});
        doc.setTextColor(255,196,0);doc.setFontSize(9);doc.text('Marks: '+pts+' / '+(hazards.length===1?10:5),177,y+18,{align:'right'});
        doc.setTextColor(95,108,118);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text('Reaction: '+(match?(reaction>=0?fmtTime(reaction):'-'+fmtTime(Math.abs(reaction))):'No response'),177,y+25,{align:'right'});
        y+=77;
      }
      var extras=rs.filter(function(r){return !hazards.some(function(h){return Number(h.hazard_no)===Number(r.hazard_no)})});
      if(extras.length){doc.setTextColor(33,53,72);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Additional clicks not matched to an official hazard',14,y);y+=6;doc.setFont('helvetica','normal');doc.setFontSize(7.5);extras.forEach(function(r){doc.text('Response '+r.response_no+' • '+fmtTime(r.t)+' • '+Number(r.points||0)+' marks',18,y);y+=5})}
      addFooter(doc,W,H);
    }
    doc.save('Raju-HPT-Analysis-'+safeName(exam.candidate_name||exam.candidate?.name)+'-'+(d.toISOString().slice(0,10))+'.pdf');
  }
  window.RajuHPTReport={generate:generate};
})();
