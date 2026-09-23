
(() => {
    const app = (typeof ESFERestaurante !== "undefined" ? ESFERestaurante : window.ESFERestaurante);
    if (!app) return;
    const state = { lines: [], customer: null, customerMode: "registered", pendingPaymentOrder: null };
    // Obtiene el campo de entrada usado por el formulario.
    const input = id => document.getElementById(id);
    // Obtiene la ventana modal utilizada por el módulo.
    const modal = () => input("localOrderModal");
    // Da formato monetario a un valor antes de mostrarlo.
    const money = value => app.money(Number(value) || 0);
    // Obtiene los productos disponibles para la operación.
    const products = () => app.catalogProducts ? app.catalogProducts() : (app.products || []);
    // Obtiene el rol del usuario actual.
    const role = () => (document.body?.dataset.role || "Publico").trim();
    // Comprueba si el usuario actual puede operar este módulo.
    const canOperate = () => ["Dueno", "Administrador", "Barra"].includes(role());
    // Obtiene los clientes disponibles para seleccionar.
    const customers = () => {
        try { return JSON.parse(input("localCustomerData")?.textContent || "[]"); } catch { return []; }
    };
    // Obtiene los trabajadores disponibles para atender el pedido.
    const attendants = () => {
        try { return JSON.parse(input("localAttendantData")?.textContent || "[]"); } catch { return []; }
    };
    // Escapa caracteres especiales para insertar texto de forma segura en HTML.
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

    // Construye el texto visible del cliente seleccionado.
    const customerLabel = c => `${c.Nombre || "Cliente"} · ${c.Email || ""}`;
    // Comprueba si la mesa seleccionada está disponible para el pedido.
    const isTableAvailable = tableId => {
        const date = input("localDate")?.value || app.localDate();
        const time = input("localTime")?.value || `${String(new Date().getHours()).padStart(2,"0")}:${String(new Date().getMinutes()).padStart(2,"0")}`;
        let reservations = []; try { reservations = JSON.parse(localStorage.getItem(app.KEY.reservations) || "[]"); } catch { reservations = []; }
        return !reservations.some(r => Number(r.tableId) === Number(tableId) && r.date === date && r.time === time && r.status === "Confirmada");
    };

    // Actualiza la lista visible de productos.
    function renderProducts() {
        const select = input("localProduct"); if (!select) return;
        select.innerHTML = products().map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${money(p.price)}</option>`).join("");
    }


    let menuCategory = "Todos";
    // Actualiza el selector de categorías y productos.
    function renderMenuBrowser() {
        const grid = input("localMenuGrid");
        const categoriesBox = input("localMenuCategories");
        if (!grid || !categoriesBox) return;
        const all = products();
        const categories = ["Todos", ...Array.from(new Set(all.map(p => p.cat).filter(Boolean)))];
        if (!categories.includes(menuCategory)) menuCategory = "Todos";
        const query = (input("localMenuSearch")?.value || "").trim().toLowerCase();
        categoriesBox.innerHTML = categories.map(category => `<button type="button" class="${category === menuCategory ? "active" : ""}" aria-selected="${category === menuCategory}" onclick="ESFERestaurante.localOrders.setMenuCategory('${esc(category)}')">${esc(category)}</button>`).join("");
        const visible = all.filter(p => (menuCategory === "Todos" || p.cat === menuCategory) && (!query || `${p.name} ${p.cat} ${p.desc} ${(p.ingredients || []).join(" ")}`.toLowerCase().includes(query)));
        if (!visible.length) {
            grid.innerHTML = `<div class="empty-state compact" style="grid-column:1/-1"><strong>No encontramos ese producto</strong><p>Prueba con otro término o cambia la categoría.</p></div>`;
            return;
        }
        grid.innerHTML = visible.map(p => `<article class="local-menu-item"><div class="local-menu-item-image"><img src="${esc(p.image || "")}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('image-missing')" /></div><div class="local-menu-item-copy"><span class="category">${esc(p.cat || "Producto")}</span><strong>${esc(p.name)}</strong><p>${esc(p.desc || "Producto del menú")}</p><div class="local-menu-item-bottom"><strong>${money(p.price)}</strong><button type="button" onclick="ESFERestaurante.localOrders.addProduct('${esc(p.id)}')">Agregar</button></div></div></article>`).join("");
    }
    // Cambia la categoría activa del menú.
    function setMenuCategory(category) { menuCategory = category || "Todos"; renderMenuBrowser(); }
    // Agrega un producto al pedido actual.
    function addProduct(productId) {
        const p = products().find(x => String(x.id) === String(productId));
        const q = Number(input("localQuantity")?.value || 1);
        if (!p || !Number.isInteger(q) || q < 1 || q > 20) { app.ui.mostrarToast("Selecciona una cantidad válida.", "error"); return; }
        const old = state.lines.find(x => x.id === p.id);
        if (old) old.qty = Math.min(20, old.qty + q);
        else state.lines.push({ id:p.id, name:p.name, price:Number(p.price)||0, qty:q });
        const select = input("localProduct"); if (select) select.value = p.id;
        renderLines();
        app.ui.mostrarToast(`${q} × ${p.name} agregado al pedido.`, "success");
    }

    // Actualiza la lista de mesas disponibles.
    function renderTables() {
        const select = input("localTable"); if (!select) return;
        const type = input("localOrderType")?.value || "Consumo en restaurante";
        select.disabled = type !== "Consumo en restaurante";
        if (type !== "Consumo en restaurante") { select.innerHTML = `<option value="">No requiere mesa</option>`; return; }
        const current = select.value;
        select.innerHTML = (app.tables || []).map(t => `<option value="${t.id}" ${isTableAvailable(t.id) ? "" : "disabled"}>Mesa ${String(t.id).padStart(2,"0")} · ${t.seats} personas${isTableAvailable(t.id) ? "" : " · OCUPADA"}</option>`).join("");
        if (current && !select.querySelector(`option[value="${current}"]`)?.disabled) select.value = current;
    }

    // Actualiza la lista de responsables disponibles.
    function renderAttendants() {
        const select = input("localAttendant"); if (!select) return;
        select.innerHTML = `<option value="">Asignación automática / sin mesero</option>` + attendants().map(a => `<option value="${esc(a.Email)}">${esc(a.Nombre)} · ${esc(a.Rol)}</option>`).join("");
    }

    // Actualiza los datos visibles del cliente seleccionado.
    function renderCustomer() {
        const mode = state.customerMode || "registered";
        const search = input("localCustomerSearch");
        const registeredFields = input("registeredCustomerFields");
        const walkInNotice = input("walkInCustomerNotice");
        const registeredBtn = input("registeredCustomerMode");
        const walkInBtn = input("walkInCustomerMode");
        const policy = input("localCustomerPolicy");
        if (registeredFields) registeredFields.classList.toggle("hidden", mode !== "registered");
        if (walkInNotice) walkInNotice.classList.toggle("hidden", mode !== "walkin");
        if (registeredBtn) registeredBtn.classList.toggle("active", mode === "registered");
        if (walkInBtn) walkInBtn.classList.toggle("active", mode === "walkin");
        if (policy) policy.innerHTML = mode === "registered"
            ? `<strong>Cuenta registrada</strong><span>Recibirá la factura y las notificaciones que correspondan a este pedido.</span>`
            : `<strong>Cliente no registrado</strong><span>El pedido se procesa completamente de forma local. El comprobante queda asociado al pedido y no se intenta enviar información a una cuenta.</span>`;

        if (mode === "walkin") {
            state.customer = null;
            if (search) search.value = "";
            const preview = input("localCustomerPreview");
            if (preview) preview.innerHTML = `<span class="status-pill warning">Cliente no registrado</span><strong>Pedido local</strong><small>Completa el nombre y, si el cliente lo proporciona, su teléfono.</small>`;
            return;
        }

        const query = (search?.value || "").trim().toLowerCase();
        const list = customers();
        state.customer = query ? (list.find(c => [c.Email,c.Nombre,c.Telefono,c.Dui].filter(Boolean).some(v => String(v).toLowerCase().includes(query))) || null) : null;
        const preview = input("localCustomerPreview");
        if (state.customer) {
            input("localCustomerName").value = state.customer.Nombre || "";
            input("localCustomerPhone").value = state.customer.Telefono || "";
            preview.innerHTML = `<span class="status-pill success">Cuenta registrada</span><strong>${esc(state.customer.Nombre)}</strong><small>${esc(state.customer.Email)} · ${esc(state.customer.Telefono || "Sin teléfono")}</small>`;
        } else if (query) {
            preview.innerHTML = `<span class="status-pill warning">Sin coincidencia</span><strong>Cliente no encontrado</strong><small>Si no tiene cuenta, cambia a “Cliente no registrado” para continuar sin crear una cuenta.</small>`;
        } else {
            preview.innerHTML = `<span>Sin cliente seleccionado</span><strong>Busca por nombre, correo, teléfono o DUI.</strong><small>Después de seleccionar el cliente podrás completar el pedido local.</small>`;
        }
    }

    // Cambia entre cliente registrado y cliente no registrado.
    function setCustomerMode(mode) {
        state.customerMode = mode === "walkin" ? "walkin" : "registered";
        if (state.customerMode === "walkin") state.customer = null;
        renderCustomer();
        if (state.customerMode === "registered") input("localCustomerSearch")?.focus();
        else input("localCustomerName")?.focus();
    }

    // Actualiza las líneas y el total del pedido.
    function renderLines() {
        const box = input("localOrderLines");
        const total = state.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
        if (input("localOrderSubtotal")) input("localOrderSubtotal").textContent = money(total);
        if (input("localOrderTax")) input("localOrderTax").textContent = money(total * Math.max(0,Number(document.body?.dataset?.tax||13))/100);
        if (input("localOrderTotal")) input("localOrderTotal").textContent = money(total * (1+Math.max(0,Number(document.body?.dataset?.tax||13))/100));
        if (input("localOrderTotalMirror")) input("localOrderTotalMirror").textContent = money(total * (1+Math.max(0,Number(document.body?.dataset?.tax||13))/100));
        if (input("localPaymentTiming")?.value === "Pagado") renderImmediatePaymentFields();
        if (!box) return;
        box.innerHTML = state.lines.length ? state.lines.map((l,i) => `<article class="local-order-line"><div><strong>${l.qty} × ${esc(l.name)}</strong><small>${money(l.price*l.qty)}</small></div><button type="button" class="icon-btn danger-icon" onclick="ESFERestaurante.localOrders.removeLine(${i})" aria-label="Eliminar producto">×</button></article>`).join("") : `<div class="empty-state compact"><strong>Agrega productos</strong><p>La orden presencial seguirá el mismo flujo de cocina.</p></div>`;
    }

    // Restablece los datos del formulario.
    function reset() {
        state.lines = []; state.customer = null; state.customerMode = "registered";
        ["localCustomerSearch","localCustomerName","localCustomerPhone","localDate","localTime","localAddress"].forEach(id => { const e=input(id); if(e)e.value=""; });
        if(input("localQuantity")) input("localQuantity").value="1";
        if(input("localOrderType")) input("localOrderType").value="Consumo en restaurante";
        if(input("localPaymentTiming")) input("localPaymentTiming").value="Pendiente";
        if(input("localPayment")) input("localPayment").value="Efectivo";
        const now=new Date();
        if(input("localDate")) { input("localDate").value=app.localDate(now); input("localDate").min=app.localDate(now); }
        if(input("localTime")) input("localTime").value=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
        if(input("localPeople")) input("localPeople").value="2";
        renderProducts(); renderMenuBrowser(); renderTables(); renderAttendants(); renderCustomer(); renderLines(); setPaymentMethod("Efectivo"); setPaymentTiming("Pendiente");
    }

    // Abre el formulario o módulo correspondiente.
    function open(productId = null, initialQty = 1) {
        if(!canOperate()){app.ui.mostrarToast("No tienes permiso para registrar pedidos presenciales.","error");return;}
        reset();
        modal()?.classList.remove("hidden");
        if (productId) {
            const p = products().find(x => String(x.id) === String(productId));
            if (p) {
                const qty = Number(initialQty);
                state.lines.push({id:p.id,name:p.name,price:Number(p.price)||0,qty:Number.isInteger(qty) ? Math.min(20, Math.max(1, qty)) : 1});
                renderLines();
                app.ui.mostrarToast(`${p.name} seleccionado. Ahora busca o registra al cliente.`,'info');
            }
        }
        input("localCustomerSearch")?.focus();
    }

    // Abre el pedido desde el producto seleccionado en el menú.
    function openFromMenu(productId, initialQty = 1) { open(productId, initialQty); }
    // Cierra el formulario o módulo actualmente abierto.
    function close(){ const m=modal(); if(!m)return; m.classList.add("hidden"); showOrderForm(); state.pendingPaymentOrder=null; }
    // Agrega una línea de producto al pedido.
    function addLine(){ const p=products().find(x=>x.id===input("localProduct")?.value), q=Number(input("localQuantity")?.value||1); if(!p||!Number.isInteger(q)||q<1||q>20){app.ui.mostrarToast("Producto o cantidad inválidos.","error");return;} const old=state.lines.find(x=>x.id===p.id); if(old) old.qty=Math.min(20,old.qty+q); else state.lines.push({id:p.id,name:p.name,price:Number(p.price)||0,qty:q}); renderLines(); }
    // Elimina una línea de producto del pedido.
    function removeLine(i){ state.lines.splice(i,1); renderLines(); }

    // Muestra u oculta el bloque de pago inmediato.
    function showOrderForm() {
        input("localImmediatePayment")?.classList.add("hidden");
        input("localPaymentFields")?.replaceChildren();
        state.pendingPaymentOrder = null;
    }

    // Activa el método de pago que eligió el encargado.
    function setPaymentMethod(method) {
        const select = input("localPayment");
        if (!select) return;
        select.value = ["Efectivo", "Tarjeta", "Transferencia"].includes(method) ? method : "Efectivo";
        document.querySelectorAll("[data-payment-method]").forEach(button => button.classList.toggle("active", button.dataset.paymentMethod === select.value));
        renderImmediatePaymentFields();
    }

    // Cambia entre cobrar ahora y dejar el pago pendiente.
    function setPaymentTiming(timing) {
        const select = input("localPaymentTiming");
        if (!select) return;
        select.value = timing === "Pagado" ? "Pagado" : "Pendiente";
        document.querySelectorAll("[data-payment-timing]").forEach(button => button.classList.toggle("active", button.dataset.paymentTiming === select.value));
        updateCreateButtonLabel();
        renderImmediatePaymentFields();
    }

    // Cambia el texto principal según el estado del cobro.
    function updateCreateButtonLabel() {
        const label = document.querySelector("[data-order-submit-label]");
        if (label) label.textContent = input("localPaymentTiming")?.value === "Pagado" ? "Crear pedido y registrar pago" : "Crear pedido presencial";
    }

    // Muestra los campos que corresponden al método de pago elegido.
    function renderImmediatePaymentFields() {
        const box = input("localImmediatePayment");
        const fields = input("localPaymentFields");
        const timing = input("localPaymentTiming")?.value || "Pendiente";
        const payment = input("localPayment")?.value || "Efectivo";
        if (!box || !fields) return;

        updateCreateButtonLabel();

        if (timing !== "Pagado") {
            box.classList.add("hidden");
            fields.replaceChildren();
            return;
        }

        box.classList.remove("hidden");
        const total = input("localOrderTotalMirror")?.textContent || money(0);

        if (payment === "Efectivo") {
            fields.innerHTML = `
                <div class="local-payment-method-card compact">
                    <div class="local-payment-method-head">
                        <span class="payment-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 9.5h9M7.5 14.5h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>
                        <div><span class="eyebrow">Efectivo</span><strong>Confirmar cobro en caja</strong><small>El total ya está calculado. Solo confirma que recibiste el importe completo.</small></div>
                    </div>
                    <div class="local-payment-due"><span>Total a cobrar</span><strong>${total}</strong></div>
                    <label class="local-payment-confirm"><input id="localCashConfirmed" type="checkbox" /> <span>Confirmo que recibí el pago completo</span></label>
                </div>`;
            input("localCashConfirmed")?.focus({ preventScroll: true });
            return;
        }

        if (payment === "Tarjeta") {
            fields.innerHTML = `
                <div class="local-payment-method-card premium compact">
                    <div class="local-payment-method-head">
                        <span class="payment-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M7 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>
                        <div><span class="eyebrow">Tarjeta</span><strong>Procesar cobro con POS</strong><small>El sistema toma el total del pedido automáticamente. Los datos completos solo se usan durante esta operación.</small></div>
                    </div>
                    <div class="local-payment-due"><span>Total a cobrar</span><strong>${total}</strong></div>
                    <div class="local-card-preview" aria-hidden="true">
                        <div class="local-card-preview-top"><span>RESTAURANTEBd</span><span>VISA / MASTERCARD</span></div>
                        <strong class="local-card-preview-number" id="localCardPreviewNumber">•••• •••• •••• ••••</strong>
                        <div class="local-card-preview-bottom"><span><small>TITULAR</small><b id="localCardPreviewName">NOMBRE DEL TITULAR</b></span><span><small>VENCE</small><b id="localCardPreviewExpiry">MM/AA</b></span></div>
                    </div>
                    <div class="local-payment-field-grid local-card-fields-grid">
                        <label class="field-label local-payment-wide-field">Nombre del titular<input id="localCardName" type="text" maxlength="60" placeholder="Nombre como aparece en la tarjeta" autocomplete="cc-name" /></label>
                        <label class="field-label local-payment-wide-field">Número de tarjeta<input id="localCardNumber" type="text" maxlength="23" inputmode="numeric" placeholder="0000 0000 0000 0000" autocomplete="cc-number" /></label>
                        <label class="field-label">Vencimiento<input id="localCardExpiry" type="text" maxlength="5" inputmode="numeric" placeholder="MM/AA" autocomplete="cc-exp" /></label>
                        <label class="field-label">CVV<input id="localCardCvv" type="password" maxlength="4" inputmode="numeric" placeholder="123" autocomplete="cc-csc" /></label>
                        <label class="field-label local-payment-wide-field">Referencia / autorización <span class="field-optional">Opcional</span><input id="localCardReference" type="text" maxlength="40" placeholder="Autorización del POS" autocomplete="off" /></label>
                    </div>
                    <div class="local-card-security-note"><span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 10V7.7a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span><span>Los datos completos de la tarjeta no se guardan en el pedido. Solo queda la referencia del cobro y los últimos 4 dígitos.</span></div>
                </div>`;

            const name = input("localCardName");
            const number = input("localCardNumber");
            const expiry = input("localCardExpiry");
            const previewNumber = input("localCardPreviewNumber");
            const previewName = input("localCardPreviewName");
            const previewExpiry = input("localCardPreviewExpiry");

            const syncCardPreview = () => {
                if (number) {
                    const digits = number.value.replace(/\D/g, "").slice(0, 19);
                    number.value = digits.replace(/(.{4})/g, "$1 ").trim();
                    if (previewNumber) previewNumber.textContent = digits ? digits.replace(/\d(?=\d{4})/g, "•").replace(/(.{4})/g, "$1 ").trim() : "•••• •••• •••• ••••";
                }
                if (previewName) previewName.textContent = (name?.value || "").trim().toUpperCase() || "NOMBRE DEL TITULAR";
                if (expiry) {
                    const digits = expiry.value.replace(/\D/g, "").slice(0, 4);
                    expiry.value = digits.length > 2 ? `${digits.slice(0,2)}/${digits.slice(2)}` : digits;
                    if (previewExpiry) previewExpiry.textContent = expiry.value || "MM/AA";
                }
            };

            [name, number, expiry].forEach(node => node?.addEventListener("input", syncCardPreview));
            input("localCardCvv")?.addEventListener("input", event => { event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4); });
            syncCardPreview();
            number?.focus({ preventScroll: true });
            return;
        }

        const suggested = `TRX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        fields.innerHTML = `
            <div class="local-payment-method-card compact">
                <div class="local-payment-method-head">
                    <span class="payment-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4.5" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>
                    <div><span class="eyebrow">Transferencia</span><strong>Registrar transferencia</strong><small>El total es ${total}. Guarda el banco y la referencia que entregue el cliente.</small></div>
                </div>
                <div class="local-payment-due"><span>Total a cobrar</span><strong>${total}</strong></div>
                <div class="local-payment-reference"><span>Referencia sugerida</span><strong>${suggested}</strong></div>
                <div class="local-payment-field-grid">
                    <label class="field-label">Banco / entidad<input id="localTransferBank" type="text" maxlength="80" placeholder="Nombre del banco" /></label>
                    <label class="field-label">Referencia<input id="localTransferReference" type="text" maxlength="40" value="${suggested}" placeholder="TRX-2026-001245" /></label>
                </div>
            </div>`;
        input("localTransferReference")?.focus({ preventScroll: true });
    }

    // Valida y recoge únicamente la información necesaria para el cobro inmediato.
    function collectImmediatePayment(total, payment) {
        if (payment === "Efectivo") {
            if (!input("localCashConfirmed")?.checked) {
                app.ui.mostrarToast(`Confirma que recibiste el total de ${money(total)}.`, "error");
                return null;
            }
            return { ref: `CASH-${Date.now().toString().slice(-10)}`, detail: `Pago en efectivo confirmado por ${money(total)}` };
        }

        if (payment === "Transferencia") {
            const bank = (input("localTransferBank")?.value || "").trim();
            const ref = (input("localTransferReference")?.value || "").trim();
            if (bank.length < 2) { app.ui.mostrarToast("Escribe el banco o entidad de la transferencia.", "error"); return null; }
            if (!/^[A-Za-z0-9-]{5,40}$/.test(ref)) { app.ui.mostrarToast("Ingresa una referencia de transferencia válida.", "error"); return null; }
            return { ref, detail: `Transferencia registrada · ${bank}` };
        }

        const name = (input("localCardName")?.value || "").trim();
        const number = (input("localCardNumber")?.value || "").replace(/\D/g, "");
        const expiry = (input("localCardExpiry")?.value || "").trim();
        const cvv = (input("localCardCvv")?.value || "").replace(/\D/g, "");
        const ref = (input("localCardReference")?.value || "").trim();
        if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,60}$/.test(name)) { app.ui.mostrarToast("Escribe el nombre del titular.", "error"); return null; }
        if (!/^\d{13,19}$/.test(number)) { app.ui.mostrarToast("Escribe un número de tarjeta válido.", "error"); return null; }
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) { app.ui.mostrarToast("Escribe el vencimiento en formato MM/AA.", "error"); return null; }
        if (!/^\d{3,4}$/.test(cvv)) { app.ui.mostrarToast("Escribe el CVV de la tarjeta.", "error"); return null; }
        const month = Number(expiry.slice(0, 2));
        const year = 2000 + Number(expiry.slice(3, 5));
        const now = new Date();
        const expiresAt = new Date(year, month);
        if (expiresAt <= now) { app.ui.mostrarToast("La tarjeta está vencida.", "error"); return null; }
        const last4 = number.slice(-4);
        const authorization = ref || `POS-${Date.now().toString().slice(-10)}`;
        return { ref: `CARD-${authorization}`, detail: `Pago con tarjeta registrado · **** ${last4}` };
    }

    // Mantiene compatibilidad con el flujo anterior si otra parte del proyecto lo utiliza.
    function showPaymentForm(order) {
        state.pendingPaymentOrder = order;
        if (input("localPayment")) input("localPayment").value = order.payment || "Efectivo";
        if (input("localPaymentTiming")) input("localPaymentTiming").value = "Pagado";
        renderImmediatePaymentFields();
        return true;
    }

    // Regresa al formulario del pedido y limpia los datos temporales del pago.
    function backToOrder() {
        showOrderForm();
    }

    // Confirma un pago que haya quedado pendiente en el flujo anterior.
    function confirmPayment() {
        const order = state.pendingPaymentOrder;
        if (!order) { app.ui.mostrarToast("No hay un pago pendiente de confirmar.", "error"); return; }
        const data = collectImmediatePayment(Number(order.total)||0, order.payment || "Efectivo");
        if (!data) return;
        const orders = JSON.parse(localStorage.getItem(app.KEY.orders)||"[]");
        const target = orders.find(o => o.id === order.id);
        if (!target) { app.ui.mostrarToast("No se encontró el pedido para completar el pago.", "error"); return; }
        target.paymentStatus = "Pagado"; target.paymentRef = data.ref; target.paymentDetail = data.detail; target.paidAt = new Date().toISOString();
        localStorage.setItem(app.KEY.orders, JSON.stringify(orders));
        const sales = JSON.parse(localStorage.getItem(app.KEY.sales)||"[]");
        if (!sales.some(x => x.id === target.id)) sales.unshift({...target, saleStatus:"Cobrado"});
        localStorage.setItem(app.KEY.sales, JSON.stringify(sales));
        const invoice = app.invoices.create(target);
        if(target.customer && !String(target.customer).startsWith("presencial-")) app.addNotification(`Pago confirmado para ${target.id}.`,target.customer,{type:"factura",orderId:target.id,title:"Pago confirmado",detail:`${target.payment} · ${money(target.total)} · Factura ${invoice?.invoiceNumber||"digital"}.`,action:"invoice"});
        app.addNotification(`Pago registrado para ${target.id}.`,null,{type:"pago",orderId:target.id,title:"Pago presencial confirmado",detail:`${target.payment} · ${money(target.total)} · ${target.customerName||"Cliente"}.`,roles:["Dueno","Administrador","Barra"]});
        close(); app.ui.mostrarToast(`Pago confirmado. Pedido ${target.id} finalizado.`); app.orders?.render();
    }

    // Guarda la reserva para mantenerla disponible después de recargar.
    function persistReservation(order){
        if(!order.tableId || order.orderType!=="Consumo en restaurante" || order.reservationId) return;
        try{
            const reservations=JSON.parse(localStorage.getItem(app.KEY.reservations)||"[]");
            const reservation={id:`RES-${Date.now().toString(36).toUpperCase()}`,customer:order.customer,customerName:order.customerName,customerPhone:order.customerPhone,customerDui:order.customerDui,tableId:order.tableId,table:order.table, name:order.customerName,people:order.people||1,date:order.serviceDate||app.localDate(),time:order.serviceTime||"",zone:order.tableZone||"",status:"Confirmada",arrived:true,arrivalAt:new Date().toISOString(),createdAt:new Date().toISOString(),origin:"Pedido presencial",orderId:order.id};
            reservations.push(reservation); localStorage.setItem(app.KEY.reservations,JSON.stringify(reservations));
            order.reservationId=reservation.id;
        }catch{}
    }

    // Crea el registro solicitado.
    function create(){
        if(!canOperate()) return;
        const name=input("localCustomerName")?.value.trim() || "Cliente presencial";
        const phone=input("localCustomerPhone")?.value.trim() || "";
        const type=input("localOrderType")?.value || "Consumo en restaurante";
        const tableId=Number(input("localTable")?.value || 0);
        const date=input("localDate")?.value || app.localDate();
        const time=input("localTime")?.value || "";
        const people=Number(input("localPeople")?.value || 0);
        const payment=input("localPayment")?.value || "Efectivo";
        const timing=input("localPaymentTiming")?.value || "Pendiente";
        const attendantEmail=input("localAttendant")?.value || "";
        const address=input("localAddress")?.value.trim() || "";
        const table=(app.tables||[]).find(t=>t.id===tableId);
        if(!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,80}$/.test(name)){app.ui.mostrarToast("Escribe un nombre válido.","error");return;}
        if(phone && !/^\+\d{1,3}\s\d{7,15}$|^\d{4}-\d{4}$/.test(phone)){app.ui.mostrarToast("El teléfono no tiene un formato válido.","error");return;}
        if(!state.lines.length){app.ui.mostrarToast("Agrega al menos un producto.","error");return;}
        if(type==="Consumo en restaurante"){
            if(!table || !isTableAvailable(table.id)){app.ui.mostrarToast("La mesa elegida ya está ocupada para ese horario.","error");renderTables();return;}
            if(!Number.isInteger(people)||people<1||people>table.seats){app.ui.mostrarToast(`La mesa seleccionada admite hasta ${table.seats} personas.`,"error");return;}
        }
        if(type==="Domicilio" && address.length<5){app.ui.mostrarToast("Escribe la dirección de entrega.","error");return;}
        const subtotal=Number(state.lines.reduce((s,l)=>s+l.price*l.qty,0).toFixed(2)), taxRate=Math.max(0,Number(document.body?.dataset?.tax||13))/100, tax=Number((subtotal*taxRate).toFixed(2)), total=Number((subtotal+tax).toFixed(2));
        const registeredEmail=state.customerMode === "registered" ? (state.customer?.Email || "") : "";
        if (state.customerMode === "registered" && !state.customer) { app.ui.mostrarToast("Selecciona un cliente registrado o cambia a Cliente no registrado.","error"); return; }
        if (state.customerMode === "walkin" && !input("localCustomerName")?.value.trim()) { app.ui.mostrarToast("Escribe el nombre del cliente no registrado.","error"); return; }
        const id=`POS-${Date.now().toString(36).toUpperCase()}`;
        const isPaidNow = timing === "Pagado";
        const paymentData = isPaidNow ? collectImmediatePayment(total, payment) : null;
        if (isPaidNow && !paymentData) {
            renderImmediatePaymentFields();
            return;
        }
        const assigned=attendants().find(a=>String(a.Email).toLowerCase()===attendantEmail.toLowerCase());
        const order={id,customer:registeredEmail||`presencial-${Date.now()}`,customerName:name,customerPhone:phone||state.customer?.Telefono||"",customerDui:state.customer?.Dui||"",items:state.lines.map(x=>({...x})),subtotal,tax,total,orderType:type,table:table?`Mesa ${String(table.id).padStart(2,"0")}`:"",tableId:table?.id||null,reservationId:"",payment,timing,paymentStatus:isPaidNow?"Pagado":"Pendiente",paymentRef:paymentData?.ref||"",paymentDetail:isPaidNow?paymentData.detail:"Pago pendiente de confirmación",status:"Pendiente",source:role(),customerType:state.customerMode === "registered" ? "Registrado" : "No registrado",date:new Date().toISOString(),deliveryPhone:type==="Domicilio"?phone:"",deliveryAddress:type==="Domicilio"?address:"",assignedAttendant:assigned?.Email||"",assignedAttendantName:assigned?.Nombre||"",people,serviceDate:date,serviceTime:time,tableZone:table?.zone||""};
        persistReservation(order);
        const orders=JSON.parse(localStorage.getItem(app.KEY.orders)||"[]"); orders.unshift(order); localStorage.setItem(app.KEY.orders,JSON.stringify(orders));
        if(isPaidNow){ order.paidAt=new Date().toISOString(); const sales=JSON.parse(localStorage.getItem(app.KEY.sales)||"[]"); if(!sales.some(x=>x.id===order.id)) sales.unshift({...order,saleStatus:"Cobrado"}); localStorage.setItem(app.KEY.sales,JSON.stringify(sales)); const invoice=app.invoices.create(order); app.ui.mostrarToast(`Pedido ${id} creado y pagado. Comprobante ${invoice?.invoiceNumber||'digital'} disponible.`); }
        if(registeredEmail){
            const meta=isPaidNow?{type:"factura",orderId:id,title:"Pedido presencial pagado",detail:`Tu pedido ${id} fue registrado en el restaurante. Total ${money(total)}. La factura digital está disponible.`,action:"invoice"}:{type:"pago",orderId:id,title:"Tienes un pago pendiente",detail:`Tu pedido ${id} fue registrado en el restaurante por ${money(total)}. Puedes abrir el pago desde allí.`,action:"payment"};
            if (typeof app.addNotification === 'function') app.addNotification(meta.detail, registeredEmail, { ...meta, fromName:"RestauranteBD · Atención", fromEmail:"notificaciones@restaurantebd.local" });
        }
        const operationalRoles = type === "Domicilio" ? ["Dueno","Administrador","Cocina","Barra","Delivery"] : ["Dueno","Administrador","Cocina","Barra"];
        if (typeof app.addNotification === 'function') app.addNotification(`Nuevo pedido presencial ${id}.`, null, {type:"pedido",orderId:id,title:"Nuevo pedido presencial",detail:`${name} · ${type} · ${money(total)} · ${order.items.length} líneas.`,roles:operationalRoles});
        app.ui.mostrarToast(isPaidNow?`Pedido ${id} creado y pagado.`:`Pedido ${id} creado. El cliente recibirá el aviso de pago pendiente.`);
        close(); app.orders?.render();
    }

    // Prepara el módulo cuando se abre la pantalla.
    function init(){ if(!canOperate()){ input("openLocalOrderButton")?.remove(); return; } renderProducts(); renderTables(); renderAttendants(); renderLines();
        const productId = new URLSearchParams(window.location.search).get("localProduct");
        if (productId) { history.replaceState({}, document.title, window.location.pathname); setTimeout(() => open(productId), 0); }
        // Evento que conecta una acción del usuario con la lógica del módulo.
        const launch=input("openLocalOrderButton"); launch?.addEventListener("click",e=>{ e.preventDefault(); open(); });
        // Evento que conecta una acción del usuario con la lógica del módulo.
        input("localOrderType")?.addEventListener("change",()=>{const t=input("localOrderType").value;input("localAddress")?.closest("label")?.classList.toggle("hidden",t!=="Domicilio");renderTables();}); input("localCustomerSearch")?.addEventListener("input",renderCustomer); input("localCustomerSearch")?.addEventListener("change",renderCustomer); input("localDate")?.addEventListener("change",renderTables); input("localTime")?.addEventListener("change",renderTables);
        document.querySelectorAll("[data-payment-method]").forEach(button => button.addEventListener("click", () => setPaymentMethod(button.dataset.paymentMethod)));
        document.querySelectorAll("[data-payment-timing]").forEach(button => button.addEventListener("click", () => setPaymentTiming(button.dataset.paymentTiming)));
        input("localPaymentTiming")?.addEventListener("change",renderImmediatePaymentFields);
        input("localPayment")?.addEventListener("change",()=>setPaymentMethod(input("localPayment").value));
        updateCreateButtonLabel();
    }
    app.localOrders={init,open,openFromMenu,close,addLine,removeLine,create,setCustomerMode,setMenuCategory,addProduct,backToOrder,confirmPayment,setPaymentMethod,setPaymentTiming};
})();
