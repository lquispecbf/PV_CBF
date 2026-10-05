using BE;
using BE.PuntoVenta;
using BE.Seguridad;
using Microsoft.AspNetCore.Mvc;

namespace UI.Services
{
    public interface IPuntoVentaApiClient
    {
        Task<HttpResponseMessage> PostLoginAsync(BE_Usuario oUsuario);
        Task<HttpResponseMessage> PostAsync(string relativeUrl, object? body = null);
        Task<HttpResponseMessage> GetAsync(string relativeUrl);
        Task<T?> GetFromJsonAsync<T>(string relativeUrl);
        Task<TResponse?> PostJsonAsync<TRequest, TResponse>(string relativeUrl, TRequest body);
        Task<bool> RenovarTokenSesionAsync();
    }
}

