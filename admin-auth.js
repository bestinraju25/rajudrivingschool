(async function () {
  const client = window.supabase.createClient(window.RAJU_SUPABASE_URL, window.RAJU_SUPABASE_ANON_KEY);
  const form = document.getElementById('adminLoginForm');
  const msg = document.getElementById('adminAuthMessage');
  const show=(t,c='')=>{msg.textContent=t;msg.className='notice '+c;};
  const {data:{session}}=await client.auth.getSession();
  if(session){const {data:admin}=await client.from('admin_users').select('id').eq('id',session.user.id).eq('active',true).maybeSingle();if(admin){location.href='../admin-dashboard/';}}
  form.addEventListener('submit',async e=>{e.preventDefault();show('Signing in…');const fd=new FormData(form);const {error}=await client.auth.signInWithPassword({email:String(fd.get('email')).trim(),password:fd.get('password')});if(error){show(error.message,'error');return;}const {data:admin}=await client.from('admin_users').select('id').eq('id',(await client.auth.getUser()).data.user.id).eq('active',true).maybeSingle();if(!admin){await client.auth.signOut();show('This account is not registered as a Raju Driving School admin.','error');return;}location.href='../admin-dashboard/';});
})();
