/* ============================================
   Sophie & Joe - Tuscany Wedding 2027
   Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initCountdown();
    initFAQ();
    initGallery();
    initFormValidation();
    initBackToTop();
    initPageTransition();
    initDarkMode();
    initLoadingScreen();
});

/* ============================================
   Mobile Navigation
   ============================================ */
function initNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            navToggle.classList.toggle('active');
        });

        // Close menu when clicking a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', function() {
                navLinks.classList.remove('active');
                navToggle.classList.remove('active');
            });
        });
    }

    // Highlight active page in navigation
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

/* ============================================
   Countdown Timer
   ============================================ */
function initCountdown() {
    const countdownElement = document.querySelector('.countdown');
    if (!countdownElement) return;

    // Wedding date: May 24, 2027 (adjust as needed)
    const weddingDate = new Date('2027-05-24T15:00:00').getTime();

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = weddingDate - now;

        if (distance < 0) {
            countdownElement.innerHTML = '<p>We\'re married!</p>';
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const daysEl = document.getElementById('countdown-days');
        const hoursEl = document.getElementById('countdown-hours');
        const minutesEl = document.getElementById('countdown-minutes');
        const secondsEl = document.getElementById('countdown-seconds');

        if (daysEl) daysEl.textContent = days;
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
        if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
        if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

/* ============================================
   FAQ Accordion
   ============================================ */
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        if (question) {
            question.addEventListener('click', function() {
                // Close other items
                faqItems.forEach(other => {
                    if (other !== item) {
                        other.classList.remove('active');
                    }
                });

                // Toggle current item
                item.classList.toggle('active');
            });
        }
    });
}

/* ============================================
   Gallery Lightbox
   ============================================ */
function initGallery() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.querySelector('.lightbox-close');

    if (!lightbox || !lightboxImg) return;

    galleryItems.forEach(item => {
        item.addEventListener('click', function() {
            const img = this.querySelector('img');
            if (img) {
                lightboxImg.src = img.src;
                lightboxImg.alt = img.alt;
                lightbox.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    });

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Close with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
}

/* ============================================
   Form Validation & Handling
   ============================================ */
function initFormValidation() {
    const form = document.getElementById('rsvp-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        const attending = document.querySelector('input[name="attending"]:checked');

        if (!attending) {
            e.preventDefault();
            alert('Please let us know if you can attend.');
            return;
        }

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
        }
    });

    // Toggle guest count visibility based on attendance
    const attendingRadios = document.querySelectorAll('input[name="attending"]');
    const guestCountGroup = document.getElementById('guest-count-group');

    if (attendingRadios.length && guestCountGroup) {
        attendingRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'yes') {
                    guestCountGroup.style.display = 'block';
                } else {
                    guestCountGroup.style.display = 'none';
                }
            });
        });
    }
}

/* ============================================
   Smooth Scroll for Anchor Links
   ============================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

/* ============================================
   Back to Top Button
   ============================================ */
function initBackToTop() {
    // Create the button
    const backToTop = document.createElement('button');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = '&#8593;';
    backToTop.setAttribute('aria-label', 'Back to top');
    document.body.appendChild(backToTop);

    // Show/hide based on scroll position
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });

    // Scroll to top on click
    backToTop.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/* ============================================
   Page Transitions
   ============================================ */
function initPageTransition() {
    // Add transition class to body
    document.body.classList.add('page-transition');

    // Animate sections on scroll
    const sections = document.querySelectorAll('.section, .page-header');

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });

    // Make first section visible immediately
    const firstSection = document.querySelector('.hero, .page-header');
    if (firstSection) {
        firstSection.style.opacity = '1';
        firstSection.style.transform = 'translateY(0)';
    }
}

/* ============================================
   Dark Mode Toggle
   ============================================ */
function initDarkMode() {
    // Create toggle button
    const darkModeToggle = document.createElement('button');
    darkModeToggle.className = 'dark-mode-toggle';
    darkModeToggle.innerHTML = '&#127769;'; // Moon emoji
    darkModeToggle.setAttribute('aria-label', 'Toggle dark mode');
    document.body.appendChild(darkModeToggle);

    // Check for saved preference
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '&#9728;'; // Sun emoji
    }

    // Toggle on click
    darkModeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');

        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
            darkModeToggle.innerHTML = '&#9728;'; // Sun
        } else {
            localStorage.setItem('darkMode', 'disabled');
            darkModeToggle.innerHTML = '&#127769;'; // Moon
        }
    });
}

/* ============================================
   Confetti Effect
   ============================================ */
function triggerConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#C45C26', '#C9A961', '#5C6B4A', '#D4845C', '#E0C988', '#FF6B6B', '#4ECDC4'];
    const shapes = ['square', 'circle'];

    for (let i = 0; i < 150; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';

        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const size = Math.random() * 10 + 5;

        confetti.style.left = left + '%';
        confetti.style.backgroundColor = color;
        confetti.style.width = size + 'px';
        confetti.style.height = size + 'px';
        confetti.style.animationDelay = delay + 's';
        confetti.style.borderRadius = shape === 'circle' ? '50%' : '0';

        container.appendChild(confetti);
    }

    // Remove after animation
    setTimeout(() => {
        container.remove();
    }, 6000);
}

// Trigger confetti on RSVP form submission (if yes is selected)
const rsvpForm = document.getElementById('rsvp-form');
if (rsvpForm) {
    rsvpForm.addEventListener('submit', function(e) {
        const attending = document.querySelector('input[name="attending"]:checked');
        if (attending && attending.value === 'yes') {
            setTimeout(triggerConfetti, 100);
        }
    });
}

/* ============================================
   Loading Screen
   ============================================ */
function initLoadingScreen() {
    // Only show loading screen on first visit per session
    if (sessionStorage.getItem('loaded')) return;

    // Create loading screen
    const loadingScreen = document.createElement('div');
    loadingScreen.className = 'loading-screen';
    loadingScreen.innerHTML = `
        <div class="loading-logo">Sophie <span>&</span> Joe</div>
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading our love story...</div>
    `;
    document.body.prepend(loadingScreen);

    // Hide after content loads
    window.addEventListener('load', function() {
        setTimeout(function() {
            loadingScreen.classList.add('hidden');
            sessionStorage.setItem('loaded', 'true');

            // Remove from DOM after animation
            setTimeout(() => loadingScreen.remove(), 500);
        }, 800);
    });
}

/* ============================================
   Floating Hearts Animation (for Hero)
   ============================================ */
function initFloatingHearts() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    for (let i = 0; i < 5; i++) {
        const heart = document.createElement('div');
        heart.className = 'hero-floating floating-heart';
        heart.innerHTML = '&#10084;';
        hero.appendChild(heart);
    }
}

// Initialize floating hearts
document.addEventListener('DOMContentLoaded', initFloatingHearts);
