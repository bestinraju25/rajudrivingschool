import { fetchLessonData, publicMediaUrl, visualMarkup, escapeHtml } from './supabase.js';

const state={...await fetchLessonData(),filter:'all',selected:null};
const $=id=>document.getElementById(id);
function renderFilters(){
  const counts={}; state.signs.forEach(s=>counts[s.category_id]=(counts[s.category_id]||0)+1);
  $('filters').innerHTML=`<button class="filter ${state.filter==='all'?'active':''}" data-f="all">All (${state.signs.length})</button>`+
    state.categories.map(c=>`<button class="filter ${state.filter===c.id?'active':''}" data-f="${c.id}">${escapeHtml(c.name_en)} (${counts[c.id]||0})</button>`).join('');
  document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{state.filter=b.dataset.f;renderFilters();renderGrid();});
}
function filtered(){return state.filter==='all'?state.signs:state.signs.filter(s=>s.category_id===state.filter)}
function card(s){
  const m=state.mediaMap[s.sign_id]; const photo=publicMediaUrl(m?.photo_path);
  return `<button class="sign-card ${state.selected===s.sign_id?'active':''}" data-id="${s.sign_id}"><div class="sign-thumb">${photo?`<img src="${photo}" alt="">`:`<div>${visualMarkup(s)}</div>`}</div><div class="sign-id">${s.sign_id}</div><div class="sign-title">${escapeHtml(s.title_en)}</div><div class="sign-ml ml">${escapeHtml(s.title_ml)}</div><div class="sign-meta"><span>${escapeHtml(s.shape)}</span><span>${m?.video_path?'🎥 video':''}</span></div></button>`;
}
function renderGrid(){const rows=filtered(); $('library-count').textContent=`${rows.length} items`; $('sign-grid').innerHTML=rows.map(card).join(''); document.querySelectorAll('.sign-card').forEach(b=>b.onclick=()=>select(b.dataset.id));}
function select(id){
 const s=state.signs.find(x=>x.sign_id===id); if(!s) return; state.selected=id; const m=state.mediaMap[id];
 $('detail-id').textContent=s.sign_id; $('detail-en').textContent=s.title_en; $('detail-ml').textContent=s.title_ml; $('detail-shape').textContent=s.shape;
 $('detail-rule-en').textContent=s.rule_en; $('detail-rule-ml').textContent=s.rule_ml;
 const photo=publicMediaUrl(m?.photo_path); if(photo){$('detail-photo').src=photo;$('detail-photo').classList.remove('hide');$('detail-visual').classList.add('hide')}else{$('detail-photo').classList.add('hide');$('detail-visual').classList.remove('hide');$('detail-visual').innerHTML=visualMarkup(s)}
 const v=publicMediaUrl(m?.video_path); if(v){$('detail-video').src=v;$('video-box').classList.remove('hide');$('detail-video-status').textContent='Instructor video available'} else {$('video-box').classList.add('hide');$('detail-video').removeAttribute('src');$('detail-video-status').textContent='Instructor video not uploaded'}
 $('detail-play').href=`../classroom/index.html?sign_id=${encodeURIComponent(id)}`; renderGrid();
}
$('tab-info').onclick=()=>{$('detail-media').classList.remove('hide');$('video-box').classList.add('hide');$('tab-info').classList.add('active');$('tab-video').classList.remove('active')};
$('tab-video').onclick=()=>{$('detail-media').classList.add('hide');$('video-box').classList.remove('hide');$('tab-info').classList.remove('active');$('tab-video').classList.add('active')};
try{renderFilters();renderGrid(); if(state.signs[0]) select(state.signs[0].sign_id)}catch(e){$('sign-grid').innerHTML=`<div class="muted">${escapeHtml(e.message)}</div>`}
