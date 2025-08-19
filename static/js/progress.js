(function () {
  // Create and insert a reading progress bar element
  const bar = document.createElement('div');
  bar.id = 'reading-progress';
  document.body.appendChild(bar);

  // Update the progress bar width based on scroll position
  const updateProgress = () => {
    const h = document.documentElement;
    const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
    const width = Math.min(1, Math.max(0, scrolled)) * 100;
    bar.style.width = width + '%';
  };

  // Attach scroll listener
  document.addEventListener('scroll', updateProgress, { passive: true });
  // Initialize on page load
  updateProgress();
})();