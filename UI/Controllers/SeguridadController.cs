using BE;
using BE.Seguridad;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UI.Services;

namespace UI.Controllers
{
    public class SeguridadController : Controller
    {
        private readonly IPuntoVentaApiClient _apiClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<SeguridadController> _logger;

        public SeguridadController(
            IPuntoVentaApiClient apiClient,
            IConfiguration configuration,
            ILogger<SeguridadController> logger)
        {
            _apiClient = apiClient;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpGet]
        public IActionResult Login()
        {
            var idUsuario = HttpContext.Session.GetString("SESSION_ID_USUARIO");
            if (!string.IsNullOrWhiteSpace(idUsuario))
            {
                var debeCambiar = HttpContext.Session.GetString("SESSION_DEBE_CAMBIAR");
                if (debeCambiar == "1")
                {
                    return RedirectToAction("Cambio_Clave", "Seguridad");
                }
                return RedirectToAction("Venta", "PuntoVenta");
            }

            return View("~/Views/Seguridad/Login.cshtml");
        }

        [HttpGet]
        public IActionResult Index()
        {
            return RedirectToAction("Login");
        }

        [HttpGet]
        public IActionResult Principal()
        {
            var idUsuario = HttpContext.Session.GetString("SESSION_ID_USUARIO");
            if (string.IsNullOrWhiteSpace(idUsuario))
            {
                return RedirectToAction("Login", "Seguridad");
            }

            var debeCambiar = HttpContext.Session.GetString("SESSION_DEBE_CAMBIAR");
            if (debeCambiar == "1")
            {
                return RedirectToAction("Cambio_Clave", "Seguridad");
            }
            return RedirectToAction("Venta", "PuntoVenta");
        }

        [HttpPost]
        public async Task<JsonResult> Validar_Login([FromBody] BE_Usuario oUsuario)
        {
            try
            {
                var response = await _apiClient.PostLoginAsync(oUsuario);
                var content = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    string mensajeError = $"Error de comunicación con el servicio de autenticación (HTTP {(int)response.StatusCode}).";
                    try
                    {
                        var errObj = JObject.Parse(content);
                        var msg = errObj["Mensaje"]?.Value<string>() ?? errObj["mensaje"]?.Value<string>() ?? errObj["error"]?.Value<string>();
                        if (!string.IsNullOrWhiteSpace(msg))
                        {
                            mensajeError = msg;
                        }
                    }
                    catch { }

                    _logger.LogWarning("Respuesta no exitosa en Validar_Login: {StatusCode} - {Content}", response.StatusCode, content);

                    return Json(new
                    {
                        Estado = false,
                        Mensaje = mensajeError,
                        Usuario = new List<BE_Usuario>()
                    });
                }

                var jsonResult = JObject.Parse(content);
                bool estado = jsonResult["Estado"]?.Value<bool>() ?? jsonResult["estado"]?.Value<bool>() ?? false;
                string mensaje = jsonResult["Mensaje"]?.Value<string>() ?? jsonResult["mensaje"]?.Value<string>() ?? "";

                if (!estado)
                {
                    return Json(new
                    {
                        Estado = false,
                        Mensaje = mensaje,
                        Usuario = new List<BE_Usuario>()
                    });
                }

                string token = jsonResult["Token"]?.Value<string>() ?? jsonResult["token"]?.Value<string>() ?? "";
                var usuariosArray = jsonResult["Usuario"] ?? jsonResult["usuario"];
                var listaUsuarios = usuariosArray != null ? usuariosArray.ToObject<List<BE_Usuario>>() : new List<BE_Usuario>();

                if (listaUsuarios == null || listaUsuarios.Count == 0)
                {
                    return Json(new
                    {
                        Estado = false,
                        Mensaje = "Usuario o datos no encontrados.",
                        Usuario = new List<BE_Usuario>()
                    });
                }

                var usuario = listaUsuarios[0];

                bool mantenerSesion = jsonResult["MantenerSesion"]?.Value<bool>() ?? jsonResult["mantenerSesion"]?.Value<bool>() ?? false;
                bool puedeAnularWms = jsonResult["PuedeAnularEnviadoWms"]?.Value<bool>() ?? jsonResult["puedeAnularEnviadoWms"]?.Value<bool>() ?? false;
                string rolCondicionPago = jsonResult["RolCondicionPago"]?.Value<string>() ?? jsonResult["rolCondicionPago"]?.Value<string>() ?? "";

                // Guardar en sesión
                HttpContext.Session.Clear();
                HttpContext.Session.SetString("SESSION_JWT_TOKEN", token);
                HttpContext.Session.SetString("SESSION_ID_USUARIO", usuario.ID.ToString());
                HttpContext.Session.SetString("SESSION_USUARIO", usuario.USUARIO ?? "");
                HttpContext.Session.SetString("SESSION_NOMBRES", usuario.NOMBRES ?? "");
                HttpContext.Session.SetString("SESSION_APELLIDOS", usuario.APELLIDOS ?? "");
                HttpContext.Session.SetString("SESSION_CORREO", usuario.CORREO ?? "");
                HttpContext.Session.SetString("SESSION_PERFIL", usuario.PERFIL ?? "");
                HttpContext.Session.SetString("SESSION_AREA", usuario.AREA ?? "");
                HttpContext.Session.SetString("SESSION_DEPARTAMENTO", usuario.DEPARTAMENTO ?? "");
                HttpContext.Session.SetString("SESSION_DEBE_CAMBIAR", usuario.FORZAR_CAMBIO_CLAVE ?? "0");
                HttpContext.Session.SetString("SESSION_DIAS_CLAVE", usuario.DIAS_RESTANTES_CLAVE?.ToString() ?? "999");
                HttpContext.Session.SetString("SESSION_PROXIMO_VENCER", usuario.PROXIMO_VENCER ?? "0");
                HttpContext.Session.SetString("SESSION_MANTENER_SESION", mantenerSesion ? "1" : "0");
                HttpContext.Session.SetString("SESSION_PUEDE_ANULAR_WMS", puedeAnularWms ? "1" : "0");
                HttpContext.Session.SetString("SESSION_ROL_CONDICION_PAGO", rolCondicionPago);
                HttpContext.Session.SetInt32("SESSION_CODIGO_VENDEDOR_SAP", usuario.CODIGO_VENDEDOR_SAP ?? 0);

                var permisos = jsonResult["Permisos"] ?? jsonResult["permisos"];
                if (permisos != null)
                {
                    HttpContext.Session.SetString("SESSION_PERMISOS", permisos.ToString());
                }

                return Json(new
                {
                    Estado = true,
                    Mensaje = mensaje,
                    Usuario = listaUsuarios,
                    MantenerSesion = mantenerSesion,
                    PuedeAnularEnviadoWms = puedeAnularWms,
                    RolCondicionPago = rolCondicionPago
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en Validar_Login MVC");
                var baseUrl = _configuration.GetValue<string>("ApiConfig:BaseUrl");
                return Json(new
                {
                    Estado = false,
                    Mensaje = $"No se pudo conectar con la Web API en '{baseUrl}'. Asegúrese de que el proyecto API esté iniciado en el puerto 5050.",
                    Usuario = new List<BE_Usuario>()
                });
            }
        }

        [HttpGet]
        public IActionResult CerrarSesion()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Login", "Seguridad");
        }

        [HttpGet]
        public IActionResult Logout()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Login", "Seguridad");
        }

        [HttpGet]
        public IActionResult Cambio_Clave()
        {
            var idUsuario = HttpContext.Session.GetString("SESSION_ID_USUARIO");
            if (string.IsNullOrWhiteSpace(idUsuario))
            {
                return RedirectToAction("Login", "Seguridad");
            }
            return View("~/Views/Seguridad/Cambio_Clave.cshtml");
        }

        [HttpPost]
        public async Task<IActionResult> Cambiar_Clave_Segura([FromBody] BE_CambioClave oUsuario)
        {
            try
            {
                var response = await _apiClient.PostAsync("api/Auth/cambiar-clave", oUsuario);
                var content = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    HttpContext.Session.Clear();
                }

                return new ContentResult
                {
                    Content = content,
                    ContentType = "application/json; charset=utf-8",
                    StatusCode = (int)response.StatusCode
                };
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { resultado = 0, mensaje = $"Error al comunicar con la API: {ex.Message}" });
            }
        }

        [HttpGet]
        public JsonResult ObtenerSesionActual()
        {
            var idUsuario = HttpContext.Session.GetString("SESSION_ID_USUARIO");

            if (string.IsNullOrWhiteSpace(idUsuario))
            {
                return Json(new { autenticado = false });
            }

            return Json(new
            {
                autenticado = true,
                SESSION_ID_USUARIO = idUsuario,
                SESSION_USUARIO = HttpContext.Session.GetString("SESSION_USUARIO") ?? "",
                SESSION_NOMBRES = HttpContext.Session.GetString("SESSION_NOMBRES") ?? "",
                SESSION_APELLIDOS = HttpContext.Session.GetString("SESSION_APELLIDOS") ?? "",
                SESSION_CORREO = HttpContext.Session.GetString("SESSION_CORREO") ?? "",
                SESSION_PERFIL = HttpContext.Session.GetString("SESSION_PERFIL") ?? "",
                SESSION_AREA = HttpContext.Session.GetString("SESSION_AREA") ?? "",
                SESSION_DEPARTAMENTO = HttpContext.Session.GetString("SESSION_DEPARTAMENTO") ?? "",
                SESSION_TELEFONO = HttpContext.Session.GetString("SESSION_TELEFONO") ?? "",
                SESSION_CARGO = HttpContext.Session.GetString("SESSION_CARGO") ?? "",
                SESSION_DEBE_CAMBIAR = HttpContext.Session.GetString("SESSION_DEBE_CAMBIAR") ?? "0",
                SESSION_DIAS_CLAVE = HttpContext.Session.GetString("SESSION_DIAS_CLAVE") ?? "999",
                SESSION_PROXIMO_VENCER = HttpContext.Session.GetString("SESSION_PROXIMO_VENCER") ?? "0",
                SESSION_MANTENER_SESION = HttpContext.Session.GetString("SESSION_MANTENER_SESION") ?? "0",
                SESSION_CODIGO_VENDEDOR_SAP = HttpContext.Session.GetInt32("SESSION_CODIGO_VENDEDOR_SAP") ?? 0
            });
        }

        [HttpPost]
        public async Task<IActionResult> Mostrar_Menu([FromBody] BE_Usuario? obj)
        {
            try
            {
                obj ??= new BE_Usuario();
                var idUsuarioSession = HttpContext.Session.GetString("SESSION_ID_USUARIO");
                if (int.TryParse(idUsuarioSession, out int idUsuario))
                {
                    obj.ID = idUsuario;
                }

                var response = await _apiClient.PostAsync("api/Auth/mostrar-menu", obj);
                var content = await response.Content.ReadAsStringAsync();
                return new ContentResult
                {
                    Content = content,
                    ContentType = "application/json; charset=utf-8",
                    StatusCode = (int)response.StatusCode
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en Mostrar_Menu MVC");
                return new ContentResult
                {
                    Content = "[]",
                    ContentType = "application/json; charset=utf-8",
                    StatusCode = 200
                };
            }
        }
    }
}
