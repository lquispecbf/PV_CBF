using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using UI.Services;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;

namespace UI.Filters
{
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
    public class RequierePermisoVistaAttribute : ActionFilterAttribute
    {
        public override async Task OnActionExecutionAsync(
            ActionExecutingContext context,
            ActionExecutionDelegate next)
        {
            var controller = context.RouteData.Values["controller"]?.ToString();
            var action = context.RouteData.Values["action"]?.ToString();

            var idUsuarioSession = context.HttpContext.Session.GetString("SESSION_ID_USUARIO");
            if (string.IsNullOrWhiteSpace(idUsuarioSession) || !int.TryParse(idUsuarioSession, out int idUsuario))
            {
                if (EsPeticionAjax(context))
                {
                    context.Result = new JsonResult(new { success = false, error = "UNAUTHORIZED" })
                    {
                        StatusCode = StatusCodes.Status401Unauthorized
                    };
                }
                else
                {
                    context.Result = new RedirectToActionResult("Login", "Seguridad", null);
                }
                return;
            }

            var apiClient = context.HttpContext.RequestServices.GetService<IPuntoVentaApiClient>();
            if (apiClient != null)
            {
                try
                {
                    var response = await apiClient.GetAsync($"api/Auth/validar-permiso?controller={controller}&action={action}");
                    if (response.IsSuccessStatusCode)
                    {
                        var content = await response.Content.ReadAsStringAsync();
                        var json = JObject.Parse(content);
                        bool tienePermiso = json["tienePermiso"]?.Value<bool>() ?? false;

                        if (!tienePermiso)
                        {
                            if (EsPeticionAjax(context))
                            {
                                context.Result = new JsonResult(new { success = false, error = "FORBIDDEN", mensaje = "No tiene permisos para acceder a esta opción." })
                                {
                                    StatusCode = StatusCodes.Status403Forbidden
                                };
                            }
                            else
                            {
                                context.Result = new RedirectToActionResult("AccesoDenegado", "Seguridad", null);
                            }
                            return;
                        }
                    }
                    else
                    {
                        if (EsPeticionAjax(context))
                        {
                            context.Result = new JsonResult(new { success = false, error = "FORBIDDEN" })
                            {
                                StatusCode = StatusCodes.Status403Forbidden
                            };
                        }
                        else
                        {
                            context.Result = new RedirectToActionResult("AccesoDenegado", "Seguridad", null);
                        }
                        return;
                    }
                }
                catch
                {
                    if (!EsPeticionAjax(context))
                    {
                        context.Result = new RedirectToActionResult("AccesoDenegado", "Seguridad", null);
                        return;
                    }
                }
            }

            await next();
        }

        private static bool EsPeticionAjax(ActionExecutingContext context)
        {
            var req = context.HttpContext.Request;
            return req.Headers["X-Requested-With"] == "XMLHttpRequest"
                   || req.Headers["Accept"].ToString().Contains("application/json")
                   || (req.ContentType != null && req.ContentType.Contains("application/json"));
        }
    }
}
