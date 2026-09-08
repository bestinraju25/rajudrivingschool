(function(){
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dateTime=iso=>iso?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)):'—';
  const dateOnly=iso=>iso?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(iso+'T00:00:00')):'—';
  const esc=s=>String(s??'').replace(/[&<>\'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const initials=s=>String(s||'Student').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'S';
  const statusClass=s=>String(s||'').replace(/_/g,'-');
  async function guard(){
    const {data:{session}}=await client.auth.getSession();
    if(!session){const base=location.pathname.split('/admin-dashboard/')[0]||'';location.href=base+'/admin/';return null;}
    const {data:admin,error}=await client.from('admin_users').select('id,full_name,email').eq('id',session.user.id).eq('active',true).maybeSingle();
    if(error||!admin){await client.auth.signOut();const base=location.pathname.split('/admin-dashboard/')[0]||'';location.href=base+'/admin/';return null;}
    const displayName=admin.full_name||admin.email||'Admin'; const name=document.getElementById('adminName'); if(name) name.textContent=displayName; const side=document.getElementById('sideAdminName'); if(side) side.textContent=displayName;
    return {session,admin};
  }
  function bindShell(){
    const btn=document.getElementById('logoutBtn');
    if(btn) btn.onclick=async()=>{await client.auth.signOut();location.href='../admin/';};
    const navToggle=document.getElementById('adminNavToggle'), sidebar=document.querySelector('.admin-sidebar');
    if(navToggle&&sidebar) navToggle.onclick=()=>sidebar.classList.toggle('open');
    document.querySelectorAll('.admin-sidebar a').forEach(a=>{if(a.pathname===location.pathname)a.classList.add('active');});
  }
  window.RajuAdmin={client,money,dateTime,dateOnly,esc,initials,statusClass,guard,bindShell};
})();
