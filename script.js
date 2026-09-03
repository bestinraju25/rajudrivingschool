const root=document.documentElement;
const nav=document.querySelector('[data-nav]');
const menuBtn=document.querySelector('[data-menu]');
const mobileMenu=document.querySelector('[data-mobile-menu]');
const videoHero=document.querySelector('.video-hero');
const heroCar=document.querySelector('.hero-car');
const heroScrollCanvas=document.querySelector('#heroScrollCanvas');
const heroFrameCount=96;
const heroFrames=new Array(heroFrameCount);
const heroFrameLoading=new Array(heroFrameCount).fill(false);
let heroFramesLoaded=0;
let heroTargetFrame=0;
let heroDisplayFrame=0;
let heroFrameRaf=0;
const heroFramePath=i=>`./images/hero-frames/frame-${String(i+1).padStart(3,'0')}.webp`;
function drawHeroFrame(index){
  if(!heroScrollCanvas)return;
  const ctx=heroScrollCanvas.getContext('2d');
  const img=heroFrames[index];
  if(!ctx||!img?.complete||!img.naturalWidth)return;
  ctx.clearRect(0,0,heroScrollCanvas.width,heroScrollCanvas.height);
  ctx.drawImage(img,0,0,heroScrollCanvas.width,heroScrollCanvas.height);
}
function animateHeroFrames(){
  heroFrameRaf=0;
  const delta=heroTargetFrame-heroDisplayFrame;
  if(Math.abs(delta)>0.015){
    // Ease toward the scroll target instead of hard-seeking a video timestamp.
    // This removes the decode jumps/stalls that were visible during fast scrolling.
    heroDisplayFrame += delta*0.22;
  }else{
    heroDisplayFrame=heroTargetFrame;
  }
  const idx=clamp(Math.round(heroDisplayFrame),0,heroFrameCount-1);
  drawHeroFrame(idx);
  if(Math.abs(heroTargetFrame-heroDisplayFrame)>0.015) heroFrameRaf=requestAnimationFrame(animateHeroFrames);
}
function scheduleHeroFrame(){if(!heroFrameRaf)heroFrameRaf=requestAnimationFrame(animateHeroFrames)}
function loadHeroFrame(i){
  if(!heroScrollCanvas || i<0 || i>=heroFrameCount || heroFrames[i] || heroFrameLoading[i]) return;
  heroFrameLoading[i]=true;
  const img=new Image();
  img.decoding='async';
  if(i===0) img.fetchPriority='high';
  img.src=heroFramePath(i);
  img.onload=()=>{
    heroFramesLoaded++;
    heroFrameLoading[i]=false;
    heroFrames[i]=img;
    if(i===0 || i===Math.round(heroTargetFrame)) drawHeroFrame(i);
  };
  img.onerror=()=>{heroFrameLoading[i]=false};
  heroFrames[i]=img;
}
if(heroScrollCanvas){
  // The first frame is enough for the initial visual. Defer the 95-frame sequence
  // so the page can become interactive before the large animation payload arrives.
  loadHeroFrame(0);
  const preloadHeroSequence=()=>{
    let i=1;
    const pump=()=>{
      const end=Math.min(i+5,heroFrameCount);
      while(i<end){loadHeroFrame(i++);}
      if(i<heroFrameCount){
        if('requestIdleCallback' in window) requestIdleCallback(pump,{timeout:1200});
        else setTimeout(pump,80);
      }
    };
    pump();
  };
  window.addEventListener('load',preloadHeroSequence,{once:true});
}
const heroCarWrap=document.querySelector('.hero-car-wrap');
const progressBar=document.querySelector('#videoProgress');
const pct=document.querySelector('#videoPct');
const experience=document.querySelector('.experience');
const car=document.querySelector('.experience-car');
const fleet=document.querySelector('.fleet-section');
const fleetItems=[...(fleet?.querySelectorAll('[data-fleet-item]')||[])];
const fleetFill=fleet?.querySelector('.fleet-progress-fill');
const fleetCounter=fleet?.querySelector('.fleet-counter b');
const year=document.querySelector('#year');
const clamp=(n,a,b)=>Math.min(Math.max(n,a),b);
function sectionProgress(el,startOffset=.72,endOffset=.18){if(!el)return 0;const r=el.getBoundingClientRect();const start=window.innerHeight*startOffset;const end=window.innerHeight*endOffset;return clamp((start-r.top)/(r.height-(start-end)),0,1)}
const HERO_START=0;
// The optimized hero clip represents the original video from 04s onward.
// Release the hero two seconds before the clip's end for an earlier, floating hand-off.
const HERO_END_BUFFER=2;
let raf=0;
let lastScrollY=window.scrollY;
let scrollDirection='up';
function heroProgress(){
  if(!videoHero)return 0;
  const r=videoHero.getBoundingClientRect();
  const usable=Math.max(r.height-window.innerHeight,1);
  return clamp((0-r.top)/usable,0,1);
}
function render(){
  raf=0;
  const hp=heroProgress();
  if(videoHero){
    // iTurn-inspired hero: the supplied Raju training video is scrubbed by scroll.
    // The video itself contains the real car movement, so the page stays calm while
    // the vehicle naturally drives from its starting position toward the right.
    if(heroScrollCanvas){
      heroTargetFrame = hp*(heroFrameCount-1);
      loadHeroFrame(Math.round(heroTargetFrame));
      scheduleHeroFrame();
    }
    if(heroCarWrap) heroCarWrap.style.transform='none';
    if(heroCar) heroCar.style.display='none';
    if(progressBar)progressBar.style.width=`${hp*100}%`;
    if(pct)pct.textContent=String(Math.round(hp*100)).padStart(2,'0');
  }
  if(fleet&&fleetItems.length){
    const fr=fleet.getBoundingClientRect();
    const total=Math.max(fleet.offsetHeight-window.innerHeight,1);
    const fp=clamp(-fr.top/total,0,1);
    const n=fleetItems.length;
    const isMobile=window.matchMedia('(max-width:900px)').matches;

    fleetItems.forEach((item,i)=>{
      const img=item.querySelector('img');
      const dir=item.dataset.direction==='right'?1:-1;

      if(isMobile){
        // Simple mobile cross-fade: same position, blur in -> clear -> blur out.
        const segment=1/n;
        const local=clamp((fp-i*segment)/segment,0,1);
        const fade=.20;
        const fadeIn=clamp(local/fade,0,1);
        const fadeOut=clamp((1-local)/fade,0,1);
        const smoothIn=fadeIn*fadeIn*(3-2*fadeIn);
        const smoothOut=fadeOut*fadeOut*(3-2*fadeOut);
        const visible=smoothIn*smoothOut;
        const blur=(1-visible)*9;
        item.style.opacity=String(visible);
        item.style.visibility=visible>.002?'visible':'hidden';
        item.style.transform='translate3d(-50%,0,0)';
        item.style.filter=`blur(${blur}px)`;
        if(img) img.style.transform=`scale(${0.985+visible*0.015})`;
      }else{
        // Desktop: reveal the 10-card fleet one vehicle at a time, then hold the
        // complete 5 + 5 grid in place. The motion is deliberately subtle so the
        // vehicles remain large and clean rather than feeling like a carousel.
        const startAt=i/(n+0.55)*0.78;
        const span=.16;
        const t=clamp((fp-startAt)/span,0,1);
        const eased=t*t*(3-2*t);
        const blur=(1-eased)*7;
        item.style.opacity=String(eased);
        item.style.visibility=eased>.001?'visible':'hidden';
        const slide=dir*(1-eased)*7;
        const rise=(1-eased)*3;
        item.style.transform=`translate3d(${slide}vw,${rise}vh,0)`;
        item.style.filter=`blur(${blur}px)`;
        if(img) img.style.transform=`scale(${0.965+eased*0.035})`;
      }
    });
    if(fleetFill)fleetFill.style.width=`${fp*100}%`;
    // Fleet numbering is intentionally left blank for now.
    if(fleetCounter) fleetCounter.textContent='';
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
    const x=-34 + driveP*78;
    car.style.transform=`translate3d(${x}vw,0,0)`;
    const green=p<greenEnd, yellow=p>=greenEnd&&p<yellowEnd, red=p>=yellowEnd;
    experience.classList.toggle('signal-green',green);
    experience.classList.toggle('signal-yellow',yellow);
    experience.classList.toggle('signal-red',red);
    root.style.setProperty('--exp-p',p);
  }
  nav?.classList.remove('compact');
  // Desktop: hide the complete floating navigation (including the logo) while
  // scrolling down, then fade it back in when the visitor scrolls upward.
  // Mobile: keep the logo/header visible at all times.
  if(nav){
    const isMobile=window.matchMedia('(max-width:900px)').matches;
    if(isMobile){
      nav.classList.remove('nav-hidden','logo-hidden');
    }else{
      const y=window.scrollY;
      const atTop=y<=12;
      if(atTop){
        nav.classList.remove('nav-hidden');
      }else if(scrollDirection==='down' && y>80){
        nav.classList.add('nav-hidden');
      }else if(scrollDirection==='up'){
        nav.classList.remove('nav-hidden');
      }
    }
  }
}
function schedule(){if(!raf)raf=requestAnimationFrame(render)}
menuBtn?.addEventListener('click',()=>{const open=document.body.classList.toggle('menu-open');menuBtn.setAttribute('aria-expanded',String(open))});
mobileMenu?.addEventListener('click',e=>{if(e.target.closest('a')){document.body.classList.remove('menu-open');menuBtn?.setAttribute('aria-expanded','false')}});
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('menu-open')));
document.querySelector('[data-form]')?.addEventListener('submit',e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const name=form.querySelector('[name="name"]')?.value.trim()||'Not provided';
  const phone=form.querySelector('[name="phone"]')?.value.trim()||'Not provided';
  const course=form.querySelector('[name="course"]')?.value.trim()||'General enquiry';
  const message=form.querySelector('[name="message"]')?.value.trim()||'No additional message';
  const text=`Hello Raju Driving School!

I would like to make an enquiry.

Name: ${name}
Phone: ${phone}
Training: ${course}
Message: ${message}

Please let me know the next steps.`;
  window.open(`https://wa.me/918943764734?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
});
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('visible')}),{threshold:.14});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
if(year)year.textContent=new Date().getFullYear();
window.addEventListener('scroll',()=>{
  const y=window.scrollY;
  if(Math.abs(y-lastScrollY)>2) scrollDirection=y>lastScrollY?'down':'up';
  lastScrollY=y;
  schedule();
},{passive:true});window.addEventListener('resize',schedule);
window.addEventListener('load',schedule);schedule();
