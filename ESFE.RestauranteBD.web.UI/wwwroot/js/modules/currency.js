// Maneja la moneda elegida y convierte los precios que vienen en USD.
(() => {
    const STORAGE_KEY = 'restaurantebd.currency';
    const GLOBAL_STORAGE_KEY = 'restaurantebd.currency.global';
    const RATES_KEY = 'restaurantebd.currency.rates.usd';
    const RATES_TIME_KEY = 'restaurantebd.currency.rates.time';
    const API = 'https://api.frankfurter.dev/v2';
    const CACHE_MS = 12 * 60 * 60 * 1000;

    // Lista corta para que la selección sea fácil de entender.
    const fallbackCurrencies = [
        ['USD', '$', 'US'],
        ['GTQ', 'Q', 'GT'],
        ['HNL', 'L', 'HN'],
        ['NIO', 'C$', 'NI'],
        ['CRC', '₡', 'CR'],
        ['PAB', 'B/.', 'PA'],
        ['BZD', 'BZ$', 'BZ'],
        ['MXN', 'MX$', 'MX'],
        ['EUR', '€', 'ES']
    ].map(([code, symbol, regionCode]) => ({ code, symbol, regionCode }));
    let currencies = fallbackCurrencies.slice();
    let rates = { USD: 1 };

    const read = (key, fallback = null) => {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch {
            return fallback;
        }
    };

    const write = (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
    };

    const getCode = () => {
        let global = String(localStorage.getItem(GLOBAL_STORAGE_KEY) || '').trim();
        try { if (global.startsWith('\"')) global = JSON.parse(global); } catch { }
        global = String(global || '').toUpperCase();
        return currencies.some(item => item.code === global) ? global : 'USD';
    };

    function localeFor() {
        const language = localStorage.getItem('restaurantebd.language') || document.documentElement.lang || 'es';
        const map = {
            es: 'es-SV', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
            nl: 'nl-NL', tr: 'tr-TR', ru: 'ru-RU', pl: 'pl-PL', zh: 'zh-CN', ja: 'ja-JP',
            ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN', id: 'id-ID', vi: 'vi-VN', th: 'th-TH',
            he: 'he-IL', sv: 'sv-SE'
        };
        return map[language] || 'es-SV';
    }

    function displayName(type, value, fallback) {
        try {
            if (typeof Intl.DisplayNames === 'function') {
                return new Intl.DisplayNames([localeFor()], { type }).of(value) || fallback;
            }
        } catch { }
        return fallback;
    }

    function flagFor(regionCode) {
        if (!/^[A-Z]{2}$/i.test(regionCode)) return '¤';
        return regionCode.toUpperCase().split('').map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
    }

    function describeCurrency(item) {
        if (!item) return null;
        const currencyName = displayName('currency', item.code, item.code);
        const regionName = displayName('region', item.regionCode, item.regionCode);
        return {
            ...item,
            name: currencyName,
            regionName,
            flag: flagFor(item.regionCode)
        };
    }

    function currentCurrency() {
        return currencies.find(item => item.code === getCode()) || currencies[0];
    }

    function convert(amount) {
        const numeric = Number(amount) || 0;
        const code = getCode();
        const rate = code === 'USD' ? 1 : Number(rates[code] || 0);
        return rate ? numeric * rate : numeric;
    }

    function format(amount) {
        const currency = currentCurrency();
        const converted = convert(amount);
        try {
            return new Intl.NumberFormat(localeFor(), {
                style: 'currency',
                currency: currency.code,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(converted);
        } catch {
            return `${currency.symbol}${converted.toFixed(2)}`;
        }
    }

    function refreshStaticAmounts() {
        document.querySelectorAll('[data-usd-amount]').forEach(element => {
            const amount = Number(element.dataset.usdAmount || 0);
            element.textContent = format(amount);
        });
    }

    function notify() {
        refreshStaticAmounts();
        document.dispatchEvent(new CustomEvent('restaurantebd:currency-changed', {
            detail: { code: getCode(), currency: describeCurrency(currentCurrency()), rate: rates[getCode()] || 1 }
        }));
    }

    async function loadRates(force = false) {
        if (!force) {
            const storedRates = read(RATES_KEY, null);
            const storedTime = Number(localStorage.getItem(RATES_TIME_KEY) || 0);
            if (storedRates && storedTime && Date.now() - storedTime < CACHE_MS) {
                rates = storedRates;
                notify();
                return;
            }
        }

        try {
            const response = await fetch(`${API}/rates?base=usd`, { credentials: 'omit', cache: 'no-store' });
            if (!response.ok) throw new Error('rates unavailable');
            const data = await response.json();
            const fresh = { USD: 1 };
            (Array.isArray(data) ? data : []).forEach(item => {
                const quote = String(item.quote || '').toUpperCase();
                if (quote && Number.isFinite(Number(item.rate))) fresh[quote] = Number(item.rate);
            });
            rates = fresh;
            write(RATES_KEY, rates);
            try { localStorage.setItem(RATES_TIME_KEY, String(Date.now())); } catch { }
            notify();
        } catch {
            rates = read(RATES_KEY, rates) || { USD: 1 };
            notify();
        }
    }

    function setCurrency(code) {
        const target = String(code || 'USD').toUpperCase();
        if (!currencies.some(item => item.code === target)) return false;
        try { localStorage.setItem(STORAGE_KEY, target); } catch { }
        try { localStorage.setItem(GLOBAL_STORAGE_KEY, target); } catch { }
        notify();
        if (target !== 'USD') loadRates().then(notify);
        return true;
    }

    function init() {
        if (!localStorage.getItem(STORAGE_KEY)) {
            try { localStorage.setItem(STORAGE_KEY, 'USD'); } catch { }
        }
        document.dispatchEvent(new CustomEvent('restaurantebd:currency-ready', { detail: { currencies } }));
        if (getCode() !== 'USD') loadRates();
    }

    window.RestauranteCurrency = {
        getCode,
        currentCurrency: () => describeCurrency(currentCurrency()),
        describe: describeCurrency,
        getCurrencies: () => currencies.map(describeCurrency),
        convert,
        format,
        setCurrency,
        refreshRates: () => loadRates(true)
    };

    const applyGlobalCurrency = () => {
        const global = String(localStorage.getItem(GLOBAL_STORAGE_KEY) || '').toUpperCase();
        if (currencies.some(item => item.code === global)) {
            if (global !== getCode()) {
                try { localStorage.setItem(STORAGE_KEY, global); } catch { }
                if (global !== 'USD') loadRates().then(notify); else notify();
            } else {
                notify();
            }
        }
    };
    document.addEventListener('esfe:database-ready', applyGlobalCurrency);
    document.addEventListener('restaurantebd:global-currency-changed', applyGlobalCurrency);
    document.addEventListener('DOMContentLoaded', init);
})();
