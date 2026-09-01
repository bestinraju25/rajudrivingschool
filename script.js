const root=document.documentElement;
const nav=document.querySelector('[data-nav]');
const menuBtn=document.querySelector('[data-menu]');
const mobileMenu=document.querySelector('[data-mobile-menu]');
const videoHero=document.querySelector('.video-hero');
const video=document.querySelector('#heroVideo');
const progressBar=document.querySelector('#videoProgress');
const pct=document.querySelector('#videoPct');
const experience=document.querySelector('.experience');
const car=document.querySelector('.experience-car');
const fleet=document.querySelector('.fleet-section');
const fleetSlides=[...(fleet?.querySelectorAll('[data-fleet-slide]')||[])];
const fleetFill=fleet?.querySelector('.fleet-progress-fill');
const fleetCounter=fleet?.querySelector('.fleet-counter b');
const year=document.querySelector('#year');
const clamp=(n,a,b)=>Math.min(Math.max(n,a),b);
function sectionProgress(el,startOffset=.72,endOffset=.18){if(!el)return 0;const r=el.getBoundingClientRect();const start=window.innerHeight*startOffset;const end=window.innerHeight*endOffset;return clamp((start-r.top)/(r.height-(start-end)),0,1)}
const HERO_START=0;
// The optimized hero clip represents the original video from 04s onward.
// Release the hero two seconds before the clip's end for an earlier, floating hand-off.
const HERO_END_BUFFER=2;
let duration=0,ready=false,target=0,current=0,raf=0;
function heroProgress(){
  if(!videoHero)return 0;
  const r=videoHero.getBoundingClientRect();
  const usable=Math.max(r.height-window.innerHeight,1);
  return clamp((0-r.top)/usable,0,1);
}
function render(){
  raf=0;
  const hp=heroProgress();
  if(video&&ready&&duration){
    const scrubEnd=Math.max(duration-HERO_END_BUFFER,HERO_START+0.05);
    target=HERO_START + hp*(scrubEnd-HERO_START);
    current += (target-current)*0.16;
    if(Math.abs(video.currentTime-current)>0.025){
      try{video.currentTime=current}catch(e){}
    }
    if(progressBar)progressBar.style.width=`${hp*100}%`;
    if(pct)pct.textContent=String(Math.round(hp*100)).padStart(2,'0');
  }
  if(fleet&&fleetSlides.length){
    const fr=fleet.getBoundingClientRect();
    const total=Math.max(fleet.offsetHeight-window.innerHeight,1);
    const fp=clamp(-fr.top/total,0,1);
    const n=fleetSlides.length;
    const scaled=fp*n;
    const activeIndex=Math.min(Math.floor(scaled),n-1);

    // The fleet is intentionally stationary. Scrolling only cross-fades between
    // vehicles, keeping the composition calm and premium instead of adding motion noise.
    fleetSlides.forEach((slide,i)=>{
      const local=scaled-i;
      const distance=Math.abs(local);
      const vis=clamp(1-distance,0,1);
      const eased=vis*vis*(3-2*vis);
      const blur=(1-eased)*14;
      const scale=1-(1-eased)*.018;

      slide.style.opacity=String(eased);
      slide.style.visibility=eased>.001?'visible':'hidden';
      slide.style.transform='none';

      const image=slide.querySelector('.fleet-image-wrap');
      if(image){
        image.style.transform='none';
        image.style.filter=`blur(${blur}px) scale(${scale})`;
        const img=image.querySelector('img');
        if(img) img.style.transform='none';
      }
      slide.classList.toggle('is-active',i===activeIndex);
    });
    if(fleetFill)fleetFill.style.width=`${fp*100}%`;
    if(fleetCounter)fleetCounter.textContent=String(activeIndex+1).padStart(2,'0');
  }
  if(experience&&car){
    // The sequence is driven ONLY while the classroom section is active.
    // The sticky stage keeps the scene in view while the section provides the scroll distance.
    const total=Math.max(experience.offsetHeight-window.innerHeight,1);
    const p=clamp(-experience.getBoundingClientRect().top/total,0,1);
    // Green: drive normally. Yellow: continue forward but slow down. Red: stop.
    // The car reaches its final stopping position only when the signal turns red.
    // Green: long, obvious drive. Yellow: keep moving, but ease off. Red: stop.
    // The car's travel is deliberately tied to THIS sticky section only.
    const greenEnd=.54, yellowEnd=.76;
    let driveP;
    if(p<=greenEnd){
      const t=p/greenEnd;
      const eased=t*t*(3-2*t);
      driveP=eased*0.72;
    }else if(p<=yellowEnd){
      const t=(p-greenEnd)/(yellowEnd-greenEnd);
      const eased=t*t*(3-2*t);
      driveP=0.72 + eased*0.28;
    }else{
      driveP=1;
    }
    // Travel from well outside the left edge to the stopping point near the signal.
    const x=-50 + driveP*95;
    car.style.transform=`translate3d(${x}vw,0,0)`;
    const green=p<greenEnd, yellow=p>=greenEnd&&p<yellowEnd, red=p>=yellowEnd;
    experience.classList.toggle('signal-green',green);
    experience.classList.toggle('signal-yellow',yellow);
    experience.classList.toggle('signal-red',red);
    root.style.setProperty('--exp-p',p);
  }
  nav?.classList.toggle('compact',window.scrollY>50);
}
function schedule(){if(!raf)raf=requestAnimationFrame(render)}
video?.addEventListener('loadedmetadata',()=>{duration=video.duration||10;ready=true;video.currentTime=HERO_START;video.classList.add('ready');schedule()});
video?.addEventListener('loadeddata',()=>{ready=true;if(!duration)duration=video.duration||10;video.classList.add('ready');schedule()});
video?.addEventListener('canplay',()=>{ready=true;if(!duration)duration=video.duration||10;video.classList.add('ready');schedule()});
menuBtn?.addEventListener('click',()=>{const open=document.body.classList.toggle('menu-open');menuBtn.setAttribute('aria-expanded',String(open))});
mobileMenu?.addEventListener('click',e=>{if(e.target.closest('a')){document.body.classList.remove('menu-open');menuBtn?.setAttribute('aria-expanded','false')}});
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('menu-open')));
document.querySelector('[data-form]')?.addEventListener('submit',e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');const old=b.innerHTML;b.innerHTML='Enquiry noted ✓';setTimeout(()=>b.innerHTML=old,1800)});
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('visible')}),{threshold:.14});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
if(year)year.textContent=new Date().getFullYear();
window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);window.addEventListener('load',schedule);schedule();
