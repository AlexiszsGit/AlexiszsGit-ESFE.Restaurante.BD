(() => {
    if (!window.ESFERestaurante?.cart) return;

    const baseInit = ESFERestaurante.cart.init.bind(ESFERestaurante.cart);
    ESFERestaurante.cart.init = () => {
        baseInit();
        window.RestauranteBDValidation?.setup(document.getElementById("deliveryFields") || document);
        ESFERestaurante.cart.toggleDeliveryFields();
    };
})();
