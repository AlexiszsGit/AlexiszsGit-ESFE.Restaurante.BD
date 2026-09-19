(() => {
    const apiBase = '/api';
    const userKeys = new Set(['esfe_carrito','esfe_pedidos','esfe_ventas','esfe_reservas','restaurantebd_calificaciones','restaurantebd_notificaciones','esfe_reportes_guardados','esfe_report_periodo_inicio','esfe_reportes_semanales','restaurantebd_mail_draft']);
    const globalKeys = new Set(['restaurantebd_product_overrides','restaurantebd_product_deleted','restaurantebd_custom_categories']);
    const role = () => (document.body?.dataset.role || 'Publico').trim();
    const originalSet = localStorage.setItem.bind(localStorage);
    const originalRemove = localStorage.removeItem.bind(localStorage);
    let hydrating = false;
    const timers = new Map();
    const token = () => document.querySelector('meta[name="request-verification-token"]')?.content || '';
    const auth = () => document.body?.dataset.auth === 'true' || document.body?.dataset.auth === 'True';
    const keyAllowed = key => userKeys.has(key) || globalKeys.has(key);
    async function sync(key, raw) {
        if (hydrating || !auth() || !keyAllowed(key)) return;
        clearTimeout(timers.get(key));
        timers.set(key, setTimeout(async () => {
            try {
                const headers = { 'Content-Type': 'application/json' };
                const t = token(); if (t) headers['RequestVerificationToken'] = t;
                await fetch(apiBase + '/state/sync', { method:'POST', credentials:'same-origin', headers, body:JSON.stringify({ key, value: raw === null ? null : (() => { try { return JSON.parse(raw); } catch { return raw; } })() }) });
                if (key === 'esfe_pedidos' && role() !== 'Publico' && raw !== null) {
                    const parsed = (() => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } })();
                    await fetch(apiBase + '/state/operational-orders', { method:'POST', credentials:'same-origin', headers, body:JSON.stringify({ orders: parsed }) });
                }
            } catch {}
        }, 250));
    }
    localStorage.setItem = (key, value) => { originalSet(key, value); sync(key, value); };
    localStorage.removeItem = key => { originalRemove(key); sync(key, null); };

    let operationalRefreshBusy = false;
    async function refreshOperationalOrders() {
        if (operationalRefreshBusy || role() === 'Publico' || !auth()) return;
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

    async function bootstrap() {
        try {
            const response = await fetch(apiBase + '/state/bootstrap', { credentials:'same-origin', cache:'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            if (!data?.configured) return;
            hydrating = true;
            const states = data.states || {};
            const global = data.global || {};
            Object.keys(states).forEach(k => { if (keyAllowed(k) && typeof states[k] === 'string') originalSet(k, states[k]); });
            Object.keys(global).forEach(k => { if (keyAllowed(k) && typeof global[k] === 'string') originalSet(k, global[k]); });
            hydrating = false;
            await refreshOperationalOrders();
            document.dispatchEvent(new CustomEvent('esfe:database-ready'));
        } catch { hydrating = false; }
    }
    document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
    setInterval(refreshOperationalOrders, 3000);
})();
