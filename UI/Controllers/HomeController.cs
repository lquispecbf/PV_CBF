using Microsoft.AspNetCore.Mvc;

namespace UI.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            var idUsuario = HttpContext.Session.GetString("SESSION_ID_USUARIO");
            if (string.IsNullOrWhiteSpace(idUsuario))
            {
                return RedirectToAction("Index", "Login");
            }

            return RedirectToAction("Venta", "PuntoVenta");
        }

        public IActionResult Privacy()
        {
            return View();
        }
    }
}
