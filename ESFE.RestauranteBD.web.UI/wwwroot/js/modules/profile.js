(() => {
    // Abre y cierra el bloque de edición del perfil.
    const setEditor = (open) => {
        const panel = document.getElementById("profileEditPanel");
        if (!panel) return;
        panel.classList.toggle("hidden", !open);
        panel.setAttribute("aria-hidden", open ? "false" : "true");
        if (open) {
            window.setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
            panel.querySelector("input:not([readonly]), textarea")?.focus({ preventScroll: true });
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        const openEditor = () => setEditor(true);
        document.getElementById("openProfileEditor")?.addEventListener("click", openEditor);
        document.getElementById("openProfileEditorHero")?.addEventListener("click", openEditor);
        document.getElementById("closeProfileEditor")?.addEventListener("click", () => setEditor(false));
        document.getElementById("cancelProfileEditor")?.addEventListener("click", () => setEditor(false));

        document.querySelectorAll(".profile-alert").forEach(message => {
            window.setTimeout(() => { message.hidden = true; }, 5500);
        });
    });
})();
