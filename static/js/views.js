document.addEventListener('DOMContentLoaded', () => {
  // Increase view count on single pages
  const slugMeta = document.querySelector('meta[name="post-slug"]');
  if (slugMeta) {
    const slug = slugMeta.getAttribute('content');
    const key = `view:${slug}`;
    let count = parseInt(localStorage.getItem(key) || '0', 10);
    count += 1;
    localStorage.setItem(key, count);
    const viewEl = document.getElementById('view-count');
    if (viewEl) viewEl.textContent = count;
  }

  // Fill view counts on list pages
  document.querySelectorAll('[data-slug]').forEach((span) => {
    const slug = span.getAttribute('data-slug');
    const key = `view:${slug}`;
    const count = localStorage.getItem(key) || '0';
    span.textContent = count;
  });
});
