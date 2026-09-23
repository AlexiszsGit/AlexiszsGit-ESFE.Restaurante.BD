// Maneja la pantalla de configuración y las preferencias guardadas en el dispositivo.
(() => {
    const KEYS = {
        theme: 'restaurantebd.theme', language: 'restaurantebd.language', animations: 'restaurantebd.animations',
        shadows: 'restaurantebd.shadows', images: 'restaurantebd.images'
    };

    const EXTRA_ES = {
        'settings.subtitleShort':'Preferencias del sistema','settings.saved':'Guardado automáticamente','settings.sections':'Preferencias','settings.appearanceHelp':'Tema y comodidad visual',
        'settings.languageHelp':'Interfaz internacional','settings.currencyHelp':'Precios y formato regional','settings.behaviorHelp':'Animaciones y contenido','settings.aboutHelp':'Información de esta instalación',
        'settings.appearanceDesc':'Elige el aspecto que te resulte más cómodo.','settings.lightHelp':'Limpio y luminoso','settings.darkHelp':'Cómodo en poca luz','settings.systemHelp':'Sigue el dispositivo',
        'settings.languageDesc':'Cambia toda la navegación y las preferencias disponibles sin perder tus datos.','settings.languageNote':'La estructura está preparada para ampliar los módulos comerciales con traducciones completas por idioma.',
        'settings.currencyDesc':'Escoge cómo se muestran los precios en toda la aplicación.','settings.currencySelected':'Moneda seleccionada','settings.currencyHelpLong':'Los precios guardados en la base no cambian; solo cambia su presentación.',
        'settings.currencyHint':'Los importes de la base de datos permanecen en la moneda base. La conversión se usa para mostrar precios y totales.','settings.rateInfo':'Tipo de cambio actualizado automáticamente.',
        'settings.behaviorDesc':'Ajusta pequeños detalles de la experiencia diaria.','settings.animations':'Animaciones suaves','settings.animationsHelp':'Transiciones ligeras en la interfaz','settings.shadows':'Interfaz más sobria','settings.shadowsHelp':'Reduce sombras para una apariencia más limpia',
        'settings.images':'Mostrar imágenes del menú','settings.imagesHelp':'Mantén las fotografías visibles','settings.aboutDesc':'Datos generales de la instalación actual.','settings.restaurant':'Restaurante','settings.baseCurrency':'Moneda base','settings.opening':'Horario','settings.tax':'Impuesto','settings.reset':'Restablecer preferencias',
        'common.search':'Buscar','settings.selected':'Seleccionado','settings.available':'Disponible'
    };

    function read(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } }
    function write(key, value) { try { localStorage.setItem(key, value); } catch { } }
    function systemTheme() { return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }

    // Solo el administrador puede cambiar la moneda general del restaurante.
    function canManageCurrency() {
        const role = String(document.body?.dataset?.role || '').trim().toLowerCase();
        return role === 'dueno' || role === 'administrador';
    }

    // Guarda la moneda general para que todos los usuarios vean el mismo valor.
    async function saveGlobalCurrency(code) {
        const token = document.querySelector('meta[name="request-verification-token"]')?.content || '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['RequestVerificationToken'] = token;
        const response = await fetch('/api/state/sync', {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify({ key: 'restaurantebd_global_currency', value: String(code || 'USD').toUpperCase() })
        });
        if (!response.ok) throw new Error('currency-save-failed');
        try { localStorage.setItem('restaurantebd.currency.global', String(code || 'USD').toUpperCase()); } catch { }
        return true;
    }

    function mergeTranslations() {
        const packs = window.RestauranteI18n?.packs;
        if (packs?.es) Object.assign(packs.es, EXTRA_ES);
        return packs || {};
    }

    function applyTheme(theme) {
        const resolved = theme === 'system' ? systemTheme() : theme;
        document.documentElement.dataset.theme = resolved;
        document.documentElement.style.colorScheme = resolved;
        document.body.classList.toggle('theme-dark', resolved === 'dark');
        document.querySelectorAll('[data-theme-choice]').forEach(button => button.classList.toggle('selected', button.dataset.themeChoice === theme));
        document.dispatchEvent(new CustomEvent('restaurantebd:theme-changed', { detail: { theme: resolved } }));
    }

    function applyLanguage(language) {
        const safe = window.RestauranteI18n?.languages?.some(item => item.code === language) ? language : 'es';
        write(KEYS.language, safe);
        window.RestauranteI18n?.setLanguage?.(safe);
        document.querySelectorAll('[data-language-choice]').forEach(button => button.classList.toggle('selected', button.dataset.languageChoice === safe));
        renderLanguageCatalog();
        syncCurrencyLabels();
    }

    function applyBooleanPreference(key, className, button) {
        const enabled = read(key, 'true') === 'true';
        document.body.classList.toggle(className, !enabled);
        button?.classList.toggle('selected', enabled);
        return enabled;
    }

    function toast(message) { window.ESFERestaurante?.ui?.mostrarToast?.(message); }

    function renderLanguageCatalog(filter = '') {
        const box = document.getElementById('languageCatalog');
        const count = document.getElementById('languageCount');
        if (!box) return;
        const current = read(KEYS.language, 'es');
        const all = window.RestauranteI18n?.languages || [];
        const term = String(filter || '').trim().toLowerCase();
        const visible = all.filter(item => !term || item.name.toLowerCase().includes(term) || item.code.includes(term));
        if (count) count.textContent = (window.RestauranteI18n?.t?.('settings.languageCount', '{count} idiomas') || '{count} idiomas').replace('{count}', String(visible.length));
        box.innerHTML = visible.map(item => `<button type="button" class="settings-language-tile ${item.code === current ? 'selected' : ''}" data-language-choice="${item.code}" aria-pressed="${item.code === current}" aria-label="${item.name}"><span class="settings-language-flag" aria-hidden="true"><img src="${item.flag}" alt=""></span><span><strong>${item.name}</strong><small>${item.code === current ? (window.RestauranteI18n?.t?.('settings.selected','Seleccionado') || 'Seleccionado') : (window.RestauranteI18n?.t?.('settings.available','Disponible') || 'Disponible')}</small></span><span class="settings-choice-check" aria-hidden="true">✓</span></button>`).join('');
        box.querySelectorAll('[data-language-choice]').forEach(button => button.addEventListener('click', () => applyLanguage(button.dataset.languageChoice)));
    }

    function syncCurrencyLabels() {
        const selected = window.RestauranteCurrency?.currentCurrency?.();
        if (!selected) return;
        const label = document.getElementById('currencyCurrentLabel');
        const help = document.getElementById('currencyCurrentHelp');
        if (label) label.textContent = `${selected.name} · ${selected.regionName}`;
        const base = document.getElementById('settingsBaseCurrency');
        if (base) base.textContent = `${selected.name} · ${selected.symbol}`;
        if (help) help.textContent = window.RestauranteI18n?.t?.('settings.currencyHelpLong', 'Los precios guardados en la base no cambian; solo cambia su presentación.') || '';
        document.querySelectorAll('[data-currency-choice]').forEach(button => button.classList.toggle('selected', button.dataset.currencyChoice === selected.code));
    }

    function renderCurrencyCatalog(filter = '') {
        if (!canManageCurrency()) return;
        const box = document.getElementById('currencyCatalog');
        const count = document.getElementById('currencyCount');
        if (!box) return;
        const all = window.RestauranteCurrency?.getCurrencies?.() || [];
        const term = String(filter || '').trim().toLowerCase();
        const visible = all.filter(item => !term || item.code.toLowerCase().includes(term) || item.name.toLowerCase().includes(term) || item.regionName.toLowerCase().includes(term));
        if (count) count.textContent = (window.RestauranteI18n?.t?.('settings.currencyCount', '{count} monedas') || '{count} monedas').replace('{count}', String(visible.length));
        const current = window.RestauranteCurrency?.getCode?.() || 'USD';
        box.innerHTML = visible.map(item => `<button type="button" class="currency-tile ${item.code === current ? 'selected' : ''}" data-currency-choice="${item.code}" aria-pressed="${item.code === current}" aria-label="${item.name} · ${item.regionName}"><span class="currency-symbol" aria-hidden="true">${item.symbol}</span><span><strong>${item.name}</strong><small>${item.regionName}</small></span><span class="settings-choice-check" aria-hidden="true">✓</span></button>`).join('');
        box.querySelectorAll('[data-currency-choice]').forEach(button => button.addEventListener('click', async () => {
            const code = button.dataset.currencyChoice;
            window.RestauranteCurrency?.setCurrency(code);
            syncCurrencyLabels();
            renderCurrencyCatalog(canManageCurrency() ? (document.getElementById('currencySearch')?.value || '') : '');
            try {
                await saveGlobalCurrency(code);
                toast('Moneda general actualizada para el restaurante');
            } catch {
                toast('No se pudo guardar la moneda en la base de datos', 'error');
            }
        }));
    }

    function bindSettingsPage() {
        const page = document.querySelector('.settings-page');
        if (!page) return;
        mergeTranslations();
        window.RestauranteI18n?.translateDocument?.(document);

        applyTheme(read(KEYS.theme, 'system'));
        renderLanguageCatalog();
        if (canManageCurrency()) { renderCurrencyCatalog(); syncCurrencyLabels(); }

        const animationButton = page.querySelector('[data-setting-toggle="animations"]');
        const shadowButton = page.querySelector('[data-setting-toggle="shadows"]');
        const imagesButton = page.querySelector('[data-setting-toggle="images"]');
        const syncPreference = (button, key, className) => {
            if (!button) return;
            applyBooleanPreference(key, className, button);
            button.addEventListener('click', () => { const current = read(key, 'true') === 'true'; write(key, String(!current)); applyBooleanPreference(key, className, button); toast(current ? 'Preferencia desactivada' : 'Preferencia activada'); });
        };
        syncPreference(animationButton, KEYS.animations, 'reduce-ui-motion');
        syncPreference(shadowButton, KEYS.shadows, 'reduce-ui-shadows');
        syncPreference(imagesButton, KEYS.images, 'hide-menu-images');

        page.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => { const theme = button.dataset.themeChoice; write(KEYS.theme, theme); applyTheme(theme); }));
        page.querySelectorAll('[data-settings-scroll]').forEach(button => button.addEventListener('click', () => { document.querySelector(button.dataset.settingsScroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); page.querySelectorAll('.settings-signature-link').forEach(item => item.classList.remove('active')); button.classList.add('active'); }));

        document.getElementById('languageSearch')?.addEventListener('input', event => renderLanguageCatalog(event.target.value));
        if (canManageCurrency()) document.getElementById('currencySearch')?.addEventListener('input', event => renderCurrencyCatalog(event.target.value));

        page.querySelector('#resetSettings')?.addEventListener('click', () => {
            Object.values(KEYS).forEach(key => { try { localStorage.removeItem(key); } catch { } });
            try { localStorage.removeItem('restaurantebd.currency'); } catch { }
            applyTheme('system');
            applyLanguage('es');
            [animationButton, shadowButton, imagesButton].forEach(button => button?.classList.add('selected'));
            toast('Preferencias restablecidas');
        });
    }

    document.addEventListener('restaurantebd:currency-list-ready', () => renderCurrencyCatalog(canManageCurrency() ? (document.getElementById('currencySearch')?.value || '') : ''));
    document.addEventListener('restaurantebd:currency-changed', () => { syncCurrencyLabels(); if (canManageCurrency()) renderCurrencyCatalog(canManageCurrency() ? (document.getElementById('currencySearch')?.value || '') : ''); });
    document.addEventListener('restaurantebd:language-changed', () => { if (document.querySelector('.settings-page')) { window.RestauranteI18n?.translateDocument?.(document); renderLanguageCatalog(document.getElementById('languageSearch')?.value || ''); syncCurrencyLabels(); } });

    document.addEventListener('DOMContentLoaded', () => {
        mergeTranslations();
        const language = read(KEYS.language, 'es');
        window.RestauranteI18n?.setLanguage?.(language);
        applyTheme(read(KEYS.theme, 'system'));
        bindSettingsPage();
    });
})();
