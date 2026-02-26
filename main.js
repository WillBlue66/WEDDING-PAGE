const links = Array.from(document.querySelectorAll('.navlink'));
const sections = links
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

const linkByHash = new Map(links.map(a => [a.getAttribute('href'), a]));

function setActive(sectionEl) {
  links.forEach(a => a.classList.remove('is-active'));
  const active = linkByHash.get(`#${sectionEl.id}`);
  if (active) active.classList.add('is-active');
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