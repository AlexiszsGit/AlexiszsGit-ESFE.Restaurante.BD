
(() => {
    const apiBase = '/api';
    const userKeys = new Set(['esfe_carrito','esfe_pedidos','esfe_ventas','esfe_reservas','restaurantebd_calificaciones','restaurantebd_notificaciones','esfe_reportes_guardados','esfe_report_periodo_inicio','esfe_reportes_semanales','restaurantebd_mail_draft']);
    const globalKeys = new Set(['restaurantebd_product_overrides','restaurantebd_product_deleted','restaurantebd_custom_categories','restaurantebd_global_currency']);
    // Obtiene el rol del usuario actual.
    const role = () => (document.body?.dataset.role || 'Publico').trim();
    const originalSet = localStorage.setItem.bind(localStorage);
    const originalRemove = localStorage.removeItem.bind(localStorage);
    let hydrating = false;
    const timers = new Map();
    // Obtiene el token utilizado para la operación actual.
    const token = () => document.querySelector('meta[name="request-verification-token"]')?.content || '';
    // Comprueba si hay una sesión iniciada.
    const auth = () => document.body?.dataset.auth === 'true' || document.body?.dataset.auth === 'True';
    // Comprueba si el dato se puede guardar en SQL.
    const keyAllowed = key => userKeys.has(key) || globalKeys.has(key);
    // Sincroniza los datos entre la interfaz y la base de datos.
    async function sync(key, raw) {
        if (hydrating || !auth() || !keyAllowed(key)) return;
        clearTimeout(timers.get(key));
        timers.set(key, setTimeout(async () => {
            try {
                const headers = { 'Content-Type': 'application/json' };
                const t = token(); if (t) headers['RequestVerificationToken'] = t;
                await fetch(apiBase + '/state/sync', { method:'POST', credentials:'same-origin', headers, body:JSON.stringify({ key, value: raw === null ? null : (() => { try { return JSON.parse(raw); } catch { return raw; } })() }) });
                if (key === 'esfe_pedidos' && role() !== 'Publico' && raw !== null) {
                    // Convierte el dato guardado en una lista de pedidos.
                    const parsed = (() => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } })();
                    await fetch(apiBase + '/state/operational-orders', { method:'POST', credentials:'same-origin', headers, body:JSON.stringify({ orders: parsed }) });
                }
            } catch {}
        }, 250));
    }
    localStorage.setItem = (key, value) => { originalSet(key, value); sync(key, value); };
    localStorage.removeItem = key => { originalRemove(key); sync(key, null); };

    let operationalRefreshBusy = false;
    // Actualiza los pedidos que usan las pantallas operativas.
    async function refreshOperationalOrders() {
        const controller = String(document.body?.dataset?.pageController || '');
        const relevant = new Set(['Inicio1','GestionDePedidos1','PantallaDeCocina1','PedidoListo1','PedidoyCarrito1','ProcesarPago1']);
        if (!relevant.has(controller) || operationalRefreshBusy || role() === 'Publico' || !auth()) return;
        operationalRefreshBusy = true;
        try {
            const response = await fetch(apiBase + '/state/operational-orders', { credentials:'same-origin', cache:'no-store' });
            if (response.ok) {
                const orders = await response.json();
                if (Array.isArray(orders)) originalSet('esfe_pedidos', JSON.stringify(orders));
            }
        } catch {}
        finally { operationalRefreshBusy = false; }
    }

    // Recupera los datos guardados cuando se abre la aplicación.
    // Carga los correos internos guardados en SQL Server.
    // Comprueba que la página siga conectada a la base de datos real.
    async function refreshDatabaseHealth() {
        const status = document.getElementById('databaseStatus');
        try {
            const response = await fetch(apiBase + '/database/health', { credentials:'same-origin', cache:'no-store' });
            const data = response.ok ? await response.json() : { connected:false };
            const connected = data?.connected === true;
            document.body?.setAttribute('data-database', connected ? 'connected' : 'offline');
            if (status) {
                status.dataset.state = connected ? 'connected' : 'offline';
                const label = status.querySelector('span:last-child');
                if (label) label.textContent = connected ? 'Base conectada' : 'Base no disponible';
            }
            document.dispatchEvent(new CustomEvent('esfe:database-health', { detail:data }));
        } catch {
            document.body?.setAttribute('data-database', 'offline');
            if (status) {
                status.dataset.state = 'offline';
                const label = status.querySelector('span:last-child');
                if (label) label.textContent = 'Base no disponible';
            }
        }
    }

    async function refreshGlobalSettings() {
        if (!auth()) return;
        try {
            const response = await fetch(apiBase + '/settings/global', { credentials:'same-origin', cache:'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            const code = String(data?.currency || '').toUpperCase();
            if (!code || !/^[A-Z]{3}$/.test(code)) return;
            const previous = String(localStorage.getItem('restaurantebd.currency.global') || '').toUpperCase();
            if (previous === code) return;
            originalSet('restaurantebd.currency.global', code);
            document.dispatchEvent(new CustomEvent('restaurantebd:global-currency-changed', { detail:{ code } }));
        } catch {}
    }

    async function refreshMailInbox() {
        if (!auth() || !document.querySelector('.mail-app-shell,.notifications-page')) return;
        try {
            const response = await fetch(apiBase + '/mail/inbox', { credentials:'same-origin', cache:'no-store' });
            if (response.ok) {
                const messages = await response.json();
                window.__esfeMailMessages = Array.isArray(messages) ? messages : [];
                document.dispatchEvent(new CustomEvent('esfe:mail-ready'));
            }
        } catch {}
    }

    async function bootstrap() {
        if (!auth()) return;
        try {
            const response = await fetch(apiBase + '/state/bootstrap', { credentials:'same-origin', cache:'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            if (!data?.configured) return;
            hydrating = true;
            const states = data.states || {};
            const global = data.global || {};
            Object.keys(states).forEach(k => { if (keyAllowed(k) && typeof states[k] === 'string') originalSet(k, states[k]); });
            Object.keys(global).forEach(k => {
                if (!keyAllowed(k) || typeof global[k] !== 'string') return;
                if (k === 'restaurantebd_global_currency') {
                    let value = global[k];
                    try { value = JSON.parse(value); } catch { }
                    if (typeof value === 'string' && value.trim()) originalSet('restaurantebd.currency.global', value.toUpperCase());
                    return;
                }
                originalSet(k, global[k]);
            });
            hydrating = false;
            await Promise.all([refreshOperationalOrders(), refreshMailInbox()]);
            await refreshDatabaseHealth();
            document.dispatchEvent(new CustomEvent('esfe:database-ready'));
        } catch { hydrating = false; }
    }
    // Inicializa la sincronización solo para cuentas autenticadas.
    document.addEventListener('DOMContentLoaded', () => { if (auth()) bootstrap(); }, { once:true });
    setInterval(refreshOperationalOrders, 6000);
    setInterval(refreshMailInbox, 20000);
    setInterval(refreshDatabaseHealth, 60000);
    setInterval(refreshGlobalSettings, 60000);
})();
