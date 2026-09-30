const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');
const year = document.querySelector('[data-year]');

const syncHeader = () => header?.classList.toggle('scrolled', window.scrollY > 18);
syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

const closeMenu = () => {
  menu?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
};

menuButton?.addEventListener('click', () => {
  const isOpen = menu?.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(Boolean(isOpen)));
  document.body.classList.toggle('menu-open', Boolean(isOpen));
});

menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
  }
});
if (year) year.textContent = String(new Date().getFullYear());

const contactAlert = document.querySelector('[data-contact-alert]');
const contactAlertText = document.querySelector('[data-contact-alert-text]');
let contactAlertTimer;
document.querySelectorAll('[data-contact-placeholder]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    if (!contactAlert || !contactAlertText) return;
    contactAlertText.textContent = `Nomor atau akun ${link.dataset.contactPlaceholder} resmi perlu ditambahkan.`;
    contactAlert.classList.add('visible');
    clearTimeout(contactAlertTimer);
    contactAlertTimer = setTimeout(() => contactAlert.classList.remove('visible'), 3600);
  });
});
// Manual navigation keeps the cooperative introduction calm and readable.
const aboutSlides = [...document.querySelectorAll('[data-about-slide]')];
const aboutDots = [...document.querySelectorAll('[data-about-go]')];
let aboutIndex = 0;
function showAboutSlide(index) {
  if (!aboutSlides.length) return;
  aboutIndex = (index + aboutSlides.length) % aboutSlides.length;
  aboutSlides.forEach((slide, position) => {
    slide.hidden = position !== aboutIndex;
    slide.setAttribute('aria-hidden', String(position !== aboutIndex));
  });
  aboutDots.forEach((dot, position) => {
    if (position === aboutIndex) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
}
aboutDots.forEach(dot => dot.addEventListener('click', () => showAboutSlide(Number(dot.dataset.aboutGo))));
document.querySelector('[data-about-prev]')?.addEventListener('click', () => showAboutSlide(aboutIndex - 1));
document.querySelector('[data-about-next]')?.addEventListener('click', () => showAboutSlide(aboutIndex + 1));
showAboutSlide(0);
