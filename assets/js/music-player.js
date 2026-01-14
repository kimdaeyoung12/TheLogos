document.addEventListener('DOMContentLoaded', () => {
    const playerContainer = document.getElementById('music-player');
    if (!playerContainer) return;

    const audio = document.getElementById('bgm-audio');
    const btn = document.getElementById('music-control');
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');

    let isPlaying = false;

    // Toggle Play/Pause
    btn.addEventListener('click', async () => {
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            playerContainer.classList.remove('playing');
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        } else {
            try {
                await audio.play();
                isPlaying = true;
                playerContainer.classList.add('playing');
                playIcon.classList.add('hidden');
                pauseIcon.classList.remove('hidden');
            } catch (error) {
                console.error("Audio playback failed:", error);
            }
        }
    });

    // Handle Audio Ended (Loop is enabled in HTML, but just in case)
    audio.addEventListener('ended', () => {
        // If not looping, reset UI
        if (!audio.loop) {
            isPlaying = false;
            playerContainer.classList.remove('playing');
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        }
    });
});
