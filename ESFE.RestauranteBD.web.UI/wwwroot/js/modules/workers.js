
(() => {
    // Evento que conecta una acción del usuario con la lógica del módulo.
    document.addEventListener("DOMContentLoaded", () => {
        const search = document.getElementById("workerSearch");
        const list = document.getElementById("workerList");
        const email = document.getElementById("workerEmailSearch");
        const preview = document.getElementById("workerClientPreview");

        // Evento que conecta una acción del usuario con la lógica del módulo.
        search?.addEventListener("input", () => {
            const query = search.value.trim().toLowerCase();
            list?.querySelectorAll("[data-search]").forEach(card => {
                card.hidden = query.length > 0 && !card.dataset.search.toLowerCase().includes(query);
            });
        });

        const clients = [...document.querySelectorAll("#workerClientList option")].map(option => ({
            email: option.value.toLowerCase(),
            label: option.textContent || option.value
        }));

        // Actualiza la vista previa de los datos seleccionados.
        const renderPreview = () => {
            if (!preview || !email) return;
            const value = email.value.trim().toLowerCase();
            const match = clients.find(client => client.email === value);
            if (match) {
                preview.innerHTML = `<span>Cuenta localizada</span><strong>${match.label}</strong>`;
                preview.classList.add("ready");
            } else {
                preview.innerHTML = "<span>Cuenta pendiente de selección</span><strong>Escribe el correo exacto de un cliente registrado.</strong>";
                preview.classList.remove("ready");
            }
        };

        // Evento que conecta una acción del usuario con la lógica del módulo.
        email?.addEventListener("input", renderPreview);
        // Evento que conecta una acción del usuario con la lógica del módulo.
        email?.addEventListener("change", renderPreview);
        renderPreview();
    });
})();
