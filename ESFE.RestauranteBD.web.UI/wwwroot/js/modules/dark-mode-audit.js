// Quita superficies claras que puedan aparecer después de cargar una pantalla.
(() => {
    const savedStyles = new WeakMap();
    const SURFACE_CLASS = 'dark-auto-surface';
    const BORDER_CLASS = 'dark-auto-border';

    function isDark() {
        return document.documentElement.dataset.theme === 'dark';
    }

    function rgbFrom(value) {
        const match = String(value || '').match(/rgba?\(([^)]+)\)/i);
        if (!match) return null;
        const parts = match[1].split(',').map(x => Number.parseFloat(x.trim()));
        if (parts.length < 3 || parts.some(Number.isNaN)) return null;
        const alpha = parts.length >= 4 && !Number.isNaN(parts[3]) ? parts[3] : 1;
        return { r: parts[0], g: parts[1], b: parts[2], a: alpha };
    }

    function isLight(color) {
        if (!color || color.a <= 0.015) return false;
        return color.r >= 228 && color.g >= 228 && color.b >= 228;
    }

    function hasSemanticColor(element) {
        const classes = String(element.className || '').toLowerCase();
        return /success|danger|error|warning|info|emerald|green|red|rose|pink|amber|yellow|orange|blue|sky|cyan|indigo|gold|accent/.test(classes);
    }

    function hasBackgroundImageThatLooksWhite(style) {
        const value = String(style.backgroundImage || '').toLowerCase();
        if (!value || value === 'none') return false;
        return value.includes('#fff') || value.includes('white') || value.includes('255, 255, 255') || value.includes('255,255,255');
    }

    function remember(element) {
        if (!savedStyles.has(element)) {
            savedStyles.set(element, {
                background: element.style.background,
                backgroundColor: element.style.backgroundColor,
                backgroundImage: element.style.backgroundImage,
                borderColor: element.style.borderColor
            });
        }
    }

    function darken(element, style) {
        if (element === document.body || element === document.documentElement) return;
        if (['IMG', 'SVG', 'VIDEO', 'CANVAS', 'PICTURE', 'PATH', 'USE'].includes(element.tagName)) return;
        if (element.closest?.('[data-dark-allow-white]')) return;

        const background = rgbFrom(style.backgroundColor);
        const lightBackground = isLight(background);
        const whiteGradient = hasBackgroundImageThatLooksWhite(style);

        if (lightBackground || whiteGradient) {
            remember(element);
            element.classList.add(SURFACE_CLASS);
            element.style.setProperty('background-color', '#111923', 'important');
            element.style.setProperty('background-image', 'none', 'important');
        }

        const border = rgbFrom(style.borderTopColor);
        if (isLight(border)) {
            remember(element);
            element.classList.add(BORDER_CLASS);
            element.style.setProperty('border-color', '#2a3745', 'important');
        }

        // Un panel blanco con texto casi negro queda especialmente mal en oscuro.
        if ((lightBackground || whiteGradient) && !hasSemanticColor(element)) {
            const text = rgbFrom(style.color);
            if (text && text.r < 90 && text.g < 90 && text.b < 90) {
                element.style.setProperty('color', '#eef2f6', 'important');
            }
        }
    }

    function inspect(root = document.body) {
        if (!isDark() || !root) return;
        if (root instanceof Element) darken(root, getComputedStyle(root));
        root.querySelectorAll?.('*').forEach(element => darken(element, getComputedStyle(element)));
    }

    function restoreAll() {
        document.querySelectorAll('.dark-auto-surface, .dark-auto-border').forEach(element => {
            const original = savedStyles.get(element);
            element.classList.remove(SURFACE_CLASS, BORDER_CLASS);
            if (!original) return;
            element.style.background = original.background;
            element.style.backgroundColor = original.backgroundColor;
            element.style.backgroundImage = original.backgroundImage;
            element.style.borderColor = original.borderColor;
            savedStyles.delete(element);
        });
    }

    function apply() {
        if (!isDark()) {
            restoreAll();
            return;
        }
        inspect(document.body);
    }

    function watch() {
        if (!document.body || !window.MutationObserver) return;
        let frame = 0;
        const observer = new MutationObserver(records => {
            if (!isDark()) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                records.forEach(record => {
                    record.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) inspect(node);
                    });
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.RestauranteDarkMode = { apply, restoreAll };

    document.addEventListener('restaurantebd:theme-changed', () => {
        requestAnimationFrame(apply);
    });

    document.addEventListener('DOMContentLoaded', () => {
        apply();
        watch();
    });
})();
