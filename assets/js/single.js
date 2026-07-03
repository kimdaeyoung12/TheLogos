(function () {
    function findHashTarget(hash) {
        if (!hash || hash === '#') return null;

        const rawId = hash.slice(1);
        let decodedId = rawId;
        try {
            decodedId = decodeURIComponent(rawId);
        } catch (error) {
            decodedId = rawId;
        }

        return document.getElementById(decodedId) || document.getElementById(rawId);
    }

    function scrollToHashTarget(hash, replaceState) {
        const target = findHashTarget(hash);
        if (!target) return false;

        const header = document.querySelector('body > header');
        const headerOffset = header ? header.getBoundingClientRect().height + 18 : 82;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;

        window.scrollTo({
            top: Math.max(0, targetTop),
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });

        if (replaceState) {
            history.replaceState(history.state, '', hash);
        } else {
            history.pushState(history.state, '', hash);
        }

        return true;
    }

    function initTableOfContents() {
        const links = document.querySelectorAll('.toc-nav a[href]');
        if (!links.length) return;

        links.forEach((link) => {
            if (link.dataset.tocReady === 'true') return;
            link.dataset.tocReady = 'true';

            link.addEventListener('click', (event) => {
                const href = link.getAttribute('href');
                if (!href) return;

                const url = new URL(href, window.location.href);
                const sameDocument =
                    url.origin === window.location.origin &&
                    url.pathname === window.location.pathname &&
                    url.search === window.location.search &&
                    url.hash;

                if (!sameDocument) return;

                event.preventDefault();
                scrollToHashTarget(url.hash);
            });
        });

        if (window.location.hash) {
            requestAnimationFrame(() => {
                scrollToHashTarget(window.location.hash, true);
            });
        }
    }

    function initArticleSharing() {
        const shareButtons = document.querySelectorAll('.share-btn');
        const titleEl = document.querySelector('.article-title');
        if (!shareButtons.length || !titleEl) return;

        const pageUrl = window.location.href;
        const pageTitle = titleEl.textContent.trim();

        shareButtons.forEach((btn) => {
            if (btn.dataset.shareReady === 'true') return;
            btn.dataset.shareReady = 'true';

            btn.addEventListener('click', function () {
                const shareType = this.dataset.share;

                if (shareType === 'twitter') {
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent(pageUrl)}`, '_blank', 'noopener,noreferrer');
                    return;
                }

                if (shareType === 'facebook') {
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`, '_blank', 'noopener,noreferrer');
                    return;
                }

                if (shareType === 'link') {
                    const label = this.querySelector('span');
                    const originalText = label ? label.textContent : '';
                    navigator.clipboard.writeText(pageUrl).then(() => {
                        if (!label) return;
                        label.textContent = 'Copied';
                        setTimeout(() => {
                            label.textContent = originalText || 'Copy Link';
                        }, 1800);
                    });
                }
            });
        });
    }

    function initArticlePage() {
        initTableOfContents();
        initArticleSharing();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initArticlePage, { once: true });
    } else {
        initArticlePage();
    }
})();
