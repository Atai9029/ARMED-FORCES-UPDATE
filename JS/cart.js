/* ===== ARMED FORCES — CART ENGINE ===== */
(function () {
    'use strict';

    // ──── Состояние корзины ────
    let cart = JSON.parse(localStorage.getItem('af_cart') || '[]');

    function saveCart() {
        localStorage.setItem('af_cart', JSON.stringify(cart));
    }

    function findItem(id) {
        return cart.find(i => i.id === id);
    }

    function addItem(product) {
        const existing = findItem(product.id);
        if (existing) {
            existing.qty++;
        } else {
            cart.push({ ...product, qty: 1 });
        }
        saveCart();
        renderCart();
        updateCountBadge();
        pulseCartBtn();
        showToast(`${product.name} добавлен в корзину`);
    }

    function removeItem(id) {
        cart = cart.filter(i => i.id !== id);
        saveCart();
        renderCart();
        updateCountBadge();
    }

    function changeQty(id, delta) {
        const item = findItem(id);
        if (!item) return;
        item.qty += delta;
        if (item.qty <= 0) {
            removeItem(id);
            return;
        }
        saveCart();
        renderCart();
        updateCountBadge();
    }

    function clearCart() {
        cart = [];
        saveCart();
        renderCart();
        updateCountBadge();
    }

    function totalItems() {
        return cart.reduce((s, i) => s + i.qty, 0);
    }

    function totalPrice() {
        return cart.reduce((s, i) => s + i.price * i.qty, 0);
    }

    // ──── Форматирование цены ────
    function formatPrice(num) {
        if (num >= 1_000_000_000) {
            return '$' + (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' млрд';
        }
        if (num >= 1_000_000) {
            return '$' + (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' млн';
        }
        return '$' + num.toLocaleString('ru-RU');
    }

    // ──── Разбор цены из строки ────
    function parsePrice(str) {
        const clean = str.replace(/[^0-9.,]/g, '').replace(',', '.');
        const num = parseFloat(clean);
        if (str.includes('млрд') || str.includes('billion')) return num * 1e9;
        if (str.includes('млн') || str.includes('million')) return num * 1e6;
        // Проверяем длину числа, если очень большое — может быть с точкой-разделителем тысяч
        // "3.800,000,000" => 3800000000
        const rawDigits = str.replace(/[^0-9]/g, '');
        const asInt = parseInt(rawDigits, 10);
        return isNaN(asInt) ? 0 : asInt;
    }

    // ──── Рендер панели ────
    function renderCart() {
        const itemsEl = document.getElementById('cartItems');
        if (!itemsEl) return;

        if (cart.length === 0) {
            itemsEl.innerHTML = `
                <div class="cart-empty">
                    <div class="empty-icon">🛒</div>
                    <p>Корзина пуста</p>
                    <span>Добавьте технику из каталога</span>
                </div>`;
        } else {
            itemsEl.innerHTML = cart.map(item => `
                <div class="cart-item" data-id="${item.id}">
                    <img class="cart-item-img" src="${item.img}" alt="${item.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 60%22><rect width=%2280%22 height=%2260%22 fill=%22%23222%22/><text x=%2240%22 y=%2235%22 text-anchor=%22middle%22 fill=%22%23555%22 font-size=%228%22>NO IMG</text></svg>'">
                    <div class="cart-item-info">
                        <div class="cart-item-name" title="${item.name}">${item.name}</div>
                        <div class="cart-item-meta">${item.meta || ''}</div>
                        <div class="cart-item-bottom">
                            <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>
                            <div class="qty-control">
                                <button class="qty-btn" onclick="AF_Cart.changeQty('${item.id}', -1)">−</button>
                                <span class="qty-num">${item.qty}</span>
                                <button class="qty-btn" onclick="AF_Cart.changeQty('${item.id}', 1)">+</button>
                            </div>
                        </div>
                    </div>
                    <button class="cart-item-remove" title="Удалить" onclick="AF_Cart.removeItem('${item.id}')">✕</button>
                </div>`).join('');
        }

        // Обновляем итоговую сумму
        const totalEl = document.getElementById('cartTotal');
        if (totalEl) totalEl.textContent = formatPrice(totalPrice());

        const countLbl = document.getElementById('cartItemsLabel');
        if (countLbl) countLbl.textContent = `${totalItems()} шт.`;

        // Кнопка оформить заказ
        const checkoutBtn = document.getElementById('cartCheckoutBtn');
        if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
    }

    // ──── Счётчик в хедере ────
    function updateCountBadge() {
        const badge = document.getElementById('cartCountBadge');
        if (!badge) return;
        const n = totalItems();
        badge.textContent = n;
        badge.classList.toggle('visible', n > 0);
    }

    // ──── Анимация кнопки ────
    function pulseCartBtn() {
        const btn = document.getElementById('cartHeaderBtn');
        if (!btn) return;
        btn.classList.remove('pulse');
        void btn.offsetWidth; // reflow
        btn.classList.add('pulse');
        setTimeout(() => btn.classList.remove('pulse'), 500);
    }

    // ──── Toast ────
    let toastTimer = null;

    function showToast(msg) {
        let toast = document.getElementById('cartToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cartToast';
            toast.className = 'cart-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = '✓ ' + msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ──── Открытие / закрытие панели ────
    function openCart() {
        document.getElementById('cartOverlay')?.classList.add('open');
        document.getElementById('cartPanel')?.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        document.getElementById('cartOverlay')?.classList.remove('open');
        document.getElementById('cartPanel')?.classList.remove('open');
        document.body.style.overflow = '';
    }

    // ──── Оформить заказ ────
    function checkout() {
        if (cart.length === 0) return;
        closeCart();
        clearCart();
        setTimeout(() => {
            const overlay = document.getElementById('orderModalOverlay');
            if (overlay) {
                overlay.classList.add('open');
            }
        }, 350);
    }

    // ──── Инъекция HTML ────
    function injectCartHTML() {
        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'cartOverlay';
        overlay.className = 'cart-overlay';
        overlay.addEventListener('click', closeCart);
        document.body.appendChild(overlay);

        // Panel
        const panel = document.createElement('div');
        panel.id = 'cartPanel';
        panel.className = 'cart-panel';
        panel.innerHTML = `
            <div class="cart-header">
                <h2>🛒 Корзина</h2>
                <div class="cart-header-right">
                    <span class="cart-items-label" id="cartItemsLabel">0 шт.</span>
                    <button class="cart-close" onclick="AF_Cart.closeCart()">✕</button>
                </div>
            </div>
            <div class="cart-items" id="cartItems"></div>
            <div class="cart-footer">
                <div class="cart-summary">
                    <div class="cart-summary-row">
                        <span>Товаров</span>
                        <span id="cartItemsCount">0</span>
                    </div>
                    <div class="cart-summary-row total">
                        <span>Итого</span>
                        <span class="total-price" id="cartTotal">$0</span>
                    </div>
                </div>
                <button class="cart-checkout-btn" id="cartCheckoutBtn" onclick="AF_Cart.checkout()">
                    Оформить заказ →
                </button>
            </div>`;
        document.body.appendChild(panel);

        // Order success modal
        const modal = document.createElement('div');
        modal.id = 'orderModalOverlay';
        modal.className = 'order-modal-overlay';
        modal.innerHTML = `
            <div class="order-modal">
                <span class="check-icon">✅</span>
                <h3>Заказ оформлен!</h3>
                <p>Наши военные специалисты<br>свяжутся с вами в ближайшее время.</p>
                <button class="order-modal-close" onclick="document.getElementById('orderModalOverlay').classList.remove('open')">Отлично!</button>
            </div>`;
        document.body.appendChild(modal);
    }

    // ──── Инъекция кнопки корзины в хедер ────
    function injectCartButton() {
        const nav = document.querySelector('header nav, .header nav');
        if (!nav) return;

        const btn = document.createElement('button');
        btn.id = 'cartHeaderBtn';
        btn.className = 'cart-btn';
        btn.innerHTML = `<span class="cart-icon">🛒</span><span>Корзина</span><span class="cart-count" id="cartCountBadge">0</span>`;
        btn.addEventListener('click', openCart);
        nav.appendChild(btn);
    }

    // ──── Добавление кнопок «В корзину» к карточкам каталога ────
    function injectAddToCartButtons() {
        const cards = document.querySelectorAll('.card');
        cards.forEach((card, idx) => {
            const nameEl = card.querySelector('h3');
            const priceEl = card.querySelector('.price');
            const imgEl = card.querySelector('img');
            const detailSpans = card.querySelectorAll('.details span');

            if (!nameEl || !priceEl) return;

            const name = nameEl.textContent.trim();
            const priceRaw = priceEl.textContent.trim();
            const price = parsePrice(priceRaw);
            const img = imgEl ? imgEl.getAttribute('src') : '';
            const meta = Array.from(detailSpans).map(s => s.textContent).join(' · ');
            const id = 'item_' + idx + '_' + name.replace(/\s+/g, '_').slice(0, 20);

            const addBtn = document.createElement('button');
            addBtn.className = 'add-to-cart-btn';
            addBtn.innerHTML = '🛒 В корзину';
            addBtn.addEventListener('click', () => {
                addItem({ id, name, price, img, meta, priceRaw });
                addBtn.classList.add('added');
                addBtn.innerHTML = '✓ В корзине';
                setTimeout(() => {
                    addBtn.classList.remove('added');
                    addBtn.innerHTML = '🛒 В корзину';
                }, 1800);
            });

            const content = card.querySelector('.content');
            if (content) content.appendChild(addBtn);
        });
    }

    // ──── Инициализация ────
    function init() {
        // Подключаем CSS если ещё не подключён
        if (!document.querySelector('link[href*="cart.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            // Определяем путь относительно текущей страницы
            const depth = location.pathname.split('/').length - 2;
            link.href = '../'.repeat(depth > 0 ? depth : 0) + 'css/cart.css';
            document.head.appendChild(link);
        }

        injectCartHTML();
        injectCartButton();
        injectAddToCartButtons();
        renderCart();
        updateCountBadge();
    }

    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ──── Публичное API ────
    window.AF_Cart = { openCart, closeCart, addItem, removeItem, changeQty, checkout };

})();
