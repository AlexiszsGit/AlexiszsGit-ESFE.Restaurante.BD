
(() => {
    if (!window.ESFERestaurante) return;
    const app = ESFERestaurante;
    // Lee los datos guardados del módulo.
    const read = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
    // Guarda los datos actuales del módulo.
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    // Obtiene el rol del usuario actual.
    const role = () => document.body?.dataset.role || "Publico";
    // Escapa caracteres especiales para insertar texto de forma segura en HTML.
    const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    // Conserva solo los dígitos válidos del valor recibido.
    const digit = v => String(v || "").replace(/\D/g, "");
    // Valida un número de tarjeta con el algoritmo de Luhn.
    const luhn = number => { let sum=0, dbl=false; for(let i=number.length-1;i>=0;i--){let n=Number(number[i]);if(dbl){n*=2;if(n>9)n-=9;}sum+=n;dbl=!dbl;} return sum%10===0; };
    // Comprueba que el nombre tenga un formato válido.
    const validName = v => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,60}$/.test(v);
    // Obtiene las facturas disponibles para el usuario.
    const invoices = id => app.invoices?.get?.(id) || null;
    // Obtiene los registros que todavía están pendientes.
    const pending = () => read(app.KEY.orders).filter(o => o.paymentStatus !== "Pagado" && !['Cancelado'].includes(o.status));
    // Obtiene los datos del pedido seleccionado.
    const getOrder = id => read(app.KEY.orders).find(o => o.id === id);

    // Estado compartido del módulo: manager.
    const manager = {
        selectedId: null,
        filter: "",
        init(){
            if(!["Dueno","Administrador","Barra"].includes(role())) return;
            const search=document.getElementById("manualPaymentSearch");
            // Evento que conecta una acción del usuario con la lógica del módulo.
            search?.addEventListener("input",()=>{this.filter=search.value.trim().toLowerCase();this.renderList();});
            this.renderList();
            // Evento que conecta una acción del usuario con la lógica del módulo.
            const close=document.getElementById("manualPaymentClose"); close?.addEventListener("click",()=>this.close());
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById("manualPaymentBackdrop")?.addEventListener("click",e=>{if(e.target.id==="manualPaymentBackdrop")this.close();});
        },
        renderList(){
            const box=document.getElementById("manualPaymentList"); if(!box)return;
            const list=pending().filter(o=>!this.filter || [o.id,o.customerName,o.customer,o.customerPhone,o.deliveryPhone,o.customerDui].some(v=>String(v||"").toLowerCase().includes(this.filter)));
            const count=document.getElementById("manualPaymentCount"); if(count)count.textContent=`${list.length} pendientes`;
            box.innerHTML=list.map(o=>`<button type="button" class="manual-payment-order ${this.selectedId===o.id?'selected':''}" onclick="ESFERestaurante.manualPayments.open('${esc(o.id)}')"><span><strong>${esc(o.id)}</strong><small>${esc(o.customerName||"Cliente")} · ${esc(o.payment||"Sin método")}</small></span><b>${app.money(o.total)}</b></button>`).join("") || '<div class="empty-state compact"><strong>No hay pagos pendientes</strong><p>Los pedidos pendientes aparecerán aquí automáticamente.</p></div>';
        },
        open(id){
            if(!["Dueno","Administrador","Barra"].includes(role())) { app.ui.mostrarToast("Solo Barra o Administración pueden registrar pagos presenciales.","error"); return; }
            const order=getOrder(id); if(!order){app.ui.mostrarToast("No se encontró el pedido.","error");return;}
            if(order.paymentStatus==="Pagado"){app.ui.mostrarToast("Este pedido ya está pagado.","info");return;}
            this.selectedId=id;
            const modal=document.getElementById("manualPaymentBackdrop"); if(!modal)return;
            document.getElementById("manualPaymentOrderId").textContent=order.id;
            document.getElementById("manualPaymentCustomer").textContent=order.customerName||order.customer||"Cliente";
            document.getElementById("manualPaymentTotal").textContent=app.money(order.total);
            document.getElementById("manualPaymentDetail").textContent=`${order.orderType||"Pedido"} · ${order.customerPhone||order.deliveryPhone||"Sin teléfono"}`;
            document.querySelectorAll("[data-manual-method]").forEach(b=>b.classList.toggle("active",b.dataset.manualMethod===(order.payment||"Efectivo")));
            this.renderFields(order.payment||"Efectivo");
            modal.classList.remove("hidden");
        },
        close(){document.getElementById("manualPaymentBackdrop")?.classList.add("hidden");this.selectedId=null;},
        selectMethod(method){document.querySelectorAll("[data-manual-method]").forEach(b=>b.classList.toggle("active",b.dataset.manualMethod===method));this.renderFields(method);},
        renderFields(method){
            const box=document.getElementById("manualPaymentFields");if(!box)return;
            if(method==="Efectivo") box.innerHTML='<div class="manual-method-note"><strong>Efectivo</strong><span>Registra el pago recibido en caja. No se almacenan datos bancarios.</span></div>';
            else if(method==="Transferencia") box.innerHTML='<label class="field-label">Referencia de transferencia<input id="manualTransferRef" maxlength="40" placeholder="TRX-2026-001245"></label>';
            else box.innerHTML='<div class="manual-card-grid"><label class="field-label">Titular<input id="manualCardName" maxlength="60" placeholder="NOMBRE DEL TITULAR"></label><label class="field-label">Número<input id="manualCardNumber" maxlength="23" inputmode="numeric" placeholder="0000 0000 0000 0000"></label><label class="field-label">Vencimiento<input id="manualCardExpiry" maxlength="5" placeholder="MM/AA"></label><label class="field-label">CVV<input id="manualCardCvv" maxlength="4" inputmode="numeric" placeholder="123"></label></div>';
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById("manualCardNumber")?.addEventListener("input",e=>{const d=digit(e.target.value).slice(0,19);e.target.value=(d.match(/.{1,4}/g)||[]).join(" ");});
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById("manualCardExpiry")?.addEventListener("input",e=>{let d=digit(e.target.value).slice(0,4);if(d.length>2)d=`${d.slice(0,2)}/${d.slice(2)}`;e.target.value=d;});
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById("manualCardCvv")?.addEventListener("input",e=>e.target.value=digit(e.target.value).slice(0,4));
        },
        complete(){
            const id=this.selectedId, order=getOrder(id); if(!order){app.ui.mostrarToast("No se encontró el pedido.","error");return;}
            if(order.paymentStatus==="Pagado"){app.ui.mostrarToast("El pedido ya aparece como pagado.","info");this.close();this.renderList();return;}
            const active=document.querySelector("[data-manual-method].active")?.dataset.manualMethod||order.payment||"Efectivo";
            let detail="Pago presencial registrado por caja",ref=`POS-${Date.now().toString().slice(-10)}`;
            if(active==="Transferencia"){
                ref=document.getElementById("manualTransferRef")?.value.trim()||"";
                if(!/^[A-Za-z0-9-]{5,40}$/.test(ref)){app.ui.mostrarToast("Escribe una referencia válida.","error");return;}
                detail=`Transferencia confirmada presencialmente · ${ref}`;
            } else if(active==="Tarjeta"){
                const name=document.getElementById("manualCardName")?.value.trim()||"", number=digit(document.getElementById("manualCardNumber")?.value||""), exp=document.getElementById("manualCardExpiry")?.value.trim()||"", cvv=digit(document.getElementById("manualCardCvv")?.value||"");
                const match=/^(0[1-9]|1[0-2])\/(\d{2})$/.exec(exp);const now=new Date();
                if(!name||!number||!exp||!cvv){app.ui.mostrarToast("Completa los datos de la tarjeta para la simulación.","error");return;}
                ref=`CARD-${Date.now().toString().slice(-10)}`;detail='Tarjeta simulada · pago registrado';
            }
            const all=read(app.KEY.orders);const target=all.find(o=>o.id===id);if(!target)return;
            target.payment=active;target.paymentStatus="Pagado";target.paidAt=new Date().toISOString();target.paymentRef=ref;target.paymentDetail=detail;target.paymentRegisteredBy=document.body.dataset.user||"barra";
            write(app.KEY.orders,all);
            const sales=read(app.KEY.sales);if(!sales.some(x=>x.id===id))sales.unshift({...target,saleStatus:"Cobrado"});write(app.KEY.sales,sales);
            const invoice=app.invoices.create(target);
            if(target.customer && !String(target.customer).startsWith("presencial-")) app.addNotification(`Pago confirmado para ${target.id}.`,target.customer,{type:"factura",orderId:target.id,title:"Pago confirmado",detail:`${target.payment} · ${app.money(target.total)} · Factura ${invoice?.invoiceNumber||"digital"}.`,action:"invoice"});
            app.addNotification(`Pago registrado para ${target.id}.`,null,{type:"pago",orderId:target.id,title:"Pago presencial confirmado",detail:`${target.payment} · ${app.money(target.total)} · ${target.customerName||"Cliente"}.`,roles:["Dueno","Administrador","Barra"]});
            app.ui.mostrarToast(`Pedido ${target.id} marcado como pagado.`);this.close();this.renderList();app.orders?.render();
        }
    };
    app.manualPayments=manager;
    // Evento que conecta una acción del usuario con la lógica del módulo.
    document.addEventListener("DOMContentLoaded",()=>manager.init());
})();
