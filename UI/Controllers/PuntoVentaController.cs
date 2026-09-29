using BE.PuntoVenta;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System.Text;
using UI.Filters;
using UI.Services;

namespace UI.Controllers
{
    [RequiereSesion]
    public class PuntoVentaController : Controller
    {
        private readonly IPuntoVentaApiClient _apiClient;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<PuntoVentaController> _logger;
        private readonly string? _rutaCrystal_API_PV;
        private readonly string? _rutaCrystal_PDF;

        public PuntoVentaController(
            IPuntoVentaApiClient apiClient,
            IConfiguration configuration,
            IWebHostEnvironment env,
            ILogger<PuntoVentaController> logger)
        {
            _apiClient = apiClient;
            _configuration = configuration;
            _env = env;
            _logger = logger;
            _rutaCrystal_API_PV = configuration["RutaCrystal_API_PV"];
            _rutaCrystal_PDF = configuration["RutaCrystal_PDF"];
        }

        private bool EsUsuarioMantenerSesion()
        {
            var usuarioActual = HttpContext.Session.GetString("SESSION_USUARIO")?.Trim().ToLower() ?? "";
            if (string.IsNullOrEmpty(usuarioActual)) return false;

            var usuariosHabilitados = _configuration.GetSection("PuntoVenta_UsuariosMantenerSesion").Get<List<string>>() 
                ?? new List<string>();

            return usuariosHabilitados.Any(u => u.Trim().Equals(usuarioActual, StringComparison.OrdinalIgnoreCase));
        }

        private bool EsUsuarioAutorizadoAnularEnviadoWms()
        {
            var usuarioActual = HttpContext.Session.GetString("SESSION_USUARIO")?.Trim().ToLower() ?? "";
            if (string.IsNullOrEmpty(usuarioActual)) return false;

            var usuariosHabilitados = _configuration.GetSection("PuntoVenta_UsuariosAnularEnviadoWMS").Get<List<string>>() 
                ?? new List<string>();

            return usuariosHabilitados.Any(u => u.Trim().Equals(usuarioActual, StringComparison.OrdinalIgnoreCase));
        }

        private string? ObtenerRolCondicionPagoUsuario()
        {
            var usuarioActual = HttpContext.Session.GetString("SESSION_USUARIO")?.Trim() ?? "";
            if (string.IsNullOrEmpty(usuarioActual)) return null;

            var dictPermisos = _configuration.GetSection("PuntoVenta_PermisoModificarCondicionPago")
                .Get<Dictionary<string, string>>() ?? new(StringComparer.OrdinalIgnoreCase);

            foreach (var kv in dictPermisos)
            {
                if (kv.Key.Trim().Equals(usuarioActual, StringComparison.OrdinalIgnoreCase))
                {
                    return kv.Value.Trim().ToUpperInvariant();
                }
            }

            return null;
        }

        #region Helpers Proxy a la API
        private async Task<IActionResult> ProxyGetAsync(string relativeUrl)
        {
            try
            {
                var response = await _apiClient.GetAsync(relativeUrl);
                var content = await response.Content.ReadAsStringAsync();
                var obj = JsonConvert.DeserializeObject(content);
                return StatusCode((int)response.StatusCode, obj);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en proxy GET {Url}", relativeUrl);
                return StatusCode(500, new { error = "Error al comunicar con el servicio central: " + ex.Message });
            }
        }

        private async Task<IActionResult> ProxyPostAsync(string relativeUrl, object? body = null)
        {
            try
            {
                var response = await _apiClient.PostAsync(relativeUrl, body);
                var content = await response.Content.ReadAsStringAsync();
                var obj = JsonConvert.DeserializeObject(content);
                return StatusCode((int)response.StatusCode, obj);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en proxy POST {Url}", relativeUrl);
                return StatusCode(500, new { error = "Error al comunicar con el servicio central: " + ex.Message });
            }
        }

        private async Task<IActionResult> ProxyFilePostAsync(string relativeUrl, object? body = null)
        {
            try
            {
                var response = await _apiClient.PostAsync(relativeUrl, body);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, JsonConvert.DeserializeObject(err));
                }

                var bytes = await response.Content.ReadAsByteArrayAsync();
                var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
                var fileName = response.Content.Headers.ContentDisposition?.FileNameStar 
                               ?? response.Content.Headers.ContentDisposition?.FileName 
                               ?? "archivo.xlsx";

                return File(bytes, contentType, fileName.Trim('"'));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en proxy File POST {Url}", relativeUrl);
                return StatusCode(500, new { error = "Error al exportar archivo: " + ex.Message });
            }
        }

        private async Task<IActionResult> ProxyFileGetAsync(string relativeUrl)
        {
            try
            {
                var response = await _apiClient.GetAsync(relativeUrl);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    try
                    {
                        return StatusCode((int)response.StatusCode, JsonConvert.DeserializeObject(err));
                    }
                    catch
                    {
                        return StatusCode((int)response.StatusCode, new { error = err });
                    }
                }

                var bytes = await response.Content.ReadAsByteArrayAsync();
                var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/pdf";
                var fileName = response.Content.Headers.ContentDisposition?.FileNameStar 
                               ?? response.Content.Headers.ContentDisposition?.FileName 
                               ?? "reporte.pdf";

                return File(bytes, contentType, fileName.Trim('"'));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en proxy File GET {Url}", relativeUrl);
                return StatusCode(500, new { error = "Error al generar reporte: " + ex.Message });
            }
        }
        #endregion

        [HttpGet]
        public IActionResult KeepAlive()
        {
            var idUsuario = HttpContext.Session.GetString("SESSION_ID_USUARIO");
            if (string.IsNullOrEmpty(idUsuario))
            {
                return Unauthorized();
            }

            if (EsUsuarioMantenerSesion())
            {
                HttpContext.Session.SetString("SESSION_LAST_KEEPALIVE", DateTime.UtcNow.Ticks.ToString());
                return Ok(new { success = true, keepAlive = true });
            }

            return Ok(new { success = true, keepAlive = false });
        }

        #region Vistas Razor
        public IActionResult Venta()
        {
            ViewBag.UsuarioSapCode = HttpContext.Session.GetInt32("SESSION_CODIGO_VENDEDOR_SAP") ?? 0;
            ViewBag.MantenerSesionPuntoVenta = EsUsuarioMantenerSesion();
            ViewBag.PuedeAnularEnviadoWms = EsUsuarioAutorizadoAnularEnviadoWms();
            ViewBag.PuedeModificarCondicionPago = !string.IsNullOrEmpty(ObtenerRolCondicionPagoUsuario());
            return View();
        }

        public IActionResult StockPorAlmacen()
        {
            ViewBag.MantenerSesionPuntoVenta = EsUsuarioMantenerSesion();
            return View();
        }

        public IActionResult ClienteBloqueado()
        {
            ViewBag.MantenerSesionPuntoVenta = EsUsuarioMantenerSesion();
            return View();
        }

        public IActionResult ArticuloFraccionado()
        {
            ViewBag.MantenerSesionPuntoVenta = EsUsuarioMantenerSesion();
            return View();
        }
        #endregion

        #region Operaciones Punto de Venta (Proxy a la Web API con JWT)

        [HttpPost]
        public async Task<IActionResult> Buscar_StockPorAlmacen([FromBody] StockPorAlmacenFiltroDTO filtro)
        {
            return await ProxyPostAsync("api/PuntoVenta/Buscar_StockPorAlmacen", filtro);
        }

        [HttpPost]
        public async Task<IActionResult> ExportarExcel_StockPorAlmacen([FromBody] StockPorAlmacenFiltroDTO filtro)
        {
            return await ProxyFilePostAsync("api/PuntoVenta/ExportarExcel_StockPorAlmacen", filtro);
        }

        public async Task<IActionResult> Buscar_Cliente(string criterioBusqueda)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_Cliente?criterioBusqueda={Uri.EscapeDataString(criterioBusqueda ?? "")}");
        }

        public async Task<IActionResult> Buscar_ListaPrecios(string? nombreBusqueda)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_ListaPrecios?nombreBusqueda={Uri.EscapeDataString(nombreBusqueda ?? "")}");
        }

        public async Task<IActionResult> Buscar_Vendedores()
        {
            return await ProxyGetAsync("api/PuntoVenta/Buscar_Vendedores");
        }

        public async Task<IActionResult> Buscar_Almacenes(string? nombreBusqueda)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_Almacenes?nombreBusqueda={Uri.EscapeDataString(nombreBusqueda ?? "")}");
        }

        public async Task<IActionResult> Buscar_DireccionesCliente(string codigoCliente)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_DireccionesCliente?codigoCliente={Uri.EscapeDataString(codigoCliente ?? "")}");
        }

        public async Task<IActionResult> Buscar_TiposEmbalaje()
        {
            return await ProxyGetAsync("api/PuntoVenta/Buscar_TiposEmbalaje");
        }

        public async Task<IActionResult> Buscar_LugaresEntrega()
        {
            return await ProxyGetAsync("api/PuntoVenta/Buscar_LugaresEntrega");
        }

        public async Task<IActionResult> Buscar_HorasEntrega()
        {
            return await ProxyGetAsync("api/PuntoVenta/Buscar_HorasEntrega");
        }

        public async Task<IActionResult> Buscar_ModosEnvio()
        {
            return await ProxyGetAsync("api/PuntoVenta/Buscar_ModosEnvio");
        }

        public async Task<IActionResult> Buscar_FormasPago(string? condicionPago)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_FormasPago?condicionPago={Uri.EscapeDataString(condicionPago ?? "")}");
        }

        public async Task<IActionResult> Buscar_TiposComprobante(string? nombreBusqueda)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_TiposComprobante?nombreBusqueda={Uri.EscapeDataString(nombreBusqueda ?? "")}");
        }

        public async Task<IActionResult> Buscar_NotasCreditoCliente(string codigoCliente)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_NotasCreditoCliente?codigoCliente={Uri.EscapeDataString(codigoCliente ?? "")}");
        }

        public async Task<IActionResult> Buscar_DesgloseCreditoCliente(string codigoCliente, int? docEntrySap = null)
        {
            string url = $"api/PuntoVenta/Buscar_DesgloseCreditoCliente?codigoCliente={Uri.EscapeDataString(codigoCliente ?? "")}";
            if (docEntrySap.HasValue) url += $"&docEntrySap={docEntrySap.Value}";
            return await ProxyGetAsync(url);
        }

        public async Task<IActionResult> Buscar_ArticulosPorCodigo(string codigoArticulo, int codigoListaPrecio, string codigoAlmacen)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_ArticulosPorCodigo?codigoArticulo={Uri.EscapeDataString(codigoArticulo ?? "")}&codigoListaPrecio={codigoListaPrecio}&codigoAlmacen={Uri.EscapeDataString(codigoAlmacen ?? "")}");
        }

        public async Task<IActionResult> Buscar_DetalleArticuloVenta(string codigoArticulo, int codigoListaPrecio, string codigoAlmacen, string? codigoCliente, int? codigoUmd)
        {
            string url = $"api/PuntoVenta/Buscar_DetalleArticuloVenta?codigoArticulo={Uri.EscapeDataString(codigoArticulo ?? "")}&codigoListaPrecio={codigoListaPrecio}&codigoAlmacen={Uri.EscapeDataString(codigoAlmacen ?? "")}&codigoCliente={Uri.EscapeDataString(codigoCliente ?? "")}";
            if (codigoUmd.HasValue) url += $"&codigoUmd={codigoUmd.Value}";
            return await ProxyGetAsync(url);
        }

        [HttpPost]
        public async Task<IActionResult> Buscar_DetalleArticulosVentaBatch([FromBody] ArticuloDetalleVentaBatchRequestDTO request)
        {
            return await ProxyPostAsync("api/PuntoVenta/Buscar_DetalleArticulosVentaBatch", request);
        }

        [HttpPost]
        public async Task<IActionResult> Calcular_PreciosBatch([FromBody] PreciosBatchRequestDTO request)
        {
            return await ProxyPostAsync("api/PuntoVenta/Calcular_PreciosBatch", request);
        }

        public async Task<IActionResult> Buscar_ArticulosAutocomplete(string? textoBusqueda, int codigoListaPrecio, string codigoAlmacen)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_ArticulosAutocomplete?textoBusqueda={Uri.EscapeDataString(textoBusqueda ?? "")}&codigoListaPrecio={codigoListaPrecio}&codigoAlmacen={Uri.EscapeDataString(codigoAlmacen ?? "")}");
        }

        public async Task<IActionResult> Buscar_ArticulosDescripcion(string? textoBusqueda, int codigoListaPrecio, string codigoAlmacen)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_ArticulosDescripcion?textoBusqueda={Uri.EscapeDataString(textoBusqueda ?? "")}&codigoListaPrecio={codigoListaPrecio}&codigoAlmacen={Uri.EscapeDataString(codigoAlmacen ?? "")}");
        }

        public async Task<IActionResult> Buscar_UmdArticulo(string codigoArticulo)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_UmdArticulo?codigoArticulo={Uri.EscapeDataString(codigoArticulo ?? "")}");
        }

        public async Task<IActionResult> Buscar_PromoArticulo(string codigoArticulo, string codigoCliente, int codigoListaPrecio, int codigoUmd)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_PromoArticulo?codigoArticulo={Uri.EscapeDataString(codigoArticulo ?? "")}&codigoCliente={Uri.EscapeDataString(codigoCliente ?? "")}&codigoListaPrecio={codigoListaPrecio}&codigoUmd={codigoUmd}");
        }

        public async Task<IActionResult> Buscar_LotesArticulo(string codigoArticulo, string codigoAlmacen)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_LotesArticulo?codigoArticulo={Uri.EscapeDataString(codigoArticulo ?? "")}&codigoAlmacen={Uri.EscapeDataString(codigoAlmacen ?? "")}");
        }

        [HttpPost]
        public async Task<IActionResult> Buscar_LotesArticulosBatch([FromBody] LotesBatchRequestDTO request)
        {
            return await ProxyPostAsync("api/PuntoVenta/Buscar_LotesArticulosBatch", request);
        }

        public async Task<IActionResult> Buscar_ArticulosAvanzado(
            string? textoBusqueda,
            int codigoListaPrecio,
            string codigoAlmacen,
            string? rubro = null,
            string? principioActivo = null,
            string? titularRs = null,
            int pagina = 1,
            int tamanoPagina = 50)
        {
            var sb = new StringBuilder("api/PuntoVenta/Buscar_ArticulosAvanzado?");
            sb.Append($"textoBusqueda={Uri.EscapeDataString(textoBusqueda ?? "")}");
            sb.Append($"&codigoListaPrecio={codigoListaPrecio}");
            sb.Append($"&codigoAlmacen={Uri.EscapeDataString(codigoAlmacen ?? "")}");
            if (!string.IsNullOrEmpty(rubro)) sb.Append($"&rubro={Uri.EscapeDataString(rubro)}");
            if (!string.IsNullOrEmpty(principioActivo)) sb.Append($"&principioActivo={Uri.EscapeDataString(principioActivo)}");
            if (!string.IsNullOrEmpty(titularRs)) sb.Append($"&titularRs={Uri.EscapeDataString(titularRs)}");
            sb.Append($"&pagina={pagina}&tamanoPagina={tamanoPagina}");

            return await ProxyGetAsync(sb.ToString());
        }

        [HttpGet]
        public async Task<IActionResult> Buscar_TitularesRs()
        {
            return await ProxyGetAsync("api/PuntoVenta/Buscar_TitularesRs");
        }

        [HttpPost]
        public async Task<IActionResult> Guardar_Venta([FromBody] VentaGuardarRequestDTO request)
        {
            return await ProxyPostAsync("api/PuntoVenta/Guardar_Venta", request);
        }

        [HttpPost]
        public async Task<IActionResult> ExportarExcel_Ventas([FromBody] VentaBusquedaFiltroDTO filtro)
        {
            return await ProxyFilePostAsync("api/PuntoVenta/ExportarExcel_Ventas", filtro);
        }

        [HttpPost]
        public async Task<IActionResult> Buscar_Ventas([FromBody] VentaBusquedaFiltroDTO filtro)
        {
            return await ProxyPostAsync("api/PuntoVenta/Buscar_Ventas", filtro);
        }

        [HttpPost]
        public async Task<IActionResult> Buscar_LogImportador([FromBody] CargarVentaRequestDTO data)
        {
            return await ProxyPostAsync("api/PuntoVenta/Buscar_LogImportador", data);
        }

        [HttpPost]
        public async Task<IActionResult> Cargar_Venta([FromBody] CargarVentaRequestDTO data)
        {
            return await ProxyPostAsync("api/PuntoVenta/Cargar_Venta", data);
        }

        [HttpPost]
        public async Task<IActionResult> Ver_Venta([FromBody] CargarVentaRequestDTO data)
        {
            return await ProxyPostAsync("api/PuntoVenta/Ver_Venta", data);
        }

        [HttpGet]
        public async Task<IActionResult> Obtener_ImagenArticulo(string codigoArticulo)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Obtener_ImagenArticulo?codigoArticulo={Uri.EscapeDataString(codigoArticulo ?? "")}");
        }

        [HttpGet]
        public async Task<IActionResult> Ver_ImagenArticulo(string codigoArticulo)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Ver_ImagenArticulo?codigoArticulo={Uri.EscapeDataString(codigoArticulo ?? "")}");
        }

        [HttpPost]
        public async Task<IActionResult> Anular_Venta([FromBody] CargarVentaRequestDTO data)
        {
            return await ProxyPostAsync("api/PuntoVenta/Anular_Venta", data);
        }

        [HttpPost]
        public async Task<IActionResult> Reabrir_Venta([FromBody] ReabrirVentaRequestDTO data)
        {
            return await ProxyPostAsync("api/PuntoVenta/Reabrir_Venta", data);
        }

        [HttpPost]
        public async Task<IActionResult> Trasladar_Venta([FromBody] CargarVentaRequestDTO data)
        {
            return await ProxyPostAsync("api/PuntoVenta/Trasladar_Venta", data);
        }

        [HttpPost]
        public async Task<IActionResult> EnviarWMS_Venta([FromBody] CargarVentaRequestDTO data)
        {
            return await ProxyPostAsync("api/PuntoVenta/EnviarWMS_Venta", data);
        }

        [HttpPost, HttpGet]
        public async Task<IActionResult> Imprimir_Venta(VentaReporteParamDTO dto)
        {
            string url = $"api/PuntoVenta/Imprimir_Venta?DocEntry={dto.DocEntry}&DocEntrySap={dto.DocEntrySap}&DocEntryOwtr={dto.DocEntryOwtr}&Whs={Uri.EscapeDataString(dto.Whs ?? "")}&NroSap={Uri.EscapeDataString(dto.NroSap ?? "")}";
            return await ProxyFileGetAsync(url);
        }

        [HttpPost, HttpGet]
        public async Task<IActionResult> Ticket_Venta(VentaReporteParamDTO dto)
        {
            string url = $"api/PuntoVenta/Ticket_Venta?DocEntry={dto.DocEntry}&DocEntrySap={dto.DocEntrySap}&DocEntryOwtr={dto.DocEntryOwtr}&Whs={Uri.EscapeDataString(dto.Whs ?? "")}&NroSap={Uri.EscapeDataString(dto.NroSap ?? "")}";
            return await ProxyFileGetAsync(url);
        }

        [HttpPost, HttpGet]
        public async Task<IActionResult> PreliminarSap_Venta(VentaReporteParamDTO dto)
        {
            string url = $"api/PuntoVenta/PreliminarSap_Venta?DocEntry={dto.DocEntry}&DocEntrySap={dto.DocEntrySap}&DocEntryOwtr={dto.DocEntryOwtr}&Whs={Uri.EscapeDataString(dto.Whs ?? "")}&NroSap={Uri.EscapeDataString(dto.NroSap ?? "")}";
            return await ProxyFileGetAsync(url);
        }

        [HttpPost, HttpGet]
        public async Task<IActionResult> PreliminarPv_Venta(VentaReporteParamDTO dto)
        {
            string url = $"api/PuntoVenta/PreliminarPv_Venta?DocEntry={dto.DocEntry}&DocEntrySap={dto.DocEntrySap}&DocEntryOwtr={dto.DocEntryOwtr}&Whs={Uri.EscapeDataString(dto.Whs ?? "")}&NroSap={Uri.EscapeDataString(dto.NroSap ?? "")}";
            return await ProxyFileGetAsync(url);
        }

        // ========== CLIENTES BLOQUEADOS ==========

        [HttpPost]
        public async Task<IActionResult> Buscar_ClientesBloqueados([FromBody] ClienteBloqueadoFiltroDTO filtro)
        {
            return await ProxyPostAsync("api/PuntoVenta/Buscar_ClientesBloqueados", filtro);
        }

        [HttpPost]
        public async Task<IActionResult> Obtener_ClienteBloqueado([FromBody] ClienteBloqueadoIdDTO dto)
        {
            return await ProxyPostAsync("api/PuntoVenta/Obtener_ClienteBloqueado", dto);
        }

        [HttpPost]
        public async Task<IActionResult> Insertar_ClienteBloqueado([FromBody] ClienteBloqueadoGuardarDTO dto)
        {
            return await ProxyPostAsync("api/PuntoVenta/Insertar_ClienteBloqueado", dto);
        }

        [HttpPost]
        public async Task<IActionResult> Actualizar_ClienteBloqueado([FromBody] ClienteBloqueadoGuardarDTO dto)
        {
            return await ProxyPostAsync("api/PuntoVenta/Actualizar_ClienteBloqueado", dto);
        }

        [HttpPost]
        public async Task<IActionResult> Eliminar_ClienteBloqueado([FromBody] ClienteBloqueadoIdDTO dto)
        {
            return await ProxyPostAsync("api/PuntoVenta/Eliminar_ClienteBloqueado", dto);
        }

        [HttpGet]
        public async Task<IActionResult> Validar_ClienteBloqueado(string carcode)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Validar_ClienteBloqueado?carcode={Uri.EscapeDataString(carcode ?? "")}");
        }

        [HttpGet]
        public async Task<IActionResult> Buscar_ClienteSap(string? criterioBusqueda)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_ClienteSap?criterioBusqueda={Uri.EscapeDataString(criterioBusqueda ?? "")}");
        }

        [HttpPost]
        public async Task<IActionResult> Exportar_ClientesBloqueados([FromBody] ClienteBloqueadoFiltroDTO filtro)
        {
            return await ProxyFilePostAsync("api/PuntoVenta/Exportar_ClientesBloqueados", filtro);
        }

        [HttpPost]
        public async Task<IActionResult> Importar_ClientesBloqueados([FromBody] List<ClienteBloqueadoImportarDTO> registros)
        {
            return await ProxyPostAsync("api/PuntoVenta/Importar_ClientesBloqueados", registros);
        }

        // ========== ARTICULOS FRACCIONADOS ==========

        [HttpPost]
        public async Task<IActionResult> Buscar_ArticulosFraccionados([FromBody] ArticuloFraccionadoFiltroDTO filtro)
        {
            return await ProxyPostAsync("api/PuntoVenta/Buscar_ArticulosFraccionados", filtro);
        }

        [HttpPost]
        public async Task<IActionResult> Obtener_ArticuloFraccionado([FromBody] ArticuloFraccionadoIdDTO dto)
        {
            return await ProxyPostAsync("api/PuntoVenta/Obtener_ArticuloFraccionado", dto);
        }

        [HttpPost]
        public async Task<IActionResult> Insertar_ArticuloFraccionado([FromBody] ArticuloFraccionadoGuardarDTO dto)
        {
            return await ProxyPostAsync("api/PuntoVenta/Insertar_ArticuloFraccionado", dto);
        }

        [HttpPost]
        public async Task<IActionResult> Actualizar_ArticuloFraccionado([FromBody] ArticuloFraccionadoGuardarDTO dto)
        {
            return await ProxyPostAsync("api/PuntoVenta/Actualizar_ArticuloFraccionado", dto);
        }

        [HttpPost]
        public async Task<IActionResult> Eliminar_ArticuloFraccionado([FromBody] ArticuloFraccionadoIdDTO dto)
        {
            return await ProxyPostAsync("api/PuntoVenta/Eliminar_ArticuloFraccionado", dto);
        }

        [HttpPost]
        public async Task<IActionResult> EliminarTodos_ArticulosFraccionados()
        {
            return await ProxyPostAsync("api/PuntoVenta/EliminarTodos_ArticulosFraccionados");
        }

        [HttpGet]
        public async Task<IActionResult> Validar_ArticuloFraccionado(string itemcode)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Validar_ArticuloFraccionado?itemcode={Uri.EscapeDataString(itemcode ?? "")}");
        }

        [HttpGet]
        public async Task<IActionResult> Buscar_ArticuloSap(string? criterioBusqueda)
        {
            return await ProxyGetAsync($"api/PuntoVenta/Buscar_ArticuloSap?criterioBusqueda={Uri.EscapeDataString(criterioBusqueda ?? "")}");
        }

        [HttpPost]
        public async Task<IActionResult> Exportar_ArticulosFraccionados([FromBody] ArticuloFraccionadoFiltroDTO filtro)
        {
            return await ProxyFilePostAsync("api/PuntoVenta/Exportar_ArticulosFraccionados", filtro);
        }

        [HttpPost]
        public async Task<IActionResult> Importar_ArticulosFraccionados([FromBody] List<ArticuloFraccionadoImportarDTO> registros)
        {
            return await ProxyPostAsync("api/PuntoVenta/Importar_ArticulosFraccionados", registros);
        }

        // ========== MODIFICAR CONDICIÓN DE PAGO ==========

        [HttpGet]
        public async Task<IActionResult> ObtenerDatosModificarCondicionPago(int docEntry, int docEntrySap)
        {
            return await ProxyGetAsync($"api/PuntoVenta/ObtenerDatosModificarCondicionPago?docEntry={docEntry}&docEntrySap={docEntrySap}");
        }

        [HttpPost]
        public async Task<IActionResult> ActualizarCondicionPago([FromBody] ActualizarCondicionPagoRequestDTO request)
        {
            return await ProxyPostAsync("api/PuntoVenta/ActualizarCondicionPago", request);
        }

        #endregion
    }
}
