// NutriTrack AI — Service Worker (offline caching)
const CACHE='nutritrack-v1';
const ASSETS=['./index.html','./style.css','./core.js','./features.js','./coach.js','./body.js','./food-db.js'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  // Network-first for API calls, cache-first for assets
  if(e.request.url.includes('googleapis.com')){
    e.respondWith(fetch(e.request).catch(()=>new Response('{"error":"offline"}',{headers:{'Content-Type':'application/json'}})));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    const clone=res.clone();
    caches.open(CACHE).then(c=>c.put(e.request,clone));
    return res;
  })));
});
