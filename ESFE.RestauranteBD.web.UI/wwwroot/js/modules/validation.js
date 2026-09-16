(() => {
    const countries = [
        { id: "sv", name: "El Salvador", code: "503", lengths: [8], group: [4, 4] },
        { id: "gt", name: "Guatemala", code: "502", lengths: [8], group: [4, 4] },
        { id: "hn", name: "Honduras", code: "504", lengths: [8], group: [4, 4] },
        { id: "ni", name: "Nicaragua", code: "505", lengths: [8], group: [4, 4] },
        { id: "cr", name: "Costa Rica", code: "506", lengths: [8], group: [4, 4] },
        { id: "pa", name: "Panamá", code: "507", lengths: [8], group: [4, 4] },
        { id: "mx", name: "México", code: "52", lengths: [10], group: [3, 3, 4] },
        { id: "us", name: "Estados Unidos", code: "1", lengths: [10], group: [3, 3, 4] },
        { id: "ca", name: "Canadá", code: "1", lengths: [10], group: [3, 3, 4] },
        { id: "do", name: "República Dominicana", code: "1", lengths: [10], group: [3, 3, 4] },
        { id: "pr", name: "Puerto Rico", code: "1", lengths: [10], group: [3, 3, 4] },
        { id: "es", name: "España", code: "34", lengths: [9], group: [3, 3, 3] },
        { id: "ar", name: "Argentina", code: "54", lengths: [10], group: [3, 3, 2, 2] },
        { id: "bo", name: "Bolivia", code: "591", lengths: [8], group: [4, 4] },
        { id: "br", name: "Brasil", code: "55", lengths: [10, 11], group: [2, 5, 4] },
        { id: "cl", name: "Chile", code: "56", lengths: [9], group: [3, 3, 3] },
        { id: "co", name: "Colombia", code: "57", lengths: [10], group: [3, 3, 4] },
        { id: "ec", name: "Ecuador", code: "593", lengths: [9], group: [3, 3, 3] },
        { id: "pe", name: "Perú", code: "51", lengths: [9], group: [3, 3, 3] },
        { id: "py", name: "Paraguay", code: "595", lengths: [9], group: [3, 3, 3] },
        { id: "uy", name: "Uruguay", code: "598", lengths: [8], group: [3, 4, 1] },
        { id: "ve", name: "Venezuela", code: "58", lengths: [10], group: [3, 3, 4] },
        { id: "cu", name: "Cuba", code: "53", lengths: [8], group: [4, 4] },
        { id: "gb", name: "Reino Unido", code: "44", lengths: [10, 11], group: [4, 3, 4] },
        { id: "fr", name: "Francia", code: "33", lengths: [9], group: [1, 2, 2, 2, 2] },
        { id: "de", name: "Alemania", code: "49", lengths: [10, 11], group: [3, 3, 4] },
        { id: "it", name: "Italia", code: "39", lengths: [9, 10], group: [3, 3, 4] },
        { id: "jp", name: "Japón", code: "81", lengths: [10], group: [2, 4, 4] },
        { id: "cn", name: "China", code: "86", lengths: [11], group: [3, 4, 4] },
        { id: "in", name: "India", code: "91", lengths: [10], group: [5, 5] },
        { id: "au", name: "Australia", code: "61", lengths: [9], group: [1, 4, 4] },
        { id: "nz", name: "Nueva Zelanda", code: "64", lengths: [9, 10], group: [2, 3, 4] },
        { id: "za", name: "Sudáfrica", code: "27", lengths: [9], group: [3, 3, 3] },
        { id: "kr", name: "Corea del Sur", code: "82", lengths: [9, 10], group: [2, 3, 4] }
    ];

    const normalizeDigits = value => String(value || "").replace(/\D/g, "");
    const getCountry = id => countries.find(country => country.id === id || country.code === id) || countries[0];

    const formatGrouped = (digits, group) => {
        const chunks = [];
        let cursor = 0;
        for (const length of group) {
            if (cursor >= digits.length) break;
            chunks.push(digits.slice(cursor, cursor + length));
            cursor += length;
        }
        return chunks.join(" ");
    };

    const setupCountryField = field => {
        const select = field.querySelector("[data-country-select]");
        const input = field.querySelector("[data-international-phone]");
        if (!select || !input || field.dataset.validationReady === "1") return;

        field.dataset.validationReady = "1";
        select.innerHTML = countries.map(country => `<option value="${country.id}">${country.name} (+${country.code})</option>`).join("");

        const initialDigits = normalizeDigits(input.value);
        const detectedCountry = countries
            .slice()
            .sort((a, b) => b.code.length - a.code.length)
            .find(country => initialDigits.startsWith(country.code));
        select.value = detectedCountry?.id || (getCountry(field.dataset.defaultCountry)?.id || "sv");

        const initialCountry = getCountry(select.value);
        const initial = initialDigits.startsWith(initialCountry.code)
            ? initialDigits.slice(initialCountry.code.length)
            : initialDigits;
        input.value = formatGrouped(initial, initialCountry.group);

        const update = () => {
            const country = getCountry(select.value);
            const digits = normalizeDigits(input.value).slice(0, Math.max(...country.lengths));
            input.value = formatGrouped(digits, country.group);
            input.dataset.countryCode = country.code;
            input.dataset.rawDigits = digits;
            input.setCustomValidity(country.lengths.includes(digits.length) ? "" : `Introduce ${country.lengths.join(" o ")} dígitos para ${country.name}.`);
        };

        input.addEventListener("input", update);
        select.addEventListener("change", update);
        update();

        const form = field.closest("form");
        form?.addEventListener("submit", event => {
            update();
            const country = getCountry(select.value);
            if (!country.lengths.includes(normalizeDigits(input.value).length)) {
                event.preventDefault();
                input.focus();
                return;
            }
            select.value = country.id;
        });
    };

    const setupGenericRules = root => {
        root.querySelectorAll?.("[data-letters-only]").forEach(input => {
            if (input.dataset.lettersReady === "1") return;
            input.dataset.lettersReady = "1";
            input.addEventListener("input", () => {
                input.value = input.value
                    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]/g, "")
                    .replace(/\s{2,}/g, " ");
            });
        });

        root.querySelectorAll?.("[data-dui]").forEach(input => {
            if (input.dataset.duiReady === "1") return;
            input.dataset.duiReady = "1";
            input.addEventListener("input", () => {
                const digits = normalizeDigits(input.value).slice(0, 9);
                input.value = digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits;
                input.setCustomValidity(/^\d{8}-\d$/.test(input.value) ? "" : "DUI incompleto. Usa 00000000-0.");
            });
        });

        root.querySelectorAll?.('input[type="number"]').forEach(input => {
            if (input.dataset.numericReady === "1") return;
            input.dataset.numericReady = "1";
            input.addEventListener("keydown", event => {
                if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
            });
        });

        root.querySelectorAll?.('input[type="date"]').forEach(input => {
            if (!input.min) {
                const now = new Date();
                input.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            }
        });

        root.querySelectorAll?.("[data-phone-country-field]").forEach(setupCountryField);
    };

    document.addEventListener("DOMContentLoaded", () => setupGenericRules(document));

    window.RestauranteBDValidation = { countries, normalizeDigits, setup: setupGenericRules };
})();
