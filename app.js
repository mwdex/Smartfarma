/**
 * app.js
 * Arquivo principal de inicialização da aplicação Smart Farma.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Inicializa a Engine de Animações Base
    if (window.SmartFarmaAnimations) {
        window.SmartFarmaAnimations.init();
    } else {
        console.warn("Aviso: Módulo SmartFarmaAnimations não carregado.");
    }
    
    // 2. Inicializa o "Cérebro" da Aplicação
    if (window.SmartFarmaLogic) {
        window.SmartFarmaLogic.init();
    } else {
        console.error("Erro Crítico: Módulo SmartFarmaLogic não encontrado. O sistema não funcionará.");
    }

    // 3. Inicializa as Microinterações
    if (window.SmartFarmaInteractions) {
        window.SmartFarmaInteractions.init();
    } else {
        console.warn("Aviso: Módulo SmartFarmaInteractions não carregado.");
    }
    

    // 4. Service Worker (modo offline)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.warn('Falha ao registar Service Worker:', err);
            });
        });
    }

    console.log("🚀 Smart Farma - Sistema de Gestão Inicializado com Sucesso.");
});