// functions/toast.js

export const Toast = {
    init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    },

    show(message, type = 'info', duration = 3500) {
        this.init();
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Ícones simples para dar um ar mais bonito
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const iconEl = document.createElement('span');
        iconEl.style.fontSize = '1.2rem';
        iconEl.textContent = icons[type] || icons.info;

        const textEl = document.createElement('span');
        textEl.textContent = String(message ?? '');

        toast.appendChild(iconEl);
        toast.appendChild(textEl);
        container.appendChild(toast);

        // Remove automaticamente após o tempo definido
        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    },

    success(msg, duration) { this.show(msg, 'success', duration); },
    error(msg, duration) { this.show(msg, 'error', duration); },
    warning(msg, duration) { this.show(msg, 'warning', duration); },
    info(msg, duration) { this.show(msg, 'info', duration); }
};