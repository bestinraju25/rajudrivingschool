const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const PROFILES = {
  Photo: { width: 205, height: 286, preferredMin: 10 * 1024, preferredMax: 18 * 1024 },
  Signature: { width: 312, height: 243, preferredMin: 10 * 1024, preferredMax: 18 * 1024 }
};

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    const done = (error = null) => {
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else if (!image.naturalWidth || !image.naturalHeight) reject(new Error('This image has no readable dimensions. Choose a JPG or PNG and try again.'));
      else resolve(image);
    };
    image.onload = () => done();
    image.onerror = () => done(new Error('This image could not be opened. Choose a JPG or PNG and try again.'));
    image.src = url;
  });
}

function rotatedCanvas(image, degrees) {
  const angle = degrees * Math.PI / 180;
  // Keep a practical source resolution on 12–50 MP phone cameras. The final
  // photo/signature is resized to its exact profile, and document PDFs are
  // subsequently compressed to the 480 KB limit.
  const sourceScale = Math.min(1, 3200 / Math.max(image.width, image.height));
  const sourceWidth = Math.max(1, Math.round(image.width * sourceScale));
  const sourceHeight = Math.max(1, Math.round(image.height * sourceScale));
  const sin = Math.abs(Math.sin(angle)), cos = Math.abs(Math.cos(angle));
  const width = Math.ceil(sourceWidth * cos + sourceHeight * sin);
  const height = Math.ceil(sourceWidth * sin + sourceHeight * cos);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('This browser could not prepare the image. Close other tabs and try again.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);
  ctx.translate(width/2,height/2); ctx.rotate(angle);
  ctx.drawImage(image, -sourceWidth/2, -sourceHeight/2, sourceWidth, sourceHeight);
  return canvas;
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed. Please try a smaller image.')), 'image/jpeg', quality);
      return;
    }
    // Older Safari/WebViews may not expose HTMLCanvasElement.toBlob.
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const encoded = dataUrl.split(',')[1];
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/jpeg' }));
    } catch (error) { reject(new Error(error?.message || 'This browser could not encode the cropped image.')); }
  });
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
  let fineAngle = 0;
  let sourceCanvas = rotatedCanvas(image, angle);
  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot open the image crop editor. Try another browser or choose a JPG image.');

  // Use a sizeable backing canvas for clean edges, while letting CSS fit it to
  // the actual phone viewport. Pointer/touch positions are converted back into
  // backing-canvas coordinates below, so display scaling never changes crops.
  const maxW = 1100, maxH = 1350;
  let scale = 1;
  let crop = null;
  let quad = null;
  let gesture = null;
  let settled = false;
  let abortController = null;

  function resizeStage(resetSelection = true) {
    scale = Math.min(maxW / sourceCanvas.width, maxH / sourceCanvas.height, 1);
    canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    if (resetSelection || (!crop && !quad)) {
      if (perspective) quad = initialQuad(canvas.width, canvas.height);
      else crop = initialCrop(canvas.width, canvas.height, profile);
    }
  }
  resizeStage();

  function displayScale() {
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 ? canvas.width / rect.width : 1;
  }

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(5,12,24,.62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pixelScale = displayScale();
    const handleRadius = clamp(13 * pixelScale, 10, 42);
    const lineWidth = clamp(2.5 * pixelScale, 2, 8);

    if (perspective) {
      ctx.save();
      ctx.beginPath();
      quad.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.beginPath();
      quad.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.strokeStyle = '#39e38a';
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      for (const p of quad) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = '#1bbd72';
        ctx.stroke();
      }
    } else {
      ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
      ctx.drawImage(sourceCanvas,
        crop.x / scale, crop.y / scale, crop.w / scale, crop.h / scale,
        crop.x, crop.y, crop.w, crop.h);
      ctx.strokeStyle = '#39e38a';
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      const handles = [
        [crop.x, crop.y], [crop.x + crop.w, crop.y],
        [crop.x + crop.w, crop.y + crop.h], [crop.x, crop.y + crop.h]
      ];
      for (const [x, y] of handles) {
        ctx.beginPath();
        ctx.arc(x, y, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = '#1bbd72';
        ctx.stroke();
      }
    }
  };

  const pointFromClient = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: clamp((clientX - rect.left) * canvas.width / rect.width, 0, canvas.width),
      y: clamp((clientY - rect.top) * canvas.height / rect.height, 0, canvas.height)
    };
  };
  const ratio = profile ? profile.width / profile.height : null;
  const hitRadius = () => clamp(30 * displayScale(), 30, 88);

  function beginGesture(clientX, clientY, pointerId = 'touch') {
    const p = pointFromClient(clientX, clientY);
    const threshold = hitRadius();
    if (perspective) {
      let corner = -1;
      quad.forEach((c, i) => {
        if (Math.hypot(c.x - p.x, c.y - p.y) <= threshold) corner = i;
      });
      gesture = { mode: corner >= 0 ? 'corner' : 'move', corner, start: p, original: quad.map(q => ({ ...q })), pointerId };
    } else {
      const corners = [
        [crop.x, crop.y], [crop.x + crop.w, crop.y],
        [crop.x + crop.w, crop.y + crop.h], [crop.x, crop.y + crop.h]
      ];
      let corner = -1;
      corners.forEach((c, i) => {
        if (Math.hypot(c[0] - p.x, c[1] - p.y) <= threshold) corner = i;
      });
      gesture = { mode: corner >= 0 ? 'resize' : 'move', corner, start: p, original: { ...crop }, pointerId };
    }
  }

  function moveGesture(clientX, clientY, pointerId = 'touch') {
    if (!gesture || gesture.pointerId !== pointerId) return;
    const p = pointFromClient(clientX, clientY);
    const dx = p.x - gesture.start.x;
    const dy = p.y - gesture.start.y;
    if (perspective) {
      const next = gesture.original.map(q => ({ ...q }));
      if (gesture.mode === 'corner') {
        next[gesture.corner] = { x: p.x, y: p.y };
      } else {
        const minX = Math.min(...gesture.original.map(q => q.x));
        const maxX = Math.max(...gesture.original.map(q => q.x));
        const minY = Math.min(...gesture.original.map(q => q.y));
        const maxY = Math.max(...gesture.original.map(q => q.y));
        const ox = clamp(dx, -minX, canvas.width - maxX);
        const oy = clamp(dy, -minY, canvas.height - maxY);
        for (const q of next) { q.x += ox; q.y += oy; }
      }
      if (validQuad(next, canvas.width, canvas.height)) quad = next;
    } else {
      const o = gesture.original;
      if (gesture.mode === 'move') {
        crop.x = clamp(o.x + dx, 0, canvas.width - o.w);
        crop.y = clamp(o.y + dy, 0, canvas.height - o.h);
      } else if (ratio) {
        // Keep the opposite corner fixed and constrain the ratio-locked crop
        // to the image bounds. This prevents handles jumping on short screens.
        const anchors = [
          { x: o.x + o.w, y: o.y + o.h, sx: -1, sy: -1 },
          { x: o.x, y: o.y + o.h, sx: 1, sy: -1 },
          { x: o.x, y: o.y, sx: 1, sy: 1 },
          { x: o.x + o.w, y: o.y, sx: -1, sy: 1 }
        ];
        const a = anchors[gesture.corner];
        const widthFromX = a.sx < 0 ? a.x - p.x : p.x - a.x;
        const heightFromY = a.sy < 0 ? a.y - p.y : p.y - a.y;
        // A fixed-ratio crop should respond whether a user drags horizontally
        // or vertically; choose the axis with the larger intentional movement.
        const widthFromY = heightFromY * ratio;
        const requestedW = Math.abs(widthFromX - o.w) >= Math.abs(widthFromY - o.w) ? widthFromX : widthFromY;
        const availableW = a.sx < 0 ? a.x : canvas.width - a.x;
        const availableH = a.sy < 0 ? a.y : canvas.height - a.y;
        const maxW = Math.max(1, Math.min(availableW, availableH * ratio));
        const minW = Math.min(36, maxW);
        const w = clamp(requestedW, minW, maxW);
        const h = w / ratio;
        crop = {
          x: a.sx < 0 ? a.x - w : a.x,
          y: a.sy < 0 ? a.y - h : a.y,
          w, h
        };
      } else {
        const anchors = [
          { x: o.x + o.w, y: o.y + o.h },
          { x: o.x, y: o.y + o.h },
          { x: o.x, y: o.y },
          { x: o.x + o.w, y: o.y }
        ];
        const a = anchors[gesture.corner];
        const minX = gesture.corner === 0 || gesture.corner === 3 ? 0 : a.x;
        const maxX = gesture.corner === 0 || gesture.corner === 3 ? a.x : canvas.width;
        const minY = gesture.corner === 0 || gesture.corner === 1 ? 0 : a.y;
        const maxY = gesture.corner === 0 || gesture.corner === 1 ? a.y : canvas.height;
        const movingX = clamp(p.x, minX, maxX);
        const movingY = clamp(p.y, minY, maxY);
        const left = Math.min(a.x, movingX), top = Math.min(a.y, movingY);
        crop = { x: left, y: top, w: Math.max(24, Math.abs(movingX - a.x)), h: Math.max(24, Math.abs(movingY - a.y)) };
        crop.w = Math.min(crop.w, canvas.width - crop.x);
        crop.h = Math.min(crop.h, canvas.height - crop.y);
      }
    }
    draw();
  }

  const finishGesture = () => { gesture = null; };
  const modal = document.getElementById('cropModal');
  const resetButton = document.getElementById('cropReset');
  const rotateButton = document.getElementById('cropRotate');
  const angleRange = document.getElementById('angleRange');
  const angleValue = document.getElementById('angleValue');
  const saveButton = document.getElementById('cropSave');
  const cancelButtons = [document.getElementById('cropClose'), document.getElementById('cropCancel')];

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (typeof onOpen === 'function') onOpen();
  angleRange.value = '0';
  angleValue.textContent = '0°';
  // Wait for layout before drawing handles, so their hit areas match the real
  // on-screen canvas size on both portrait and landscape phones.
  await new Promise(resolve => {
    const nextFrame = window.requestAnimationFrame || (callback => setTimeout(callback, 16));
    nextFrame(() => { draw(); resolve(); });
  });

  return new Promise((resolve, reject) => {
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      removers.push(() => target.removeEventListener(type, handler, options));
    };
    const closeModal = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    };
    const cleanup = () => {
      for (const remove of removers.splice(0)) { try { remove(); } catch { /* best-effort cleanup */ } }
      resizeObserver?.disconnect();
      resetButton.onclick = null;
      rotateButton.onclick = null;
      angleRange.oninput = null;
      saveButton.onclick = null;
      cancelButtons.forEach(button => { button.onclick = null; });
      canvas.oncontextmenu = null;
    };
    const finish = (value, error = null) => {
      if (settled) return;
      settled = true;
      cleanup();
      closeModal();
      if (error) reject(error); else resolve(value);
    };

    if ('PointerEvent' in window) {
      listen(canvas, 'pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        beginGesture(event.clientX, event.clientY, event.pointerId);
        try { canvas.setPointerCapture?.(event.pointerId); } catch { /* some mobile browsers do not implement pointer capture */ }
      });
      listen(window, 'pointermove', event => {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        event.preventDefault();
        moveGesture(event.clientX, event.clientY, event.pointerId);
      });
      const endPointer = event => {
        if (gesture && gesture.pointerId === event.pointerId) finishGesture();
      };
      listen(window, 'pointerup', endPointer);
      listen(window, 'pointercancel', endPointer);
      listen(canvas, 'lostpointercapture', finishGesture);
    } else {
      // Older iOS/Safari and embedded Android browsers without Pointer Events.
      listen(canvas, 'touchstart', event => {
        if (!event.changedTouches?.length) return;
        event.preventDefault();
        const touch = event.changedTouches[0];
        beginGesture(touch.clientX, touch.clientY, touch.identifier);
      }, { passive: false });
      listen(window, 'touchmove', event => {
        if (!gesture || !event.changedTouches?.length) return;
        const touch = Array.from(event.changedTouches).find(t => t.identifier === gesture.pointerId);
        if (!touch) return;
        event.preventDefault();
        moveGesture(touch.clientX, touch.clientY, touch.identifier);
      }, { passive: false });
      listen(window, 'touchend', event => {
        if (gesture && Array.from(event.changedTouches || []).some(t => t.identifier === gesture.pointerId)) finishGesture();
      });
      listen(window, 'touchcancel', finishGesture);
      listen(canvas, 'mousedown', event => {
        event.preventDefault(); beginGesture(event.clientX, event.clientY, 'mouse');
      });
      listen(window, 'mousemove', event => {
        if (gesture?.pointerId === 'mouse') moveGesture(event.clientX, event.clientY, 'mouse');
      });
      listen(window, 'mouseup', finishGesture);
    }

    listen(canvas, 'contextmenu', event => event.preventDefault());
    resetButton.onclick = () => {
      if (perspective) quad = initialQuad(canvas.width, canvas.height);
      else crop = initialCrop(canvas.width, canvas.height, profile);
      draw();
    };
    rotateButton.onclick = () => {
      angle = (angle + 90) % 360;
      fineAngle = 0;
      angleRange.value = '0';
      angleValue.textContent = '0°';
      sourceCanvas = rotatedCanvas(image, angle);
      resizeStage(true);
      draw();
    };
    angleRange.oninput = () => {
      fineAngle = Number(angleRange.value) || 0;
      angleValue.textContent = `${fineAngle}°`;
      sourceCanvas = rotatedCanvas(image, angle + fineAngle);
      resizeStage(true);
      draw();
    };
    cancelButtons.forEach(button => { button.onclick = () => finish(null); });
    saveButton.onclick = async () => {
      if (saveButton.disabled) return;
      saveButton.disabled = true;
      try {
        const out = document.createElement('canvas');
        if (perspective) {
          if (!validQuad(quad, canvas.width, canvas.height)) throw new Error('The four crop corners need to stay in order and must not cross. Tap Reset crop and adjust each corner again.');
          const src = quad.map(p => ({ x: p.x / scale, y: p.y / scale }));
          const edgeWidth = (distance(src[0], src[1]) + distance(src[3], src[2])) / 2;
          const edgeHeight = (distance(src[0], src[3]) + distance(src[1], src[2])) / 2;
          if (edgeWidth < 8 || edgeHeight < 8) throw new Error('The crop area is too small. Move the four corners farther apart.');
          const cap = 2600;
          const fit = Math.min(1, cap / Math.max(edgeWidth, edgeHeight));
          out.width = Math.max(1, Math.round(edgeWidth * fit));
          out.height = Math.max(1, Math.round(edgeHeight * fit));
          const outCtx = out.getContext('2d', { alpha: false });
          outCtx.fillStyle = '#fff'; outCtx.fillRect(0, 0, out.width, out.height);
          const dst = [{ x: 0, y: 0 }, { x: out.width, y: 0 }, { x: out.width, y: out.height }, { x: 0, y: out.height }];
          drawWarpTriangle(outCtx, sourceCanvas, [src[0], src[1], src[2]], [dst[0], dst[1], dst[2]]);
          drawWarpTriangle(outCtx, sourceCanvas, [src[0], src[2], src[3]], [dst[0], dst[2], dst[3]]);
        } else {
          const outW = profile?.width || Math.max(1, Math.round(crop.w / scale));
          const outH = profile?.height || Math.max(1, Math.round(crop.h / scale));
          out.width = outW; out.height = outH;
          const outCtx = out.getContext('2d', { alpha: false });
          outCtx.fillStyle = '#fff'; outCtx.fillRect(0, 0, outW, outH);
          outCtx.drawImage(sourceCanvas, crop.x / scale, crop.y / scale, crop.w / scale, crop.h / scale, 0, 0, outW, outH);
        }
        const blob = await exportJpeg(out, profile);
        finish(blob);
      } catch (error) {
        saveButton.disabled = false;
        toastCropError(error);
      }
    };

    // If the viewport changes (rotation, address bar collapse, split screen),
    // keep hit-target sizing synchronized with the canvas's actual CSS size.
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => draw());
      resizeObserver.observe(canvas);
    }
  });
}

function toastCropError(error) {
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = error?.message || 'Could not prepare this crop. Please try again.';
    el.classList.add('show', 'error');
    clearTimeout(window.__roviawCropToastTimer);
    window.__roviawCropToastTimer = setTimeout(() => el.classList.remove('show'), 4300);
  }
}

function initialQuad(width,height) {
  const x=width*.07,y=height*.07,w=width*.86,h=height*.86;
  return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function validQuad(points, width = 1000, height = 1000) {
  if(!Array.isArray(points)||points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
  const crosses=[];
  for(let i=0;i<4;i++){
    const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];
    if(distance(a,b)<5)return false;
    crosses.push((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x));
  }
  const polygonArea=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%4];return sum+p.x*q.y-q.x*p.y;},0)/2);
  const minArea=Math.max(6,(width*height)*0.000015);
  return polygonArea>minArea&&(crosses.every(v=>v>0)||crosses.every(v=>v<0));
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
