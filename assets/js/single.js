(function () {
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initArticleSharing, { once: true });
    } else {
        initArticleSharing();
    }
})();
