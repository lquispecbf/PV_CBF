using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace UI.Filters
{
    public class RequiereSesionAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var controller = context.RouteData.Values["controller"]?.ToString();
            var action = context.RouteData.Values["action"]?.ToString();

            if (EsRutaPublica(controller, action))
            {
                base.OnActionExecuting(context);
                return;
            }

            var idUsuarioSession = context.HttpContext.Session.GetString("SESSION_ID_USUARIO");

            if (string.IsNullOrWhiteSpace(idUsuarioSession))
            {
                if (EsPeticionAjax(context))
                {
                    context.Result = new UnauthorizedResult(); // 401
                }
                else
                {
                    context.Result = new RedirectToActionResult(
                        "Login",
                        "Seguridad",
                        null
                    );
                }

                return;
            }

            // Validación de cambio obligatorio de clave
            var debeCambiar = context.HttpContext.Session.GetString("SESSION_DEBE_CAMBIAR");
            if (debeCambiar == "1" && !EsRutaCambioClave(controller, action))
            {
                if (EsPeticionAjax(context))
                {
                    context.Result = new UnauthorizedResult();
                }
                else
                {
                    context.Result = new RedirectToActionResult(
                        "Cambio_Clave",
                        "Seguridad",
                        null
                    );
                }
                return;
            }

            base.OnActionExecuting(context);
        }

        private static bool EsPeticionAjax(ActionExecutingContext context)
        {
            var req = context.HttpContext.Request;
            return req.Headers["X-Requested-With"] == "XMLHttpRequest"
                   || req.Headers["Accept"].ToString().Contains("application/json")
                   || (req.ContentType != null && req.ContentType.Contains("application/json"));
        }

        private static bool EsRutaPublica(string? controller, string? action)
        {
            return (controller == "Seguridad" || controller == "Login" || controller == "Home" || controller == "Error")
                   &&
                   (
                       action == "Index"
                       || action == "Login"
                       || action == "Validar_Login"
                       || action == "Logout"
                       || action == "CerrarSesion"
                       || action == "Privacy"
                       || action == "StatusCode"
                       || action == "Exception"
                   );
        }

        private static bool EsRutaCambioClave(string? controller, string? action)
        {
            return (controller == "Seguridad" || controller == "Login")
                   && (action == "Cambio_Clave" 
                       || action == "Cambiar_Clave_Segura" 
                       || action == "ObtenerSesionActual" 
                       || action == "CerrarSesion" 
                       || action == "Logout");
        }
    }
}
