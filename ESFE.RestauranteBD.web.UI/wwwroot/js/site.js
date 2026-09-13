// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// Write your JavaScript code.

// Laboratorio JavaScript: Interacción Dinámica
document.addEventListener('DOMContentLoaded', () => {
    const boton = document.getElementById('miBoton');
    const mensaje = document.getElementById('mensaje');

    if (boton && mensaje) {
        boton.addEventListener('click', () => {
            mensaje.textContent = '¡El texto ha cambiado gracias a JavaScript!';
            mensaje.style.color = '#28a745';
            mensaje.style.fontWeight = 'bold';
        });
    }
});