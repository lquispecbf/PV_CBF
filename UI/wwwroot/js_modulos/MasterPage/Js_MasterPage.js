// Interceptor global para SweetAlert2 y SweetAlert para evitar advertencia WAI-ARIA (aria-hidden en elemento con foco)
(function () {
    function interceptSwal() {
        if (window.Swal && typeof window.Swal.fire === "function" && !window.Swal._ariaSafeWrapped) {
            const _origFire = window.Swal.fire;
            window.Swal.fire = function () {
                if (document.activeElement && typeof document.activeElement.blur === "function") {
                    try { document.activeElement.blur(); } catch (e) { }
                }
                return _origFire.apply(this, arguments);
            };
            window.Swal._ariaSafeWrapped = true;
        }
        if (window.swal && typeof window.swal === "function" && !window.swal._ariaSafeWrapped) {
            const _origSwal = window.swal;
            window.swal = function () {
                if (document.activeElement && typeof document.activeElement.blur === "function") {
                    try { document.activeElement.blur(); } catch (e) { }
                }
                return _origSwal.apply(this, arguments);
            };
            window.swal._ariaSafeWrapped = true;
        }
    }
    interceptSwal();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", interceptSwal);
    }
})();

// Interceptor global inmutable para adjuntar Token CSRF (Antiforgery) en TODAS las peticiones AJAX POST/PUT/DELETE
if (window.jQuery) {
    $(document).ajaxSend(function (event, jqXHR, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !settings.crossDomain) {
            var token = $('meta[name="csrf-token"]').attr('content') || $('input[name="__RequestVerificationToken"]').val();
            if (token) {
                jqXHR.setRequestHeader('X-CSRF-TOKEN', token);
            }
        }
    });
}

$(document).ready(function () {

    // Mover modales a la raíz del body para evitar conflicto WAI-ARIA (aria-hidden en #wrapper)
    $('.modal').appendTo('body');
    $(document).on('show.bs.modal', '.modal', function () {
        if (!$(this).parent().is('body')) {
            $(this).appendTo('body');
        }
        if (document.activeElement && typeof document.activeElement.blur === "function") {
            try { document.activeElement.blur(); } catch (e) { }
        }
        $(this).removeAttr('aria-hidden').attr('aria-modal', 'true');
    });
    $(document).on('shown.bs.modal', '.modal', function () {
        $(this).removeAttr('aria-hidden').attr('aria-modal', 'true');
    });
    $(document).on('hide.bs.modal', '.modal', function () {
        if (document.activeElement && typeof document.activeElement.blur === "function") {
            try { document.activeElement.blur(); } catch (e) { }
        }
    });
    $(document).on('hidden.bs.modal', '.modal', function () {
        $(this).attr('aria-hidden', 'true').removeAttr('aria-modal');
        $('#wrapper').removeAttr('aria-hidden');
    });

    const SESSION_EVENT_KEY = "CBF_PV_SESSION_EVENT";
    const SESSION_TAB_ID_KEY = "CBF_PV_SESSION_TAB_ID";
    const SESSION_ACTIVE_USER_KEY = "CBF_PV_SESSION_ACTIVE_USER";

    let tabId = sessionStorage.getItem(SESSION_TAB_ID_KEY);
    if (!tabId) {
        tabId = Date.now().toString() + "_" + Math.random().toString(36).substring(2);
        sessionStorage.setItem(SESSION_TAB_ID_KEY, tabId);
    }

    /* AVISO DE VENCIMIENTO DE CONTRASEÑA */
    function verificarProximoVencer() {
        if (sessionStorage.getItem('AVISO_CLAVE_MOSTRADO') === '1') return;

        var proximoVencer = sessionStorage.getItem('SESSION_PROXIMO_VENCER') || $.session.get('SESSION_PROXIMO_VENCER');
        var dias = sessionStorage.getItem('SESSION_DIAS_CLAVE') || $.session.get('SESSION_DIAS_CLAVE');

        if (proximoVencer === "1" && dias) {
            mostrarToastVencimiento(dias);
        } else {
            $.ajax({
                type: "GET",
                url: "/Seguridad/ObtenerSesionActual",
                dataType: "json",
                async: true,
                success: function (sesion) {
                    if (sesion && sesion.SESSION_PROXIMO_VENCER === "1") {
                        mostrarToastVencimiento(sesion.SESSION_DIAS_CLAVE);
                    }
                }
            });
        }
    }

    function mostrarToastVencimiento(dias) {
        var msg = 'Tu contraseña vencerá en ' + dias + ' día(s). Se recomienda cambiarla.';
        if (typeof iziToast !== 'undefined') {
            iziToast.show({
                title: 'Seguridad',
                message: msg,
                position: 'bottomRight',
                timeout: 10000,
                progressBar: true,
                closeOnClick: true,
                transitionIn: 'bounceInLeft',
                backgroundColor: 'rgba(26, 179, 148, 0.95)',
                messageColor: '#fff',
                titleColor: '#fff',
                icon: 'fa fa-exclamation-triangle',
                iconColor: '#f0ad4e',
                buttons: [
                    ['<button style="background:transparent;border:none;color:#fff;font-weight:bold;cursor:pointer;padding:0 5px;">Cambiar Ahora</button>', function (instance, toast) {
                        instance.hide({}, toast);
                        window.location.href = '/Seguridad/Cambio_Clave';
                    }],
                    ['<button style="background:transparent;border:none;color:#fff;font-size:14px;cursor:pointer;padding:0 5px;">✕</button>', function (instance, toast) {
                        instance.hide({}, toast);
                    }]
                ]
            });
        } else if (typeof toastr !== 'undefined') {
            toastr.options = {
                closeButton: true,
                progressBar: true,
                positionClass: "toast-bottom-right",
                timeOut: "10000",
                onclick: function () { window.location.href = '/Seguridad/Cambio_Clave'; }
            };
            toastr.warning(msg + ' (Clic para cambiar)', 'Aviso de Seguridad');
        } else if (typeof swal === 'function') {
            swal({
                title: "Aviso de Seguridad",
                text: msg,
                type: "warning",
                confirmButtonColor: "#1ab394",
                confirmButtonText: "Cambiar Contraseña",
                showCancelButton: true,
                cancelButtonText: "Recordar más tarde"
            }).then(function (result) {
                if (result.value || result === true) {
                    window.location.href = '/Seguridad/Cambio_Clave';
                }
            });
        }
        sessionStorage.setItem('AVISO_CLAVE_MOSTRADO', '1');
    }

    /* MANEJO GLOBAL DE ERRORES AJAX */
    $(document).ajaxError(function (event, xhr, settings) {
        $('body').removeClass('loading');

        var isSessionExpired = xhr.status === 401 ||
                               (xhr.getResponseHeader && xhr.getResponseHeader('X-Session-Expired') === 'true');

        if (isSessionExpired) {
            notificarSesionExpiradaYRedirigir();
            return;
        }

        if (xhr.status === 403) {
            var msg = "No cuenta con permisos para realizar esta acción.";
            if (xhr.responseJSON && xhr.responseJSON.error) {
                msg = xhr.responseJSON.error;
            }
            if (msg.indexOf("Acceso Denegado:") === 0) {
                msg = msg.substring("Acceso Denegado:".length).trim();
            }
            if (typeof swal === 'function') {
                swal({
                    title: "Acceso Denegado",
                    text: msg,
                    type: "warning",
                    confirmButtonColor: "#1ab394",
                    confirmButtonText: "Aceptar"
                });
            } else if (window.Swal && typeof window.Swal.fire === 'function') {
                window.Swal.fire({
                    title: "Acceso Denegado",
                    text: msg,
                    type: "warning",
                    icon: "warning",
                    confirmButtonColor: "#1ab394",
                    confirmButtonText: "Aceptar"
                });
            } else {
                alert("Acceso Denegado: " + msg);
            }
            return;
        }

        if (xhr.status === 0) {
            if (typeof toastr !== 'undefined') {
                toastr.error('No se pudo conectar con el servidor. Verifique su red.', 'Sin conexión');
            }
            return;
        }
    });

    $(document).ajaxComplete(function () {
        $('body').removeClass('loading');
    });

    /* INICIALIZACIÓN DE MASTERPAGE */
    inicializarMasterPage();

    function debeCambiarClaveActivo() {
        return window.DEBE_CAMBIAR_CLAVE === true ||
               $.session.get('SESSION_DEBE_CAMBIAR') === '1' ||
               sessionStorage.getItem('DEBE_CAMBIAR') === '1';
    }

    function inicializarMasterPage() {
        if (typeof $.session.get('SESSION_ID_USUARIO') === 'undefined' || !$.session.get('SESSION_ID_USUARIO')) {
            reconstruirSessionDesdeBackend(function () {
                pintarDatosUsuario();
                if (!debeCambiarClaveActivo()) {
                    cargarMenu();
                    verificarProximoVencer();
                }
            });
            return;
        }

        pintarDatosUsuario();
        if (!debeCambiarClaveActivo()) {
            cargarMenu();
            verificarProximoVencer();
        }
    }

    function reconstruirSessionDesdeBackend(callback) {
        $.ajax({
            type: "GET",
            url: "/Seguridad/ObtenerSesionActual",
            dataType: "json",
            async: true,
            success: function (sesion) {
                if (!sesion || sesion.autenticado !== true) {
                    notificarSesionExpiradaYRedirigir();
                    return;
                }

                $.session.set('SESSION_ID_USUARIO', sesion.SESSION_ID_USUARIO || "");
                $.session.set('SESSION_USUARIO', sesion.SESSION_USUARIO || "");
                $.session.set('SESSION_NOMBRES', sesion.SESSION_NOMBRES || "");
                $.session.set('SESSION_APELLIDOS', sesion.SESSION_APELLIDOS || "");
                $.session.set('SESSION_CORREO', sesion.SESSION_CORREO || "");
                $.session.set('SESSION_PERFIL', sesion.SESSION_PERFIL || "");
                $.session.set('SESSION_AREA', sesion.SESSION_AREA || "");
                $.session.set('SESSION_DEPARTAMENTO', sesion.SESSION_DEPARTAMENTO || "");
                $.session.set('SESSION_TELEFONO', sesion.SESSION_TELEFONO || "");
                $.session.set('SESSION_CARGO', sesion.SESSION_CARGO || "");
                $.session.set('SESSION_DEBE_CAMBIAR', sesion.SESSION_DEBE_CAMBIAR || "0");
                $.session.set('SESSION_DIAS_CLAVE', sesion.SESSION_DIAS_CLAVE || "999");
                $.session.set('SESSION_PROXIMO_VENCER', sesion.SESSION_PROXIMO_VENCER || "0");
                $.session.set('SESSION_MANTENER_SESION', sesion.SESSION_MANTENER_SESION || "0");
                $.session.set('SESSION_ROL_PV', sesion.SESSION_ROL_PV || "");
                $.session.set('SESSION_ES_ADMIN_PV', sesion.SESSION_ES_ADMIN_PV || "0");

                iniciarKeepAliveSiAplica();

                if (typeof callback === "function") {
                    callback();
                }
            },
            error: function (xhr) {
                if (xhr.status === 401) {
                    notificarSesionExpiradaYRedirigir();
                    return;
                }
                console.error("No se pudo reconstruir la sesión desde backend.");
            }
        });
    }

    function pintarDatosUsuario() {
        var SESSION_USUARIO = $.session.get('SESSION_USUARIO');
        var SESSION_NOMBRES = $.session.get('SESSION_NOMBRES');
        var SESSION_APELLIDOS = $.session.get('SESSION_APELLIDOS');
        var SESSION_CORREO = $.session.get('SESSION_CORREO');

        $('#nombre_completo_menu').text(((SESSION_APELLIDOS || '') + ' ' + (SESSION_NOMBRES || '')).trim() || SESSION_USUARIO || '');
        $('#txtusurio_menu').html((SESSION_USUARIO || '') + " <b class='caret'></b>");
        $('#txtperfil_menu').text(SESSION_CORREO || '');
    }

    function cargarMenu() {
        var idUsuario = $.session.get('SESSION_ID_USUARIO');
        if (!idUsuario) return;

        var ajax_data = { "ID": idUsuario };

        $.ajax({
            type: "POST",
            url: '/Seguridad/Mostrar_Menu',
            data: JSON.stringify(ajax_data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            async: true,
            beforeSend: function () {
                $('body').addClass('loading');
            },
            success: function (datos) {
                // 1. Mostrar todos los menús para los cuales el usuario tiene permiso en BD
                var menusPvdModulos = [
                    'menu_venta',
                    'menu_punto_venta_clientes_bloqueados',
                    'menu_punto_venta_articulos_fraccionados',
                    'menu_punto_venta_stock_por_almacen',
                    'menu_punto_venta_permisos'
                ];

                var countPvd = 0;
                if (datos && datos.length > 0) {
                    for (var i = 0; i < datos.length; i++) {
                        if (datos[i].DESCRIPCION_MENU_SYS) {
                            var menuSys = datos[i].DESCRIPCION_MENU_SYS.trim();
                            $('#' + menuSys).css("display", "block");
                            if (menusPvdModulos.indexOf(menuSys) !== -1) {
                                countPvd++;
                            }
                        }
                    }
                }

                if (countPvd === 0) {
                    $('body').removeClass('loading');
                    swal({
                        title: "Acceso Denegado",
                        text: "Su usuario no cuenta con autorización para acceder al Sistema de Punto de Venta.",
                        type: "warning",
                        confirmButtonColor: "#1ab394",
                        confirmButtonText: "Aceptar",
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    }).then(function () {
                        $.session.clear();
                        sessionStorage.clear();
                        window.location.href = "/Seguridad/Logout";
                    });
                    return;
                }

                // 2. Aplicar lógica de visibilidad jerárquica para menús padre
                ocultarMenusPadreSinSubmenus();

                $('body').removeClass('loading');
            },
            error: function (xhr) {
                console.warn("No se pudo cargar menú dinámico.", xhr.status);
                $('body').removeClass('loading');
                if (xhr.status === 401) {
                    notificarSesionExpiradaYRedirigir();
                }
            }
        });
    }

    function ocultarMenusPadreSinSubmenus() {
        // Verificar submenú de Reportes
        var tieneReportesVisibles = false;
        $('.nav-third-level li').each(function () {
            if ($(this).css('display') !== 'none') {
                tieneReportesVisibles = true;
                return false;
            }
        });

        if (tieneReportesVisibles) {
            $('#menu_padre_punto_venta_reportes').show();
        } else {
            $('#menu_padre_punto_venta_reportes').hide();
        }

        // Verificar si el menú padre de Punto de Venta tiene al menos un submenú visible
        var submenusPuntoVenta = [
            '#menu_venta',
            '#menu_punto_venta_clientes_bloqueados',
            '#menu_punto_venta_articulos_fraccionados',
            '#menu_punto_venta_stock_por_almacen'
        ];

        var tieneHijoVisible = false;
        for (var j = 0; j < submenusPuntoVenta.length; j++) {
            if ($(submenusPuntoVenta[j]).css('display') !== 'none') {
                tieneHijoVisible = true;
                break;
            }
        }

        if (tieneHijoVisible) {
            $('#menu_padre_punto_venta').show();
        } else {
            $('#menu_padre_punto_venta').hide();
        }

        // Verificar si el menú padre de Seguridad tiene al menos un submenú visible
        var tieneSeguridadVisible = ($('#menu_seguridad_cambio_clave').css('display') !== 'none') ||
                                    ($('#menu_punto_venta_permisos').css('display') !== 'none');

        if (tieneSeguridadVisible) {
            $('#menu_padre_seguridad').show();
        } else {
            $('#menu_padre_seguridad').hide();
        }
    }

    /* RUTINA DE KEEP-ALIVE PARA USUARIOS AUTORIZADOS EN PUNTO DE VENTA */
    let keepAliveIntervalId = null;
    let ultimoKeepAliveMs = 0;

    function ejecutarPingKeepAlive() {
        if (window.location.pathname.toLowerCase().includes('/seguridad/login')) {
            if (keepAliveIntervalId) {
                clearInterval(keepAliveIntervalId);
                keepAliveIntervalId = null;
            }
            return;
        }

        const ahora = Date.now();
        if (ahora - ultimoKeepAliveMs < 60000) {
            // Evitar pings múltiples en menos de 1 minuto
            return;
        }
        ultimoKeepAliveMs = ahora;

        $.ajax({
            type: "GET",
            url: "/PuntoVenta/KeepAlive",
            cache: false,
            success: function (res) {
                // Sesión renovada con éxito en segundo plano
            },
            error: function (xhr) {
                if (xhr.status === 401) {
                    notificarSesionExpiradaYRedirigir();
                }
            }
        });
    }

    function iniciarKeepAliveSiAplica() {
        var mantenerSesion = (window.MANTENER_SESION_PUNTO_VENTA === true) ||
                             ($.session.get('SESSION_MANTENER_SESION') === '1') ||
                             (sessionStorage.getItem('SESSION_MANTENER_SESION') === '1');

        if (mantenerSesion) {
            if (!keepAliveIntervalId) {
                const KEEPALIVE_INTERVAL_MS = 3 * 60 * 1000; // Ping cada 3 minutos
                keepAliveIntervalId = setInterval(ejecutarPingKeepAlive, KEEPALIVE_INTERVAL_MS);
            }

            // Despertar inmediato cuando el usuario regresa a la pestaña (Edge Sleeping Tabs)
            document.addEventListener("visibilitychange", function () {
                if (document.visibilityState === "visible") {
                    ejecutarPingKeepAlive();
                }
            });
            window.addEventListener("focus", function () {
                ejecutarPingKeepAlive();
            });
        }
    }

    iniciarKeepAliveSiAplica();

    // Salir / Logout
    $(document).on('click', '.js-logout', function (e) {
        e.preventDefault();
        if (keepAliveIntervalId) {
            clearInterval(keepAliveIntervalId);
            keepAliveIntervalId = null;
        }
        $.session.clear();
        sessionStorage.clear();
        localStorage.removeItem(SESSION_ACTIVE_USER_KEY);
        localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify({
            tipo: "LOGOUT",
            tabId: tabId,
            fecha: new Date().getTime()
        }));
        window.location.href = "/Seguridad/Logout";
    });
});
