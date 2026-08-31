const carousel = document.getElementById('carousel');
const track = document.getElementById('carouselTrack');
const slides = Array.from(track.children);

const AUTO_ROTATE_MS = 3000;
let index = 0;
let timer = null;

function goTo(i) {
  index = (i + slides.length) % slides.length;
  const slide = slides[index];
  const trackRect = track.getBoundingClientRect();
  const slideRect = slide.getBoundingClientRect();
  const delta = (slideRect.left - trackRect.left) - (trackRect.width - slideRect.width) / 2;
  track.scrollTo({ left: track.scrollLeft + delta, behavior: 'smooth' });
}

function next() { goTo(index + 1); }
function prev() { goTo(index - 1); }

function startAuto() {
  stopAuto();
  timer = setInterval(next, AUTO_ROTATE_MS);
}
function stopAuto() {
  if (timer) clearInterval(timer);
  timer = null;
}

carousel.querySelector('.carousel-prev').addEventListener('click', prev);
carousel.querySelector('.carousel-next').addEventListener('click', next);
carousel.addEventListener('mouseenter', stopAuto);
carousel.addEventListener('mouseleave', startAuto);
carousel.addEventListener('focusin', stopAuto);
carousel.addEventListener('focusout', startAuto);

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  startAuto();
}

const tabs = Array.from(document.querySelectorAll('.tab-btn'));

function activateTab(tab) {
  tabs.forEach((t) => {
    const selected = t === tab;
    t.setAttribute('aria-selected', selected);
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  });
  tab.focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') activateTab(tabs[(i + 1) % tabs.length]);
    if (e.key === 'ArrowLeft') activateTab(tabs[(i - 1 + tabs.length) % tabs.length]);
  });
});

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxLastFocused = null;

function showLightboxImage() {
  const { src, alt } = lightboxImages[lightboxIndex];
  lightboxImg.src = src;
  lightboxImg.alt = alt;
}

function openLightbox(images, i) {
  lightboxImages = images;
  lightboxIndex = i;
  lightboxLastFocused = document.activeElement;
  showLightboxImage();
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  lightbox.querySelector('.lightbox-close').focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
  if (lightboxLastFocused) lightboxLastFocused.focus();
}

function lightboxNext() {
  lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
  showLightboxImage();
}
function lightboxPrev() {
  lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
  showLightboxImage();
}

document.querySelectorAll('.photo-grid-2x2, .book-thumbs, .recipe-step-photos').forEach((grid) => {
  const links = Array.from(grid.querySelectorAll('a'));
  const images = links.map((a) => ({ src: a.getAttribute('href'), alt: a.querySelector('img').alt }));
  links.forEach((a, i) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(images, i);
    });
  });
});

lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
lightbox.querySelector('.lightbox-next').addEventListener('click', lightboxNext);
lightbox.querySelector('.lightbox-prev').addEventListener('click', lightboxPrev);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') lightboxNext();
  if (e.key === 'ArrowLeft') lightboxPrev();
});
