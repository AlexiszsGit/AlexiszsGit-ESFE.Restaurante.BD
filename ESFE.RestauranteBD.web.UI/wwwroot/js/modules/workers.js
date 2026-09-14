(() => {
    document.addEventListener("DOMContentLoaded", () => {
        const search = document.getElementById("workerSearch");
        const list = document.getElementById("workerList");
        const email = document.getElementById("workerEmailSearch");
        const preview = document.getElementById("workerClientPreview");

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

        email?.addEventListener("input", renderPreview);
        email?.addEventListener("change", renderPreview);
        renderPreview();
    });
})();
