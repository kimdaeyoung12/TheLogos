document.addEventListener('DOMContentLoaded', function () {
    // Share functionality
    const shareButtons = document.querySelectorAll('.share-btn');
    const pageUrl = window.location.href;
    const pageTitle = document.querySelector('.article-title').textContent;

    shareButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const shareType = this.dataset.share;

            if (shareType === 'twitter') {
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent(pageUrl)}`, '_blank');
            } else if (shareType === 'facebook') {
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`, '_blank');
            } else if (shareType === 'link') {
                navigator.clipboard.writeText(pageUrl).then(() => {
                    const originalText = this.querySelector('span').textContent;
                    this.querySelector('span').textContent = '복사됨!';
                    setTimeout(() => {
                        this.querySelector('span').textContent = originalText;
                    }, 2000);
                });
            }
        });
    });
});
