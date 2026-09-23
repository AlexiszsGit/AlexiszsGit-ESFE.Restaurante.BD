
// Procesa la información de esferestaurante.
const ESFERestaurante = (() => {
    const KEY = { cart:'esfe_carrito', orders:'esfe_pedidos', sales:'esfe_ventas', reservations:'esfe_reservas', user:'usuarioLogueado', ratings:'restaurantebd_calificaciones', notifications:'restaurantebd_notificaciones', productOverrides:'restaurantebd_product_overrides', productDeleted:'restaurantebd_product_deleted', customCategories:'restaurantebd_custom_categories', savedReports:'esfe_reportes_guardados', reportPeriod:'esfe_report_periodo_inicio', reportArchive:'esfe_reportes_semanales' };
    // Convierte la configuración de tiempo a minutos.
    const settingMinutes = name => { const raw=document.body?.dataset?.[name]||''; const m=/(\d{2}):(\d{2})/.exec(raw); return m ? Number(m[1])*60+Number(m[2]) : (name==='opening'?360:1320); };
    // Obtiene el porcentaje de impuesto configurado.
    const taxRate = () => Math.max(0,Number(document.body?.dataset?.tax||13))/100;
    // Procesa la información de currency.
    const currency = () => document.body?.dataset?.currency || '$';
    // Da formato monetario a un valor antes de mostrarlo.
    const money = value => { const amount=(Number(value)||0); return `${currency()}${amount.toFixed(2)}`; };
    // Procesa la información de restaurant hours.
    const restaurantHours = () => `${document.body?.dataset?.opening||'06:00'}–${document.body?.dataset?.closing||'22:00'}`;
    const localDate = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    // Procesa la información de format date time.
    const formatDateTime = (value, options={}) => { const d=value instanceof Date ? value : new Date(value); return Number.isNaN(d.getTime()) ? 'Fecha no disponible' : d.toLocaleString('es-SV',{dateStyle:'medium',timeStyle:'short',...options}); };
    // Genera o recupera el identificador único usado por el módulo.
    const uid = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*900+100)}`;
    // Lee los datos guardados del módulo.
    const read = (key, fallback=[]) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
    // Guarda los datos actuales del módulo.
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

    // IMÁGENES DE CATEGORÍAS
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
    // Obtiene las categorías personalizadas del menú.
    const customCategories = () => read(KEY.customCategories,[]);
    // Obtiene todas las categorías disponibles.
    const allCategories = () => [...categories, ...customCategories().filter(c=>!categories.some(x=>x.id===c.id))];
    // IMÁGENES DE LOS PRODUCTOS
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
        {id:'combo-pizza',cat:'Combos',name:'Combo Pizza Familiar',price:13.50,image:'/images/productos/combo-pizza.jpeg',desc:'Pizza Pepperoni + 2 bebidas.',ingredients:['Pizza Pepperoni','2 Coca-Cola'],tags:['Familiar']},
        {id:'combo-tacos',cat:'Combos',name:'Combo Tacos',price:8.75,image:'/images/productos/tacos.jpg',desc:'Tacos de carne + bebida + postre.',ingredients:['Tacos de Carne','Coca-Cola','Brownie'],tags:['Completo']},
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
    // Carga los productos que forman parte del catálogo.
    const catalogProducts = () => { const deleted=read(KEY.productDeleted,[]); const overrides=read(KEY.productOverrides,[]); const map=new Map(overrides.map(x=>[x.id,x])); return products.filter(p=>!deleted.includes(p.id)).map(p=>map.get(p.id)||p).concat(overrides.filter(x=>!products.some(p=>p.id===x.id))); };
    // Guarda la personalización realizada sobre un producto.
    const saveProductOverride = p => { let a=read(KEY.productOverrides,[]); a=a.filter(x=>x.id!==p.id); a.push(p); write(KEY.productOverrides,a); };
    // Elimina o limpia los datos de catalog product.
    const deleteCatalogProduct = id => { let a=read(KEY.productDeleted,[]); if(!a.includes(id))a.push(id); write(KEY.productDeleted,a); };

    const tables = [
        {id:1,seats:2,zone:'Ventana',x:12,y:24,shape:'round'},{id:2,seats:4,zone:'Ventana',x:30,y:22,shape:'square'},{id:3,seats:6,zone:'Centro',x:49,y:22,shape:'round'},
        {id:4,seats:4,zone:'Centro',x:68,y:22,shape:'square'},{id:5,seats:8,zone:'Familiar',x:86,y:24,shape:'rect'}, {id:6,seats:2,zone:'Barra',x:15,y:53,shape:'round'},
        {id:7,seats:4,zone:'Centro',x:34,y:50,shape:'square'},{id:8,seats:6,zone:'Centro',x:53,y:52,shape:'round'},{id:9,seats:4,zone:'Centro',x:73,y:50,shape:'square'},
        {id:10,seats:8,zone:'Familiar',x:88,y:52,shape:'rect'},{id:11,seats:2,zone:'Barra',x:28,y:79,shape:'round'},{id:12,seats:4,zone:'Terraza',x:61,y:80,shape:'square'}
    ];

    // Comprueba si existe una sesión de usuario válida.
    function isAuthenticated(){return document.body?.dataset.auth==='True'||document.body?.dataset.auth==='true'}
    // Procesa la información de current user.
    function currentUser(){return document.body?.dataset.user || (isAuthenticated()?localStorage.getItem(KEY.user)||'':'')}
    // Procesa la información de current role.
    function currentRole(){return (document.body?.dataset.role||'Publico').trim()}
    // Procesa la información de ratings get.
    function ratingsGet(){return read(KEY.ratings,[])}
    // Procesa la información de ratings save.
    function ratingsSave(list){write(KEY.ratings,list)}
    // ===== CENTRO DE NOTIFICACIONES =====
    // Una notificación puede pertenecer a un usuario concreto o a uno/más roles operativos.
    // Esto permite que el mismo centro funcione para cliente, dueño, cocina, barra y reparto.
    // Procesa la información de notifications get.
    function notificationsGet(){return read(KEY.notifications,[])}
    // Procesa la información de notifications save.
    function notificationsSave(list){write(KEY.notifications,list)}
    // Procesa la información de notification visible.
    function notificationVisible(n){
        const role=currentRole();
        if(n?.sent) return n?.user===currentUser();
        return n?.user===currentUser() || (Array.isArray(n?.roles) && n.roles.includes(role));
    }
    // Guarda la notificación y actualiza su estado en la aplicación.
    function addNotification(message,user,meta={}){
        const list=notificationsGet();
        list.unshift({
            id:uid('NOT'), user:user||null, roles:Array.isArray(meta.roles)?meta.roles:[], message,
            date:new Date().toISOString(), read:false, starred:false, sent:false,
            type:meta.type||'general', orderId:meta.orderId||'',
            title:meta.title||'Notificación', detail:meta.detail||message,
            action:meta.action||null, fromName:meta.fromName||'RestauranteBD', fromEmail:meta.fromEmail||'notificaciones@restaurantebd.local',
            toName:meta.toName||'', toEmail:meta.toEmail||'', archived:!!meta.archived
        });
        notificationsSave(list);
        updateNotificationBadges();
    }
    // Actualiza los contadores visibles de notificaciones.
    function updateNotificationBadges(){
        const n=notificationsGet().filter(x=>notificationVisible(x)&&!x.read&&!x.sent&&!x.archived).length;
        document.querySelectorAll('#notificationBadge,#topNotificationBadge').forEach(e=>e.textContent=n);
    }

    // Procesa la información de cart get.
    function cartGet(){return read(KEY.cart,[])}
    // Procesa la información de cart save.
    function cartSave(c){write(KEY.cart,c); updateCartBadges();updateNotificationBadges();}
    // Actualiza los contadores visibles del carrito.
    function updateCartBadges(){const n=cartGet().reduce((s,i)=>s+Number(i.qty),0);document.querySelectorAll('[data-cart-badge]').forEach(e=>e.textContent=n);}
    // Muestra un aviso breve con el resultado de una acción.
    function toast(message,type='success'){const c=document.getElementById('toast-container');if(!c)return;const el=document.createElement('div');el.className=`toast ${type}`;el.innerHTML=`<span>${type==='success'?'✓':type==='error'?'!':'i'}</span><strong>${message}</strong>`;c.appendChild(el);setTimeout(()=>el.remove(),3200)}

    // Estado compartido del módulo: welcome.
    const welcome = {
        init(){
            const hero=document.getElementById("loginWelcomeHero");
            if(!hero || hero.dataset.initialized === "1") return;
            hero.dataset.initialized="1";
            document.body.classList.add("welcome-active");
            requestAnimationFrame(()=>hero.classList.add("is-visible"));
            window.setTimeout(()=>this.dismiss(),2600);
        },
        dismiss(){
            const hero=document.getElementById("loginWelcomeHero");
            if(!hero || hero.dataset.closing === "1") return;
            hero.dataset.closing="1";
            hero.classList.remove("is-visible");
            hero.classList.add("is-hidden");
            window.setTimeout(()=>{ hero.remove(); document.body.classList.remove("welcome-active"); },420);
        }
    };
    // Estado compartido del módulo: layout.
    const layout={
        toggleSidebar(show){document.getElementById('appSidebar')?.classList.toggle('open',show);document.getElementById('mobileOverlay')?.classList.toggle('show',show);},
        init(){
            const user=currentUser();
            const name=document.body?.dataset.userName||user.split('@')[0].replace(/[._-]+/g,' ');
            const pretty=name.replace(/\b\w/g,x=>x.toUpperCase());
            ['usuarioNombreSide','usuarioNombreTop'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=pretty});
            ['avatarUsuario','avatarUsuarioTop'].forEach(id=>{const e=document.getElementById(id);if(e&&!e.querySelector('img'))e.textContent=pretty.charAt(0).toUpperCase()});
            const trigger=document.querySelector('.profile-menu-trigger'),menu=document.getElementById('profileContextMenu');
            if(trigger&&menu){
                // Cierra el formulario o módulo actualmente abierto.
                const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false')};
                // Evento que conecta una acción del usuario con la lógica del módulo.
                trigger.addEventListener('click',e=>{e.preventDefault();menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden))});
                // Evento que conecta una acción del usuario con la lógica del módulo.
                document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!trigger.contains(e.target))close()});
                // Evento que conecta una acción del usuario con la lógica del módulo.
                document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
            }
            const nav=document.querySelector('.side-nav');
            if(nav){
                const role=document.body?.dataset?.role||'Publico';
                const key=`restaurantebd_sidebar_scroll_${role}`;
                let restored=false;
                try{const raw=sessionStorage.getItem(key);if(raw!==null&&Number.isFinite(Number(raw))){nav.scrollTop=Math.max(0,Number(raw));restored=true;}}catch{}
                if(!restored){
                    requestAnimationFrame(()=>{
                        const current=nav.querySelector('a.active,[aria-current="page"]');
                        if(current){const top=current.offsetTop,bottom=top+current.offsetHeight;if(top<nav.scrollTop)nav.scrollTop=Math.max(0,top-18);else if(bottom>nav.scrollTop+nav.clientHeight)nav.scrollTop=Math.max(0,bottom-nav.clientHeight+18);}
                    });
                }
                let timer;
                // Procesa la información de save.
                const save=()=>{clearTimeout(timer);timer=setTimeout(()=>{try{sessionStorage.setItem(key,String(Math.round(nav.scrollTop)))}catch{}},80)};
                // Guarda inmediatamente los cambios actuales.
                const saveNow=()=>{try{sessionStorage.setItem(key,String(Math.round(nav.scrollTop)))}catch{}};
                // Evento que conecta una acción del usuario con la lógica del módulo.
                nav.addEventListener('scroll',save,{passive:true});
                // Evento que conecta una acción del usuario con la lógica del módulo.
                nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',saveNow));
                // Evento que conecta una acción del usuario con la lógica del módulo.
                window.addEventListener('pagehide',saveNow);
            }
            updateCartBadges();updateNotificationBadges();
        }
    };
    // Estado compartido del módulo: chat.
    const chat = {
        toggle(show) {
            const el = document.getElementById('chatbot');
            el?.classList.toggle('show', Boolean(show));
            if (!show) this.stopVoiceMode?.();
        }
    };
    // Estado compartido del módulo: menu.
    const menu={
        selected:'Todas',term:'',priceMax:'',sort:'relevance',tag:'Todos',modalCategory:null,modalProduct:null,
        init(){this.renderCategories();this.bindFilters();this.renderProducts();},
        bindFilters(){
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById('menuSearch')?.addEventListener('input',e=>{this.term=e.target.value.toLowerCase().trim();this.renderCategoryModal();});
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById('menuFilterCategory')?.addEventListener('change',e=>{this.selected=e.target.value;this.renderCategoryModal();});
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById('menuFilterPrice')?.addEventListener('change',e=>{this.priceMax=e.target.value;this.renderCategoryModal();});
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById('menuFilterTag')?.addEventListener('change',e=>{this.tag=e.target.value;this.renderCategoryModal();});
            // Evento que conecta una acción del usuario con la lógica del módulo.
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
            grid.innerHTML=list.map(p=>`<article class="product-card" tabindex="0" role="button" aria-label="Ver ${p.name}" onclick="ESFERestaurante.menu.openModal('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ESFERestaurante.menu.openModal('${p.id}')}"><div class="product-image"><img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.classList.add('image-missing')" /><div class="product-tags">${(p.tags||[]).map(t=>`<span>${t}</span>`).join('')}</div></div><div class="product-card-body"><span class="product-category">${p.cat}</span><h4>${p.name}</h4><p>${p.desc}</p><div class="product-footer"><strong>${money(p.price)}</strong><div class="menu-result-actions"><button type="button" class="product-view-btn" onclick="event.stopPropagation();ESFERestaurante.menu.openModal('${p.id}')">Detalles <span class="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span></button></div></div></div></article>`).join('')||`<div class="empty-state"><strong>No encontramos productos</strong><p>Prueba otra combinación de filtros.</p></div>`;
            modal.classList.remove('hidden');
        },
        closeCategory(){document.getElementById('categoryModal')?.classList.add('hidden')},
        openModal(id){const p=catalogProducts().find(x=>x.id===id);if(!p)return;const m=document.getElementById('productModal');if(!m)return;const localRole=document.body?.dataset.localOrders==='true' || ['Dueno','Administrador','Barra'].includes(currentRole());const action=localRole?`<label class="field-label">Cantidad<div class="qty-control large"><button type="button" aria-label="Disminuir cantidad" onclick="ESFERestaurante.menu.adjustModal(-1)">−</button><input id="modalQty" type="number" min="1" max="20" value="1" inputmode="numeric" aria-label="Cantidad" /><button type="button" aria-label="Aumentar cantidad" onclick="ESFERestaurante.menu.adjustModal(1)">+</button></div></label><button class="primary-btn large full" onclick="const q=Number(document.getElementById('modalQty')?.value||1);ESFERestaurante.localOrders?.openFromMenu?.('${p.id}',q)">Agregar al pedido local</button>`:isAuthenticated()?`<label class="field-label">Cantidad<div class="qty-control large"><button type="button" aria-label="Disminuir cantidad" onclick="ESFERestaurante.menu.adjustModal(-1)">−</button><input id="modalQty" type="number" min="1" max="20" value="1" inputmode="numeric" aria-label="Cantidad" /><button type="button" aria-label="Aumentar cantidad" onclick="ESFERestaurante.menu.adjustModal(1)">+</button></div></label><button class="primary-btn large full" onclick="ESFERestaurante.menu.addModal('${p.id}')">Agregar al carrito</button>`:`<div class="login-required-note"><strong>Inicia sesión para realizar pedidos</strong><p>Puedes consultar el menú y los productos sin una cuenta. Para agregar al carrito necesitas iniciar sesión o crear una cuenta.</p><a class="primary-btn large full" href="/IniciarSesion1/Index">Iniciar sesión →</a></div>`;document.getElementById('productModalContent').innerHTML=`<div class="product-detail"><div class="detail-image"><img src="${p.image}" alt="${p.name}" onerror="this.classList.add('image-missing')" /></div><div class="detail-content"><span class="product-category">${p.cat}</span><h2>${p.name}</h2><p>${p.desc}</p><div class="price-big">${money(p.price)}</div><div class="ingredient-block"><span>Ingredientes</span><div>${p.ingredients.map(i=>`<span>${i}</span>`).join('')}</div></div>${action}</div></div>`;m.classList.remove('hidden');this.modalProduct=p.id;},
        adjustModal(delta){const i=document.getElementById('modalQty');if(!i)return;const current=Number(i.value);const base=Number.isFinite(current)&&current>0?current:1;i.value=Math.min(20,Math.max(1,base+delta));},
        addModal(id){if(!isAuthenticated()||currentRole()!=='Cliente'){toast('Inicia sesión con una cuenta de cliente para realizar pedidos','error');return;}const p=catalogProducts().find(x=>x.id===id);if(!p)return;const raw=document.getElementById('modalQty')?.value;const qty=Number(raw);if(!Number.isInteger(qty)||qty<1||qty>20){toast('La cantidad debe ser un número entero entre 1 y 20.','error');return;}let c=cartGet();const item=c.find(x=>x.productId===id);if(item)item.qty=Math.min(20,item.qty+qty);else c.push({productId:p.id,name:p.name,price:p.price,image:p.image,qty,ingredients:p.ingredients});cartSave(c);toast(`${qty} × ${p.name} agregado al carrito`);this.closeModal();},
        quickAdd(id){this.openModal(id);},
        closeModal(){document.getElementById('productModal')?.classList.add('hidden');}
    };
    // Estado compartido del módulo: cart.
    const cart={
        init(){this.render();this.toggleDeliveryFields();const phone=document.getElementById('deliveryPhone'),address=document.getElementById('deliveryAddress');if(phone&&!phone.value)phone.value=document.body.dataset.phone||'';if(address&&!address.value)address.value=document.body.dataset.address||'';},
        render(){const box=document.getElementById('cartItems');if(!box)return;let c=cartGet().filter(i=>Number.isInteger(Number(i.qty))&&Number(i.qty)>0).map(i=>({...i,qty:Math.min(20,Number(i.qty))}));cartSave(c);document.getElementById('cartItemSummary').textContent=`${c.reduce((s,i)=>s+i.qty,0)} unidades · ${c.length} productos`;if(!c.length){box.innerHTML=`<div class="empty-state"><span class="ui-icon cart-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 4h2l1.7 10.1a2 2 0 0 0 2 1.9h7.8a2 2 0 0 0 1.9-1.5L20 8H7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19" r="1.4" fill="currentColor"/><circle cx="17" cy="19" r="1.4" fill="currentColor"/></svg></span><strong>Tu carrito está vacío</strong><p>Agrega productos desde el menú.</p><a class="primary-btn" href="/GestionDeMenu1/Index">Ir al menú <span class="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></a></div>`;this.updateTotals();return;}box.innerHTML=c.map(i=>`<div class="cart-line"><img src="${i.image}" alt="${i.name}" onerror="this.src='/images/productos/piz-pep.jpg' /><!-- IMAGEN DEL PRODUCTO: fotografía del producto, JPG/PNG --><div class="cart-main"><strong>${i.name}</strong><small>${(i.ingredients||[]).slice(0,4).join(' · ')}</small><div class="qty-control"><button type="button" onclick="ESFERestaurante.cart.adjust('${i.productId}',-1)">−</button><input value="${i.qty}" min="1" type="number" onchange="ESFERestaurante.cart.setQty('${i.productId}',this.value)" /><button type="button" onclick="ESFERestaurante.cart.adjust('${i.productId}',1)">+</button><button type="button" class="cart-remove-small" title="Eliminar producto" aria-label="Eliminar ${i.name} del carrito" onclick="ESFERestaurante.cart.remove('${i.productId}')">🗑</button></div></div><strong class="line-total">${money(i.price*i.qty)}</strong></div>`).join('');this.updateTotals();},
        updateTotals(){const c=cartGet();const sub=c.reduce((s,i)=>s+i.price*i.qty,0);const tax=sub*taxRate();document.getElementById('cartSubtotal').textContent=money(sub);document.getElementById('cartTax').textContent=money(tax);document.getElementById('cartTotal').textContent=money(sub+tax);const b=document.getElementById('goPay');if(b)b.disabled=!c.length;},
        adjust(id,d){let c=cartGet();const i=c.find(x=>x.productId===id);if(!i)return;i.qty=Math.max(1,i.qty+d);cartSave(c);this.render();},
        setQty(id,q){let c=cartGet();const i=c.find(x=>x.productId===id);if(!i)return;const value=Number(q);if(!Number.isInteger(value)||value<1||value>20){toast('La cantidad debe ser un número entero entre 1 y 20.','error');this.render();return;}i.qty=value;cartSave(c);this.render();},
        remove(id){cartSave(cartGet().filter(x=>x.productId!==id));this.render();toast('Producto eliminado','info');},
        clear(){cartSave([]);this.render();toast('Carrito vaciado','info');},
        toggleDeliveryFields(){const type=document.getElementById('orderType')?.value;const box=document.getElementById('deliveryFields');if(box)box.classList.toggle('hidden',type!=='Domicilio');},
        checkout(){
            if(!isAuthenticated()||currentRole()!=='Cliente'){toast('Inicia sesión con una cuenta de cliente para crear pedidos','error');return;}
            if(!cartGet().length){toast('Agrega productos antes de continuar','error');return;}
            const now=new Date();const open=now.getHours()*60+now.getMinutes();if(open<settingMinutes('opening')||open>settingMinutes('closing')){toast(`El restaurante está cerrado. Horario de atención: ${restaurantHours()}`,'error');return;}
            const type=document.getElementById('orderType')?.value||'Mesa';
            const note=document.getElementById('orderNote')?.value.trim()||'';
            sessionStorage.setItem('esfe_order_type',type); sessionStorage.setItem('esfe_order_note',note);
            if(type==='Domicilio'){
                const phone=(document.getElementById('deliveryPhone')?.value||document.body.dataset.phone||'').trim();
                const address=(document.getElementById('deliveryAddress')?.value||document.body.dataset.address||'').trim();
                if(new String(phone).replace(/\D/g,'').length<7||new String(phone).replace(/\D/g,'').length>15||address.length<5){toast('Completa un teléfono válido y una dirección válida para el domicilio','error');return;}
                sessionStorage.setItem('esfe_delivery_phone',phone); sessionStorage.setItem('esfe_delivery_address',address);
            } else if(type==='Mesa'){
                sessionStorage.setItem('esfe_return_to_payment','1');
                window.location.href='/ReservarMesas1/Index'; return;
            }
            window.location.href='/ProcesarPago1/Index';
        }
    };

    // Estado compartido del módulo: reservas.
    const reservas={
        selected:null,
        // Evento que conecta una acción del usuario con la lógica del módulo.
        init(){const d=new Date(),dateInput=document.getElementById('reserveDate'),timeInput=document.getElementById('reserveTime');if(dateInput){dateInput.value=this.localDate(d);dateInput.min=this.localDate(d);dateInput.addEventListener('change',()=>{this.selected=null;this.render();});}if(timeInput){timeInput.value='19:00';timeInput.addEventListener('change',()=>{this.selected=null;this.render();});}this.render();this.renderList();},
        localDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},
        inOpeningHours(time){const m=/^(\d{2}):(\d{2})$/.exec(time||'');if(!m)return false;const minutes=Number(m[1])*60+Number(m[2]);return minutes>=settingMinutes('opening')&&minutes<=settingMinutes('closing');},
        isReserved(t){const date=document.getElementById('reserveDate')?.value||this.localDate(new Date()),time=document.getElementById('reserveTime')?.value||'19:00';return this.inOpeningHours(time)&&read(KEY.reservations,[]).some(r=>r.tableId===t.id&&r.date===date&&r.time===time&&(r.status==='Confirmada'||r.status==='Atendida')&&!r.noShow);},
        render(){const box=document.getElementById('tablesMap');if(!box)return;const worker=['Dueno','Administrador'].includes(currentRole())||currentRole()==='Barra';const allOrders=read(KEY.orders,[]);const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const timeSince=d=>{const ms=Math.max(0,Date.now()-new Date(d||Date.now()).getTime());const m=Math.floor(ms/60000);return m<1?'Ahora':`${m} min`};box.innerHTML=tables.map(t=>{const active=allOrders.find(o=>Number(o.tableId)===Number(t.id)&&['Pendiente','Preparando','Listo'].includes(o.status));const reserved=this.isReserved(t),selected=this.selected===t.id;const state=active?'occupied':reserved?'reserved':'available';const waiter=active?.assignedAttendantName||active?.mesero||'Sin asignar';const subtotal=active?.subtotal??active?.total??0;const tip=active?`Ocupada · Mesero: ${waiter} · ${timeSince(active?.date)} · ${money(subtotal)}`:`Mesa ${String(t.id).padStart(2,'0')} · ${t.seats} personas · Zona ${t.zone}`;return `<button type="button" class="restaurant-table ${t.shape} ${state} ${selected?'selected':''}" style="left:${t.x}%;top:${t.y}%" ${active||reserved?'disabled':''} title="${esc(tip)}" data-table-tooltip="${esc(tip)}" data-table-id="${t.id}"><span class="table-status-dot ${state}"></span><strong>${String(t.id).padStart(2,'0')}</strong><small>${t.seats}p</small></button>`}).join('');this.renderSelected();},
        select(id){const t=tables.find(x=>x.id===id);if(!t||this.isReserved(t)){toast('Mesa no disponible para ese horario','error');return;}this.selected=id;this.render();},
        renderSelected(){const t=tables.find(x=>x.id===this.selected),selected=document.getElementById('selectedTable'),info=document.getElementById('selectedTableInfo');if(!selected||!info)return;selected.textContent=t?`Mesa ${String(t.id).padStart(2,'0')}`:'Selecciona una mesa';info.textContent=t?`${t.seats} personas · Zona ${t.zone}`:'Elige una mesa disponible en el croquis.';},
        save(){
            if(currentRole()!=='Cliente'){toast('Este perfil solo puede consultar las reservas','error');return;}
            const name=document.getElementById('reserveName').value.trim(),date=document.getElementById('reserveDate').value,time=document.getElementById('reserveTime').value,people=Number(document.getElementById('reservePeople').value),t=tables.find(x=>x.id===this.selected);
            if(!name||!date||!time||!t){toast('Completa nombre, mesa, fecha y hora','error');return;}
            if(!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,80}$/.test(name)){toast('El nombre solo puede contener letras, espacios, apóstrofes y guiones','error');return;}
            const today=this.localDate(new Date());if(date<today){toast('La fecha de reserva no puede ser anterior a hoy','error');return;}
            if(date===today){const current=new Date();const selectedMinutes=Number(time.slice(0,2))*60+Number(time.slice(3,5));const currentMinutes=current.getHours()*60+current.getMinutes();if(selectedMinutes<=currentMinutes){toast('La hora de la reserva debe ser posterior a la hora actual','error');return;}}
            if(people<1||people>t.seats){toast(`La Mesa ${String(t.id).padStart(2,'0')} tiene ${t.seats} asientos`,'error');return;}
            const valid=this.inOpeningHours(time);let all=read(KEY.reservations,[]);
            if(valid&&all.some(r=>r.tableId===t.id&&r.date===date&&r.time===time&&(r.status==='Confirmada'||r.status==='Atendida')&&!r.noShow)){toast('Esa mesa ya fue reservada','error');return;}
            const reservation={id:uid('RES'),customer:currentUser(),customerName:document.body.dataset.userName||name,customerPhone:document.body.dataset.phone||'',customerDui:document.body.dataset.dui||'',tableId:t.id,table:`Mesa ${String(t.id).padStart(2,'0')}`,name,people,date,time,zone:t.zone,status:valid?'Confirmada':'Fuera de horario',arrived:false,createdAt:new Date().toISOString()};
            all.push(reservation);write(KEY.reservations,all);this.selected=null;document.getElementById('reserveName').value='';this.render();this.renderList();
            if(!valid){toast('Reserva registrada como fuera de horario. La mesa permanece disponible.','info');}
            else toast(`Reserva confirmada en Mesa ${String(t.id).padStart(2,'0')}`);
            if(sessionStorage.getItem('esfe_return_to_payment')==='1'){sessionStorage.removeItem('esfe_return_to_payment');sessionStorage.setItem('esfe_reservation_id',reservation.id);setTimeout(()=>location.href='/ProcesarPago1/Index',350);}
        },
        canManage(){return ['Dueno','Administrador','Barra'].includes(currentRole());},
        markArrived(id){if(!this.canManage()){toast('No tienes permiso para registrar llegadas','error');return;}const all=read(KEY.reservations,[]),r=all.find(x=>x.id===id);if(!r)return;r.arrived=true;r.noShow=false;r.arrivalAt=new Date().toISOString();r.status='Atendida';write(KEY.reservations,all);this.render();this.renderList();toast(`${r.name} marcado como llegado`,'success');},
        markNoShow(id){if(!this.canManage()){toast('No tienes permiso para registrar inasistencias','error');return;}const all=read(KEY.reservations,[]),r=all.find(x=>x.id===id);if(!r)return;if(!confirm(`¿Registrar que ${r.name} no llegó? La reserva se eliminará y la mesa quedará disponible.`))return;write(KEY.reservations,all.filter(x=>x.id!==id));this.selected=null;this.render();this.renderList();toast(`Reserva de ${r.name} eliminada por inasistencia`,'info');},
        finish(id){if(!this.canManage()){toast('No tienes permiso para finalizar reservas','error');return;}const all=read(KEY.reservations,[]),r=all.find(x=>x.id===id);if(!r)return;if(!r.arrived){toast('Primero registra la llegada o la inasistencia.','error');return;}if(!confirm(`¿Registrar la salida de ${r.name}? La reserva se eliminará y la mesa quedará disponible.`))return;write(KEY.reservations,all.filter(x=>x.id!==id));this.selected=null;this.render();this.renderList();toast(`Salida registrada para ${r.name}`,'success');},
        renderList(){const date=this.localDate(new Date()),worker=this.canManage(),user=currentUser(),list=read(KEY.reservations,[]).filter(r=>worker||r.date===date&&r.customer===user).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));const box=document.getElementById('reservationList'),counter=document.getElementById('reservationCount');if(counter)counter.textContent=`${list.length} reservas`;if(!box)return;if(!list.length){box.innerHTML='<div class="empty-state compact"><span>▦</span><strong>No hay reservas para hoy</strong><p>Las nuevas reservas aparecerán aquí.</p></div>';return;}box.innerHTML=list.map(r=>{const valid=r.status==='Confirmada'||r.status==='Atendida',arrival=r.arrived?'Llegó':'Pendiente de llegada',reservationDate=new Date(`${r.date}T00:00:00`).toLocaleDateString('es-SV',{day:'2-digit',month:'2-digit',year:'numeric'});const actions=worker?(!r.arrived?`<button class="secondary-btn small" onclick="ESFERestaurante.reservas.markArrived('${r.id}')">Registrar llegada</button><button class="danger-btn small" onclick="ESFERestaurante.reservas.markNoShow('${r.id}')">No llegó</button>`:`<button class="secondary-btn small" onclick="ESFERestaurante.reservas.finish('${r.id}')">Registrar salida</button>`):'';return `<div class="reservation-item"><div><span class="reservation-time">${r.time}</span><strong>${r.table}</strong><small>${reservationDate} · ${r.name} · ${r.people} persona(s) · ${r.zone}</small><small>${r.status==='Fuera de horario'?`Fuera del horario ${restaurantHours()} · la mesa no se bloquea`:r.arrived?'Reserva activa · la mesa permanece ocupada hasta la salida':'Reserva válida'} · ${arrival}</small></div><div class="reservation-actions"><span class="status-pill ${valid?'success':'warning'}">${r.status}</span>${actions}</div></div>`;}).join('');}
    };
    // Procesa la información de invoice key.
    const invoiceKey = id => `esfe_factura_${id}`;
    // Genera los datos de la factura para mostrarlos o imprimirlos.
    const createInvoice = order => {
        if (!order?.id || order.paymentStatus !== 'Pagado') return null;
        // Estado compartido del módulo: invoice.
        const invoice = {
            id: invoiceKey(order.id), invoiceNumber:`FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`,
            orderId:order.id, customer:order.customerName||order.customer||'Cliente', email:order.customer||'', date:order.paidAt||order.date,
            orderType:order.orderType, payment:order.payment, paymentRef:order.paymentRef||'', customerPhone:order.customerPhone||'', deliveryPhone:order.deliveryPhone||'', deliveryAddress:order.deliveryAddress||'', table:order.table||'', subtotal:Number(order.subtotal||0), tax:Number(order.tax||0), total:Number(order.total||0), items:(order.items||[]).map(i=>({name:i.name,qty:Number(i.qty)||1,price:Number(i.price)||0}))
        };
        localStorage.setItem(invoice.id,JSON.stringify(invoice));
        return invoice;
    };
    // Genera los datos de la factura para mostrarlos o imprimirlos.
    const getInvoice = orderId => { try { return JSON.parse(localStorage.getItem(invoiceKey(orderId))||'null'); } catch { return null; } };
    // ===== FACTURA DIGITAL =====
    // Documento HTML autocontenido, pensado para pantalla, impresión y PDF desde el navegador.
    // ===== FACTURA DIGITAL PREMIUM =====
    // Comprobante autocontenido para pantalla, impresión y guardado como PDF.
    // Procesa la información de invoice html.
    const invoiceHtml = invoice => {
        if(!invoice) return '';
        // Escapa caracteres especiales para insertar texto de forma segura en HTML.
        const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        const paidDate = invoice.date || new Date().toISOString();
        const rows = invoice.items.map((item,index)=>{
            const qty=Math.max(0,Number(item.qty)||0), price=Math.max(0,Number(item.price)||0);
            return `<tr><td class="num">${String(index+1).padStart(2,'0')}</td><td><div class="product-name">${esc(item.name)}</div><div class="product-sub">Consumo registrado</div></td><td class="center">${qty}</td><td class="right">${money(price)}</td><td class="right strong">${money(qty*price)}</td></tr>`;
        }).join('');
        const logoUrl = `${location.origin}/images/logo.jpg`;
        const orderType = invoice.orderType || 'Consumo en restaurante';
        const payment = invoice.payment || 'No indicado';
        const locationText = String(orderType).toLowerCase().includes('domic') ? (invoice.deliveryAddress || 'Domicilio registrado') : (invoice.table || 'Atención en restaurante');
        const code = `${invoice.invoiceNumber}-${String(invoice.orderId||'').replace(/[^A-Za-z0-9]/g,'').slice(-6).toUpperCase()}`;
        return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(invoice.invoiceNumber)} · RestauranteBD</title>
        <style>
          :root{--ink:#17191b;--muted:#6f757b;--line:#dfdbd2;--soft:#f6f3ed;--paper:#fff;--accent:#b9934d;--accent2:#8f6e35;--success:#3e7656;--successbg:#edf5ef}
          *{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#f5f2eb,#faf9f6);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .page{width:min(960px,calc(100% - 28px));margin:26px auto 40px}.sheet{background:var(--paper);border:1px solid #ddd8cf;border-radius:28px;box-shadow:0 26px 78px rgba(25,23,19,.10);overflow:hidden}
          .ribbon{height:9px;background:linear-gradient(90deg,#151617 0 72%,var(--accent) 72% 100%)}
          .header{padding:34px 42px 24px;display:flex;justify-content:space-between;gap:28px;border-bottom:1px solid var(--line)}
          .brand{display:flex;align-items:center;gap:16px}.brand img{width:72px;height:72px;border-radius:20px;object-fit:cover;border:1px solid var(--line);box-shadow:0 7px 22px rgba(15,23,42,.08)}.brand h1{margin:0;font-size:28px;letter-spacing:-.04em}.brand p{margin:6px 0 0;color:var(--muted);font-size:12px;line-height:1.5}.brand small{display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;background:#f8fafc;color:#64748b;border:1px solid var(--line);font-weight:800;font-size:9px}
          .invoice-head{text-align:right}.invoice-head .eyebrow{font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:900;color:var(--accent)}.invoice-head h2{margin:6px 0 0;font-size:25px;letter-spacing:-.025em}.invoice-head .meta{margin-top:8px;color:var(--muted);font-size:10px;line-height:1.7}
          .hero{margin:22px 42px 0;padding:18px 20px;border:1px solid #eadfd8;border-radius:18px;background:linear-gradient(135deg,#fffbf7,#fff);display:flex;justify-content:space-between;gap:20px;align-items:center}.hero .label{font-size:9px;letter-spacing:.11em;text-transform:uppercase;color:#9a5a32;font-weight:900}.hero .amount{margin-top:5px;font-size:29px;font-weight:900;letter-spacing:-.04em}.hero .status{display:inline-flex;align-items:center;gap:8px;padding:8px 11px;border-radius:999px;background:var(--successbg);color:var(--success);font-size:10px;font-weight:900}.dot{width:7px;height:7px;border-radius:50%;background:currentColor}
          .summary{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:12px;padding:22px 42px 0}.card{border:1px solid var(--line);border-radius:16px;padding:15px 16px;background:#fff}.label{display:block;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;font-weight:900}.value{display:block;margin-top:6px;font-size:12px;font-weight:850;line-height:1.45;overflow-wrap:anywhere}.sub{display:block;margin-top:4px;font-size:10px;color:var(--muted);line-height:1.45;overflow-wrap:anywhere}
          main{padding:28px 42px 34px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:26px 0 10px}.section-head:first-child{margin-top:0}.section-title{font-size:12px;font-weight:900}.section-note{font-size:9px;color:#94a3b8}
          table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid var(--line);border-radius:16px}thead th{padding:12px 12px;background:#fafbfd;color:#94a3b8;font-size:8px;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid var(--line)}tbody td{padding:13px 12px;border-bottom:1px solid #f0f3f6;font-size:11px;vertical-align:middle}tbody tr:last-child td{border-bottom:0}th.right,td.right{text-align:right}.center{text-align:center}.num{width:44px;color:#a0a9b7;font-variant-numeric:tabular-nums}.product-name{font-weight:850}.product-sub{margin-top:3px;font-size:9px;color:#94a3b8}
          .info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.info-card{border:1px solid var(--line);border-radius:16px;background:#fff;padding:15px 16px}.info-card h3{margin:0 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}.info-row{display:flex;justify-content:space-between;gap:20px;padding:7px 0;border-bottom:1px dashed #edf1f5;font-size:10px}.info-row:last-child{border-bottom:0}.info-row span{color:#94a3b8}.info-row strong{text-align:right;overflow-wrap:anywhere}
          .totals{display:flex;justify-content:flex-end;margin-top:18px}.totals-box{width:min(390px,100%);border:1px solid var(--line);border-radius:18px;overflow:hidden}.total-row{display:flex;justify-content:space-between;padding:10px 15px;font-size:11px;border-bottom:1px solid #f0f3f6}.grand{display:flex;justify-content:space-between;align-items:center;padding:16px;background:#111827;color:#fff}.grand span{font-size:11px;font-weight:750}.grand strong{font-size:22px;letter-spacing:-.03em}
          .closing{display:grid;grid-template-columns:1.4fr .8fr;gap:12px;margin-top:22px}.closing-card{border:1px solid var(--line);border-radius:16px;padding:16px;background:#fff}.closing-card strong{font-size:10px}.closing-card p{margin:6px 0 0;font-size:10px;color:var(--muted);line-height:1.6}.validation{background:#f8fafc}.validation-code{margin-top:8px;padding:10px 12px;border:1px dashed #cfd7e2;border-radius:12px;font-size:10px;font-weight:900;letter-spacing:.08em;word-break:break-all}
          .footer{padding:20px 42px 30px;border-top:1px solid var(--line);text-align:center;color:#94a3b8;font-size:9px;line-height:1.7}.footer strong{color:#64748b}.actions{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-top:1px solid var(--line)}button{border:1px solid #d8e0e9;background:#fff;border-radius:11px;padding:9px 13px;font:800 10px inherit;cursor:pointer}button.primary{background:#171819;color:#fff;border-color:#171819}
          @media print{body{background:#fff}.page{width:100%;margin:0}.sheet{border:0;border-radius:0;box-shadow:none}.actions{display:none}.header,.summary,main,.footer{padding-left:24px;padding-right:24px}.hero{margin-left:24px;margin-right:24px}.ribbon{height:6px}}
          @media(max-width:760px){.header,.hero,.summary,main,.footer{padding-left:16px;padding-right:16px}.hero{margin-left:16px;margin-right:16px;align-items:flex-start;flex-direction:column}.header{flex-direction:column}.invoice-head{text-align:left}.summary,.info-grid,.closing{grid-template-columns:1fr}.brand img{width:58px;height:58px}.brand h1{font-size:24px}.invoice-head h2{font-size:22px}}
        </style></head><body><div class="page"><div class="sheet"><div class="ribbon"></div>
        <header class="header"><div class="brand"><img src="${esc(logoUrl)}" alt="RestauranteBD"><div><h1>RestauranteBD</h1><p>Experiencia, sabor y servicio en un solo lugar.</p><small>COMPROBANTE DIGITAL</small></div></div><div class="invoice-head"><div class="eyebrow">Factura digital</div><h2>${esc(invoice.invoiceNumber)}</h2><div class="meta">Emitida: ${esc(formatDateTime(paidDate))}<br>Pedido: ${esc(invoice.orderId)}<br>${esc(orderType)}</div></div></header>
        <section class="hero"><div><div class="label">Total pagado</div><div class="amount">${money(invoice.total)}</div></div><div class="status"><i class="dot"></i>Pago confirmado</div></section>
        <section class="summary"><div class="card"><span class="label">Cliente</span><span class="value">${esc(invoice.customer)}</span><span class="sub">${esc(invoice.email||'Cliente registrado')}</span></div><div class="card"><span class="label">Atención</span><span class="value">${esc(orderType)}</span><span class="sub">${esc(locationText)}</span></div><div class="card"><span class="label">Estado</span><span class="value">Pagado</span><span class="sub">${esc(payment)}${invoice.paymentRef?` · ${esc(invoice.paymentRef)}`:''}</span></div></section>
        <main><div class="section-head"><div class="section-title">Detalle de consumo</div><div class="section-note">${invoice.items.length} ${invoice.items.length===1?'línea':'líneas'} · Pedido ${esc(invoice.orderId)}</div></div>
          <table><thead><tr><th class="num">#</th><th>Producto</th><th class="center">Cantidad</th><th class="right">Precio</th><th class="right">Importe</th></tr></thead><tbody>${rows}</tbody></table>
          <div class="totals"><div class="totals-box"><div class="total-row"><span>Subtotal</span><strong>${money(invoice.subtotal)}</strong></div><div class="total-row"><span>IVA</span><strong>${money(invoice.tax)}</strong></div><div class="grand"><span>Total pagado</span><strong>${money(invoice.total)}</strong></div></div></div>
          <div class="section-head"><div class="section-title">Información de la operación</div><div class="section-note">Datos asociados al pago</div></div>
          <div class="info-grid"><div class="info-card"><h3>Pago</h3><div class="info-row"><span>Método</span><strong>${esc(payment)}</strong></div><div class="info-row"><span>Estado</span><strong>Pagado</strong></div><div class="info-row"><span>Referencia</span><strong>${esc(invoice.paymentRef||'No aplica')}</strong></div><div class="info-row"><span>Fecha</span><strong>${esc(formatDateTime(paidDate))}</strong></div></div>
          <div class="info-card"><h3>Cliente y entrega</h3><div class="info-row"><span>Cliente</span><strong>${esc(invoice.customer)}</strong></div><div class="info-row"><span>Teléfono</span><strong>${esc(invoice.customerPhone||invoice.deliveryPhone||'No registrado')}</strong></div><div class="info-row"><span>Ubicación</span><strong>${esc(locationText)}</strong></div><div class="info-row"><span>Correo</span><strong>${esc(invoice.email||'No registrado')}</strong></div></div></div>
          <div class="closing"><div class="closing-card"><strong>Gracias por elegir RestauranteBD</strong><p>Este comprobante digital resume la compra y el pago asociado al pedido. Conserva esta factura para futuras consultas relacionadas con tu consumo.</p></div><div class="closing-card validation"><strong>Identificador digital</strong><div class="validation-code">${esc(code)}</div></div></div>
        </main><footer class="footer"><strong>RestauranteBD</strong> · Documento generado automáticamente por el sistema.<br>La factura digital es un comprobante de la transacción registrada en RestauranteBD.</footer></div><div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button><button class="primary" onclick="window.close()">Cerrar</button></div></div></body></html>`;
    };
    // Muestra la factura o comprobante del pedido.
    const showInvoice = orderId => { const invoice=getInvoice(orderId); if(!invoice){toast('La factura todavía no está disponible.','error');return;} const blob=new Blob([invoiceHtml(invoice)],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); const w=window.open(url,'_blank'); if(!w){toast('El navegador bloqueó la factura. Permite ventanas emergentes para verla.','error');} setTimeout(()=>URL.revokeObjectURL(url),60000); };

    const payment={method:'Efectivo',subtotal:0,total:0,
        init(){
            const pendingOrderId=sessionStorage.getItem('esfe_pay_order_id');
            const pendingOrder=pendingOrderId?read(KEY.orders,[]).find(o=>o.id===pendingOrderId):null;
            this.pendingOrderId=pendingOrder?.id||null; this.pendingOrder=pendingOrder||null;
            if(pendingOrder && pendingOrder.paymentStatus==='Pagado'){toast('Este pedido ya está pagado.','info');sessionStorage.removeItem('esfe_pay_order_id');setTimeout(()=>location.href='/GestionDePedidos1/Index',250);return;}
            if(pendingOrder && pendingOrder.customer && pendingOrder.customer!==currentUser()){toast('Ese pago no pertenece a tu cuenta.','error');sessionStorage.removeItem('esfe_pay_order_id');setTimeout(()=>location.href='/Inicio1/Index',250);return;}
            if(pendingOrder){this.subtotal=Number(pendingOrder.subtotal)||0;this.total=Number(pendingOrder.total)||0;this.method=pendingOrder.payment||'Tarjeta';const context=document.getElementById('paymentOrderContext');if(context)context.textContent=`Pago pendiente · Pedido ${pendingOrder.id} · ${pendingOrder.orderType||'Pedido'}`;document.getElementById('paymentTotal').textContent=money(this.total);document.getElementById('paymentTotalAside').textContent=money(this.total);document.getElementById('paymentSubtotal').textContent=money(this.subtotal);document.getElementById('paymentTax').textContent=money(Number(pendingOrder.tax)||0);document.getElementById('paymentItems').innerHTML=(pendingOrder.items||[]).map(i=>`<div><span>${i.qty}× ${i.name}</span><strong>${money(i.price*i.qty)}</strong></div>`).join('');this.renderFields();return;}
            if(currentRole()!=='Cliente'){toast('Este perfil no puede procesar pedidos','error');location.href='/Inicio1/Index';return;}
            const c=cartGet();if(!c.length){toast('El carrito está vacío','error');setTimeout(()=>location.href='/GestionDeMenu1/Index',250);return;}
            const orderType=sessionStorage.getItem('esfe_order_type')||'Mesa';
            if(orderType==='Mesa'&&!sessionStorage.getItem('esfe_reservation_id')){sessionStorage.setItem('esfe_return_to_payment','1');location.href='/ReservarMesas1/Index';return;}
            this.subtotal=c.reduce((sum,i)=>sum+i.price*i.qty,0);this.total=Number((this.subtotal*(1+taxRate())).toFixed(2));
            const context=document.getElementById('paymentOrderContext');if(context)context.textContent=orderType==='Domicilio'?`Pedido a domicilio · ${sessionStorage.getItem('esfe_delivery_address')||'Dirección registrada'}`:orderType==='Mesa'?'Consumo en restaurante · reserva vinculada':'Pedido para llevar';
            document.getElementById('paymentTotal').textContent=money(this.total);document.getElementById('paymentTotalAside').textContent=money(this.total);document.getElementById('paymentSubtotal').textContent=money(this.subtotal);document.getElementById('paymentTax').textContent=money(this.total-this.subtotal);document.getElementById('paymentItems').innerHTML=c.map(i=>`<div><span>${i.qty}× ${i.name}</span><strong>${money(i.price*i.qty)}</strong></div>`).join('');this.renderFields();
        },
        selectMethod(m){this.method=m;document.querySelectorAll('.payment-method').forEach(b=>b.classList.toggle('active',b.dataset.method===m));this.renderFields();},
        renderFields(){
            const box=document.getElementById('paymentFields');if(!box)return;const preview=document.getElementById('cardPreviewWrap');
            if(preview)preview.classList.toggle('hidden',this.method!=='Tarjeta');
            if(this.method==='Efectivo')box.innerHTML=`<div class="method-box"><span class="payment-method-symbol payment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M7 10h10M8 14h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><div><strong>Pago en efectivo</strong><p>Tu pedido se creará como pendiente de pago. El pago se registra cuando el pedido sea entregado o recogido.</p></div></div>`;
            else if(this.method==='Tarjeta')box.innerHTML=`<div class="method-box"><span class="payment-method-symbol payment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M7 15h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><div><strong>Pago con tarjeta</strong><p>Es una simulación. No se realiza ningún cargo real y puedes usar cualquier número de tarjeta de prueba.</p></div><label class="field-label">Nombre del titular<input id="cardName" type="text" autocomplete="cc-name" data-letters-only maxlength="60" placeholder="NOMBRE DEL TITULAR" /></label><label class="field-label">Número de tarjeta<input id="cardNumber" type="text" maxlength="23" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" /></label><div class="payment-inline"><label class="field-label">Vencimiento<input id="cardExpiry" type="text" maxlength="5" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" /></label><label class="field-label">CVV<input id="cardCvv" type="text" maxlength="4" inputmode="numeric" autocomplete="cc-csc" placeholder="123" /></label></div></div>`;
            else box.innerHTML=`<div class="method-box"><span class="payment-method-symbol payment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" stroke="currentColor" stroke-width="1.7"/><path d="M7 10h7M7 13h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><div><strong>Transferencia bancaria</strong><p>Registra una referencia para simular la confirmación del pago.</p></div><div class="transfer-data"><strong>Referencia sugerida</strong><span>TRX-2026-001245</span></div><label class="field-label">Referencia de transferencia<input id="transferRef" type="text" maxlength="40" placeholder="TRX-2026-001245" /></label></div>`;
            this.bindCardPreview();
        },
        bindCardPreview(){
            const name=document.getElementById('cardName'),number=document.getElementById('cardNumber'),expiry=document.getElementById('cardExpiry');if(!name||!number||!expiry)return;
            // Procesa la información de update.
            const update=()=>{const digits=number.value.replace(/\D/g,'').slice(0,19);number.value=digits.replace(/(.{4})/g,'$1 ').trim();const n=document.getElementById('cardPreviewName');const num=document.getElementById('cardPreviewNumber');const exp=document.getElementById('cardPreviewExpiry');const brand=document.getElementById('cardBrand');if(n)n.textContent=(name.value.trim()||'NOMBRE DEL TITULAR').toUpperCase();if(num){const groups=digits.match(/.{1,4}/g)||[];num.textContent=groups.length?groups.join(' '):'•••• •••• •••• ••••';}if(exp)exp.textContent=expiry.value||'MM/AA';if(brand)brand.innerHTML=cardBrand(digits);};
            // Evento que conecta una acción del usuario con la lógica del módulo.
            number.addEventListener('input',update);name.addEventListener('input',update);document.getElementById('cardCvv')?.addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);});expiry.addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,4);if(v.length>2)v=`${v.slice(0,2)}/${v.slice(2)}`;if(v.length===2&&Number(v)>12)v='12';e.target.value=v;update();});update();
            setupInputRules(document.getElementById('paymentFields'));
        },
        complete(){
            if(this.pendingOrderId){
                const all=read(KEY.orders,[]); const order=all.find(o=>o.id===this.pendingOrderId);
                if(!order){toast('El pedido ya no está disponible.','error');sessionStorage.removeItem('esfe_pay_order_id');return;}
                if(order.paymentStatus==='Pagado'){toast('Este pedido ya fue pagado.','info');sessionStorage.removeItem('esfe_pay_order_id');return;}
                let ref='',detail='';
                if(this.method==='Tarjeta'){const number=(document.getElementById('cardNumber')?.value||'').replace(/\D/g,'');const name=(document.getElementById('cardName')?.value||'').trim();const expiry=(document.getElementById('cardExpiry')?.value||'').trim();const cvv=(document.getElementById('cardCvv')?.value||'').replace(/\D/g,'');if(!name||!number||!expiry||!cvv){toast('Completa los datos de la tarjeta para la simulación.','error');return;}ref='CARD-'+(number.slice(-4)||'TEST');detail='Pago con tarjeta registrado en modo demostración';}
                else if(this.method==='Transferencia'){ref=(document.getElementById('transferRef')?.value||'').trim();if(!/^[A-Za-z0-9-]{5,40}$/.test(ref)){toast('Ingresa una referencia válida.','error');return;}detail='Transferencia registrada y marcada como pagada';}
                else {ref='CASH-'+Date.now().toString().slice(-10);detail='Pago en efectivo confirmado por el cliente';}
                order.paymentStatus='Pagado';order.paymentRef=ref;order.paymentDetail=detail;order.paidAt=new Date().toISOString();write(KEY.orders,all);const sales=read(KEY.sales,[]);if(!sales.some(x=>x.id===order.id))sales.unshift({...order,saleStatus:'Cobrado'});write(KEY.sales,sales);const invoice=createInvoice(order);addNotification(`Pago confirmado · pedido ${order.id}.`,order.customer,{type:'factura',orderId:order.id,title:'Pago pendiente completado',detail:`El pedido ${order.id} ya está pagado por ${money(order.total)}. Factura ${invoice?.invoiceNumber||''} disponible.`,action:'invoice'});sessionStorage.removeItem('esfe_pay_order_id');toast('Pago confirmado correctamente.');setTimeout(()=>location.href='/GestionDePedidos1/Index',400);return;
            }
            if(currentRole()!=='Cliente'){toast('Este perfil no puede crear pedidos','error');return;}const c=cartGet();if(!c.length){toast('El carrito está vacío','error');return;}
            const orderTypeCheck=sessionStorage.getItem('esfe_order_type')||'Mesa';
            if(orderTypeCheck==='Domicilio'&&((sessionStorage.getItem('esfe_delivery_phone')||'').replace(/\D/g,'').length<7||(sessionStorage.getItem('esfe_delivery_phone')||'').replace(/\D/g,'').length>15||(sessionStorage.getItem('esfe_delivery_address')||'').trim().length<5)){toast('Faltan los datos de entrega a domicilio','error');return;}
            if(orderTypeCheck==='Mesa'&&!sessionStorage.getItem('esfe_reservation_id')){sessionStorage.setItem('esfe_return_to_payment','1');location.href='/ReservarMesas1/Index';return;}
            let ref='',paymentStatus='Pendiente',paymentDetail='';
            if(this.method==='Tarjeta'){
                const name=(document.getElementById('cardName')?.value||'').trim();const number=(document.getElementById('cardNumber')?.value||'').replace(/\D/g,'');const expiry=(document.getElementById('cardExpiry')?.value||'').trim();const cvv=(document.getElementById('cardCvv')?.value||'').replace(/\D/g,'');
                if(!name||!number||!expiry||!cvv){toast('Completa los datos de la tarjeta para la simulación','error');return;}
                ref='CARD-'+(number.slice(-4)||'TEST');paymentStatus='Pagado';paymentDetail='Pago con tarjeta registrado en modo demostración';
            }else if(this.method==='Transferencia'){ref=(document.getElementById('transferRef')?.value||'').trim();if(!/^[A-Za-z0-9-]{5,40}$/.test(ref)){toast('Ingresa una referencia de transferencia válida','error');return;}paymentStatus='Pagado';paymentDetail='Transferencia registrada y marcada como pagada';}else{paymentDetail='El cliente pagará en efectivo personalmente al recoger o recibir el pedido';}
            const id=uid('ORD');const orderType=sessionStorage.getItem('esfe_order_type')||'Mesa';const order={id,customer:currentUser(),customerName:document.body.dataset.userName||currentUser(),customerPhone:document.body.dataset.phone||'',customerDui:document.body.dataset.dui||'',date:new Date().toISOString(),status:'Pendiente',payment:this.method,paymentStatus,paymentRef:ref,paymentDetail,orderType,note:sessionStorage.getItem('esfe_order_note')||'',deliveryPhone:sessionStorage.getItem('esfe_delivery_phone')||'',deliveryAddress:sessionStorage.getItem('esfe_delivery_address')||'',reservationId:sessionStorage.getItem('esfe_reservation_id')||'',subtotal:this.subtotal,tax:Number((this.total-this.subtotal).toFixed(2)),total:this.total,items:c}; if(paymentStatus==='Pagado') order.paidAt=new Date().toISOString();let orders=read(KEY.orders,[]);orders.unshift(order);write(KEY.orders,orders);if(paymentStatus==='Pagado'){let sales=read(KEY.sales,[]);sales.unshift({...order,saleStatus:'Cobrado'});write(KEY.sales,sales);}cartSave([]);['esfe_order_type','esfe_order_note','esfe_delivery_phone','esfe_delivery_address','esfe_reservation_id'].forEach(k=>sessionStorage.removeItem(k));if(paymentStatus==='Pagado'){const invoice=createInvoice(order);addNotification(`Pago confirmado · pedido ${id}. Tu factura digital ${invoice?.invoiceNumber||''} está disponible.`,currentUser(),{type:'factura',orderId:id,title:'Pago confirmado y factura digital',detail:`Factura ${invoice?.invoiceNumber||''} · ${money(order.total)}`,action:'invoice'});}
            else{addNotification(`Pedido ${id} creado. Pago pendiente: se pagará en efectivo al recoger o recibir.`,currentUser(),{type:'pedido',orderId:id,title:'Pedido creado',detail:`Total ${money(order.total)} · Pago pendiente`,action:null});}
            // Aviso operativo: cada área recibe el pedido en su propia bandeja.
            addNotification(`Nuevo pedido ${id}.`,null,{type:'pedido',orderId:id,title:'Nuevo pedido recibido',detail:`${order.items.length} productos · ${money(order.total)} · ${order.orderType||'Pedido'}.`,roles:['Dueno','Administrador','Cocina','Barra'].concat(order.orderType==='Domicilio'?['Delivery']:[])});toast(paymentStatus==='Pagado'?`Pedido ${id} creado y pagado`:`Pedido ${id} creado. Pago en efectivo al recoger.`);setTimeout(()=>location.href='/GestionDePedidos1/Index',500);
        }
    };
    // Procesa la información de card brand.
    const cardBrand=digits=>/^4/.test(digits)||/^(5[1-5]|2[2-7])/.test(digits)||/^3[47]/.test(digits)?'<svg viewBox=\"0 0 24 24\" fill=\"none\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"1.7\"/><path d=\"M3 10h18M7 15h4\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"/></svg>':'';

    // ===== GESTIÓN DE PEDIDOS =====
    const orders={filter:'Todos',init(){this.render();setInterval(()=>this.render(),5000);},setFilter(f){this.filter=f;document.querySelectorAll('[data-status]').forEach(b=>b.classList.toggle('active',b.dataset.status===f));this.render();},render(){const all=read(KEY.orders,[]);const owner=['Dueno','Administrador'].includes(currentRole());const role=currentRole();const operational=owner||role==='Barra';const visible=operational?all:all.filter(o=>(o.customer||'')===currentUser());const search=(document.getElementById('ordersSearch')?.value||'').toLowerCase().trim();const filtered=visible.filter(o=>(this.filter==='Todos'||o.status===this.filter)&&(!search||[o.id,o.customer,o.customerName,o.customerPhone,o.customerDui,o.deliveryPhone,o.deliveryAddress].filter(Boolean).some(v=>String(v).toLowerCase().includes(search))));const totalEl=document.getElementById('ordersTotal'),pendingEl=document.getElementById('ordersPending'),preparingEl=document.getElementById('ordersPreparing'),readyEl=document.getElementById('ordersReady');if(totalEl)totalEl.textContent=visible.length;if(pendingEl)pendingEl.textContent=visible.filter(o=>o.status==='Pendiente').length;if(preparingEl)preparingEl.textContent=visible.filter(o=>o.status==='Preparando').length;if(readyEl)readyEl.textContent=visible.filter(o=>o.status==='Listo').length;const box=document.getElementById('ordersGrid');if(!box)return;if(!filtered.length){box.innerHTML='<div class="empty-state compact"><span class="ui-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><strong>No hay pedidos con ese filtro</strong><p>Los pedidos nuevos aparecerán aquí.</p></div>';return;}box.innerHTML=filtered.map(o=>{const paid=o.paymentStatus ? o.paymentStatus==='Pagado' : o.payment!=='Efectivo';const paymentLabel=paid?'Pagado':'Pendiente de pago';const paymentClass=paid?'success':'warning';const sendButton=(owner||role==='Barra')&&o.status==='Pendiente'?`<button class="primary-btn small" onclick="ESFERestaurante.orders.advance('${o.id}')">Enviar a cocina</button>`:'';const readyNote=o.status==='Listo'?`<span class="status-pill success">Listo en cocina · pasar a Entregas</span>`:'';return `<article class="order-card"><div class="order-card-head"><div><span class="order-id">${o.id}</span><small>${new Date(o.date).toLocaleString('es-SV')}</small></div><span class="status-pill ${o.status==='Listo'?'success':o.status==='Preparando'?'warning':'neutral'}">${o.status}</span></div><div class="order-payment-line"><span class="status-pill ${paymentClass}"><span class="ui-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.7"/></svg></span>${paymentLabel}</span><strong>${o.payment}</strong></div><div class="order-products">${o.items.map(i=>`<div><span>${i.qty}× ${i.name}</span><strong>${money(i.price*i.qty)}</strong></div>`).join('')}</div><div class="order-card-foot"><span>${o.orderType}</span><strong>${money(o.total)}</strong></div>${o.payment==='Efectivo'?'<div class="cash-note"><strong>Pago en efectivo:</strong> El cliente pagará en persona al recoger o recibir el pedido.</div>':''}${paid&&o.paymentRef?`<div class="paid-note"><strong>Pago confirmado</strong><span>Referencia: ${o.paymentRef}</span></div>`:''}${(owner||role==='Barra')?`<div class="order-actions">${!paid&&o.payment==='Efectivo'?`<button class="secondary-btn small" onclick="ESFERestaurante.orders.markCashPaid('${o.id}')">Confirmar pago en efectivo</button>`:''}${sendButton}${readyNote}${role==='Barra'&&o.status==='Preparando'?'<span class="status-pill warning">En cocina · preparando</span>':''}</div>`:'<div class="order-actions"><span class="order-status-note">El restaurante actualizará el estado del pedido.</span></div>'}</article>`;}).join('');},markCashPaid(id){if(!['Dueno','Administrador'].includes(currentRole())&&currentRole()!=='Barra'){toast('Solo el dueño o Barra puede confirmar pagos','error');return;}let all=read(KEY.orders,[]);const o=all.find(x=>x.id===id);if(!o||o.payment!=='Efectivo')return;o.paymentStatus='Pagado';o.paidAt=new Date().toISOString();o.paymentDetail='Pago en efectivo recibido personalmente al recoger o recibir el pedido';o.paymentRef='EF-'+new Date().getTime().toString().slice(-12);const invoice=createInvoice(o);write(KEY.orders,all);let sales=read(KEY.sales,[]);if(!sales.some(x=>x.id===id)){sales.unshift({...o,saleStatus:'Cobrado'});write(KEY.sales,sales);}if(o.customer)addNotification(`Pago recibido · pedido ${o.id}. Tu factura digital ${invoice?.invoiceNumber||''} ya está disponible.`,o.customer,{type:'factura',orderId:o.id,title:'Pago en efectivo confirmado',detail:`Factura ${invoice?.invoiceNumber||''} · ${money(o.total)}`,action:'invoice'});addNotification(`Pago recibido para ${o.id}.`,null,{type:'pago',orderId:o.id,title:'Pago confirmado',detail:`Pago en efectivo registrado por ${money(o.total)}. Factura ${invoice?.invoiceNumber||'digital'}.`,roles:['Dueno','Administrador','Barra']});toast(`${id}: pago en efectivo confirmado`);this.render();},advance(id){const role=currentRole();if(!['Dueno','Administrador','Cocina','Barra'].includes(role)){toast('No tienes permiso para actualizar el estado del pedido','error');return;}let all=read(KEY.orders,[]);const o=all.find(x=>x.id===id);if(!o)return;if(role==='Barra'&&o.status!=='Pendiente'){toast('Barra solo envía pedidos pendientes a cocina.','info');return;}if(role==='Cocina'&&o.status==='Listo'){return;}const old=o.status;o.status=o.status==='Pendiente'?'Preparando':o.status==='Preparando'?'Listo':'Entregado';if(old===o.status)return;if(o.customer)addNotification(`Tu pedido ${o.id} cambió de estado: ${o.status}.`,o.customer,{type:'pedido',orderId:o.id,title:`Pedido ${o.status.toLowerCase()}`,detail:`El restaurante actualizó el pedido ${o.id}.`,action:null});addNotification(`El pedido ${o.id} pasó a ${o.status}.`,null,{type:'pedido',orderId:o.id,title:`Pedido ${o.status.toLowerCase()}`,detail:`Actualización operativa del pedido ${o.id}. Cliente: ${o.customerName||o.customer||'Cliente'}.`,roles:['Dueno','Administrador','Cocina','Barra'].concat(o.status==='Listo'?['Delivery']:[])});write(KEY.orders,all);toast(`${id}: ${o.status}`);this.render();}};

    // ===== PANTALLA DE COCINA =====
    // Estado compartido del módulo: kitchen.
    const kitchen={
        init(){this.render();setInterval(()=>this.render(),1000);},
        render(){
            const all=read(KEY.orders,[]),board=document.getElementById('kitchenBoard');if(!board)return;
            const groups=[['Pendiente','Por preparar'],['Preparando','Preparando'],['Listo','Listos']];
            const targetMs=15*60*1000;
            // Escapa caracteres especiales para insertar texto de forma segura en HTML.
            const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            board.setAttribute('aria-busy','true');
            board.innerHTML=groups.map(([status,title])=>`<section class="kanban-col"><div class="kanban-head"><div><span>${title}</span><strong>${all.filter(o=>o.status===status).length}</strong></div></div><div class="kanban-list">${all.filter(o=>o.status===status).map(o=>{
                const elapsed=Math.max(0,Date.now()-new Date(o.date||Date.now()).getTime());
                const progress=Math.min(100,Math.round(elapsed/targetMs*100));
                const remaining=Math.max(0,targetMs-elapsed),mins=Math.floor(remaining/60000),secs=Math.floor((remaining%60000)/1000);
                const severity=progress>=100?'kds-danger':progress>=70?'kds-warning':'kds-safe';
                const timer=status==='Listo'?'Preparado':`${mins}:${String(secs).padStart(2,'0')} restantes`;
                return `<article class="kitchen-card ${severity}" data-order-time="${esc(o.date||'')}">
                    <div class="order-card-head"><span class="order-id">${esc(o.id)}</span><span class="status-pill ${status==='Listo'?'success':status==='Preparando'?'warning':'neutral'}">${status}</span></div>
                    <strong class="kds-order-title">${(o.items||[]).map(i=>`${esc(i.qty)}× ${esc(i.name)}`).join(', ')}</strong>
                    <div class="kds-meta"><span>${esc(o.customerName||o.customer||'Cliente')}</span><span>${esc(o.orderType||'Pedido')}</span><span>${esc(o.payment||'Pago')}</span></div>
                    <div class="kds-progress" aria-label="Tiempo de preparación"><span style="width:${status==='Listo'?100:progress}%"></span></div>
                    <div class="kds-timer"><span>${progress>=100&&status!=='Listo'?'Tiempo excedido':'Tiempo objetivo · 15 min'}</span><strong>${timer}</strong></div>
                    ${progress>=100&&status!=='Listo'?'<div class="kds-alert">Requiere atención inmediata</div>':''}
                    ${status==='Listo'?'<div class="cash-note"><strong>Preparado.</strong> El siguiente paso es Entregas, donde se busca el cliente y se registra la entrega.</div>':`<button class="primary-btn small full" onclick="ESFERestaurante.orders.advance('${esc(o.id)}')">${status==='Pendiente'?'Comenzar preparación':'Marcar listo'}</button>`}
                </article>`;
            }).join('')||'<div class="empty-state compact"><span class="ui-icon">✓</span><p>Sin órdenes</p></div>'}</div></section>`).join('');
            board.removeAttribute('aria-busy');
        }
    };
    // ===== PEDIDOS LISTOS / ENTREGAS =====
    // Estado compartido del módulo: ready.
    const ready={
        search:'',
        // Evento que conecta una acción del usuario con la lógica del módulo.
        init(){const input=document.getElementById('readySearch');input?.addEventListener('input',e=>{this.search=e.target.value.toLowerCase().trim();this.render();});this.render();document.addEventListener('esfe:database-ready',()=>this.render());setInterval(()=>this.render(),4000);},
        clearSearch(){this.search='';const input=document.getElementById('readySearch');if(input)input.value='';this.render();},
        render(){
            const all=read(KEY.orders,[]),q=this.search,role=currentRole(),soloDomicilio=role==='Delivery',soloRecogida=role==='Barra';
            const list=all.filter(o=>{const active=o.status==='Listo'||(o.status==='Entregado'&&o.payment==='Efectivo'&&o.cashCollectedByDelivery===true&&!o.cashHandedOverAt);if(!active)return false;const type=String(o.orderType||'').toLowerCase();const isHome=type.includes('domic');const isPickup=type.includes('para llevar')||type.includes('llevar')||type.includes('recoger');if(soloDomicilio&&!isHome)return false;if(soloRecogida&&!isPickup)return false;return !q||[o.id,o.customer,o.customerName,o.customerPhone,o.deliveryPhone,o.deliveryAddress,o.assignedAttendantName,o.orderType].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));});
            const counter=document.getElementById('readyCounter');if(counter)counter.textContent=`${list.length} disponibles`;const box=document.getElementById('readyGrid');if(!box)return;
            if(!list.length){box.innerHTML='<div class="empty-state compact"><span>✓</span><strong>No hay pedidos disponibles</strong><p>'+(q?'Prueba otro criterio de búsqueda.':soloDomicilio?'Los pedidos a domicilio listos aparecerán aquí.':soloRecogida?'Los pedidos para recoger aparecerán aquí.':'Cuando cocina termine, aparecerán aquí.')+'</p></div>';return;}
            const canDelivery=['Dueno','Administrador','Delivery'].includes(role);const canBarPickup=['Dueno','Administrador','Barra'].includes(role);const canHandover=['Dueno','Barra'].includes(role);
            box.innerHTML=list.map(o=>{
                const type=String(o.orderType||'').toLowerCase();const isHome=type.includes('domic');const isPickup=type.includes('para llevar')||type.includes('llevar')||type.includes('recoger');const pendingCash=o.paymentStatus!=='Pagado'&&String(o.payment||'').toLowerCase()==='efectivo';const cashCollected=o.cashCollectedByDelivery===true||o.cashCollectedByStaff===true;const cashHandedOver=o.cashHandedOverAt!=null;const customer=o.customerName||o.customer||'Cliente';const paymentBadge=o.paymentStatus==='Pagado'?'<span class="status-pill success">Pagado</span>':pendingCash?'<span class="status-pill warning">Cobro pendiente</span>':'<span class="status-pill neutral">Pago pendiente</span>';let action='';
                if(canDelivery&&isHome&&o.status==='Listo'&&pendingCash&&!cashCollected)action+=`<button class="secondary-btn small full" onclick="ESFERestaurante.ready.confirmCash('${o.id}')">Confirmar efectivo recibido</button>`;
                if(canDelivery&&isHome&&o.status==='Listo')action+=`<button class="primary-btn full" ${(pendingCash&&!cashCollected)?'disabled':''} onclick="ESFERestaurante.ready.deliver('${o.id}')">Marcar entregado y notificar ✓</button>`;
                if(canBarPickup&&!isHome&&o.status==='Listo'&&pendingCash&&!cashCollected)action+=`<button class="secondary-btn small full" onclick="ESFERestaurante.ready.confirmCash('${o.id}')">Confirmar efectivo recibido</button>`;
                if(canBarPickup&&isPickup&&o.status==='Listo')action+=`<button class="primary-btn full" ${(pendingCash&&!cashCollected)?'disabled':''} onclick="ESFERestaurante.ready.pickup('${o.id}')">Registrar recogido en restaurante ✓</button>`;
                if(canHandover&&o.cashCollectedByDelivery===true&&!cashHandedOver)action+=`<button class="secondary-btn small full" onclick="ESFERestaurante.ready.handoverCash('${o.id}')">Registrar efectivo entregado al restaurante</button>`;
                if(cashHandedOver)action+=`<span class="status-pill success">Efectivo entregado al restaurante</span>`;
                if(role==='Barra'&&!isPickup&&!isHome)action+=`<span class="status-pill neutral">Listo · atender en salón</span>`;
                return `<article class="order-card ready-card"><div class="order-card-head"><div><span class="order-id">${o.id}</span><small>${customer} · ${o.orderType||'Pedido'}</small></div><span class="status-pill ${o.status==='Entregado'?'neutral':'success'}">${o.status==='Entregado'?'ENTREGADO':'LISTO'}</span></div><div class="order-products">${(o.items||[]).map(i=>`<div><span>${i.qty}× ${i.name}</span></div>`).join('')}</div><div class="order-card-foot"><span>${o.payment||'No indicado'}</span><strong>${money(o.total)}</strong></div><div class="cash-note"><strong>Cliente:</strong> ${customer}<span>${o.deliveryPhone||o.customerPhone||'Sin teléfono registrado'}</span><span>${isHome?(o.deliveryAddress||'Sin dirección registrada'):(o.table||'Pedido para recoger / salón')}</span><span>${paymentBadge}${pendingCash&&o.cashCollectedByDelivery?' · Efectivo recibido por Delivery':pendingCash&&o.cashCollectedByStaff?' · Efectivo recibido en restaurante':''}</span>${o.assignedAttendantName?`<span>Responsable: ${o.assignedAttendantName}</span>`:''}</div><div class="order-actions">${action}</div></article>`;
            }).join('');
        },
        confirmCash(id){
            if(!['Dueno','Administrador','Delivery','Barra'].includes(currentRole())){toast('Solo Delivery, Barra o el administrador puede confirmar el efectivo.','error');return;}
            const all=read(KEY.orders,[]),o=all.find(x=>x.id===id);if(!o||o.status!=='Listo'||o.paymentStatus==='Pagado')return;if(o.payment!=='Efectivo'){toast('Este pedido no está configurado para efectivo.','error');return;}
            const collectedAt=new Date().toISOString();if(currentRole()==='Delivery'){o.cashCollectedByDelivery=true;o.cashCollectedByStaff=false;}else{o.cashCollectedByDelivery=false;o.cashCollectedByStaff=true;}o.cashCollectedAt=collectedAt;o.paymentStatus='Pagado';o.paidAt=collectedAt;o.paymentRef='CASH-'+Date.now().toString().slice(-10);o.paymentDetail=currentRole()==='Barra'?'Efectivo recibido en restaurante al recoger el pedido':'Efectivo recibido por Delivery al entregar el pedido';
            write(KEY.orders,all);const sales=read(KEY.sales,[]);if(!sales.some(x=>x.id===id))sales.unshift({...o,saleStatus:'Cobrado'});write(KEY.sales,sales);const invoice=createInvoice(o);if(o.customer)addNotification(`Pago recibido del pedido ${o.id}.`,o.customer,{type:'factura',orderId:o.id,title:'Pago en efectivo confirmado',detail:`${currentRole()==='Barra'?'Barra':'Delivery'} confirmó el pago de ${money(o.total)}. Factura ${invoice?.invoiceNumber||''} disponible.`,action:'invoice'});addNotification(`${currentRole()==='Barra'?'Barra':'Delivery'} confirmó efectivo para ${o.id}.`,null,{type:'pago',orderId:o.id,title:'Cobro de efectivo confirmado',detail:`Se registró efectivo por ${money(o.total)} para el pedido ${o.id}.`,roles:['Dueno','Administrador','Barra','Delivery']});toast('Pago en efectivo confirmado.');this.render();
        },
        handoverCash(id){if(!['Dueno','Administrador','Barra'].includes(currentRole())){toast('Solo el dueño o Barra puede registrar la entrega del efectivo al restaurante.','error');return;}const all=read(KEY.orders,[]),o=all.find(x=>x.id===id);if(!o||o.payment!=='Efectivo'||o.cashCollectedByDelivery!==true){toast('Primero debe confirmarse el efectivo cobrado.','error');return;}if(o.cashHandedOverAt){toast('Este efectivo ya fue registrado como entregado.','info');return;}o.cashHandedOverAt=new Date().toISOString();o.cashHandedOverBy=currentUser();o.cashHandoverStatus='Entregado al restaurante';write(KEY.orders,all);addNotification(`Efectivo de ${o.id} entregado al restaurante.`,null,{type:'pago',orderId:o.id,title:'Efectivo recibido por restaurante',detail:`Se registró la entrega del efectivo correspondiente al pedido ${o.id}.`,roles:['Dueno','Administrador','Barra']});toast('Entrega de efectivo registrada.');this.render();},
        pickup(id){if(!['Dueno','Administrador','Barra'].includes(currentRole())){toast('Solo Barra o el administrador puede registrar recogidas.','error');return;}const all=read(KEY.orders,[]),o=all.find(x=>x.id===id);if(!o||o.status!=='Listo')return;if(String(o.orderType||'').toLowerCase().includes('domic')){toast('Los domicilios los completa Delivery.','error');return;}if(o.payment==='Efectivo'&&o.paymentStatus!=='Pagado'){toast('Confirma primero el efectivo recibido.','error');return;}o.status='Entregado';o.pickedUpAt=new Date().toISOString();o.pickedUpBy=currentUser();o.deliveryMode='Recogido en restaurante';write(KEY.orders,all);if(o.customer)addNotification(`Tu pedido ${o.id} fue recogido en el restaurante.`,o.customer,{type:'pedido',orderId:o.id,title:'Pedido recogido',detail:'El pedido fue entregado al cliente en el restaurante.',action:'invoice'});addNotification(`Pedido ${o.id} recogido en restaurante.`,null,{type:'pedido',orderId:o.id,title:'Recogida registrada',detail:`${o.customerName||o.customer||'Cliente'} retiró el pedido en el restaurante.`,roles:['Dueno','Administrador','Barra']});toast(`${id}: recogida registrada`,'success');this.render();},
        deliver(id){if(!['Dueno','Administrador','Delivery'].includes(currentRole())){toast('Solo Delivery o el administrador puede completar domicilios.','error');return;}const all=read(KEY.orders,[]),o=all.find(x=>x.id===id);if(!o||o.status!=='Listo')return;if(!String(o.orderType||'').toLowerCase().includes('domic')){toast('Este pedido no es un domicilio.','error');return;}if(o.paymentStatus!=='Pagado'&&o.payment==='Efectivo'){toast('Confirma primero el efectivo recibido.','error');return;}o.status='Entregado';o.deliveredAt=new Date().toISOString();o.deliveredBy=currentUser();o.deliveryMode='Domicilio';write(KEY.orders,all);if(o.customer)addNotification(`Tu pedido ${o.id} fue entregado correctamente.`,o.customer,{type:'pedido',orderId:o.id,title:'Pedido entregado',detail:'La entrega a domicilio fue completada.',action:'invoice'});addNotification(`Pedido ${o.id} entregado.`,null,{type:'pedido',orderId:o.id,title:'Entrega a domicilio completada',detail:`${o.customerName||o.customer||'Cliente'} recibió el pedido.`,roles:['Dueno','Administrador','Delivery']});toast(`${id}: entrega completada`,'success');this.render();}
    };
    // ===== REPORTES =====
    // Genera el comprobante PDF con los datos del pedido.
    const makeSimplePdf=lines=>{
        // Procesa la información de safe.
        const safe=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/·/g,'-').replace(/→/g,'-').replace(/[^\x20-\x7E]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
        const wrapped=[];const max=92;
        (lines||[]).forEach(line=>{const raw=String(line??'');if(!raw){wrapped.push('');return;}for(let i=0;i<raw.length;i+=max)wrapped.push(raw.slice(i,i+max));});
        const content=['BT','/F1 9 Tf','50 780 Td'];
        wrapped.slice(0,64).forEach((line,i)=>{if(i>0)content.push('0 -12 Td');content.push(`(${safe(line)}) Tj`);});content.push('ET');
        const stream=content.join('\n');
        const objects=[
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
        ];
        let pdf='%PDF-1.4\n',offsets=[0];
        objects.forEach((obj,idx)=>{offsets.push(pdf.length);pdf+=`${idx+1} 0 obj\n${obj}\nendobj\n`;});
        const xrefOffset=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        return new TextEncoder().encode(pdf);
    };
    // Estado compartido del módulo: reports.
    const reports={
        init(){this.ensureWeeklyCutoff();this.render();},
        periodStart(){const stored=localStorage.getItem(KEY.reportPeriod);if(stored&&/^\d{4}-\d{2}-\d{2}$/.test(stored))return stored;const today=localDate();localStorage.setItem(KEY.reportPeriod,today);return today;},
        currentSales(){const start=this.periodStart();return read(KEY.sales,[]).filter(s=>String(s.date||'').slice(0,10)>=start);},
        buildSnapshotFromSales(sales,periodStart=this.periodStart(),periodEnd=localDate(),kind='manual'){const total=sales.reduce((sum,x)=>sum+Number(x.total||0),0),orders=sales.length;const reservations=read(KEY.reservations,[]).filter(r=>String(r.date||'').slice(0,10)>=periodStart&&String(r.date||'').slice(0,10)<=periodEnd&&(r.status==='Confirmada'||r.status==='Atendida')).length;return{id:uid(kind==='weekly'?'SEM':'REP'),date:new Date().toISOString(),periodStart,periodEnd,kind,sales:Number(total.toFixed(2)),orders,average:Number((orders?total/orders:0).toFixed(2)),reservations,payments:{Efectivo:sales.filter(x=>x.payment==='Efectivo').length,Tarjeta:sales.filter(x=>x.payment==='Tarjeta').length,Transferencia:sales.filter(x=>x.payment==='Transferencia').length},details:sales.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).map(x=>({id:x.id,total:Number(x.total||0),payment:x.payment||'—',date:x.date,customer:x.customerName||x.customer||'Cliente'}))};},
        buildSnapshot(periodStart=this.periodStart(),periodEnd=localDate(),kind='manual'){return this.buildSnapshotFromSales(this.currentSales(),periodStart,periodEnd,kind);},
        save(downloadPdf=true,kind='manual'){
            const periodStart=this.periodStart(),today=localDate(),sales=this.currentSales();if(!sales.length){toast('No hay ventas del periodo actual para guardar','error');return null;}const snapshot=this.buildSnapshotFromSales(sales,periodStart,today,kind);const saved=read(KEY.savedReports,[]);saved.unshift(snapshot);write(KEY.savedReports,saved);write(KEY.reportArchive,[...read(KEY.reportArchive,[]),snapshot]);write(KEY.sales,[]);localStorage.setItem(KEY.reportPeriod,localDate());this.render();if(downloadPdf)this.downloadPdf(snapshot,true);toast(kind==='weekly'?'Reporte semanal guardado y periodo reiniciado':'Reporte guardado y PDF abierto para descarga');return snapshot;
        },
        collectWeeklySales(start,end){const byId=new Map();const inRange=s=>{const d=String(s?.date||'').slice(0,10);return d>=start&&d<=end;};this.currentSales().filter(inRange).forEach(s=>byId.set(String(s.id),s));read(KEY.savedReports,[]).filter(r=>r.kind!=='weekly').forEach(r=>(r.details||[]).filter(inRange).forEach(d=>{const id=String(d.id||'');if(id&&!byId.has(id))byId.set(id,{id,total:Number(d.total||0),payment:d.payment||'—',date:d.date,customerName:d.customer||'Cliente'});}));return Array.from(byId.values()).sort((a,b)=>new Date(a.date)-new Date(b.date));},
        ensureWeeklyCutoff(){const start=this.periodStart(),startDate=new Date(`${start}T00:00:00`),today=localDate();const days=Math.floor((new Date(`${today}T00:00:00`)-startDate)/86400000);if(days<7)return;const sales=this.collectWeeklySales(start,today);if(sales.length){const snapshot=this.buildSnapshotFromSales(sales,start,today,'weekly');const saved=read(KEY.savedReports,[]);const duplicate=saved.some(r=>r.kind==='weekly'&&r.periodStart===start&&r.periodEnd===today);if(!duplicate){saved.unshift(snapshot);write(KEY.savedReports,saved);write(KEY.reportArchive,[...read(KEY.reportArchive,[]),snapshot]);}}localStorage.setItem(KEY.reportPeriod,today);},
        render(){const sales=this.currentSales(),start=this.periodStart(),today=localDate(),total=sales.reduce((sum,x)=>sum+Number(x.total||0),0),orders=sales.length;const set=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=value;};set('reportSales',money(total));set('reportOrders',orders);set('reportAverage',money(orders?total/orders:0));set('reportPeriodLabel',`${start} · ${today}`);set('reportReservations',read(KEY.reservations,[]).filter(r=>String(r.date||'').slice(0,10)>=start&&String(r.date||'').slice(0,10)<=today&&(r.status==='Confirmada'||r.status==='Atendida')).length);const list=document.getElementById('salesList');if(list)list.innerHTML=sales.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8).map(x=>`<div class="recent-row"><div><strong>${x.id}</strong><small>${x.payment||'—'} · ${formatDateTime(x.date)}</small></div><strong>${money(x.total)}</strong></div>`).join('')||'<div class="empty-state compact"><p>No hay ventas en el periodo actual.</p></div>';const methods=['Efectivo','Tarjeta','Transferencia'],max=Math.max(1,...methods.map(m=>sales.filter(x=>x.payment===m).length));const dist=document.getElementById('paymentDistribution');if(dist)dist.innerHTML=methods.map(m=>{const n=sales.filter(x=>x.payment===m).length;return `<div class="distribution-row"><span>${m}</span><div><i style="width:${n/max*100}%"></i></div><strong>${n}</strong></div>`}).join('');this.renderSaved();},
        pdfLines(snapshot){const lines=['RESTAURANTEBD · REPORTE DE VENTAS',`Periodo: ${snapshot.periodStart} al ${snapshot.periodEnd}`,`Generado: ${formatDateTime(snapshot.date)}`,`Tipo: ${snapshot.kind==='weekly'?'Reporte semanal':'Reporte del periodo'}`,'',`Ventas totales: ${money(snapshot.sales)}`,`Ordenes pagadas: ${snapshot.orders}`,`Ticket promedio: ${money(snapshot.average)}`,`Reservas registradas: ${snapshot.reservations}`,'','DISTRIBUCION POR METODO DE PAGO',`Efectivo: ${snapshot.payments.Efectivo}`,`Tarjeta: ${snapshot.payments.Tarjeta}`,`Transferencia: ${snapshot.payments.Transferencia}`,'','DETALLE DE VENTAS'];(snapshot.details||[]).forEach((x,i)=>lines.push(`${i+1}. ${x.id} · ${x.customer} · ${x.payment} · ${money(x.total)} · ${formatDateTime(x.date)}`));return lines;},
        downloadPdf(snapshot,download=true){const pdf=makeSimplePdf(this.pdfLines(snapshot)),blob=new Blob([pdf],{type:'application/pdf'}),url=URL.createObjectURL(blob);const preview=window.open(url,'_blank','noopener');const a=document.createElement('a');a.href=url;a.download=`Reporte_${snapshot.periodStart}_${snapshot.periodEnd}.pdf`;document.body.appendChild(a);a.click();a.remove();if(!preview)toast('El navegador bloqueó la vista previa; el PDF se envió a descarga.','info');setTimeout(()=>URL.revokeObjectURL(url),60000);},
        downloadSaved(id){const report=read(KEY.savedReports,[]).find(r=>r.id===id);if(report)this.downloadPdf(report,true);},
        deleteSaved(id){const reportId=String(id||'');if(!reportId)return;if(!confirm('¿Eliminar este reporte guardado?'))return;write(KEY.savedReports,read(KEY.savedReports,[]).filter(r=>String(r.id)!==reportId));write(KEY.reportArchive,read(KEY.reportArchive,[]).filter(r=>String(r.id)!==reportId));this.renderSaved();toast('Reporte eliminado','info');},
        clearSaved(){if(!confirm('¿Limpiar el historial de reportes guardados? Las ventas del periodo actual no se eliminarán.'))return;write(KEY.savedReports,[]);write(KEY.reportArchive,[]);this.renderSaved();toast('Historial de reportes limpiado','info');},
        renderSaved(){const box=document.getElementById('savedReportsList');if(!box)return;const saved=read(KEY.savedReports,[]);box.innerHTML=saved.length?saved.slice(0,12).map(r=>`<div class="recent-row saved-report-row"><div><strong>${r.kind==='weekly'?'Semanal':'Reporte'} · ${r.periodStart} → ${r.periodEnd} · ${money(r.sales)}</strong><small>${r.orders} órdenes · ${r.reservations} reservas · ${formatDateTime(r.date)}</small></div><div class="saved-report-actions"><span class="status-pill success">Guardado</span><button type="button" class="secondary-btn small" onclick="ESFERestaurante.reports.downloadSaved('${this.escapeId(r.id)}')"><span class="action-icon">${this.iconPdf()}</span>PDF</button><button type="button" class="danger-btn small" onclick="ESFERestaurante.reports.deleteSaved('${this.escapeId(r.id)}')">Eliminar</button></div></div>`).join(''):'<div class="empty-state compact"><p>No hay reportes guardados.</p></div>';document.getElementById('savedReportsCount')&&(document.getElementById('savedReportsCount').textContent=saved.length);},
        escapeId(id){return String(id||'').replace(/[^A-Za-z0-9_-]/g,'');},
        iconPdf(){return '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3h9l3 3v15H6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v4h4M8.5 12h2.4a1.6 1.6 0 0 1 0 3.2H8.5zM13.5 15.2v-3.2h1.5a1.6 1.6 0 0 1 0 3.2z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'}
    };

    // Estado compartido del módulo: adminProducts.
    const adminProducts={
        editing:null,
        init(){this.refreshCategorySelect();this.render();this.renderCategories();},
        refreshCategorySelect(){const sel=document.getElementById('adminCategory');if(!sel)return;const cats=allCategories();sel.innerHTML=cats.map(c=>`<option value="${c.id}">${c.id}</option>`).join('');},
        render(){const box=document.getElementById('adminProductList');if(!box)return;const list=catalogProducts();box.innerHTML=list.map(p=>`<article class="admin-product-row"><img src="${p.image}" onerror="this.classList.add('image-missing')"><div><strong>${p.name}</strong><small>${p.cat} · ${money(p.price)}</small><p>${p.desc}</p><em>${p.ingredients.join(' · ')}</em></div><div class="admin-actions"><button class="secondary-btn small" onclick="ESFERestaurante.adminProducts.edit('${p.id}')">Editar</button><button class="danger-btn small" onclick="ESFERestaurante.adminProducts.remove('${p.id}')">Eliminar</button></div></article>`).join('')||'<div class="empty-state"><strong>No hay productos</strong></div>';document.getElementById('adminProductCount')&&(document.getElementById('adminProductCount').textContent=list.length);},
        renderCategories(){const box=document.getElementById('adminCategoryList');if(!box)return;box.innerHTML=customCategories().map(c=>`<div class="admin-category-row"><div><strong>${c.id}</strong><small>${c.desc}</small></div><span>Personalizada</span></div>`).join('')||'<div class="empty-state compact"><p>Las categorías base ya están listas. Aquí aparecerán las nuevas que agregues.</p></div>';document.getElementById('adminCategoryCount')&&(document.getElementById('adminCategoryCount').textContent=allCategories().length);},
        open(){if(!['Dueno','Administrador'].includes(currentRole())){toast('Solo el dueño puede administrar productos','error');return;}this.editing=null;this.fill(null);document.getElementById('productAdminModal')?.classList.remove('hidden');},
        edit(id){if(!['Dueno','Administrador'].includes(currentRole())){toast('Solo el dueño puede administrar productos','error');return;}const p=catalogProducts().find(x=>x.id===id);if(!p)return;this.editing=id;this.fill(p);document.getElementById('productAdminModal')?.classList.remove('hidden');},
        fill(p){this.refreshCategorySelect();document.getElementById('adminImageFile').value='';document.getElementById('adminName').value=p?.name||'';document.getElementById('adminCategory').value=p?.cat||allCategories()[0]?.id||'';document.getElementById('adminPrice').value=p?.price||'';document.getElementById('adminImage').value=p?.image||'';document.getElementById('adminDesc').value=p?.desc||'';document.getElementById('adminIngredients').value=p?.ingredients?.join(', ')||'';},
        save(){
            if(!['Dueno','Administrador'].includes(currentRole())){toast('Solo el dueño puede guardar productos','error');return;}
            const name=document.getElementById('adminName').value.trim(),cat=document.getElementById('adminCategory').value,price=Number(document.getElementById('adminPrice').value),imageInput=document.getElementById('adminImageFile'),typedImage=document.getElementById('adminImage').value.trim(),desc=document.getElementById('adminDesc').value.trim(),ingredients=document.getElementById('adminIngredients').value.split(',').map(x=>x.trim()).filter(Boolean);
            if(!name||!cat||!price||!desc||!ingredients.length){toast('Completa nombre, categoría, precio, descripción e ingredientes','error');return;}
            const newId=this.editing||'prod-'+Date.now();
            // Procesa la información de finish.
            const finish=image=>{const finalImage=image||typedImage||`/images/productos/${newId}.jpg`;saveProductOverride({id:newId,cat,name,price,image:finalImage,desc,ingredients,tags:['Administrado']});this.close();this.render();toast(this.editing?'Producto actualizado':'Producto agregado');};
            if(imageInput?.files?.length){const file=imageInput.files[0];if(!file.type.startsWith('image/')){toast('Selecciona una imagen válida','error');return;}const reader=new FileReader();reader.onload=()=>finish(reader.result);reader.readAsDataURL(file);}else finish('');
        },
        addCategory(){if(!['Dueno','Administrador'].includes(currentRole())){toast('Solo el dueño puede agregar categorías','error');return;}const name=document.getElementById('adminNewCategoryName')?.value.trim(),desc=document.getElementById('adminNewCategoryDesc')?.value.trim(),image=document.getElementById('adminNewCategoryImage')?.value.trim();if(!name||!desc){toast('Escribe el nombre y la descripción de la categoría','error');return false;}if(allCategories().some(c=>c.id.toLowerCase()===name.toLowerCase())){toast('Esa categoría ya existe','error');return false;}const id=name.replace(/\s+/g,' ').trim();const list=customCategories();list.push({id,image:image||`/images/categorias/${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.jpg`,desc});write(KEY.customCategories,list);['adminNewCategoryName','adminNewCategoryDesc','adminNewCategoryImage'].forEach(x=>{const e=document.getElementById(x);if(e)e.value='';});this.refreshCategorySelect();this.renderCategories();toast('Categoría agregada correctamente');return true;},
        remove(id){if(!['Dueno','Administrador'].includes(currentRole())){toast('Solo el dueño puede eliminar productos','error');return;}if(!confirm('¿Eliminar este producto del menú?'))return;deleteCatalogProduct(id);this.render();toast('Producto eliminado','info');},
        close(){document.getElementById('productAdminModal')?.classList.add('hidden');}
    };

    // ===== PANEL / DASHBOARD =====
    const dashboard={init(){this.render();setInterval(()=>this.render(),5000);},render(){const allOrders=read(KEY.orders,[]),allSales=read(KEY.sales,[]),res=read(KEY.reservations,[]),today=localDate(),owner=['Dueno','Administrador'].includes(currentRole()),user=currentUser();const orders=owner?allOrders:allOrders.filter(o=>(o.customer||'cliente@restaurante.com')===user);const sales=owner?allSales:allSales.filter(s=>(s.customer||'cliente@restaurante.com')===user);const todays=sales.filter(s=>s.date.startsWith(today));document.getElementById('cardPedidosHoy').textContent=orders.filter(o=>o.date.startsWith(today)).length;document.getElementById('cardEnPreparacion').textContent=orders.filter(o=>o.status==='Preparando').length;document.getElementById('cardVentasHoy').textContent=money(todays.reduce((s,x)=>s+x.total,0));document.getElementById('cardMesas').textContent=owner?tables.length-res.filter(r=>r.date===today&&(r.status==='Confirmada'||r.status==='Atendida')).length:res.filter(r=>r.date===today&&r.customer===user&&r.status==='Confirmada').length;document.getElementById('cardProductos').textContent=catalogProducts().length;document.getElementById('ultimaActualizacion').textContent=new Date().toLocaleTimeString('es-SV',{hour:'2-digit',minute:'2-digit',second:'2-digit'});const box=document.getElementById('recentOrders');const list=orders.slice(0,5);box.innerHTML=list.map(o=>`<div class="recent-row"><div><strong>${o.id}</strong><small>${o.items.map(i=>`${i.qty}× ${i.name}`).join(', ')}</small></div><span class="status-pill ${o.status==='Listo'?'success':o.status==='Preparando'?'warning':'neutral'}">${o.status}</span></div>`).join('')||'<div class="empty-state compact"><p>No hay pedidos todavía.</p></div>';}};

    // Estado compartido del módulo: notifications.
    const notifications={
        filter:'all',
        search:'',
        contacts:[],
        draftSaveTimer:null,
        attachments:[],
        selectionMode:false,
        selectedIds:new Set(),
        escape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));},
        init(){
            const host=document.getElementById('notificationContacts');
            try{this.contacts=host?.dataset.contacts?JSON.parse(host.dataset.contacts):[];}catch{this.contacts=[];}
            const fromName=document.getElementById('composeFromName');
            const fromEmail=document.getElementById('composeFromEmail');
            if(fromName)fromName.textContent=document.body?.dataset.userName||'Cuenta activa';
            if(fromEmail)fromEmail.textContent=currentUser()||'cuenta@restaurantebd.local';
            this.attachments=[];this.renderAttachments();
            this.render();updateNotificationBadges();this.updateComposeState();this.restoreDraft();
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById('composeAttachmentInput')?.addEventListener('change',e=>this.addAttachments(e.target.files));
            // Evento que conecta una acción del usuario con la lógica del módulo.
            ['composeRecipient','composeCc','composeBcc','composeSubject','composeMessage'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>this.scheduleDraft()));
            // Evento que conecta una acción del usuario con la lógica del módulo.
            document.getElementById('composeRecipient')?.addEventListener('change',()=>this.updateComposeState());
        },
        icon(type){const icons={
            factura:'<svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h9l3 3V20H6z" stroke="currentColor" stroke-width="1.8"/><path d="M14 3.5V7h4M8.5 11h7M8.5 15h7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
            pedido:'<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
            pago:'<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
            mensaje:'<svg viewBox="0 0 24 24" fill="none"><path d="M5 5.5h14a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H11l-5 3v-3.5H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
            general:'<svg viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
            download:'<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v11M8 11l4 4 4-4M5 20h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>', adjunto:'<svg viewBox="0 0 24 24" fill="none"><path d="m8.5 12.5 5.8-5.8a3.2 3.2 0 0 1 4.5 4.5l-7.1 7.1a4.3 4.3 0 0 1-6.1-6.1l7-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>', default:'<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="m5 7 7 5 7-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'};return icons[type]||icons.default;},
        typeLabel(type){return {factura:'Factura',pedido:'Pedido',pago:'Pago',mensaje:'Mensaje',general:'Aviso'}[type]||'Mensaje';},
        sender(n){return n.fromName||'RestauranteBD';},
        senderEmail(n){return n.fromEmail||'notificaciones@restaurantebd.local';},
        recipientLabel(n){if(n.toName)return n.toName;if(n.roles?.length)return n.roles.length===1?n.roles[0]:'Equipo operativo';return n.user||'Destinatario';},
        initials(name){const parts=String(name||'R').trim().split(/\s+/).slice(0,2);return parts.map(x=>x.charAt(0).toUpperCase()).join('')||'R';},
        senderPhoto(n){const email=String(n?.fromEmail||'').trim().toLowerCase();if(!email||email==='notificaciones@restaurantebd.local')return '';const contact=this.contacts.find(c=>String(c.Email||c.email||'').trim().toLowerCase()===email);return String(contact?.ProfilePhotoData||contact?.profilePhotoData||'').trim();},
        senderAvatar(n){const photo=this.senderPhoto(n);return photo?`<img src="${this.escape(photo)}" alt="Foto de perfil de ${this.escape(this.sender(n))}" loading="lazy" />`:this.escape(this.initials(this.sender(n)));},
        render(){
            const box=document.getElementById('notificationList');if(!box)return;
            const visibleAll=notificationsGet().filter(notificationVisible);
            const unreadCount=visibleAll.filter(x=>!x.read&&!x.sent&&!x.archived).length;
            const invoiceCount=visibleAll.filter(x=>x.type==='factura'&&!x.sent&&!x.archived).length;
            document.getElementById('notificationHeaderUnread')?.replaceChildren(document.createTextNode(String(unreadCount)));
            document.getElementById('notificationHeaderInvoices')?.replaceChildren(document.createTextNode(String(invoiceCount)));
            document.getElementById('mailUnreadSide')?.replaceChildren(document.createTextNode(String(unreadCount)));
            let list=visibleAll.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
            if(this.filter==='all')list=list.filter(x=>!x.sent&&!x.archived);
            if(this.filter==='unread')list=list.filter(x=>!x.read&&!x.sent&&!x.archived);
            if(this.filter==='invoice')list=list.filter(x=>x.type==='factura'&&!x.sent&&!x.archived);
            if(this.filter==='starred')list=list.filter(x=>x.starred&&!x.archived);
            if(this.filter==='sent')list=list.filter(x=>x.sent&&!x.archived);
            if(this.filter==='archive')list=list.filter(x=>x.archived);
            if(this.search)list=list.filter(x=>[x.title,x.message,x.detail,x.orderId,x.fromName,x.fromEmail,x.toName,x.toEmail].filter(Boolean).join(' ').toLowerCase().includes(this.search));
            const ids=new Set(list.map(x=>String(x.id)));
            [...this.selectedIds].forEach(id=>{if(!ids.has(String(id)))this.selectedIds.delete(id);});
            const selectable=list.length>0;
            const selectedCount=this.selectedIds.size;
            const allSelected=selectable && list.every(n=>this.selectedIds.has(String(n.id)));
            const toolbar=document.getElementById('notificationSelectionToolbar');
            const selectionCount=document.getElementById('notificationSelectionCount');
            const selectAll=document.getElementById('notificationSelectAll');
            if(toolbar)toolbar.hidden=!this.selectionMode;
            if(selectionCount)selectionCount.textContent=`${selectedCount} seleccionada${selectedCount===1?'':'s'}`;
            if(selectAll){selectAll.checked=allSelected;selectAll.indeterminate=selectedCount>0&&!allSelected;}
            document.getElementById('notificationDeleteSelected')?.toggleAttribute('disabled',selectedCount===0);
            document.getElementById('notificationArchiveSelected')?.toggleAttribute('disabled',selectedCount===0);
            if(!list.length){box.innerHTML='<div class="mail-empty"><div class="mail-empty-icon">'+this.icon(this.filter==='sent'?'mensaje':'general')+'</div><strong>Esta bandeja está vacía</strong><p>No hay mensajes que coincidan con la vista seleccionada.</p></div>';return;}
            box.innerHTML=list.map(n=>{
                const title=this.escape(n.title||'Sin asunto');
                const snippet=this.escape((n.message||n.detail||'Sin contenido').replace(/\s+/g,' ').slice(0,160));
                const date=this.escape(formatDateTime(n.date));
                const id=this.escape(n.id);
                const checked=this.selectedIds.has(String(n.id));
                return `<article class="mail-row ${n.read?'read':'unread'} ${n.sent?'sent':''} ${n.archived?'archived':''}" data-notification-id="${id}">
                    <div class="mail-select-wrap" ${this.selectionMode?'':'hidden'}><input class="mail-select-checkbox" type="checkbox" aria-label="Seleccionar mensaje" ${checked?'checked':''} onchange="ESFERestaurante.notifications.toggleSelection('${id}',this.checked)" onclick="event.stopPropagation()"></div>
                    <button type="button" class="mail-star ${n.starred?'active':''}" aria-label="${n.starred?'Quitar destacado':'Destacar'}" onclick="event.stopPropagation();ESFERestaurante.notifications.toggleStar('${id}')"><span class="ui-icon">${this.icon('default')}</span></button>
                    <div class="mail-avatar mail-avatar-photo">${this.senderAvatar(n)}</div>
                    <button type="button" class="mail-main" onclick="ESFERestaurante.notifications.markRead('${id}')">
                        <div class="mail-main-top"><strong>${this.escape(this.sender(n))}</strong><span>${this.escape(n.sent?'Para: '+this.recipientLabel(n):this.recipientLabel(n))}</span><time>${date}</time></div>
                        <div class="mail-subject"><span class="mail-type-icon">${this.icon(n.type)}</span><strong>${title}</strong>${n.orderId?`<em>${this.escape(n.orderId)}</em>`:''}</div>
                        <p>${snippet}</p>
                    </button>
                    <div class="mail-row-actions"><button type="button" class="icon-btn" aria-label="${n.read?'Marcar no leída':'Marcar leída'}" onclick="event.stopPropagation();ESFERestaurante.notifications.toggleRead('${id}')"><span class="ui-icon">${n.read?'<svg viewBox="0 0 24 24" fill="none"><path d="M5 12a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="m9 12 2 2 4-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>':'<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="m5 7 7 5 7-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'}</span></button><button type="button" class="icon-btn danger" aria-label="Eliminar mensaje" title="Eliminar mensaje" onclick="event.stopPropagation();ESFERestaurante.notifications.remove('${id}')"><span class="ui-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V4h6v3M8 7v13h8V7M10 11v5M14 11v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span></button></div>
                </article>`;
            }).join('');
        },
        toggleSelectionMode(force){this.selectionMode=typeof force==='boolean'?force:!this.selectionMode;if(!this.selectionMode)this.selectedIds.clear();const btn=document.getElementById('notificationSelectMode');if(btn){btn.classList.toggle('active',this.selectionMode);btn.textContent=this.selectionMode?'Cancelar selección':'Seleccionar';}this.render();},
        toggleSelection(id,checked){const key=String(id);if(checked)this.selectedIds.add(key);else this.selectedIds.delete(key);this.render();},
        toggleSelectAll(checked){const list=notificationsGet().filter(notificationVisible).filter(n=>{if(this.filter==='all')return !n.sent&&!n.archived;if(this.filter==='unread')return !n.read&&!n.sent&&!n.archived;if(this.filter==='invoice')return n.type==='factura'&&!n.sent&&!n.archived;if(this.filter==='starred')return n.starred&&!n.archived;if(this.filter==='sent')return n.sent&&!n.archived;if(this.filter==='archive')return n.archived;return true;}).filter(n=>{const q=this.search;return !q||[n.title,n.message,n.detail,n.orderId,n.fromName,n.fromEmail,n.toName,n.toEmail].filter(Boolean).join(' ').toLowerCase().includes(q);});list.forEach(n=>{const id=String(n.id);if(checked)this.selectedIds.add(id);else this.selectedIds.delete(id);});this.render();},
        deleteSelected(){const selected=[...this.selectedIds];if(!selected.length)return;if(!confirm(`¿Eliminar ${selected.length} mensaje${selected.length===1?'':'s'} seleccionados?`))return;notificationsSave(notificationsGet().filter(n=>!selected.includes(String(n.id))));this.selectedIds.clear();this.render();updateNotificationBadges();toast(`${selected.length} mensaje${selected.length===1?'':'s'} eliminado${selected.length===1?'':'s'}`,'info');},
        archiveSelected(){const selected=[...this.selectedIds];if(!selected.length)return;if(!confirm(`¿Archivar ${selected.length} mensaje${selected.length===1?'':'s'} seleccionados?`))return;const ids=new Set(selected);const list=notificationsGet();list.forEach(n=>{if(ids.has(String(n.id)))n.archived=true;});notificationsSave(list);this.selectedIds.clear();this.render();updateNotificationBadges();toast(`${selected.length} mensaje${selected.length===1?'':'s'} archivado${selected.length===1?'':'s'}`,'info');},
        markRead(id){const list=notificationsGet();const n=list.find(x=>x.id===id&&notificationVisible(x));if(n)n.read=true;notificationsSave(list);this.render();updateNotificationBadges();this.open(id);},
        detailIcon(type){return this.icon(type);},
        open(id){
            const n=notificationsGet().find(x=>x.id===id&&notificationVisible(x));if(!n)return;
            const modal=document.getElementById('notificationDetailModal');if(!modal)return;
            const order=read(KEY.orders,[]).find(o=>o.id===n.orderId);const invoice=n.orderId?getInvoice(n.orderId):null;const esc=this.escape.bind(this);
            const title=n.title||'Sin asunto', body=n.detail||n.message||'Has recibido un mensaje de RestauranteBD.';const renderedBody=this.renderMessageBody(body);const attachmentHtml=this.renderReaderAttachments(n.attachments||[]);
            const items=order?.items||[];const customerName=order?.customerName||order?.customer||'';
            // Construye la tarjeta de resumen que se muestra en la interfaz.
            const summaryCard=(label,value,extra='')=>`<div><span>${esc(label)}</span><strong>${esc(value||'No registrado')}</strong>${extra?`<small>${esc(extra)}</small>`:''}</div>`;
            const itemsHtml=items.length?`<section class="reader-section"><div class="reader-section-head"><div><span class="reader-section-icon">${this.icon('pedido')}</span><strong>Detalle de productos</strong></div><small>${items.length} ${items.length===1?'producto':'productos'}</small></div><div class="reader-items">${items.map(i=>`<div class="reader-item"><div><strong>${esc(i.name)}</strong><small>${Number(i.qty)||0} unidad(es)</small></div><span>${money(Number(i.price)||0)}</span><strong>${money((Number(i.price)||0)*(Number(i.qty)||0))}</strong></div>`).join('')}</div></section>`:'';
            const orderHtml=order?`<section class="reader-section"><div class="reader-section-head"><div><span class="reader-section-icon">${this.icon('pedido')}</span><strong>Información del pedido</strong></div><span class="reader-status">${esc(order.status||'Actualizado')}</span></div><div class="reader-grid">${summaryCard('Número de pedido',order.id)}${summaryCard('Fecha',formatDateTime(order.date))}${summaryCard('Tipo de pedido',order.orderType||'No especificado')}${summaryCard('Cliente',customerName||currentUser())}${summaryCard('Subtotal',money(Number(order.subtotal)||0))}${summaryCard('IVA',money(Number(order.tax)||0))}${summaryCard('Total',money(Number(order.total)||0))}${summaryCard('Estado',order.status||'Actualizado')}</div></section>`:'';
            const paymentHtml=order?`<section class="reader-section"><div class="reader-section-head"><div><span class="reader-section-icon">${this.icon('pago')}</span><strong>Información del pago</strong></div><span class="reader-status ${order.paymentStatus==='Pagado'?'paid':''}">${esc(order.paymentStatus||'Pendiente')}</span></div><div class="reader-grid">${summaryCard('Método',order.payment)}${summaryCard('Referencia',order.paymentRef||'No aplica')}${summaryCard('Fecha de pago',order.paidAt?formatDateTime(order.paidAt):'Aún no registrado')}${summaryCard('Factura',invoice?.invoiceNumber||'Disponible al confirmar')}</div></section>`:'';
            const deliveryHtml=order&&(order.orderType||'').toLowerCase().includes('domic')?`<section class="reader-section"><div class="reader-section-head"><div><span class="reader-section-icon">${this.icon('pedido')}</span><strong>Entrega a domicilio</strong></div></div><div class="reader-grid">${summaryCard('Teléfono',order.deliveryPhone||order.customerPhone)}${summaryCard('Dirección',order.deliveryAddress)}</div></section>`:'';
            const noteHtml=order?.note?`<section class="reader-note"><span class="reader-section-icon">${this.icon('mensaje')}</span><div><strong>Observación</strong><p>${esc(order.note)}</p></div></section>`:'';
            const mailMeta=`<section class="reader-meta"><div>${summaryCard('De',this.sender(n),this.senderEmail(n))}${summaryCard('Para',n.sent?this.recipientLabel(n):currentUser(),n.toEmail||('Área: '+(currentRole()||'Operación')))}</div><div>${summaryCard('Enviado',formatDateTime(n.date))}${summaryCard('Identificador',n.id)}</div></section>`;
            const html=`<div class="reader-intro"><div class="reader-message-rendered">${renderedBody}</div></div>${attachmentHtml}${mailMeta}${orderHtml}${itemsHtml}${paymentHtml}${deliveryHtml}${noteHtml}${invoice?`<section class="reader-invoice-banner"><div><strong>Factura digital disponible</strong><span>${esc(invoice.invoiceNumber)} · ${money(invoice.total)}</span></div><button class="primary-btn small" onclick="ESFERestaurante.invoices.show('${esc(n.orderId)}')">Abrir factura</button></section>`:''}`;
            modal.classList.add('show');
            modal.querySelector('[data-notification-detail-title]').textContent=title;
            modal.querySelector('[data-notification-detail-icon]').innerHTML=this.detailIcon(n.type);
            modal.querySelector('[data-notification-detail-type]').textContent=this.typeLabel(n.type);
            modal.querySelector('[data-notification-detail-sender]').textContent=this.sender(n);
            modal.querySelector('[data-notification-detail-sender-email]').textContent=this.senderEmail(n);
            modal.querySelector('[data-notification-detail-recipient]').textContent=n.sent?`para ${this.recipientLabel(n)}`:`para ${currentUser()||'mí'}`;
            const detailAvatar=modal.querySelector('[data-notification-detail-avatar]');if(detailAvatar){detailAvatar.innerHTML=this.senderAvatar(n);detailAvatar.classList.toggle('has-photo',!!this.senderPhoto(n));}
            modal.querySelector('[data-notification-detail-date]').textContent=formatDateTime(n.date);
            modal.querySelector('[data-notification-detail-body]').innerHTML=html;
            const star=modal.querySelector('[data-notification-detail-star]');if(star){star.classList.toggle('active',!!n.starred);star.onclick=()=>this.toggleStar(n.id);}
            const detailDelete=modal.querySelector('[data-notification-detail-delete]');if(detailDelete){detailDelete.onclick=()=>this.remove(n.id);}
            const reply=modal.querySelector('[data-notification-detail-reply]');if(reply){reply.style.display=n.sent?'none':'inline-flex';reply.onclick=()=>{this.close();this.openCompose({to:n.fromEmail||n.user||'',subject:(title.startsWith('Re:')?'':'Re: ')+title,body:'\n\n--- Mensaje original ---\n'+body});};}
            const action=modal.querySelector('[data-notification-detail-action]');if(action){const pendingPay=order&&order.paymentStatus!=='Pagado'&&n.action==='payment';if(invoice&&n.orderId){action.innerHTML='<span class="action-icon">'+this.icon('factura')+'</span>Ver factura';action.style.display='inline-flex';action.onclick=()=>showInvoice(n.orderId);}else if(pendingPay){action.innerHTML='<span class="action-icon">'+this.icon('pago')+'</span>Pagar pedido';action.style.display='inline-flex';action.onclick=()=>{sessionStorage.setItem('esfe_pay_order_id',order.id);location.href='/ProcesarPago1/Index';};}else{action.innerHTML='';action.style.display='none';action.onclick=null;}}
        },
        renderMessageBody(text){
            const escaped=this.escape(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/_(.+?)_/g,'<em>$1</em>').replace(/^> (.*)$/gm,'<blockquote>$1</blockquote>').replace(/^• (.*)$/gm,'<li>$1</li>').replace(/\n/g,'<br>');
            return escaped.replace(/(<li>.*?<\/li>)(?:<br>)?/gs,'<ul class="reader-message-list">$1</ul>');
        },
        renderReaderAttachments(attachments){
            if(!Array.isArray(attachments)||!attachments.length)return '';
            // Procesa la información de kind.
            const kind=a=>{const name=String(a.name||'').toLowerCase();if(name.endsWith('.pdf'))return ['PDF','pdf'];if(/\.(doc|docx)$/.test(name))return ['WORD','word'];if(/\.(xls|xlsx|csv)$/.test(name))return ['XLS','sheet'];if(/\.(ppt|pptx)$/.test(name))return ['PPT','slide'];if(/\.(png|jpg|jpeg|webp|gif)$/.test(name))return ['IMG','image'];return ['FILE','file'];};
            return `<section class="reader-attachments"><div class="reader-section-head"><div><span class="reader-section-icon">${this.icon('adjunto')}</span><strong>Archivos adjuntos</strong><small>${attachments.length} archivo${attachments.length===1?'':'s'}</small></div></div><div class="reader-attachment-list">${attachments.map(a=>{const [label,cls]=kind(a);return `<a class="reader-attachment reader-attachment-pro ${cls}" href="${a.data}" download="${this.escape(a.name)}"><span class="reader-attachment-filemark"><span>${label}</span></span><span class="reader-attachment-copy"><strong>${this.escape(a.name)}</strong><small>${(Number(a.size||0)/1024/1024).toFixed(2)} MB · ${label==='IMG'?'Imagen':'Documento'}</small></span><span class="action-icon">${this.icon('download')}</span></a>`;}).join('')}</div></section>`;
        },
        close(){document.getElementById('notificationDetailModal')?.classList.remove('show');},
        remove(id){const list=notificationsGet();const n=list.find(x=>x.id===id&&notificationVisible(x));if(!n)return;if(!confirm('¿Eliminar este mensaje o notificación?'))return;notificationsSave(list.filter(x=>x.id!==id));this.close();this.render();updateNotificationBadges();toast('Mensaje eliminado','info');},
        toggleRead(id){const list=notificationsGet();const n=list.find(x=>x.id===id&&notificationVisible(x));if(n)n.read=!n.read;notificationsSave(list);this.render();updateNotificationBadges();},
        toggleStar(id){const list=notificationsGet();const n=list.find(x=>x.id===id&&notificationVisible(x));if(n)n.starred=!n.starred;notificationsSave(list);this.render();updateNotificationBadges();if(document.getElementById('notificationDetailModal')?.classList.contains('show'))this.open(id);},
        markAllRead(){const list=notificationsGet();list.forEach(n=>{if(notificationVisible(n)&&!n.sent&&!n.archived)n.read=true});notificationsSave(list);this.render();updateNotificationBadges();},
        setFilter(filter){this.filter=filter;this.selectedIds.clear();document.querySelectorAll('[data-notification-filter]').forEach(b=>b.classList.toggle('active',b.dataset.notificationFilter===filter));this.render();},
        searchFor(value){this.search=String(value||'').trim().toLowerCase();this.render();},
        openCompose(prefill={}){
            const modal=document.getElementById('composeMailModal');if(!modal)return;
            this.close();modal.classList.add('show');
            const recipient=document.getElementById('composeRecipient');const subject=document.getElementById('composeSubject');const message=document.getElementById('composeMessage');
            const cc=document.getElementById('composeCc');const bcc=document.getElementById('composeBcc');
            recipient.value=prefill.to||'';subject.value=prefill.subject||'';message.value=prefill.body||'';
            if(cc)cc.value=''; if(bcc)bcc.value='';
            document.getElementById('composeCcRow')?.setAttribute('hidden','');document.getElementById('composeBccRow')?.setAttribute('hidden','');
            this.clearDraft();this.attachments=[];this.renderAttachments();this.updateComposeState();setTimeout(()=>recipient.focus(),80);
        },
        closeCompose(){document.getElementById('composeMailModal')?.classList.remove('show');},
        updateComposeState(){
            const input=document.getElementById('composeRecipient');if(!input)return;
            const count=this.parseEmailList(input.value).length;
            const hint=['Dueno','Administrador'].includes(currentRole())
                ? 'Puedes escribir uno o varios correos directamente. Para envíos a un área completa utiliza los destinatarios internos autorizados.'
                : 'Escribe el correo electrónico de la persona o área a la que quieres contactar. Tu cuenta no tiene destinatarios masivos.';
            const suffix=count?` · ${count} destinatario${count===1?'':'s'} detectado${count===1?'':'s'}`:'';
            document.getElementById('composeRecipientHint')?.replaceChildren(document.createTextNode(hint+suffix));
        },
        parseEmailList(value){return String(value||'').split(/[;,]/).map(x=>x.trim().toLowerCase()).filter(Boolean);},
        isValidEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);},
        addAttachments(fileList){
            const files=Array.from(fileList||[]);if(!files.length)return;
            const MAX_FILE=200*1024*1024,MAX_TOTAL=200*1024*1024,MAX_FILES=5;
            if(this.attachments.length>=MAX_FILES){toast('Máximo 5 archivos por mensaje','error');return;}
            let total=this.attachments.reduce((n,f)=>n+Number(f.size||0),0);
            let pending=files.slice(0,MAX_FILES-this.attachments.length);
            let chain=Promise.resolve();
            pending.forEach(file=>{chain=chain.then(()=>{
                if(file.size>MAX_FILE){toast(`${file.name}: máximo 200 MB`,'error');return;}
                if(total+file.size>MAX_TOTAL){toast('Los adjuntos no pueden superar 200 MB en total','error');return;}
                return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>{this.attachments.push({name:file.name,size:file.size,type:file.type||'application/octet-stream',data:reader.result});total+=file.size;this.renderAttachments();this.scheduleDraft();resolve();};reader.onerror=()=>{toast(`No se pudo leer ${file.name}`,'error');resolve();};reader.readAsDataURL(file);});
            });});
            chain.then(()=>{const input=document.getElementById('composeAttachmentInput');if(input)input.value='';});
        },
        removeAttachment(index){this.attachments.splice(Number(index),1);this.renderAttachments();this.scheduleDraft();},
        renderAttachments(){
            const box=document.getElementById('composeAttachments');if(!box)return;
            if(!this.attachments.length){box.innerHTML='';box.hidden=true;return;}
            box.hidden=false;box.innerHTML=this.attachments.map((a,i)=>`<span class="compose-attachment-chip"><span class="ui-icon">${this.icon('adjunto')}</span><span title="${this.escape(a.name)}">${this.escape(a.name)}</span><small>${(a.size/1024/1024).toFixed(2)} MB</small><button type="button" aria-label="Quitar ${this.escape(a.name)}" onclick="ESFERestaurante.notifications.removeAttachment(${i})">×</button></span>`).join('');
        },
        toggleFormatTools(){document.getElementById('composeFormatPanel')?.classList.toggle('show');},
        insertFormat(token){const ta=document.getElementById('composeMessage');if(!ta)return;const a=ta.selectionStart,b=ta.selectionEnd,selected=ta.value.slice(a,b)||'texto';const wrapped=token==='bold'?`**${selected}**`:token==='italic'?`_${selected}_`:token==='quote'?`> ${selected}`:`• ${selected}`;ta.setRangeText(wrapped,a,b,'end');ta.focus();this.scheduleDraft();},
        sendCompose(){
            const recipientInput=document.getElementById('composeRecipient'),subject=document.getElementById('composeSubject'),message=document.getElementById('composeMessage');
            const ccInput=document.getElementById('composeCc'),bccInput=document.getElementById('composeBcc');
            const toList=this.parseEmailList(recipientInput?.value),title=subject?.value.trim()||'',body=message?.value.trim()||'',cc=this.parseEmailList(ccInput?.value),bcc=this.parseEmailList(bccInput?.value);
            const me=currentUser().toLowerCase(),role=currentRole();
            if(!toList.length){toast('Escribe el correo del destinatario','error');recipientInput?.focus();return;}
            if(toList.some(x=>!this.isValidEmail(x))){toast('Revisa los correos del campo Para','error');recipientInput?.focus();return;}
            if(role!=='Dueno'&&toList.length>1){toast('Tu cuenta puede enviar a un destinatario por mensaje.','error');return;}
            if(toList.includes(me)){toast('No puedes enviarte el mensaje a tu propia cuenta.','error');return;}
            if(!title){toast('Escribe un asunto','error');return;}
            if(body.length<2){toast('Escribe el contenido del mensaje','error');return;}
            const allCc=cc.filter(this.isValidEmail).filter(x=>x!==me),allBcc=bcc.filter(this.isValidEmail).filter(x=>x!==me);
            if(cc.length!==allCc.length||bcc.length!==allBcc.length){toast('Hay un correo inválido en Cc o Cco','error');return;}
            const duplicateSet=new Set(toList);
            if(allCc.some(x=>duplicateSet.has(x))||allBcc.some(x=>duplicateSet.has(x))){toast('No repitas al destinatario en Para, Cc o Cco','error');return;}
            const now=new Date().toISOString(),id=uid('MAIL'),attachments=this.attachments.map(a=>({name:a.name,size:a.size,type:a.type,data:a.data}));
            const allRecipients=[...toList,...allCc,...allBcc].filter((v,i,a)=>a.indexOf(v)===i);
            const list=notificationsGet();
            allRecipients.forEach((email,index)=>{
                const contact=this.contacts.find(c=>String(c.Email||c.email||'').toLowerCase()===email);
                const recipientType=toList.includes(email)?'Para':allCc.includes(email)?'Cc':'Cco';
                list.unshift({id:uid('MAIL'),date:now,title,message:body,detail:body,type:'mensaje',read:false,starred:false,action:null,fromName:(document.body.dataset.userName||'Usuario RestauranteBD'),fromEmail:currentUser(),toName:contact?.Nombre||contact?.nombre||email,toEmail:email,user:email,roles:[],cc:allCc.filter(x=>x!==email),bcc:[],toList:[email],recipientType,orderId:'',attachments,sent:false});
            });
            list.unshift({id,user:currentUser(),roles:[],date:now,title,message:body,detail:body,type:'mensaje',read:true,starred:false,action:null,fromName:(document.body.dataset.userName||'Usuario RestauranteBD'),fromEmail:currentUser(),toName:toList.length===1?(this.contacts.find(c=>String(c.Email||c.email||'').toLowerCase()===toList[0])?.Nombre||toList[0]):`${toList.length} destinatarios`,toEmail:toList.join(', '),cc:allCc,bcc:allBcc,toList,recipientType:'Enviado',orderId:'',attachments,sent:true});
            notificationsSave(list);this.clearDraft();this.closeCompose();this.filter='sent';this.render();updateNotificationBadges();toast(`Mensaje enviado a ${allRecipients.length} destinatario${allRecipients.length===1?'':'s'}`);setTimeout(()=>this.setFilter('all'),900);
        },
        scheduleDraft(){clearTimeout(this.draftSaveTimer);this.draftSaveTimer=setTimeout(()=>this.saveDraft(),350);},
        saveDraft(){const draft={to:document.getElementById('composeRecipient')?.value||'',cc:document.getElementById('composeCc')?.value||'',bcc:document.getElementById('composeBcc')?.value||'',subject:document.getElementById('composeSubject')?.value||'',body:document.getElementById('composeMessage')?.value||'',attachments:this.attachments,savedAt:new Date().toISOString()};localStorage.setItem('restaurantebd_mail_draft',JSON.stringify(draft));document.getElementById('composeDraftStatus')?.replaceChildren(document.createTextNode('Borrador guardado automáticamente'));},
        restoreDraft(){try{const d=JSON.parse(localStorage.getItem('restaurantebd_mail_draft')||'null');if(d?.subject||d?.body||d?.to){const recipient=document.getElementById('composeRecipient');const cc=document.getElementById('composeCc');const bcc=document.getElementById('composeBcc');const subject=document.getElementById('composeSubject');const message=document.getElementById('composeMessage');if(recipient)recipient.value=d.to||'';if(cc)cc.value=d.cc||'';if(bcc)bcc.value=d.bcc||'';if(subject)subject.value=d.subject||'';if(message)message.value=d.body||'';this.attachments=Array.isArray(d.attachments)?d.attachments.slice(0,5):[];this.renderAttachments();this.updateComposeState();document.getElementById('composeDraftStatus')?.replaceChildren(document.createTextNode('Borrador recuperado'));}}catch{}},
        clearDraft(){localStorage.removeItem('restaurantebd_mail_draft');document.getElementById('composeDraftStatus')?.replaceChildren(document.createTextNode(''));},
    };
    setInterval(()=>{updateNotificationBadges();reports.ensureWeeklyCutoff();const box=document.getElementById('notificationList');if(box)notifications.render();},3000);
    // Configura las reglas de validación de los campos.
    function setupInputRules(scope=document){
        const root=scope||document;
        // Evento que conecta una acción del usuario con la lógica del módulo.
        root.querySelectorAll?.('[data-letters-only]').forEach(input=>{if(input.dataset.rulesBound)return;input.dataset.rulesBound='1';input.addEventListener('input',()=>{input.value=input.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]/g,'').replace(/\s{2,}/g,' ');});});
        // Evento que conecta una acción del usuario con la lógica del módulo.
        root.querySelectorAll?.('[data-phone]').forEach(input=>{if(input.dataset.rulesBound)return;input.dataset.rulesBound='1';input.addEventListener('input',()=>{let v=input.value.replace(/\D/g,'').slice(0,8);if(v.length>4)v=v.slice(0,4)+'-'+v.slice(4);input.value=v;});});
        // Evento que conecta una acción del usuario con la lógica del módulo.
        root.querySelectorAll?.('[data-dui]').forEach(input=>{if(input.dataset.rulesBound)return;input.dataset.rulesBound='1';input.addEventListener('input',()=>{let v=input.value.replace(/\D/g,'').slice(0,9);if(v.length>8)v=v.slice(0,8)+'-'+v.slice(8);input.value=v;});});
        // Evento que conecta una acción del usuario con la lógica del módulo.
        root.querySelectorAll?.('input[type="number"]').forEach(input=>{input.addEventListener('input',()=>{if(input.maxLength>0)input.value=input.value.slice(0,input.maxLength);});});
        root.querySelectorAll?.('input[type="date"]').forEach(input=>{const today=new Date();const local=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;if(!input.min)input.min=local;});
    }
    // Evento que conecta una acción del usuario con la lógica del módulo.
    document.addEventListener('DOMContentLoaded',()=>{
        setupInputRules();
        updateNotificationBadges();
        const box=document.getElementById('notificationList');
        if(box && window.ESFERestaurante?.notifications) window.ESFERestaurante.notifications.render();
    });
    // Evento que conecta una acción del usuario con la lógica del módulo.
    document.addEventListener('esfe:database-ready',()=>{
        updateNotificationBadges();
        const box=document.getElementById('notificationList');
        if(box && window.ESFERestaurante?.notifications) window.ESFERestaurante.notifications.render();
    });

    return {products,catalogProducts,categories,allCategories,tables,money,KEY,localDate,formatDateTime,layout,welcome,chat,menu,cart,reservas,payment,orders,kitchen,ready,reports,dashboard,adminProducts,notifications,addNotification,ui:{mostrarToast:toast},invoices:{show:showInvoice,get:getInvoice,create:createInvoice}};

})();
// Exponer el centro de la aplicación al ámbito global para que los módulos cargados después
// (pedidos locales, pagos, carrito, chatbot, etc.) puedan integrarse correctamente.
window.ESFERestaurante = ESFERestaurante;
// Evento que conecta una acción del usuario con la lógica del módulo.
document.addEventListener('DOMContentLoaded', () => { ESFERestaurante.layout.init(); ESFERestaurante.welcome.init(); });
