const track = document.getElementById('carouselTrack');
const carousel = document.getElementById('carousel');

function scrollByOneImage(direction) {
  const img = track.querySelector('img');
  if (!img) return;
  const step = img.getBoundingClientRect().width + 16; // + gap
  track.scrollBy({ left: direction * step, behavior: 'smooth' });
}

carousel.querySelector('.carousel-prev').addEventListener('click', () => scrollByOneImage(-1));
carousel.querySelector('.carousel-next').addEventListener('click', () => scrollByOneImage(1));
