const C='mfm-v4';
const ASSETS=['.','index.html','manifest.json','icon.svg','icon-180.png','icon-192.png','icon-512.png','icon-512-maskable.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.url.includes('workers.dev'))return;
  if(e.request.url.includes('api.anthropic.com'))return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl)).catch(()=>{});return res;}).catch(()=>caches.match('index.html'))));
});
