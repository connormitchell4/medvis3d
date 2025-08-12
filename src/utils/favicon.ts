// src/utils/favicon.ts
function ensureLinks(): HTMLLinkElement[] {
    // Remove existing icon links so the new one wins
    document.querySelectorAll('link[rel*="icon"]').forEach((n) => n.parentNode?.removeChild(n));
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/png';
    const shortcut = document.createElement('link');
    shortcut.rel = 'shortcut icon';
    shortcut.type = 'image/png';
    document.head.append(icon, shortcut);
    return [icon, shortcut];
  }
  
  async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // safe for same-origin
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  
  function toDataURL(img: HTMLImageElement, size = 32): string {
    const s = Math.max(img.width, img.height) || size;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.height = s;
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(img, 0, 0, s, s);
    return canvas.toDataURL('image/png');
  }
  
  export async function animateFavicon(frames: string[], interval = 200): Promise<number> {
    const imgs = await Promise.all(frames.map(loadImage));
    const links = ensureLinks();
    let i = 0;
    const tick = () => {
      const url = toDataURL(imgs[i % imgs.length]);
      links.forEach((l) => (l.href = url));
      i += 1;
    };
    tick();
    return window.setInterval(tick, interval);
  }
  
  export function stopFaviconAnimation(id: number) {
    clearInterval(id);
  }