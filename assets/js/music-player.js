document.addEventListener('DOMContentLoaded', () => {
    const playerContainer = document.getElementById('music-player');
    if (!playerContainer) return;

    const audio = document.getElementById('bgm-audio');
    const btn = document.getElementById('music-control');
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');
    const seekSlider = document.getElementById('seek-slider');
    const volumeSlider = document.getElementById('volume-slider');

    let isPlaying = false;
    let isDragging = false;

    // --- 1. Autoplay Logic (Resilient) ---
    // Try to autoplay at user requested low volume
    // Policy: Modern browsers block "Audible" autoplay.
    // Strategy: Try audible -> catch -> try muted (not requested but fallback) -> or just show UI

    // Set initial volume
    const initialVol = 0.2;
    audio.volume = initialVol;
    if (volumeSlider) {
        volumeSlider.value = initialVol;
        updateSliderGradient(volumeSlider, initialVol * 100);
    }

    const startAutoplay = async () => {
        try {
            await audio.play();
            // Success
            isPlaying = true;
            updateUIState(true);
            console.log("Autoplay success");
        } catch (error) {
            // Blocked
            console.warn("Autoplay blocked:", error);
            // We do NOT swap to muted autoplay because user wants music.
            // Just revert to paused state. User must click.
            isPlaying = false;
            updateUIState(false);

            // Optional: Show a tooltip "Click to play"?
        }
    };

    // Attempt autoplay slightly after load to ensure DOM ready
    setTimeout(startAutoplay, 500);


    // --- 2. Play/Pause Toggle ---
    btn.addEventListener('click', async () => {
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            updateUIState(false);
        } else {
            try {
                await audio.play();
                isPlaying = true;
                updateUIState(true);
            } catch (error) {
                console.error("Playback failed:", error);
            }
        }
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

    // --- 3. Seek Bar Logic ---
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
        const seekTime = (audio.duration / 100) * progress;
        audio.currentTime = seekTime;
        updateSliderGradient(seekSlider, progress);
    });

    seekSlider.addEventListener('change', () => {
        isDragging = false;
    });

    // --- 4. Volume Logic ---
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            audio.volume = val;
            updateSliderGradient(e.target, val * 100);
        });
    }

    // Utility: Gradient update for slider fill
    function updateSliderGradient(element, percent) {
        if (!element) return;
        // Safety for NaN
        if (isNaN(percent)) percent = 0;
        element.style.background = `linear-gradient(to right, rgba(255,255,255,0.8) ${percent}%, rgba(255,255,255,0.2) ${percent}%)`;
    }

    // Handle Ended
    audio.addEventListener('ended', () => {
        if (!audio.loop) {
            isPlaying = false;
            updateUIState(false);
        }
    });
});
