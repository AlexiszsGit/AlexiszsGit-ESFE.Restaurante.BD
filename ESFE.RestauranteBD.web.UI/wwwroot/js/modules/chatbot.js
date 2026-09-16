(() => {
    if (!window.ESFERestaurante?.chat) return;
    const bot=ESFERestaurante.chat;
    const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
    const role=()=>document.body?.dataset.role||'Publico';
    const user=()=>document.body?.dataset.user||'';
    const auth=()=>document.body?.dataset.auth==='True'||document.body?.dataset.auth==='true';
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money=v=>ESFERestaurante.money(v);
    const add=(html,kind='bot')=>{const box=document.getElementById('chatMessages');if(!box)return;const n=document.createElement('div');n.className=`chat-bubble ${kind}`;n.innerHTML=html;box.appendChild(n);box.scrollTop=box.scrollHeight;};
    const action=(label,fn)=>{const box=document.getElementById('chatMessages');if(!box)return;const w=document.createElement('div');w.className='chat-inline-actions';const b=document.createElement('button');b.type='button';b.className='chat-action-button';b.textContent=label;b.onclick=fn;w.appendChild(b);box.appendChild(w);box.scrollTop=box.scrollHeight;};
    const orders=()=>read(ESFERestaurante.KEY.orders).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const userOrders=()=>orders().filter(o=>o.customer===user());
    const today=()=>ESFERestaurante.localDate();
    const rolePermissions=()=>{try{return JSON.parse(document.body?.dataset.rolePermissions||'[]')}catch{return[]}};
    const permissionMap={inicio:'Dashboard',menu:'Menu',orders:'Orders',kitchen:'Kitchen',delivery:'Delivery',reservations:'Reservations',customers:'Customers',notifications:'Notifications',reports:'Reports',payments:'Payments',workers:'Workers',profile:'Profile',local:'LocalOrders',ratings:'Ratings',info:'Information'};
    const can=p=>{const r=role(), perms=rolePermissions(); if(r==='Cliente') return ['menu','inicio','profile','info','orders','reservations','payments','notifications','ratings'].includes(p); if(perms.length) return perms.some(x=>x===permissionMap[p]); return p==='menu'||p==='inicio'||p==='profile';};
    const routes={inicio:'/Inicio1/Index',menu:'/GestionDeMenu1/Index',orders:'/GestionDePedidos1/Index',kitchen:'/PantallaDeCocina1/Index',delivery:'/PedidoListo1/Index',reservations:'/ReservarMesas1/Index',customers:'/Clientes1/Index',notifications:'/NotificacionesController1/Index',reports:'/Reportes1/Index',payments:'/ProcesarPago1/Index',workers:'/Trabajadores1/Index',profile:'/Perfil1/Index',ratings:'/CalificarServicio1/Index',info:'/Informacion1/Index',local:'/GestionDePedidos1/Index'};
    const open=(key)=>{if(!can(key)){add('Esa pantalla no está disponible para este rol.');return;} let target=routes[key]||'/Inicio1/Index'; if(key==='orders'&&role()==='Cliente')target='/PedidoyCarrito1/Index'; location.href=target;};
    const list=(items,title)=>{if(!items.length){add(`<strong>${title}</strong><br>No hay registros para mostrar ahora.`);return;}add(`<strong>${title}</strong><div class="assistant-list">${items.slice(0,10).map(o=>`<div class="assistant-list-row"><span><strong>${esc(o.id)}</strong><small>${esc(o.customerName||o.customer||'Cliente')} · ${esc(o.orderType||'Pedido')} · ${esc(o.status||'')}</small></span><b>${money(o.total||0)}</b></div>`).join('')}</div>`);};
    const speak=text=>{if(!window.speechSynthesis||!text)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text).replace(/<[^>]+>/g,' '));u.lang='es-SV';u.rate=.98;u.pitch=1;window.speechSynthesis.speak(u);};
    const describeOpen=(screen)=>{const label={menu:'Menú',orders:'Pedidos',kitchen:'Cocina',delivery:'Delivery',reservations:'Reservas',customers:'Clientes',notifications:'Notificaciones',reports:'Reportes',payments:'Pagos',workers:'Trabajadores',profile:'Perfil',inicio:'Inicio'}[screen];return label?`Te abro ${label}.`:'Te llevo a esa pantalla.';};
    function reservations(){return read(ESFERestaurante.KEY.reservations);}
    function handle(q){
        const r=role(), owner=r==='Dueno', normalized=norm(q);
        if(/(realizar|hacer|crear|quiero|necesito).*pedido/.test(normalized) && r==='Cliente'){ add('Te explico el flujo y te abro el pedido. Elige productos, cantidad y forma de entrega desde el carrito.'); speak('Abriendo tu pedido.'); action('Realizar pedido',()=>open('orders')); return; }
        // navigation
        const map=[['trabajadores|empleados|personal|roles','workers'],['notificaciones|avisos|mensajes','notifications'],['pago|pagos|cobro|caja','payments'],['reporte|reportes|ventas','reports'],['cocina','kitchen'],['delivery|entrega|reparto','delivery'],['reserva|reservacion|mesa','reservations'],['cliente|clientes','customers'],['pedido|ordenes|orden','orders'],['menu|productos|carta|comida','menu'],['perfil|mi cuenta','profile'],['calificacion|calificaciones','ratings'],['informacion|información|acerca','info'],['inicio|principal','inicio']];
        if(/\b(abr(e|eme)|abre|abrir|llevame|dirigeme|mostrame|muest(r|ra)me|quiero ver|ir a)\b/.test(normalized)){
            const hit=map.find(([pattern])=>new RegExp(`(${pattern})`).test(normalized));
            if(hit){add(esc(describeOpen(hit[1])));speak(describeOpen(hit[1]));action('Abrir ahora',()=>open(hit[1]));return;}
        }
        if(/crear pedido presencial|pedido presencial|cliente viene|pedido en barra/.test(normalized)){
            if(can('local')){add('Voy a abrir la gestión de pedidos para iniciar una orden presencial y, desde ahí, puedes buscar al cliente, seleccionar mesa, productos y forma de cobro.');speak('Abriendo pedidos presenciales.');open('local');setTimeout(()=>window.ESFERestaurante.localOrders?.open?.(),600);}else add('La creación de pedidos presenciales está reservada a roles con ese permiso.');return;
        }
        if(/\b(pedidos? de hoy|pedidos? ahora|pedidos? actuales|mostrar.*pedidos|muest(r|ra)me.*pedido)/.test(normalized)){
            const os=r==='Cliente'?userOrders():orders().filter(o=>String(o.date||'').startsWith(today()));
            list(os,r==='Cliente'?'Mis pedidos de hoy':'Pedidos de hoy');action('Abrir pedidos',()=>open('orders'));return;
        }
        if(/\b(pendientes?|por preparar|en preparacion)/.test(normalized)&&['Dueno','Cocina','Barra','Mesero'].includes(r)){list(orders().filter(o=>['Pendiente','Preparando'].includes(o.status)),'Pedidos pendientes');return;}
        if(/\b(listos?|terminados?)/.test(normalized)&&['Dueno','Barra','Delivery','Mesero'].includes(r)){list(orders().filter(o=>o.status==='Listo'),'Pedidos listos');return;}
        if(/\b(mesas?|disponib)/.test(normalized)){
            const res=reservations().filter(x=>x.date===today()&&x.status==='Confirmada');const used=new Set(res.map(x=>Number(x.tableId)));const free=(ESFERestaurante.tables||[]).filter(t=>!used.has(t.id));
            add(`<strong>Mesas de hoy</strong><br><span class="assistant-muted">${free.length} disponibles · ${used.size} reservadas.</span><div class="assistant-table-grid">${(ESFERestaurante.tables||[]).map(t=>`<span class="assistant-table-chip ${used.has(t.id)?'busy':'free'}">Mesa ${String(t.id).padStart(2,'0')} · ${t.seats}p</span>`).join('')}</div>`);action('Abrir reservas',()=>open('reservations'));return;
        }
        if(/\b(reserva|reservar|reservacion)/.test(normalized)){add(auth()? 'Puedo abrirte Reservas para elegir fecha, hora y mesa.':'Para reservar una mesa necesitas iniciar sesión.');action('Abrir Reservas',()=>open('reservations'));return;}
        if(/\b(pagar|pago pendiente|factura|quiero pagar)/.test(normalized)){
            if(r==='Cliente'){const p=userOrders().find(o=>o.paymentStatus!=='Pagado');if(p){add(`Tienes el pedido <strong>${esc(p.id)}</strong> pendiente por <strong>${money(p.total)}</strong>.`);action('Pagar pedido',()=>{sessionStorage.setItem('esfe_pay_order_id',p.id);open('payments');});}else add('No encuentro pagos pendientes en tu cuenta.');}
            else {add('Abro Caja para buscar el pedido y registrar efectivo, tarjeta o transferencia.');action('Abrir Pagos',()=>open('payments'));}return;
        }
        if(/\b(productos?|hamburg|pizza|bebida|postre|menu|carta|que tienen|muestrame)/.test(normalized)){
            const ps=ESFERestaurante.catalogProducts?.()||ESFERestaurante.products||[];
            let matches=ps.filter(p=>norm(`${p.name} ${p.cat} ${p.desc} ${(p.tags||[]).join(' ')}`).includes(normalized));
            if(!matches.length){const terms=['hamburg','pizza','pollo','carne','pasta','bebida','postre','taco','ensalada','marisco','combo'].filter(t=>normalized.includes(t));if(terms.length)matches=ps.filter(p=>terms.some(t=>norm(`${p.name} ${p.cat} ${p.desc}`).includes(t)));}
            if(matches.length)list(matches.map(p=>({id:p.name,customerName:p.cat,status:'Disponible',total:p.price,orderType:p.desc})),'Productos encontrados');else add('Puedo abrir la carta para que busques por nombre, categoría, ingrediente o precio.');action('Abrir menú',()=>open('menu'));return;
        }
        if(/\b(horario|abren|cierran|hora de atencion)/.test(normalized)){const text='El restaurante atiende todos los días de 06:00 a. m. a 10:00 p. m.';add(text);speak(text);return;}
        if(/\b(ayuda|que puedes hacer|funciones|asistente)/.test(normalized)){add(`<strong>Asistente RestauranteBD</strong><br>Puedo consultar pedidos, pagos, mesas, reservas y menú; buscar información operativa y llevarte a las pantallas que tu rol tiene permitidas. También puedes hablarme usando el micrófono.`);return;}
        add('Entiendo órdenes de navegación y consultas sobre el restaurante. Por ejemplo: “muéstrame los pedidos de hoy”, “abre Pagos”, “muéstrame productos”, “abre reservas” o “quiero pagar”.');
    }
    const originalAsk=bot.ask.bind(bot); bot.__baseAsk=originalAsk;
    bot.ask=text=>{const v=String(text||'').trim();if(!v)return;bot.toggle(true);add(esc(v),'user');handle(v);};
    bot.voice={active:false,recognition:null,start(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){add('Este navegador no tiene reconocimiento de voz disponible.');return;}if(this.active){this.stop();return;}const r=new SR();r.lang='es-SV';r.interimResults=false;r.continuous=false;r.maxAlternatives=1;this.recognition=r;this.active=true;const b=document.getElementById('chatVoiceButton');b?.classList.add('recording');b?.setAttribute('aria-label','Detener grabación');r.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript||'';document.getElementById('chatInput').value=text;this.active=false;b?.classList.remove('recording');bot.ask(text);};r.onerror=e=>{this.active=false;b?.classList.remove('recording');add(`No pude procesar el audio (${esc(e.error||'error')}). Puedes escribirlo en el campo.`);};r.onend=()=>{this.active=false;b?.classList.remove('recording');};try{r.start();add('🎙️ Te escucho…');}catch{this.active=false;b?.classList.remove('recording');}},stop(){try{this.recognition?.stop()}catch{}this.active=false;document.getElementById('chatVoiceButton')?.classList.remove('recording');}};
    document.addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('chatVoiceButton');b?.addEventListener('click',()=>bot.voice.start());});
    bot.__enhancedReady=true;
})();