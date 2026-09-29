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

            return await _httpClient.SendAsync(request);
        }

        public async Task<HttpResponseMessage> GetAsync(string relativeUrl)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, relativeUrl);
            AdjuntarTokenAutorizacion(request);

            return await _httpClient.SendAsync(request);
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
