const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const PROFILES = {
  Photo: { width: 205, height: 286, preferredMin: 13 * 1024, preferredMax: 18 * 1024 },
  Signature: { width: 312, height: 243, preferredMin: 13 * 1024, preferredMax: 18 * 1024 }
};

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be opened. Choose a JPG or PNG and try again.')); };
    image.src = url;
  });
}

function rotatedCanvas(image, degrees) {
  const angle = degrees * Math.PI / 180;
  const sin = Math.abs(Math.sin(angle)), cos = Math.abs(Math.cos(angle));
  const width = Math.ceil(image.width * cos + image.height * sin);
  const height = Math.ceil(image.width * sin + image.height * cos);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);
  ctx.translate(width/2,height/2); ctx.rotate(angle); ctx.drawImage(image,-image.width/2,-image.height/2);
  return canvas;
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), 'image/jpeg', quality));
}

async function ensureJfif96Dpi(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
  // JFIF APP0 density: units=1 means dots per inch; X/Y density = 96.
  const segment = new Uint8Array([0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01,0x01,0x01,0x00,0x60,0x00,0x60,0x00,0x00]);
  let pos = 2, found = false;
  while (pos + 4 < bytes.length && bytes[pos] === 0xff) {
    const marker = bytes[pos+1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = (bytes[pos+2] << 8) | bytes[pos+3];
    if (marker === 0xe0 && length >= 16 && bytes[pos+4] === 0x4a && bytes[pos+5] === 0x46 && bytes[pos+6] === 0x49 && bytes[pos+7] === 0x46) {
      bytes[pos+11] = 1; bytes[pos+12] = 0; bytes[pos+13] = 96; bytes[pos+14] = 0; bytes[pos+15] = 96; found = true; break;
    }
    if (length < 2) break;
    pos += 2 + length;
  }
  if (found) return new Blob([bytes], {type:'image/jpeg'});
  const output = new Uint8Array(bytes.length + segment.length);
  output.set(bytes.subarray(0,2),0); output.set(segment,2); output.set(bytes.subarray(2),2+segment.length);
  return new Blob([output], {type:'image/jpeg'});
}

async function exportJpeg(canvas, profile) {
  if (!profile) return ensureJfif96Dpi(await canvasBlob(canvas, 0.9));
  let best = null;
  for (let quality = 0.96; quality >= 0.20; quality -= 0.025) {
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= profile.preferredMax) {
      best = blob; // first candidate is the highest quality that fits the cap
      break;
    }
  }
  if (!best) throw new Error('This image cannot fit within the preferred file size. Try a sharper, evenly lit capture and crop closer to the subject.');
  return ensureJfif96Dpi(best);
}

export async function cropImage(file, profile, onOpen) {
  const image = await loadImage(file);
  let angle = 0;
  let sourceCanvas = rotatedCanvas(image, angle);
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  const maxW = 900, maxH = 610;
  let scale = Math.min(maxW/sourceCanvas.width, maxH/sourceCanvas.height, 1);
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  let crop = initialCrop(canvas.width, canvas.height, profile);
  let gesture = null;
  const draw = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(sourceCanvas,0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(5,12,24,.58)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.clearRect(crop.x,crop.y,crop.w,crop.h);
    ctx.drawImage(sourceCanvas,
      crop.x/scale,crop.y/scale,crop.w/scale,crop.h/scale,
      crop.x,crop.y,crop.w,crop.h);
    ctx.strokeStyle = '#39e38a'; ctx.lineWidth = 3; ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);
    const handles = [[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x+crop.w,crop.y+crop.h],[crop.x,crop.y+crop.h]];
    for (const [x,y] of handles) { ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='#1bbd72'; ctx.stroke(); }
  };
  const point = e => { const r=canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}; };
  const ratio = profile ? profile.width/profile.height : null;
  canvas.onpointerdown = e => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p=point(e), corners=[[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x+crop.w,crop.y+crop.h],[crop.x,crop.y+crop.h]];
    let corner=-1; corners.forEach((c,i)=>{if(Math.hypot(c[0]-p.x,c[1]-p.y)<30)corner=i;});
    gesture={mode:corner>=0?'resize':'move',corner,start:p,original:{...crop}};
  };
  canvas.onpointermove = e => {
    if(!gesture)return; e.preventDefault(); const p=point(e), dx=p.x-gesture.start.x,dy=p.y-gesture.start.y, o=gesture.original;
    if(gesture.mode==='move'){
      crop.x=clamp(o.x+dx,0,canvas.width-o.w); crop.y=clamp(o.y+dy,0,canvas.height-o.h);
    } else {
      let w=gesture.corner===0||gesture.corner===3?o.w-dx:o.w+dx;
      let h=ratio ? w/ratio : (gesture.corner===0||gesture.corner===1?o.h-dy:o.h+dy);
      if(!ratio) h=Math.max(40,h); else h=Math.max(40,h);
      w=Math.max(40,w); if(ratio) h=w/ratio;
      if(gesture.corner===0){crop.x=o.x+o.w-w;crop.y=o.y+o.h-h;}
      if(gesture.corner===1){crop.x=o.x;crop.y=o.y+o.h-h;}
      if(gesture.corner===2){crop.x=o.x;crop.y=o.y;}
      if(gesture.corner===3){crop.x=o.x+o.w-w;crop.y=o.y;}
      crop.w=w;crop.h=h;
      crop.x=clamp(crop.x,0,canvas.width-crop.w);crop.y=clamp(crop.y,0,canvas.height-crop.h);
    }
    draw();
  };
  canvas.onpointerup = canvas.onpointercancel = () => { gesture=null; };
  document.getElementById('cropReset').onclick = () => { crop=initialCrop(canvas.width,canvas.height,profile); draw(); };
  document.getElementById('cropRotate').onclick = () => {
    angle=(angle+90)%360; sourceCanvas=rotatedCanvas(image,angle); scale=Math.min(maxW/sourceCanvas.width,maxH/sourceCanvas.height,1);
    canvas.width=Math.max(1,Math.round(sourceCanvas.width*scale)); canvas.height=Math.max(1,Math.round(sourceCanvas.height*scale));
    crop=initialCrop(canvas.width,canvas.height,profile); draw();
  };
  const angleRange=document.getElementById('angleRange');
  angleRange.value='0'; document.getElementById('angleValue').textContent='0°';
  angleRange.oninput=()=>{
    const fine=Number(angleRange.value); document.getElementById('angleValue').textContent=`${fine}°`;
    sourceCanvas=rotatedCanvas(image,angle+fine); scale=Math.min(maxW/sourceCanvas.width,maxH/sourceCanvas.height,1);
    canvas.width=Math.max(1,Math.round(sourceCanvas.width*scale)); canvas.height=Math.max(1,Math.round(sourceCanvas.height*scale));
    crop=initialCrop(canvas.width,canvas.height,profile); draw();
  };
  document.getElementById('cropModal').classList.add('open'); draw();
  return new Promise((resolve,reject)=>{
    document.getElementById('cropClose').onclick=document.getElementById('cropCancel').onclick=()=>{document.getElementById('cropModal').classList.remove('open');resolve(null);};
    document.getElementById('cropSave').onclick=async()=>{
      try {
        const outW=profile?.width || Math.max(1,Math.round(crop.w/scale));
        const outH=profile?.height || Math.max(1,Math.round(crop.h/scale));
        const out=document.createElement('canvas');out.width=outW;out.height=outH;
        const outCtx=out.getContext('2d',{alpha:false});outCtx.fillStyle='#fff';outCtx.fillRect(0,0,outW,outH);
        outCtx.drawImage(sourceCanvas,crop.x/scale,crop.y/scale,crop.w/scale,crop.h/scale,0,0,outW,outH);
        const blob=await exportJpeg(out,profile);
        document.getElementById('cropModal').classList.remove('open'); resolve(blob);
      } catch(error) { reject(error); }
    };
  });
}

function initialCrop(width,height,profile) {
  if(profile){
    const ratio=profile.width/profile.height;
    let w=width*.82,h=w/ratio;
    if(h>height*.82){h=height*.82;w=h*ratio;}
    return {x:(width-w)/2,y:(height-h)/2,w,h};
  }
  const w=width*.88,h=height*.88;return{x:(width-w)/2,y:(height-h)/2,w,h};
}
