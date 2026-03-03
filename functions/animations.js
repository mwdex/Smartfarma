window.SmartFarmaAnimations = (() => {
    
    const isLowPerformanceDevice = (() => {
        const memory = Number(navigator.deviceMemory || 0);
        const cores = Number(navigator.hardwareConcurrency || 0);
        const saveData = navigator.connection && navigator.connection.saveData === true;
        return saveData || (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2);
    })();

    const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ==========================================
    // 1. ANIMAÇÕES DE SCROLL (Original)
    // ==========================================
    const initScrollReveal = () => {
        const elements = document.querySelectorAll('[data-animate]');
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.15 };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const delay = el.getAttribute('data-delay') || 0;
                    setTimeout(() => el.classList.add('is-visible'), delay);
                    observer.unobserve(el);
                }
            });
        }, observerOptions);

        elements.forEach(el => observer.observe(el));
    };

    // ==========================================
    // 2. ANIMAÇÃO PREMIUM DE LOGIN (Cinematográfica)
    // ==========================================
    const playLoginExperience = (callback) => {
        if (isLowPerformanceDevice || prefersReducedMotion()) {
            if (typeof callback === 'function') callback();
            return;
        }

        // A. Cria os elementos no DOM dinamicamente
        const overlay = document.createElement('div');
        overlay.className = 'login-experience-overlay';
        
        const canvas = document.createElement('canvas');
        canvas.id = 'particle-canvas';
        
        const content = document.createElement('div');
        content.className = 'cinematic-content';
        
        // --- 1. A LOGO DA FARMÁCIA ---
        const logo = document.createElement('img');
        logo.src = 'pngs/logo.png'; // Caminho relativo (funciona local e no servidor)
        logo.className = 'cinematic-logo';
        logo.alt = 'Logo Smart Farma';

        // --- 2. O TÍTULO ---
        const title = document.createElement('h1');
        title.className = 'cinematic-title';
        title.innerHTML = 'SMART FARMA<span></span>';
        
        // --- 3. O SUBTÍTULO (Motor de Digitação JS) ---
        const subtitle = document.createElement('p');
        subtitle.className = 'cinematic-subtitle';
        subtitle.textContent = ''; // Começa vazio
        const textToType = 'a sua farmácia!';
        let typingInterval;

        // Monta a hierarquia na ordem correta
        content.appendChild(logo);
        content.appendChild(title);
        content.appendChild(subtitle);
        
        overlay.appendChild(canvas);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // B. Setup do Canvas para Física de Partículas
        const ctx = canvas.getContext('2d');
        let width, height, particles = [], animationFrameId;

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        // Classe de Física da Partícula
        class Particle {
            constructor() {
                this.x = width / 2;
                this.y = height / 2;
                
                // Explosão radial
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 15 + 2; 
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                
                this.size = Math.random() * 3 + 1;
                this.life = 1;
                this.decay = Math.random() * 0.02 + 0.01;
                
                // Paleta neon premium
                const colors = ['#42a5f5', '#90caf9', '#ffffff', '#1e88e5'];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }
            
            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.vx *= 0.92; // Desaceleração fluida
                this.vy *= 0.92;
                this.life -= this.decay;
            }
            
            draw() {
                ctx.globalAlpha = Math.max(0, this.life);
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const createExplosion = () => {
            // Reduzido de 150 para 40: Mantém o efeito premium, mas super leve
            const particleCount = window.innerWidth < 768 ? 20 : 40; 
            for (let i = 0; i < particleCount; i++) particles.push(new Particle());
        };

        const renderCanvas = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter'; 
            
            particles.forEach((p, index) => {
                p.update();
                p.draw();
                if (p.life <= 0) particles.splice(index, 1);
            });
            
            animationFrameId = requestAnimationFrame(renderCanvas);
        };

        // C. Parallax Sensorial
        const handleMouseMove = (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 40; 
            const y = (e.clientY / window.innerHeight - 0.5) * 40;
            content.style.transform = `translate(${x}px, ${y}px)`;
        };
        window.addEventListener('mousemove', handleMouseMove);

        // D. TIMELINE / DIREÇÃO DE ARTE
        
        // Passo 1: Fundo escurece e embaraça
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Passo 2: Explosão do feixe de luz
        setTimeout(() => {
            renderCanvas();
            createExplosion();
        }, 500);

        // Passo 3: Revela a Logo (surge do meio da luz)
        setTimeout(() => {
            logo.classList.add('reveal');
        }, 650);

        // Passo 4: Revela o Título em cascata
        setTimeout(() => {
            title.classList.add('reveal');
        }, 900);

        // Passo 5: Digitação milimétrica via JS
        setTimeout(() => {
            subtitle.classList.add('type');
            
            let charIndex = 0;
            typingInterval = setInterval(() => {
                subtitle.textContent = textToType.substring(0, charIndex + 1);
                charIndex++;
                
                if (charIndex >= textToType.length) {
                    clearInterval(typingInterval);
                }
            }, 70); 
            
        }, 1800);

        // Passo 6: Transição Perfeita e Cleanup (5 segundos no total)
        setTimeout(() => {
            
            // 1º: Executamos a troca de tela AQUI. A dashboard carrega escondida atrás da animação.
            if(typeof callback === 'function') callback();

            // 2º: Começamos a dissolver a animação, revelando a dashboard suavemente.
            overlay.classList.add('fade-out');
            
            // 3º: Aguarda 1 segundo (tempo do fade-out do CSS) para matar os processos e liberar memória.
            setTimeout(() => {
                cancelAnimationFrame(animationFrameId);
                clearInterval(typingInterval);
                window.removeEventListener('resize', resize);
                window.removeEventListener('mousemove', handleMouseMove);
                
                overlay.remove(); // Remove o overlay do DOM
            }, 1000); 
            
        }, 5000); // 5000ms = 5 segundos de carregamento imersivo
    };

    // ==========================================
    // 3. EXPORTAÇÃO
    // ==========================================
    return {
        init: () => { 
            initScrollReveal(); 
        },
        playLoginExperience 
    };
})();