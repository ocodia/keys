const CACHE_PREFIX = `keys-${self.registration.scope}-`;
const CACHE_NAME = `${CACHE_PREFIX}v12`;
const ASSETS = ['./','./index.html','./styles.css','./app.js','./theory.js','./feature-registry.js','./storage.js','./keyboard.js','./panels.js','./audio-service.js','./input-service.js','./quiz.js','./manifest.webmanifest','./icons/keys.svg','./icons/keys-192.png','./icons/keys-512.png'];
ASSETS.push('./instruments/registry.js','./instruments/piano.js','./sounds/salamander/NOTICE.md');
const SAMPLE_CACHE = `${CACHE_PREFIX}salamander-v1`;
const SAMPLE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SAMPLES = Array.from({length:30}, (_, i) => 21 + i * 3).flatMap(root =>
  Array.from({length:16}, (_, i) => `./sounds/salamander/${encodeURIComponent(SAMPLE_NAMES[root%12]+(Math.floor(root/12)-1)+'v'+(i+1))}.ogg`));
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache = await caches.open(CACHE_NAME); await cache.addAll(ASSETS);
  const samples = await caches.open(SAMPLE_CACHE), queue = [...SAMPLES];
  // Reuse immutable recordings across app updates; bound parallel downloads.
  await Promise.all(Array.from({length:4}, async()=>{
    while(queue.length) { const path=queue.shift(); if(!await samples.match(path)) await samples.add(path); }
  }));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME&&name!==SAMPLE_CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const pathname = new URL(event.request.url).pathname;
    const isSample = pathname.startsWith(new URL('./sounds/salamander/',self.registration.scope).pathname) && pathname.endsWith('.ogg');
    const cache=await caches.open(isSample?SAMPLE_CACHE:CACHE_NAME),cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    try{return await fetch(event.request);}catch(error){
      if(event.request.mode==='navigate' && !new URL(event.request.url).pathname.includes('/tests/'))return cache.match('./index.html');
      throw error;
    }
  })());
});
