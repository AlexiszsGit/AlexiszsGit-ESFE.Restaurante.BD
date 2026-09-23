
(() => {
    // Cambia la pestaña activa del formulario.
    const setTab = (tab) => {
        document.getElementById("loginPanel")?.classList.toggle("hidden", tab !== "login");
        document.getElementById("registerPanel")?.classList.toggle("hidden", tab !== "register");
        document.querySelectorAll("[data-login-tab]").forEach(button => {
            button.classList.toggle("active", button.dataset.loginTab === tab);
        });
    };

    // Evento que conecta una acción del usuario con la lógica del módulo.
    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-login-tab], [data-switch-tab]").forEach(button => {
            // Evento que conecta una acción del usuario con la lógica del módulo.
            button.addEventListener("click", () => setTab(button.dataset.loginTab || button.dataset.switchTab));
        });

        document.querySelectorAll("[data-toggle-password]").forEach(button => {
            // Evento que conecta una acción del usuario con la lógica del módulo.
            button.addEventListener("click", () => {
                const input = document.getElementById(button.dataset.togglePassword);
                if (!input) return;
                const visible = input.type === "password";
                input.type = visible ? "text" : "password";
                const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";
                button.setAttribute("aria-label", label);
                button.setAttribute("title", label);
                button.innerHTML = visible
                    ? '<span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6.2 6.2C3.9 7.8 2.8 10.2 2.8 12c0 0 3.3 5.5 9.2 5.5 1.2 0 2.3-.2 3.2-.6M9.4 9.4a3.6 3.6 0 0 0 5.2 5.2M17.8 17.8c2.3-1.6 3.4-4 3.4-5.8 0 0-3.3-5.5-9.2-5.5-1.1 0-2.1.2-3 .5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
                    : '<span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M2.8 12s3.3-5.5 9.2-5.5 9.2 5.5 9.2 5.5-3.3 5.5-9.2 5.5S2.8 12 2.8 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg></span>';
            });
        });

        const registerForm = document.getElementById("registerForm");
        const password = document.getElementById("registerPassword");
        const confirmation = document.getElementById("confirmPassword");

        // Actualiza las reglas visibles para la contraseña.
        const updatePasswordRules = () => {
            if (!password) return;
            const value = password.value;
            document.querySelector('[data-password-rule="length"]')?.classList.toggle("valid", value.length >= 8);
            document.querySelector('[data-password-rule="upper"]')?.classList.toggle("valid", /[A-ZÁÉÍÓÚÜÑ]/.test(value));
            document.querySelector('[data-password-rule="lower"]')?.classList.toggle("valid", /[a-záéíóúüñ]/.test(value));
            document.querySelector('[data-password-rule="number"]')?.classList.toggle("valid", /\d/.test(value));
        };

        document.querySelectorAll("[data-international-phone]").forEach(phoneInput => {
            // Evento que conecta una acción del usuario con la lógica del módulo.
            phoneInput.addEventListener("paste", () => setTimeout(() => phoneInput.dispatchEvent(new Event("input", { bubbles: true })), 0));
            // Evento que conecta una acción del usuario con la lógica del módulo.
            phoneInput.addEventListener("blur", () => phoneInput.dispatchEvent(new Event("input", { bubbles: true })));
        });

        // Evento que conecta una acción del usuario con la lógica del módulo.
        password?.addEventListener("input", updatePasswordRules);
        // Evento que conecta una acción del usuario con la lógica del módulo.
        confirmation?.addEventListener("input", () => {
            confirmation.setCustomValidity(password?.value === confirmation.value ? "" : "Las contraseñas no coinciden.");
        });

        // Evento que conecta una acción del usuario con la lógica del módulo.
        registerForm?.addEventListener("submit", event => {
            confirmation?.setCustomValidity(password?.value === confirmation?.value ? "" : "Las contraseñas no coinciden.");
            if (!registerForm.checkValidity()) {
                event.preventDefault();
                registerForm.classList.add("was-validated");
                registerForm.querySelector(":invalid")?.focus();
            }
        });

        updatePasswordRules();
    });
})();
