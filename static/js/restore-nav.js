// Restoration Script for Header Visibility
// This script ensures the header remains visible and sticky, overriding any conflicting interactions.

(function () {
    function enforceHeaderVisibility() {
        const header = document.querySelector('header');
        if (!header) return;

        // Force sticky positioning and high z-index
        header.classList.remove('hidden', '-translate-y-full', 'opacity-0');
        header.classList.add('sticky', 'top-0', 'z-50', 'translate-y-0', 'opacity-100');

        // Ensure display block/flex
        if (getComputedStyle(header).display === 'none') {
            header.style.display = 'block'; // or flex, depending on design
        }
    }

    // Run on load
    window.addEventListener('load', enforceHeaderVisibility);

    // Run on scroll (throttled) to counter-act any "hide on scroll" scripts
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                enforceHeaderVisibility();
                ticking = false;
            });
            ticking = true;
        }
    });

    // Run on soft navigation (if applicable)
    window.addEventListener('softNavigate', enforceHeaderVisibility);
    window.addEventListener('pageReady', enforceHeaderVisibility);

    console.log('Header visibility enforcement active.');
})();
