/**
 * Soft Navigation (PJAX-style) for persistent audio playback
 * This script intercepts link clicks and loads new page content via fetch,
 * updating only the main content area while keeping the music player intact.
 */
(function () {
    'use strict';

    // Configuration
    const MAIN_CONTENT_SELECTOR = '#main-content';
    const EXCLUDED_LINKS = [
        'mailto:',
        'tel:',
        'javascript:',
        '#',
        'http://',
        'https://'
    ];

    /**
     * Check if a link should use soft navigation
     */
    function shouldSoftNavigate(href) {
        if (!href) return false;

        // Exclude external links and special protocols
        for (const prefix of EXCLUDED_LINKS) {
            if (prefix === 'http://' || prefix === 'https://') {
                // Allow same-origin http/https links
                if (href.startsWith(prefix) && !href.startsWith(window.location.origin)) {
                    return false;
                }
            } else if (href.startsWith(prefix)) {
                return false;
            }
        }

        return true;
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
            // Show loading state (optional)
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
                // Check if this CSS is already loaded in HEAD (ignore body links as they will be wiped)
                // We typically want to hoist it to HEAD and mark it as soft-loaded
                if (!document.head.querySelector(`link[href="${href}"]`)) {
                    const newLink = document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = href;
                    if (link.integrity) newLink.integrity = link.integrity;
                    newLink.setAttribute('data-soft-css', 'true'); // Mark for future cleanup
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

            // Re-run any necessary scripts for the new content
            reinitializePageScripts();

            // Dispatch custom event for other scripts to hook into
            window.dispatchEvent(new CustomEvent('softNavigate', { detail: { url, playerData } }));

        } catch (error) {
            console.error('Soft navigation failed:', error);
            // Fallback to hard navigation
            window.location.href = url;
        } finally {
            document.body.classList.remove('soft-loading');
        }
    }

    /**
     * Re-initialize page scripts after soft navigation
     */
    function reinitializePageScripts() {
        // Re-run any scripts in main content (including module scripts)
        const mainContent = document.querySelector(MAIN_CONTENT_SELECTOR);
        if (mainContent) {
            const scripts = mainContent.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');

                // Copy all attributes including type="module"
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });

                // Copy inline content if no src
                if (!oldScript.src) {
                    newScript.textContent = oldScript.textContent;
                }

                // Replace the old script with new one to trigger execution
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        }

        // Dispatch pageReady event for scripts to re-initialize
        // This is the key event for 3D scripts to hook into
        window.dispatchEvent(new CustomEvent('pageReady'));

        // Also try to re-initialize known 3D components
        reinitialize3DComponents();
    }

    /**
     * Re-initialize 3D components after soft navigation
     */
    function reinitialize3DComponents() {
        // Tilt Effect - reinitialize on cards
        if (typeof TiltEffect !== 'undefined') {
            const cards = document.querySelectorAll('.featured-post, .post-card');
            cards.forEach(card => {
                // Only init if not already initialized
                if (!card._tiltInitialized) {
                    new TiltEffect(card);
                    card._tiltInitialized = true;
                }
            });
        }

        // ConstellationEffect (Hero 3D) - only on home page
        if (typeof ConstellationEffect !== 'undefined') {
            const canvas = document.querySelector('#canvas-container');
            if (canvas && !canvas._constellationInitialized) {
                new ConstellationEffect('#canvas-container');
                canvas._constellationInitialized = true;
            }
        }

        // Knowledge Graph - only on network page
        // This one needs special handling as it relies on window.graphData
        const graphContainer = document.getElementById('knowledge-graph-container');
        if (graphContainer && window.graphData && !graphContainer._graphInitialized) {
            // The graph script will need to be re-run
            // For now, trigger a page reload for the network page
            console.log('Knowledge graph detected - may need full reload');
        }
    }

    /**
     * Handle link clicks
     */
    function handleLinkClick(event) {
        // Check if it's a left click without modifiers
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        // Find the closest anchor element
        const link = event.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');

        // Check if this link should use soft navigation
        if (!shouldSoftNavigate(href)) return;

        // Check for download attribute or target="_blank"
        if (link.hasAttribute('download') || link.target === '_blank') return;

        // Prevent default and perform soft navigation
        event.preventDefault();

        // Build full URL
        const url = new URL(href, window.location.href).href;

        // Don't navigate if it's the same page
        if (url === window.location.href) return;

        softNavigate(url);
    }

    /**
     * Handle browser back/forward
     */
    function handlePopState(event) {
        if (event.state?.softNav) {
            softNavigate(window.location.href, false);
        } else {
            // For initial page load or non-soft-nav states, do soft nav anyway
            // to maintain audio continuity
            softNavigate(window.location.href, false);
        }
    }

    /**
     * Initialize soft navigation
     */
    function init() {
        // Set initial state
        history.replaceState({ softNav: true }, '');

        // Listen for link clicks
        document.addEventListener('click', handleLinkClick);

        // Listen for browser navigation
        window.addEventListener('popstate', handlePopState);

        console.log('Soft navigation initialized for persistent audio');
    }

    // Expose softNavigate globally for programmatic use
    window.softNavigate = softNavigate;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
