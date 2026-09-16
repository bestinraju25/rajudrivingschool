import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function toBase64(bytes: Uint8Array) {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(out);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Authentication required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const githubToken = Deno.env.get('HPT_GITHUB_TOKEN');
  const githubRepo = Deno.env.get('HPT_GITHUB_REPO') || 'bestinraju25/rajudrivingschool';
  const githubBranch = Deno.env.get('HPT_GITHUB_BRANCH') || 'main';
  if (!githubToken) return json({ error: 'HPT_GITHUB_TOKEN is not configured on the Edge Function.' }, 500);

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Invalid session.' }, 401);
  const { data: admin } = await adminClient.from('admin_users').select('id,active').eq('id', userData.user.id).eq('active', true).maybeSingle();
  if (!admin) return json({ error: 'Active HPT admin required.' }, 403);

  const form = await req.formData();
  const file = form.get('file');
  const rawPath = String(form.get('path') || '').trim().replace(/^\/+/, '');
  const message = String(form.get('commit_message') || 'HPT: publish video').trim();
  if (!(file instanceof File)) return json({ error: 'Video file is required.' }, 400);
  if (!(rawPath.startsWith('videos/') || rawPath.startsWith('hazard-perception-test/videos/'))) {
    return json({ error: 'Path must start with videos/.' }, 400);
  }
  const githubPath = rawPath.startsWith('hazard-perception-test/') ? rawPath : `hazard-perception-test/${rawPath}`;
  if (file.size > 95 * 1024 * 1024) return json({ error: 'Video is too large for the GitHub Contents API. Keep it below 95 MB.' }, 400);

  const encodedPath = githubPath.split('/').map(encodeURIComponent).join('/');
  const contentsUrl = `https://api.github.com/repos/${githubRepo}/contents/${encodedPath}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const content = toBase64(bytes);

  let sha: string | undefined;
  const existing = await fetch(contentsUrl + `?ref=${encodeURIComponent(githubBranch)}`, {
    headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (existing.ok) {
    const e = await existing.json();
    sha = e.sha;
  } else if (existing.status !== 404) {
    return json({ error: `GitHub lookup failed (${existing.status}).` }, 502);
  }

  const payload: Record<string, string> = { message, content, branch: githubBranch };
  if (sha) payload.sha = sha;
  const put = await fetch(contentsUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify(payload),
  });
  if (!put.ok) {
    const text = await put.text();
    return json({ error: `GitHub publish failed (${put.status}).`, detail: text.slice(0, 500) }, 502);
  }
  const result = await put.json();
  return json({ ok: true, path: rawPath, github_path: githubPath, commit: result.commit?.sha || null, size: file.size });
});
