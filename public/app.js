document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const navLinks = document.querySelector('.nav-links');
    const notification = document.getElementById('notification');
    const tradeModal = document.getElementById('trade-modal');
    const closeModalBtn = document.querySelector('.close-btn');

    let state = {
        token: localStorage.getItem('token'),
        user: null,
        products: [],
        campaigns: {}
    };

    // --- API HELPER ---
    const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
    const apiFetch = async (endpoint, { method = 'GET', body = null, headers = {} } = {}) => {
        const defaultHeaders = { 'Content-Type': 'application/json' };
        if (state.token) {
            defaultHeaders['Authorization'] = `Bearer ${state.token}`;
        }

        const config = {
            method,
            headers: { ...defaultHeaders, ...headers }
        };

        if (body) {
            config.body = JSON.stringify(body);
        }
        
        try {
            const url = `${API_BASE}/api${endpoint}`.replace(/([^:]\/)\/+/g, '$1');
            const response = await fetch(url, config);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            if (response.status === 204) return null;
            return await response.json();
        } catch (error) {
            console.error('API Fetch Error:', error);
            showNotification(error.message, 'error');
            throw error;
        }
    };

    // --- RENDER & VIEW FUNCTIONS ---
    const showView = (viewId) => {
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });
        const viewToShow = document.getElementById(viewId);
        if (viewToShow) {
            viewToShow.style.display = 'block';
            // Cargar datos específicos de cada vista
            if (viewId === 'my-trades-view') {
                fetchAndRenderMyTrades();
            } else if (viewId === 'chats-view') {
                fetchAndRenderChats();
            }
        } else {
             document.getElementById('login-view').style.display = 'block';
        }
    };

    const updateNav = () => {
        if (state.token) {
            document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'block');
            document.querySelectorAll('.no-auth').forEach(el => el.style.display = 'none');
        } else {
            document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.no-auth').forEach(el => el.style.display = 'block');
        }
    };
    
    const showNotification = (message, type = 'success') => {
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        setTimeout(() => {
            notification.className = 'notification';
        }, 3000);
    };
    
    const renderDashboard = () => {
        if (!state.user) return;
        document.getElementById('dashboard-welcome').textContent = `Bienvenido, ${state.user.name}!`;
        document.getElementById('dashboard-tokens').textContent = state.user.tokens;
        document.getElementById('dashboard-level').textContent = state.user.level;
        document.getElementById('dashboard-trades').textContent = state.user.trade_count;
        document.getElementById('dashboard-location').textContent = state.user.location;
        const insigniasContainer = document.getElementById('dashboard-insignias');
        insigniasContainer.innerHTML = '';
        try {
            const insignias = JSON.parse(state.user.insignias);
            if (insignias.length > 0) {
                 insignias.forEach(insignia => {
                    const el = document.createElement('span');
                    el.className = 'insignia';
                    el.textContent = insignia.replace(/-/g, ' ');
                    insigniasContainer.appendChild(el);
                });
            } else {
                 insigniasContainer.textContent = 'Aún no tienes insignias. ¡Sigue intercambiando y colaborando!';
            }
        } catch(e) {
            insigniasContainer.textContent = 'Aún no tienes insignias.';
        }
    };
    
    const renderProducts = (productsToRender) => {
        const grid = document.getElementById('products-grid');
        grid.innerHTML = '';
        if (productsToRender.length === 0) {
            grid.innerHTML = '<p>No se encontraron productos con estos filtros.</p>';
            return;
        }
        productsToRender.forEach(product => {
            if (state.user && product.owner_id === state.user.id) return; // No mostrar propios productos

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${product.image_url || 'https://via.placeholder.com/300x200.png?text=Sin+Imagen'}" alt="${product.name}" class="card-image">
                <div class="card-content">
                    <h4>${product.name}</h4>
                    <div class="meta">
                        <span><i class="fas fa-coins"></i> ${product.value}</span>
                        <span><i class="fas fa-tag"></i> ${product.category}</span>
                        <span><i class="fas fa-user"></i> ${product.owner_name}</span>
                    </div>
                    <p>${product.description}</p>
                    <button class="btn btn-secondary start-trade-btn" data-product-id="${product.id}">Iniciar Trueque</button>
                </div>
            `;
            grid.appendChild(card);
        });
    };
    
    const renderCampaigns = () => {
        const container = document.getElementById('campaigns-container');
        container.innerHTML = '';
        Object.entries(state.campaigns).forEach(([key, campaign]) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                 <div class="card-content">
                    <h4>${campaign.name}</h4>
                    <p>${campaign.description}</p>
                    <form class="donation-form" data-campaign-key="${key}">
                        <input type="number" min="1" required placeholder="Créditos a donar">
                        <button type="submit" class="btn">Donar</button>
                    </form>
                </div>
            `;
            container.appendChild(card);
        });
    };

    const renderMyTrades = (trades) => {
        const container = document.getElementById('trades-container');
        container.innerHTML = '';
        if (trades.length === 0) {
            container.innerHTML = '<p>No tienes trueques aún.</p>';
            return;
        }
        trades.forEach(trade => {
            const isUser1 = state.user && trade.user1_id === state.user.id;
            const isUser2 = state.user && trade.user2_id === state.user.id;
            const myProduct = isUser1 ? trade.my_product_name : trade.their_product_name;
            const theirProduct = isUser1 ? trade.their_product_name : trade.my_product_name;
            const otherUser = isUser1 ? trade.user2_name : trade.user1_name;

            let actionsHTML = '';
            
            if (trade.status === 'pending') {
                if (isUser2) {
                    // Solo user2 puede aceptar o rechazar
                    actionsHTML = `
                        <button class="btn btn-success update-trade-btn" data-trade-id="${trade.id}" data-status="completed">
                            <i class="fas fa-check"></i> Aceptar
                        </button>
                        <button class="btn btn-danger update-trade-btn" data-trade-id="${trade.id}" data-status="cancelled">
                            <i class="fas fa-times"></i> Rechazar
                        </button>
                    `;
                } else if (isUser1) {
                    // User1 (quien propuso) solo ve estado esperando
                    actionsHTML = '<p class="status-text"><i class="fas fa-hourglass-half"></i> Esperando respuesta de <strong>' + otherUser + '</strong>...</p>';
                }
            } else {
                // Completado o Cancelado
                actionsHTML = '<p class="status-text">Trueque ' + trade.status + '</p>';
            }

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-content">
                    <div class="trade-info">
                        <div class="trade-item">
                            <h5>Tu Producto</h5>
                            <p><strong>${myProduct || 'N/A'}</strong></p>
                        </div>
                        <div class="trade-arrow"><i class="fas fa-exchange-alt"></i></div>
                        <div class="trade-item">
                            <h5>Producto de ${otherUser}</h5>
                            <p><strong>${theirProduct || 'N/A'}</strong></p>
                        </div>
                    </div>
                    <div class="trade-meta">
                        <span><i class="fas fa-calendar"></i> ${new Date(trade.timestamp).toLocaleDateString()}</span>
                        <span class="status-badge status-${trade.status}"><i class="fas fa-info-circle"></i> ${trade.status}</span>
                    </div>
                    <div class="trade-actions">
                        ${actionsHTML}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    };

    /* ----- Chats: render y fetch ----- */
    const renderChatsList = (chats) => {
        const list = document.getElementById('chats-list');
        list.innerHTML = '';
        if (!chats || chats.length === 0) {
            list.innerHTML = '<p>No tienes conversaciones todavía.</p>';
            return;
        }
        // Guardar chats en estado para referencia
        state.chats = chats;
        chats.forEach(chat => {
            const otherName = (chat.user1_id === state.user.id) ? chat.user2_name : chat.user1_name;
            const lastMsg = chat.last_message ? chat.last_message : '';
            const lastTime = chat.last_message_time ? new Date(chat.last_message_time).toLocaleString() : '';
            const item = document.createElement('div');
            item.className = 'chat-item';
            item.dataset.chatId = chat.id;
            item.innerHTML = `
                <h4>${otherName}</h4>
                <p class="last-msg">${lastMsg}</p>
                <div class="chat-time">${lastTime}</div>
            `;
            list.appendChild(item);
        });
    };

    const fetchAndRenderChats = async () => {
        try {
            const chats = await apiFetch('/chats');
            renderChatsList(chats);
        } catch (err) {
            console.error('Error fetching chats:', err);
        }
    };

    const renderMessages = (messages, chat) => {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';
        if (!messages) return;
        messages.forEach(m => {
            const el = document.createElement('div');
            const isMe = m.sender_id === state.user.id;
            el.className = 'message ' + (isMe ? 'me' : 'they');
            el.innerHTML = `<div class="text">${m.content}</div><div class="meta">${m.sender_name} · ${new Date(m.timestamp).toLocaleString()}</div>`;
            container.appendChild(el);
        });
        container.scrollTop = container.scrollHeight;
    };

    const fetchAndRenderMessages = async (chatId) => {
        try {
            const messages = await apiFetch(`/chats/${chatId}/messages`);
            // cargar header
            const chatHeader = document.getElementById('chat-header');
            chatHeader.textContent = 'Conversación';
            renderMessages(messages);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    const openChat = async (chatId) => {
        // Mostrar vista de chats y cargar mensajes
        showView('chats-view');
        await fetchAndRenderChats();
        // marcar activo en la lista
        document.querySelectorAll('.chat-item').forEach(it => it.classList.remove('active'));
        const activeEl = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (activeEl) activeEl.classList.add('active');

        // Obtener nombre del otro usuario desde state.chats
        const chatObj = (state.chats || []).find(c => String(c.id) === String(chatId));
        if (chatObj) {
            const otherName = (chatObj.user1_id === state.user.id) ? chatObj.user2_name : chatObj.user1_name;
            const header = document.getElementById('chat-header');
            header.innerHTML = `<strong>${otherName}</strong> <span class="chat-sub">(Trueque ${chatObj.trade_id || ''})</span>`;
        }

        await fetchAndRenderMessages(chatId);
        // guardar chat activo en DOM
        const chatForm = document.getElementById('chat-form');
        chatForm.dataset.chatId = chatId;
    };

    const sendMessage = async (chatId, content) => {
        try {
            const message = await apiFetch(`/chats/${chatId}/messages`, { method: 'POST', body: { content } });
            // Añadir al DOM
            const container = document.getElementById('chat-messages');
            const el = document.createElement('div');
            el.className = 'message me';
            el.innerHTML = `<div class="text">${message.content}</div><div class="meta">${message.sender_name} · ${new Date(message.timestamp).toLocaleString()}</div>`;
            container.appendChild(el);
            container.scrollTop = container.scrollHeight;
            // refrescar lista de chats
            fetchAndRenderChats();
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    const fetchAndRenderMyTrades = async () => {
        try {
            const trades = await apiFetch('/my-trades');
            renderMyTrades(trades);
        } catch(error) {
            console.error('Error fetching trades:', error);
        }
    };

    const updateTradeStatus = async (tradeId, newStatus) => {
        try {
            const result = await apiFetch(`/trades/${tradeId}`, {
                method: 'PUT',
                body: { status: newStatus }
            });
            showNotification(result.message);
            fetchAndRenderMyTrades();
            // Si el backend devolvió chatId (trueque aceptado), abrir chat
            if (result.chatId) {
                openChat(result.chatId);
            }
        } catch(error) {
            console.error('Error updating trade:', error);
        }
    };

    const showConfirmationModal = (title, message, onConfirm, confirmButtonText = 'Confirmar') => {
        const confirmModal = document.getElementById('confirmation-modal');
        const titleEl = document.getElementById('confirmation-title');
        const messageEl = document.getElementById('confirmation-message');
        const confirmBtn = document.getElementById('confirmation-confirm-btn');
        const cancelBtn = document.getElementById('confirmation-cancel-btn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmButtonText;

        const handleConfirm = () => {
            onConfirm();
            confirmModal.style.display = 'none';
            cleanupModal();
        };

        const handleCancel = () => {
            confirmModal.style.display = 'none';
            cleanupModal();
        };

        const cleanupModal = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        confirmModal.style.display = 'block';
    };

    // --- EVENT HANDLERS & LOGIC ---
    const handleLogin = async (email, password) => {
        try {
            const data = await apiFetch('/login', { method: 'POST', body: { email, password } });
            state.token = data.accessToken;
            localStorage.setItem('token', state.token);
            await fetchUserData();
            showView('dashboard-view');
            showNotification('¡Sesión iniciada con éxito!');
        } catch (error) {
            console.error('Login failed:', error);
        }
    };
    
    const handleLogout = () => {
        state.token = null;
        state.user = null;
        localStorage.removeItem('token');
        updateNav();
        showView('login-view');
        showNotification('Has cerrado sesión.');
    };
    
    const fetchUserData = async () => {
        if (!state.token) return;
        try {
            state.user = await apiFetch('/user/me');
            updateNav();
            renderDashboard();
        } catch (error) {
            console.error("Error fetching user data, logging out.", error);
            handleLogout();
        }
    };
    
    const fetchAndRenderProducts = async () => {
        try {
            const category = document.getElementById('category-filter').value;
            let endpoint = '/products';
            if (category) {
                endpoint += `?category=${category}`;
            }
            state.products = await apiFetch(endpoint);
            renderProducts(state.products);
        } catch(error) {}
    };
    
    const openTradeModal = (theirProductId) => {
        const theirProduct = state.products.find(p => p.id === parseInt(theirProductId));
        if (!theirProduct) return;
        
        apiFetch('/products?owner_id=' + state.user.id).then(myProducts => { // Endpoint no implementado, simulamos
             myProducts = state.products.filter(p => p.owner_id === state.user.id);
             
             const modalContent = document.getElementById('trade-modal-content');
             modalContent.innerHTML = `
                <div class="trade-product">
                    <h4>Tu Oferta</h4>
                    <select id="my-product-select">
                        <option value="">Selecciona tu producto...</option>
                        ${myProducts.map(p => `<option value="${p.id}" data-value="${p.value}">${p.name} (${p.value} créditos)</option>`).join('')}
                    </select>
                </div>
                <div class="trade-arrow"><i class="fas fa-exchange-alt"></i></div>
                <div class="trade-product">
                    <h4>Producto Deseado</h4>
                    <img src="${theirProduct.image_url || 'https://via.placeholder.com/300x200.png?text=Sin+Imagen'}" alt="${theirProduct.name}">
                    <p>${theirProduct.name}</p>
                    <p><strong>${theirProduct.value} créditos</strong></p>
                </div>
             `;
             const summaryDiv = document.createElement('div');
             summaryDiv.id = 'trade-summary';
             modalContent.appendChild(summaryDiv);
             
             const confirmBtn = document.createElement('button');
             confirmBtn.textContent = 'Confirmar Trueque';
             confirmBtn.className = 'btn';
             confirmBtn.onclick = () => handleConfirmTrade(theirProduct.id);
             summaryDiv.appendChild(confirmBtn);

             tradeModal.style.display = 'block';
        });
    };
    
    const handleConfirmTrade = async (theirProductId) => {
        const myProductId = document.getElementById('my-product-select').value;
        if (!myProductId) {
            showNotification('Debes seleccionar uno de tus productos.', 'error');
            return;
        }
        try {
            const result = await apiFetch('/trades/complete', {
                method: 'POST',
                body: { myProductId: parseInt(myProductId), theirProductId: parseInt(theirProductId) }
            });
            showNotification(result.message);
            tradeModal.style.display = 'none';
            fetchAndRenderProducts(); // Refresh products list
            fetchUserData(); // Refresh user tokens
        } catch (error) {}
    };

    // --- EVENT LISTENERS ---
    navLinks.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target.tagName === 'A') {
            const viewId = e.target.dataset.view;
            if (viewId) {
                showView(viewId);
            }
        }
    });
    
    mainContent.addEventListener('click', (e) => {
        // Para botones de cambio de formulario (Login <-> Registro)
        if (e.target.tagName === 'A' && e.target.dataset.view) {
             e.preventDefault();
             showView(e.target.dataset.view);
        }
        // Para iniciar trueque
        if (e.target.classList.contains('start-trade-btn')) {
            openTradeModal(e.target.dataset.productId);
        }
        // Para actualizar estado de trueque
        if (e.target.classList.contains('update-trade-btn')) {
            const tradeId = e.target.dataset.tradeId;
            const newStatus = e.target.dataset.status;
            const titles = {
                completed: 'Aceptar Trueque',
                cancelled: 'Rechazar Trueque'
            };
            const messages = {
                completed: '¿Estás seguro de que deseas aceptar este trueque? Los productos se intercambiarán automáticamente.',
                cancelled: '¿Estás seguro de que deseas rechazar este trueque?'
            };
            const buttonTexts = {
                completed: 'Aceptar',
                cancelled: 'Rechazar'
            };
            showConfirmationModal(
                titles[newStatus],
                messages[newStatus],
                () => updateTradeStatus(parseInt(tradeId), newStatus),
                buttonTexts[newStatus]
            );
        }
        // Abrir chat al hacer click en la lista
        const chatItem = e.target.closest && e.target.closest('.chat-item');
        if (chatItem) {
            const chatId = chatItem.dataset.chatId;
            openChat(chatId);
        }
    });

    document.getElementById('logo-btn').addEventListener('click', (e) => {
        e.preventDefault();
        if (state.token) showView('dashboard-view');
        else showView('login-view');
    });

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        handleLogin(email, password);
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            name: document.getElementById('register-name').value,
            email: document.getElementById('register-email').value,
            password: document.getElementById('register-password').value,
            location: document.getElementById('register-location').value
        };
        try {
            const data = await apiFetch('/register', { method: 'POST', body });
            showNotification(data.message);
            showView('login-view');
        } catch(error){}
    });
    
    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            name: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            value: parseInt(document.getElementById('product-value').value),
            category: document.getElementById('product-category').value,
            image_url: document.getElementById('product-image').value
        };
        try {
            const data = await apiFetch('/products', { method: 'POST', body });
            showNotification(data.message);
            e.target.reset();
            showView('products-view');
            fetchAndRenderProducts();
        } catch(error) {}
    });
    
    document.getElementById('category-filter').addEventListener('change', fetchAndRenderProducts);

    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    closeModalBtn.onclick = () => { tradeModal.style.display = 'none'; };
    window.onclick = (event) => {
        if (event.target == tradeModal) {
            tradeModal.style.display = "none";
        }
    };
    
    // Enviar mensaje desde el formulario de chat
    const chatFormEl = document.getElementById('chat-form');
    if (chatFormEl) {
        chatFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const chatId = e.target.dataset.chatId;
            const content = input.value.trim();
            if (!content) return;
            await sendMessage(chatId, content);
            input.value = '';
        });
    }
    
    mainContent.addEventListener('submit', async (e) => {
        if (e.target.classList.contains('donation-form')) {
            e.preventDefault();
            const campaignKey = e.target.dataset.campaignKey;
            const amount = e.target.querySelector('input').value;
            try {
                const result = await apiFetch('/donate', { method: 'POST', body: { campaign: campaignKey, amount: parseInt(amount) }});
                showNotification(result.message);
                fetchUserData();
            } catch(error) {}
        }
    });

    // --- INITIALIZATION ---
    // Exponer helpers para depuración en la consola
    window.showView = showView;
    window.openChat = openChat;
    const initApp = async () => {
        if (state.token) {
            await fetchUserData();
        }
        updateNav();
        // Cargar datos iniciales para las vistas
        fetchAndRenderProducts();
        apiFetch('/campaigns').then(data => {
            state.campaigns = data;
            renderCampaigns();
        });
        // Mostrar la vista correcta
        if (state.user) {
            showView('dashboard-view');
        } else {
            showView('login-view');
        }
    };

    initApp();
});
