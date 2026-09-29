$(document).ready(function () {
    // 1. Cargar datos de perfil del usuario en sesión
    cargarDatosUsuario();

    // 2. Control de visibilidad de contraseñas (Toggle Show/Hide)
    $('.btnTogglePass').on('click', function (e) {
        e.preventDefault();
        var targetId = $(this).data('target');
        var $input = $('#' + targetId);
        if ($input.attr('type') === 'password') {
            $input.attr('type', 'text');
            $(this).text('🙈');
        } else {
            $input.attr('type', 'password');
            $(this).text('👁');
        }
    });

    // 3. Guardar nueva contraseña
    $('#btn_guardar_cambio_clave').on('click', function (e) {
        e.preventDefault();
        guardarCambioClave();
    });

    // Soporte para tecla ENTER en los inputs
    $('#formCambioClave input').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            guardarCambioClave();
        }
    });

    function cargarDatosUsuario() {
        var nombres = sessionStorage.getItem('SESSION_NOMBRES') || $.session.get('SESSION_NOMBRES') || '';
        var apellidos = sessionStorage.getItem('SESSION_APELLIDOS') || $.session.get('SESSION_APELLIDOS') || '';
        var perfil = sessionStorage.getItem('SESSION_PERFIL') || $.session.get('SESSION_PERFIL') || '';
        var correo = sessionStorage.getItem('SESSION_CORREO') || $.session.get('SESSION_CORREO') || '';

        if (nombres) {
            $('#txtnombre_completo').text((nombres + ' ' + apellidos).trim());
            $('#txtperfil').text(perfil);
            $('#txtcorreo').text(correo);
        } else {
            // Si no estuviera en sessionStorage, consultar endpoint
            $.ajax({
                type: "GET",
                url: '/Seguridad/ObtenerSesionActual',
                dataType: "json",
                success: function (data) {
                    if (data && data.autenticado) {
                        $('#txtnombre_completo').text((data.SESSION_NOMBRES + ' ' + data.SESSION_APELLIDOS).trim());
                        $('#txtperfil').text(data.SESSION_PERFIL);
                        $('#txtcorreo').text(data.SESSION_CORREO);
                    }
                }
            });
        }
    }

    function validarClaveCompleja(password) {
        // Mínimo 8 caracteres, al menos 1 letra mayúscula, 1 letra minúscula, 1 número y 1 carácter especial
        var regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        return regex.test(password);
    }

    function guardarCambioClave() {
        var claveActual = $('#txtclaveactual').val().trim();
        var claveNueva1 = $('#txtnuevacontrasena1').val().trim();
        var claveNueva2 = $('#txtnuevacontrasena2').val().trim();

        // Validaciones previas
        if (!claveActual) {
            swalAlerta('Campo Requerido', 'Por favor, ingrese su contraseña actual.', 'warning');
            $('#txtclaveactual').focus();
            return;
        }

        if (!claveNueva1) {
            swalAlerta('Campo Requerido', 'Por favor, ingrese la nueva contraseña.', 'warning');
            $('#txtnuevacontrasena1').focus();
            return;
        }

        if (!claveNueva2) {
            swalAlerta('Campo Requerido', 'Por favor, confirme su nueva contraseña.', 'warning');
            $('#txtnuevacontrasena2').focus();
            return;
        }

        if (claveNueva1 !== claveNueva2) {
            swalAlerta('Discrepancia', 'Las nuevas contraseñas no coinciden. Verifíquelas.', 'warning');
            $('#txtnuevacontrasena2').focus();
            return;
        }

        if (claveActual === claveNueva1) {
            swalAlerta('Contraseña Duplicada', 'La nueva contraseña no puede ser idéntica a la contraseña actual.', 'warning');
            $('#txtnuevacontrasena1').focus();
            return;
        }

        if (!validarClaveCompleja(claveNueva1)) {
            swalAlerta(
                'Requisitos de Seguridad',
                'La nueva contraseña no cumple con los estándares exigidos:<br>' +
                '• Mínimo 8 caracteres.<br>' +
                '• Al menos 1 letra mayúscula.<br>' +
                '• Al menos 1 letra minúscula.<br>' +
                '• Al menos 1 número.<br>' +
                '• Al menos 1 carácter especial (@, #, $, %, etc.).',
                'warning'
            );
            $('#txtnuevacontrasena1').focus();
            return;
        }

        var param = {
            CLAVE_ACTUAL: claveActual,
            CLAVE_NUEVA: claveNueva1
        };

        $('body').addClass('loading');

        $.ajax({
            type: "POST",
            url: '/Seguridad/Cambiar_Clave_Segura',
            data: JSON.stringify(param),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (response) {
                $('body').removeClass('loading');
                if (response && response.resultado > 0) {
                    // Limpiar datos locales y eventos de sesión
                    sessionStorage.clear();
                    $.session.clear();
                    localStorage.removeItem('CBF_PV_SESSION_ACTIVE_USER');
                    localStorage.setItem('CBF_PV_SESSION_EVENT', JSON.stringify({
                        tipo: "LOGOUT",
                        fecha: new Date().getTime()
                    }));

                    var mensajeExito = response.mensaje || "Su contraseña ha sido modificada con éxito. Por su seguridad, su sesión se cerrará para que inicie sesión con su nueva clave.";

                    if (typeof swal === 'function') {
                        swal({
                            title: "¡Contraseña Actualizada!",
                            text: mensajeExito,
                            type: "success",
                            showCancelButton: false,
                            confirmButtonColor: "#1ab394",
                            confirmButtonText: "Iniciar Sesión",
                            allowOutsideClick: false,
                            allowEscapeKey: false
                        }).then(function () {
                            window.location.href = '/Seguridad/Logout';
                        });
                    } else if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
                        Swal.fire({
                            title: "¡Contraseña Actualizada!",
                            text: mensajeExito,
                            icon: "success",
                            confirmButtonColor: "#1ab394",
                            confirmButtonText: "Iniciar Sesión",
                            allowOutsideClick: false,
                            allowEscapeKey: false
                        }).then(function () {
                            window.location.href = '/Seguridad/Logout';
                        });
                    } else {
                        alert(mensajeExito);
                        window.location.href = '/Seguridad/Logout';
                    }
                } else {
                    swalAlerta('Atención', response.mensaje || "No se pudo actualizar la contraseña.", 'error');
                }
            },
            error: function (xhr, status, error) {
                $('body').removeClass('loading');
                swalAlerta('Error del Servidor', 'Ocurrió un error al procesar el cambio de contraseña. Por favor, reintente.', 'error');
            }
        });
    }

    function swalAlerta(titulo, mensaje, tipo) {
        if (typeof swal === 'function') {
            swal({
                title: titulo,
                html: mensaje,
                type: tipo,
                confirmButtonColor: '#1ab394'
            });
        } else if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            Swal.fire({
                title: titulo,
                html: mensaje,
                icon: tipo,
                confirmButtonColor: '#1ab394'
            });
        } else {
            alert(titulo + ': ' + mensaje.replace(/<br>/g, '\n'));
        }
    }
});
