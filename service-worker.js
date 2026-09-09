const CACHE_PREFIX = `keys-${self.registration.scope}-`;
const CACHE_NAME = `${CACHE_PREFIX}v5`;
const ASSETS = ['./','./index.html','./styles.css','./app.js','./theory.js','./feature-registry.js','./storage.js','./keyboard.js','./panels.js','./audio-service.js','./input-service.js','./quiz.js','./manifest.webmanifest','./icons/keys.svg','./icons/keys-192.png','./icons/keys-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME),cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    try{return await fetch(event.request);}catch(error){
      if(event.request.mode==='navigate' && !new URL(event.request.url).pathname.includes('/tests/'))return cache.match('./index.html');
      throw error;
    }
  })());
});
