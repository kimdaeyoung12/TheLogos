// Restoration Script for Header Visibility
// This script ensures the header remains visible and sticky, overriding any conflicting interactions.

(function () {
    function enforceHeaderVisibility() {
        const header = document.querySelector('header');
        if (!header) return;

        // Force sticky positioning and high z-index
        header.classList.remove('hidden', '-translate-y-full', 'opacity-0', 'd-desktop-none');
        header.classList.add('sticky', 'top-0', 'z-50', 'translate-y-0', 'opacity-100', 'visible');

        // Ensure display block/flex
        // We use important to override inline styles
        header.style.cssText += 'display: block !important; visibility: visible !important; opacity: 1 !important; transform: none !important;';
    }

    // Initialize Observer
    function initObserver() {
        const header = document.querySelector('header');
        if (!header) return;

        // Observe attribute changes (class, style)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                    const classList = header.classList;
                    if (classList.contains('hidden') || classList.contains('opacity-0') || classList.contains('-translate-y-full')) {
                        console.log('Detected header hiding attempt. Reverting...');
                        enforceHeaderVisibility();
                    }
                    if (header.style.display === 'none' || header.style.visibility === 'hidden' || header.style.opacity === '0') {
                        console.log('Detected header style hiding. Reverting...');
                        enforceHeaderVisibility();
                    }
                }
            });
        });

        observer.observe(header, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        console.log('Header visibility observer active.');
    }

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            enforceHeaderVisibility();
            initObserver();
        });
    } else {
        enforceHeaderVisibility();
        initObserver();
    }

    // Run periodically for the first few seconds to fight race conditions
    let checks = 0;
    const interval = setInterval(() => {
        enforceHeaderVisibility();
        checks++;
        if (checks > 20) clearInterval(interval); // Stop after 2 seconds (100ms * 20)
    }, 100);

    // Run on scroll (throttled)
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

    // Run on soft navigation
    window.addEventListener('softNavigate', enforceHeaderVisibility);
    window.addEventListener('pageReady', enforceHeaderVisibility);

    console.log('Header visibility enforcement 2.0 active.');
})();
