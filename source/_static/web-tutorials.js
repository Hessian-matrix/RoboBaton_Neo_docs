'use strict';
(() => {
    const players = [...document.querySelectorAll('[data-web-tutorial]')];
    const visible = new Map();
    const playVisible = () => {
        const candidate = document.hidden ? null : [...visible.entries()]
            .filter(([, ratio]) => ratio >= 0.55)
            .sort((first, second) => second[1] - first[1])[0]?.[0];
        for (const player of players) {
            const video = player.querySelector('video');
            if (video !== candidate) video.pause();
        }
        if (candidate && candidate.paused && !candidate.ended) candidate.play().catch(() => {});
    };
    for (const player of players) {
        const video = player.querySelector('video');
        video.muted = true;
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
        playVisible();
    });
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) visible.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
            playVisible();
        }, {threshold: [0, 0.55, 0.75, 1]});
        for (const player of players) observer.observe(player.querySelector('video'));
    }
})();
