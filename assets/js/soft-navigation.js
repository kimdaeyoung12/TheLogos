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

        // Get link tags inside main content (page-specific CSS)
        const mainContent = doc.querySelector(MAIN_CONTENT_SELECTOR);
        const pageLinks = mainContent ? Array.from(mainContent.querySelectorAll('link[rel="stylesheet"]')) : [];

        return {
            content: mainContent,
            title: doc.querySelector('title')?.textContent || document.title,
            // Get new player data if present
            playerData: doc.querySelector('#music-player')?.dataset,
            // Page-specific CSS links
            cssLinks: pageLinks
        };
    }

    /**
     * Perform soft navigation
     */
    async function softNavigate(url, pushState = true) {
        try {
            // Show loading state
            document.body.classList.add('soft-loading');

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const { content, title, playerData, cssLinks } = extractMainContent(html);

            if (!content) {
                // Fallback to hard navigation if main content not found
                window.location.href = url;
                return;
            }

            // Cleanup old page-specific CSS that was Soft-Loaded
            const oldSoftLinks = document.head.querySelectorAll('link[data-soft-css="true"]');
            oldSoftLinks.forEach(link => link.remove());

            // Load any page-specific CSS that we don't already have
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

            // Update page title
            document.title = title;

            // Update URL
            if (pushState) {
                history.pushState({ softNav: true }, '', url);
            }

            // Scroll to top
            window.scrollTo(0, 0);

            // Re-run any necessary scripts for the new content (Await completion)
            await reinitializePageScripts();

            // Dispatch custom events for other scripts to hook into
            window.dispatchEvent(new CustomEvent('softNavigate', { detail: { url, playerData } }));
            window.dispatchEvent(new CustomEvent('pageReady', { detail: { url, playerData } }));

        } catch (error) {
            console.error('Soft navigation failed:', error);
            window.location.href = url;
        } finally {
            document.body.classList.remove('soft-loading');
        }
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
