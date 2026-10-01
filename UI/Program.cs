using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Localization;
using Serilog;
using System.Globalization;
using UI.Filters;
using UI.Services;

var builder = WebApplication.CreateBuilder(args);

// In-Memory Session Cache
builder.Services.AddDistributedMemoryCache();

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(60);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.Name = ".CBF.PuntoVenta.Session";
});

builder.Services.AddHttpContextAccessor();

// Configuración de Cliente HTTP para la Web API
var apiBaseUrl = builder.Configuration.GetValue<string>("ApiConfig:BaseUrl") ?? "http://localhost:5050/";
builder.Services.AddHttpClient<IPuntoVentaApiClient, PuntoVentaApiClient>(client =>
{
    client.BaseAddress = new Uri(apiBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(90);
});

// Configuración de Seguridad Antiforgery (Protección CSRF para MVC)
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = ".CBF.PuntoVenta.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

// MVC & JSON con PascalCase/propiedades exactas y validación CSRF global
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.AutoValidateAntiforgeryTokenAttribute());
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
});

// Serilog Logger
Log.Logger = new LoggerConfiguration()
   .WriteTo.File("C:\\CBF\\Log-PuntoVenta-UI-.log", rollingInterval: RollingInterval.Day)
   .CreateLogger();

// Límites de Request
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 104857600; // 100 MB
});

try
{
    var defaultCulture = new CultureInfo("es-PE");
    var localizationOptions = new RequestLocalizationOptions
    {
        DefaultRequestCulture = new RequestCulture(defaultCulture),
        SupportedCultures = new List<CultureInfo> { defaultCulture },
        SupportedUICultures = new List<CultureInfo> { defaultCulture }
    };

    CultureInfo.DefaultThreadCurrentCulture = defaultCulture;
    CultureInfo.DefaultThreadCurrentUICulture = defaultCulture;

    var app = builder.Build();

    if (!app.Environment.IsDevelopment())
    {
        app.UseExceptionHandler("/Error/Exception");
        app.UseHsts();
    }

    app.UseRequestLocalization(localizationOptions);
    app.UseHttpsRedirection();
    app.UseStaticFiles();

    // Manejo centralizado de errores HTTP: 401, 403, 404, etc.
    app.UseStatusCodePagesWithReExecute("/Error/StatusCode", "?code={0}");

    // Normalización de doble slash
    app.Use(async (context, next) =>
    {
        var path = context.Request.Path.Value;
        if (path != null && path.Contains("//"))
        {
            var newPath = System.Text.RegularExpressions.Regex.Replace(path, "/+", "/");
            context.Request.Path = newPath;
        }
        await next();
    });

    app.UseRouting();

    app.UseSession();

    app.UseAuthorization();

    // Shortcut para Principal igual que en Intranet
    app.MapControllerRoute(
        name: "principal_shortcut",
        pattern: "Principal",
        defaults: new { controller = "Seguridad", action = "Principal" });

    // Rutas directas para Punto de Venta
    app.MapControllerRoute(
        name: "puntoventa_default",
        pattern: "PuntoVenta/{action=Venta}/{id?}",
        defaults: new { controller = "PuntoVenta" });

    app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Seguridad}/{action=Login}/{id?}");

    app.Run();
}
catch (Exception ex)
{
    var errorPath = Path.Combine(AppContext.BaseDirectory, "startup_error_ui.txt");
    File.WriteAllText(errorPath, ex.ToString());
}
