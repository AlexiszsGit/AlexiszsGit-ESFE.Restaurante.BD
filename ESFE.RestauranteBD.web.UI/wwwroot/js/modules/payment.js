(() => {
    if (!window.ESFERestaurante?.payment) return;

    const base = ESFERestaurante.payment;
    const digit = value => String(value || "").replace(/\D/g, "");

    const brand = number => {
        if (/^4/.test(number)) return "VISA";
        if (/^(5[1-5]|2[2-7])/.test(number)) return "MASTERCARD";
        if (/^3[47]/.test(number)) return "AMEX";
        return "CARD";
    };

    const updateCard = () => {
        const numberInput = document.getElementById("cardNumber");
        const nameInput = document.getElementById("cardName");
        const expiryInput = document.getElementById("cardExpiry");
        const cvvInput = document.getElementById("cardCvv");
        if (!numberInput || !nameInput || !expiryInput) return;

        const digits = digit(numberInput.value).slice(0, 23);
        numberInput.value = digits.replace(/(.{4})/g, "$1 ").trim();

        const previewNumber = document.getElementById("cardPreviewNumber");
        const previewName = document.getElementById("cardPreviewName");
        const previewExpiry = document.getElementById("cardPreviewExpiry");
        const previewBrand = document.getElementById("cardBrand");
        const previewType = document.getElementById("cardPreviewType");

        if (previewNumber) {
            const groups = digits.match(/.{1,4}/g) || [];
            previewNumber.textContent = groups.length ? groups.join(" ") : "•••• •••• •••• ••••";
        }
        if (previewName) previewName.textContent = nameInput.value.trim().toUpperCase() || "NOMBRE DEL TITULAR";
        if (previewExpiry) previewExpiry.textContent = expiryInput.value || "MM/AA";
        if (previewBrand) previewBrand.textContent = brand(digits);
        if (previewType) previewType.textContent = `${digits.length} dígitos`;

        if (cvvInput) cvvInput.value = digit(cvvInput.value).slice(0, 4);
    };

    const renderFields = () => {
        const box = document.getElementById("paymentFields");
        const preview = document.getElementById("cardPreviewWrap");
        if (!box) return;

        if (preview) preview.classList.toggle("hidden", base.method !== "Tarjeta");

        if (base.method === "Efectivo") {
            box.innerHTML = `
                <div class="method-box payment-method-detail">
                    <span class="payment-method-symbol payment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M6 10h5M6 14h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>
                    <div>
                        <strong>Pago en efectivo</strong>
                        <p>El pedido queda pendiente de pago y se registra cuando el cliente lo recoja o reciba.</p>
                    </div>
                    <div class="payment-security-line"><span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span> No se solicita información bancaria.</div>
                </div>`;
            return;
        }

        if (base.method === "Transferencia") {
            box.innerHTML = `
                <div class="method-box payment-method-detail">
                    <span class="payment-method-symbol payment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M6 12h12M8 17h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 5h16v14H4z" stroke="currentColor" stroke-width="1.7"/></svg></span>
                    <div>
                        <strong>Transferencia bancaria</strong>
                        <p>Modo demostración. Introduce una referencia válida para registrar el pago.</p>
                    </div>
                    <div class="transfer-data transfer-data-pro">
                        <span>Referencia sugerida</span>
                        <strong>TRX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}</strong>
                    </div>
                    <label class="field-label payment-field-wide">
                        Referencia de transferencia
                        <input id="transferRef" type="text" maxlength="40" pattern="[A-Za-z0-9-]{5,40}" placeholder="TRX-2026-001245" required />
                    </label>
                </div>`;
            return;
        }

        box.innerHTML = `
            <div class="method-box payment-method-detail">
                <span class="payment-method-symbol payment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M7 15h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>
                <div>
                    <strong>Pago con tarjeta</strong>
                    <p>La tarjeta se visualiza en tiempo real. Es una simulación local: no se realiza ningún cargo.</p>
                </div>
                <div class="payment-security-line"><span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span> Simulación: se acepta cualquier número de tarjeta; no se realiza ningún cargo real.</div>

                <label class="field-label payment-field-wide">
                    Nombre del titular
                    <input id="cardName" type="text" data-letters-only maxlength="60" autocomplete="cc-name" placeholder="NOMBRE DEL TITULAR" required />
                </label>

                <label class="field-label payment-field-wide">
                    Número de tarjeta
                    <input id="cardNumber" type="text" maxlength="23" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" required />
                </label>

                <div class="payment-inline payment-field-wide">
                    <label class="field-label">
                        Vencimiento
                        <input id="cardExpiry" type="text" maxlength="5" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" required />
                    </label>
                    <label class="field-label">
                        CVV
                        <input id="cardCvv" type="text" maxlength="4" inputmode="numeric" autocomplete="cc-csc" placeholder="123" required />
                    </label>
                </div>
            </div>`;

        document.getElementById("cardName")?.addEventListener("input", updateCard);
        document.getElementById("cardNumber")?.addEventListener("input", updateCard);
        document.getElementById("cardExpiry")?.addEventListener("input", event => {
            let value = digit(event.target.value).slice(0, 8);
            if (value.length > 2) value = `${value.slice(0, 2)}/${value.slice(2)}`;
            event.target.value = value;
            updateCard();
        });
        document.getElementById("cardCvv")?.addEventListener("input", updateCard);
        updateCard();
    };

    const originalSelect = base.selectMethod.bind(base);
    base.selectMethod = method => {
        originalSelect(method);
        renderFields();
    };

    base.renderFields = renderFields;
    base.bindCardPreview = updateCard;

    const originalInit = base.init.bind(base);
    base.init = () => {
        originalInit();
        renderFields();
    };

    const originalComplete = base.complete.bind(base);
    base.complete = () => {
        if (base.method === "Tarjeta") {
            // La tarjeta es una simulación: solo se exige que los campos estén completos.
            // No se comprueba Luhn, vencimiento ni validez bancaria.
            const name = document.getElementById("cardName")?.value.trim() || "";
            const number = digit(document.getElementById("cardNumber")?.value || "");
            const expiry = document.getElementById("cardExpiry")?.value.trim() || "";
            const cvv = digit(document.getElementById("cardCvv")?.value || "");

            if (!name || !number || !expiry || !cvv) {
                ESFERestaurante.ui.mostrarToast("Completa los datos de la tarjeta para continuar con la simulación.", "error");
                return;
            }
        }

        originalComplete();
    };
})();
