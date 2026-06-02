/**
 * Soft Navigation (PJAX-style) for persistent audio playback
 * This script intercepts link clicks and loads new page content via fetch,
 * updating only the main content area while keeping the music player intact.
 */
(function () {
    'use strict';

    // Configuration
    const MAIN_CONTENT_SELECTOR = '#main-content';

    /**
     * Check if a link should use soft navigation
     */
    function shouldSoftNavigate(href) {
        if (!href) return false;

        // Handle special protocols immediately
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
            return false;
        }

        // Anchors-only links: skip
        if (href === '#' || href.startsWith('#')) return false;

        try {
            // Resolve to absolute URL relative to current page
            const url = new URL(href, window.location.href);

            // Only same-origin navigations use soft nav
            if (url.origin !== window.location.origin) return false;

            // Skip if it has a file extension that isn't HTML (e.g., .pdf, .zip)
            const path = url.pathname;
            const nonHtmlExtensions = /\.(pdf|zip|png|jpg|jpeg|gif|svg|mp3|mp4|doc|docx|xls|xlsx)$/i;
            if (nonHtmlExtensions.test(path)) return false;

            return true;
        } catch (e) {
            // If URL parsing fails, fall back to hard nav
            return false;
        }
    }

    /**
     * Extract the main content from fetched HTML
     */
    function extractMainContent(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const mainContent = doc.querySelector(MAIN_CONTENT_SELECTOR);
        const pageLinks = mainContent ? Array.from(mainContent.querySelectorAll('link[rel="stylesheet"]')) : [];

        // Extract metadata
        const metaTags = Array.from(doc.querySelectorAll('meta[name], meta[property]'));
        const headLinks = Array.from(doc.querySelectorAll('head link:not([rel="stylesheet"])'));

        return {
            content: mainContent,
            title: doc.querySelector('title')?.textContent || document.title,
            bodyClass: doc.body.className,
            playerData: doc.querySelector('#music-player')?.dataset,
            cssLinks: pageLinks,
            metaTags: metaTags,
            headLinks: headLinks
        };
    }

    /**
     * Perform soft navigation
     */
    async function softNavigate(url, pushState = true) {
        const targetUrl = new URL(url, window.location.href).href;
        const currentUrl = window.location.href;

        try {
            // Save scroll position for the current page
            if (pushState) {
                sessionStorage.setItem('scroll-' + currentUrl, window.scrollY);
            }

            // Show loading state
            document.body.classList.add('soft-loading');

            const response = await fetch(targetUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const { content, title, bodyClass, playerData, cssLinks, metaTags, headLinks } = extractMainContent(html);

            if (!content) {
                window.location.href = targetUrl;
                return;
            }

            window.dispatchEvent(new CustomEvent('beforeSoftNavigate', {
                detail: { url: targetUrl, currentUrl }
            }));

            // Update Meta Tags & Head Links
            updateHeadElements(metaTags, headLinks);

            // Cleanup old page-specific CSS
            const oldSoftLinks = document.head.querySelectorAll('link[data-soft-css="true"]');
            oldSoftLinks.forEach(link => link.remove());

            // Load new page-specific CSS
            cssLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (!document.head.querySelector(`link[href="${href}"]`)) {
                    const newLink = document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = href;
                    if (link.integrity) newLink.integrity = link.integrity;
                    newLink.setAttribute('data-soft-css', 'true');
                    document.head.appendChild(newLink);
                }
            });

            // Update main content
            const mainContent = document.querySelector(MAIN_CONTENT_SELECTOR);
            if (mainContent) {
                mainContent.innerHTML = content.innerHTML;
            }

            // Update page title & body class
            document.title = title;
            // Preserving 'dark' class if user toggled it manually might be needed, 
            // but usually Hugo handles it. Let's merge if 'dark' is present in current body.
            const isDark = document.body.classList.contains('dark');
            document.body.className = bodyClass;
            if (isDark) document.body.classList.add('dark');

            // Update URL
            if (pushState) {
                history.pushState({ softNav: true }, '', targetUrl);
                window.scrollTo(0, 0);
            } else {
                // Restoration from PopState (Back/Forward)
                const savedScroll = sessionStorage.getItem('scroll-' + targetUrl);
                if (savedScroll) {
                    window.scrollTo(0, parseInt(savedScroll, 10));
                } else {
                    window.scrollTo(0, 0);
                }
            }

            await reinitializePageScripts();

            requestAnimationFrame(() => {
                window.dispatchEvent(new CustomEvent('softNavigate', { detail: { url: targetUrl, playerData } }));
                window.dispatchEvent(new CustomEvent('pageReady', { detail: { url: targetUrl, playerData } }));
            });

        } catch (error) {
            console.error('Soft navigation failed:', error);
            window.location.href = targetUrl;
        } finally {
            document.body.classList.remove('soft-loading');
        }
    }

    /**
     * Update head elements (Meta tags, SEO, etc.)
     */
    function updateHeadElements(newMeta, newLinks) {
        // Remove existing dynamic-friendly meta
        const targetSelectors = [
            'meta[name="description"]',
            'meta[property^="og:"]',
            'meta[name^="twitter:"]',
            'meta[name^="ai-"]'
        ];
        targetSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
        });

        // Add new ones
        newMeta.forEach(meta => {
            const name = meta.getAttribute('name');
            const prop = meta.getAttribute('property');
            if (name === 'description' || (prop && prop.startsWith('og:')) || (name && (name.startsWith('twitter:') || name.startsWith('ai-')))) {
                document.head.appendChild(meta.cloneNode(true));
            }
        });
    }

    /**
     * Re-initialize page scripts after soft navigation
     */
    async function reinitializePageScripts() {
        const mainContent = document.querySelector(MAIN_CONTENT_SELECTOR);
        if (!mainContent) return;

        const scripts = Array.from(mainContent.querySelectorAll('script'));
        for (const oldScript of scripts) {
            await new Promise((resolve) => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                
                if (newScript.src) {
                    newScript.onload = () => resolve();
                    newScript.onerror = () => resolve();
                } else {
                    newScript.textContent = oldScript.textContent;
                    setTimeout(resolve, 0);
                }
                
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        }
    }

    /**
     * Handle link clicks
     */
    function handleLinkClick(event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const link = event.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!shouldSoftNavigate(href)) return;
        if (link.hasAttribute('download') || link.target === '_blank') return;

        event.preventDefault();
        const url = new URL(href, window.location.href).href;
        if (url === window.location.href) return;

        softNavigate(url);
    }

    /**
     * Handle browser back/forward
     */
    function handlePopState(event) {
        softNavigate(window.location.href, false);
    }

    /**
     * Initialize soft navigation
     */
    function init() {
        history.replaceState({ softNav: true }, '');
        document.addEventListener('click', handleLinkClick);
        window.addEventListener('popstate', handlePopState);
        console.log('Soft navigation initialized for persistent audio');
    }

    // Expose softNavigate globally
    window.softNavigate = softNavigate;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
