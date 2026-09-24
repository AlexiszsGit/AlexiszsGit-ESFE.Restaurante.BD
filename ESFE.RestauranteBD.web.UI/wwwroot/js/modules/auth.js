(() => {
    // Cambia entre las pantallas de acceso, registro y recuperación.
    const hideAuthMessages = () => {
        document.querySelectorAll(".auth-page .alert-error, .auth-page .alert-success").forEach(message => {
            message.hidden = true;
        });
    };

    const setTab = (tab) => {
        document.querySelectorAll("[data-auth-panel]").forEach(panel => {
            panel.classList.toggle("hidden", panel.dataset.authPanel !== tab);
        });

        document.querySelectorAll("[data-login-tab]").forEach(button => {
            button.classList.toggle("active", button.dataset.loginTab === tab);
        });

        // Al cambiar de pantalla se limpia cualquier aviso de la etapa anterior.
        hideAuthMessages();

        const isAccountPage = tab === "login" || tab === "register";
        const securityChrome = document.querySelector("[data-auth-chrome]");
        securityChrome?.classList.toggle("hidden", isAccountPage);

        // Cambia también el diseño de la página según la etapa en la que esté el usuario.
        if (document.body) {
            document.body.dataset.authStep = tab;
            document.body.classList.remove("auth-step-login", "auth-step-register", "auth-step-verify", "auth-step-forgot", "auth-step-resetCode", "auth-step-resetPassword");
            document.body.classList.add(`auth-step-${tab}`);
        }

        // Cuando se vuelve al acceso, la dirección vuelve a la pantalla inicial.
        if (tab === "login" && document.body?.dataset.loginUrl) {
            window.history.replaceState({}, document.title, document.body.dataset.loginUrl);
            window.scrollTo({ top: 0, behavior: "auto" });
        }

        document.querySelectorAll('.code-boxes').forEach(boxes => {
            boxes.querySelectorAll('[data-code-box]').forEach(box => box.value = '');
            const hidden = boxes.parentElement?.querySelector('.code-hidden-input');
            if (hidden) hidden.value = '';
        });
    };

    // Conecta los botones y valida los formularios de acceso.
    document.addEventListener("DOMContentLoaded", () => {
        const initialMessages = document.querySelectorAll(".auth-page .alert-error, .auth-page .alert-success");
        initialMessages.forEach(message => {
            window.setTimeout(() => { message.hidden = true; }, 5500);
        });

        window.addEventListener("pageshow", event => {
            const navigationType = performance.getEntriesByType("navigation")[0]?.type;
            if (event.persisted || navigationType === "back_forward") {
                hideAuthMessages();
                setTab("login");
            }
        });

        document.querySelectorAll("[data-login-tab], [data-switch-tab]").forEach(button => {
            button.addEventListener("click", () => { hideAuthMessages(); setTab(button.dataset.loginTab || button.dataset.switchTab); });
        });

        document.querySelectorAll("[data-toggle-password]").forEach(button => {
            button.addEventListener("click", () => {
                const input = document.getElementById(button.dataset.togglePassword);
                if (!input) return;

                const visible = input.type === "password";
                input.type = visible ? "text" : "password";

                const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";
                button.setAttribute("aria-label", label);
                button.setAttribute("title", label);
                button.innerHTML = visible
                    ? '<span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.3 6 9.3 6a15.4 15.4 0 0 1-2.3 3.1M6.2 6.9C3.6 8.7 2.7 12 2.7 12s3.2 6 9.3 6a9.8 9.8 0 0 0 2.8-.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
                    : '<span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M2.7 12s3.2-6 9.3-6 9.3 6 9.3 6-3.2 6-9.3 6-9.3-6-9.3-6Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/></svg></span>';
            });
        });

        const registerForm = document.getElementById("registerForm");
        const password = document.getElementById("registerPassword");
        const confirmation = document.getElementById("confirmPassword");
        const resetForm = document.querySelector('[data-auth-panel="resetPassword"] form');
        const resetPassword = document.getElementById('resetPassword');
        const resetConfirmation = document.getElementById('confirmResetPassword');

        // Muestra en pantalla qué reglas de contraseña ya se cumplen.
        const updatePasswordRules = () => {
            if (!password) return;

            const value = password.value;
            document.querySelector('[data-password-rule="length"]')?.classList.toggle("valid", value.length >= 8);
            document.querySelector('[data-password-rule="upper"]')?.classList.toggle("valid", /[A-ZÁÉÍÓÚÜÑ]/.test(value));
            document.querySelector('[data-password-rule="lower"]')?.classList.toggle("valid", /[a-záéíóúüñ]/.test(value));
            document.querySelector('[data-password-rule="number"]')?.classList.toggle("valid", /\d/.test(value));
        };

        document.querySelectorAll("[data-international-phone]").forEach(phoneInput => {
            phoneInput.addEventListener("paste", () => setTimeout(() => phoneInput.dispatchEvent(new Event("input", { bubbles: true })), 0));
            phoneInput.addEventListener("blur", () => phoneInput.dispatchEvent(new Event("input", { bubbles: true })));
        });

        password?.addEventListener("input", updatePasswordRules);
        confirmation?.addEventListener("input", () => {
            confirmation.setCustomValidity(password?.value === confirmation.value ? "" : "Las contraseñas no coinciden.");
        });

        registerForm?.addEventListener("submit", event => {
            confirmation?.setCustomValidity(password?.value === confirmation?.value ? "" : "Las contraseñas no coinciden");

            if (!registerForm.checkValidity()) {
                event.preventDefault();
                registerForm.classList.add("was-validated");
                registerForm.querySelector(":invalid")?.focus();
            }
        });

        resetConfirmation?.addEventListener('input', () => {
            resetConfirmation.setCustomValidity(resetPassword?.value === resetConfirmation.value ? '' : 'Las contraseñas no coinciden.');
        });

        resetForm?.addEventListener('submit', event => {
            resetConfirmation?.setCustomValidity(resetPassword?.value === resetConfirmation?.value ? '' : 'Las contraseñas no coinciden.');
            if (!resetForm.checkValidity()) {
                event.preventDefault();
                resetForm.classList.add('was-validated');
                resetForm.querySelector(':invalid')?.focus();
            }
        });

        updatePasswordRules();

        // Da una respuesta clara cuando el servidor termina de revisar el código.
        const resultOverlay = document.querySelector("[data-auth-result]");
        const resultState = document.body?.dataset.codeResult;
        const resultNext = document.body?.dataset.codeResultNext || "login";
        if (resultOverlay && resultState) {
            const title = resultOverlay.querySelector("[data-auth-result-title]");
            const text = resultOverlay.querySelector("[data-auth-result-text]");

            // Durante el resultado ocultamos las pantallas para que el check nunca quede encima de otro formulario.
            document.querySelectorAll("[data-auth-panel]").forEach(panel => panel.classList.add("hidden"));
            document.querySelector(".login-tabs")?.classList.add("hidden");
            document.querySelector("[data-auth-chrome]")?.classList.add("hidden");
            document.querySelectorAll(".auth-page .alert-error, .auth-page .alert-success").forEach(message => message.hidden = true);

            resultOverlay.hidden = false;
            resultOverlay.dataset.state = resultState === "success" ? "success" : "error";
            if (title) title.textContent = resultState === "success" ? "Verificación correcta" : "Código no válido";
            if (text) text.textContent = resultState === "success"
                ? (resultNext === "resetPassword" ? "La identidad quedó confirmada. Ahora puedes crear tu nueva contraseña." : "Tu correo quedó confirmado. Ya puedes iniciar sesión.")
                : "Revisa los seis dígitos e inténtalo nuevamente.";

            const delay = resultState === "success" ? 2100 : 1900;
            window.setTimeout(() => {
                resultOverlay.hidden = true;
                resultOverlay.dataset.state = "";

                if (resultState === "success") {
                    setTab(resultNext);
                } else {
                    setTab(resultNext);
                }
            }, delay);
        }
    });

    // Maneja los códigos de seguridad como seis casillas sencillas.
    document.querySelectorAll('[data-code-entry]').forEach(entry => {
        const boxes = [...entry.querySelectorAll('[data-code-box]')];
        const hidden = entry.querySelector('.code-hidden-input');
        if (!boxes.length || !hidden) return;

        const sync = () => {
            hidden.value = boxes.map(box => box.value.replace(/\D/g, '').slice(0, 1)).join('');
            hidden.setCustomValidity(hidden.value.length === 6 ? '' : 'Completa los 6 dígitos.');
        };

        boxes.forEach((box, index) => {
            box.addEventListener('input', () => {
                box.value = box.value.replace(/\D/g, '').slice(0, 1);
                if (box.value && boxes[index + 1]) boxes[index + 1].focus();
                sync();
            });

            box.addEventListener('keydown', event => {
                if (event.key === 'Backspace' && !box.value && boxes[index - 1]) {
                    boxes[index - 1].focus();
                    boxes[index - 1].value = '';
                    sync();
                }
                if (event.key === 'ArrowLeft' && boxes[index - 1]) boxes[index - 1].focus();
                if (event.key === 'ArrowRight' && boxes[index + 1]) boxes[index + 1].focus();
            });

            box.addEventListener('paste', event => {
                const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                if (!pasted) return;
                event.preventDefault();
                pasted.split('').forEach((digit, i) => { if (boxes[i]) boxes[i].value = digit; });
                const next = boxes[Math.min(pasted.length, boxes.length - 1)];
                next?.focus();
                sync();
            });
        });

        entry.closest('form')?.addEventListener('submit', event => {
            sync();
            if (hidden.value.length !== 6) {
                event.preventDefault();
                boxes.find(box => !box.value)?.focus();
                return;
            }

            // Primero movemos las seis casillas y luego enviamos el formulario.
            // Así el usuario ve la verificación en pantalla antes de cambiar de etapa.
            if (entry.dataset.animating === 'true') return;
            event.preventDefault();
            entry.dataset.animating = 'true';
            entry.classList.add("is-checking");
            const progress = entry.querySelector('[data-code-progress]');
            if (progress) progress.hidden = false;

            const submitButton = event.submitter || entry.closest('form')?.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.dataset.originalText = submitButton.textContent || '';
                submitButton.textContent = 'Verificando…';
            }

            window.setTimeout(() => {
                const form = entry.closest('form');
                if (!form) return;
                HTMLFormElement.prototype.submit.call(form);
            }, 1550);
        });

        boxes[0].focus();
        sync();
    });

})();
