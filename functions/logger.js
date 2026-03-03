// functions/logger.js

export const Logger = {
    info: (msg, data = {}) => {
        const time = new Date().toLocaleTimeString('pt-BR');
        console.log(`%c[INFO | ${time}] ${msg}`, 'color: #4caf50; font-weight: bold;', data);
    },
    warn: (msg, data = {}) => {
        const time = new Date().toLocaleTimeString('pt-BR');
        console.warn(`%c[WARN | ${time}] ⚠️ ${msg}`, 'color: #ffb300; font-weight: bold;', data);
    },
    error: (msg, error = null) => {
        const time = new Date().toLocaleTimeString('pt-BR');
        console.error(`%c[ERROR | ${time}] 🔴 ${msg}`, 'color: #f44336; font-weight: bold;', error);
    }
};