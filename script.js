// ========== ESTABLISH_UPLINK — PARTICLE NETWORK CANVAS ==========
(function () {
    const canvas = document.getElementById('uplink-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('start-overlay');
    let W, H, mouse = { x: 0, y: 0 };
    let animId = null;

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        mouse.x = W / 2;
        mouse.y = H / 2;
    }
    resize();
    window.addEventListener('resize', resize);

    // Soft mouse tracking (only inside the overlay)
    overlay.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

    // ── NODE CLASS ──────────────────────────────────────────────
    const NODE_COUNT  = 80;
    const LINK_DIST   = 155;
    const GREEN       = '0,255,65';

    class Node {
        constructor() { this.init(); }
        init() {
            this.x  = Math.random() * W;
            this.y  = Math.random() * H;
            this.vx = (Math.random() - 0.5) * 0.45;
            this.vy = (Math.random() - 0.5) * 0.45;
            this.r  = Math.random() * 1.8 + 0.6;
            this.phase = Math.random() * Math.PI * 2;
            this.active = Math.random() < 0.18;   // brighter "hub" nodes
        }

        update() {
            // Gentle mouse repulsion
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d < 130) {
                const force = (130 - d) / 130 * 0.06;
                this.vx += (dx / d) * force;
                this.vy += (dy / d) * force;
            }

            // Speed clamp
            const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (spd > 0.9) { this.vx = (this.vx / spd) * 0.9; this.vy = (this.vy / spd) * 0.9; }

            this.x += this.vx;
            this.y += this.vy;
            this.phase += 0.012;

            // Wrap at edges (seamless)
            if (this.x < -10) this.x = W + 10;
            if (this.x > W + 10) this.x = -10;
            if (this.y < -10) this.y = H + 10;
            if (this.y > H + 10) this.y = -10;
        }

        draw() {
            const pulse = 0.5 + Math.sin(this.phase) * 0.35;
            if (this.active) {
                // outer glow ring
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${GREEN},${0.07 * pulse})`;
                ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${GREEN},${this.active ? 0.85 * pulse : 0.4 * pulse})`;
            ctx.fill();
        }
    }

    // ── PULSE CLASS (data packet travelling along a link) ────────
    class Pulse {
        constructor(a, b) {
            this.a = a; this.b = b; this.t = 0;
            this.speed = 0.012 + Math.random() * 0.012;
        }
        update() { this.t += this.speed; return this.t < 1; }
        draw() {
            const x = this.a.x + (this.b.x - this.a.x) * this.t;
            const y = this.a.y + (this.b.y - this.a.y) * this.t;
            ctx.beginPath();
            ctx.arc(x, y, 2.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${GREEN},0.95)`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = `rgba(${GREEN},0.8)`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    const nodes  = Array.from({ length: NODE_COUNT }, () => new Node());
    let   pulses = [];
    let   frame  = 0;

    // ── MAIN LOOP ────────────────────────────────────────────────
    function draw() {
        if (overlay.classList.contains('hidden')) return; // stop when overlay closes

        // Deep semi-transparent clear for trailing glow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, W, H);

        frame++;

        // Spawn a new pulse every ~50 frames
        if (frame % 50 === 0) {
            const i = Math.floor(Math.random() * nodes.length);
            const j = Math.floor(Math.random() * nodes.length);
            if (i !== j) pulses.push(new Pulse(nodes[i], nodes[j]));
        }

        // Draw links
        ctx.lineWidth = 0.6;
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].update();
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d  = Math.sqrt(dx * dx + dy * dy);
                if (d < LINK_DIST) {
                    const alpha = (1 - d / LINK_DIST) * 0.22;
                    ctx.strokeStyle = `rgba(${GREEN},${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        nodes.forEach(n => n.draw());

        // Draw & prune pulses
        pulses = pulses.filter(p => { const alive = p.update(); if (alive) p.draw(); return alive; });

        animId = requestAnimationFrame(draw);
    }

    draw();

    // ── UPTIME COUNTER ───────────────────────────────────────────
    let seconds = 0;
    const uptimeEl = document.querySelector('.uplink-status-bar span:last-child');
    const tick = setInterval(() => {
        seconds++;
        const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        if (uptimeEl) uptimeEl.textContent = `UPTIME: ${h}:${m}:${s}`;
        if (overlay.classList.contains('hidden')) clearInterval(tick);
    }, 1000);
})();


// ========== SOUND EFFECTS ==========
// Using low-volume synthesized sounds using Web Audio API to avoid CORS/loading issues for standalone file execution
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function createOscillator(freq, type, duration, vol) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const playTypingSound = () => createOscillator(800, 'square', 0.05, 0.05);
const playAccessGranted = () => {
    createOscillator(440, 'sine', 0.5, 0.1);
    setTimeout(() => createOscillator(880, 'sine', 1.0, 0.1), 200);

    // AI Voice Synthesis for "Access Granted"
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance("Access Granted. Welcome, Target Secure.");
        msg.pitch = 0.4;  // Deep robotic pitch
        msg.rate = 1.1;
        const voices = window.speechSynthesis.getVoices();
        const engVoice = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en'));
        if (engVoice) msg.voice = engVoice;
        window.speechSynthesis.speak(msg);
    }
};
const playHoverSound = () => createOscillator(300, 'triangle', 0.1, 0.05);
const playBlastSound = () => createOscillator(100, 'sawtooth', 0.3, 0.2);


// ========== MATRIX RAIN BACKGROUND ==========
const canvas = document.getElementById("matrix-canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
const matrix = letters.split("");

const fontSize = 16;
const columns = canvas.width / fontSize;
const drops = [];
for (let x = 0; x < columns; x++) drops[x] = 1;

function drawMatrix() {
    ctx.fillStyle = "rgba(5, 5, 5, 0.05)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff41";
    ctx.font = fontSize + "px 'Share Tech Mono'";

    for (let i = 0; i < drops.length; i++) {
        const text = matrix[Math.floor(Math.random() * matrix.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }
        drops[i]++;
    }
}
setInterval(drawMatrix, 50);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});


// ========== INTRO SCREEN LOGIC ==========
const introMessages = [
    "Booting Secure System...",
    "Initializing Firewall...",
    "Bypassing Security Protocols...",
    "Loading User Profile...",
    "User: SasiKumar S",
    "Verifying Credentials...",
];
const terminalContent = document.getElementById("terminal-content");
const introScreen = document.getElementById("intro-screen");
const mainContent = document.getElementById("main-content");
const accessGrantedScreen = document.getElementById("access-granted-screen");
const introTerminal = document.getElementById("intro-terminal");

let msgIndex = 0;
let charIntroIndex = 0;

function typeIntro() {
    if (msgIndex < introMessages.length) {
        if (charIntroIndex === 0) {
            let p = document.createElement("p");
            p.style.marginBottom = "8px";
            p.innerHTML = `<span style="color: var(--neon-red);">root@sasi:~#</span> <span class="typing-text" style="color: var(--neon-green);"></span><span class="intro-cursor" style="animation: blink 1s infinite;">|</span>`;
            terminalContent.appendChild(p);
        }

        const currentMsg = introMessages[msgIndex];
        const textSpan = terminalContent.lastElementChild.querySelector('.typing-text');

        if (charIntroIndex < currentMsg.length) {
            textSpan.textContent += currentMsg.charAt(charIntroIndex);
            if (charIntroIndex % 3 === 0) playTypingSound();
            charIntroIndex++;
            setTimeout(typeIntro, 20 + Math.random() * 40);
        } else {
            const cursor = terminalContent.lastElementChild.querySelector('.intro-cursor');
            if (cursor) cursor.remove();
            msgIndex++;
            charIntroIndex = 0;
            setTimeout(typeIntro, 400 + Math.random() * 300);
        }
    } else {
        setTimeout(() => {
            if (introTerminal) introTerminal.classList.add("terminal-disappear");
            const securityBg = document.getElementById("intro-security-bg");
            if (securityBg) securityBg.classList.add("bg-fade-out");

            // Update Navbar Stats on access
            const navStatus = document.querySelector('.nav-system-stats .neon-green');
            if (navStatus) {
                navStatus.textContent = "ONLINE";
                navStatus.style.color = "var(--neon-green)";
                navStatus.style.textShadow = "0 0 10px var(--neon-green)";
            }

            // Dramatic cinematic pause before granting access screen zooms in
            setTimeout(() => {
                accessGrantedScreen.classList.remove("hidden");
                accessGrantedScreen.classList.add("active");
                playAccessGranted();

                setTimeout(() => {
                    introScreen.classList.add("hidden");
                    mainContent.classList.remove("hidden");
                    startHomeTyping();
                    startNavPing(); // Start the live ping update
                    startNavLogFeed(); // Start the live log marquee updates
                }, 3500); 
            }, 600);
        }, 400);
    }
}

// Live Navbar Ping Update
function startNavPing() {
    const pingElement = document.getElementById('nav-ping');
    if (!pingElement) return;
    
    setInterval(() => {
        const ping = Math.floor(Math.random() * 20) + 15;
        pingElement.textContent = ping + 'ms';
    }, 3000);
}

// Live Navbar Log Feed Generator
function startNavLogFeed() {
    const logMarquee = document.getElementById('nav-log-marquee');
    if (!logMarquee) return;

    const logSnippets = [
        "INITIALIZING_SECURE_LINK...",
        "0x7F000001_PACKET_RECV...",
        "ENCRYPTING_SESSION_STREAM...",
        "TERMINAL_SASIKUMAR_ACTIVE...",
        "BYPASS_FIREWALL_v4.2...",
        "INJECTING_PAYLOAD_0xA9...",
        "DATA_STREAM_ESTABLISHED...",
        "MONITOR_NODE_24...",
        "UPGRADING_ACCESS_LEVEL...",
        "UPLINK_STABLE_99.9%..."
    ];

    setInterval(() => {
        // Randomly rearrange snippets and add a random hex string
        const shuffled = [...logSnippets].sort(() => 0.5 - Math.random());
        const hex = "0x" + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase();
        logMarquee.textContent = shuffled.slice(0, 5).join(" | ") + " | ID:" + hex;
    }, 10000); // Update log string every 10 seconds for variety
}

// Require user interaction to bypass modern browser Audio Autoplay blocks
const startOverlay = document.getElementById("start-overlay");
const btnStart = document.getElementById("btn-start");

btnStart.addEventListener('click', () => {
    // Resume audio context inside a trusted user click event
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // Trigger opening lock and success button state
    const lock = document.querySelector('.uplink-lock');
    if (lock) lock.classList.add('unlocked');
    btnStart.textContent = "[ ACCESS_GRANTED ]";
    btnStart.classList.add('granted');

    // Play a dual-tone boot success sound
    createOscillator(600, 'sine', 0.15, 0.1);
    setTimeout(() => createOscillator(900, 'sine', 0.3, 0.1), 150);

    // Delay the intro sequence to let the lock opening animation finish
    setTimeout(() => {
        startOverlay.classList.add("hidden");
        // Start intro sequence after a brief pause
        setTimeout(typeIntro, 500);
    }, 1100);
});

// ========== HOME TYPING EFFECT ==========
const homeRoles = [
    "Cybersecurity Enthusiast",
    "Passionate Programmer",
    "Future Ethical Hacker",
    "Building Secure Digital Systems"
];
let roleIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typingElement = document.getElementById("typing-loop");

function startHomeTyping() {
    const currentRole = homeRoles[roleIndex];
    if (isDeleting) {
        typingElement.textContent = currentRole.substring(0, charIndex - 1);
        charIndex--;
    } else {
        typingElement.textContent = currentRole.substring(0, charIndex + 1);
        charIndex++;
    }

    if (!isDeleting && charIndex === currentRole.length) {
        isDeleting = true;
        setTimeout(startHomeTyping, 2000); // Pause at end
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % homeRoles.length;
        setTimeout(startHomeTyping, 500); // Pause before new word
    } else {
        setTimeout(startHomeTyping, isDeleting ? 50 : 100);
    }
}

// ========== INTERACTIVE EFFECTS ==========
// Click Blast Animation
document.addEventListener('click', (e) => {
    if (!introScreen.classList.contains('hidden')) return;

    // Pick a random RGB-style Neon color
    const colors = [
        '#00ff41', // Green
        '#ff0033', // Red
        '#00d2ff', // Blue
        '#0ff',    // Cyan
        '#bc13fe', // Magenta
        '#f3fb1d'  // Yellow
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Shockwave Ring
    const ring = document.createElement('div');
    ring.className = 'click-shockwave';
    ring.style.left = e.clientX + 'px';
    ring.style.top = e.clientY + 'px';
    ring.style.setProperty('--blast-color', randomColor);
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 600);

    // Particles
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'click-particle';
        particle.style.left = e.clientX + 'px';
        particle.style.top = e.clientY + 'px';
        particle.style.setProperty('--blast-color', randomColor);

        // Calculate random explosion traits
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = 50 + Math.random() * 50;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;

        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);

        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
    }
});

// Unique Piano Sound on skill hover
const pianoNotes = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    349.23, // F4
    392.00, // G4
    440.00, // A4
    493.88, // B4
    523.25, // C5
    587.33  // D5
];

function playPianoNote(freq) {
    if (audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine'; // Sine with fast attack and long decay simulates a digital piano perfectly
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.02); // Fast hammer attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0); // Exponential resonating string decay

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.0);
}

const skillCards = document.querySelectorAll('.skill-card');
skillCards.forEach((card, index) => {
    card.addEventListener('mouseenter', () => {
        const note = pianoNotes[index % pianoNotes.length];
        playPianoNote(note);
    });
});

// Mobile menu toggle
const mobileMenuBtn = document.getElementById('mobile-menu');
const navLinksList = document.querySelector('.nav-links');

mobileMenuBtn.addEventListener('click', () => {
    navLinksList.classList.toggle('active');
    mobileMenuBtn.classList.toggle('open');
});

// Close mobile menu when a nav link is clicked
navLinksList.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinksList.classList.remove('active');
        mobileMenuBtn.classList.remove('open');
    });
});

// Fake Contact Form
document.getElementById('contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('contact-form').style.display = 'none';
    document.getElementById('form-success').classList.remove('hidden');
    // playAccessGranted(); // Removed per user request
});

// ========== SCROLL ANIMATIONS ==========
const sections = document.querySelectorAll('.section');
sections.forEach(sec => sec.classList.add('hidden-section'));

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('show-section');
            entry.target.classList.remove('hidden-section');
        } else {
            entry.target.classList.remove('show-section');
            entry.target.classList.add('hidden-section');
        }
    });
}, { threshold: 0.15 });

sections.forEach(sec => sectionObserver.observe(sec));

// Observe individual massive project cards so they don't play animations invisibly off-screen
const projectCards = document.querySelectorAll('.project-card');
projectCards.forEach(card => {
    card.classList.add('hidden-section');
    sectionObserver.observe(card);
});

// ========== NAVBAR ACTIVE STATE ==========
const navLinks = document.querySelectorAll('.nav-links li a');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= (sectionTop - sectionHeight / 3)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(current)) {
            link.classList.add('active');
        }
    });

    // Chameleon HUD Color Switching
    const navbar = document.getElementById('navbar');
    const redSections = ['about', 'projects', 'contact'];
    if (redSections.includes(current)) {
        navbar.classList.add('nav-accent-red');
    } else {
        navbar.classList.remove('nav-accent-red');
    }
});

// HUD Mouse spotlight tracker
document.getElementById('navbar').addEventListener('mousemove', (e) => {
    const nav = e.currentTarget;
    const rect = nav.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    nav.style.setProperty('--mouse-x', `${x}%`);
    nav.style.setProperty('--mouse-y', `${y}%`);
});


