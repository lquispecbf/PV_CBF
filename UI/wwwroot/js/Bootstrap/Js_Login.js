$(document).ready(function () {



    $("#btningresar").click(function () {

       

        var USUARIO_LOGIN = $("#txtusuario").val();
        var CONTRASEÑA_LOGIN = $("#txtclave").val();

        var ajax_data = { "USUARIO": USUARIO_LOGIN, "CONTRASEÑA": CONTRASEÑA_LOGIN };

        $.ajax({
            type: "POST",
            url: '../ServiciosWeb/SW_Usuarios.asmx/Validar_Login',
            data: JSON.stringify(ajax_data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            async: true,
            beforeSend: function () {
                $('body').addClass('loading');
            },
            success: function (respuesta) {
                var data = (typeof respuesta.d) === 'string' ? eval('(' + respuesta.d + ')') : respuesta.d;

                var ID, APELLIDOS, NOMBRES, CORREO, USUARIO, CONTRASEÑA;

                if (data.length > 0)
                {
                    for (var i = 0; i < data.length; i++) {


                        ID = data[i].ID,
                            APELLIDOS = data[i].APELLIDOS,
                            NOMBRES = data[i].NOMBRES,
                            CORREO = data[i].CORREO,
                            USUARIO = data[i].USUARIO,
                            CONTRASEÑA = data[i].CONTRASEÑA,
                            PERFIL = data[i].PERFIL
                           

                    }

                    $.session.set('SESSION_ID', ID);
                    $.session.set('SESSION_APELLIDOS', APELLIDOS);
                    $.session.set('SESSION_NOMBRES', NOMBRES);
                    $.session.set('SESSION_CORREO', CORREO);
                    $.session.set('SESSION_USUARIO', USUARIO);
                    $.session.set('SESSION_CONTRASEÑA', CONTRASEÑA);
                    $.session.set('SESSION_PERFIL', PERFIL);
                  


                  
                        window.location.href = "Principal.aspx";
                  
                }





                else { swal("Error!", "Usuario o Contraseña Incorrecta. !", "error"); }

                $('body').removeClass('loading');
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                var error = eval("(" + XMLHttpRequest.responseText + ")");
                alert(error.Message);
            }
        });



    });




});