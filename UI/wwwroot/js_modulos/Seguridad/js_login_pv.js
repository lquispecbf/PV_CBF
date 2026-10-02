$(document).ready(function () {

    const SESSION_TAB_ID_KEY = "CBF_PV_SESSION_TAB_ID";
    const SESSION_EVENT_KEY = "CBF_PV_SESSION_EVENT";
    const SESSION_ACTIVE_USER_KEY = "CBF_PV_SESSION_ACTIVE_USER";

    let tabId = sessionStorage.getItem(SESSION_TAB_ID_KEY);

    if (!tabId) {
        tabId = Date.now().toString() + "_" + Math.random().toString(36).substring(2);
        sessionStorage.setItem(SESSION_TAB_ID_KEY, tabId);
    }

    sessionStorage.removeItem('CBF_SESION_EXPIRADA_DIALOGO');
    window.__sesionExpiradaMostrada = false;
    localStorage.removeItem(SESSION_ACTIVE_USER_KEY);

    function normalizarUsuario(usuario) {
        return (usuario || "").trim().toUpperCase();
    }

    function notificarCambioSesion(tipo, usuario) {
        localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify({
            tipo: tipo,
            tabId: tabId,
            usuario: usuario || "",
            fecha: new Date().getTime()
        }));
    }

    $('body').removeClass('loading');

    $(window).on('pageshow', function () {
        $('body').removeClass('loading');
        sessionStorage.removeItem('CBF_SESION_EXPIRADA_DIALOGO');
        window.__sesionExpiradaMostrada = false;
        $("#txta").val("");
        $("#txtb").val("");
    });

    // Ingresar con Enter
    let input = document.querySelector('body');
    if (input) {
        input.addEventListener('keyup', (e) => {
            if (e.keyCode === 13) {
                $("#btningresar").click();
            }
        });
    }

    $("#btningresar").click(function () {
        
        var USUARIO_LOGIN = $("#txta").val();
        var CONTRASEÑA_LOGIN = $("#txtb").val();

        if (!USUARIO_LOGIN || !CONTRASEÑA_LOGIN) {
            swal("Atención", "Ingrese usuario y contraseña", "warning");
            return;
        }

        var usuarioActivo = localStorage.getItem(SESSION_ACTIVE_USER_KEY);

        if (usuarioActivo && normalizarUsuario(usuarioActivo) !== normalizarUsuario(USUARIO_LOGIN)) {
            swal(
                "Sesión activa",
                "Ya existe una sesión activa con el usuario: " + usuarioActivo + ".\n\nPara ingresar con otro usuario, cierre sesión primero o use otro navegador / incógnito.",
                "warning"
            );
            return;
        }

        var ajax_data = {
            "USUARIO": USUARIO_LOGIN,
            "CONTRASEÑA": CONTRASEÑA_LOGIN
        };

        $.ajax({
            type: "POST",
            url: '/Seguridad/Validar_Login',
            data: JSON.stringify(ajax_data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            async: true,
            beforeSend: function () {
                $('body').addClass('loading');
            },
            success: function (respuesta) {

                $('body').removeClass('loading');

                if (!respuesta.Estado) {
                    swal("Atención", respuesta.Mensaje, "warning");
                    return;
                }

                var usuario = respuesta.Usuario[0];
                var debeCambiar = (usuario.FORZAR_CAMBIO_CLAVE === "1");
                var mantenerSesion = (respuesta.MantenerSesion === true || respuesta.mantenerSesion === true);

                $.session.set('SESSION_ID_USUARIO', usuario.ID);
                $.session.set('SESSION_APELLIDOS', usuario.APELLIDOS);
                $.session.set('SESSION_NOMBRES', usuario.NOMBRES);
                $.session.set('SESSION_CORREO', usuario.CORREO);
                $.session.set('SESSION_USUARIO', usuario.USUARIO);
                $.session.set('SESSION_TELEFONO', usuario.TELEFONO);
                $.session.set('SESSION_AREA', usuario.AREA);
                $.session.set('SESSION_DEPARTAMENTO', usuario.DEPARTAMENTO);
                $.session.set('SESSION_PERFIL', usuario.PERFIL);
                $.session.set('SESSION_CARGO', usuario.CARGO);
                $.session.set('SESSION_DEBE_CAMBIAR', debeCambiar ? "1" : "0");
                $.session.set('SESSION_PROXIMO_VENCER', usuario.PROXIMO_VENCER || "0");
                $.session.set('SESSION_DIAS_CLAVE', (usuario.DIAS_RESTANTES_CLAVE != null ? usuario.DIAS_RESTANTES_CLAVE.toString() : ""));
                $.session.set('SESSION_MANTENER_SESION', mantenerSesion ? "1" : "0");

                sessionStorage.setItem('DEBE_CAMBIAR', debeCambiar ? '1' : '0');
                sessionStorage.setItem('SESSION_DEBE_CAMBIAR', debeCambiar ? '1' : '0');
                sessionStorage.setItem('SESSION_PROXIMO_VENCER', usuario.PROXIMO_VENCER || "0");
                sessionStorage.setItem('SESSION_DIAS_CLAVE', (usuario.DIAS_RESTANTES_CLAVE != null ? usuario.DIAS_RESTANTES_CLAVE.toString() : ""));
                sessionStorage.setItem('SESSION_MANTENER_SESION', mantenerSesion ? '1' : '0');
                sessionStorage.removeItem('AVISO_CLAVE_MOSTRADO');
                sessionStorage.removeItem('CBF_SESION_EXPIRADA_DIALOGO');
                window.__sesionExpiradaMostrada = false;
                sessionStorage.setItem('SESSION_USUARIO', usuario.USUARIO);
                sessionStorage.setItem('SESSION_NOMBRES', usuario.NOMBRES);
                sessionStorage.setItem('SESSION_APELLIDOS', usuario.APELLIDOS);
                sessionStorage.setItem('SESSION_CORREO', usuario.CORREO);
                sessionStorage.setItem('SESSION_PERFIL', usuario.PERFIL);

                localStorage.setItem(SESSION_ACTIVE_USER_KEY, usuario.USUARIO);
                notificarCambioSesion("LOGIN", usuario.USUARIO);

                if (debeCambiar) {
                    swal({
                        title: "¡Contraseña Vencida!",
                        text: "Por políticas de seguridad de CBF, su contraseña ha caducado. Debe cambiarla obligatoriamente para poder acceder a los módulos de Punto de Venta.",
                        type: "warning",
                        confirmButtonColor: "#1ab394",
                        confirmButtonText: "Cambiar Contraseña Ahora",
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    }).then(function () {
                        window.location.href = "/Seguridad/Cambio_Clave";
                    });
                } else {
                    // Redirección al módulo inicial autorizado de Punto de Venta
                    var destino = respuesta.UrlInicial || respuesta.urlInicial || "/PuntoVenta/Venta";
                    window.location.href = destino;
                }
            },
            error: function () {
                $('body').removeClass('loading');
                swal("Error", "Error de comunicación con el servidor", "error");
            }
        });
    });
});
