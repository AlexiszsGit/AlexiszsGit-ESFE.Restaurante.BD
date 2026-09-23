
namespace ESFE.RestauranteBD.web.UI.Models
{
    // Datos mostrados cuando ocurre un error en la aplicación.
    public class ErrorViewModel
    {
        // Identificador de la solicitud usado para diagnosticar errores.
        public string? RequestId { get; set; }

        public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
    }
}
