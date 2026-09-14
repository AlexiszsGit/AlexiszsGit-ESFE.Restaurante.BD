(() => {
    if (!window.ESFERestaurante) {
        return;
    }

    const app = ESFERestaurante;
    const state = {
        lines: []
    };

    const modal = () => document.getElementById("localOrderModal");
    const input = id => document.getElementById(id);
    const money = value => app.money(Number(value) || 0);
    const products = () => app.products || [];

    const canOperate = () => {
        const role = document.body?.dataset.role || "Publico";
        return role === "Dueno" || role === "Barra";
    };

    const renderProducts = () => {
        const select = input("localProduct");
        if (!select) {
            return;
        }

        select.innerHTML = products()
            .map(product => `<option value="${product.id}">${product.name} · ${money(product.price)}</option>`)
            .join("");
    };

    const renderLines = () => {
        const container = input("localOrderLines");
        const total = state.lines.reduce((sum, line) => sum + line.price * line.qty, 0);

        if (input("localOrderTotal")) {
            input("localOrderTotal").textContent = money(total);
        }

        if (!container) {
            return;
        }

        if (!state.lines.length) {
            container.innerHTML = `
                <div class="empty-state compact">
                    <span class="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></span>
                    <strong>Agrega productos</strong>
                    <p>El pedido presencial aparecerá aquí.</p>
                </div>`;
            return;
        }

        container.innerHTML = state.lines.map((line, index) => `
            <article class="local-order-line">
                <div>
                    <strong>${line.qty} × ${line.name}</strong>
                    <small>${money(line.price * line.qty)}</small>
                </div>
                <button type="button" class="icon-btn danger-icon" aria-label="Eliminar producto" onclick="ESFERestaurante.localOrders.removeLine(${index})" aria-label="Eliminar producto"><span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></span></button>
            </article>
        `).join("");
    };

    const reset = () => {
        state.lines = [];
        ["localCustomerName", "localCustomerPhone", "localTable"].forEach(id => {
            const element = input(id);
            if (element) {
                element.value = "";
            }
        });
        const quantity = input("localQuantity");
        if (quantity) {
            quantity.value = "1";
        }
        renderProducts();
        renderLines();
    };

    const init = () => {
        if (!canOperate()) {
            const button = input("openLocalOrderButton");
            if (button) {
                button.remove();
            }
            return;
        }

        renderProducts();
        renderLines();
    };

    const open = () => {
        if (!canOperate()) {
            app.ui.mostrarToast("Solo Barra o Administrador pueden registrar pedidos presenciales.", "error");
            return;
        }
        reset();
        modal()?.classList.remove("hidden");
        input("localCustomerName")?.focus();
    };

    const close = () => {
        modal()?.classList.add("hidden");
    };

    const addLine = () => {
        const product = products().find(item => item.id === input("localProduct")?.value);
        const quantity = Number(input("localQuantity")?.value || 1);

        if (!product) {
            app.ui.mostrarToast("Selecciona un producto válido.", "error");
            return;
        }

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
            app.ui.mostrarToast("La cantidad debe ser un número entero entre 1 y 20.", "error");
            return;
        }

        const existing = state.lines.find(line => line.id === product.id);
        if (existing) {
            existing.qty = Math.min(20, existing.qty + quantity);
        } else {
            state.lines.push({
                id: product.id,
                name: product.name,
                price: Number(product.price),
                qty: quantity
            });
        }

        renderLines();
    };

    const removeLine = index => {
        state.lines.splice(index, 1);
        renderLines();
    };

    const create = () => {
        if (!canOperate()) {
            app.ui.mostrarToast("No tienes permiso para registrar pedidos presenciales.", "error");
            return;
        }

        const name = input("localCustomerName")?.value.trim() || "Cliente presencial";
        const phone = input("localCustomerPhone")?.value.trim() || "";
        const type = input("localOrderType")?.value || "Consumo en restaurante";
        const table = input("localTable")?.value.trim() || "";
        const payment = input("localPayment")?.value || "Efectivo";

        if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,80}$/.test(name)) {
            app.ui.mostrarToast("Escribe un nombre válido usando únicamente letras y espacios.", "error");
            return;
        }

        if (phone && !/^\d{4}-\d{4}$/.test(phone)) {
            app.ui.mostrarToast("El teléfono debe tener el formato 0000-0000.", "error");
            return;
        }

        if (type === "Consumo en restaurante" && (!/^\d+$/.test(table) || Number(table) < 1)) {
            app.ui.mostrarToast("Indica el número de mesa para el consumo en restaurante.", "error");
            return;
        }

        if (!state.lines.length) {
            app.ui.mostrarToast("Agrega al menos un producto al pedido.", "error");
            return;
        }

        const subtotal = state.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
        const tax = subtotal * 0.13;
        const total = subtotal + tax;
        const orderId = `POS-${Date.now().toString(36).toUpperCase()}`;
        const order = {
            id: orderId,
            customer: `presencial-${Date.now()}`,
            customerName: name,
            customerPhone: phone,
            customerDui: "",
            items: state.lines.map(line => ({ ...line })),
            subtotal,
            tax,
            total,
            orderType: type,
            table: table ? `Mesa ${table}` : "",
            payment,
            paymentStatus: payment === "Efectivo" ? "Pendiente" : "Pagado",
            status: "Pendiente",
            source: "Barra",
            date: new Date().toISOString()
        };

        const key = app.KEY?.orders || "esfe_pedidos";
        let orders = [];
        try {
            orders = JSON.parse(localStorage.getItem(key) || "[]");
        } catch {
            orders = [];
        }

        orders.unshift(order);
        localStorage.setItem(key, JSON.stringify(orders));

        app.ui.mostrarToast(`Pedido ${orderId} creado y enviado a cocina.`, "success");
        close();
        app.orders?.render();
    };

    app.localOrders = {
        init,
        open,
        close,
        addLine,
        removeLine,
        create
    };
})();
