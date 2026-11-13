'use strict';
(() => {
    const players = [...document.querySelectorAll('[data-web-tutorial]')];
    for (const player of players) {
        const video = player.querySelector('video');
        const steps = [...player.querySelectorAll('[data-tutorial-time]')];
        const sync = () => {
            const active = steps.filter(step => Number(step.dataset.tutorialTime) <= video.currentTime).at(-1) || steps[0];
            for (const step of steps) {
                if (step === active) step.setAttribute('aria-current', 'step');
                else step.removeAttribute('aria-current');
            }
        };
        video.addEventListener('timeupdate', sync);
        video.addEventListener('seeked', sync);
        video.addEventListener('play', () => {
            for (const other of players) if (other !== player) other.querySelector('video').pause();
        });
        for (const step of steps) step.addEventListener('click', () => {
            const seek = () => {
                video.currentTime = Number(step.dataset.tutorialTime);
                video.play().catch(() => {});
                sync();
            };
            if (video.readyState >= 1) seek();
            else {
                video.addEventListener('loadedmetadata', seek, {once: true});
                video.load();
            }
        });
        sync();
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) for (const player of players) player.querySelector('video').pause();
    });
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) if (!entry.isIntersecting) entry.target.querySelector('video').pause();
        });
        for (const player of players) observer.observe(player);
    }
})();
