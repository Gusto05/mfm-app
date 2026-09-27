const C='mfm-v4';
const ASSETS=['.','index.html','manifest.json','icon.svg','icon-180.png','icon-192.png','icon-512.png','icon-512-maskable.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  // Nur GET cachen; KI-Proxy und API immer direkt
  if(e.request.method!=='GET')return;
  const u=e.request.url;
  if(u.includes('workers.dev')||u.includes('api.anthropic.com'))return;
  // App-Seite & Manifest: Netzwerk zuerst → neue Versionen kommen ohne Neuinstallation an; offline aus dem Cache
  const isDoc=e.request.mode==='navigate'||u.endsWith('/')||u.includes('index.html')||u.includes('manifest.json');
  if(isDoc){
    e.respondWith(fetch(e.request).then(res=>{const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl)).catch(()=>{});return res;})
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
    return;
  }
  // Icons, Schriften: Cache zuerst
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl)).catch(()=>{});return res;})));
});
