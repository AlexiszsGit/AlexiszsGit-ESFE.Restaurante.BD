
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
        if (!box) return;
        box.innerHTML = state.lines.length ? state.lines.map((l,i) => `<article class="local-order-line"><div><strong>${l.qty} × ${esc(l.name)}</strong><small>${money(l.price*l.qty)}</small></div><button type="button" class="icon-btn danger-icon" onclick="ESFERestaurante.localOrders.removeLine(${i})" aria-label="Eliminar producto">×</button></article>`).join("") : `<div class="empty-state compact"><strong>Agrega productos</strong><p>La orden presencial seguirá el mismo flujo de cocina.</p></div>`;
    }

    // Procesa la información de reset.
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
        renderProducts(); renderMenuBrowser(); renderTables(); renderAttendants(); renderCustomer(); renderLines();
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

    // Muestra el formulario para capturar el pedido.
    function showOrderForm(){
        input("localOrderFormView")?.classList.remove("hidden");
        input("localPaymentView")?.classList.add("hidden");
    }
    // Muestra el formulario para procesar el pago.
    function showPaymentForm(order){
        state.pendingPaymentOrder=order;
        const form=input("localOrderFormView");
        const view=input("localPaymentView");
        if(!form || !view){
            app.ui.mostrarToast("No fue posible abrir el formulario de pago. Revisa la vista del pedido.","error");
            return false;
        }
        form.classList.add("hidden");
        view.classList.remove("hidden");
        view.setAttribute("aria-hidden","false");
        const total=input("localPaymentTotal");
        const title=input("localPaymentTitle");
        const subtitle=input("localPaymentSubtitle");
        const fields=input("localPaymentFields");
        if(!total||!title||!subtitle||!fields){
            app.ui.mostrarToast("Faltan elementos del formulario de pago.","error");
            return false;
        }
        total.textContent=money(order.total);
        title.textContent=order.payment === "Tarjeta" ? "Pago con tarjeta" : "Pago por transferencia";
        subtitle.textContent=order.payment === "Tarjeta" ? "Completa los datos de la tarjeta para registrar el cobro." : "Registra la referencia de transferencia para completar el cobro.";
        if(order.payment === "Transferencia"){
            const suggested=`TRX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
            fields.innerHTML=`<div class="local-payment-method-card"><div class="local-payment-method-head"><span class="payment-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M6 12h12M8 17h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 5h16v14H4z" stroke="currentColor" stroke-width="1.7"/></svg></span><div><span class="eyebrow">Transferencia</span><strong>Registrar referencia</strong><small>Modo demostración. No se realiza ninguna transferencia real.</small></div></div><div class="local-payment-reference"><span>Referencia sugerida</span><strong>${suggested}</strong></div><label class="field-label">Referencia de transferencia<input id="localTransferReference" type="text" maxlength="40" value="${suggested}" placeholder="TRX-2026-001245" /></label></div>`;
        } else {
            fields.innerHTML=`<div class="local-payment-card-grid"><div class="local-payment-method-card"><div class="local-payment-method-head"><span class="payment-tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M7 15h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><div><span class="eyebrow">Tarjeta</span><strong>Datos de pago</strong><small>Los datos se usan solo para esta simulación local.</small></div></div><div class="local-payment-field-grid"><label class="field-label">Nombre del titular<input id="localCardName" type="text" maxlength="60" placeholder="NOMBRE DEL TITULAR" /></label><label class="field-label">Número de tarjeta<input id="localCardNumber" type="text" maxlength="23" inputmode="numeric" placeholder="0000 0000 0000 0000" /></label><label class="field-label">Vencimiento<input id="localCardExpiry" type="text" maxlength="5" inputmode="numeric" placeholder="MM/AA" /></label><label class="field-label">CVV<input id="localCardCvv" type="password" maxlength="4" inputmode="numeric" placeholder="123" /></label></div></div><div class="local-card-preview"><span>RestauranteBD</span><strong id="localCardPreviewNumber">•••• •••• •••• ••••</strong><div><small id="localCardPreviewName">NOMBRE DEL TITULAR</small><small id="localCardPreviewExpiry">MM/AA</small></div></div></div>`;
            // Procesa la información de update.
            const update=()=>{
                const n=(input("localCardNumber")?.value||"").replace(/\D/g,"").slice(0,16); const parts=n.match(/.{1,4}/g)||[];
                if(input("localCardNumber")) input("localCardNumber").value=parts.join(" ");
                if(input("localCardPreviewNumber")) input("localCardPreviewNumber").textContent=parts.length?parts.join(" "):"•••• •••• •••• ••••";
                if(input("localCardPreviewName")) input("localCardPreviewName").textContent=(input("localCardName")?.value||"NOMBRE DEL TITULAR").toUpperCase().slice(0,24);
                if(input("localCardPreviewExpiry")) input("localCardPreviewExpiry").textContent=input("localCardExpiry")?.value||"MM/AA";
            };
            // Evento que conecta una acción del usuario con la lógica del módulo.
            input("localCardName")?.addEventListener("input",update);
            // Evento que conecta una acción del usuario con la lógica del módulo.
            input("localCardNumber")?.addEventListener("input",update);
            // Evento que conecta una acción del usuario con la lógica del módulo.
            input("localCardExpiry")?.addEventListener("input",e=>{let v=e.target.value.replace(/\D/g,"").slice(0,4);if(v.length>2)v=v.slice(0,2)+"/"+v.slice(2);e.target.value=v;update();});
            update();
        }
        requestAnimationFrame(()=>{
            view.scrollTop=0;
            view.querySelector('input,button')?.focus({preventScroll:true});
        });
        return true;
    }
    // Regresa del pago al formulario del pedido.
    function backToOrder(){ state.pendingPaymentOrder=null; showOrderForm(); }
    // Valida el número de tarjeta mediante el algoritmo de Luhn.
    function validLuhn(value){let sum=0,d=false;for(let i=value.length-1;i>=0;i--){let n=Number(value[i]);if(d){n*=2;if(n>9)n-=9;}sum+=n;d=!d;}return value.length>=13&&sum%10===0;}
    // Confirma y registra el pago del pedido.
    function confirmPayment(){
        const order=state.pendingPaymentOrder;
        if(!order){app.ui.mostrarToast("No hay un pago pendiente de confirmar.","error");return;}
        let ref="";
        if(order.payment === "Transferencia"){
            ref=(input("localTransferReference")?.value||"").trim();
            if(!/^[A-Za-z0-9-]{5,40}$/.test(ref)){app.ui.mostrarToast("Ingresa una referencia de transferencia válida.","error");return;}
        } else {
            const name=(input("localCardName")?.value||"").trim(); const number=(input("localCardNumber")?.value||"").replace(/\D/g,""); const expiry=(input("localCardExpiry")?.value||"").trim(); const cvv=(input("localCardCvv")?.value||"").replace(/\D/g,"");
            if(!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,60}$/.test(name)){app.ui.mostrarToast("Escribe el nombre del titular.","error");return;}
            if(number.length<13||number.length>19||!validLuhn(number)){app.ui.mostrarToast("El número de tarjeta no tiene un formato válido.","error");return;}
            const [mm,yy]=(expiry||"").split("/").map(Number);const now=new Date();const month=now.getMonth()+1;const year=now.getFullYear()%100;
            if(!mm||!yy||mm<1||mm>12||yy<year||(yy===year&&mm<month)){app.ui.mostrarToast("La fecha de vencimiento no es válida.","error");return;}
            if(!/^(\d{3,4})$/.test(cvv)){app.ui.mostrarToast("El CVV no tiene un formato válido.","error");return;}
            ref=`CARD-${Date.now().toString().slice(-10)}`;
        }
        const orders=JSON.parse(localStorage.getItem(app.KEY.orders)||"[]"); const target=orders.find(o=>o.id===order.id); if(!target){app.ui.mostrarToast("No se encontró el pedido para completar el pago.","error");return;}
        target.paymentStatus="Pagado"; target.paymentRef=ref; target.paymentDetail=order.payment==="Tarjeta"?"Pago con tarjeta registrado (simulación)":"Transferencia registrada (simulación)"; target.paidAt=new Date().toISOString();
        localStorage.setItem(app.KEY.orders,JSON.stringify(orders));
        const sales=JSON.parse(localStorage.getItem(app.KEY.sales)||"[]"); if(!sales.some(x=>x.id===target.id)) sales.unshift({...target,saleStatus:"Cobrado"}); localStorage.setItem(app.KEY.sales,JSON.stringify(sales));
        const invoice=app.invoices.create(target);
        if(target.customer && !String(target.customer).startsWith("presencial-")) app.addNotification(`Pago confirmado para ${target.id}.`,target.customer,{type:"factura",orderId:target.id,title:"Pago confirmado",detail:`${target.payment} · ${money(target.total)} · Factura ${invoice?.invoiceNumber||"digital"}.`,action:"invoice"});
        app.addNotification(`Pago registrado para ${target.id}.`,null,{type:"pago",orderId:target.id,title:"Pago presencial confirmado",detail:`${target.payment} · ${money(target.total)} · ${target.customerName||"Cliente"}.`,roles:["Dueno","Administrador","Barra"]});
        state.pendingPaymentOrder=null; close(); app.ui.mostrarToast(`Pago confirmado. Pedido ${target.id} finalizado.`); app.orders?.render();
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

    // Procesa la información de create.
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
        const isCashPaidNow=timing==="Pagado" && payment==="Efectivo";
        const requiresPaymentReview=timing==="Pagado" && payment!=="Efectivo";
        const assigned=attendants().find(a=>String(a.Email).toLowerCase()===attendantEmail.toLowerCase());
        const order={id,customer:registeredEmail||`presencial-${Date.now()}`,customerName:name,customerPhone:phone||state.customer?.Telefono||"",customerDui:state.customer?.Dui||"",items:state.lines.map(x=>({...x})),subtotal,tax,total,orderType:type,table:table?`Mesa ${String(table.id).padStart(2,"0")}`:"",tableId:table?.id||null,reservationId:"",payment,timing,paymentStatus:isCashPaidNow?"Pagado":"Pendiente",paymentRef:isCashPaidNow?`POS-${Date.now().toString().slice(-10)}`:"",paymentDetail:isCashPaidNow?"Pago en efectivo registrado en caja":"Pago pendiente de confirmación",status:"Pendiente",source:role(),customerType:state.customerMode === "registered" ? "Registrado" : "No registrado",date:new Date().toISOString(),deliveryPhone:type==="Domicilio"?phone:"",deliveryAddress:type==="Domicilio"?address:"",assignedAttendant:assigned?.Email||"",assignedAttendantName:assigned?.Nombre||"",people,serviceDate:date,serviceTime:time,tableZone:table?.zone||""};
        if(requiresPaymentReview){
            if(showPaymentForm({...order,paymentStatus:"Pendiente",paymentDetail:"Pago pendiente de confirmación"})) app.ui.mostrarToast("Pedido preparado. Completa el pago para finalizar.","info");
            return;
        }
        persistReservation(order);
        const orders=JSON.parse(localStorage.getItem(app.KEY.orders)||"[]"); orders.unshift(order); localStorage.setItem(app.KEY.orders,JSON.stringify(orders));
        if(isCashPaidNow){ order.paidAt=new Date().toISOString(); const sales=JSON.parse(localStorage.getItem(app.KEY.sales)||"[]"); sales.unshift({...order,saleStatus:"Cobrado"}); localStorage.setItem(app.KEY.sales,JSON.stringify(sales)); const invoice=app.invoices.create(order); app.ui.mostrarToast(`Pedido ${id} creado y pagado. Comprobante ${invoice?.invoiceNumber||'digital'} disponible.`); }
        if(registeredEmail){
            const meta=isCashPaidNow?{type:"factura",orderId:id,title:"Pedido presencial pagado",detail:`Tu pedido ${id} fue registrado en el restaurante. Total ${money(total)}. La factura digital está disponible.`,action:"invoice"}:{type:"pago",orderId:id,title:"Tienes un pago pendiente",detail:`Tu pedido ${id} fue registrado en el restaurante por ${money(total)}. Puedes abrir el pago desde allí.`,action:"payment"};
            if (typeof app.addNotification === 'function') app.addNotification(meta.detail, registeredEmail, { ...meta, fromName:"RestauranteBD · Atención", fromEmail:"notificaciones@restaurantebd.local" });
        }
        const operationalRoles = type === "Domicilio" ? ["Dueno","Administrador","Cocina","Barra","Delivery"] : ["Dueno","Administrador","Cocina","Barra"];
        if (typeof app.addNotification === 'function') app.addNotification(`Nuevo pedido presencial ${id}.`, null, {type:"pedido",orderId:id,title:"Nuevo pedido presencial",detail:`${name} · ${type} · ${money(total)} · ${order.items.length} líneas.`,roles:operationalRoles});
        app.ui.mostrarToast(isCashPaidNow?`Pedido ${id} creado y pagado.`:`Pedido ${id} creado. El cliente recibirá el aviso de pago pendiente.`);
        close(); app.orders?.render();
    }

    // Procesa la información de init.
    function init(){ if(!canOperate()){ input("openLocalOrderButton")?.remove(); return; } renderProducts(); renderTables(); renderAttendants(); renderLines();
        const productId = new URLSearchParams(window.location.search).get("localProduct");
        if (productId) { history.replaceState({}, document.title, window.location.pathname); setTimeout(() => open(productId), 0); }
        // Evento que conecta una acción del usuario con la lógica del módulo.
        const launch=input("openLocalOrderButton"); launch?.addEventListener("click",e=>{ e.preventDefault(); open(); });
        // Evento que conecta una acción del usuario con la lógica del módulo.
        input("localOrderType")?.addEventListener("change",()=>{const t=input("localOrderType").value;input("localAddress")?.closest("label")?.classList.toggle("hidden",t!=="Domicilio");renderTables();}); input("localCustomerSearch")?.addEventListener("input",renderCustomer); input("localCustomerSearch")?.addEventListener("change",renderCustomer); input("localDate")?.addEventListener("change",renderTables); input("localTime")?.addEventListener("change",renderTables); }
    app.localOrders={init,open,openFromMenu,close,addLine,removeLine,create,setCustomerMode,setMenuCategory,addProduct,backToOrder,confirmPayment};
})();
