document.addEventListener('DOMContentLoaded', () => {
    const playerContainer = document.getElementById('music-player');
    if (!playerContainer) return;

    const audio = document.getElementById('bgm-audio');
    const playBtn = document.getElementById('music-control');
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');
    const seekSlider = document.getElementById('seek-slider');
    const volumeSlider = document.getElementById('volume-slider');

    // New UI Elements
    const titleEl = document.getElementById('current-song-title');
    const linkBtn = document.getElementById('song-post-link');
    const playlistToggle = document.getElementById('playlist-toggle');
    const playlistContainer = document.getElementById('playlist-container');
    const playlistList = document.getElementById('playlist-list');

    // State
    let isPlaying = false;
    let isDragging = false;
    let playlist = [];
    let currentIndex = 0;

    // --- 1. Initialization ---
    // Check if we are in Playlist mode or Single Track mode
    const playlistData = playerContainer.dataset.playlist;

    if (playlistData) {
        try {
            playlist = JSON.parse(playlistData);
        } catch (e) {
            console.error("Failed to parse playlist JSON", e);
        }
    } else {
        // Single track mode
        const src = playerContainer.dataset.audioSrc;
        const title = playerContainer.dataset.title;
        const link = playerContainer.dataset.link;
        if (src) {
            playlist = [{
                title: title || "Unknown Track",
                audio: src,
                link: link || "#"
            }];
        }
    }

    // If no music found, hide player
    if (playlist.length === 0) {
        playerContainer.style.display = 'none';
        return;
    }

    // Render Playlist UI if multiple tracks
    if (playlistList && playlist.length > 0) {
        playlist.forEach((track, index) => {
            const li = document.createElement('li');
            li.textContent = track.title;
            li.addEventListener('click', () => {
                playTrack(index);
            });
            playlistList.appendChild(li);
        });
    }

    // Toggle Playlist Visibility
    if (playlistToggle) {
        playlistToggle.addEventListener('click', () => {
            playlistContainer.classList.toggle('hidden');
        });

        // Close playlist when clicking outside
        document.addEventListener('click', (e) => {
            if (!playerContainer.contains(e.target)) {
                playlistContainer.classList.add('hidden');
            }
        });
    }

    // Load Initial Track (without playing yet, unless autoplay logic kicks in)
    loadTrack(currentIndex, false);

    // --- 2. Track Management ---
    function loadTrack(index, autoPlay = true) {
        if (index < 0 || index >= playlist.length) return;

        currentIndex = index;
        const track = playlist[index];

        // Update Audio Source (handle local paths vs URLs if needed, assuming relative paths work)
        // Note: The template adds /audio/ prefix for single track but not for playlist if generated there?
        // Let's check how the JSON was built.
        // In template: "audio": "{{ .Params.audio }}" -> This is just filename.
        // In single mode: "src": "/audio/filename".
        // We need to standardize. 
        // Strategy: If src doesn't start with http or /, assume it needs /audio/ prefix.

        let src = track.audio;
        if (!src.startsWith('http') && !src.startsWith('/')) {
            src = '/audio/' + src;
        }

        if (audio.src !== window.location.origin + src) {
            audio.src = src;
        }

        // Update UI
        if (titleEl) titleEl.textContent = track.title;
        if (linkBtn) linkBtn.href = track.link;

        // Update Active Visuals in Playlist
        if (playlistList) {
            const items = playlistList.querySelectorAll('li');
            items.forEach((item, i) => {
                if (i === index) item.classList.add('active');
                else item.classList.remove('active');
            });
        }

        // Play if requested
        if (autoPlay) {
            playAudio();
        }
    }

    function playTrack(index) {
        loadTrack(index, true);
    }

    // --- 3. Playback Control ---
    async function playAudio() {
        try {
            await audio.play();
            isPlaying = true;
            updateUIState(true);
        } catch (error) {
            console.warn("Playback blocked or failed:", error);
            isPlaying = false;
            updateUIState(false);
        }
    }

    function pauseAudio() {
        audio.pause();
        isPlaying = false;
        updateUIState(false);
    }

    playBtn.addEventListener('click', () => {
        if (isPlaying) pauseAudio();
        else playAudio();
    });

    function updateUIState(playing) {
        if (playing) {
            playerContainer.classList.add('playing');
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        } else {
            playerContainer.classList.remove('playing');
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        }
    }

    // --- 4. Autoplay Policy (Homepage) ---
    // If on homepage (playlist mode often implies this), try to autoplay the first track.
    // User requested: "Homepage enter -> Autoplay".
    const initialVol = 0.2;
    audio.volume = initialVol;
    if (volumeSlider) {
        volumeSlider.value = initialVol;
        updateSliderGradient(volumeSlider, initialVol * 100);
    }

    // Only attempt autoplay if we haven't interacted yet? 
    // Actually, just try it.
    // Use a small timeout to let the page settle.
    setTimeout(() => {
        // Only autoplay if player is visible
        if (playerContainer.style.display !== 'none') {
            // We just call playAudio. loadTrack(0, false) was called earlier.
            playAudio();
        }
    }, 800);


    // --- 5. Seek & Volume ---
    audio.addEventListener('timeupdate', () => {
        if (!isDragging) {
            const progress = (audio.currentTime / audio.duration) * 100;
            seekSlider.value = progress || 0;
            updateSliderGradient(seekSlider, progress);
        }
    });

    seekSlider.addEventListener('input', (e) => {
        isDragging = true;
        const progress = e.target.value;
        updateSliderGradient(seekSlider, progress);
    });

    seekSlider.addEventListener('change', (e) => {
        isDragging = false;
        const progress = e.target.value;
        const seekTime = (audio.duration / 100) * progress;
        audio.currentTime = seekTime;
    });

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            audio.volume = val;
            updateSliderGradient(e.target, val * 100);
        });
    }

    function updateSliderGradient(element, percent) {
        if (!element) return;
        if (isNaN(percent)) percent = 0;
        element.style.background = `linear-gradient(to right, rgba(255,255,255,0.8) ${percent}%, rgba(255,255,255,0.2) ${percent}%)`;
    }

    // --- 6. End of Track Behavior ---
    audio.addEventListener('ended', () => {
        // Auto-play next track if in playlist
        if (playlist.length > 1) {
            let nextIndex = currentIndex + 1;
            if (nextIndex >= playlist.length) nextIndex = 0; // Loop
            loadTrack(nextIndex, true);
        } else {
            // Loop single track if loop attribute set (it is in HTML)
            // But if we want playlist logic to override 'loop' attribute:
            // HTML has 'loop'.
            // If loop is true, 'ended' event might not fire? 
            // Actually <audio loop> will not fire 'ended'. 
            // So if we want playlist, we should REMOVE 'loop' attribute from HTML or handle it.
            // Let's remove 'loop' attribute via JS if playlist > 1.
        }
    });

    if (playlist.length > 1) {
        audio.loop = false;
    }
});
