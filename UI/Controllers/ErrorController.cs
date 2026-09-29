using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace UI.Controllers
{
    public class ErrorController : Controller
    {
        [Route("Error/StatusCode")]
        public IActionResult StatusCode(int code)
        {
            // Verificar si el usuario tiene sesión activa y si está forzado a cambiar clave
            var idUsuario = HttpContext.Session.GetString("SESSION_ID_USUARIO");
            var debeCambiar = HttpContext.Session.GetString("SESSION_DEBE_CAMBIAR");
            bool usuarioLogueado = !string.IsNullOrWhiteSpace(idUsuario);
            bool forzadoCambio = debeCambiar == "1";

            ViewBag.Code = code;

            // Mensajes según código HTTP
            switch (code)
            {
                case 401:
                    ViewBag.Title = "Sesión no válida";
                    ViewBag.Message = "Tu sesión ha finalizado o no has iniciado sesión.";
                    break;
                case 403:
                    ViewBag.Title = "Acceso denegado";
                    ViewBag.Message = "No tienes permisos para acceder a este recurso.";
                    break;
                case 404:
                    ViewBag.Title = "Página no encontrada";
                    ViewBag.Message = "La página que intentas abrir no existe, fue movida o la dirección es incorrecta.";
                    break;
                default:
                    ViewBag.Title = "Solicitud no válida";
                    ViewBag.Message = "No pudimos procesar la solicitud realizada.";
                    break;
            }

            // Logueado y sin forzar cambio → error con menú lateral (Punto de Venta / MasterPage)
            // Sin sesión o forzado a cambiar clave → error sin menú lateral (Público)
            if (usuarioLogueado && !forzadoCambio)
            {
                return View("StatusCodeIntranet");
            }
            return View("StatusCodePublico");
        }

        [Route("Error/Exception")]
        public IActionResult Exception()
        {
            // Verificar si el usuario tiene sesión activa y si está forzado a cambiar clave
            var idUsuario = HttpContext.Session.GetString("SESSION_ID_USUARIO");
            var debeCambiar = HttpContext.Session.GetString("SESSION_DEBE_CAMBIAR");
            bool usuarioLogueado = !string.IsNullOrWhiteSpace(idUsuario);
            bool forzadoCambio = debeCambiar == "1";

            var exceptionFeature = HttpContext.Features.Get<IExceptionHandlerPathFeature>();

            // No mostrar detalle técnico al usuario final
            ViewBag.Code = 500;
            ViewBag.Title = "Error interno";
            ViewBag.Message = "Ocurrió un problema inesperado. Por favor, intenta nuevamente o comunícate con el área de sistemas.";
            ViewBag.Path = exceptionFeature?.Path;

            // Logueado y sin forzar cambio → error con menú lateral (Punto de Venta / MasterPage)
            // Sin sesión o forzado a cambiar clave → error sin menú lateral (Público)
            if (usuarioLogueado && !forzadoCambio)
            {
                return View("StatusCodeIntranet");
            }
            return View("StatusCodePublico");
        }
    }
}
