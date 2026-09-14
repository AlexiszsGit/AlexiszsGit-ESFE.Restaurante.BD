(() => {
    if (!window.ESFERestaurante?.chat) return;

    const bot = ESFERestaurante.chat;
    const normalize = text => String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const isAuth = () => ["true", "True"].includes(document.body.dataset.auth);
    const role = () => document.body.dataset.role || "Publico";
    const products = () => ESFERestaurante.products;
    const money = value => ESFERestaurante.money(value);
    const read = key => {
        try {
            return JSON.parse(localStorage.getItem(key) || "[]");
        } catch {
            return [];
        }
    };

    let pendingProduct = null;
    let pendingReservation = null;

    const addMessage = (html, kind = "bot") => {
        const box = document.getElementById("chatMessages");
        if (!box) return;
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${kind}`;
        bubble.innerHTML = html;
        box.appendChild(bubble);
        box.scrollTop = box.scrollHeight;
    };

    const addAction = (label, callback, className = "chat-action-button") => {
        const box = document.getElementById("chatMessages");
        if (!box) return;
        const wrapper = document.createElement("div");
        wrapper.className = "chat-inline-actions";
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", callback, { once: true });
        wrapper.appendChild(button);
        box.appendChild(wrapper);
        box.scrollTop = box.scrollHeight;
    };

    const addProductOptions = list => {
        const unique = [...new Map(list.map(item => [item.id, item])).values()].slice(0, 5);
        if (!unique.length) {
            addMessage("No encontré un producto que coincida. Prueba con una categoría como <strong>hamburguesas</strong>, <strong>pizzas</strong> o <strong>bebidas</strong>.");
            return;
        }

        addMessage(`<div class="chat-product-results">${unique.map(product => `
            <div class="chat-product-option">
                <div>
                    <strong>${product.name}</strong>
                    <span>${money(product.price)}</span>
                    <small>${product.desc}</small>
                </div>
                <button type="button" data-chat-product-id="${product.id}">Elegir</button>
            </div>`).join("")}</div>`);

        document.querySelectorAll("[data-chat-product-id]").forEach(button => {
            button.addEventListener("click", () => {
                const product = products().find(item => item.id === button.dataset.chatProductId);
                if (!product) return;
                pendingProduct = { product, quantity: 1 };
                addMessage(`Seleccionaste <strong>${product.name}</strong>. ¿Cuántas unidades quieres?`);
                addAction("1 unidad", () => confirmProduct(1));
                addAction("2 unidades", () => confirmProduct(2));
                addAction("3 unidades", () => confirmProduct(3));
            }, { once: true });
        });
    };

    const confirmProduct = quantity => {
        if (!pendingProduct) return;
        pendingProduct.quantity = quantity;
        const product = pendingProduct.product;
        addMessage(`Voy a agregar <strong>${quantity} × ${product.name}</strong> por <strong>${money(product.price * quantity)}</strong>.`);
        addAction("Confirmar y agregar", () => {
            if (!isAuth() || role() !== "Cliente") {
                addMessage("Para modificar el carrito necesitas una cuenta de Cliente iniciada.");
                addAction("Iniciar sesión", () => { window.location.href = "/IniciarSesion1/Index"; });
                pendingProduct = null;
                return;
            }

            const cart = read(ESFERestaurante.KEY.cart);
            const existing = cart.find(item => item.productId === product.id);
            if (existing) {
                existing.qty += quantity;
            } else {
                cart.push({
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    qty: quantity,
                    ingredients: product.ingredients
                });
            }
            localStorage.setItem(ESFERestaurante.KEY.cart, JSON.stringify(cart));
            addMessage(`<strong>Agregado.</strong> Tu carrito ahora incluye ${quantity} × ${product.name}. Antes de cobrar, revisaremos tipo de pedido, reserva o domicilio y pago.`);
            addAction("Revisar y finalizar pedido", () => { window.location.href = "/PedidoyCarrito1/Index"; });
            pendingProduct = null;
        });
    };

    const validateReservationData = data => {
        const dateValid = /^20\d{2}-\d{2}-\d{2}$/.test(data.date);
        const timeValid = /^\d{2}:\d{2}$/.test(data.time);
        const peopleValid = Number.isInteger(data.people) && data.people > 0 && data.people <= 12;
        if (!dateValid || !timeValid || !peopleValid) return "Necesito una fecha válida, una hora válida y el número de personas.";

        const date = new Date(`${data.date}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) return "La fecha de reserva no puede ser anterior a hoy.";

        const minutes = Number(data.time.slice(0, 2)) * 60 + Number(data.time.slice(3));
        if (minutes < 360 || minutes > 1320) return "El horario de reservas es de 06:00 a 22:00.";
        return "";
    };

    const showReservationTables = () => {
        if (!pendingReservation) return;
        const validationError = validateReservationData(pendingReservation);
        if (validationError) {
            addMessage(validationError);
            pendingReservation = null;
            return;
        }

        const reservations = read(ESFERestaurante.KEY.reservations);
        const available = ESFERestaurante.tables.filter(table =>
            table.seats >= pendingReservation.people
            && !reservations.some(reservation =>
                reservation.tableId === table.id
                && reservation.date === pendingReservation.date
                && reservation.time === pendingReservation.time
                && reservation.status === "Confirmada"));

        if (!available.length) {
            addMessage("No hay mesas compatibles para ese horario y cantidad de personas. Podemos cambiar la hora o la cantidad de personas.");
            addAction("Cambiar hora", () => addMessage("Escribe la nueva hora en formato HH:MM."));
            pendingReservation = null;
            return;
        }

        addMessage(`Encontré <strong>${available.length}</strong> mesa(s) disponible(s) para ${pendingReservation.people} persona(s). Elige una para continuar.`);
        available.slice(0, 8).forEach(table => {
            addAction(`Mesa ${String(table.id).padStart(2, "0")} · ${table.seats} personas · ${table.zone}`, () => confirmReservation(table));
        });
    };

    const confirmReservation = table => {
        if (!pendingReservation) return;
        addMessage(`Revisa antes de confirmar:<br><strong>Mesa ${String(table.id).padStart(2, "0")}</strong> · ${pendingReservation.date} · ${pendingReservation.time} · ${pendingReservation.people} persona(s).`);
        addAction("Confirmar reserva", () => {
            if (!isAuth() || role() !== "Cliente") {
                addMessage("Necesitas iniciar sesión como Cliente para guardar una reserva.");
                addAction("Iniciar sesión", () => { window.location.href = "/IniciarSesion1/Index"; });
                return;
            }

            const name = document.body.dataset.userName || "Cliente";
            const reservations = read(ESFERestaurante.KEY.reservations);
            const reservation = {
                id: `RES-${Date.now().toString(36).toUpperCase()}`,
                customer: document.body.dataset.user || "",
                customerName: name,
                customerPhone: document.body.dataset.phone || "",
                customerDui: document.body.dataset.dui || "",
                tableId: table.id,
                table: `Mesa ${String(table.id).padStart(2, "0")}`,
                name,
                people: pendingReservation.people,
                date: pendingReservation.date,
                time: pendingReservation.time,
                zone: table.zone,
                status: "Confirmada",
                arrived: false,
                createdAt: new Date().toISOString(),
                origin: "Chatbot"
            };

            reservations.push(reservation);
            localStorage.setItem(ESFERestaurante.KEY.reservations, JSON.stringify(reservations));
            addMessage(`<strong>Reserva confirmada.</strong> ${reservation.table}, ${reservation.date} a las ${reservation.time}, para ${reservation.people} persona(s). La encontrarás también en Reservas.`);
            addAction("Ver mis reservas", () => { window.location.href = "/ReservarMesas1/Index"; });
            pendingReservation = null;
        });
    };

    const captureReservationDetails = text => {
        const details = {};
        const explicitDate = String(text).match(/(20\d{2}-\d{2}-\d{2})/);
        const normalized = normalize(text);
        if (explicitDate) {
            details.date = explicitDate[1];
        } else if (/\bmanana\b/.test(normalized)) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            details.date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
        } else if (/\bhoy\b/.test(normalized)) {
            const today = new Date();
            details.date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        }

        const exactTime = String(text).match(/(?:\ba\s+las\s+|\b)([01]?\d|2[0-3])(?::([0-5]\d))\s*(am|pm)?\b|\b([1-9]|1[0-2])\s*(am|pm)\b/i);
        if (exactTime) {
            let hour = Number(exactTime[1] || exactTime[4]);
            const minute = Number(exactTime[2] || 0);
            const period = (exactTime[3] || exactTime[5])?.toLowerCase();
            if (period === "pm" && hour < 12) hour += 12;
            if (period === "am" && hour === 12) hour = 0;
            details.time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        }

        const people = normalized.match(/(\d+)\s*(?:personas|persona|comensales)/)?.[1];
        if (people) details.people = Number(people);
        return details;
    };

    const startReservation = () => {
        if (!isAuth() || role() !== "Cliente") {
            addMessage("Para reservar una mesa necesitas iniciar sesión con una cuenta de Cliente.");
            addAction("Iniciar sesión", () => { window.location.href = "/IniciarSesion1/Index"; });
            return;
        }
        pendingReservation = {};
        addMessage("Vamos paso a paso. Escríbeme <strong>fecha + hora + personas</strong>, por ejemplo: <strong>2026-09-20 19:30 para 4 personas</strong>.");
    };

    const originalAsk = bot.ask.bind(bot);
    bot.ask = text => {
        const value = String(text || "").trim();
        if (!value) return;

        const normalized = normalize(value);

        if (pendingReservation) {
            Object.assign(pendingReservation, captureReservationDetails(value));

            if (pendingReservation.date && pendingReservation.time && pendingReservation.people) {
                showReservationTables();
            } else {
                addMessage(`Voy guardando la información. Faltan ${[
                    !pendingReservation.date && "fecha",
                    !pendingReservation.time && "hora",
                    !pendingReservation.people && "personas"
                ].filter(Boolean).join(", ")}.`);
            }
            return;
        }

        if (/\b(reservar|reserva|mesa)\b/.test(normalized)) {
            startReservation();
            Object.assign(pendingReservation, captureReservationDetails(value));
            if (pendingReservation.date && pendingReservation.time && pendingReservation.people) {
                showReservationTables();
            }
            return;
        }

        const quantity = Number(normalized.match(/\b(\d+)\b/)?.[1] || 1);
        const productMatches = products().filter(product => {
            const text = normalize(`${product.name} ${product.cat} ${product.desc} ${product.tags.join(" ")}`);
            return normalized.split(/\s+/).some(word => word.length >= 4 && text.includes(word));
        });

        if (/\b(agrega|anade|pon|quiero|dame|pedir|ordenar|comer|pedido)\b/.test(normalized) && productMatches.length) {
            pendingProduct = { product: productMatches[0], quantity: Math.max(1, Math.min(20, quantity)) };
            addMessage(`Encontré <strong>${pendingProduct.product.name}</strong> a ${money(pendingProduct.product.price)}. Te muestro las opciones antes de modificar el carrito.`);
            addAction(`Agregar ${pendingProduct.quantity} × ${pendingProduct.product.name}`, () => confirmProduct(pendingProduct.quantity));
            addAction("Ver otras coincidencias", () => addProductOptions(productMatches));
            return;
        }

        if (/\b(hamburg|pizza|carne|pollo|marisco|pasta|ensalada|bebida|postre|taco|wrap|combo)\w*/.test(normalized)) {
            const matches = products().filter(product => normalize(`${product.cat} ${product.name} ${product.tags.join(" ")}`).includes(normalized.match(/hamburg\w*|pizza\w*|carne\w*|pollo\w*|marisco\w*|pasta\w*|ensalada\w*|bebida\w*|postre\w*|taco\w*|wrap\w*|combo\w*/)?.[0] || normalized));
            addProductOptions(matches);
            return;
        }

        if (/\b(domicio|domicilio|a domicilio|entrega)\b/.test(normalized)) {
            addMessage("El pedido a domicilio requiere una cuenta de Cliente. En el carrito podrás elegir <strong>Pedido a domicilio</strong>, completar teléfono y dirección y luego pasar al pago.");
            addAction("Abrir menú", () => { window.location.href = "/GestionDeMenu1/Index"; });
            return;
        }

        if (/\b(mi pedido|estado de mi pedido|estado del pedido)\b/.test(normalized) && isAuth()) {
            const latest = read(ESFERestaurante.KEY.orders)
                .filter(order => order.customer === document.body.dataset.user)
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            if (!latest) {
                addMessage("Todavía no encuentro pedidos vinculados a tu cuenta.");
            } else {
                addMessage(`Tu pedido más reciente es <strong>${latest.id}</strong>. Estado: <strong>${latest.status}</strong>. Total: <strong>${money(latest.total)}</strong>.`);
                addAction("Ver mis pedidos", () => { window.location.href = "/GestionDePedidos1/Index"; });
            }
            return;
        }

        if (/\b(horario|abren|cierran)\b/.test(normalized)) {
            addMessage("El restaurante atiende de <strong>06:00 a. m. a 10:00 p. m.</strong>. Las reservas fuera del horario no bloquean la mesa.");
            return;
        }

        if (/\b(pago|tarjeta|efectivo|transferencia)\b/.test(normalized)) {
            addMessage("Puedes pagar en efectivo, con tarjeta simulada o mediante transferencia. La tarjeta valida formato, vencimiento, CVV y checksum. Nunca se guarda el número completo ni el CVV.");
            addAction("Ir al carrito", () => { window.location.href = "/PedidoyCarrito1/Index"; });
            return;
        }

        if (/\b(perfil|mis datos|cuenta)\b/.test(normalized)) {
            if (isAuth()) {
                addMessage("Puedes abrir tu perfil desde el icono de tu cuenta. El rol solo puede modificarlo el administrador.");
                addAction("Abrir mi perfil", () => { window.location.href = "/Perfil1/Index"; });
            } else {
                addMessage("El perfil es privado. Necesitas iniciar sesión.");
                addAction("Iniciar sesión", () => { window.location.href = "/IniciarSesion1/Index"; });
            }
            return;
        }

        if (/\b(empleado|trabajador|rol)\b/.test(normalized)) {
            addMessage(role() === "Dueno"
                ? "Desde Trabajadores puedes buscar cuentas Cliente por correo, convertirlas en trabajadores y asignar Cocina, Barra o Repartidor."
                : "Los permisos de trabajadores se administran según el rol y no pueden ser cambiados por el propio trabajador.");
            return;
        }

        originalAsk(value);
    };
})();
