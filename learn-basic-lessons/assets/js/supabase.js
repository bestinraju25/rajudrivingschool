import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_CONFIG } from './config.js';

let client = null;

export function requireSupabase() {
  if (client) return client;

  const url = SUPABASE_CONFIG?.projectUrl;
  const key = SUPABASE_CONFIG?.publishableKey;

  if (!url || !key) {
    throw new Error('Supabase configuration is missing. Check assets/js/config.js.');
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return client;
}

export async function isLessonAdmin() {
  const sb = requireSupabase();
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData?.session?.user?.id) return false;

  const { data, error } = await sb.rpc('is_lesson_admin');
  if (error) throw error;
  return data === true;
}

export function publicMediaUrl(path) {
  if (!path) return '';
  const sb = requireSupabase();
  const { data } = sb.storage.from('lesson-media').getPublicUrl(path);
  return data?.publicUrl || '';
}

export async function fetchLessonData() {
  const sb = requireSupabase();

  const [categoriesRes, signsRes, mediaRes] = await Promise.all([
    sb.from('lesson_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    sb.from('lesson_signs')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    sb.from('lesson_media')
      .select('*')
  ]);

  if (categoriesRes.error) throw categoriesRes.error;
  if (signsRes.error) throw signsRes.error;
  if (mediaRes.error) throw mediaRes.error;

  const mediaMap = Object.fromEntries(
    (mediaRes.data || []).map(row => [row.sign_id, row])
  );

  return {
    categories: categoriesRes.data || [],
    signs: signsRes.data || [],
    media: mediaRes.data || [],
    mediaMap
  };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function arrowSvg(direction, label) {
  const rotations = {
    left: '-90',
    right: '90',
    ahead: '0',
    leftturn: '-90',
    rightturn: '90'
  };
  const rotation = rotations[direction] ?? 0;
  return `<div class="visual-sign visual-arrow"><svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(${rotation} 50 50)"><path d="M50 12 L84 48 H66 V88 H34 V48 H16 Z"/></g></svg><span>${escapeHtml(label || '')}</span></div>`;
}

export function visualMarkup(sign) {
  const type = sign?.visual_type || '';
  const key = sign?.visual_key || '';

  if (type === 'speed') {
    return `<div class="visual-sign visual-speed"><div>${escapeHtml(key || '—')}</div><span>km/h</span></div>`;
  }

  if (type === 'signal') {
    const state = key || 'red';
    return `<div class="visual-signal"><span class="lamp red ${state === 'red' ? 'on' : ''}"></span><span class="lamp amber ${state === 'yellow' ? 'on' : ''}"></span><span class="lamp green ${state === 'green' ? 'on' : ''}"></span></div>`;
  }

  if (type === 'stop') {
    return `<div class="visual-sign visual-stop">STOP<span class="ml">നിർത്തുക</span></div>`;
  }

  if (type === 'triangle') {
    return `<div class="visual-sign visual-triangle"><div>${escapeHtml(key === 'ped' ? '🚶' : key === 'hump' ? '〽' : key === 'school' ? '🏫' : key === 'rail' ? '🚆' : '⚠')}</div></div>`;
  }

  if (type === 'noright' || type === 'noleft' || type === 'no_u' || type === 'left' || type === 'right' || type === 'ahead' || type === 'leftturn' || type === 'rightturn') {
    const label = type === 'noright' ? '↱' : type === 'noleft' ? '↰' : type === 'no_u' ? '↶' : type === 'ahead' ? '↑' : type === 'left' || type === 'leftturn' ? '←' : '→';
    const blocked = ['noright', 'noleft', 'no_u'].includes(type);
    return `<div class="visual-sign visual-direction ${blocked ? 'blocked' : ''}"><span>${label}</span></div>`;
  }

  if (type === 'noentry') return `<div class="visual-sign visual-noentry">⛔</div>`;
  if (type === 'nopark') return `<div class="visual-sign visual-textsign">P̸</div>`;
  if (type === 'nostop') return `<div class="visual-sign visual-textsign">S̸</div>`;
  if (type === 'overtake') return `<div class="visual-sign visual-textsign">⇄̸</div>`;
  if (type === 'horn') return `<div class="visual-sign visual-textsign">🔇</div>`;
  if (type === 'cycle') return `<div class="visual-sign visual-textsign">🚲</div>`;
  if (type === 'info') return `<div class="visual-sign visual-info">${escapeHtml(key || 'i')}</div>`;
  if (type === 'roadmark') return `<div class="visual-roadmark"><span class="line ${key}"></span></div>`;

  return `<div class="visual-sign visual-default">${escapeHtml(sign?.title_en || 'SIGN')}</div>`;
}

export function toast(message, kind = 'ok') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(host);
  }

  const item = document.createElement('div');
  item.textContent = message;
  item.style.cssText = `max-width:420px;padding:12px 15px;border-radius:12px;border:1px solid ${kind === 'error' ? '#7f1d1d' : '#334155'};background:${kind === 'error' ? '#450a0a' : '#0f172a'};color:#f8fafc;box-shadow:0 10px 30px rgba(0,0,0,.35);font:600 12px/1.4 system-ui,sans-serif;pointer-events:auto;`;
  host.appendChild(item);
  setTimeout(() => item.remove(), 4500);
}
