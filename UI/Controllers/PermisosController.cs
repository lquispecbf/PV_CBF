using BE.Seguridad;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System;
using System.Threading.Tasks;
using UI.Filters;
using UI.Services;

namespace UI.Controllers
{
    [RequiereSesion]
    public class PermisosController : Controller
    {
        private readonly IPuntoVentaApiClient _apiClient;
        private readonly ILogger<PermisosController> _logger;

        public PermisosController(
            IPuntoVentaApiClient apiClient,
            ILogger<PermisosController> logger)
        {
            _apiClient = apiClient;
            _logger = logger;
        }

        [RequierePermisoVista]
        [HttpGet]
        public IActionResult Index()
        {
            return View("~/Views/Seguridad/Permisos.cshtml");
        }

        #region Proxy API Usuarios
        [RequierePermisoModulo("Permisos:Index", "Seguridad:Permisos")]
        [HttpGet]
        public async Task<IActionResult> ListarUsuarios(string? busqueda)
        {
            try
            {
                var url = string.IsNullOrWhiteSpace(busqueda)
                    ? "api/Permisos/usuarios"
                    : $"api/Permisos/usuarios?busqueda={Uri.EscapeDataString(busqueda)}";

                var response = await _apiClient.GetAsync(url);
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
                _logger.LogError(ex, "Error al listar usuarios en proxy Permisos");
                return StatusCode(500, new { error = "Error al comunicar con la API: " + ex.Message });
            }
        }

        [RequierePermisoModulo("Permisos:Index", "Seguridad:Permisos")]
        [HttpGet]
        public async Task<IActionResult> ListarRoles()
        {
            try
            {
                var response = await _apiClient.GetAsync("api/Permisos/roles");
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
                _logger.LogError(ex, "Error al listar roles en proxy Permisos");
                return StatusCode(500, new { error = "Error al comunicar con la API: " + ex.Message });
            }
        }

        [RequierePermisoModulo("Permisos:Index", "Seguridad:Permisos")]
        [HttpGet]
        public async Task<IActionResult> ObtenerMatriz(int idUsuario)
        {
            try
            {
                var response = await _apiClient.GetAsync($"api/Permisos/matriz/{idUsuario}");
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
                _logger.LogError(ex, "Error al obtener matriz en proxy Permisos");
                return StatusCode(500, new { error = "Error al comunicar con la API: " + ex.Message });
            }
        }

        [RequierePermisoModulo("Permisos:Index", "Seguridad:Permisos")]
        [HttpPost]
        public async Task<IActionResult> GuardarConfiguracion([FromBody] GuardarConfiguracionUsuarioRequestDTO request)
        {
            try
            {
                var response = await _apiClient.PostAsync("api/Permisos/guardar", request);
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
                _logger.LogError(ex, "Error al guardar configuración en proxy Permisos");
                return StatusCode(500, new { error = "Error al comunicar con la API: " + ex.Message });
            }
        }
        #endregion

        #region Proxy API Roles

        [RequierePermisoModulo("Permisos:Index", "Seguridad:Permisos")]
        [HttpGet]
        public async Task<IActionResult> ObtenerMatrizRol(int idRolPv)
        {
            try
            {
                var response = await _apiClient.GetAsync($"api/Permisos/roles/matriz/{idRolPv}");
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
                _logger.LogError(ex, "Error al obtener matriz de rol en proxy Permisos");
                return StatusCode(500, new { error = "Error al comunicar con la API: " + ex.Message });
            }
        }

        [RequierePermisoModulo("Permisos:Index", "Seguridad:Permisos")]
        [HttpPost]
        public async Task<IActionResult> GuardarRol([FromBody] RolGuardarRequestDTO request)
        {
            try
            {
                var response = await _apiClient.PostAsync("api/Permisos/roles/guardar", request);
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
                _logger.LogError(ex, "Error al guardar rol en proxy Permisos");
                return StatusCode(500, new { error = "Error al comunicar con la API: " + ex.Message });
            }
        }

        [RequierePermisoModulo("Permisos:Index", "Seguridad:Permisos")]
        [HttpPost]
        public async Task<IActionResult> CambiarEstadoRol([FromBody] CambiarEstadoRolRequestDTO request)
        {
            try
            {
                var response = await _apiClient.PostAsync("api/Permisos/roles/cambiar-estado", request);
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
                _logger.LogError(ex, "Error al cambiar estado de rol en proxy Permisos");
                return StatusCode(500, new { error = "Error al comunicar con la API: " + ex.Message });
            }
        }

        [RequierePermisoModulo("Permisos:Index", "Seguridad:Permisos")]
        [HttpGet]
        public async Task<IActionResult> ListarPlantillasRoles()
        {
            try
            {
                var response = await _apiClient.GetAsync("api/Permisos/roles/plantillas");
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
                _logger.LogError(ex, "Error al listar plantillas de roles en proxy Permisos");
                return StatusCode(500, new { error = "Error al comunicar con la API: " + ex.Message });
            }
        }

        #endregion
    }
}
