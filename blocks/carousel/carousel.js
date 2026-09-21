/*
 * PULSE Hero Carousel
 * -------------------
 * A slideshow of full-bleed image slides, each with a frosted "copy overlay"
 * card (title / lead / price / description / CTA / fine print). Migrated from
 * Figma frames 55:2 (landing) and 55:145 (product detail) of the Agentic AI
 * Delivery file.
 *
 * Interaction spec (from the designs):
 *  - prev / next circular arrow controls
 *  - dot pagination (active dot = brand blue)
 *  - a "n / m" slide counter (top-right)
 *  - optional thumbnail rail (`.carousel.thumbnails` variant, e.g. the PDP)
 *  - autoplay that pauses on hover / focus / when the tab is hidden and is
 *    disabled entirely under `prefers-reduced-motion`
 *  - keyboard (← / →) and touch-swipe navigation
 *
 * Content model (DA-safe `block › row › cell(s)`): each row is one slide with a
 * media cell (a <picture>) and a copy cell (the overlay text/CTA). The overlay
 * structure is rebuilt in JS so it survives the DA pipeline (which strips
 * authored classes and flattens wrapper divs).
 */

const AUTOPLAY_MS = 6000;
const SWIPE_THRESHOLD = 40;

/** Wrap the index into the valid [0, count) range (both directions). */
export function wrapIndex(index, count) {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/** True when the user has asked the OS to reduce motion. */
export function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Split a slide's authored cells into { media, copy }.
 * Defensive: authors may omit a cell or put the picture in either position.
 */
export function readSlideCells(row) {
  const cells = [...row.children];
  let media = null;
  let copy = null;
  cells.forEach((cell) => {
    if (!media && cell.querySelector('picture, img')) media = cell;
    else if (!copy) copy = cell;
  });
  // if only one cell was authored and it holds the picture, there is no copy
  if (!copy && media && cells.length > 1) [, copy] = cells;
  return { media, copy };
}

/** Build the circular prev/next arrow control. */
function createArrow(direction, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `carousel-arrow carousel-arrow-${direction}`;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = direction === 'prev'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return btn;
}

export default function decorate(block) {
  const rows = [...block.children];
  const hasThumbnails = block.classList.contains('thumbnails');

  // region label: an authored `data-label`, else a sensible default
  const label = block.dataset.label || 'Featured products';

  // ---- build the stage + slides -----------------------------------------
  const stage = document.createElement('div');
  stage.className = 'carousel-stage';

  const slidesTrack = document.createElement('div');
  slidesTrack.className = 'carousel-slides';

  const slides = [];
  const thumbSources = [];

  rows.forEach((row, i) => {
    const { media, copy } = readSlideCells(row);
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${rows.length}`);
    slide.id = `${block.id || 'carousel'}-slide-${i}`;

    if (media) {
      media.classList.add('carousel-slide-media');
      slide.append(media);
      const pic = media.querySelector('picture, img');
      if (pic) thumbSources.push(pic.cloneNode(true));
    }
    if (copy) {
      copy.classList.add('carousel-copy');
      slide.append(copy);
    }
    slidesTrack.append(slide);
    slides.push(slide);
  });

  stage.append(slidesTrack);

  // ---- controls ----------------------------------------------------------
  const controls = document.createElement('div');
  controls.className = 'carousel-controls';

  const prev = createArrow('prev', 'Previous slide');
  const next = createArrow('next', 'Next slide');

  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  dots.setAttribute('role', 'tablist');
  const dotButtons = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dots.append(dot);
    return dot;
  });

  controls.append(prev, dots, next);

  const counter = document.createElement('div');
  counter.className = 'carousel-counter';

  // live region for screen readers announcing the active slide
  const live = document.createElement('div');
  live.className = 'carousel-live';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  stage.append(counter, controls, live);

  // ---- optional thumbnail rail ------------------------------------------
  let thumbButtons = [];
  let rail = null;
  if (hasThumbnails && thumbSources.length) {
    rail = document.createElement('div');
    rail.className = 'carousel-thumbs';
    thumbButtons = thumbSources.map((pic, i) => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'carousel-thumb';
      t.setAttribute('aria-label', `Show slide ${i + 1}`);
      t.append(pic);
      rail.append(t);
      return t;
    });
  }

  // ---- assemble ----------------------------------------------------------
  block.textContent = '';
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');
  block.setAttribute('aria-label', label);
  block.append(stage);
  if (rail) block.append(rail);

  // ---- state machine -----------------------------------------------------
  const count = slides.length;
  let current = 0;
  let timer = null;

  const update = () => {
    slidesTrack.style.transform = `translateX(-${current * 100}%)`;
    slides.forEach((s, i) => {
      const active = i === current;
      s.classList.toggle('is-active', active);
      s.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    dotButtons.forEach((d, i) => {
      d.classList.toggle('is-active', i === current);
      d.setAttribute('aria-selected', i === current ? 'true' : 'false');
    });
    thumbButtons.forEach((t, i) => t.classList.toggle('is-active', i === current));
    counter.textContent = `${current + 1} / ${count}`;
    live.textContent = `Slide ${current + 1} of ${count}`;
  };

  const goTo = (index) => {
    current = wrapIndex(index, count);
    update();
  };
  const nextSlide = () => goTo(current + 1);
  const prevSlide = () => goTo(current - 1);

  // ---- autoplay ----------------------------------------------------------
  const canAutoplay = count > 1 && !prefersReducedMotion();
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const start = () => {
    if (!canAutoplay || timer) return;
    timer = setInterval(nextSlide, AUTOPLAY_MS);
    // in Node-based tests the timer handle exposes unref(); calling it keeps a
    // live carousel from holding the process open. Harmless (undefined) in DOM.
    if (timer && typeof timer.unref === 'function') timer.unref();
  };

  // ---- wiring ------------------------------------------------------------
  next.addEventListener('click', () => { nextSlide(); });
  prev.addEventListener('click', () => { prevSlide(); });
  dotButtons.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
  thumbButtons.forEach((t, i) => t.addEventListener('click', () => goTo(i)));

  block.addEventListener('mouseenter', stop);
  block.addEventListener('mouseleave', start);
  block.addEventListener('focusin', stop);
  block.addEventListener('focusout', start);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  block.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    }
  });

  // touch / pointer swipe
  let startX = null;
  stage.addEventListener('pointerdown', (e) => { startX = e.clientX; stop(); });
  stage.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) nextSlide();
      else prevSlide();
    }
    startX = null;
    start();
  });

  // single-slide: hide navigation affordances
  if (count <= 1) {
    controls.hidden = true;
    counter.hidden = true;
  }

  update();
  start();
  return {
    goTo, nextSlide, prevSlide, stop, start,
  }; // exposed for tests / programmatic use
}
