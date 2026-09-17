window.RAJU_HPT_CONFIG = {
  supabaseUrl: 'https://laobedcdrwgaxlbnswze.supabase.co',
  supabaseAnonKey: 'sb_publishable_zlEHJUYUIiWNueX9PG5shA_rBr53yXl',
  videoBase: './videos/',
  githubPublishEndpoint: 'https://laobedcdrwgaxlbnswze.supabase.co/functions/v1/hpt-publish-video',
  examClipCount: 10,
  clipLimitSeconds: 50,
  maxResponsesPerClip: 5,
  passMark: 60,
  marksPerClip: 10,
  // The bundled TV-friendly clips use H.264 MP4 for broad browser/Smart-TV compatibility.
  staticClips: Array.from({length:10}, (_,i)=>({
    clip_code: String(i+1).padStart(2,'0'),
    title: `Hazard Perception Clip ${String(i+1).padStart(2,'0')}`,
    video_path: `videos/mp4/${i+1}.mp4`,
    duration_seconds: 50,
    active: true
  })),
  // Bundled annotations keep the standalone/local build working. Admin can replace these in Supabase.
  staticHazards: {
    '01':[{t:22,label:'Oncoming vehicle conflict'},{t:30,label:'Vehicle approaching tunnel'}],
    '02':[{t:9,label:'Vehicle conflict at junction'},{t:35,label:'Cyclist developing hazard'}],
    '03':[{t:6,label:'Vehicle emerging from side road'},{t:24,label:'Vehicle crossing / converging'}],
    '04':[{t:32,label:'Large vehicle entering / converging'},{t:38,label:'Pedestrian crossing'}],
    '05':[{t:14,label:'Van approaching close'},{t:35,label:'Large tractor passing close'}],
    '06':[{t:7,label:'Vehicle emerging from side road'},{t:34,label:'Cyclist / vehicle conflict'}],
    '07':[{t:2,label:'Roadworks / refuge obstruction'},{t:47,label:'Cyclist close to lane'}],
    '08':[{t:32,label:'Truck moving into lane'},{t:39,label:'Large vehicle passing close'}],
    '09':[{t:7,label:'Vehicle crossing from side road'},{t:37,label:'Large vehicle crossing'}],
    '10':[{t:8,label:'Oncoming vehicle conflict'},{t:42,label:'Pedestrian / roadside conflict'}]
  }
};
