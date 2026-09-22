import { fetchLessonData, publicMediaUrl, escapeHtml } from '../assets/js/supabase.js';
const data=await fetchLessonData(); const qs=new URLSearchParams(location.search); const startId=qs.get('sign_id');
const signs=data.signs.slice(); const state={index:Math.max(0,startId?signs.findIndex(s=>s.sign_id===startId):0),started:false,waitTimer:null};
const $=id=>document.getElementById(id);
function sign(){return signs[state.index]}
function update(){
 const s=sign(), m=data.mediaMap[s.sign_id], img=publicMediaUrl(m?.photo_path), video=publicMediaUrl(m?.video_path);
 $('counter').textContent=`${state.index+1} / ${signs.length}`; $('progress-bar').style.width=`${((state.index+1)/signs.length)*100}%`;
 $('stage-id').textContent=s.sign_id;$('stage-en').textContent=s.title_en;$('stage-ml').textContent=s.title_ml;$('stage-rule').textContent=s.rule_ml;
 $('stage-image').src=img||'../assets/img/sign-placeholder.svg';
 const v=$('stage-video'); clearTimeout(state.waitTimer); v.pause(); v.removeAttribute('src'); v.load();
 if(video){$('video-empty').classList.add('hide');v.src=video;v.classList.remove('hide'); if(state.started) playVideo();} else {v.classList.add('hide');$('video-empty').classList.remove('hide');$('video-empty-text').textContent='Instructor video not uploaded for this item.'; if(state.started) state.waitTimer=setTimeout(next,3500)}
}
async function enterFs(){try{await document.documentElement.requestFullscreen?.()}catch(_){} try{screen.orientation?.lock?.('landscape')}catch(_){} }
async function playVideo(){try{await $('stage-video').play()}catch(e){$('video-empty').classList.remove('hide');$('video-empty-text').textContent='Press Play on the video to start instructor audio/video.'}}
function start(){state.started=true;$('start').textContent='⏸ Pause';enterFs();update();}
function toggle(){if(!state.started)return start();const v=$('stage-video'); if(!v.classList.contains('hide')){if(v.paused){playVideo()}else v.pause()}}
function next(){if(state.index<signs.length-1){state.index++;update()}else{state.started=false;$('start').textContent='↺ Restart';}}
function prev(){if(state.index>0){state.index--;update()}}
$('start').onclick=toggle;$('next').onclick=next;$('prev').onclick=prev;$('fs').onclick=enterFs;
$('stage-video').addEventListener('ended',next);
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')next();if(e.key==='ArrowLeft')prev();if(e.key==='Escape' && document.fullscreenElement)document.exitFullscreen();if(e.code==='Space'){e.preventDefault();toggle()}});
update();
