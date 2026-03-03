// functions/store.js

export const Store = {
    state: {
        currentUser: null,
        lojaAtualAdmin: null,
        idVendedorParaResetLocal: null,
        
        // Listeners do Tempo Real (para podermos desligá-los no logout)
        adminListeners: [],
        vendedorListeners: [],
        
        // Contexto dos Modais (guarda qual item está a ser editado)
        modal: {
            acaoAtual: null,
            sangriaId: null,
            boletoId: null,
            acessoId: null,
            resetReqId: null,
            resetTargetUser: null
        }
    },

    // Métodos para alterar o estado de forma segura
    setUser(user) {
        this.state.currentUser = user;
    },

    getUser() {
        return this.state.currentUser;
    },

    setLojaAdmin(lojaId) {
        this.state.lojaAtualAdmin = lojaId;
    },

    clearListeners() {
        this.state.adminListeners.forEach(unsub => unsub());
        this.state.adminListeners = [];
        
        this.state.vendedorListeners.forEach(unsub => unsub());
        this.state.vendedorListeners = [];
    },

    resetModalContext() {
        this.state.modal = {
            acaoAtual: null, sangriaId: null, boletoId: null,
            acessoId: null, resetReqId: null, resetTargetUser: null
        };
    }
};