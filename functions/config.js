// functions/config.js

export const CONFIG = {
    COLLECTIONS: {
        USERS: 'users',
        SANGRIAS: 'sangrias',
        BOLETOS: 'boletos',
        LOJAS: 'lojas',
        SOLICITACOES: 'solicitacoes'
    },
    STATUS: {
        PENDENTE: 'pendente', // Enviado pelo admin, aguardando loja conferir
        CONFIRMADO: 'confirmado', // Loja conferiu e aceitou, aguardando pagamento
        APROVADO: 'aprovado',
        RECUSADO: 'recusado',
        MODIFICADO: 'modificado',
        PAGO: 'pago' // Loja efetuou o pagamento
    },
    ROLES: {
        ADMIN: 'admin',
        VENDEDOR: 'vendedor'
    },
    REQ_TYPES: {
        RECUPERACAO: 'recuperacao',
        CADASTRO: 'cadastro'
    }
};