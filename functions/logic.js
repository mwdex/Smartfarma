// functions/logic.js

import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Store } from './store.js';
import { Toast } from './toast.js';
import { Security } from './security.js';

const SmartFarmaLogic = (() => {
    
    // ==========================================
    // 🧠 CACHE LOCAL
    // ==========================================
    let dbCache = {
        sangrias: [],
        lojas: [],
        users: [],
        boletos: [],
        solicitacoes: []
    };

    const getFB = () => ({ db: window.FirebaseDB, ...window.FirebaseModules });

    const escapeHtml = (value = '') => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const escapeJsString = (value = '') => String(value)
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('\n', ' ')
        .replaceAll('\r', ' ');

    const safeStatusClass = (value = '') => String(value).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');

    const sanitizeUsername = (value = '') => String(value).trim().replace(/\s+/g, '');

    const hasStrongEnoughPassword = (value = '') => String(value).trim().length >= 6;

    const LOGIN_THROTTLE_KEY = 'sf_login_throttle';
    const getLoginThrottleState = () => {
        try {
            const parsed = JSON.parse(localStorage.getItem(LOGIN_THROTTLE_KEY) || '{}');
            return {
                fails: Number(parsed.fails) || 0,
                blockedUntil: Number(parsed.blockedUntil) || 0
            };
        } catch {
            return { fails: 0, blockedUntil: 0 };
        }
    };

    const registerFailedLogin = () => {
        const now = Date.now();
        const state = getLoginThrottleState();
        const fails = state.fails + 1;
        const blockedUntil = fails >= 5 ? (now + 30_000) : 0;
        localStorage.setItem(LOGIN_THROTTLE_KEY, JSON.stringify({ fails: blockedUntil ? 0 : fails, blockedUntil }));
    };

    const clearFailedLogins = () => localStorage.removeItem(LOGIN_THROTTLE_KEY);

    const waitForFirebase = (callback, attempts = 0) => {
        if (window.FirebaseDB && window.FirebaseModules) {
            callback();
            return;
        }
        if (attempts >= 80) {
            Logger.error('Timeout ao ligar ao Firebase.');
            Toast.error('Não foi possível ligar ao Firebase. Atualize a página.');
            return;
        }
        if (attempts % 10 === 0) Logger.info('A aguardar ligação à Nuvem do Firebase...');
        setTimeout(() => waitForFirebase(callback, attempts + 1), 150);
    };

    const initDB = async () => {
        try {
            const { db, collection, getDocs, setDoc, doc } = getFB();
            Logger.info("Ligado à Nuvem do Firebase com sucesso!");
            
            localStorage.removeItem('sf_data_users'); 
            
            const usersSnap = await getDocs(collection(db, CONFIG.COLLECTIONS.USERS));
            const adminMasterExiste = usersSnap.docs.some(u => u.id === 'admin_master');
            if (!adminMasterExiste) {
                const hashedMasterPass = await Security.hashPassword('123');
                await setDoc(doc(db, CONFIG.COLLECTIONS.USERS, 'admin_master'), {
                    nome: 'Admin Master',
                    usuario: 'admin',
                    senha: hashedMasterPass,
                    tipo: CONFIG.ROLES.ADMIN,
                    isMaster: true,
                    loja_id: null
                });
                Logger.warn('Utilizador admin_master criado com a senha temporária padrão. Altere-a imediatamente.');
            }

            const lojasSnap = await getDocs(collection(db, CONFIG.COLLECTIONS.LOJAS));
            if (lojasSnap.empty || lojasSnap.size < 3) {
                Logger.info("A injetar as Lojas Oficiais...");
                await setDoc(doc(db, CONFIG.COLLECTIONS.LOJAS, "roteiro"), { nome: 'ROTEIRO' });
                await setDoc(doc(db, CONFIG.COLLECTIONS.LOJAS, "ipiranga"), { nome: 'IPIRANGA' });
                await setDoc(doc(db, CONFIG.COLLECTIONS.LOJAS, "sao_sebastiao"), { nome: 'SAO SEBASTIAO' });
            }
        } catch (error) {
            Logger.error("Erro Crítico no Firebase:", error);
            Toast.error("Erro ao conectar à base de dados.");
        }
    };

    const animateValue = (obj, start, end, duration, isCurrency = true) => {
        if (!obj) return;
        if (obj.animFrame) cancelAnimationFrame(obj.animFrame);

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 4);
            const currentVal = easeOut * (end - start) + start;
            obj.innerHTML = isCurrency ? currentVal.toFixed(2) : Math.floor(currentVal);
            if (progress < 1) {
                obj.animFrame = window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = isCurrency ? end.toFixed(2) : end;
            }
        };
        obj.animFrame = window.requestAnimationFrame(step);
    };

    const applyStaggerEffect = (selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.animation = `fadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.08}s forwards`;
        });
    };

    const navigateTo = (viewId) => {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
        document.getElementById(viewId).classList.add('active');

        const nav = document.getElementById('mainNav');
        if (viewId === 'view-login') {
            nav.classList.add('hidden');
        } else {
            nav.classList.remove('hidden');
            document.getElementById('navUserName').innerText = Store.getUser().nome;
            
            if (viewId === 'view-admin') {
                setTimeout(() => applyStaggerEffect('#view-admin .glass-panel, #view-admin .stat-mini'), 50);
                const tools = document.getElementById('adminOnlyTools');
                if (tools) tools.style.display = Store.getUser().isMaster ? 'block' : 'none';
            } else if (viewId === 'view-vendedor') {
                setTimeout(() => applyStaggerEffect('#view-vendedor .glass-panel, #view-vendedor .stat-card'), 50);
            }
        }
    };

    const abrirModalNovoUsuario = () => {
        let html = '';
        dbCache.lojas.forEach(l => html += `<option value="${l.id}">${l.nome}</option>`);
        document.getElementById('admNewLoja').innerHTML = html;
        document.getElementById('novoUsuarioModal').classList.remove('hidden');
    };

    const fecharModalNovoUsuario = () => {
        document.getElementById('novoUsuarioModal').classList.add('hidden');
    };

    const toggleLojaSelection = () => {
        const tipo = document.getElementById('admNewTipo').value;
        const group = document.getElementById('groupSelectLojaNovo');
        group.style.display = (tipo === CONFIG.ROLES.ADMIN) ? 'none' : 'block';
    };

    const salvarNovoUsuario = async () => {
        const { db, collection, addDoc, getDocs, query, where } = getFB();
        
        const nome = document.getElementById('admNewNome').value.trim();
        const user = sanitizeUsername(document.getElementById('admNewUser').value);
        const pass = document.getElementById('admNewPass').value.trim();
        const tipo = document.getElementById('admNewTipo').value;
        const lojaId = (tipo === CONFIG.ROLES.VENDEDOR) ? document.getElementById('admNewLoja').value : null;

        if(!nome || !user || !pass) {
            return Toast.warning("Preencha todos os campos obrigatórios.");
        }

        if (!hasStrongEnoughPassword(pass)) {
            return Toast.warning('A senha deve ter no mínimo 6 caracteres.');
        }

        const qUsers = query(collection(db, CONFIG.COLLECTIONS.USERS), where("usuario", "==", user));
        const usersSnap = await getDocs(qUsers);
        
        if (!usersSnap.empty) {
            return Toast.error(`O utilizador "${user}" já está registado.`);
        }

        const hashedPass = await Security.hashPassword(pass);

        await addDoc(collection(db, CONFIG.COLLECTIONS.USERS), {
            nome, usuario: user, senha: hashedPass, tipo, isMaster: false, loja_id: lojaId
        });

        Toast.success(`Acesso criado para ${nome}!`);
        
        document.getElementById('admNewNome').value = '';
        document.getElementById('admNewUser').value = '';
        document.getElementById('admNewPass').value = '';
        fecharModalNovoUsuario();
    };

    const atualizarStatusVendedor = async (userId) => {
        const { db, doc, updateDoc } = getFB();
        await updateDoc(doc(db, CONFIG.COLLECTIONS.USERS, userId), {
            lastSeen: new Date().toLocaleString('pt-BR'),
            isOnline: true
        });
    };

    const logoutVendedor = async (userId) => {
        if (!userId) return;
        const { db, doc, updateDoc } = getFB();
        await updateDoc(doc(db, CONFIG.COLLECTIONS.USERS, userId), {
            isOnline: false,
            lastSeen: new Date().toLocaleString('pt-BR')
        });
    };

    const excluirSolicitacao = async (id) => {
        try {
            const { db, doc, deleteDoc } = getFB();
            await deleteDoc(doc(db, CONFIG.COLLECTIONS.SOLICITACOES, id));
            Toast.success("Registo apagado.");
        } catch (error) { 
            Logger.error("Erro ao excluir solicitação", error); 
            Toast.error("Erro ao tentar apagar.");
        }
    };

    const excluirVendedor = async (userId) => {
        if (!window.confirm("Tem a certeza que deseja excluir este vendedor?")) return;
        try {
            const { db, doc, deleteDoc } = getFB();
            await deleteDoc(doc(db, CONFIG.COLLECTIONS.USERS, userId));
            Toast.success("Vendedor excluído com sucesso.");
        } catch (error) { 
            Logger.error("Erro ao excluir vendedor", error);
            Toast.error("Não foi possível excluir o vendedor.");
        }
    };

    const initLoginView = () => {
        const formLogin = document.getElementById('formLogin');
        const feedbackLogin = document.getElementById('loginFeedback');
        
        document.getElementById('linkSolicitarAcesso').addEventListener('click', async (e) => {
            e.preventDefault();
            const { db, collection, getDocs } = getFB();
            
            const lojasSnap = await getDocs(collection(db, CONFIG.COLLECTIONS.LOJAS));
            let lojasHtml = '<option value="" disabled selected>-- Escolha a sua Loja --</option>';
            lojasSnap.forEach(doc => { lojasHtml += `<option value="${doc.id}">${doc.data().nome}</option>`; });
            document.getElementById('regLoja').innerHTML = lojasHtml;

            document.getElementById('loginFormContainer').classList.add('hidden');
            document.getElementById('registerFormContainer').classList.remove('hidden');
            document.getElementById('registerFormContainer').style.animation = 'fadeIn 0.4s ease forwards';
        });

        document.getElementById('btnVoltarLogin').addEventListener('click', () => {
            document.getElementById('registerFormContainer').classList.add('hidden');
            document.getElementById('loginFormContainer').classList.remove('hidden');
            document.getElementById('loginFormContainer').style.animation = 'fadeIn 0.4s ease forwards';
        });

        document.getElementById('linkEsqueceuSenha').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginFormContainer').classList.add('hidden');
            document.getElementById('forgotFormContainer').classList.remove('hidden');
            document.getElementById('forgotFormContainer').style.animation = 'fadeIn 0.4s ease forwards';
        });

        document.getElementById('btnVoltarForgot').addEventListener('click', () => {
            document.getElementById('forgotFormContainer').classList.add('hidden');
            document.getElementById('loginFormContainer').classList.remove('hidden');
            document.getElementById('loginFormContainer').style.animation = 'fadeIn 0.4s ease forwards';
            
            document.getElementById('formAdminAuthReset').reset();
            document.getElementById('formNewPassLocal').reset();
            document.getElementById('formNewPassLocal').classList.add('hidden');
            document.getElementById('formAdminAuthReset').classList.remove('hidden');
            document.getElementById('forgotFeedback1').innerText = '';
            document.getElementById('forgotFeedback2').innerText = '';
            Store.state.idVendedorParaResetLocal = null;
        });

        document.getElementById('formAdminAuthReset').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { db, collection, getDocs, query, where } = getFB();

            const btn = document.querySelector('#formAdminAuthReset button[type="submit"]');
            const txtOriginal = btn.innerText;
            btn.innerText = "A validar..."; btn.disabled = true;

            const targetUser = sanitizeUsername(document.getElementById('resetTargetUser').value);
            const adminUser = sanitizeUsername(document.getElementById('resetAdminUser').value);
            const adminPass = document.getElementById('resetAdminPass').value.trim();

            try {
                const hashedAdminPass = await Security.hashPassword(adminPass);

                const qAdmin = query(collection(db, CONFIG.COLLECTIONS.USERS), where("usuario", "==", adminUser), where("senha", "==", hashedAdminPass), where("tipo", "==", CONFIG.ROLES.ADMIN));
                const adminSnap = await getDocs(qAdmin);

                if (adminSnap.empty) {
                    Toast.error("Credenciais do Administrador inválidas!");
                    btn.innerText = txtOriginal; btn.disabled = false;
                    return;
                }

                const qVend = query(collection(db, CONFIG.COLLECTIONS.USERS), where("usuario", "==", targetUser), where("tipo", "==", CONFIG.ROLES.VENDEDOR));
                const vendSnap = await getDocs(qVend);

                if (vendSnap.empty) {
                    Toast.error("Vendedor não encontrado no sistema.");
                    btn.innerText = txtOriginal; btn.disabled = false;
                    return;
                }

                Store.state.idVendedorParaResetLocal = vendSnap.docs[0].id;
                document.getElementById('resetAdminPass').value = '';
                document.getElementById('resetAdminUser').value = '';

                document.getElementById('formAdminAuthReset').classList.add('hidden');
                document.getElementById('formNewPassLocal').classList.remove('hidden');
                Toast.success("Desbloqueado! O vendedor já pode criar a nova senha.");

            } catch (error) {
                Logger.error("Erro validação Admin", error);
                Toast.error("Erro ao processar validação.");
            }

            btn.innerText = txtOriginal; btn.disabled = false;
        });

        document.getElementById('formNewPassLocal').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { db, doc, updateDoc } = getFB();

            const btn = document.querySelector('#formNewPassLocal button[type="submit"]');
            btn.innerText = "A guardar..."; btn.disabled = true;

            const novaSenha = document.getElementById('resetNewPassValue').value.trim();

            try {
                if (Store.state.idVendedorParaResetLocal) {
                    const hashedNewPass = await Security.hashPassword(novaSenha);

                    await updateDoc(doc(db, CONFIG.COLLECTIONS.USERS, Store.state.idVendedorParaResetLocal), { senha: hashedNewPass });
                    
                    Toast.success("Palavra-passe atualizada com sucesso!");

                    setTimeout(() => {
                        document.getElementById('btnVoltarForgot').click();
                        btn.innerText = "SALVAR NOVA SENHA"; btn.disabled = false;
                    }, 2000);
                } else {
                    throw new Error("Sessão expirou.");
                }
            } catch (err) {
                Logger.error("Erro a atualizar senha", err);
                Toast.error('Erro ao salvar. Tente novamente.');
                btn.innerText = "SALVAR NOVA SENHA"; btn.disabled = false;
            }
        });

        document.getElementById('formRegister').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { db, collection, getDocs, query, where, addDoc } = getFB();
            
            const btnSubmit = document.querySelector('#formRegister button[type="submit"]');
            btnSubmit.innerText = 'A enviar...'; btnSubmit.disabled = true;

            const nome = document.getElementById('regNome').value.trim();
            const user = sanitizeUsername(document.getElementById('regUser').value);
            const lojaSelecionada = document.getElementById('regLoja').value; 
            const pass = document.getElementById('regPass').value;

            if (!nome || !user || !lojaSelecionada || !pass) {
                Toast.warning('Preencha todos os campos obrigatórios.');
                btnSubmit.innerText = 'ENVIAR SOLICITAÇÃO'; btnSubmit.disabled = false;
                return;
            }

            if (!hasStrongEnoughPassword(pass)) {
                Toast.warning('A senha deve ter no mínimo 6 caracteres.');
                btnSubmit.innerText = 'ENVIAR SOLICITAÇÃO'; btnSubmit.disabled = false;
                return;
            }

            const qUsers = query(collection(db, CONFIG.COLLECTIONS.USERS), where("usuario", "==", user));
            const qReq = query(collection(db, CONFIG.COLLECTIONS.SOLICITACOES), where("usuario", "==", user));
            
            const [usersSnap, reqSnap] = await Promise.all([getDocs(qUsers), getDocs(qReq)]);

            if (!usersSnap.empty || !reqSnap.empty) {
                Toast.error("Erro: Este utilizador já existe ou está em análise.");
                btnSubmit.innerText = 'ENVIAR SOLICITAÇÃO'; btnSubmit.disabled = false;
                return;
            }

            const hashedPass = await Security.hashPassword(pass);

            await addDoc(collection(db, CONFIG.COLLECTIONS.SOLICITACOES), {
                tipo: CONFIG.REQ_TYPES.CADASTRO,
                nome, usuario: user, senha: hashedPass, loja_id: lojaSelecionada, data: new Date().toLocaleString('pt-BR')
            });

            Toast.success("Enviado! O escritório analisará o pedido.");
            document.getElementById('formRegister').reset();
            
            setTimeout(() => {
                document.getElementById('btnVoltarLogin').click();
                btnSubmit.innerText = 'ENVIAR SOLICITAÇÃO'; btnSubmit.disabled = false;
            }, 3000);
        });

        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { db, collection, getDocs, query, where } = getFB();
            
            const btnSubmit = formLogin.querySelector('button[type="submit"]');
            const textoOriginal = btnSubmit.innerText;
            btnSubmit.innerText = 'A validar...'; btnSubmit.style.opacity = '0.7'; btnSubmit.disabled = true;

            const user = sanitizeUsername(document.getElementById('loginUser').value);
            const pass = document.getElementById('loginPass').value;

            const throttleState = getLoginThrottleState();
            if (throttleState.blockedUntil > Date.now()) {
                const segundos = Math.ceil((throttleState.blockedUntil - Date.now()) / 1000);
                Toast.warning(`Muitas tentativas. Aguarde ${segundos}s para tentar novamente.`);
                btnSubmit.innerText = textoOriginal; btnSubmit.style.opacity = '1'; btnSubmit.disabled = false;
                return;
            }

            if (!user || !pass) {
                Toast.warning('Informe usuário e senha.');
                btnSubmit.innerText = textoOriginal; btnSubmit.style.opacity = '1'; btnSubmit.disabled = false;
                return;
            }

            try {
                const hashedPass = await Security.hashPassword(pass);
                
                const qUsers = query(collection(db, CONFIG.COLLECTIONS.USERS), where("usuario", "==", user), where("senha", "==", hashedPass));
                const usersSnap = await getDocs(qUsers);

                if (!usersSnap.empty) {
                    clearFailedLogins();
                    const userDoc = usersSnap.docs[0];
                    Store.setUser({ id: userDoc.id, ...userDoc.data() });
                    
                    await atualizarStatusVendedor(Store.getUser().id);
                    
                    formLogin.reset();
                    feedbackLogin.innerText = '';
                    Toast.info(`Bem-vindo de volta, ${Store.getUser().nome.split(' ')[0]}!`);

                    if (window.SmartFarmaAnimations && window.SmartFarmaAnimations.playLoginExperience) {
                        btnSubmit.innerText = 'A Autenticar...';
                        window.SmartFarmaAnimations.playLoginExperience(() => {
                            btnSubmit.innerText = textoOriginal; btnSubmit.style.opacity = '1'; btnSubmit.disabled = false;
                            if (Store.getUser().tipo === CONFIG.ROLES.VENDEDOR) { navigateTo('view-vendedor'); loadVendedorView(); } 
                            else { navigateTo('view-admin'); loadAdminView(); }
                        });
                    } else {
                        btnSubmit.innerText = textoOriginal; btnSubmit.style.opacity = '1'; btnSubmit.disabled = false;
                        if (Store.getUser().tipo === CONFIG.ROLES.VENDEDOR) { navigateTo('view-vendedor'); loadVendedorView(); } 
                        else { navigateTo('view-admin'); loadAdminView(); }
                    }
                } else {
                    registerFailedLogin();
                    const qReq = query(collection(db, CONFIG.COLLECTIONS.SOLICITACOES), where("usuario", "==", user), where("senha", "==", hashedPass), where("tipo", "==", CONFIG.REQ_TYPES.CADASTRO));
                    if (!(await getDocs(qReq)).empty) {
                        Toast.warning("A sua conta ainda está em análise pelo escritório.");
                    } else {
                        Toast.error("Credenciais inválidas. Tente novamente.");
                    }
                    
                    formLogin.classList.add('shake-trigger');
                    setTimeout(() => formLogin.classList.remove('shake-trigger'), 400);
                    
                    btnSubmit.innerText = textoOriginal; btnSubmit.style.opacity = '1'; btnSubmit.disabled = false;
                }
            } catch (error) {
                Logger.error('Erro durante autenticação', error);
                Toast.error('Falha na autenticação. Tente novamente.');
                btnSubmit.innerText = textoOriginal; btnSubmit.style.opacity = '1'; btnSubmit.disabled = false;
            }
        });

        document.getElementById('btnLogout').addEventListener('click', async () => {
            if (Store.getUser()) {
                const btn = document.getElementById('btnLogout');
                const txtOriginal = btn.innerText;
                btn.innerText = 'A sair...';
                await logoutVendedor(Store.getUser().id);
                btn.innerText = txtOriginal;
            }
            Store.setUser(null);
            Store.clearListeners();
            Store.setLojaAdmin(null);
            
            // Limpa o cache ao deslogar
            dbCache = { sangrias: [], lojas: [], users: [], boletos: [], solicitacoes: [] };

            Toast.info("Sessão encerrada com segurança.");
            navigateTo('view-login');
        });
    };

    const loadVendedorView = () => {
        const { db, collection, query, where, onSnapshot } = getFB();
        const currentUser = Store.getUser();

        if (Store.state.vendedorListeners.length === 0) {
            const qSangrias = query(collection(db, CONFIG.COLLECTIONS.SANGRIAS), where("vendedor_id", "==", currentUser.id));
            Store.state.vendedorListeners.push(onSnapshot(qSangrias, (snap) => { 
                dbCache.sangrias = []; snap.forEach(d => dbCache.sangrias.push({ id: d.id, ...d.data() }));
                renderHistoricoVendedor(); 
            }));

            const qBoletos = query(collection(db, CONFIG.COLLECTIONS.BOLETOS), where("loja_id", "==", currentUser.loja_id));
            Store.state.vendedorListeners.push(onSnapshot(qBoletos, (snap) => { 
                dbCache.boletos = []; snap.forEach(d => dbCache.boletos.push({ id: d.id, ...d.data() }));
                renderBoletosVendedor(); 
            }));
        }

        const form = document.getElementById('formSangria');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { addDoc } = getFB();
            
            const valor = Number(document.getElementById('sangriaValor').value);
            const obs = document.getElementById('sangriaObs').value;

            const btn = newForm.querySelector('button');
            btn.innerText = "A registar..."; btn.disabled = true;

            await addDoc(collection(db, CONFIG.COLLECTIONS.SANGRIAS), {
                vendedor_id: currentUser.id, loja_id: currentUser.loja_id, valor, valorOriginal: valor,
                observacao: obs, status: CONFIG.STATUS.PENDENTE, motivo: '', data: new Date().toLocaleString('pt-BR'), timestamp: Date.now()
            });

            newForm.reset();
            Toast.success("Sangria enviada para análise!");
            btn.innerText = "Enviar Sangria"; btn.disabled = false;
        });

        const filtroBtn = document.getElementById('filtroVendedor');
        if (filtroBtn) {
            const newFiltro = filtroBtn.cloneNode(true);
            filtroBtn.parentNode.replaceChild(newFiltro, filtroBtn);
            newFiltro.addEventListener('change', () => renderHistoricoVendedor(newFiltro.value));
        }

        const btnCancelBoleto = document.getElementById('btnBoletoCancel');
        const btnConfirmBoleto = document.getElementById('btnBoletoConfirm');
        
        if (btnCancelBoleto && btnConfirmBoleto) {
            const cloneCancel = btnCancelBoleto.cloneNode(true);
            btnCancelBoleto.parentNode.replaceChild(cloneCancel, btnCancelBoleto);
            const cloneConfirm = btnConfirmBoleto.cloneNode(true);
            btnConfirmBoleto.parentNode.replaceChild(cloneConfirm, btnConfirmBoleto);

            cloneCancel.addEventListener('click', fecharModalBoleto);
            
            cloneConfirm.addEventListener('click', async () => {
                const numeroDigitado = document.getElementById('modalBoletoNumeroConfirmacao').value.trim();
                const valorPago = Number(document.getElementById('modalBoletoValorPago').value);
                const obsVendedor = document.getElementById('modalBoletoObs').value;
                
                const boletoAtual = dbCache.boletos.find(d => d.id === Store.state.modal.boletoId);

                // VALIDAÇÃO DE SEGURANÇA NO NÚMERO
                if (numeroDigitado !== boletoAtual.numero_boleto) {
                    return Toast.error("Segurança: O número digitado não confere com o boleto oficial do escritório!");
                }

                if (isNaN(valorPago) || valorPago <= 0) { 
                    return Toast.warning("Insira um valor válido de pagamento."); 
                }

                const { doc, updateDoc } = getFB();
                const docRef = doc(db, CONFIG.COLLECTIONS.BOLETOS, Store.state.modal.boletoId);
                
                await updateDoc(docRef, {
                    valor_pago: valorPago, diferenca: valorPago - boletoAtual.valor_original,
                    status: CONFIG.STATUS.PAGO, observacao_vendedor: obsVendedor, vendedor_id: Store.getUser().id, data_pagamento: new Date().toLocaleString('pt-BR')
                });

                Toast.success("Pagamento validado e registado com sucesso!");
                fecharModalBoleto();
            });
        }
    };

    const renderHistoricoVendedor = (filtro = 'todas') => { 
        let minhasSangrias = [...dbCache.sangrias];
        minhasSangrias.sort((a, b) => b.timestamp - a.timestamp);
        
        let totalAp = 0, totalPend = 0, qtdRec = 0;
        
        minhasSangrias.forEach(s => {
            const val = Number(s.valor);
            const statusAtual = s.status ? String(s.status).toLowerCase().trim() : 'pendente';

            if (statusAtual === 'aprovado' || statusAtual === 'modificado') {
                totalAp += val;
            } else if (statusAtual === 'recusado') {
                qtdRec++;
            } else {
                totalPend += val; 
            }
        });

        animateValue(document.getElementById('vendTotalAprovado'), 0, totalAp, 1000, true);
        animateValue(document.getElementById('vendTotalPendente'), 0, totalPend, 1000, true);
        animateValue(document.getElementById('vendQtdRecusada'), 0, qtdRec, 1000, false);

        let filtradas = minhasSangrias;
        if (filtro !== 'todas') {
            if (filtro === 'aprovado') {
                filtradas = minhasSangrias.filter(s => {
                    const st = s.status ? String(s.status).toLowerCase().trim() : 'pendente';
                    return st === 'aprovado' || st === 'modificado';
                });
            } else if (filtro === 'pendente') {
                filtradas = minhasSangrias.filter(s => {
                    const st = s.status ? String(s.status).toLowerCase().trim() : 'pendente';
                    return st !== 'aprovado' && st !== 'recusado' && st !== 'modificado';
                });
            } else {
                filtradas = minhasSangrias.filter(s => {
                    const st = s.status ? String(s.status).toLowerCase().trim() : 'pendente';
                    return st === filtro;
                });
            }
        }

        const container = document.getElementById('listaHistoricoVendedor');
        if (filtradas.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem 0;">Nenhum registo encontrado.</p>';
            return;
        }

        container.innerHTML = filtradas.map(s => {
            const statusAtual = s.status ? String(s.status).toLowerCase().trim() : 'pendente';
            const statusClass = safeStatusClass(statusAtual) || 'pendente';
            const statusExibicao = escapeHtml(s.status || 'Pendente');
            const dataSafe = escapeHtml(s.data || '');
            const motivoSafe = escapeHtml(s.motivo || '');

            return `
            <div class="item-card tilt-element" style="flex-direction: column; align-items: flex-start; animation: fadeIn 0.4s ease forwards;">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <div>
                        <strong style="font-size: 1.1rem; color: var(--text-primary);">R$ ${Number(s.valor).toFixed(2)}</strong>
                        ${statusAtual === 'modificado' ? `<small style="text-decoration: line-through; color: var(--text-secondary); margin-left: 10px;">R$ ${Number(s.valorOriginal).toFixed(2)}</small>` : ''}
                        <div style="font-size: 0.8rem; color: var(--text-secondary)">${dataSafe}</div>
                    </div>
                    <span class="status-badge status-${statusClass}">${statusExibicao}</span>
                </div>
                ${s.motivo ? `<div class="motivo-box"><strong>Mensagem do Escritório:</strong><br>${motivoSafe}</div>` : ''}
            </div>
            `;
        }).join('');
    };

    const renderBoletosVendedor = () => {
        let meusBoletos = [...dbCache.boletos];
        meusBoletos.sort((a, b) => b.timestamp - a.timestamp);

        const container = document.getElementById('listaBoletosVendedor');

        if (meusBoletos.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem 0;">Nenhum boleto lançado para a sua loja de momento.</p>';
            return;
        }

        container.innerHTML = meusBoletos.map(b => {
            let diferencaHtml = '';
            const statusAtual = b.status ? String(b.status).toLowerCase().trim() : 'pendente';
            const descricaoJs = escapeJsString(b.descricao || '');
            const numeroBoletoSafe = escapeHtml(b.numero_boleto || 'N/A');
            const dataEmissaoSafe = escapeHtml(b.data_emissao || 'Sem data');
            const obsVendedorSafe = escapeHtml(b.observacao_vendedor || '');

            // Tratamento das Diferenças e Juros quando PAGO
            if (statusAtual === 'pago') {
                if (b.diferenca > 0) diferencaHtml = `<span style="color: #c62828; font-size: 0.85rem;">(Juros/Multa de R$ ${Math.abs(b.diferenca).toFixed(2)})</span>`;
                else if (b.diferenca < 0) diferencaHtml = `<span style="color: #2e7d32; font-size: 0.85rem;">(Desconto/Troco de R$ ${Math.abs(b.diferenca).toFixed(2)})</span>`;
                else diferencaHtml = `<span style="color: #1565c0; font-size: 0.85rem;">(Valor Exato)</span>`;
            }

            // Ações baseadas nos 3 status
            let acoesHtml = '';
            let bordaCard = 'var(--accent-1)';
            let statusBadge = '';

            if (statusAtual === 'pendente') {
                bordaCard = '#ff8f00';
                statusBadge = '<span class="status-badge status-pendente">NOVO BOLETO (CONFERIR)</span>';
                acoesHtml = `<button onclick="window.SmartFarmaLogic.confirmarRecebimentoBoleto('${b.id}')" class="btn-primary ripple-trigger mt-1" style="padding: 0.4rem 1rem; font-size: 0.85rem; background: #ff8f00; border: none;">Acabei de conferir</button>`;
            } else if (statusAtual === 'confirmado') {
                bordaCard = '#c62828';
                statusBadge = '<span class="status-badge status-recusado">A PAGAR</span>';
                acoesHtml = `<button onclick="window.SmartFarmaLogic.abrirModalBoleto('${b.id}', '${descricaoJs}', ${b.valor_original})" class="btn-primary ripple-trigger mt-1" style="padding: 0.4rem 1rem; font-size: 0.85rem; background: var(--accent-1);">Informar Pagamento Efetuado</button>`;
            } else {
                bordaCard = '#2e7d32';
                statusBadge = '<span class="status-badge status-aprovado">PAGO</span>';
                acoesHtml = `
                    <div style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px dashed var(--glass-border); width: 100%;">
                        <span style="font-size: 0.9rem;">Informou pagamento de: <strong>R$ ${Number(b.valor_pago).toFixed(2)}</strong> ${diferencaHtml}</span>
                        ${b.observacao_vendedor ? `<div class="motivo-box" style="margin-top:0.5rem; border-left-color: #2e7d32;"><strong>A sua Obs:</strong> ${obsVendedorSafe}</div>` : ''}
                    </div>
                `;
            }

            return `
            <div class="item-card tilt-element" style="flex-direction: column; align-items: flex-start; border-left: 4px solid ${bordaCard}">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <div>
                        <strong style="font-size: 1.1rem;">Boleto Enviado pelo Escritório</strong><br>
                        <span style="font-size: 0.9rem;">Nº Boleto: <strong style="color: var(--accent-2);">${numeroBoletoSafe}</strong></span><br>
                        <span style="font-size: 0.9rem;">Valor Emitido: <strong>R$ ${Number(b.valor_original).toFixed(2)}</strong></span>
                        <div style="font-size: 0.8rem; color: var(--text-secondary)">Enviado em: ${dataEmissaoSafe}</div>
                    </div>
                    <div style="text-align: right;">
                        ${statusBadge}
                    </div>
                </div>
                ${acoesHtml}
            </div>
            `;
        }).join('');
    };

    const confirmarRecebimentoBoleto = async (id) => {
        try {
            const { db, doc, updateDoc } = getFB();
            await updateDoc(doc(db, CONFIG.COLLECTIONS.BOLETOS, id), {
                status: CONFIG.STATUS.CONFIRMADO,
                data_confirmacao: new Date().toLocaleString('pt-BR')
            });
            Toast.success("Boleto confirmado! Já pode efetuar o pagamento.");
        } catch(e) {
            Toast.error("Erro ao confirmar recebimento.");
        }
    };

    const abrirModalBoleto = (id, desc, valor_original) => {
        Store.state.modal.boletoId = id;
        document.getElementById('modalBoletoOriginalDesc').innerText = desc;
        document.getElementById('modalBoletoOriginalValor').innerText = `R$ ${Number(valor_original).toFixed(2)}`;
        
        // Limpa os campos para forçar a validação
        document.getElementById('modalBoletoNumeroConfirmacao').value = '';
        document.getElementById('modalBoletoValorPago').value = valor_original; 
        document.getElementById('modalBoletoObs').value = '';
        
        document.getElementById('pagarBoletoModal').classList.remove('hidden');
    };

    const fecharModalBoleto = () => {
        document.getElementById('pagarBoletoModal').classList.add('hidden');
        Store.state.modal.boletoId = null;
    };

    const loadAdminView = async () => {
        document.getElementById('btnVoltarLojas').addEventListener('click', () => { alternarViewAdmin('grid'); });

        const { db, collection, getDocs, addDoc, onSnapshot } = getFB();

        if (Store.state.adminListeners.length === 0) {
            const lojasSnap = await getDocs(collection(db, CONFIG.COLLECTIONS.LOJAS));
            dbCache.lojas = [];
            lojasSnap.forEach(d => dbCache.lojas.push({ id: d.id, ...d.data() }));

            Store.state.adminListeners.push(onSnapshot(collection(db, CONFIG.COLLECTIONS.SOLICITACOES), (snap) => { 
                dbCache.solicitacoes = []; snap.forEach(d => dbCache.solicitacoes.push({ id: d.id, ...d.data() }));
                renderAdminDashboard(); 
            }));
            Store.state.adminListeners.push(onSnapshot(collection(db, CONFIG.COLLECTIONS.SANGRIAS), (snap) => { 
                dbCache.sangrias = []; snap.forEach(d => dbCache.sangrias.push({ id: d.id, ...d.data() }));
                renderAdminDashboard(); 
                if (Store.state.lojaAtualAdmin) renderSangriasLoja(Store.state.lojaAtualAdmin);
            }));
            Store.state.adminListeners.push(onSnapshot(collection(db, CONFIG.COLLECTIONS.USERS), (snap) => { 
                dbCache.users = []; snap.forEach(d => dbCache.users.push({ id: d.id, ...d.data() }));
                renderAdminDashboard(); 
                if (Store.state.lojaAtualAdmin) renderSangriasLoja(Store.state.lojaAtualAdmin);
            }));
            Store.state.adminListeners.push(onSnapshot(collection(db, CONFIG.COLLECTIONS.BOLETOS), (snap) => { 
                dbCache.boletos = []; snap.forEach(d => dbCache.boletos.push({ id: d.id, ...d.data() }));
                renderAdminDashboard(); 
                if (Store.state.lojaAtualAdmin) renderSangriasLoja(Store.state.lojaAtualAdmin);
            }));
        }

        let lojasHtml = '';
        dbCache.lojas.forEach(d => lojasHtml += `<option value="${d.id}">${d.nome}</option>`);
        document.getElementById('boletoLojaAdmin').innerHTML = lojasHtml;

        const formBoleto = document.getElementById('formBoletoAdmin');
        const newFormBoleto = formBoleto.cloneNode(true);
        formBoleto.parentNode.replaceChild(newFormBoleto, formBoleto);

        newFormBoleto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = newFormBoleto.querySelector('button');
            btn.innerText = "A lançar..."; btn.disabled = true;

            const lojaId = document.getElementById('boletoLojaAdmin').value;
            const numeroBoleto = document.getElementById('boletoNumeroAdmin').value.trim();
            const valor = Number(document.getElementById('boletoValorAdmin').value);

            await addDoc(collection(db, CONFIG.COLLECTIONS.BOLETOS), {
                loja_id: lojaId, descricao: 'Boleto', numero_boleto: numeroBoleto, valor_original: valor, valor_pago: null,
                diferenca: null, status: CONFIG.STATUS.PENDENTE, data_emissao: new Date().toLocaleString('pt-BR'),
                vendedor_id: null, data_pagamento: null, data_confirmacao: null, observacao_vendedor: '', timestamp: Date.now()
            });

            newFormBoleto.reset();
            Toast.success("Boleto enviado para conferência da loja!");
            btn.innerText = "Lançar"; btn.disabled = false;
        });

        setupModal();
    };

    const alternarViewAdmin = (tela) => {
        const executeSwitch = () => {
            const grid = document.getElementById('admin-lojas-grid');
            const detalhe = document.getElementById('admin-loja-detalhe');
            const indicadores = document.getElementById('admin-indicadores');
            const painelBoleto = document.getElementById('admin-lancar-boleto'); 
            const painelEquipe = document.getElementById('admin-equipe');
            
            if (tela === 'grid') {
                Store.setLojaAdmin(null); 
                detalhe.classList.remove('active-view'); detalhe.classList.add('hidden-view');
                grid.classList.remove('hidden-view'); grid.classList.add('active-view');
                indicadores.classList.remove('hidden-view'); indicadores.classList.add('active-view');
                painelBoleto.classList.remove('hidden-view'); painelBoleto.classList.add('active-view');
                if(painelEquipe) { painelEquipe.classList.remove('hidden-view'); painelEquipe.classList.add('active-view'); }
                renderAdminDashboard(); 
            } else {
                grid.classList.remove('active-view'); grid.classList.add('hidden-view');
                indicadores.classList.remove('active-view'); indicadores.classList.add('hidden-view');
                painelBoleto.classList.remove('active-view'); painelBoleto.classList.add('hidden-view');
                if(painelEquipe) { painelEquipe.classList.remove('active-view'); painelEquipe.classList.add('hidden-view'); }
                detalhe.classList.remove('hidden-view'); detalhe.classList.add('active-view');
            }
        };

        if (document.startViewTransition) document.startViewTransition(() => executeSwitch());
        else executeSwitch();
    };

    const renderAdminDashboard = () => {
        const { sangrias, lojas, users, boletos, solicitacoes } = dbCache;

        const containerReq = document.getElementById('adminSolicitacoesContainer');
        const listaReq = document.getElementById('listaSolicitacoesAdmin');

        if (solicitacoes.length > 0) {
            containerReq.style.display = 'block';
            listaReq.innerHTML = solicitacoes.map(req => {
                const lojaDesejada = lojas.find(l => l.id === req.loja_id);
                const nomeLoja = lojaDesejada ? lojaDesejada.nome : 'Não definida';
                const reqNomeSafe = escapeHtml(req.nome);
                const reqUsuarioSafe = escapeHtml(req.usuario);
                const nomeLojaSafe = escapeHtml(nomeLoja);
                const reqNomeJs = escapeJsString(req.nome);
                const reqUsuarioJs = escapeJsString(req.usuario);

                return `
                <li style="background: rgba(13, 71, 161, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--accent-2); gap: 10px; flex-wrap: wrap;">
                    <div style="font-size: 0.9rem;">
                        <strong style="color: var(--text-primary);">${reqNomeSafe}</strong><br>
                        <small style="color: var(--text-secondary);">Login: ${reqUsuarioSafe} | Loja: <strong>${nomeLojaSafe}</strong></small>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="window.SmartFarmaLogic.abrirModalAprovacao('${req.id}', '${reqNomeJs}', '${reqUsuarioJs}', '${req.loja_id}')" class="btn-primary ripple-trigger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px;">Avaliar</button>
                        <button onclick="window.SmartFarmaLogic.excluirSolicitacao('${req.id}')" class="btn-excluir ripple-trigger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px;">Excluir</button>
                    </div>
                </li>
                `;
            }).join('');
        } else {
            containerReq.style.display = 'none';
        }

        let valorAprovado = 0, valorPendente = 0, valorRecusado = 0;
        let maiorValor = 0, qtdPend = 0, qtdRec = 0;

        sangrias.forEach(s => {
            const val = Number(s.valor);
            const statusAtual = s.status ? String(s.status).toLowerCase().trim() : 'pendente';

            if (val > maiorValor) maiorValor = val;
            if (statusAtual === 'aprovado' || statusAtual === 'modificado') valorAprovado += val;
            else if (statusAtual === 'recusado') { valorRecusado += val; qtdRec++; }
            else { valorPendente += val; qtdPend++; }
        });

        const totalSomaValores = valorAprovado + valorPendente + valorRecusado;
        const totalGeralItens = sangrias.length;
        const ticketMedio = totalGeralItens > 0 ? (totalSomaValores / totalGeralItens) : 0;

        animateValue(document.getElementById('globalAprovado'), 0, valorAprovado, 1200, true);
        animateValue(document.getElementById('globalPendente'), 0, qtdPend, 1000, false);
        animateValue(document.getElementById('globalRecusado'), 0, qtdRec, 1000, false);
        animateValue(document.getElementById('ticketMedio'), 0, ticketMedio, 1200, true);
        animateValue(document.getElementById('maiorSangria'), 0, maiorValor, 1200, true);
        animateValue(document.getElementById('totalEnvios'), 0, totalGeralItens, 1000, false);

        let pctAp = 0, pctPend = 0, pctRec = 0;
        if (totalSomaValores > 0) {
            pctAp = (valorAprovado / totalSomaValores) * 100;
            pctPend = (valorPendente / totalSomaValores) * 100;
            pctRec = (valorRecusado / totalSomaValores) * 100;
        }

        setTimeout(() => {
            const barAprovado = document.getElementById('barAprovado');
            if (barAprovado) barAprovado.style.width = `${pctAp}%`;
            
            const barPendente = document.getElementById('barPendente');
            if (barPendente) barPendente.style.width = `${pctPend}%`;
            
            const barRecusado = document.getElementById('barRecusado');
            if (barRecusado) barRecusado.style.width = `${pctRec}%`;
        }, 100);

        animateValue(document.getElementById('pctAprovado'), 0, pctAp, 1000, true);
        animateValue(document.getElementById('pctPendente'), 0, pctPend, 1000, true);
        animateValue(document.getElementById('pctRecusado'), 0, pctRec, 1000, true);

        const timelineContainer = document.getElementById('globalActivityList');
        const ultimas = [...sangrias].sort((a,b) => b.timestamp - a.timestamp).slice(0, 5); 
        
        if (ultimas.length === 0) timelineContainer.innerHTML = '<li>Nenhuma atividade recente.</li>';
        else {
            timelineContainer.innerHTML = ultimas.map((s, index) => {
                const vendedor = users.find(u => u.id === s.vendedor_id);
                const loja = lojas.find(l => l.id === s.loja_id);
                const nomeVendedor = vendedor ? vendedor.nome.split(' ')[0] : 'Desconhecido';
                const nomeLoja = loja ? loja.nome : '';
                const nomeVendedorSafe = escapeHtml(nomeVendedor);
                const nomeLojaSafe = escapeHtml(nomeLoja);
                const dataSafe = escapeHtml(s.data || '');
                const statusAtual = s.status ? String(s.status).toLowerCase().trim() : 'pendente';

                let acaoTexto = '';
                if (statusAtual === 'aprovado') acaoTexto = `teve <strong>R$ ${Number(s.valor).toFixed(2)}</strong> aprovado.`;
                else if (statusAtual === 'recusado') acaoTexto = `teve uma sangria recusada.`;
                else if (statusAtual === 'modificado') acaoTexto = `teve o valor corrigido para <strong>R$ ${Number(s.valor).toFixed(2)}</strong>.`;
                else acaoTexto = `enviou <strong>R$ ${Number(s.valor).toFixed(2)}</strong> para análise.`;

                return `<li style="animation: fadeIn 0.4s ease ${index * 0.1}s forwards; opacity: 0;"><strong>${nomeVendedorSafe}</strong> (${nomeLojaSafe}) ${acaoTexto} <br><small style="opacity: 0.6">${dataSafe}</small></li>`;
            }).join('');
        }

        const grid = document.getElementById('admin-lojas-grid');
        grid.innerHTML = lojas.map(loja => {
            const sangriasLoja = sangrias.filter(s => s.loja_id === loja.id);
            const pendentesLoja = sangriasLoja.filter(s => {
                const st = s.status ? String(s.status).toLowerCase().trim() : 'pendente';
                return st !== 'aprovado' && st !== 'recusado' && st !== 'modificado';
            }).length;

            const caixaLoja = sangriasLoja.filter(s => {
                const st = s.status ? String(s.status).toLowerCase().trim() : 'pendente';
                return st === 'aprovado' || st === 'modificado';
            }).reduce((acc, s) => acc + Number(s.valor), 0);
            
            // Boletos pendentes (inclui os não confirmados pela loja)
            const boletosPendentes = boletos.filter(b => b.loja_id === loja.id && (b.status ? String(b.status).toLowerCase().trim() : 'pendente') !== 'pago').length;

            const lojaNomeSafe = escapeHtml(loja.nome || 'Loja');
            const lojaNomeJs = escapeJsString(loja.nome || 'Loja');
            return `
                <div class="glass-panel loja-card tilt-element" onclick="window.SmartFarmaLogic.abrirLoja('${loja.id}', '${lojaNomeJs}')" style="view-transition-name: loja-card-${loja.id};">
                    <div>
                        <h3 style="color: var(--accent-3);">${lojaNomeSafe}</h3>
                        <div class="loja-info">
                            <span>Sangrias Pendentes: <strong class="text-yellow">${pendentesLoja}</strong></span>
                            <span>Boletos: <strong class="text-red">${boletosPendentes}</strong></span>
                        </div>
                    </div>
                    <div style="margin-top: 1.5rem; font-size: 1.2rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Caixa da Loja</span><br>
                        <span class="text-green font-weight-bold" style="font-size: 1.8rem;">R$ ${caixaLoja.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }).join('');

        const containerEquipe = document.getElementById('listaEquipeAdmin');
        if (containerEquipe) {
            const vendedores = users.filter(u => u.tipo === CONFIG.ROLES.VENDEDOR);
            
            if (vendedores.length === 0) {
                containerEquipe.innerHTML = '<p style="color: var(--text-secondary);">Nenhum vendedor cadastrado.</p>';
            } else {
                containerEquipe.innerHTML = vendedores.map(v => {
                    const loja = lojas.find(l => l.id === v.loja_id);
                    const nomeLoja = loja ? loja.nome : 'Sem Loja';
                    const isOnline = v.isOnline === true;
                    const nomeVSafe = escapeHtml(v.nome || 'Sem nome');
                    const nomeLojaSafe = escapeHtml(nomeLoja);
                    const usuarioSafe = escapeHtml(v.usuario || '');
                    const lastSeenSafe = escapeHtml(v.lastSeen || '');
                    
                    return `
                    <div class="glass-panel vendedor-card tilt-element" style="padding: 1.2rem; margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
                        <div>
                            <strong style="color: var(--text-primary); font-size: 1.1rem;">${nomeVSafe}</strong><br>
                            <small style="color: var(--text-secondary);">Loja: <strong>${nomeLojaSafe}</strong> | Usuário: ${usuarioSafe}</small>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--glass-border); padding-top: 0.8rem;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-size: 0.85rem; font-weight: bold; color: ${isOnline ? '#2e7d32' : 'var(--text-secondary)'};">
                                        ${isOnline ? 'Online agora' : 'Offline'}
                                    </span>
                                    ${!isOnline && v.lastSeen ? `<small style="font-size: 0.75rem; color: var(--text-secondary);">Visto: ${lastSeenSafe}</small>` : ''}
                                </div>
                            </div>
                            <button onclick="window.SmartFarmaLogic.excluirVendedor('${v.id}')" class="btn-excluir ripple-trigger" style="font-size: 0.75rem; padding: 0.4rem 0.8rem;">Excluir</button>
                        </div>
                    </div>
                    `;
                }).join('');
            }
        }
    };

    const confirmarAprovacaoAcesso = async () => {
        const idReq = Store.state.modal.acessoId;
        const lojaDestinoId = document.getElementById('modalReqLoja').value;
        
        if (!lojaDestinoId) {
            return Toast.warning('Selecione uma loja para vincular o vendedor!');
        }

        const btn = document.getElementById('btnConfirmarAcesso');
        const txtOriginal = btn.innerText;
        btn.innerText = "A salvar..."; btn.disabled = true;

        try {
            const { db, doc, collection, addDoc, deleteDoc } = getFB();
            const req = dbCache.solicitacoes.find(s => s.id === idReq);
            if (!req) throw new Error("Solicitação não encontrada no cache.");

            await addDoc(collection(db, CONFIG.COLLECTIONS.USERS), {
                nome: req.nome,
                usuario: req.usuario,
                senha: req.senha,
                tipo: CONFIG.ROLES.VENDEDOR,
                isMaster: false,
                loja_id: lojaDestinoId,
                lastSeen: new Date().toLocaleString('pt-BR'),
                isOnline: false
            });

            await deleteDoc(doc(db, CONFIG.COLLECTIONS.SOLICITACOES, idReq));
            
            Toast.success('Usuário aprovado e criado com sucesso!');
            fecharModalAprovacao();

        } catch (error) {
            Logger.error("Erro ao aprovar utilizador:", error);
            Toast.error('Falha ao processar a aprovação.');
        } finally {
            btn.innerText = txtOriginal; btn.disabled = false;
        }
    };

    const abrirModalAprovacao = (id, nome, usuario, loja_id) => { 
        Store.state.modal.acessoId = id;
        document.getElementById('modalReqNome').innerText = nome;
        document.getElementById('modalReqUser').innerText = usuario;
        
        let lojasHtml = '<option value="">-- Selecione a Loja --</option>';
        dbCache.lojas.forEach(l => {
            lojasHtml += `<option value="${l.id}" ${l.id === loja_id ? 'selected' : ''}>${escapeHtml(l.nome)}</option>`;
        });
        document.getElementById('modalReqLoja').innerHTML = lojasHtml;
        document.getElementById('aprovarAcessoModal').classList.remove('hidden');
    };

    const fecharModalAprovacao = () => {
        document.getElementById('aprovarAcessoModal').classList.add('hidden');
        Store.state.modal.acessoId = null;
    };

    const abrirLoja = (lojaId, lojaNome) => { 
        Store.setLojaAdmin(lojaId); 

        document.getElementById('detalheLojaNome').innerText = lojaNome;
        
        const vendedoresDaLoja = dbCache.users.filter(u => u.loja_id === lojaId);
        
        let vendHtml = '';
        vendedoresDaLoja.forEach(v => vendHtml += `<li>${escapeHtml(v.nome || 'Sem nome')}</li>`);
        document.getElementById('listaVendedoresLoja').innerHTML = vendHtml || '<li>Nenhum vendedor</li>';

        alternarViewAdmin('detalhe');
        renderSangriasLoja(lojaId); 
    };

    const renderSangriasLoja = (lojaId) => { 
        const { sangrias, boletos, users } = dbCache;

        let sangriasLoja = sangrias.filter(s => s.loja_id === lojaId);
        let boletosLoja = boletos.filter(b => b.loja_id === lojaId);

        sangriasLoja.sort((a,b) => b.timestamp - a.timestamp);
        boletosLoja.sort((a,b) => b.timestamp - a.timestamp);
        
        const caixaTotal = sangriasLoja.filter(s => {
            const st = s.status ? String(s.status).toLowerCase().trim() : 'pendente';
            return st === 'aprovado' || st === 'modificado';
        }).reduce((acc, s) => acc + Number(s.valor), 0);

        animateValue(document.getElementById('detalheLojaCaixa'), 0, caixaTotal, 800, true);

        const containerSangrias = document.getElementById('listaSangriasAdmin');
        if(sangriasLoja.length === 0) containerSangrias.innerHTML = '<p>Nenhuma sangria registada nesta loja.</p>';
        else {
            containerSangrias.innerHTML = sangriasLoja.map((s, idx) => {
                const vendedor = users.find(u => u.id === s.vendedor_id);
                
                const statusLimpo = s.status ? String(s.status).toLowerCase().trim() : 'pendente';
                const statusClass = safeStatusClass(statusLimpo) || 'pendente';
                const statusExibicao = escapeHtml(s.status || 'Pendente');
                const vendedorNomeSafe = escapeHtml(vendedor ? vendedor.nome : 'Desconhecido');
                const dataSafe = escapeHtml(s.data || 'Sem Data');
                const observacaoSafe = escapeHtml(s.observacao || '');
                const motivoSafe = escapeHtml(s.motivo || '');

                const isPendente = (statusLimpo !== 'aprovado' && statusLimpo !== 'modificado' && statusLimpo !== 'recusado');
                
                return `
                    <div class="item-card" id="sangria-card-${s.id}" style="flex-direction: column; align-items: flex-start; gap: 0.5rem; margin-bottom: 1rem; animation: fadeIn 0.4s ease ${idx * 0.05}s forwards; opacity: 0;">
                        <div style="width: 100%; display: flex; justify-content: space-between;">
                            <span class="status-badge status-${statusClass}">${statusExibicao}</span>
                            <div style="text-align: right;">
                                <strong>R$ ${Number(s.valor).toFixed(2)}</strong>
                                ${statusLimpo === 'modificado' ? `<br><small style="text-decoration: line-through; color: var(--text-secondary);">R$ ${Number(s.valorOriginal).toFixed(2)}</small>` : ''}
                            </div>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); width: 100%;">
                            <strong>Vendedor:</strong> ${vendedorNomeSafe} <br>
                            <strong>Data:</strong> ${dataSafe} <br>
                            ${s.observacao ? `<strong>Obs:</strong> ${observacaoSafe}` : ''}
                            ${s.motivo ? `<div class="motivo-box">${motivoSafe}</div>` : ''}
                        </div>
                        ${isPendente ? `
                            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; width: 100%;">
                                <button onclick="window.SmartFarmaLogic.aprovarSangria('${s.id}', '${lojaId}')" style="flex: 1; min-width: 80px; background-color: #2e7d32; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: 'Montserrat', sans-serif;">ACEITAR</button>
                                <button onclick="window.SmartFarmaLogic.abrirModal('${s.id}', 'editar', '${lojaId}', ${s.valor})" style="flex: 1; min-width: 80px; background-color: #f57c00; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: 'Montserrat', sans-serif;">EDITAR</button>
                                <button onclick="window.SmartFarmaLogic.abrirModal('${s.id}', 'recusar', '${lojaId}', ${s.valor})" style="flex: 1; min-width: 80px; background-color: transparent; color: #c62828; border: 2px solid #c62828; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: 'Montserrat', sans-serif;">RECUSAR</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }

        const containerBoletos = document.getElementById('listaBoletosAdmin');
        if(boletosLoja.length === 0) containerBoletos.innerHTML = '<p>Nenhum boleto lançado para esta loja.</p>';
        else {
            containerBoletos.innerHTML = boletosLoja.map((b, idx) => {
                const vendedorPagou = users.find(u => u.id === b.vendedor_id);
                let diferencaHtml = '';

                const numeroBoletoSafe = escapeHtml(b.numero_boleto || 'Sem Registro');
                const dataEmissaoSafe = escapeHtml(b.data_emissao || 'Sem data');
                const dataConfirmacaoSafe = escapeHtml(b.data_confirmacao || 'Sem data');
                const dataPagamentoSafe = escapeHtml(b.data_pagamento || 'Sem data');
                const vendedorPagouSafe = escapeHtml(vendedorPagou ? vendedorPagou.nome : 'Desconhecido');
                const obsVendedorSafe = escapeHtml(b.observacao_vendedor || '');

                const statusLimpo = b.status ? String(b.status).toLowerCase().trim() : 'pendente';
                
                let borda = '#ff8f00';
                let txtStatus = 'AGUARDANDO LOJA';
                let classeBadge = 'status-pendente';

                if (statusLimpo === 'confirmado') {
                    borda = 'var(--accent-1)';
                    txtStatus = 'LOJA CIENTE (A PAGAR)';
                    classeBadge = 'status-recusado';
                } else if (statusLimpo === 'pago' || statusLimpo === 'aprovado') {
                    borda = '#2e7d32';
                    txtStatus = 'PAGO';
                    classeBadge = 'status-aprovado';
                }

                const isPago = (statusLimpo === 'pago' || statusLimpo === 'aprovado');
                
                if (isPago) {
                    if (b.diferenca > 0) diferencaHtml = `<span style="color: #c62828;">Juros/Multa: R$ ${Math.abs(b.diferenca).toFixed(2)}</span>`;
                    else if (b.diferenca < 0) diferencaHtml = `<span style="color: #2e7d32;">Desconto/Troco: R$ ${Math.abs(b.diferenca).toFixed(2)}</span>`;
                    else diferencaHtml = `<span style="color: #1565c0;">Valor pago foi exato.</span>`;
                }

                return `
                    <div class="item-card" style="flex-direction: column; align-items: flex-start; gap: 0.5rem; margin-bottom: 1rem; border-left: 4px solid ${borda}; animation: fadeIn 0.4s ease ${idx * 0.05}s forwards; opacity: 0;">
                        <div style="width: 100%; display: flex; justify-content: space-between;">
                            <strong style="color: var(--text-primary);">Nº ${numeroBoletoSafe}</strong>
                            <span class="status-badge ${classeBadge}">${txtStatus}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); width: 100%;">
                            Valor Original: <strong>R$ ${Number(b.valor_original).toFixed(2)}</strong> <br>
                            Lançado em: ${dataEmissaoSafe}
                        </div>
                        
                        ${statusLimpo === 'confirmado' ? `<small style="color: #ff8f00;">Loja confirmou recebimento em: ${dataConfirmacaoSafe}</small>` : ''}

                        ${isPago ? `
                            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--glass-border); width: 100%; font-size: 0.9rem;">
                                Pago por: <strong>${vendedorPagouSafe}</strong> em ${dataPagamentoSafe}<br>
                                Valor Retirado: <strong>R$ ${Number(b.valor_pago).toFixed(2)}</strong><br>
                                ${diferencaHtml}<br>
                                ${b.observacao_vendedor ? `<strong>Obs da Loja:</strong> ${obsVendedorSafe}` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
    };

    const aprovarSangria = async (id, lojaId) => {
        const card = document.getElementById(`sangria-card-${id}`);
        if(card) {
            card.style.transition = 'all 0.3s ease';
            card.style.transform = 'scale(0.98)';
            card.style.boxShadow = '0 0 20px rgba(46, 125, 50, 0.5)';
            card.style.borderColor = '#2e7d32';
        }
        await atualizarStatusSangria(id, CONFIG.STATUS.APROVADO, '', null, lojaId);
    };

    const setupModal = () => {
        const btnCancel = document.getElementById('btnModalCancel');
        const btnConfirm = document.getElementById('btnModalConfirm');

        if (btnCancel && btnConfirm) {
            const cloneCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(cloneCancel, btnCancel);
            const cloneConfirm = btnConfirm.cloneNode(true);
            btnConfirm.parentNode.replaceChild(cloneConfirm, btnConfirm);

            cloneCancel.addEventListener('click', () => fecharModal());

            cloneConfirm.addEventListener('click', async () => {
                const motivo = document.getElementById('modalMotivo').value.trim();
                if(!motivo) { 
                    return Toast.warning("Por favor, informe o motivo da ação."); 
                }

                const idAtual = Store.state.modal.sangriaId;
                const lojaIdAtualizar = document.getElementById('actionModal').getAttribute('data-loja-id');

                const btn = cloneConfirm;
                const txtOriginal = btn.innerText;
                btn.innerText = "A processar..."; 
                btn.disabled = true;

                if (Store.state.modal.acaoAtual === 'recusar') {
                    await atualizarStatusSangria(idAtual, CONFIG.STATUS.RECUSADO, motivo, null, lojaIdAtualizar);
                }
                else if (Store.state.modal.acaoAtual === 'editar') {
                    const novoValor = Number(document.getElementById('modalNovoValor').value);
                    if(isNaN(novoValor) || novoValor <= 0) { 
                        btn.innerText = txtOriginal;
                        btn.disabled = false;
                        return Toast.warning("Insira um valor válido."); 
                    }
                    await atualizarStatusSangria(idAtual, CONFIG.STATUS.MODIFICADO, motivo, novoValor, lojaIdAtualizar);
                }
                
                btn.innerText = txtOriginal;
                btn.disabled = false;
                fecharModal(); 
            });
        }
    };

    const abrirModal = (id, acao, lojaId, valorOriginal) => {
        Store.state.modal.sangriaId = id;
        Store.state.modal.acaoAtual = acao;
        
        const modal = document.getElementById('actionModal');
        if (!modal) return; 

        modal.setAttribute('data-loja-id', lojaId);

        const titulo = document.getElementById('modalTitle');
        const sub = document.getElementById('modalSubtitle');
        const groupValor = document.getElementById('groupNovoValor');
        document.getElementById('modalMotivo').value = ''; 

        if (acao === 'recusar') {
            titulo.innerText = "Recusar Sangria";
            sub.innerText = `Está a recusar a sangria de R$ ${Number(valorOriginal).toFixed(2)}. Justifique abaixo.`;
            groupValor.classList.add('hidden');
        } else if (acao === 'editar') {
            titulo.innerText = "Editar e Aprovar";
            sub.innerText = `O valor original foi R$ ${Number(valorOriginal).toFixed(2)}. Insira o novo valor aprovado.`;
            groupValor.classList.remove('hidden');
            document.getElementById('modalNovoValor').value = valorOriginal;
        }
        modal.classList.remove('hidden');
    };

    const fecharModal = () => {
        const modal = document.getElementById('actionModal');
        if (modal) modal.classList.add('hidden');
        Store.resetModalContext();
    };

    const atualizarStatusSangria = async (id, novoStatus, motivo = '', novoValor = null, lojaId) => {
        try {
            const { db, doc, updateDoc } = getFB();
            const docRef = doc(db, CONFIG.COLLECTIONS.SANGRIAS, id);
            
            const updates = { status: novoStatus };
            if (motivo) updates.motivo = motivo;
            if (novoValor !== null) updates.valor = Number(novoValor);

            await updateDoc(docRef, updates);
            
            renderSangriasLoja(lojaId); 
            
            let msg = "Ação concluída!";
            if (novoStatus === CONFIG.STATUS.APROVADO) msg = "Sangria aprovada com sucesso!";
            if (novoStatus === CONFIG.STATUS.RECUSADO) msg = "Sangria recusada e devolvida.";
            if (novoStatus === CONFIG.STATUS.MODIFICADO) msg = "Valor corrigido e aprovado.";
            
            Toast.success(msg);

        } catch (error) {
            Logger.error("Erro ao atualizar a sangria", error);
            Toast.error("Falha ao comunicar com a base de dados.");
        }
    };

    const API = {
        init: () => {
            waitForFirebase(() => {
                initDB();
                initLoginView();
            });
        },
        abrirLoja, 
        aprovarSangria, 
        abrirModal, 
        abrirModalBoleto,
        confirmarRecebimentoBoleto,
        abrirModalAprovacao, 
        fecharModalAprovacao,
        confirmarAprovacaoAcesso,
        abrirModalNovoUsuario, 
        fecharModalNovoUsuario,
        salvarNovoUsuario, 
        toggleLojaSelection, 
        excluirSolicitacao, 
        excluirVendedor
    };

    return API;
})();

window.SmartFarmaLogic = SmartFarmaLogic;
export default SmartFarmaLogic;
