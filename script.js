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
