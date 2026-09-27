const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');
const demoButton = document.querySelector('[data-demo-button]');
const toast = document.querySelector('[data-toast]');
const toastClose = document.querySelector('[data-toast-close]');
const year = document.querySelector('[data-year]');
let toastTimer;

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
    toast?.classList.remove('visible');
  }
});

demoButton?.addEventListener('click', () => {
  clearTimeout(toastTimer);
  toast?.classList.add('visible');
  toastTimer = window.setTimeout(() => toast?.classList.remove('visible'), 5000);
});

toastClose?.addEventListener('click', () => toast?.classList.remove('visible'));
if (year) year.textContent = String(new Date().getFullYear());
