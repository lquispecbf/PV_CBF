using BE;
using BE.PuntoVenta;
using BE.Seguridad;
using Newtonsoft.Json;
using System.Net.Http.Headers;
using System.Text;

namespace UI.Services
{
    public class PuntoVentaApiClient : IPuntoVentaApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<PuntoVentaApiClient> _logger;

        public PuntoVentaApiClient(
            HttpClient httpClient,
            IHttpContextAccessor httpContextAccessor,
            ILogger<PuntoVentaApiClient> logger)
        {
            _httpClient = httpClient;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        private void AdjuntarTokenAutorizacion(HttpRequestMessage request)
        {
            var session = _httpContextAccessor.HttpContext?.Session;
            if (session != null)
            {
                var token = session.GetString("SESSION_JWT_TOKEN");
                if (!string.IsNullOrWhiteSpace(token))
                {
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                }
            }
        }

        public async Task<bool> RenovarTokenSesionAsync()
        {
            var session = _httpContextAccessor.HttpContext?.Session;
            if (session == null) return false;

            var idUsuarioStr = session.GetString("SESSION_ID_USUARIO");
            var usuario = session.GetString("SESSION_USUARIO");

            if (string.IsNullOrWhiteSpace(idUsuarioStr) || !int.TryParse(idUsuarioStr, out int idUsuario) || string.IsNullOrWhiteSpace(usuario))
            {
                return false;
            }

            try
            {
                var reqDto = new RenovarTokenSesionRequestDTO
                {
                    IdUsuario = idUsuario,
                    Usuario = usuario
                };

                var request = new HttpRequestMessage(HttpMethod.Post, "api/Auth/renovar-token-sesion")
                {
                    Content = new StringContent(JsonConvert.SerializeObject(reqDto), Encoding.UTF8, "application/json")
                };

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var respDto = JsonConvert.DeserializeObject<RenovarTokenSesionResponseDTO>(content);
                    if (respDto != null && respDto.Success && !string.IsNullOrWhiteSpace(respDto.Token))
                    {
                        session.SetString("SESSION_JWT_TOKEN", respDto.Token);
                        session.SetString("SESSION_TOKEN_EXPIRATION", respDto.Expiration.ToString("o"));
                        _logger.LogInformation("Token JWT renovado exitosamente para el usuario {Usuario} (ID {IdUsuario}).", usuario, idUsuario);
                        return true;
                    }
                }
                else
                {
                    _logger.LogWarning("Respuesta no exitosa al renovar token para {Usuario}: {StatusCode}", usuario, response.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al renovar token de sesión para {Usuario}.", usuario);
            }

            return false;
        }

        private bool EsUsuarioMantenerSesion()
        {
            var session = _httpContextAccessor.HttpContext?.Session;
            if (session == null) return false;
            var mantener = session.GetString("SESSION_MANTENER_SESION");
            return mantener == "1" || string.Equals(mantener, "true", StringComparison.OrdinalIgnoreCase);
        }

        public async Task<HttpResponseMessage> PostLoginAsync(BE_Usuario oUsuario)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "api/Auth/login")
            {
                Content = new StringContent(JsonConvert.SerializeObject(oUsuario), Encoding.UTF8, "application/json")
            };

            return await _httpClient.SendAsync(request);
        }

        public async Task<HttpResponseMessage> PostAsync(string relativeUrl, object? body = null)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, relativeUrl);
            AdjuntarTokenAutorizacion(request);

            if (body != null)
            {
                var json = JsonConvert.SerializeObject(body);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");
            }

            var response = await _httpClient.SendAsync(request);

            // Si devuelve 401 Unauthorized y el usuario tiene mantener sesión activo, intentar auto-recuperar
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized && EsUsuarioMantenerSesion() && !relativeUrl.Contains("renovar-token-sesion") && !relativeUrl.Contains("login"))
            {
                _logger.LogWarning("Petición POST a {Url} retornó 401. Intentando renovación transparente de token...", relativeUrl);
                bool renovado = await RenovarTokenSesionAsync();
                if (renovado)
                {
                    var reintentarRequest = new HttpRequestMessage(HttpMethod.Post, relativeUrl);
                    AdjuntarTokenAutorizacion(reintentarRequest);
                    if (body != null)
                    {
                        var json = JsonConvert.SerializeObject(body);
                        reintentarRequest.Content = new StringContent(json, Encoding.UTF8, "application/json");
                    }
                    return await _httpClient.SendAsync(reintentarRequest);
                }
            }

            return response;
        }

        public async Task<HttpResponseMessage> GetAsync(string relativeUrl)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, relativeUrl);
            AdjuntarTokenAutorizacion(request);

            var response = await _httpClient.SendAsync(request);

            // Si devuelve 401 Unauthorized y el usuario tiene mantener sesión activo, intentar auto-recuperar
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized && EsUsuarioMantenerSesion() && !relativeUrl.Contains("renovar-token-sesion") && !relativeUrl.Contains("login"))
            {
                _logger.LogWarning("Petición GET a {Url} retornó 401. Intentando renovación transparente de token...", relativeUrl);
                bool renovado = await RenovarTokenSesionAsync();
                if (renovado)
                {
                    var reintentarRequest = new HttpRequestMessage(HttpMethod.Get, relativeUrl);
                    AdjuntarTokenAutorizacion(reintentarRequest);
                    return await _httpClient.SendAsync(reintentarRequest);
                }
            }

            return response;
        }

        public async Task<T?> GetFromJsonAsync<T>(string relativeUrl)
        {
            var response = await GetAsync(relativeUrl);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<T>(content);
        }

        public async Task<TResponse?> PostJsonAsync<TRequest, TResponse>(string relativeUrl, TRequest body)
        {
            var response = await PostAsync(relativeUrl, body);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<TResponse>(content);
        }
    }
}
