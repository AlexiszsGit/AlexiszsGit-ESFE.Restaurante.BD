(() => {
    const nowSafe = () => new Date();
    const syncWalkInFields = () => {
        const table = document.getElementById("walkInTable");
        if (!table) return;
        const now = new Date();
        const date = document.getElementById("walkInDate");
        const time = document.getElementById("walkInTime");
        if (date && !date.value) {
            date.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            date.min = date.value;
        } else if (date) { date.min = date.min || date.value; }
        if (time && !time.value) time.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const reservations = JSON.parse(localStorage.getItem(ESFERestaurante.KEY.reservations) || "[]");
        const selectedDate = date?.value || ESFERestaurante.localDate(nowSafe());
        const selectedTime = time?.value || "19:00";
        const previous = table.value;
        table.innerHTML = ESFERestaurante.tables.map(item => { const busy=reservations.some(r=>r.tableId===item.id&&r.date===selectedDate&&r.time===selectedTime&&r.status==="Confirmada"); return `<option value="${item.id}" ${busy?"disabled":""}>Mesa ${String(item.id).padStart(2,"0")} · ${item.seats} personas · ${item.zone}${busy?" · OCUPADA":""}</option>`; }).join("");
        if (previous && table.querySelector(`option[value="${previous}"]:not([disabled])`)) table.value=previous;
        date?.removeEventListener("change", syncWalkInFields);
        time?.removeEventListener("change", syncWalkInFields);
        date?.addEventListener("change", syncWalkInFields);
        time?.addEventListener("change", syncWalkInFields);
    };

    const originalInit = ESFERestaurante.reservas.init.bind(ESFERestaurante.reservas);
    ESFERestaurante.reservas.init = function () {
        originalInit();
        syncWalkInFields();
    };

    ESFERestaurante.reservas.createWalkIn = function () {
        const role = document.body.dataset.role;
        if (!["Dueno", "Barra"].includes(role)) {
            ESFERestaurante.ui.mostrarToast("Solo Barra o Administrador pueden registrar reservas presenciales.", "error");
            return;
        }

        const tableId = Number(document.getElementById("walkInTable")?.value);
        const name = document.getElementById("walkInName")?.value.trim() || "";
        const people = Number(document.getElementById("walkInPeople")?.value || 0);
        const date = document.getElementById("walkInDate")?.value || "";
        const time = document.getElementById("walkInTime")?.value || "";
        const table = ESFERestaurante.tables.find(item => item.id === tableId);
        const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date);
        const timeIsValid = /^\d{2}:\d{2}$/.test(time);
        const nameIsValid = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ' -]{3,80}$/.test(name);

        if (!table || !nameIsValid || !dateIsValid || !timeIsValid || people < 1 || people > table.seats) {
            ESFERestaurante.ui.mostrarToast("Revisa mesa, nombre, fecha, hora y cantidad de personas.", "error");
            return;
        }

        const isOpen = ESFERestaurante.reservas.inOpeningHours(time);
        const reservations = JSON.parse(localStorage.getItem(ESFERestaurante.KEY.reservations) || "[]");
        const conflict = isOpen && reservations.some(reservation => reservation.tableId === table.id && reservation.date === date && reservation.time === time && reservation.status === "Confirmada");
        if (conflict) {
            ESFERestaurante.ui.mostrarToast("Esa mesa ya está ocupada para ese horario.", "error");
            return;
        }

        const reservation = {
            id: `RES-P-${Date.now().toString(36).toUpperCase()}`,
            customer: document.body.dataset.user || "presencial@restaurante.local",
            customerName: name,
            customerPhone: document.body.dataset.phone || "",
            customerDui: document.body.dataset.dui || "",
            tableId: table.id,
            table: `Mesa ${String(table.id).padStart(2, "0")}`,
            name,
            people,
            date,
            time,
            zone: table.zone,
            status: isOpen ? "Confirmada" : "Fuera de horario",
            arrived: true,
            arrivalAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            origin: "Presencial"
        };

        reservations.push(reservation);
        localStorage.setItem(ESFERestaurante.KEY.reservations, JSON.stringify(reservations));
        document.getElementById("walkInName").value = "";
        ESFERestaurante.reservas.render();
        ESFERestaurante.reservas.renderList();
        ESFERestaurante.ui.mostrarToast(isOpen ? "Reserva presencial registrada y mesa ocupada." : "Reserva registrada fuera de horario; la mesa permanece disponible.", "info");
    };

    document.addEventListener("DOMContentLoaded", () => {
        if (document.getElementById("walkInTable")) syncWalkInFields();
        const tablesMap = document.getElementById("tablesMap");
        if (tablesMap) {
            tablesMap.addEventListener("click", event => {
                const button = event.target.closest(".restaurant-table");
                if (!button || button.disabled) return;
                const id = Number(button.dataset.tableId);
                if (Number.isFinite(id)) {
                    event.preventDefault();
                    ESFERestaurante.reservas.select(id);
                }
            });
        }
    });
})();
