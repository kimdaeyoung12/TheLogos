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
    let isDragging = false; // Prevent update while seeking

    // --- 1. Autoplay Logic ---
    // Try to autoplay at low volume
    audio.volume = 0.2; // Default starting volume (User requested low)
    if (volumeSlider) volumeSlider.value = 0.2;

    const startAutoplay = async () => {
        try {
            await audio.play();
            isPlaying = true;
            updateUIState(true);
        } catch (error) {
            // Autoplay blocked - standard behavior
            console.log("Autoplay blocked by browser policy. Interaction required.");
            isPlaying = false;
            updateUIState(false);
        }
    };
    startAutoplay();

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
    // Update slider as song plays
    audio.addEventListener('timeupdate', () => {
        if (!isDragging) {
            const progress = (audio.currentTime / audio.duration) * 100;
            seekSlider.value = progress || 0;

            // Visual feedback on track fill (Webkit trick if needed, but standard range is fine for now)
            seekSlider.style.background = `linear-gradient(to right, rgba(255,255,255,0.8) ${progress}%, rgba(255,255,255,0.2) ${progress}%)`;
        }
    });

    // Seek input
    seekSlider.addEventListener('input', (e) => {
        isDragging = true;
        const seekTime = (audio.duration / 100) * e.target.value;
        audio.currentTime = seekTime;

        // Immediate visual update
        const progress = e.target.value;
        seekSlider.style.background = `linear-gradient(to right, rgba(255,255,255,0.8) ${progress}%, rgba(255,255,255,0.2) ${progress}%)`;
    });

    seekSlider.addEventListener('change', () => {
        isDragging = false;
    });

    // --- 4. Volume Logic ---
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            audio.volume = e.target.value;
            // Optional: Change icon if muted?
        });

        // Initialize gradient for volume too
        const volVal = volumeSlider.value * 100; // 0.2 -> 20
        volumeSlider.style.background = `linear-gradient(to right, rgba(255,255,255,0.8) ${volVal}%, rgba(255,255,255,0.2) ${volVal}%)`;

        volumeSlider.addEventListener('input', (e) => {
            const val = e.target.value * 100;
            e.target.style.background = `linear-gradient(to right, rgba(255,255,255,0.8) ${val}%, rgba(255,255,255,0.2) ${val}%)`;
        });
    }

    // Handle Ended
    audio.addEventListener('ended', () => {
        if (!audio.loop) {
            isPlaying = false;
            updateUIState(false);
        }
    });
});
