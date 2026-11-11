const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('reveal');observer.unobserve(e.target)}})},{threshold:.12});document.querySelectorAll('.feature,.section-heading,.guide-layout,.closing,.benchmark-column').forEach(e=>observer.observe(e));

