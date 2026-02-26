const links = Array.from(document.querySelectorAll('.navlink'));
const sidebar = document.querySelector('.sidebar');
const sections = links
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

const linkByHash = new Map(links.map(a => [a.getAttribute('href'), a]));

function setActive(sectionEl) {
  links.forEach((a) => {
    a.classList.remove('is-active');
    a.removeAttribute('aria-current');
  });
  const active = linkByHash.get(`#${sectionEl.id}`);
  if (active) {
    active.classList.add('is-active');
    active.setAttribute('aria-current', 'page');
  }
}

const observer = new IntersectionObserver((entries) => {
  const visible = entries
    .filter(e => e.isIntersecting)
    .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];

  if (!visible) return;
  setActive(visible.target);
}, {
  threshold: [0.25, 0.5, 0.75],
});

sections.forEach(sec => observer.observe(sec));

const initial = sections.find(sec => sec.id === 'inicio') || sections[0];
if (initial) setActive(initial);

function updateScrollProgress() {
  if (!sidebar) return;
  const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
  const percent = scrollMax > 0 ? (window.scrollY / scrollMax) * 100 : 0;
  const clamped = Math.max(0, Math.min(100, percent));
  sidebar.style.setProperty('--scroll-progress', `${clamped}%`);
}

const desktopSidebar = window.matchMedia('(min-width: 921px)');
let lastScrollY = window.scrollY;
let scrollTicking = false;

function updateSidebarOnScroll() {
  updateScrollProgress();

  if (!sidebar || !desktopSidebar.matches) {
    lastScrollY = window.scrollY;
    scrollTicking = false;
    return;
  }

  const currentY = window.scrollY;
  const delta = currentY - lastScrollY;

  if (currentY < 120 || delta < -8) {
    sidebar.classList.remove('sidebar--hidden');
  } else if (delta > 8) {
    sidebar.classList.add('sidebar--hidden');
  }

  lastScrollY = currentY;
  scrollTicking = false;
}

window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  window.requestAnimationFrame(updateSidebarOnScroll);
}, { passive: true });

window.addEventListener('resize', updateScrollProgress);
desktopSidebar.addEventListener('change', () => {
  if (!sidebar) return;
  if (!desktopSidebar.matches) sidebar.classList.remove('sidebar--hidden');
  updateScrollProgress();
});

updateScrollProgress();

const sectionTitles = Array.from(document.querySelectorAll('.sectiontitle'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduceMotion) {
  sectionTitles.forEach(title => title.classList.add('is-visible'));
} else {
  const titleObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    });
  }, {
    threshold: 0.3,
    rootMargin: '0px 0px -6% 0px',
  });

  sectionTitles.forEach(title => titleObserver.observe(title));
}

function extractYouTubeId(urlString) {
  try {
    const url = new URL(urlString, window.location.origin);
    const host = url.hostname.replace('www.', '');

    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] || null;
    }

    if (host.endsWith('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v) return v;

      const parts = url.pathname.split('/').filter(Boolean);
      const markerIndex = parts.findIndex((part) => (
        part === 'shorts' || part === 'embed' || part === 'live'
      ));

      if (markerIndex >= 0 && parts[markerIndex + 1]) {
        return parts[markerIndex + 1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

const cardsWithLinks = Array.from(document.querySelectorAll('.card[href]'));

cardsWithLinks.forEach((card) => {
  const href = card.getAttribute('href');
  const imageEl = card.querySelector('.thumb img');
  if (!href || href === '#' || !imageEl) return;

  const originalSrc = imageEl.getAttribute('src') || '';
  const youtubeId = extractYouTubeId(href);

  if (youtubeId) {
    const maxres = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    const hq = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    imageEl.setAttribute('src', maxres);
    imageEl.onerror = () => {
      imageEl.onerror = null;
      imageEl.src = hq;
    };

    if (!card.hasAttribute('data-yt-id')) {
      card.setAttribute('data-yt-id', youtubeId);
    }
    return;
  }

  // Instagram/manual: mantém a capa definida no HTML.
});

const youtubeTitleCards = Array.from(document.querySelectorAll('.card[data-yt-id]'));

youtubeTitleCards.forEach(async (card) => {
  const videoId = card.getAttribute('data-yt-id');
  if (!videoId) return;

  const titleEl = card.querySelector('.cardtitle');
  if (!titleEl) return;

  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data.title === 'string' && data.title.trim()) {
      titleEl.textContent = data.title.trim();
    }
  } catch {
    // Mantém o título existente como fallback.
  }
});
