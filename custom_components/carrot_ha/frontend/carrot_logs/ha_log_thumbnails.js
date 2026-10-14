/* One visible-only decoder and a bounded memory cache of recorded frames. */
(() => {
  const cache = new Map(), queue = new Map(), visible = new Set(), observed = new WeakSet();
  let active = false, cancel = null;
  const inactive = () => document.hidden || (typeof CURRENT_PAGE !== 'undefined' && CURRENT_PAGE !== 'logs');
  function source(image) {
    const value = image.dataset.src || image.getAttribute('src');
    if (!value) return null;
    const url = new URL(value, location.href);
    if (url.origin !== location.origin || !/^\/api\/carrot_ha\/v1\/driving_logs\/[A-Za-z0-9_-]+\/dashcam\/(preview|thumbnail)\//.test(url.pathname)) return null;
    url.pathname = url.pathname.replace(/\/dashcam\/(preview|thumbnail)\//, '/dashcam/video/');
    url.search = '';
    return url.href;
  }
  function apply(image, key) {
    const url = cache.get(key);
    if (!url || !image.isConnected) return false;
    cache.delete(key); cache.set(key, url);
    if (image.getAttribute('src') !== url) image.src = url;
    return true;
  }
  function frame(url) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.preload = 'auto';
      let settled = false, seeking = false, captured = false;
      const finish = (error, blob) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        video.onloadedmetadata = video.onloadeddata = video.onseeked = video.onerror = null;
        video.removeAttribute('src'); video.load(); cancel = null;
        if (error) reject(error); else resolve(blob);
      };
      const capture = () => {
        if (settled || captured || seeking || video.readyState < 2 || !video.videoWidth) return;
        captured = true;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 480; canvas.height = Math.max(1, Math.min(480, Math.round(480 * video.videoHeight / video.videoWidth)));
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => blob ? finish(null, blob) : finish(new Error('thumbnail-empty')), 'image/jpeg', .72);
        } catch (error) { finish(error); }
      };
      video.onloadedmetadata = () => {
        const time = Number.isFinite(video.duration) ? Math.min(2, video.duration / 2) : 0;
        if (time > 0) { seeking = true; video.currentTime = time; } else capture();
      };
      video.onseeked = () => { seeking = false; capture(); };
      video.onloadeddata = capture;
      video.onerror = () => finish(new Error('thumbnail-video-unavailable'));
      const timer = setTimeout(() => finish(new Error('thumbnail-timeout')), 12000);
      cancel = () => finish(new Error('thumbnail-hidden'));
      video.src = url; video.load();
    });
  }
  async function pump() {
    if (active || inactive()) return;
    active = true;
    try {
      while (queue.size && !inactive()) {
        const [key, images] = queue.entries().next().value; queue.delete(key);
        if (![...images].some(image => image.isConnected && visible.has(image))) continue;
        try {
          if (!cache.has(key)) {
            const blob = await frame(key);
            if (blob.size > 128 * 1024) continue;
            cache.set(key, URL.createObjectURL(blob));
            while (cache.size > 48) {
              const [oldKey, old] = cache.entries().next().value;
              cache.delete(oldKey); URL.revokeObjectURL(old);
            }
          }
          for (const image of visible) if (source(image) === key) apply(image, key);
        } catch { /* Keep the existing placeholder if a frame is unavailable. */ }
      }
    } finally { active = false; }
  }
  function enqueue(image) {
    if (!visible.has(image) || inactive()) return;
    const key = source(image);
    if (!key || apply(image, key)) return;
    if (!queue.has(key) && queue.size >= 32) return;
    if (!queue.has(key)) queue.set(key, new Set());
    queue.get(key).add(image); pump();
  }
  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) { visible.add(entry.target); enqueue(entry.target); }
      else visible.delete(entry.target);
    }
  }, {rootMargin:'100px'});
  function observe(node) {
    if (node.nodeType !== 1) return;
    for (const image of node.matches('img') ? [node] : node.querySelectorAll('img')) {
      if (!source(image)) continue;
      if (!observed.has(image)) { observed.add(image); intersection.observe(image); }
      else enqueue(image);
    }
  }
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') observe(record.target);
      else {
        for (const node of record.addedNodes) observe(node);
        for (const node of record.removedNodes) if (node.nodeType === 1) {
          for (const image of node.matches('img') ? [node] : node.querySelectorAll('img')) {
            intersection.unobserve(image); observed.delete(image); visible.delete(image);
            for (const [key, images] of queue) { images.delete(image); if (!images.size) queue.delete(key); }
          }
        }
      }
    }
    for (const image of visible) if (!image.isConnected) { visible.delete(image); intersection.unobserve(image); }
  }).observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['src','data-src']});
  observe(document.body);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancel?.(); queue.clear(); }
    else { for (const image of visible) enqueue(image); pump(); }
  });
  window.addEventListener('carrot:pagechange', () => {
    if (inactive()) { cancel?.(); queue.clear(); }
    else { for (const image of visible) enqueue(image); pump(); }
  });
  window.addEventListener('pageshow', () => { for (const image of visible) enqueue(image); });
  window.addEventListener('pagehide', () => {
    cancel?.(); queue.clear();
    for (const url of cache.values()) URL.revokeObjectURL(url);
    cache.clear();
  });
})();
