using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using UI.Services;
using Newtonsoft.Json.Linq;
using System;
using System.Threading.Tasks;

namespace UI.Filters
{
    /// <summary>
    /// Valida que el usuario tenga permiso funcional a uno o varios módulos/acciones.
    /// 
    /// Formato: "Controller:Action"
    /// Si se especifican varios permisos, basta con que el usuario tenga concedido al menos uno.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
    public class RequierePermisoModuloAttribute : ActionFilterAttribute
    {
        private readonly string[] _permisos;

        public RequierePermisoModuloAttribute(params string[] permisos)
        {
            _permisos = permisos ?? Array.Empty<string>();
        }

        public override async Task OnActionExecutionAsync(
            ActionExecutingContext context,
            ActionExecutionDelegate next)
        {
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

            if (_permisos.Length == 0)
            {
                await next();
                return;
            }

            var apiClient = context.HttpContext.RequestServices.GetService<IPuntoVentaApiClient>();
            if (apiClient == null)
            {
                // Si no hay API client disponible, delegamos la ejecución
                await next();
                return;
            }

            bool tieneAlgunPermiso = false;
            bool sesionExpirada = false;
            bool respuestaExplicitaRecibida = false;

            foreach (var permiso in _permisos)
            {
                if (string.IsNullOrWhiteSpace(permiso))
                    continue;

                var partes = permiso.Split(':', StringSplitOptions.TrimEntries);
                if (partes.Length != 2 || string.IsNullOrWhiteSpace(partes[0]) || string.IsNullOrWhiteSpace(partes[1]))
                    continue;

                string controllerModulo = partes[0];
                string actionModulo = partes[1];

                try
                {
                    var response = await apiClient.GetAsync($"api/Auth/validar-permiso?controller={controllerModulo}&action={actionModulo}");
                    if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        sesionExpirada = true;
                        respuestaExplicitaRecibida = true;
                        break;
                    }

                    if (response.IsSuccessStatusCode)
                    {
                        var content = await response.Content.ReadAsStringAsync();
                        var json = JObject.Parse(content);
                        bool tienePermiso = json["tienePermiso"]?.Value<bool>() ?? false;
                        respuestaExplicitaRecibida = true;

                        if (tienePermiso)
                        {
                            tieneAlgunPermiso = true;
                            break;
                        }
                    }
                }
                catch
                {
                    // Ante error de red/timeout transitorio en la sub-consulta no bloqueamos falsamente aquí;
                    // la API central aplicará la validación autoritativa en tiempo real con su token JWT.
                }
            }

            if (sesionExpirada)
            {
                if (EsPeticionAjax(context))
                {
                    context.HttpContext.Response.Headers["X-Session-Expired"] = "true";
                    context.Result = new JsonResult(new { success = false, error = "SESSION_EXPIRED", mensaje = "Su sesión ha caducado. Por favor, vuelva a iniciar sesión." })
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

            // Solo bloquear si la API respondió explícitamente que el usuario no tiene permiso
            if (respuestaExplicitaRecibida && !tieneAlgunPermiso)
            {
                if (EsPeticionAjax(context))
                {
                    context.Result = new JsonResult(new { success = false, error = "FORBIDDEN", mensaje = "No tiene permisos para ejecutar esta acción." })
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
