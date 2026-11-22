const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const PROFILES = {
  Photo: { width: 205, height: 286, preferredMin: 10 * 1024, preferredMax: 18 * 1024 },
  Signature: { width: 312, height: 243, preferredMin: 10 * 1024, preferredMax: 18 * 1024 }
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

async function padJpegToMinimum(blob, minimumBytes) {
  if (blob.size >= minimumBytes) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
  const padding = Math.max(4, minimumBytes - bytes.length);
  const payloadLength = padding - 4;
  if (payloadLength > 65533) return blob;
  // A JPEG COM segment is ignored by image decoders; it pads very small signature files
  // into the required upload band without changing the visible pixels.
  const segment = new Uint8Array(padding);
  segment[0] = 0xff; segment[1] = 0xfe;
  const segmentLength = payloadLength + 2;
  segment[2] = (segmentLength >> 8) & 0xff; segment[3] = segmentLength & 0xff;
  segment.fill(0x20, 4);
  // Insert the padding comment after the JPEG header segments (including JFIF APP0)
  // and immediately before image scan data, preserving the JFIF APP0-first convention.
  let insertAt = 2;
  let pos = 2;
  while (pos + 4 < bytes.length && bytes[pos] === 0xff) {
    const marker = bytes[pos + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { pos += 2; insertAt = pos; continue; }
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (length < 2 || pos + 2 + length > bytes.length) break;
    pos += 2 + length;
    insertAt = pos;
  }
  const output = new Uint8Array(bytes.length + segment.length);
  output.set(bytes.subarray(0, insertAt), 0);
  output.set(segment, insertAt);
  output.set(bytes.subarray(insertAt), insertAt + segment.length);
  return new Blob([output], { type: 'image/jpeg' });
}

async function exportJpeg(canvas, profile) {
  if (!profile) return ensureJfif96Dpi(await canvasBlob(canvas, 0.9));
  let best = null;
  const maximum = profile.preferredMax - 24; // reserve space for the JFIF density metadata
  for (let quality = 0.98; quality >= 0.20; quality -= 0.02) {
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= maximum) {
      best = blob; // highest-quality candidate that will fit after metadata is added
      break;
    }
  }
  if (!best) throw new Error('This image cannot fit within 18 KB. Try a sharper, evenly lit capture and crop closer to the subject.');
  let output = await ensureJfif96Dpi(best);
  output = await padJpegToMinimum(output, profile.preferredMin);
  if (output.size < profile.preferredMin || output.size > profile.preferredMax) {
    throw new Error('Photo and signature files must be between 10 KB and 18 KB. Please capture and crop the image again.');
  }
  return output;
}

export async function cropImage(file, profile, onOpen, options = {}) {
  const perspective = options.perspective === true;
  const image = await loadImage(file);
  let angle = 0;
  let sourceCanvas = rotatedCanvas(image, angle);
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  const maxW = 900, maxH = 610;
  let scale = 1;
  let crop = null;
  let quad = null;
  let gesture = null;

  function resizeStage() {
    scale = Math.min(maxW/sourceCanvas.width, maxH/sourceCanvas.height, 1);
    canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    if (perspective) quad = initialQuad(canvas.width, canvas.height);
    else crop = initialCrop(canvas.width, canvas.height, profile);
  }
  resizeStage();

  const draw = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(sourceCanvas,0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(5,12,24,.62)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if (perspective) {
      ctx.save();
      ctx.beginPath();
      quad.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(sourceCanvas,0,0,canvas.width,canvas.height);
      ctx.restore();
      ctx.beginPath();
      quad.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.closePath();
      ctx.strokeStyle='#39e38a';ctx.lineWidth=3;ctx.stroke();
      for (const p of quad) {
        ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
        ctx.lineWidth=3;ctx.strokeStyle='#1bbd72';ctx.stroke();
      }
    } else {
      ctx.clearRect(crop.x,crop.y,crop.w,crop.h);
      ctx.drawImage(sourceCanvas,
        crop.x/scale,crop.y/scale,crop.w/scale,crop.h/scale,
        crop.x,crop.y,crop.w,crop.h);
      ctx.strokeStyle = '#39e38a'; ctx.lineWidth = 3; ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);
      const handles = [[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x+crop.w,crop.y+crop.h],[crop.x,crop.y+crop.h]];
      for (const [x,y] of handles) { ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='#1bbd72'; ctx.stroke(); }
    }
  };

  const point = e => {
    const r=canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
  };
  const ratio = profile ? profile.width/profile.height : null;
  canvas.onpointerdown = e => {
    e.preventDefault();canvas.setPointerCapture(e.pointerId);
    const p=point(e);
    if (perspective) {
      let corner=-1;quad.forEach((c,i)=>{if(Math.hypot(c.x-p.x,c.y-p.y)<34)corner=i;});
      gesture={mode:corner>=0?'corner':'move',corner,start:p,original:quad.map(q=>({...q}))};
    } else {
      const corners=[[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x+crop.w,crop.y+crop.h],[crop.x,crop.y+crop.h]];
      let corner=-1;corners.forEach((c,i)=>{if(Math.hypot(c[0]-p.x,c[1]-p.y)<30)corner=i;});
      gesture={mode:corner>=0?'resize':'move',corner,start:p,original:{...crop}};
    }
  };
  canvas.onpointermove = e => {
    if(!gesture)return;e.preventDefault();
    const p=point(e),dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;
    if (perspective) {
      const next=gesture.original.map(q=>({...q}));
      if(gesture.mode==='corner') {
        next[gesture.corner]={x:clamp(p.x,0,canvas.width),y:clamp(p.y,0,canvas.height)};
      } else {
        const minX=Math.min(...gesture.original.map(q=>q.x)),maxX=Math.max(...gesture.original.map(q=>q.x));
        const minY=Math.min(...gesture.original.map(q=>q.y)),maxY=Math.max(...gesture.original.map(q=>q.y));
        const ox=clamp(dx,-minX,canvas.width-maxX),oy=clamp(dy,-minY,canvas.height-maxY);
        for(const q of next){q.x+=ox;q.y+=oy;}
      }
      if(validQuad(next))quad=next;
    } else {
      const o=gesture.original;
      if(gesture.mode==='move'){
        crop.x=clamp(o.x+dx,0,canvas.width-o.w);crop.y=clamp(o.y+dy,0,canvas.height-o.h);
      } else {
        let w=gesture.corner===0||gesture.corner===3?o.w-dx:o.w+dx;
        let h=ratio?w/ratio:(gesture.corner===0||gesture.corner===1?o.h-dy:o.h+dy);
        h=Math.max(40,h);w=Math.max(40,w);if(ratio)h=w/ratio;
        if(gesture.corner===0){crop.x=o.x+o.w-w;crop.y=o.y+o.h-h;}
        if(gesture.corner===1){crop.x=o.x;crop.y=o.y+o.h-h;}
        if(gesture.corner===2){crop.x=o.x;crop.y=o.y;}
        if(gesture.corner===3){crop.x=o.x+o.w-w;crop.y=o.y;}
        crop.w=w;crop.h=h;crop.x=clamp(crop.x,0,canvas.width-crop.w);crop.y=clamp(crop.y,0,canvas.height-crop.h);
      }
    }
    draw();
  };
  canvas.onpointerup=canvas.onpointercancel=()=>{gesture=null;};
  document.getElementById('cropReset').onclick=()=>{if(perspective)quad=initialQuad(canvas.width,canvas.height);else crop=initialCrop(canvas.width,canvas.height,profile);draw();};
  document.getElementById('cropRotate').onclick=()=>{
    angle=(angle+90)%360;sourceCanvas=rotatedCanvas(image,angle);resizeStage();draw();
  };
  const angleRange=document.getElementById('angleRange');
  angleRange.value='0';document.getElementById('angleValue').textContent='0°';
  angleRange.oninput=()=>{
    const fine=Number(angleRange.value);document.getElementById('angleValue').textContent=`${fine}°`;
    sourceCanvas=rotatedCanvas(image,angle+fine);resizeStage();draw();
  };
  document.getElementById('cropModal').classList.add('open');
  if(typeof onOpen==='function')onOpen();
  draw();

  return new Promise((resolve,reject)=>{
    document.getElementById('cropClose').onclick=document.getElementById('cropCancel').onclick=()=>{
      document.getElementById('cropModal').classList.remove('open');resolve(null);
    };
    document.getElementById('cropSave').onclick=async()=>{
      try {
        const out=document.createElement('canvas');
        if (perspective) {
          const src=quad.map(p=>({x:p.x/scale,y:p.y/scale}));
          const edgeWidth=(distance(src[0],src[1])+distance(src[3],src[2]))/2;
          const edgeHeight=(distance(src[0],src[3])+distance(src[1],src[2]))/2;
          const cap=2600;
          const fit=Math.min(1,cap/Math.max(edgeWidth,edgeHeight));
          out.width=Math.max(1,Math.round(edgeWidth*fit));out.height=Math.max(1,Math.round(edgeHeight*fit));
          const dst=[{x:0,y:0},{x:out.width,y:0},{x:out.width,y:out.height},{x:0,y:out.height}];
          const outCtx=out.getContext('2d',{alpha:false});outCtx.fillStyle='#fff';outCtx.fillRect(0,0,out.width,out.height);
          drawWarpTriangle(outCtx,sourceCanvas,[src[0],src[1],src[2]],[dst[0],dst[1],dst[2]]);
          drawWarpTriangle(outCtx,sourceCanvas,[src[0],src[2],src[3]],[dst[0],dst[2],dst[3]]);
        } else {
          const outW=profile?.width||Math.max(1,Math.round(crop.w/scale));
          const outH=profile?.height||Math.max(1,Math.round(crop.h/scale));
          out.width=outW;out.height=outH;
          const outCtx=out.getContext('2d',{alpha:false});outCtx.fillStyle='#fff';outCtx.fillRect(0,0,outW,outH);
          outCtx.drawImage(sourceCanvas,crop.x/scale,crop.y/scale,crop.w/scale,crop.h/scale,0,0,outW,outH);
        }
        const blob=await exportJpeg(out,profile);
        document.getElementById('cropModal').classList.remove('open');resolve(blob);
      } catch(error) { reject(error); }
    };
  });
}

function initialQuad(width,height) {
  const x=width*.07,y=height*.07,w=width*.86,h=height*.86;
  return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function validQuad(points) {
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
  const crosses=[];
  for(let i=0;i<4;i++){
    const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];
    crosses.push((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x));
  }
  return crosses.every(v=>v>120)||crosses.every(v=>v< -120);
}
function drawWarpTriangle(ctx,image,src,dst) {
  const [p0,p1,p2]=src,[q0,q1,q2]=dst;
  const sx1=p1.x-p0.x,sy1=p1.y-p0.y,sx2=p2.x-p0.x,sy2=p2.y-p0.y;
  const dx1=q1.x-q0.x,dy1=q1.y-q0.y,dx2=q2.x-q0.x,dy2=q2.y-q0.y;
  const det=sx1*sy2-sx2*sy1;
  if(Math.abs(det)<.0001)throw new Error('The four crop corners overlap. Reset the crop and adjust the corners again.');
  const a=(dx1*sy2-dx2*sy1)/det;
  const c=(sx1*dx2-sx2*dx1)/det;
  const b=(dy1*sy2-dy2*sy1)/det;
  const d=(sx1*dy2-sx2*dy1)/det;
  const e=q0.x-a*p0.x-c*p0.y;
  const f=q0.y-b*p0.x-d*p0.y;
  ctx.save();ctx.beginPath();ctx.moveTo(q0.x,q0.y);ctx.lineTo(q1.x,q1.y);ctx.lineTo(q2.x,q2.y);ctx.closePath();ctx.clip();
  ctx.transform(a,b,c,d,e,f);ctx.drawImage(image,0,0);ctx.restore();
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
