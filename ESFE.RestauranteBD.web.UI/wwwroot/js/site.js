const ESFERestaurante = (() => {
    const KEY = { cart:'esfe_carrito', orders:'esfe_pedidos', sales:'esfe_ventas', reservations:'esfe_reservas', user:'usuarioLogueado', ratings:'restaurantebd_calificaciones', notifications:'restaurantebd_notificaciones', productOverrides:'restaurantebd_product_overrides', productDeleted:'restaurantebd_product_deleted', customCategories:'restaurantebd_custom_categories', savedReports:'esfe_reportes_guardados' };
    const money = value => new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}).format(Number(value)||0);
    const uid = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*900+100)}`;
    const read = (key, fallback=[]) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

<<<<<<< HEAD
// Write your JavaScript code.

// Laboratorio JavaScript: Interacción Dinámica
document.addEventListener('DOMContentLoaded', () => {
    const boton = document.getElementById('miBoton');
    const mensaje = document.getElementById('mensaje');

    if (boton && mensaje) {
        boton.addEventListener('click', () => {
            mensaje.textContent = '¡El texto ha cambiado gracias a JavaScript!';
            mensaje.style.color = '#28a745';
            mensaje.style.fontWeight = 'bold';
        });
    }
});
=======
    // IMÁGENES DE CATEGORÍAS: coloca las fotografías reales en wwwroot/images/categorias/*.jpg
    const categories = [
        {id:'Hamburguesas',image:'/images/categorias/hamburguesas.jpg',desc:'Carne, pollo y opciones de autor'},
        {id:'Carnes',image:'/images/categorias/carnes.jpg',desc:'Cortes, parrilla y platos de carne'},
        {id:'Pollo',image:'/images/categorias/pollo.jpg',desc:'Pollo a la plancha, crispy y alitas'},
        {id:'Mariscos',image:'/images/categorias/mariscos.jpg',desc:'Opciones del mar y preparaciones frescas'},
        {id:'Pizzas',image:'/images/categorias/pizzas.jpg',desc:'Clásicas, familiares y especiales'},
        {id:'Tacos & Wraps',image:'/images/categorias/tacos-wraps.jpg',desc:'Opciones rápidas y llenadoras'},
        {id:'Entradas',image:'/images/categorias/entradas.jpg',desc:'Para compartir o comenzar'},
        {id:'Pastas',image:'/images/categorias/pastas.jpg',desc:'Salsas y preparaciones italianas'},
        {id:'Ensaladas',image:'/images/categorias/ensaladas.jpg',desc:'Frescas y completas'},
        {id:'Bebidas',image:'/images/categorias/bebidas.jpg',desc:'Frías, calientes y naturales'},
        {id:'Postres',image:'/images/categorias/postres.jpg',desc:'Dulces para cerrar'},
        {id:'Combos',image:'/images/categorias/combos.jpg',desc:'Combinaciones con mejor valor'}
    ];
    const customCategories = () => read(KEY.customCategories,[]);
    const allCategories = () => [...categories, ...customCategories().filter(c=>!categories.some(x=>x.id===c.id))];
    const products = [
        {id:'ham-clasica',cat:'Hamburguesas',name:'Clásica de la Casa',price:5.50,image:'/images/productos/ham-clasica.jpg',desc:'Carne de res, queso, lechuga y tomate.',ingredients:['Pan brioche','Carne de res 150 g','Queso americano','Lechuga','Tomate','Salsa especial'],tags:['Más pedida']},
        {id:'ham-doble',cat:'Hamburguesas',name:'Doble Queso',price:7.25,image:'/images/productos/ham-doble.jpg',desc:'Doble carne y doble queso con salsa de la casa.',ingredients:['Pan brioche','Doble carne','Doble queso','Cebolla caramelizada','Salsa especial'],tags:['Favorita']},
        {id:'ham-bacon',cat:'Hamburguesas',name:'BBQ Bacon',price:7.90,image:'/images/productos/ham-bacon.jpg',desc:'Carne, tocino crujiente y BBQ.',ingredients:['Pan brioche','Carne de res','Tocino','Queso cheddar','Salsa BBQ','Cebolla crispy'],tags:['Especial']},
        {id:'ham-crispy',cat:'Hamburguesas',name:'Chicken Crispy',price:6.50,image:'/images/productos/ham-crispy.jpg',desc:'Pollo crujiente, ensalada fresca y aderezo.',ingredients:['Pan brioche','Pollo empanizado','Lechuga','Tomate','Aderezo ranch'],tags:[]},
        {id:'ham-picante',cat:'Hamburguesas',name:'Spicy Fire',price:7.50,image:'/images/productos/ham-picante.jpg',desc:'Carne, jalapeño, queso y salsa picante.',ingredients:['Pan brioche','Carne de res','Queso pepper jack','Jalapeños','Salsa picante'],tags:['Picante']},
        {id:'ham-veggie',cat:'Hamburguesas',name:'Veggie Garden',price:6.75,image:'/images/productos/ham-veggie.jpg',desc:'Hamburguesa vegetal con vegetales frescos.',ingredients:['Pan integral','Medallón vegetal','Lechuga','Tomate','Aguacate','Salsa verde'],tags:['Vegetariana']},
        {id:'piz-pep',cat:'Pizzas',name:'Pepperoni',price:10.00,image:'/images/productos/piz-pep.jpg',desc:'Pizza familiar de 8 porciones.',ingredients:['Masa artesanal','Salsa de tomate','Mozzarella','Pepperoni'],tags:['Clásica']},
        {id:'piz-haw',cat:'Pizzas',name:'Hawaiana',price:11.00,image:'/images/productos/piz-haw.jpg',desc:'Jamón y piña en equilibrio dulce-salado.',ingredients:['Masa artesanal','Salsa de tomate','Mozzarella','Jamón','Piña'],tags:[]},
        {id:'piz-veg',cat:'Pizzas',name:'Vegetariana',price:9.50,image:'/images/productos/piz-veg.jpg',desc:'Vegetales salteados y queso mozzarella.',ingredients:['Masa artesanal','Mozzarella','Chile dulce','Cebolla','Champiñones','Aceitunas'],tags:['Vegetariana']},
        {id:'piz-meat',cat:'Pizzas',name:'Meat Lovers',price:12.50,image:'/images/productos/piz-meat.jpg',desc:'Para quienes no confían en la moderación.',ingredients:['Masa artesanal','Mozzarella','Pepperoni','Jamón','Tocino','Carne molida'],tags:['Especial']},
        {id:'tac-carne',cat:'Tacos & Wraps',name:'Tacos de Carne',price:6.50,image:'/images/productos/tac-carne.jpg',desc:'Tres tacos con carne sazonada.',ingredients:['Tortillas de maíz','Carne de res','Cebolla','Cilantro','Limón','Salsa roja'],tags:[]},
        {id:'wrap-pollo',cat:'Tacos & Wraps',name:'Wrap Crispy',price:6.25,image:'/images/productos/wrap-pollo.jpg',desc:'Wrap de pollo crujiente y vegetales.',ingredients:['Tortilla de harina','Pollo crispy','Lechuga','Tomate','Queso','Aderezo ranch'],tags:[]},
        {id:'entrada-papas',cat:'Entradas',name:'Papas de la Casa',price:3.75,image:'/images/productos/entrada-papas.jpg',desc:'Papas crujientes con salsa especial.',ingredients:['Papas','Sal','Paprika','Salsa especial'],tags:['Para compartir']},
        {id:'entrada-alitas',cat:'Entradas',name:'Alitas BBQ',price:7.50,image:'/images/productos/entrada-alitas.jpg',desc:'Alitas bañadas en BBQ.',ingredients:['Alitas de pollo','Salsa BBQ','Ajonjolí'],tags:['8 piezas']},
        {id:'entrada-nachos',cat:'Entradas',name:'Nachos Supreme',price:6.90,image:'/images/productos/entrada-nachos.jpg',desc:'Totopos con queso, carne y pico de gallo.',ingredients:['Totopos','Queso','Carne','Frijoles','Pico de gallo','Crema'],tags:['Para compartir']},
        {id:'pasta-alfredo',cat:'Pastas',name:'Fettuccine Alfredo',price:8.50,image:'/images/productos/pasta-alfredo.jpg',desc:'Pasta cremosa con pollo.',ingredients:['Fettuccine','Pollo','Crema','Parmesano','Ajo'],tags:['Favorita']},
        {id:'pasta-bolog',cat:'Pastas',name:'Spaghetti Bolognesa',price:8.25,image:'/images/productos/pasta-bolog.jpg',desc:'Salsa de tomate y carne molida.',ingredients:['Spaghetti','Tomate','Carne molida','Cebolla','Ajo','Parmesano'],tags:[]},
        {id:'pasta-pesto',cat:'Pastas',name:'Pasta Pesto',price:8.75,image:'/images/productos/pasta-pesto.jpg',desc:'Pesto, parmesano y tomates cherry.',ingredients:['Pasta penne','Pesto','Parmesano','Tomates cherry'],tags:['Vegetariana']},
        {id:'ens-caesar',cat:'Ensaladas',name:'Caesar Crispy',price:6.25,image:'/images/productos/ens-caesar.jpg',desc:'Ensalada fresca con pollo crujiente.',ingredients:['Lechuga romana','Pollo crispy','Crutones','Parmesano','Aderezo Caesar'],tags:[]},
        {id:'ens-grill',cat:'Ensaladas',name:'Garden Grill',price:7.25,image:'/images/productos/ens-grill.jpg',desc:'Vegetales, pollo a la plancha y vinagreta.',ingredients:['Lechuga','Pollo grill','Pepino','Tomate','Zanahoria','Vinagreta'],tags:['Ligera']},
        {id:'beb-cola',cat:'Bebidas',name:'Coca-Cola',price:1.50,image:'/images/productos/beb-cola.jpg',desc:'Bebida fría 355 ml.',ingredients:['Coca-Cola','Hielo'],tags:[]},
        {id:'beb-limon',cat:'Bebidas',name:'Limonada Fresa',price:2.75,image:'/images/productos/beb-limon.jpg',desc:'Limonada natural con fresa.',ingredients:['Limón','Fresa','Agua','Hielo','Azúcar'],tags:['Natural']},
        {id:'beb-maracuya',cat:'Bebidas',name:'Maracuyá Natural',price:2.50,image:'/images/productos/beb-maracuya.jpg',desc:'Jugo natural de maracuyá.',ingredients:['Maracuyá','Agua','Azúcar','Hielo'],tags:['Natural']},
        {id:'beb-cafe',cat:'Bebidas',name:'Café de la Casa',price:2.00,image:'/images/productos/beb-cafe.jpg',desc:'Café caliente de tueste medio.',ingredients:['Café','Agua'],tags:['Caliente']},
        {id:'beb-agua',cat:'Bebidas',name:'Agua',price:1.00,image:'/images/productos/beb-agua.jpg',desc:'Botella de 500 ml.',ingredients:['Agua purificada'],tags:[]},
        {id:'post-cheese',cat:'Postres',name:'Cheesecake',price:3.75,image:'/images/productos/post-cheese.jpg',desc:'Porción cremosa con base de galleta.',ingredients:['Queso crema','Galleta','Azúcar','Vainilla'],tags:['Favorito']},
        {id:'post-choco',cat:'Postres',name:'Pastel de Chocolate',price:3.50,image:'/images/productos/post-choco.jpg',desc:'Pastel húmedo con cobertura de chocolate.',ingredients:['Chocolate','Harina','Huevo','Leche','Azúcar'],tags:[]},
        {id:'post-brownie',cat:'Postres',name:'Brownie con Helado',price:4.25,image:'/images/productos/post-brownie.jpg',desc:'Brownie caliente y helado de vainilla.',ingredients:['Chocolate','Harina','Huevo','Helado de vainilla'],tags:['Especial']},
        {id:'combo-esfe',cat:'Combos',name:'Combo de la Casa',price:9.50,image:'/images/productos/combo-esfe.jpg',desc:'Hamburguesa clásica + papas + bebida.',ingredients:['Hamburguesa Clásica','Papas de la Casa','Coca-Cola'],tags:['Mejor valor']},
        {id:'combo-crispy',cat:'Combos',name:'Combo Crispy',price:10.50,image:'/images/productos/combo-crispy.jpg',desc:'Chicken Crispy + papas + limonada.',ingredients:['Chicken Crispy','Papas de la Casa','Limonada Fresa'],tags:['Popular']},
        {id:'combo-pizza',cat:'Combos',name:'Combo Pizza Familiar',price:13.50,image:'/images/productos/combo-pizza.jpg',desc:'Pizza Pepperoni + 2 bebidas.',ingredients:['Pizza Pepperoni','2 Coca-Cola'],tags:['Familiar']},
        {id:'combo-tacos',cat:'Combos',name:'Combo Tacos',price:8.75,image:'/images/tacos.jpg',desc:'Tacos de carne + bebida + postre.',ingredients:['Tacos de Carne','Coca-Cola','Brownie'],tags:['Completo']},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/carne-parrilla.jpg
        {id:'carne-parrilla',cat:'Carnes',name:'Parrillada de la Casa',price:14.50,image:'/images/productos/carne-parrilla.jpg',desc:'Selección de carnes a la parrilla con guarniciones de la casa.',ingredients:['Carne de res','Chorizo','Cebolla','Papas','Ensalada'],tags:['Especial','Parrilla']},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/steak-chimichurri.jpg
        {id:'steak-chimichurri',cat:'Carnes',name:'Steak con Chimichurri',price:13.25,image:'/images/productos/steak-chimichurri.jpg',desc:'Corte de res a la plancha con chimichurri y papas.',ingredients:['Corte de res','Chimichurri','Papas','Ensalada'],tags:['Favorito']},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/carne-salteada.jpg
        {id:'carne-salteada',cat:'Carnes',name:'Carne Salteada',price:10.95,image:'/images/productos/carne-salteada.jpg',desc:'Tiras de res salteadas con vegetales y salsa de la casa.',ingredients:['Carne de res','Chile dulce','Cebolla','Salsa de la casa'],tags:[]},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/pollo-plancha.jpg
        {id:'pollo-plancha',cat:'Pollo',name:'Pollo a la Plancha',price:8.25,image:'/images/productos/pollo-plancha.jpg',desc:'Pechuga de pollo a la plancha con arroz y ensalada.',ingredients:['Pechuga de pollo','Arroz','Ensalada','Salsa de la casa'],tags:['Ligera']},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/pollo-teriyaki.jpg
        {id:'pollo-teriyaki',cat:'Pollo',name:'Pollo Teriyaki',price:9.25,image:'/images/productos/pollo-teriyaki.jpg',desc:'Pollo glaseado con teriyaki, arroz y vegetales.',ingredients:['Pollo','Salsa teriyaki','Arroz','Brócoli','Zanahoria'],tags:['Popular']},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/alitas-picantes.jpg
        {id:'alitas-picantes',cat:'Pollo',name:'Alitas Picantes',price:8.25,image:'/images/productos/alitas-picantes.jpg',desc:'Alitas crujientes bañadas en salsa picante de la casa.',ingredients:['Alitas de pollo','Salsa picante','Apio','Aderezo ranch'],tags:['Picante']},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/camarones-ajo.jpg
        {id:'camarones-ajo',cat:'Mariscos',name:'Camarones al Ajillo',price:12.75,image:'/images/productos/camarones-ajo.jpg',desc:'Camarones salteados al ajillo con arroz y ensalada.',ingredients:['Camarones','Ajo','Mantequilla','Arroz','Ensalada'],tags:['Especial']},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/fish-chips.jpg
        {id:'fish-chips',cat:'Mariscos',name:'Fish & Chips',price:10.50,image:'/images/productos/fish-chips.jpg',desc:'Filete de pescado crujiente con papas y salsa tártara.',ingredients:['Filete de pescado','Papas','Pan rallado','Salsa tártara'],tags:['Crujiente']},
        // IMAGEN DEL PRODUCTO: agrega la fotografía en wwwroot/images/productos/ceviche-casa.jpg
        {id:'ceviche-casa',cat:'Mariscos',name:'Ceviche de la Casa',price:9.75,image:'/images/productos/ceviche-casa.jpg',desc:'Ceviche fresco con limón, cebolla y cilantro.',ingredients:['Pescado','Limón','Cebolla morada','Cilantro','Chile'],tags:['Fresco']}
    ];
    const catalogProducts = () => { const deleted=read(KEY.productDeleted,[]); const overrides=read(KEY.productOverrides,[]); const map=new Map(overrides.map(x=>[x.id,x])); return products.filter(p=>!deleted.includes(p.id)).map(p=>map.get(p.id)||p).concat(overrides.filter(x=>!products.some(p=>p.id===x.id))); };
    const saveProductOverride = p => { let a=read(KEY.productOverrides,[]); a=a.filter(x=>x.id!==p.id); a.push(p); write(KEY.productOverrides,a); };
    const deleteCatalogProduct = id => { let a=read(KEY.productDeleted,[]); if(!a.includes(id))a.push(id); write(KEY.productDeleted,a); };

    const tables = [
        {id:1,seats:2,zone:'Ventana',x:12,y:24,shape:'round'},{id:2,seats:4,zone:'Ventana',x:30,y:22,shape:'square'},{id:3,seats:6,zone:'Centro',x:49,y:22,shape:'round'},
        {id:4,seats:4,zone:'Centro',x:68,y:22,shape:'square'},{id:5,seats:8,zone:'Familiar',x:86,y:24,shape:'rect'}, {id:6,seats:2,zone:'Barra',x:15,y:53,shape:'round'},
        {id:7,seats:4,zone:'Centro',x:34,y:50,shape:'square'},{id:8,seats:6,zone:'Centro',x:53,y:52,shape:'round'},{id:9,seats:4,zone:'Centro',x:73,y:50,shape:'square'},
        {id:10,seats:8,zone:'Familiar',x:88,y:52,shape:'rect'},{id:11,seats:2,zone:'Barra',x:28,y:79,shape:'round'},{id:12,seats:4,zone:'Terraza',x:61,y:80,shape:'square'}
    ];

    function currentUser(){return document.body?.dataset.user || localStorage.getItem(KEY.user) || 'cliente@restaurante.com'}
    function currentRole(){const serverRole=document.body?.dataset.role;return serverRole || (currentUser().toLowerCase()==='admin@restaurante.com'?'Dueno':'Cliente')}
    function ratingsGet(){return read(KEY.ratings,[])}
    function ratingsSave(list){write(KEY.ratings,list)}
    function notificationsGet(){return read(KEY.notifications,[])}
    function notificationsSave(list){write(KEY.notifications,list)}
    function addNotification(message,user){const list=notificationsGet();list.unshift({id:uid('NOT'),user,message,date:new Date().toISOString(),read:false});notificationsSave(list)}
    function updateNotificationBadges(){const n=notificationsGet().filter(x=>x.user===currentUser()&&!x.read).length;document.querySelectorAll('#notificationBadge').forEach(e=>e.textContent=n)}

    function cartGet(){return read(KEY.cart,[])}
    function cartSave(c){write(KEY.cart,c); updateCartBadges();updateNotificationBadges();}
    function updateCartBadges(){const n=cartGet().reduce((s,i)=>s+Number(i.qty),0);document.querySelectorAll('[data-cart-badge]').forEach(e=>e.textContent=n);}
    function toast(message,type='success'){const c=document.getElementById('toast-container');if(!c)return;const el=document.createElement('div');el.className=`toast ${type}`;el.innerHTML=`<span>${type==='success'?'✓':type==='error'?'!':'i'}</span><strong>${message}</strong>`;c.appendChild(el);setTimeout(()=>el.remove(),3200)}

    const layout={
        toggleSidebar(show){document.getElementById('appSidebar')?.classList.toggle('open',show);document.getElementById('mobileOverlay')?.classList.toggle('show',show);},
        init(){const user=currentUser();const name=user.split('@')[0].replace(/[._-]+/g,' ');const pretty=name.replace(/\b\w/g,x=>x.toUpperCase());['usuarioNombreSide','usuarioNombreTop'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=pretty});['avatarUsuario','avatarUsuarioTop'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=pretty.charAt(0).toUpperCase()});updateCartBadges();updateNotificationBadges();}
    };

    const chat={
        toggle(show){const el=document.getElementById('chatbot');el?.classList.toggle('show',show);if(show&&!document.getElementById('chatMessages')?.children.length){const owner=currentRole()==='Dueno';this.add('bot',owner?'Hola. Soy tu asistente de RestauranteBD. Puedo ayudarte a encontrar pedidos, revisar estados, explicar pagos, gestionar el menú y ubicar funciones del panel.':'Hola. Soy tu asistente de RestauranteBD. Puedo ayudarte con el menú, recomendaciones, pedidos, pagos, reservas y el estado de tu orden.');}},
        add(type,text){const box=document.getElementById('chatMessages');if(!box)return;const item=document.createElement('div');item.className=`chat-bubble ${type}`;item.textContent=text;box.appendChild(item);box.scrollTop=box.scrollHeight;},
        send(){const input=document.getElementById('chatInput');const text=input?.value.trim();if(!text)return;input.value='';this.add('user',text);setTimeout(()=>this.respond(text),120);},
        ask(text){this.toggle(true);const input=document.getElementById('chatInput');if(input)input.value=text;this.send();},
        latestOrder(){const user=currentUser();return read(KEY.orders,[]).filter(o=>(o.customer||'')===user).sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null;},
        respond(text){
            const q=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
            const owner=currentRole()==='Dueno';
            let r='Puedo ayudarte con menú, pedidos, pagos, reservas y funciones del sistema.';
            if(owner){
                if(q.includes('pedido')||q.includes('orden')) r='Puedes revisar Gestión de pedidos para ver todas las órdenes. Usa la búsqueda por nombre, correo o número para encontrar una rápidamente.';
                else if(q.includes('listo')||q.includes('entreg')) r='En Entregas puedes buscar pedidos listos por nombre, correo o número y pulsar “Marcar entregado”. Eso además envía una notificación al cliente.';
                else if(q.includes('cocina')) r='En Cocina mueve el pedido de Pendiente a Preparando y después a Listo. Cuando llegue a Listo aparecerá en Entregas.';
                else if(q.includes('menu')||q.includes('producto')||q.includes('categoria')) r='En Menú puedes crear categorías y productos. Para una fotografía, selecciona el archivo y la ruta se completa automáticamente; puedes editarla antes de guardar.';
                else if(q.includes('reporte')) r='En Reportes puedes guardar una captura del resumen del día y limpiar únicamente el historial de reportes guardados. Las ventas y pedidos permanecen intactos.';
                else if(q.includes('pago')) r='Los pagos se registran junto al pedido. Efectivo queda pendiente hasta que el restaurante lo confirme; tarjeta y transferencia quedan marcados como pagados en esta simulación local.';
            }else{
                const latest=this.latestOrder();
                if(q.includes('hamburg')) r='Tenemos Clásica de la Casa, Doble Queso, BBQ Bacon, Chicken Crispy, Spicy Fire y Veggie Garden. En Menú puedes filtrar por categoría y precio.';
                else if(q.includes('carne')) r='La sección Carnes reúne platos de parrilla y cortes. Entra a Menú > Carnes para ver las opciones disponibles.';
                else if(q.includes('pollo')) r='Tenemos varias opciones de pollo, además de hamburguesas y entradas. Usa el filtro Pollo o busca “pollo” en el menú.';
                else if(q.includes('marisco')||q.includes('camaron')||q.includes('pescado')) r='En Mariscos puedes encontrar platos del mar. Usa la búsqueda del menú para localizar rápidamente una opción.';
                else if(q.includes('pizza')) r='Hay Pepperoni, Hawaiana, Vegetariana y Meat Lovers. Puedes filtrar por Pizzas y ordenar por precio.';
                else if(q.includes('reserv')) r='En Reservas elige una mesa disponible, fecha, hora y cantidad de personas. Después confirma la reserva.';
                else if(q.includes('pago')||q.includes('tarjeta')||q.includes('efectivo')||q.includes('transfer')) r='Puedes pagar con efectivo, tarjeta o transferencia. El efectivo queda pendiente y se paga al recoger o recibir; los otros dos métodos se registran como pagados en esta simulación local.';
                else if(q.includes('pedido')||q.includes('estado')||q.includes('listo')||q.includes('entreg')) r=latest?`Tu último pedido ${latest.id} está en estado “${latest.status}”.${latest.status==='Listo'?' Ya está listo para recoger o recibir, según el tipo de pedido.':latest.status==='Entregado'?' Ya fue marcado como entregado.':''}`:'Todavía no tienes pedidos registrados.';
                else if(q.includes('carrito')) r=`Ahora tienes ${cartGet().reduce((sum,i)=>sum+i.qty,0)} unidad(es) en el carrito. Desde Carrito puedes cambiar cantidades y continuar al pago.`;
                else if(q.includes('ingred')) r='Cada producto tiene descripción, ingredientes, etiquetas, precio y cantidad antes de agregarlo al carrito.';
                else if(q.includes('buscar')||q.includes('filtr')) r='En Menú puedes combinar búsqueda por nombre o ingrediente con categoría, precio máximo, preferencia y orden. Así no tienes que pelearte con 40 platos a la vez.';
                else if(q.includes('ayuda')) r='Puedo orientarte con el menú, filtros, carrito, pagos, reservas y el estado de tu pedido.';
            }
            this.add('bot',r);
        }
    };

    const menu={
        selected:'Todas',term:'',priceMax:'',sort:'relevance',tag:'Todos',modalCategory:null,modalProduct:null,
        init(){this.renderCategories();this.bindFilters();this.renderProducts();},
        bindFilters(){
            document.getElementById('menuSearch')?.addEventListener('input',e=>{this.term=e.target.value.toLowerCase().trim();this.renderCategoryModal();});
            document.getElementById('menuFilterCategory')?.addEventListener('change',e=>{this.selected=e.target.value;this.renderCategoryModal();});
            document.getElementById('menuFilterPrice')?.addEventListener('change',e=>{this.priceMax=e.target.value;this.renderCategoryModal();});
            document.getElementById('menuFilterTag')?.addEventListener('change',e=>{this.tag=e.target.value;this.renderCategoryModal();});
            document.getElementById('menuSort')?.addEventListener('change',e=>{this.sort=e.target.value;this.renderCategoryModal();});
        },
        getFiltered(){
            let list=catalogProducts();
            const q=this.term;
            if(this.selected && this.selected!=='Todas') list=list.filter(p=>p.cat===this.selected);
            if(q) list=list.filter(p=>`${p.name} ${p.cat} ${p.desc} ${p.ingredients.join(' ')} ${(p.tags||[]).join(' ')}`.toLowerCase().includes(q));
            if(this.priceMax) list=list.filter(p=>p.price<=Number(this.priceMax));
            if(this.tag && this.tag!=='Todos') list=list.filter(p=>(p.tags||[]).includes(this.tag));
            if(this.sort==='priceAsc') list.sort((a,b)=>a.price-b.price);
            if(this.sort==='priceDesc') list.sort((a,b)=>b.price-a.price);
            if(this.sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name,'es'));
            return list;
        },
        renderCategories(){
            const grid=document.getElementById('categoryGrid');if(!grid)return;
            const cats=allCategories();
            grid.innerHTML=cats.map(c=>`<button class="category-card" onclick="ESFERestaurante.menu.openCategory('${c.id.replace(/'/g,"\\'")}')"><div class="category-image"><img src="${c.image}" alt="${c.id}" loading="lazy" onerror="this.classList.add('image-missing')" /></div><strong>${c.id}</strong><small>${c.desc}</small><span class="category-count">${catalogProducts().filter(p=>p.cat===c.id).length} opciones</span></button>`).join('');
            const sel=document.getElementById('menuFilterCategory');
            if(sel)sel.innerHTML='<option value="Todas">Todas las categorías</option>'+cats.map(c=>`<option value="${c.id}">${c.id}</option>`).join('');
        },
        openCategory(cat){this.selected=cat;this.term='';const input=document.getElementById('menuSearch');if(input)input.value='';const select=document.getElementById('menuFilterCategory');if(select)select.value=cat;this.renderCategoryModal();},
        selectCategory(cat){this.openCategory(cat)},
        filter(v){this.term=v.toLowerCase().trim();this.renderCategoryModal();},
        clearFilters(){this.selected='Todas';this.term='';this.priceMax='';this.sort='relevance';this.tag='Todos';['menuSearch','menuFilterCategory','menuFilterPrice','menuSort','menuFilterTag'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=id==='menuFilterCategory'?'Todas':id==='menuFilterTag'?'Todos':'';});this.renderCategoryModal();},
        renderProducts(){const grid=document.getElementById('productGrid');if(grid)grid.innerHTML='';const title=document.getElementById('productSectionTitle');if(title)title.textContent='Selecciona una sección';const count=document.getElementById('productCount');if(count)count.textContent='';},
        renderCategoryModal(){
            const modal=document.getElementById('categoryModal'),title=document.getElementById('categoryModalTitle'),grid=document.getElementById('categoryProductGrid');if(!modal||!grid)return;
            const list=this.getFiltered();
            title.textContent=this.term?`Resultados para "${this.term}"`:(this.selected==='Todas'?'Resultados del menú':this.selected);
            const count=document.getElementById('categoryResultCount');if(count)count.textContent=`${list.length} producto${list.length===1?'':'s'}`;
            grid.innerHTML=list.map(p=>`<article class="product-card"><div class="product-image"><img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.classList.add('image-missing')" /><!-- IMAGEN DEL PRODUCTO: coloca aquí ${p.id}.jpg en wwwroot/images/productos/ --><div class="product-tags">${(p.tags||[]).map(t=>`<span>${t}</span>`).join('')}</div></div><div class="product-card-body"><span class="product-category">${p.cat}</span><h4>${p.name}</h4><p>${p.desc}</p><div class="product-footer"><strong>${money(p.price)}</strong><button onclick="ESFERestaurante.menu.openModal('${p.id}')">Ver producto <span>+</span></button></div></div></article>`).join('')||`<div class="empty-state"><strong>No encontramos productos</strong><p>Prueba otra combinación de filtros.</p></div>`;
            modal.classList.remove('hidden');
        },
        closeCategory(){document.getElementById('categoryModal')?.classList.add('hidden')},
        openModal(id){const p=catalogProducts().find(x=>x.id===id);if(!p)return;const m=document.getElementById('productModal');document.getElementById('productModalContent').innerHTML=`<div class="product-detail"><div class="detail-image"><img src="${p.image}" alt="${p.name}" onerror="this.classList.add('image-missing')" /><!-- IMAGEN DEL PRODUCTO: coloca aquí ${p.id}.jpg en wwwroot/images/productos/ --></div><div class="detail-content"><span class="product-category">${p.cat}</span><h2>${p.name}</h2><p>${p.desc}</p><div class="price-big">${money(p.price)}</div><div class="ingredient-block"><span>Ingredientes</span><div>${p.ingredients.map(i=>`<span>${i}</span>`).join('')}</div></div><label class="field-label">Cantidad<div class="qty-control large"><button onclick="ESFERestaurante.menu.adjustModal(-1)">−</button><input id="modalQty" type="number" min="1" value="1" /><button onclick="ESFERestaurante.menu.adjustModal(1)">+</button></div></label><button class="primary-btn large full" onclick="ESFERestaurante.menu.addModal('${p.id}')">Agregar al carrito</button></div></div>`;m.classList.remove('hidden');this.modalProduct=p.id;},
        adjustModal(delta){const i=document.getElementById('modalQty');if(i)i.value=Math.max(1,(Number(i.value)||1)+delta);},
        addModal(id){const p=catalogProducts().find(x=>x.id===id);if(!p)return;const qty=Math.max(1,Number(document.getElementById('modalQty')?.value)||1);let c=cartGet();const item=c.find(x=>x.productId===id);if(item)item.qty+=qty;else c.push({productId:p.id,name:p.name,price:p.price,image:p.image,qty,ingredients:p.ingredients});cartSave(c);toast(`${qty} × ${p.name} agregado al carrito`);this.closeModal();},
        closeModal(){document.getElementById('productModal')?.classList.add('hidden');}
    };
    const cart={
        init(){this.render();},
        render(){const box=document.getElementById('cartItems');if(!box)return;const c=cartGet();document.getElementById('cartItemSummary').textContent=`${c.reduce((s,i)=>s+i.qty,0)} unidades · ${c.length} productos`;if(!c.length){box.innerHTML=`<div class="empty-state"><span>🛒</span><strong>Tu carrito está vacío</strong><p>Agrega productos desde el menú.</p><a class="primary-btn" href="/GestionDeMenu1/Index">Ir al menú →</a></div>`;this.updateTotals();return;}box.innerHTML=c.map(i=>`<div class="cart-line"><img src="${i.image}" alt="${i.name}" onerror="this.src='/images/pizza.jpg' /><!-- IMAGEN DEL PRODUCTO: fotografía del producto, JPG/PNG --><div class="cart-main"><strong>${i.name}</strong><small>${(i.ingredients||[]).slice(0,4).join(' · ')}</small><div class="qty-control"><button onclick="ESFERestaurante.cart.adjust('${i.productId}',-1)">−</button><input value="${i.qty}" min="1" type="number" onchange="ESFERestaurante.cart.setQty('${i.productId}',this.value)" /><button onclick="ESFERestaurante.cart.adjust('${i.productId}',1)">+</button></div></div><strong class="line-total">${money(i.price*i.qty)}</strong><button class="line-remove" onclick="ESFERestaurante.cart.remove('${i.productId}')">×</button></div>`).join('');this.updateTotals();},
        updateTotals(){const c=cartGet();const sub=c.reduce((s,i)=>s+i.price*i.qty,0);const tax=sub*.13;document.getElementById('cartSubtotal').textContent=money(sub);document.getElementById('cartTax').textContent=money(tax);document.getElementById('cartTotal').textContent=money(sub+tax);const b=document.getElementById('goPay');if(b)b.disabled=!c.length;},
        adjust(id,d){let c=cartGet();const i=c.find(x=>x.productId===id);if(!i)return;i.qty=Math.max(1,i.qty+d);cartSave(c);this.render();},
        setQty(id,q){let c=cartGet();const i=c.find(x=>x.productId===id);if(!i)return;i.qty=Math.max(1,Number(q)||1);cartSave(c);this.render();},
        remove(id){cartSave(cartGet().filter(x=>x.productId!==id));this.render();toast('Producto eliminado','info');},
        clear(){cartSave([]);this.render();toast('Carrito vaciado','info');},
        checkout(){if(currentRole()==='Dueno'){toast('El dueño no puede realizar pedidos','error');return;}if(!cartGet().length){toast('Agrega productos antes de continuar','error');return;}sessionStorage.setItem('esfe_order_type',document.getElementById('orderType')?.value||'Mesa');sessionStorage.setItem('esfe_order_note',document.getElementById('orderNote')?.value||'');window.location.href='/ProcesarPago1/Index';}
    };

    const reservas={
        selected:null,
        init(){const d=new Date(),dateInput=document.getElementById('reserveDate'),timeInput=document.getElementById('reserveTime');if(dateInput){dateInput.value=d.toISOString().split('T')[0];dateInput.addEventListener('change',()=>this.render());}if(timeInput){timeInput.value='19:00';timeInput.addEventListener('change',()=>this.render());}this.render();this.renderList();},
        isReserved(t){const date=document.getElementById('reserveDate')?.value||new Date().toISOString().split('T')[0],time=document.getElementById('reserveTime')?.value||'19:00';return read(KEY.reservations,[]).some(r=>r.tableId===t.id&&r.date===date&&r.time===time&&r.status==='Confirmada');},
        render(){const box=document.getElementById('tablesMap');if(!box)return;const owner=currentRole()==='Dueno';box.innerHTML=tables.map(t=>{const reserved=this.isReserved(t);const selected=this.selected===t.id;return `<button type="button" class="restaurant-table ${t.shape} ${reserved?'occupied':''} ${selected?'selected':''}" style="left:${t.x}%;top:${t.y}%" ${owner?'disabled':''} ${owner?'':'onclick=\"ESFERestaurante.reservas.select('+t.id+')\"'} ${reserved?'disabled':''}><strong>${String(t.id).padStart(2,'0')}</strong><small>${t.seats}p</small></button>`}).join('');this.renderSelected();},
        select(id){const t=tables.find(x=>x.id===id);if(!t||this.isReserved(t)){toast('Mesa no disponible para ese horario','error');return;}this.selected=id;this.render();},
        renderSelected(){const t=tables.find(x=>x.id===this.selected);const selected=document.getElementById('selectedTable'),info=document.getElementById('selectedTableInfo');if(!selected||!info)return;selected.textContent=t?`Mesa ${String(t.id).padStart(2,'0')}`:'Selecciona una mesa';document.getElementById('selectedTableInfo').textContent=t?`${t.seats} personas · Zona ${t.zone}`:'Elige una mesa disponible en el croquis.';},
        save(){if(currentRole()==='Dueno'){toast('El dueño solo puede consultar las mesas','error');return;}const name=document.getElementById('reserveName').value.trim();const date=document.getElementById('reserveDate').value;const time=document.getElementById('reserveTime').value;const people=Number(document.getElementById('reservePeople').value);const t=tables.find(x=>x.id===this.selected);if(!name||!date||!time||!t){toast('Completa nombre, mesa, fecha y hora','error');return;}if(people>t.seats){toast(`La Mesa ${String(t.id).padStart(2,'0')} tiene ${t.seats} asientos`,'error');return;}let all=read(KEY.reservations,[]);if(all.some(r=>r.tableId===t.id&&r.date===date&&r.time===time&&r.status==='Confirmada')){toast('Esa mesa ya fue reservada','error');return;}all.push({id:uid('RES'),customer:currentUser(),tableId:t.id,table:`Mesa ${String(t.id).padStart(2,'0')}`,name,people,date,time,zone:t.zone,status:'Confirmada'});write(KEY.reservations,all);this.selected=null;document.getElementById('reserveName').value='';this.render();this.renderList();toast(`Reserva confirmada en Mesa ${String(t.id).padStart(2,'0')}`);},
        renderList(){const date=new Date().toISOString().split('T')[0];const owner=currentRole()==='Dueno';const user=currentUser();const list=read(KEY.reservations,[]).filter(r=>r.date===date && (owner || r.customer===user)).sort((a,b)=>a.time.localeCompare(b.time));const box=document.getElementById('reservationList');document.getElementById('reservationCount').textContent=`${list.length} reservas`;if(!list.length){box.innerHTML='<div class="empty-state compact"><span>▦</span><strong>No hay reservas para hoy</strong><p>Las nuevas reservas aparecerán aquí.</p></div>';return;}box.innerHTML=list.map(r=>`<div class="reservation-item"><div><span class="reservation-time">${r.time}</span><strong>${r.table}</strong><small>${r.name} · ${r.people} persona(s) · ${r.zone}</small></div><span class="status-pill success">${r.status}</span></div>`).join('');}
    };

    const payment={method:'Efectivo',subtotal:0,total:0,
        init(){if(currentRole()==='Dueno'){toast('El dueño no puede realizar pedidos','error');location.href='/GestionDeMenu1/Index';return;}const c=cartGet();if(!c.length){toast('El carrito está vacío','error');setTimeout(()=>location.href='/GestionDeMenu1/Index',250);return;}this.subtotal=c.reduce((sum,i)=>sum+i.price*i.qty,0);this.total=this.subtotal*1.13;document.getElementById('paymentTotal').textContent=money(this.total);document.getElementById('paymentTotalAside').textContent=money(this.total);document.getElementById('paymentSubtotal').textContent=money(this.subtotal);document.getElementById('paymentTax').textContent=money(this.total-this.subtotal);document.getElementById('paymentItems').innerHTML=c.map(i=>`<div><span>${i.qty}× ${i.name}</span><strong>${money(i.price*i.qty)}</strong></div>`).join('');this.renderFields();},
        selectMethod(m){this.method=m;document.querySelectorAll('.payment-method').forEach(b=>b.classList.toggle('active',b.dataset.method===m));this.renderFields();},
        renderFields(){const box=document.getElementById('paymentFields');if(!box)return;if(this.method==='Efectivo')box.innerHTML=`<div class="method-box"><span>💵</span><div><strong>Pago en efectivo</strong><p>Tu pedido se creará como <strong>pendiente de pago</strong>. Pagarás en persona al recoger o recibir el pedido.</p></div></div>`;else if(this.method==='Tarjeta')box.innerHTML=`<div class="method-box"><span>💳</span><div><strong>Pago con tarjeta</strong><p>Completa los datos para validar el pago de demostración. No se guardará el número completo ni el CVV.</p></div><label class="field-label">Nombre del titular<input id="cardName" autocomplete="cc-name" placeholder="Nombre completo" /></label><label class="field-label">Número de tarjeta<input id="cardNumber" maxlength="19" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" /></label><div class="payment-inline"><label class="field-label">Vencimiento<input id="cardExpiry" maxlength="5" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" /></label><label class="field-label">CVV<input id="cardCvv" maxlength="4" inputmode="numeric" autocomplete="cc-csc" placeholder="123" /></label></div></div>`;else box.innerHTML=`<div class="method-box"><span>🏦</span><div><strong>Transferencia bancaria</strong><p>Realiza la transferencia por tu medio habitual y registra la referencia para dejar el pedido como pagado.</p></div><div class="transfer-data"><strong>Referencia sugerida</strong><span>Ejemplo: TRX-2026-001245</span></div><label class="field-label">Referencia de transferencia<input id="transferRef" maxlength="40" placeholder="TRX-2026-001245" /></label></div>`;},
        complete(){if(currentRole()==='Dueno'){toast('El dueño no puede realizar pedidos','error');return;}const c=cartGet();if(!c.length){toast('El carrito está vacío','error');return;}let ref='',paymentStatus='Pendiente',paymentDetail='';if(this.method==='Tarjeta'){const name=(document.getElementById('cardName')?.value||'').trim();const number=(document.getElementById('cardNumber')?.value||'').replace(/\D/g,'');const expiry=(document.getElementById('cardExpiry')?.value||'').trim();const cvv=(document.getElementById('cardCvv')?.value||'').replace(/\D/g,'');if(name.length<3||number.length<13||number.length>19||!/^\d{2}\/\d{2}$/.test(expiry)||cvv.length<3){toast('Completa correctamente los datos de la tarjeta','error');return;}ref='CARD-'+number.slice(-4);paymentStatus='Pagado';paymentDetail='Pago con tarjeta confirmado en modo demostración';}else if(this.method==='Transferencia'){ref=(document.getElementById('transferRef')?.value||'').trim();if(ref.length<5){toast('Ingresa una referencia de transferencia válida','error');return;}paymentStatus='Pagado';paymentDetail='Transferencia registrada y marcada como pagada';}else{paymentDetail='El cliente pagará en efectivo personalmente al recoger o recibir el pedido';}const id=uid('ORD');const order={id,customer:currentUser(),customerName:document.body.dataset.userName||currentUser(),date:new Date().toISOString(),status:'Pendiente',payment:this.method,paymentStatus,paymentRef:ref,paymentDetail,orderType:sessionStorage.getItem('esfe_order_type')||'Mesa',note:sessionStorage.getItem('esfe_order_note')||'',subtotal:this.subtotal,tax:Number((this.total-this.subtotal).toFixed(2)),total:this.total,items:c};let orders=read(KEY.orders,[]);orders.unshift(order);write(KEY.orders,orders);if(paymentStatus==='Pagado'){let sales=read(KEY.sales,[]);sales.unshift({...order,saleStatus:'Cobrado'});write(KEY.sales,sales);}cartSave([]);sessionStorage.removeItem('esfe_order_type');sessionStorage.removeItem('esfe_order_note');addNotification(`Pedido ${id} creado. ${paymentStatus==='Pagado'?'Pago confirmado.':'Pago pendiente: se pagará en efectivo al recoger.'}`,currentUser());toast(paymentStatus==='Pagado'?`Pedido ${id} creado y pagado`:`Pedido ${id} creado. Pago en efectivo al recoger.`);setTimeout(()=>location.href='/GestionDePedidos1/Index',500);}};

    const orders={filter:'Todos',init(){this.render();setInterval(()=>this.render(),5000);},setFilter(f){this.filter=f;document.querySelectorAll('[data-status]').forEach(b=>b.classList.toggle('active',b.dataset.status===f));this.render();},render(){const all=read(KEY.orders,[]);const owner=currentRole()==='Dueno';const visible=owner?all:all.filter(o=>(o.customer||'cliente@restaurante.com')===currentUser());const search=(document.getElementById('ordersSearch')?.value||'').toLowerCase().trim();const filtered=visible.filter(o=>(this.filter==='Todos'||o.status===this.filter)&&(!search||[o.id,o.customer,o.customerName].filter(Boolean).some(v=>String(v).toLowerCase().includes(search))));const totalEl=document.getElementById('ordersTotal'),pendingEl=document.getElementById('ordersPending'),preparingEl=document.getElementById('ordersPreparing'),readyEl=document.getElementById('ordersReady');if(totalEl)totalEl.textContent=visible.length;if(pendingEl)pendingEl.textContent=visible.filter(o=>o.status==='Pendiente').length;if(preparingEl)preparingEl.textContent=visible.filter(o=>o.status==='Preparando').length;if(readyEl)readyEl.textContent=visible.filter(o=>o.status==='Listo').length;const box=document.getElementById('ordersGrid');if(!box)return;if(!filtered.length){box.innerHTML='<div class="empty-state compact"><span>▣</span><strong>No hay pedidos con ese filtro</strong><p>Los pedidos nuevos aparecerán aquí.</p></div>';return;}box.innerHTML=filtered.map(o=>{const paid=o.paymentStatus ? o.paymentStatus==='Pagado' : o.payment!=='Efectivo';const paymentLabel=paid?'Pagado':'Pendiente de pago';const paymentClass=paid?'success':'warning';return `<article class="order-card"><div class="order-card-head"><div><span class="order-id">${o.id}</span><small>${new Date(o.date).toLocaleString('es-SV')}</small></div><span class="status-pill ${o.status==='Listo'?'success':o.status==='Preparando'?'warning':'neutral'}">${o.status}</span></div><div class="order-payment-line"><span class="status-pill ${paymentClass}">💳 ${paymentLabel}</span><strong>${o.payment}</strong></div><div class="order-products">${o.items.map(i=>`<div><span>${i.qty}× ${i.name}</span><strong>${money(i.price*i.qty)}</strong></div>`).join('')}</div><div class="order-card-foot"><span>${o.orderType}</span><strong>${money(o.total)}</strong></div>${o.payment==='Efectivo'?'<div class="cash-note"><strong>Pago en efectivo:</strong> El cliente pagará en persona al recoger o recibir el pedido.</div>':''}${paid&&o.paymentRef?`<div class="paid-note"><strong>Pago confirmado</strong><span>Referencia: ${o.paymentRef}</span></div>`:''}${owner?`<div class="order-actions">${!paid&&o.payment==='Efectivo'?`<button class="secondary-btn small" onclick="ESFERestaurante.orders.markCashPaid('${o.id}')">Confirmar pago en efectivo</button>`:''}${o.status==='Pendiente'?`<button class="secondary-btn small" onclick="ESFERestaurante.orders.advance('${o.id}')">Enviar a cocina</button>`:''}${o.status==='Preparando'?`<button class="secondary-btn small" onclick="ESFERestaurante.orders.advance('${o.id}')">Marcar listo</button>`:''}${o.status==='Listo'?`<span class="status-pill success">Pasar a Entregas</span>`:''}</div>`:'<div class="order-actions"><span class="order-status-note">El restaurante actualizará el estado del pedido.</span></div>'}</article>`;}).join('');},markCashPaid(id){if(currentRole()!=='Dueno'){toast('Solo el dueño puede confirmar pagos','error');return;}let all=read(KEY.orders,[]);const o=all.find(x=>x.id===id);if(!o||o.payment!=='Efectivo')return;o.paymentStatus='Pagado';o.paymentDetail='Pago en efectivo recibido personalmente al recoger o recibir el pedido';o.paymentRef='EF-'+new Date().toISOString().replace(/\D/g,'').slice(0,14);write(KEY.orders,all);let sales=read(KEY.sales,[]);if(!sales.some(x=>x.id===id)){sales.unshift({...o,saleStatus:'Cobrado'});write(KEY.sales,sales);}if(o.customer)addNotification(`Pago recibido para tu pedido ${o.id}.`,o.customer);toast(`${id}: pago en efectivo confirmado`);this.render();},advance(id){if(currentRole()!=='Dueno'){toast('Solo el dueño puede actualizar el estado','error');return;}let all=read(KEY.orders,[]);const o=all.find(x=>x.id===id);if(!o)return;const old=o.status;o.status=o.status==='Pendiente'?'Preparando':o.status==='Preparando'?'Listo':'Entregado';if(o.customer)addNotification(`Tu pedido ${o.id} cambió de estado: ${o.status}.`,o.customer);write(KEY.orders,all);toast(`${id}: ${o.status}`);this.render();}};

    const kitchen={init(){this.render();setInterval(()=>this.render(),4000);},render(){const all=read(KEY.orders,[]);const groups=[['Pendiente','Por preparar'],['Preparando','Preparando'],['Listo','Listos']];document.getElementById('kitchenBoard').innerHTML=groups.map(([status,title])=>`<section class="kanban-col"><div class="kanban-head"><div><span>${title}</span><strong>${all.filter(o=>o.status===status).length}</strong></div></div><div class="kanban-list">${all.filter(o=>o.status===status).map(o=>`<article class="kitchen-card"><div class="order-card-head"><span class="order-id">${o.id}</span><span class="status-pill ${status==='Listo'?'success':status==='Preparando'?'warning':'neutral'}">${status}</span></div><strong>${o.items.map(i=>`${i.qty}× ${i.name}`).join(', ')}</strong><small>${o.customerName||o.customer||'Cliente'} · ${o.orderType} · ${o.payment}</small>${status==='Listo'?'<div class="cash-note"><strong>Preparado.</strong> El siguiente paso es Entregas, donde se busca al cliente y se notifica cuando se entregue.</div>':`<button class="primary-btn small full" onclick="ESFERestaurante.orders.advance('${o.id}')">${status==='Pendiente'?'Comenzar preparación':'Marcar listo'}</button>`}</article>`).join('')||'<div class="empty-state compact"><span>✓</span><p>Sin órdenes</p></div>'}</div></section>`).join('');}}
    const ready={
        search:'',
        init(){
            const input=document.getElementById('readySearch');
            input?.addEventListener('input',e=>{this.search=e.target.value.toLowerCase().trim();this.render();});
            this.render();
            setInterval(()=>this.render(),4000);
        },
        clearSearch(){this.search='';const input=document.getElementById('readySearch');if(input)input.value='';this.render();},
        render(){
            const all=read(KEY.orders,[]);
            const q=this.search;
            const list=all.filter(o=>o.status==='Listo'&&(!q||[o.id,o.customer,o.customerName].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))));
            const counter=document.getElementById('readyCounter');
            if(counter)counter.textContent=`${list.length} disponibles`;
            const box=document.getElementById('readyGrid');
            if(!box)return;
            if(!list.length){
                box.innerHTML='<div class="empty-state compact"><span>✓</span><strong>No hay pedidos listos</strong><p>'+(q?'Prueba con otro nombre, correo o número de pedido.':'Cuando cocina termine, aparecerán aquí.')+'</p></div>';
                return;
            }
            box.innerHTML=list.map(o=>{
                const customer=o.customerName||o.customer||'Cliente';
                const paymentNote=o.payment==='Efectivo'&&o.paymentStatus!=='Pagado'?'Pago en efectivo pendiente':'Pago registrado';
                return `<article class="order-card ready-card"><div class="order-card-head"><div><span class="order-id">${o.id}</span><small>${customer} · ${o.orderType}</small></div><span class="status-pill success">LISTO</span></div><div class="order-products">${o.items.map(i=>`<div><span>${i.qty}× ${i.name}</span></div>`).join('')}</div><div class="order-card-foot"><span>${o.payment}</span><strong>${money(o.total)}</strong></div><div class="cash-note"><strong>Cliente:</strong> ${customer}<span>${paymentNote}</span></div><button class="primary-btn full" onclick="ESFERestaurante.ready.deliver('${o.id}')">Marcar entregado y notificar ✓</button></article>`;
            }).join('');
        },
        deliver(id){
            if(currentRole()!=='Dueno'){toast('Solo el dueño puede entregar pedidos','error');return;}
            const all=read(KEY.orders,[]);
            const o=all.find(x=>x.id===id);
            if(!o||o.status!=='Listo')return;
            o.status='Entregado';
            o.deliveredAt=new Date().toISOString();
            write(KEY.orders,all);
            if(o.customer)addNotification(`Tu pedido ${o.id} fue entregado correctamente.`,o.customer);
            toast(`${id} entregado y cliente notificado`);
            this.render();
        }
    };

    const reports={
        init(){this.render();},
        render(){const sales=read(KEY.sales,[]), today=new Date().toISOString().split('T')[0], todays=sales.filter(s=>s.date.startsWith(today));const total=todays.reduce((sum,x)=>sum+Number(x.total||0),0),orders=todays.length;document.getElementById('reportSales').textContent=money(total);document.getElementById('reportOrders').textContent=orders;document.getElementById('reportAverage').textContent=money(orders?total/orders:0);document.getElementById('reportReservations').textContent=read(KEY.reservations,[]).filter(r=>r.date===today&&r.status==='Confirmada').length;document.getElementById('salesList').innerHTML=todays.slice(0,8).map(s=>`<div class="recent-row"><div><strong>${s.id}</strong><small>${s.payment} · ${new Date(s.date).toLocaleTimeString('es-SV',{hour:'2-digit',minute:'2-digit'})}</small></div><strong>${money(s.total)}</strong></div>`).join('')||'<div class="empty-state compact"><p>No hay ventas hoy.</p></div>';const methods=['Efectivo','Tarjeta','Transferencia'];const max=Math.max(1,...methods.map(m=>todays.filter(x=>x.payment===m).length));document.getElementById('paymentDistribution').innerHTML=methods.map(m=>{const n=todays.filter(x=>x.payment===m).length;return `<div class="distribution-row"><span>${m}</span><div><i style="width:${n/max*100}%"></i></div><strong>${n}</strong></div>`}).join('');this.renderSaved();},
        save(){const sales=read(KEY.sales,[]),today=new Date().toISOString().split('T')[0],todays=sales.filter(s=>s.date.startsWith(today)),total=todays.reduce((sum,x)=>sum+Number(x.total||0),0),snapshot={id:uid('REP'),date:new Date().toISOString(),period:today,sales:total,orders:todays.length,average:todays.length?Number((total/todays.length).toFixed(2)):0,reservations:read(KEY.reservations,[]).filter(r=>r.date===today&&r.status==='Confirmada').length,payments:{Efectivo:todays.filter(x=>x.payment==='Efectivo').length,Tarjeta:todays.filter(x=>x.payment==='Tarjeta').length,Transferencia:todays.filter(x=>x.payment==='Transferencia').length}};const saved=read(KEY.savedReports,[]);saved.unshift(snapshot);write(KEY.savedReports,saved);this.renderSaved();toast('Reporte guardado correctamente');},
        clearSaved(){if(!confirm('¿Limpiar los reportes guardados? Las ventas y pedidos no se eliminarán.'))return;write(KEY.savedReports,[]);this.renderSaved();toast('Reportes guardados limpiados','info');},
        renderSaved(){const box=document.getElementById('savedReportsList');if(!box)return;const saved=read(KEY.savedReports,[]);box.innerHTML=saved.length?saved.slice(0,10).map(r=>`<div class="recent-row"><div><strong>${r.period} · ${money(r.sales)}</strong><small>${r.orders} órdenes · ${r.reservations} reservas · ${new Date(r.date).toLocaleString('es-SV')}</small></div><span class="status-pill success">Guardado</span></div>`).join(''):'<div class="empty-state compact"><p>No hay reportes guardados.</p></div>';document.getElementById('savedReportsCount')&&(document.getElementById('savedReportsCount').textContent=saved.length);}
    };

    const adminProducts={
        editing:null,
        init(){this.refreshCategorySelect();this.render();this.renderCategories();},
        refreshCategorySelect(){const sel=document.getElementById('adminCategory');if(!sel)return;const cats=allCategories();sel.innerHTML=cats.map(c=>`<option value="${c.id}">${c.id}</option>`).join('');},
        render(){const box=document.getElementById('adminProductList');if(!box)return;const list=catalogProducts();box.innerHTML=list.map(p=>`<article class="admin-product-row"><img src="${p.image}" onerror="this.classList.add('image-missing')"><div><strong>${p.name}</strong><small>${p.cat} · ${money(p.price)}</small><p>${p.desc}</p><em>${p.ingredients.join(' · ')}</em></div><div class="admin-actions"><button class="secondary-btn small" onclick="ESFERestaurante.adminProducts.edit('${p.id}')">Editar</button><button class="danger-btn small" onclick="ESFERestaurante.adminProducts.remove('${p.id}')">Eliminar</button></div></article>`).join('')||'<div class="empty-state"><strong>No hay productos</strong></div>';document.getElementById('adminProductCount')&&(document.getElementById('adminProductCount').textContent=list.length);},
        renderCategories(){const box=document.getElementById('adminCategoryList');if(!box)return;box.innerHTML=customCategories().map(c=>`<div class="admin-category-row"><div><strong>${c.id}</strong><small>${c.desc}</small></div><span>Personalizada</span></div>`).join('')||'<div class="empty-state compact"><p>Las categorías base ya están listas. Aquí aparecerán las nuevas que agregues.</p></div>';document.getElementById('adminCategoryCount')&&(document.getElementById('adminCategoryCount').textContent=allCategories().length);},
        open(){if(currentRole()!=='Dueno'){toast('Solo el dueño puede administrar productos','error');return;}this.editing=null;this.fill(null);document.getElementById('productAdminModal')?.classList.remove('hidden');},
        edit(id){if(currentRole()!=='Dueno'){toast('Solo el dueño puede administrar productos','error');return;}const p=catalogProducts().find(x=>x.id===id);if(!p)return;this.editing=id;this.fill(p);document.getElementById('productAdminModal')?.classList.remove('hidden');},
        fill(p){this.refreshCategorySelect();document.getElementById('adminImageFile').value='';document.getElementById('adminName').value=p?.name||'';document.getElementById('adminCategory').value=p?.cat||allCategories()[0]?.id||'';document.getElementById('adminPrice').value=p?.price||'';document.getElementById('adminImage').value=p?.image||'';document.getElementById('adminDesc').value=p?.desc||'';document.getElementById('adminIngredients').value=p?.ingredients?.join(', ')||'';},
        save(){
            if(currentRole()!=='Dueno'){toast('Solo el dueño puede guardar productos','error');return;}
            const name=document.getElementById('adminName').value.trim(),cat=document.getElementById('adminCategory').value,price=Number(document.getElementById('adminPrice').value),imageInput=document.getElementById('adminImageFile'),typedImage=document.getElementById('adminImage').value.trim(),desc=document.getElementById('adminDesc').value.trim(),ingredients=document.getElementById('adminIngredients').value.split(',').map(x=>x.trim()).filter(Boolean);
            if(!name||!cat||!price||!desc||!ingredients.length){toast('Completa nombre, categoría, precio, descripción e ingredientes','error');return;}
            const newId=this.editing||'prod-'+Date.now();
            const finish=image=>{const finalImage=image||typedImage||`/images/productos/${newId}.jpg`;saveProductOverride({id:newId,cat,name,price,image:finalImage,desc,ingredients,tags:['Administrado']});this.close();this.render();toast(this.editing?'Producto actualizado':'Producto agregado');};
            if(imageInput?.files?.length){const file=imageInput.files[0];if(!file.type.startsWith('image/')){toast('Selecciona una imagen válida','error');return;}const reader=new FileReader();reader.onload=()=>finish(reader.result);reader.readAsDataURL(file);}else finish('');
        },
        addCategory(){if(currentRole()!=='Dueno'){toast('Solo el dueño puede agregar categorías','error');return;}const name=document.getElementById('adminNewCategoryName')?.value.trim(),desc=document.getElementById('adminNewCategoryDesc')?.value.trim(),image=document.getElementById('adminNewCategoryImage')?.value.trim();if(!name||!desc){toast('Escribe el nombre y la descripción de la categoría','error');return false;}if(allCategories().some(c=>c.id.toLowerCase()===name.toLowerCase())){toast('Esa categoría ya existe','error');return false;}const id=name.replace(/\s+/g,' ').trim();const list=customCategories();list.push({id,image:image||`/images/categorias/${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.jpg`,desc});write(KEY.customCategories,list);['adminNewCategoryName','adminNewCategoryDesc','adminNewCategoryImage'].forEach(x=>{const e=document.getElementById(x);if(e)e.value='';});this.refreshCategorySelect();this.renderCategories();toast('Categoría agregada correctamente');return true;},
        remove(id){if(currentRole()!=='Dueno'){toast('Solo el dueño puede eliminar productos','error');return;}if(!confirm('¿Eliminar este producto del menú?'))return;deleteCatalogProduct(id);this.render();toast('Producto eliminado','info');},
        close(){document.getElementById('productAdminModal')?.classList.add('hidden');}
    };

    const dashboard={init(){this.render();setInterval(()=>this.render(),5000);},render(){const allOrders=read(KEY.orders,[]),allSales=read(KEY.sales,[]),res=read(KEY.reservations,[]),today=new Date().toISOString().split('T')[0],owner=currentRole()==='Dueno',user=currentUser();const orders=owner?allOrders:allOrders.filter(o=>(o.customer||'cliente@restaurante.com')===user);const sales=owner?allSales:allSales.filter(s=>(s.customer||'cliente@restaurante.com')===user);const todays=sales.filter(s=>s.date.startsWith(today));document.getElementById('cardPedidosHoy').textContent=orders.filter(o=>o.date.startsWith(today)).length;document.getElementById('cardEnPreparacion').textContent=orders.filter(o=>o.status==='Preparando').length;document.getElementById('cardVentasHoy').textContent=money(todays.reduce((s,x)=>s+x.total,0));document.getElementById('cardMesas').textContent=owner?tables.length-res.filter(r=>r.date===today&&r.status==='Confirmada').length:res.filter(r=>r.date===today&&r.customer===user&&r.status==='Confirmada').length;document.getElementById('cardProductos').textContent=catalogProducts().length;document.getElementById('ultimaActualizacion').textContent=new Date().toLocaleTimeString('es-SV',{hour:'2-digit',minute:'2-digit',second:'2-digit'});const box=document.getElementById('recentOrders');const list=orders.slice(0,5);box.innerHTML=list.map(o=>`<div class="recent-row"><div><strong>${o.id}</strong><small>${o.items.map(i=>`${i.qty}× ${i.name}`).join(', ')}</small></div><span class="status-pill ${o.status==='Listo'?'success':o.status==='Preparando'?'warning':'neutral'}">${o.status}</span></div>`).join('')||'<div class="empty-state compact"><p>No hay pedidos todavía.</p></div>';}};

    const notifications={init(){this.render();updateNotificationBadges()},render(){const box=document.getElementById('notificationList');if(!box)return;const list=notificationsGet().filter(x=>x.user===currentUser());if(!list.length){box.innerHTML='<div class="empty-state"><strong>No tienes notificaciones</strong><p>Cuando tu pedido cambie de estado aparecerá aquí.</p></div>';return}box.innerHTML=list.map(n=>'<article class="notification-item '+(n.read?'read':'unread')+'"><div class="notification-icon">'+(n.message.toLowerCase().includes('entregado')?'✓':'✉')+'</div><div><strong>'+n.message+'</strong><small>'+new Date(n.date).toLocaleString('es-SV')+'</small></div></article>').join('')},markAllRead(){const list=notificationsGet();list.forEach(n=>{if(n.user===currentUser())n.read=true});notificationsSave(list);this.render();updateNotificationBadges()}};
    setInterval(()=>{updateNotificationBadges();const box=document.getElementById('notificationList');if(box)notifications.render();},3000);
    return {products,categories,tables,money,KEY,layout,chat,menu,cart,reservas,payment,orders,kitchen,ready,reports,dashboard,adminProducts,notifications,ui:{mostrarToast:toast}};

})();
document.addEventListener('DOMContentLoaded',()=>ESFERestaurante.layout.init());
>>>>>>> ya estan todos los cambios revicen que funcione
