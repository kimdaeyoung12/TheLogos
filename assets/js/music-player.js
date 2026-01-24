document.addEventListener('DOMContentLoaded', () => {
    console.log("Music Player Script Loaded - v3 (Soft Nav & Autoplay Fix)");
    const playerContainer = document.getElementById('music-player');
    if (!playerContainer) return;

    // --- Elements ---
    const audio = document.getElementById('bgm-audio');
    const playBtn = document.getElementById('music-control');
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');
    const seekSlider = document.getElementById('seek-slider');
    const volumeSlider = document.getElementById('volume-slider');

    // UI Info Elements
    const titleEl = document.getElementById('current-song-title');
    const linkBtn = document.getElementById('song-post-link');
    const playlistToggle = document.getElementById('playlist-toggle');
    const playlistContainer = document.getElementById('playlist-container');
    const playlistList = document.getElementById('playlist-list');
    const closePlaylistBtn = document.getElementById('close-playlist-btn');

    // --- State ---
    let isPlaying = false;
    let isDragging = false;
    let playlist = [];
    let currentIndex = 0;
    let hasAutoplayStarted = false;

    // --- 1. Data Initialization ---
    const playlistData = playerContainer.dataset.playlist;

    if (playlistData) {
        try {
            playlist = JSON.parse(playlistData);
        } catch (e) {
            console.error("Failed to parse playlist JSON", e);
        }
    }

    if (playlist.length === 0) {
        // Fallback for single track mode or no data
        const src = playerContainer.dataset.audioSrc;
        const title = playerContainer.dataset.title;
        const link = playerContainer.dataset.link;
        if (src) {
            playlist = [{
                title: title || "Unknown Track",
                audio: src,
                link: link || "#"
            }];
        } else {
            playerContainer.style.display = 'none';
            return;
        }
    }

    // Determine Initial Track based on current page's audio
    const initialAudio = playerContainer.dataset.initialAudio;
    if (initialAudio && playlist.length > 0) {
        // Prepare target path for comparison (remove leading slashes/audio prefix for loose matching)
        // Adjust this logic based on how your paths exactly look in TOML vs JSON
        const cleanPath = (p) => p.replace(/^\/?(audio\/)?/, '').replace(/^\//, '');
        const target = cleanPath(initialAudio);

        const foundIndex = playlist.findIndex(track => cleanPath(track.audio) === target);
        if (foundIndex !== -1) {
            currentIndex = foundIndex;
        }
    }

    // --- 2. UI Event Listeners (Register EARLY) ---
    // Toggle Play/Pause
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isPlaying) pauseAudio();
            else playAudio();
        });
    }

    // Playlist Toggle
    if (playlistToggle) {
        playlistToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlaylist();
        });
    }

    if (closePlaylistBtn) {
        closePlaylistBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closePlaylist();
        });
    }

    // Close playlist when clicking outside
    document.addEventListener('click', (e) => {
        if (playlistContainer && !playlistContainer.classList.contains('hidden')) {
            // If click is outside playlist container AND not on the toggle button
            if (!playlistContainer.contains(e.target) && !playlistToggle.contains(e.target)) {
                closePlaylist();
            }
        }
    });

    // Seek Slider
    if (seekSlider) {
        seekSlider.addEventListener('input', (e) => {
            isDragging = true;
            updateSliderGradient(seekSlider, e.target.value);
        });
        seekSlider.addEventListener('change', (e) => {
            isDragging = false;
            const seekTime = (audio.duration / 100) * e.target.value;
            audio.currentTime = seekTime;
        });
    }

    // Volume Slider
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            audio.volume = val;
            updateSliderGradient(volumeSlider, val * 100);
        });
    }

    // Audio Events
    audio.addEventListener('play', () => {
        isPlaying = true;
        updateUIState(true);
    });

    audio.addEventListener('pause', () => {
        isPlaying = false;
        updateUIState(false);
    });

    audio.addEventListener('timeupdate', () => {
        if (!isDragging && audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            if (seekSlider) {
                seekSlider.value = progress || 0;
                updateSliderGradient(seekSlider, progress);
            }
        }
    });

    audio.addEventListener('ended', () => {
        if (playlist.length > 1) {
            playNext();
        } else {
            // For single track, loop is handled by native 'loop' attribute unless we want custom logic
            // If we want manual loop:
            // audio.currentTime = 0; playAudio();
        }
    });


    // --- 3. Functions ---
    function togglePlaylist() {
        playlistContainer.classList.toggle('hidden');
    }

    function closePlaylist() {
        playlistContainer.classList.add('hidden');
    }

    function loadTrack(index, autoPlay = true) {
        if (index < 0 || index >= playlist.length) return;
        currentIndex = index;
        const track = playlist[index];

        // Path normalization
        let src = track.audio;
        if (!src.startsWith('http') && !src.startsWith('/')) {
            src = '/audio/' + src;
        }

        // Prevent reloading if same src
        const currentSrcPath = audio.getAttribute('src'); // Use getAttribute for raw value check if needed, or check audio.src
        // Comparing full URL to relative src can be tricky, so let's just assign. 
        // Browsers handle reassignment efficiently usually.

        if (audio.src !== new URL(src, window.location.origin).href) {
            audio.src = src;
        }

        // Update Text
        if (titleEl) titleEl.textContent = track.title;
        if (linkBtn) linkBtn.href = track.link;

        // Update Playlist Highlight
        renderPlaylist(); // Re-render or just update classes. Re-rendering is safer for sync.

        if (autoPlay) {
            playAudio();
        }
    }

    function renderPlaylist() {
        if (!playlistList) return;
        playlistList.innerHTML = '';
        playlist.forEach((track, idx) => {
            const li = document.createElement('li');
            li.textContent = track.title;
            if (idx === currentIndex) li.classList.add('active');

            li.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent bubbling to document click
                loadTrack(idx, true);
            });
            playlistList.appendChild(li);
        });
    }

    async function playAudio() {
        try {
            await audio.play();
            // State updates handled by 'play' event listener
            hasAutoplayStarted = true;
            playerContainer.classList.remove('awaiting-interaction');
            removeFallbackListeners();
        } catch (error) {
            console.warn("Playback prevented:", error);
            isPlaying = false;
            updateUIState(false);

            // If this was an autoplay attempt that failed, show hint
            if (!hasAutoplayStarted) {
                playerContainer.classList.add('awaiting-interaction');
                addFallbackListeners();
            }
        }
    }

    function pauseAudio() {
        audio.pause();
    }

    function playNext() {
        let next = currentIndex + 1;
        if (next >= playlist.length) next = 0;
        loadTrack(next, true);
    }

    function updateUIState(playing) {
        if (playing) {
            playerContainer.classList.add('playing');
            if (playIcon) playIcon.classList.add('hidden');
            if (pauseIcon) pauseIcon.classList.remove('hidden');
        } else {
            playerContainer.classList.remove('playing');
            if (playIcon) playIcon.classList.remove('hidden');
            if (pauseIcon) pauseIcon.classList.add('hidden');
        }
    }

    function updateSliderGradient(element, percent) {
        if (!element) return;
        if (isNaN(percent)) percent = 0;
        element.style.background = `linear-gradient(to right, rgba(255,255,255,0.8) ${percent}%, rgba(255,255,255,0.2) ${percent}%)`;
    }

    // --- 4. Initialization & Autoplay ---

    // Render initial playlist state
    renderPlaylist();

    // Initialize Volume
    const initialVol = 0.2;
    audio.volume = initialVol;
    if (volumeSlider) {
        volumeSlider.value = initialVol;
        updateSliderGradient(volumeSlider, initialVol * 100);
    }

    // Load track WITHOUT playing immediately (wait for timeout)
    loadTrack(currentIndex, false);

    // Initial Autoplay Attempt
    setTimeout(() => {
        if (playerContainer.style.display !== 'none') {
            playAudio();
        }
    }, 800);

    // --- 5. Fallback Interaction Handling ---
    function onUserInteraction() {
        if (!hasAutoplayStarted && !isPlaying) {
            playAudio();
        }
    }

    function addFallbackListeners() {
        ['click', 'touchstart', 'keydown', 'scroll'].forEach(evt =>
            document.addEventListener(evt, onUserInteraction, { once: true, passive: true })
        );
    }

    function removeFallbackListeners() {
        ['click', 'touchstart', 'keydown', 'scroll'].forEach(evt =>
            document.removeEventListener(evt, onUserInteraction)
        );
    }

    // Add listeners immediately as a safety net, they execute only once
    addFallbackListeners();

    // Disable loop for multi-track playlist
    // --- 7. Soft Navigation Support ---
    window.addEventListener('softNavigate', (e) => {
        const { playerData } = e.detail;
        if (!playerData || !playerData.initialAudio) return;

        const initialAudio = playerData.initialAudio;
        if (playlist.length > 0) {
            // Path normalization logic same as initialization
            const cleanPath = (p) => p.replace(/^\/?(audio\/)?/, '').replace(/^\//, '');
            const target = cleanPath(initialAudio);

            const foundIndex = playlist.findIndex(track => cleanPath(track.audio) === target);

            // Only switch track if it's different from current
            if (foundIndex !== -1 && foundIndex !== currentIndex) {
                console.log(`Soft navigation to new track: ${initialAudio}`);
                loadTrack(foundIndex, true); // Auto play new track
            }
        }
    });

    if (playlist.length > 1) {
        audio.loop = false;
    }
});
