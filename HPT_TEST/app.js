const clips=[
{video:"assets/videos/clip-01.mp4",title:"Kerala Road — Clip 1",hazards:[{id:"c1-ped",name:"Pedestrian — possible crossing",start:3.0},{id:"c1-bike",name:"Motorcycle crossing ahead",start:4.3}]},
{video:"assets/videos/clip-02.mp4",title:"Kerala Road — Clip 2",hazards:[{id:"c2-ped",name:"Pedestrian at centre median — possible crossing",start:3.0},{id:"c2-bike",name:"Motorcycle entering from left",start:3.5}]},
{video:"assets/videos/clip-03.mp4",title:"Kerala Town Road — Clip 3",hazards:[{id:"c3-reverse",name:"Vehicle reversing into main road",start:2.07},{id:"c3-cycle",name:"Cycle entering the main road",start:10.40}]},
{video:"assets/videos/clip-04.mp4",title:"Urban Kerala Road — Clip 4",hazards:[{id:"c4-ped",name:"Pedestrian beginning to cross",start:4.30},{id:"c4-auto",name:"Auto-rickshaw entering/crossing",start:23.40}]},
null,null,null,null,null,null
];

const $=id=>document.getElementById(id);
const screens={login:$("login"),dashboard:$("dashboard"),test:$("test"),result:$("result")};
const video=$("video"),videoWrap=$("videoWrap");
let mode="practice",idx=0,running=false,clicks=[],claimed=new Set(),fatal=false,clipScores=Array(10).fill(0),testFinished=false;

function show(s){Object.values(screens).forEach(x=>x.classList.add("hidden"));if(screens[s])screens[s].classList.remove("hidden")}
function fmt(t){return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,"0")}`}
function available(){return clips.filter(Boolean).length}
function scoreAt(h,t){const d=t-h.start;if(d<0||d>5)return 0;if(d<=1.5)return 5;if(d<=2.5)return 4;if(d<=3.5)return 3;return 2}
function matchHazard(t){let best=null;clips[idx].hazards.forEach(h=>{if(claimed.has(h.id))return;const s=scoreAt(h,t);if(s>0&&!best)best={h,score:s}});return best}
function resetClip(){running=false;clicks=[];claimed.clear();fatal=false;$("clickCount").textContent="0";$("responseSummary").textContent="0 / 5";$("responses").innerHTML='<span class="empty">Your clicks will appear here.</span>';$("flags").innerHTML="";$("clipScore").textContent="0";$("hazards").innerHTML="";$("hazardSummary").textContent="0 / 2";$("result")?.classList.add("hidden")}
function loadClip(n,autoplay=false){
 idx=n;resetClip();
 if(!clips[idx]){showPlaceholder();return}
 const c=clips[idx];video.src=c.video;video.load();$("clipNo").textContent=String(idx+1).padStart(2,"0");$("progress").style.width=((idx+1)*10)+"%";
 document.querySelector("#test .brand span").textContent=mode==="practice"?"PRACTICE TEST":"ACTUAL EXAMINATION";
 $("modePill").textContent=mode==="practice"?"PRACTICE":"ACTUAL TEST";$("modeLabel").textContent=mode==="practice"?"PRACTICE TEST":"ACTUAL EXAMINATION";
 $("start").textContent=`▶ Start Clip ${idx+1}`;
 c.hazards.forEach((h,i)=>{const e=document.createElement("span");e.textContent=`Hazard ${i+1} • ${h.name} • ${fmt(h.start)}`;$("hazards").appendChild(e)});
 if(autoplay)setTimeout(begin,300);
}
function showPlaceholder(){
 video.removeAttribute("src");video.load();$("clipNo").textContent=String(idx+1).padStart(2,"0");$("progress").style.width=((idx+1)*10)+"%";
 $("hazards").innerHTML='<span class="empty">Video not loaded yet — awaiting Clip '+(idx+1)+'.</span>';
 $("hazardSummary").textContent="0 / 2";$("start").textContent="Clip unavailable";if($("status"))$("status").textContent="";
}
function addResponse(text,good){const e=document.createElement("span");e.className=good?"good":"";e.textContent=text;$("responses").querySelector(".empty")?.remove();$("responses").appendChild(e)}
function flag(t,good,score){const d=video.duration||1,e=document.createElement("span");e.className="flag "+(good?"good":"");e.style.left=Math.min(99,Math.max(1,t/d*100))+"%";e.textContent=good?"✓"+score:"•";$("flags").appendChild(e)}
function updateScore(){const s=fatal?0:clicks.reduce((a,c)=>a+(c.score||0),0);$("clipScore").textContent=s;clipScores[idx]=s;$("totalScore").textContent=clipScores.reduce((a,b)=>a+b,0)}
async function begin(){
 if(!clips[idx])return;
 if(video.ended)video.currentTime=0;
 resetClip();$("countdown").classList.remove("hidden");
 for(let n=3;n;n--){$("countdown").textContent=n;await new Promise(r=>setTimeout(r,450))}
 $("countdown").classList.add("hidden");running=true;$("start").textContent="⏸ Pause";$("toast").textContent="Click the video when you recognise a developing hazard";$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2200);await video.play()
}
videoWrap.addEventListener("click",e=>{
 if(e.target.closest(".video-controls"))return;
 if(!running||video.paused||fatal)return;
 const t=video.currentTime;
 if(clicks.length>=5){fatal=true;running=false;video.pause();clicks.push({time:t,score:0,fatal:true});flag(t,false,0);$("clickCount").textContent="6";$("responseSummary").textContent="6 / 5";addResponse(`${fmt(t)} • 6th response — clip = 0`,false);$("toast").textContent="More than 5 responses — this clip scores 0";$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),3000);updateScore();return}
 const m=matchHazard(t);clicks.push({time:t,score:m?m.score:0,match:m?.h.id||null});flag(t,!!m,m?.score||0);$("clickCount").textContent=clicks.length;$("responseSummary").textContent=`${clicks.length} / 5`;
 if(m){claimed.add(m.h.id);addResponse(`${fmt(t)} • ${m.h.name} • +${m.score}`,true);const hs=[...$("hazards").children];const pos=clips[idx].hazards.findIndex(h=>h.id===m.h.id);if(hs[pos])hs[pos].classList.add("good")}else addResponse(`${fmt(t)} • No score`,false);
 updateScore()
});
video.addEventListener("timeupdate",()=>{$("played").style.width=((video.currentTime/(video.duration||1))*100)+"%";$("clock").textContent=`${fmt(video.currentTime)} / ${fmt(video.duration||0)}`});
video.addEventListener("ended",()=>{
 running=false;$("start").textContent=`↻ Replay Clip ${idx+1}`;updateScore();
 if(mode==="actual"){
   if(idx<9){
     if(!clips[idx+1]){finishActual();return}
     setTimeout(()=>loadClip(idx+1,true),900)
   }else finishActual()
 }
});
$("start").onclick=()=>running?(running=false,video.pause(),$("start").textContent="▶ Resume"):begin();
$("prev").onclick=()=>{if(mode==="practice"&&idx>0)loadClip(idx-1)};$("next").onclick=()=>{if(mode==="practice"&&idx<9)loadClip(idx+1)};
$("backDash").onclick=()=>show("dashboard");
$("logout")?.addEventListener("click",()=>show("dashboard"));
$("full").onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await videoWrap.requestFullscreen()}catch{}};
$("practiceBtn").onclick=()=>{mode="practice";idx=0;clipScores=Array(10).fill(0);show("test");loadClip(0)};
$("actualBtn").onclick=()=>{mode="actual";idx=0;clipScores=Array(10).fill(0);testFinished=false;show("test");loadClip(0)};
function finishActual(){
 testFinished=true;running=false;const total=clipScores.reduce((a,b)=>a+b,0);$("finalScore").textContent=total;$("resultTitle").textContent="Examination complete";$("resultStatus").textContent=total>=60?"PASS":"FAIL";$("resultStatus").style.background=total>=60?"#dcfce7":"#fee2e2";$("resultStatus").style.color=total>=60?"#166534":"#991b1b";$("resultCopy").textContent=`You scored ${total}/100. The pass requirement is 60/100.`;$("clipResults").innerHTML=clipScores.map((s,i)=>`<span>Clip ${String(i+1).padStart(2,"0")}<br><b>${s}/10</b></span>`).join("");show("result")
}
$("again").onclick=()=>{mode==="actual"?($("actualBtn").click()):($("practiceBtn").click())};$("resultDash").onclick=()=>show("dashboard");
show("dashboard");

