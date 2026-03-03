window.SmartFarmaInteractions = (() => {
    
    // ==========================================
    // 1. EFEITO TILT 3D AVANÇADO (GPU ACCELERATED)
    // ==========================================
    const initTiltEffect = () => {
        const tiltElements = document.querySelectorAll('.tilt-element, .glass-panel, .item-card');
        
        tiltElements.forEach(el => {
            let isHovering = false;
            let ticking = false; // Controle de Frame (Performance Lock)

            el.addEventListener('mousemove', (e) => {
                if (!isHovering) return;
                
                // Só calcula o próximo frame se o anterior já tiver terminado
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        const rect = el.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        
                        const xPct = (x / rect.width - 0.5) * 2;
                        const yPct = (y / rect.height - 0.5) * 2;
                        
                        // Tilt menor = menos distorção de pixels na GPU
                        const maxTilt = 4; 
                        const tiltX = yPct * -maxTilt; 
                        const tiltY = xPct * maxTilt;
                        
                        el.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`;
                        ticking = false;
                    });
                    ticking = true;
                }
            });

            el.addEventListener('mouseenter', () => { 
                isHovering = true;
                el.style.willChange = 'transform'; // Prepara a GPU
                el.style.transition = 'transform 0.1s ease-out'; 
            });

            el.addEventListener('mouseleave', () => {
                isHovering = false;
                window.requestAnimationFrame(() => {
                    el.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
                    el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)'; 
                    
                    // Liberta a memória da GPU após a animação
                    setTimeout(() => {
                        if(!isHovering) el.style.willChange = 'auto';
                    }, 500);
                });
            });
        });
    };

    // ==========================================
    // 2. RIPPLE INTELIGENTE (MICROINTERAÇÃO)
    // ==========================================
    const initRipple = () => {
        // Pega botões customizados também para garantir uniformidade
        const buttons = document.querySelectorAll('.ripple-trigger, .btn-primary, .btn-secondary, .btn-login-red');
        
        buttons.forEach(btn => {
            // Evita duplicação de eventos caso o DOM atualize
            btn.removeEventListener('click', createRipple);
            btn.addEventListener('click', createRipple);
        });
    };

    function createRipple(e) {
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        // Cobre todo o botão de forma fluida
        const size = Math.max(rect.width, rect.height) * 1.5; 
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x - size/2}px`;
        ripple.style.top = `${y - size/2}px`;
        
        // Uso da Web Animations API para controle cirúrgico da animação
        ripple.animate([
            { transform: 'scale(0)', opacity: 0.6 },
            { transform: 'scale(2.5)', opacity: 0 }
        ], {
            duration: 650,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        });

        button.appendChild(ripple);
        
        // Coleta de lixo limpa
        setTimeout(() => {
            if (ripple.parentNode) ripple.remove();
        }, 650);
    }

    // ==========================================
    // 3. TRANSIÇÃO DE TEMA (VIEW TRANSITIONS API)
    // ==========================================
    const initThemeToggle = () => {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Recupera o estado
        const currentTheme = localStorage.getItem('smartfarma_theme');
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-theme');
            btn.innerText = '☀️';
        }

        btn.addEventListener('click', (e) => {
            const performThemeSwitch = () => {
                document.body.classList.toggle('dark-theme');
                const isDark = document.body.classList.contains('dark-theme');
                localStorage.setItem('smartfarma_theme', isDark ? 'dark' : 'light');
                btn.innerText = isDark ? '☀️' : '🌙';
            };

            // Fallback imediato se não suportar View Transitions
            if (!document.startViewTransition || reduceMotion) {
                performThemeSwitch();
                return;
            }

            // Ponto de origem da animação (clique do mouse)
            const x = e.clientX;
            const y = e.clientY;
            
            // Raio máximo para cobrir a tela inteira
            const endRadius = Math.hypot(
                Math.max(x, innerWidth - x),
                Math.max(y, innerHeight - y)
            );

            const transition = document.startViewTransition(performThemeSwitch);

            // Animação expansiva elegante
            transition.ready.then(() => {
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${endRadius}px at ${x}px ${y}px)`
                        ],
                    },
                    {
                        duration: 800, // Tempo refinado para visualização
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        pseudoElement: '::view-transition-new(root)',
                    }
                );
            });
        });
    };

    // ==========================================
    // 4. MODO "HYPER VISION" (EASTER EGG / SHORTCUT)
    // ==========================================
    const initHyperVisionToggle = () => {
        // Permite ligar o Hyper Vision (Glow intenso) pressionando "Shift + H"
        window.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key.toLowerCase() === 'h') {
                document.body.classList.toggle('hyper-vision');
                
                // Feedback visual rápido
                const isHyper = document.body.classList.contains('hyper-vision');
                console.log(`%c[Smart Farma] Hyper Vision: ${isHyper ? 'ON' : 'OFF'}`, 'color: #42a5f5; font-weight: bold;');
            }
        });
    };

    return {
        init: () => {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            // Desativa Tilt no mobile para salvar bateria e focar em tap interactions
            if (!reduceMotion && window.matchMedia("(min-width: 768px)").matches) {
                initTiltEffect();
            }
            initRipple();
            initThemeToggle();
            initHyperVisionToggle();
        }
    };
})();