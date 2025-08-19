(function () {
  // Create a back-to-top button
  const btn = document.createElement('button');
  btn.id = 'back-to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.textContent = '↑';
  document.body.appendChild(btn);

  // Toggle visibility based on scroll position
  const toggleVisibility = () => {
    btn.style.opacity = window.scrollY > 600 ? '1' : '0';
  };

  // Scroll to top smoothly on click
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.addEventListener('scroll', toggleVisibility, { passive: true });
  // Initialize
  toggleVisibility();
})();
