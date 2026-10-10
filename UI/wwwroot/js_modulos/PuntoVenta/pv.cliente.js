window.PV = window.PV || {};

PV.Cliente = (function () {

    var _reqIdDirecciones = 0;
    var _reqIdNotasCredito = 0;
    var _reqIdCredito = 0;
    var _reqIdEstadoCredito = 0;
    var _clienteGroupCode = null;
    var _peticionesActivas = {
        direcciones: null,
        notasCredito: null,
        estadoCredito: null,
        creditoCliente: null
    };

    function cancelarPeticionesPendientes() {
        _reqIdDirecciones++;
        _reqIdNotasCredito++;
        _reqIdCredito++;
        _reqIdEstadoCredito++;
        if (_peticionesActivas.direcciones && typeof _peticionesActivas.direcciones.abort === "function") {
            try { _peticionesActivas.direcciones.abort(); } catch (e) { }
            _peticionesActivas.direcciones = null;
        }
        if (_peticionesActivas.notasCredito && typeof _peticionesActivas.notasCredito.abort === "function") {
            try { _peticionesActivas.notasCredito.abort(); } catch (e) { }
            _peticionesActivas.notasCredito = null;
        }
        if (_peticionesActivas.estadoCredito && typeof _peticionesActivas.estadoCredito.abort === "function") {
            try { _peticionesActivas.estadoCredito.abort(); } catch (e) { }
            _peticionesActivas.estadoCredito = null;
        }
        if (_peticionesActivas.creditoCliente && typeof _peticionesActivas.creditoCliente.abort === "function") {
            try { _peticionesActivas.creditoCliente.abort(); } catch (e) { }
            _peticionesActivas.creditoCliente = null;
        }
    }

    function _asegurarBotonInfoControlados() {
        const $ddlEnvio = $("#ddlClienteDireccionEnvioId");
        if ($ddlEnvio.length && !$("#btnInfoControladosDireccion").length) {
            const $parent = $ddlEnvio.parent();
            if (!$parent.hasClass("input-group")) {
                $ddlEnvio.wrap('<div class="input-group input-group-sm"></div>');
                $ddlEnvio.after('<div class="input-group-append"><button type="button" id="btnInfoControladosDireccion" class="btn btn-outline-success" title="Ver autorización de productos controlados en esta dirección" tabindex="-1"><i class="fa fa-info-circle"></i></button></div>');
            }
        }
    }

    function inicializar() {
        _asegurarBotonInfoControlados();
        inicializarAutocompleteCliente();
        registrarEventos();
        actualizarEstadoBotonDigemid();
    }
    function inicializarAutocompleteCliente() {
        $(".autocomplete-cliente").autocomplete({

            minLength: 3,
            delay: 150,

            source: function (request, response) {

                $.ajax({
                    url: '/PuntoVenta/Buscar_Cliente',
                    type: 'GET',
                    data: { criterioBusqueda: request.term },
                    success: function (data) {

                        response($.map(data, function (item) {
                            return {
                                label: item.RUC + ' - ' + item.CLIENTE,
                                value: item.CODIGO_CLIENTE,
                                data: item
                            };
                        }));
                    },
                    error: function () {
                        console.log("Error al buscar clientes");
                    }
                });
            },
            focus: function (event, ui) {
                return false;
            },
            select: function (event, ui) {

                let c = ui.item.data;
                let tipo = $(this).data("tipo");

                PV.registrarCambios();
                var rawGc = (c.GROUP_CODE !== undefined && c.GROUP_CODE !== null) ? c.GROUP_CODE :
                            (c.group_Code !== undefined && c.group_Code !== null) ? c.group_Code :
                            (c.GroupCode !== undefined && c.GroupCode !== null) ? c.GroupCode :
                            (c.groupCode !== undefined && c.groupCode !== null) ? c.groupCode : null;
                _clienteGroupCode = (rawGc !== null && rawGc !== undefined && rawGc !== "") ? parseInt(rawGc) : null;
                $("#hdfClienteGroupCode").val(_clienteGroupCode !== null && !isNaN(_clienteGroupCode) ? _clienteGroupCode : "");
                $("#txtClienteNombre").val(c.CLIENTE);
                $("#txtClienteRuc").val(c.RUC);
                $("#txtClienteCodigo").val(c.CODIGO_CLIENTE);
                $("#txtVentaLimiteCredito").val("");
                $("#btnDesgloseCredito").prop("disabled", true);
                bloquearBusquedaCliente();
                cargarDireccionesCliente(c.CODIGO_CLIENTE, null, null, null, null, function () {
                    if (PV.Validaciones && typeof PV.Validaciones.revalidarControladosEnDetalle === "function") {
                        PV.Validaciones.revalidarControladosEnDetalle();
                    }
                });
                PV.Catalogos.cargarFormasPago(c.CONDICION_PAGO, function () {
                    aplicarEstadoCreditoPorFormaPago(c.CODIGO_CLIENTE, c.CONDICION_PAGO);
                });
                cargarNotasCreditoCliente(c.CODIGO_CLIENTE);
                validarClienteBloqueado(c.CODIGO_CLIENTE);

                var usuarioSapCode = parseInt($("#hdfUsuarioSapCode").val());
                if (usuarioSapCode === 0 && c.SLPCODE) {
                    $("#ddlVentaVendedor").val(c.SLPCODE);
                }

                if (c.LISTA_PRECIO) {
                    var lpVal = c.LISTA_PRECIO.toString().trim();
                    var $ddlLp = $("#ddlClienteListaPrecio");
                    $ddlLp.attr("data-pending-val", lpVal);
                    if ($ddlLp.find("option").length > 0) {
                        $ddlLp.val(lpVal);
                        if ($ddlLp.val() !== lpVal) {
                            $ddlLp.find("option").each(function () {
                                var optVal = $(this).val().toString().trim();
                                var optText = $(this).text().trim();
                                if (optVal === lpVal || optText === lpVal) {
                                    $ddlLp.val($(this).val());
                                    return false;
                                }
                            });
                        }
                    }
                }

                var rucAnterior = ($("#txtClienteRuc").val() || "").trim();
                var codAnterior = ($("#txtClienteCodigo").val() || "").trim();
                if ((c.RUC && c.RUC !== rucAnterior) || (c.CODIGO_CLIENTE && c.CODIGO_CLIENTE !== codAnterior)) {
                    limpiarCapturaDigemid();
                }

                if (tipo === "ruc") {
                    $(this).val(c.RUC);
                } else {
                    $(this).val(c.CLIENTE);
                }

                actualizarEstadoBotonDigemid();
                actualizarBadgeDigemid();

                if (PV.DraftManager && typeof PV.DraftManager.notificarCambio === "function") {
                    PV.DraftManager.notificarCambio();
                }

                return false;
            }
        });
    }
    function registrarEventos() {
        $(document).on("input change keyup paste", "#txtClienteRuc", function () {
            actualizarEstadoBotonDigemid();
        });
        $("#btnConsultarDigemid").on("click", function () {
            if (!PV.Utils.puedeInteractuar()) return;

            const esModoLectura = PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly();
            const ruc = ($("#txtClienteRuc").val() || "").trim();
            const razonSocial = ($("#txtClienteNombre").val() || "").trim();

            // Si la orden ya tiene constancia DIGEMID capturada/cargada (y no requiere regularización)
            if (_digemidCapturaActual && (_digemidCapturaActual.nombreArchivo || _digemidCapturaActual.imagenBase64) && !_digemidCapturaActual.requiereRegularizacion) {
                mostrarVisorImagenDigemid(_digemidCapturaActual);
                return;
            }

            if (esModoLectura) {
                // Modo lectura para orden sin constancia previa (histórica) o pendiente de regularizar:
                // Permitir al usuario consultar el RUC en DIGEMID y regularizar la constancia en el servidor
                $("#modalConsultaDigemidTitle").html('<i class="fa fa-exclamation-circle text-warning mr-2"></i> Regularizar Constancia DIGEMID (MINSA)');
                $("#seccionConsultaDigemid").show();
                $("#seccionVisorImagenDigemid").hide();
                $("#btnCapturarImagenDigemid").show().html('<i class="fa fa-camera mr-1"></i> Regularizar y Guardar DIGEMID');
                $("#btnRecapturarDigemid").hide();
                $("#btnDescargarImagenDigemid").hide();
                consultarDigemid(ruc, razonSocial);
                return;
            }

            // Modo creación / edición cuando NO tiene imagen capturada previa (o servicio offline previo)
            $("#modalConsultaDigemidTitle").html('<i class="fa fa-hospital-alt mr-2"></i> Consulta de Establecimiento Farmacéutico - DIGEMID (MINSA)');
            $("#seccionConsultaDigemid").show();
            $("#seccionVisorImagenDigemid").hide();
            $("#btnCapturarImagenDigemid").show().html('<i class="fa fa-camera mr-1"></i> Capturar Imagen (PNG)');
            $("#btnRecapturarDigemid").hide();
            $("#btnDescargarImagenDigemid").hide();
            consultarDigemid(ruc, razonSocial);
        });
        $("#btnRecapturarDigemid").on("click", function () {
            if (!PV.Utils.puedeInteractuar()) return;
            const ruc = ($("#txtClienteRuc").val() || "").trim();
            const razonSocial = ($("#txtClienteNombre").val() || "").trim();

            Swal.fire({
                title: "¿Eliminar captura actual?",
                text: "¿Está seguro de eliminar la constancia DIGEMID actual para realizar una nueva consulta y captura?",
                type: "question",
                showCancelButton: true,
                confirmButtonColor: "#f8ac59",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, eliminar y volver a capturar",
                cancelButtonText: "Cancelar"
            }).then(function (result) {
                if (!result.value) return;

                // Borrar la captura previa para que se registre la nueva
                _digemidCapturaActual = null;
                actualizarBadgeDigemid();
                if (PV.DraftManager && typeof PV.DraftManager.notificarCambio === "function") {
                    PV.DraftManager.notificarCambio();
                }

                $("#modalConsultaDigemidTitle").html('<i class="fa fa-hospital-alt mr-2"></i> Actualizar Consulta DIGEMID (MINSA)');
                $("#seccionVisorImagenDigemid").hide();
                $("#seccionConsultaDigemid").show();
                $("#btnRecapturarDigemid").hide();
                $("#btnDescargarImagenDigemid").hide();
                $("#btnCapturarImagenDigemid").show().html('<i class="fa fa-camera mr-1"></i> Capturar Imagen (PNG)');

                consultarDigemid(ruc, razonSocial);
            });
        });
        $("#btnCapturarImagenDigemid").on("click", function () {
            capturarImagenDigemid();
        });
        $(document).off("click.digemidRow", "#tblDigemidResultados tbody tr").on("click.digemidRow", "#tblDigemidResultados tbody tr", function (e) {
            e.stopPropagation();
            seleccionarFilaDigemid(this);
        });
        $("#btnActualizarNotasCredito").on("click", function () {
            if (!PV.Utils.puedeInteractuar()) return;
            const codigoCliente = $("#txtClienteCodigo").val();

            if (!codigoCliente) {
                Swal.fire({
                    type: "warning",
                    title: "Cliente no seleccionado",
                    text: "Debe seleccionar un cliente para actualizar las notas de crédito."
                });
                return;
            }

            PV.Utils.ejecutarAccion(function (reHabilitar) {
                $("#btnActualizarNotasCredito").prop("disabled", true);
                cargarNotasCreditoCliente(codigoCliente, function () {
                    $("#btnActualizarNotasCredito").prop("disabled", false);
                    reHabilitar();
                });
            });
        });
        $("#ddlClienteDireccionEnvioId").on("change", function () {
            const direccion = $(this).find(":selected").data("direccion") || "";
            $("#txtClienteDireccionEnvio").val(direccion);
            if (PV.Validaciones && typeof PV.Validaciones.revalidarControladosEnDetalle === "function") {
                PV.Validaciones.revalidarControladosEnDetalle();
            }
        });
        $("#ddlClienteDireccionFacturaId").on("change", function () {
            const direccion = $(this).find(":selected").data("direccion") || "";
            $("#txtClienteDireccionFactura").val(direccion);
        });
        $("#btnDesgloseCredito").on("click", function () {
            if (!PV.Utils.puedeInteractuar()) return;
            cargarDesgloseCredito();
        });
        $(document).off("click.infoControlados", "#btnInfoControladosDireccion").on("click.infoControlados", "#btnInfoControladosDireccion", function () {
            mostrarInfoControladosDireccion();
        });
    }

    function mostrarInfoControladosDireccion() {
        const codigoCliente = $("#txtClienteCodigo").val();
        if (!codigoCliente) {
            Swal.fire({
                type: "warning",
                title: "Cliente no seleccionado",
                text: "Debe seleccionar un cliente primero.",
                confirmButtonColor: "#1ab394"
            });
            return;
        }

        const $opt = $("#ddlClienteDireccionEnvioId option:selected");
        const dirCodigo = $("#ddlClienteDireccionEnvioId").val();
        if (!dirCodigo || $opt.length === 0) {
            Swal.fire({
                type: "warning",
                title: "Dirección no seleccionada",
                text: "Debe seleccionar una dirección de envío.",
                confirmButtonColor: "#1ab394"
            });
            return;
        }

        const dirTexto = ($("#txtClienteDireccionEnvio").val() || $opt.data("direccion") || dirCodigo).toString().trim();
        const prec = ($opt.data("prec") || $opt.attr("data-prec") || "NO").toString().toUpperCase();
        const psi = ($opt.data("psi") || $opt.attr("data-psi") || "NO").toString().toUpperCase();
        const estu = ($opt.data("estu") || $opt.attr("data-estu") || "NO").toString().toUpperCase();
        const psiIv = ($opt.data("psi-iv") || $opt.data("psiIv") || $opt.attr("data-psi-iv") || "NO").toString().toUpperCase();

        const esSi = function (val) {
            return val === "SI" || val === "Y" || val === "1";
        };

        const renderBadge = function (val) {
            if (esSi(val)) {
                return '<span class="badge" style="background-color:#1ab394; color:#ffffff; font-size:12px; font-weight:bold; padding:5px 14px; border-radius:4px;"><i class="fa fa-check mr-1"></i>SI</span>';
            } else {
                return '<span class="badge" style="background-color:#ed5565; color:#ffffff; font-size:12px; font-weight:bold; padding:5px 14px; border-radius:4px;"><i class="fa fa-times mr-1"></i>NO</span>';
            }
        };

        const categorias = [
            { nombre: "Precursores", codigo: "02", auth: prec },
            { nombre: "Psicotrópicos", codigo: "03", auth: psi },
            { nombre: "Estupefacientes", codigo: "04", auth: estu },
            { nombre: "Psicotrópicos IV B", codigo: "05", auth: psiIv }
        ];

        let html = '<div style="text-align:left; margin-top:5px;">';
        html += '<div style="background:#f8f9fa; border:1px solid #e7eaec; border-radius:4px; padding:10px 14px; margin-bottom:12px; font-size:12px;">' +
            '<div><strong>Local / Id:</strong> <span class="text-primary font-weight-bold">' + PV.esc(dirCodigo) + '</span></div>' +
            '<div><strong>Dirección:</strong> ' + PV.esc(dirTexto) + '</div>' +
            '</div>';

        html += '<table class="table table-bordered table-striped table-hover mb-0" style="font-size:13px; width:100%;">';
        html += '<thead>' +
            '<tr style="background-color:#1ab394; color:white;">' +
            '<th style="background-color:#1ab394; color:white; border-color:#16987e; text-align:center; width:60px;">Cód.</th>' +
            '<th style="background-color:#1ab394; color:white; border-color:#16987e; text-align:left;">Categoría de Controlado</th>' +
            '<th style="background-color:#1ab394; color:white; border-color:#16987e; text-align:center; width:110px;">Autorizado</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>';

        categorias.forEach(function (cat) {
            html += '<tr>' +
                '<td class="text-center font-weight-bold" style="vertical-align:middle;">' + cat.codigo + '</td>' +
                '<td style="vertical-align:middle; font-weight:500;">' + cat.nombre + '</td>' +
                '<td class="text-center" style="vertical-align:middle;">' + renderBadge(cat.auth) + '</td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';

        Swal.fire({
            title: "Autorización de Controlados",
            html: html,
            type: "info",
            confirmButtonText: "Entendido",
            confirmButtonColor: "#1ab394",
            width: 550
        });
    }
    function cargarDireccionesCliente(codigoCliente, selectedEnvioId, selectedFacturaId, customEnvioTexto, customFacturaTexto, onComplete) {
            limpiarDireccionesCliente();

            if (!codigoCliente) {
                if (typeof onComplete === "function") onComplete();
                return;
            }

            var reqId = ++_reqIdDirecciones;
            if (_peticionesActivas.direcciones && typeof _peticionesActivas.direcciones.abort === "function") {
                try { _peticionesActivas.direcciones.abort(); } catch (e) { }
            }

            _peticionesActivas.direcciones = $.ajax({
                url: "/PuntoVenta/Buscar_DireccionesCliente",
                type: "GET",
                data: { codigoCliente: codigoCliente },
                dataType: "json",
                success: function (data) {
                    if (reqId !== _reqIdDirecciones) return; // Descarta respuesta de orden/cliente anterior

                    let direccionesEnvio = (data || []).filter(x => x.TIPO_DIRECCION === "S");
                    let direccionesFactura = (data || []).filter(x => x.TIPO_DIRECCION === "B");

                    cargarComboDirecciones(
                        "#ddlClienteDireccionEnvioId",
                        direccionesEnvio
                    );

                    cargarComboDirecciones(
                        "#ddlClienteDireccionFacturaId",
                        direccionesFactura
                    );

                    aplicarSeleccionDireccion(
                        "#ddlClienteDireccionEnvioId",
                        "#txtClienteDireccionEnvio",
                        selectedEnvioId,
                        customEnvioTexto
                    );

                    aplicarSeleccionDireccion(
                        "#ddlClienteDireccionFacturaId",
                        "#txtClienteDireccionFactura",
                        selectedFacturaId,
                        customFacturaTexto
                    );

                    if (typeof onComplete === "function") onComplete();
                },
                error: function (xhr, textStatus) {
                    if (textStatus === "abort" || reqId !== _reqIdDirecciones) return;
                    console.log("Error al cargar direcciones del cliente", xhr.responseText);
                    if (customEnvioTexto) $("#txtClienteDireccionEnvio").val(customEnvioTexto);
                    if (customFacturaTexto) $("#txtClienteDireccionFactura").val(customFacturaTexto);
                    if (typeof onComplete === "function") onComplete();
                }
            });
        }
    function aplicarSeleccionDireccion(selectorCombo, selectorTexto, selectedId, customTexto) {
            const $combo = $(selectorCombo);
            const tieneTextoCustom = customTexto !== undefined && customTexto !== null && String(customTexto).trim() !== "";
            const tieneId = selectedId !== undefined && selectedId !== null && String(selectedId).trim() !== "";
            const idStr = tieneId ? String(selectedId).trim() : "";

            if (tieneId) {
                const $opt = $combo.find("option").filter(function () {
                    return $(this).val().toString().trim().toUpperCase() === idStr.toUpperCase();
                });

                if ($opt.length > 0) {
                    $combo.val($opt.val());
                    if (tieneTextoCustom) {
                        $(selectorTexto).val(customTexto);
                    } else {
                        const dir = $combo.find(":selected").data("direccion") || "";
                        $(selectorTexto).val(dir);
                    }
                    return;
                } else {
                    $combo.append($("<option>", {
                        value: idStr,
                        text: idStr,
                        "data-direccion": tieneTextoCustom ? customTexto : idStr
                    }));
                    $combo.val(idStr);
                    if (tieneTextoCustom) {
                        $(selectorTexto).val(customTexto);
                    } else {
                        $(selectorTexto).val(idStr);
                    }
                    return;
                }
            }

            if (tieneTextoCustom) {
                $(selectorTexto).val(customTexto);
                return;
            }

            seleccionarDireccionPredeterminada(selectorCombo, selectorTexto);
        }
    function cargarComboDirecciones(selector, data) {
            let html = "";

            data.forEach(function (item) {
                html += `<option value="${item.CODIGO_DIRECCION}"
                            data-direccion="${formatearDireccionCliente(item)}"
                            data-predeterminada="${item.ES_PREDETERMINADA || 'N'}"
                            data-prec="${item.U_CBF_PREC || 'NO'}"
                            data-psi="${item.U_CBF_PSI || 'NO'}"
                            data-estu="${item.U_CBF_ESTU || 'NO'}"
                            data-psi-iv="${item.U_CBF_PSI_IV || 'NO'}">
                        ${item.CODIGO_DIRECCION}
                     </option>`;
            });

            $(selector).html(html);
        }
    function seleccionarDireccionPredeterminada(selectorCombo, selectorTexto) {
            const $combo = $(selectorCombo);

            if ($combo.find("option").length === 0) {
                $(selectorTexto).val("");
                return;
            }

            const $optDef = $combo.find("option[data-predeterminada='Y']");
            if ($optDef.length > 0) {
                $combo.val($optDef.first().val()).trigger("change");
                return;
            }

            $combo.prop("selectedIndex", 0).trigger("change");
        }
    function formatearDireccionCliente(item) {
            return [item.DIRECCION, item.CIUDAD, item.BARRIO]
                .filter(x => x && x.trim() !== "")
                .join("-");
        }
    function cargarNotasCreditoCliente(codigoCliente, onComplete) {
            limpiarNotasCreditoCliente();

            if (!codigoCliente) { if (typeof onComplete === "function") onComplete(); return; }

            var reqId = ++_reqIdNotasCredito;
            if (_peticionesActivas.notasCredito && typeof _peticionesActivas.notasCredito.abort === "function") {
                try { _peticionesActivas.notasCredito.abort(); } catch (e) { }
            }

            _peticionesActivas.notasCredito = $.ajax({
                url: "/PuntoVenta/Buscar_NotasCreditoCliente",
                type: "GET",
                data: { codigoCliente: codigoCliente },
                dataType: "json",
                success: function (data) {
                    if (reqId !== _reqIdNotasCredito) return; // Descarta respuesta obsoleta

                    if (!data || data.length === 0) {
                        $("#contenedorNotasCredito").html(
                            '<small class="text-muted">El cliente no tiene notas de crédito abiertas.</small>'
                        );
                        if (typeof onComplete === "function") onComplete();
                        return;
                    }
                    let html = "";

                    data.forEach(function (item) {
                        html += `
                            <label class="nota-credito-item" for="nc_${item.DOCENTRY}">
                                <input class="chk-nota-credito"
                                    type="checkbox"
                                    value="${item.DOCENTRY}"
                                    data-docnum="${item.DOCNUM}"
                                    data-total="${item.TOTAL}"
                                    id="nc_${item.DOCENTRY}">
                                <span class="nota-credito-texto">
                                    <span class="nota-credito-docnum">NC: ${item.DOCNUM}</span>
                                    <span class="nota-credito-total">S/ ${Number(item.TOTAL).toFixed(2)}</span>
                                </span>
                            </label>`;
                    });

                    $("#contenedorNotasCredito").html(html);
                    if (typeof onComplete === "function") onComplete();
                },
                error: function (xhr, textStatus) {
                    if (textStatus === "abort" || reqId !== _reqIdNotasCredito) return;
                    console.log("Error al cargar notas de crédito", xhr.responseText);
                    if (typeof onComplete === "function") onComplete();
                }
            });
        }
    function cargarDesgloseCredito() {
        const codigoCliente = $("#txtClienteCodigo").val();

        if (!codigoCliente) {
            Swal.fire({
                type: "warning",
                title: "Cliente no seleccionado",
                text: "Debe seleccionar un cliente para ver el desglose de su límite de crédito."
            });
            return;
        }

        var docEntrySap = parseInt($("#hdfDocEntrySap").val()) || null;

        $.ajax({
            url: "/PuntoVenta/Buscar_DesgloseCreditoCliente",
            type: "GET",
            data: { codigoCliente: codigoCliente, docEntrySap: docEntrySap },
            dataType: "json",
            success: function (data) {
                if (!data || data.length === 0) {
                    Swal.fire({
                        type: "warning",
                        title: "Sin datos",
                        text: "No se encontró información de crédito para el cliente."
                    });
                    return;
                }

                const d = data[0];
                const fmt = function (valor) { return "S/ " + Number(valor || 0).toFixed(2); };
                const montoRetenido = Number(d.MONTO_ORDEN_RETENIDA_SAP || 0);
                const disponibleReal = Number(d.DISPONIBLE_EFECTIVO !== undefined ? d.DISPONIBLE_EFECTIVO : d.DISPONIBLE) || 0;

                // Actualizar input en pantalla principal y reevaluar alerta de color
                $("#txtVentaLimiteCredito").val(disponibleReal.toFixed(2));
                if (PV.Detalle && typeof PV.Detalle.verificarAlertaLimiteCredito === "function") {
                    PV.Detalle.verificarAlertaLimiteCredito();
                }

                const filas = [
                    { descripcion: "Límite de crédito", monto: fmt(d.LIMITE) },
                    { descripcion: "Saldo de órdenes de venta", monto: fmt(d.SALDO_ORDENES) },
                    { descripcion: "Saldo de notas de débito", monto: fmt(d.SALDO_NOTAS_DEBITO) },
                    { descripcion: "Saldo del cliente", monto: fmt(d.BALANCE) },
                    { descripcion: "Crédito disponible SAP", monto: fmt(d.DISPONIBLE) }
                ];

                if (montoRetenido > 0) {
                    filas.push({
                        descripcion: '<i class="fa fa-info-circle text-info"></i> Retenido por esta orden (en reapertura)',
                        monto: "+ " + fmt(montoRetenido),
                        destacado: true
                    });
                    filas.push({
                        descripcion: "Crédito disponible efectivo para esta orden",
                        monto: fmt(disponibleReal),
                        resaltar: true
                    });
                } else {
                    filas[filas.length - 1].descripcion = "Crédito disponible";
                    filas[filas.length - 1].resaltar = true;
                }

                let html = "";

                filas.forEach(function (f) {
                    var estilo = f.resaltar ? ' style="font-weight:bold;background-color:#f0f8f8"' : (f.destacado ? ' style="font-style:italic;color:#17a2b8;"' : "");
                    html += `<tr${estilo}>` +
                        `<td>${f.descripcion}</td>` +
                        `<td class="text-right">${f.monto}</td></tr>`;
                });

                $("#tblDesgloseCredito tbody").html(html);
                $("#modalDesgloseCredito").modal("show");
            },
            error: function (xhr) {
                console.log("Error al cargar desglose de crédito", xhr.responseText);
                Swal.fire({
                    type: "error",
                    title: "Error",
                    text: "No se pudo obtener el desglose de crédito del cliente."
                });
            }
        });
    }

    function cargarCreditoCliente(codigoCliente, onComplete) {
        const $campo = $("#txtVentaLimiteCredito");

        if (!codigoCliente) {
            $campo.val("0.00");
            if (PV.Detalle && typeof PV.Detalle.verificarAlertaLimiteCredito === "function") {
                PV.Detalle.verificarAlertaLimiteCredito();
            }
            if (typeof onComplete === "function") onComplete();
            return;
        }

        var reqId = ++_reqIdCredito;
        if (_peticionesActivas.creditoCliente && typeof _peticionesActivas.creditoCliente.abort === "function") {
            try { _peticionesActivas.creditoCliente.abort(); } catch (e) { }
        }

        var docEntrySap = parseInt($("#hdfDocEntrySap").val()) || null;

        _peticionesActivas.creditoCliente = $.ajax({
            url: "/PuntoVenta/Buscar_DesgloseCreditoCliente",
            type: "GET",
            data: { codigoCliente: codigoCliente, docEntrySap: docEntrySap },
            dataType: "json",
            success: function (data) {
                if (reqId !== _reqIdCredito) return; // Descarta respuesta obsoleta

                if (data && data.length > 0) {
                    var d = data[0];
                    var disponibleReal = Number(d.DISPONIBLE_EFECTIVO !== undefined ? d.DISPONIBLE_EFECTIVO : d.DISPONIBLE) || 0;
                    $campo.val(disponibleReal.toFixed(2));
                } else {
                    $campo.val("0.00");
                }
                if (PV.Detalle && typeof PV.Detalle.verificarAlertaLimiteCredito === "function") {
                    PV.Detalle.verificarAlertaLimiteCredito();
                }
                if (typeof onComplete === "function") onComplete();
            },
            error: function (xhr, textStatus) {
                if (textStatus === "abort" || reqId !== _reqIdCredito) return;
                console.log("Error al cargar crédito del cliente", xhr.responseText);
                $campo.val("0.00");
                if (PV.Detalle && typeof PV.Detalle.verificarAlertaLimiteCredito === "function") {
                    PV.Detalle.verificarAlertaLimiteCredito();
                }
                if (typeof onComplete === "function") onComplete();
            }
        });
    }

    function formaPagoTieneCredito(formaPago) {
        return (formaPago || "").toUpperCase().indexOf("CREDITO") !== -1;
    }

    function aplicarEstadoCreditoPorFormaPago(codigoCliente, formaPago) {
        if (formaPagoTieneCredito(formaPago)) {
            $("#btnDesgloseCredito").prop("disabled", false);
            cargarCreditoCliente(codigoCliente);
        } else {
            $("#txtVentaLimiteCredito").val("0.00");
            $("#btnDesgloseCredito").prop("disabled", true);
            if (PV.Detalle && typeof PV.Detalle.verificarAlertaLimiteCredito === "function") {
                PV.Detalle.verificarAlertaLimiteCredito();
            }
        }
    }

    function aplicarEstadoCreditoDesdeSap(codigoCliente, criterioBusqueda, onCondicionPago) {
        const criterio = criterioBusqueda || codigoCliente;

        if (!criterio || String(criterio).length < 3) {
            aplicarEstadoCreditoPorFormaPago(codigoCliente, "");
            if (typeof onCondicionPago === "function") onCondicionPago("");
            return;
        }

        var reqId = ++_reqIdEstadoCredito;
        if (_peticionesActivas.estadoCredito && typeof _peticionesActivas.estadoCredito.abort === "function") {
            try { _peticionesActivas.estadoCredito.abort(); } catch (e) { }
        }

        _peticionesActivas.estadoCredito = $.ajax({
            url: "/PuntoVenta/Buscar_Cliente",
            type: "GET",
            data: { criterioBusqueda: criterio },
            dataType: "json",
            success: function (data) {
                if (reqId !== _reqIdEstadoCredito) return; // Descarta respuesta obsoleta

                const clientes = data || [];
                const cliente = clientes.find(function (item) {
                    return String(item.CODIGO_CLIENTE || "").trim() === String(codigoCliente || "").trim();
                }) || clientes.find(function (item) {
                    return String(item.RUC || "").trim() === String(criterio || "").trim();
                }) || clientes[0];

                var condicionPago = cliente ? cliente.CONDICION_PAGO : "";
                aplicarEstadoCreditoPorFormaPago(codigoCliente, condicionPago);
                if (typeof onCondicionPago === "function") onCondicionPago(condicionPago);
            },
            error: function (xhr, textStatus) {
                if (textStatus === "abort" || reqId !== _reqIdEstadoCredito) return;
                console.log("Error al validar condición de pago SAP", xhr.responseText);
                aplicarEstadoCreditoPorFormaPago(codigoCliente, "");
                if (typeof onCondicionPago === "function") onCondicionPago("");
            }
        });
    }

    function aplicarEstadoCreditoDesdeSqlServer(codigoCliente) {
        const formaPago = $("#ddlFinancieroFormaPago option:selected").text() || "";
        aplicarEstadoCreditoPorFormaPago(codigoCliente, formaPago);
    }

    function bloquearBusquedaCliente() {
        $("#txtClienteNombre").prop("readonly", true);
        $("#txtClienteRuc").prop("readonly", true);
    }

    function desbloquearBusquedaCliente() {
        $("#txtClienteNombre").prop("readonly", false);
        $("#txtClienteRuc").prop("readonly", false);
    }

    function limpiarSeleccionCliente() {
        $("#txtClienteNombre").val("");
        $("#txtClienteRuc").val("");
        $("#txtClienteCodigo").val("");
        $("#hdfClienteGroupCode").val("");
        _clienteGroupCode = null;
        $("#txtVentaLimiteCredito").val("").removeClass("credito-excedido").removeAttr("title");
        $("#btnDesgloseCredito").prop("disabled", true);
        $("#ddlFinancieroFormaPago").html("");
        $("#hdfDocEntrySap").val("");

        PV._clienteBloqueado = false;
        PV._motivoBloqueo = null;

        desbloquearBusquedaCliente();
        limpiarCapturaDigemid();
        actualizarEstadoBotonDigemid();
        limpiarDireccionesCliente();
        limpiarNotasCreditoCliente();
        $("#tblDesgloseCredito tbody").empty();

        if (PV.Detalle && typeof PV.Detalle.bloquearPorClienteBloqueado === "function") {
            PV.Detalle.bloquearPorClienteBloqueado(false);
        }
    }

    var _digemidCapturaActual = null;
    var _estadoServicioDigemid = { disponible: true, motivo: "", fechaConsulta: null };

    function limpiarCapturaDigemid() {
        _digemidCapturaActual = null;
        _estadoServicioDigemid = { disponible: true, motivo: "", fechaConsulta: null };
        actualizarBadgeDigemid();
    }

    function obtenerCapturaActual() {
        return _digemidCapturaActual;
    }

    function fijarCapturaActual(captura) {
        _digemidCapturaActual = captura || null;
        actualizarBadgeDigemid();
    }

    function obtenerGroupCode() {
        if (_clienteGroupCode !== null && _clienteGroupCode !== undefined) {
            return _clienteGroupCode;
        }
        var hdfVal = parseInt($("#hdfClienteGroupCode").val());
        return !isNaN(hdfVal) ? hdfVal : null;
    }

    function fijarGroupCode(gc) {
        _clienteGroupCode = gc !== null && gc !== undefined && gc !== "" ? parseInt(gc) : null;
        $("#hdfClienteGroupCode").val(_clienteGroupCode !== null ? _clienteGroupCode : "");
        actualizarEstadoBotonDigemid();
    }

    function esGrupoExcluidoDigemid() {
        var gc = obtenerGroupCode();
        return gc === 121;
    }

    function verificarGroupCodeClienteAsync(codigoCliente) {
        return new Promise(function (resolve) {
            var gcActual = obtenerGroupCode();
            if (gcActual !== null && !isNaN(gcActual)) {
                resolve(gcActual);
                return;
            }
            var cod = (codigoCliente || $("#txtClienteCodigo").val() || $("#txtClienteRuc").val() || "").trim();
            if (!cod) {
                resolve(null);
                return;
            }
            $.ajax({
                url: "/PuntoVenta/Buscar_Cliente",
                type: "GET",
                data: { criterioBusqueda: cod },
                dataType: "json",
                success: function (data) {
                    if (data && data.length > 0) {
                        var match = data.find(function (x) {
                            return (x.CODIGO_CLIENTE || "").toUpperCase() === cod.toUpperCase() ||
                                   (x.RUC || "") === cod;
                        }) || data[0];
                        if (match) {
                            var rawGc = (match.GROUP_CODE !== undefined && match.GROUP_CODE !== null) ? match.GROUP_CODE :
                                        (match.group_Code !== undefined && match.group_Code !== null) ? match.group_Code :
                                        (match.GroupCode !== undefined && match.GroupCode !== null) ? match.GroupCode :
                                        (match.groupCode !== undefined && match.groupCode !== null) ? match.groupCode : null;
                            if (rawGc !== null && rawGc !== undefined && rawGc !== "") {
                                fijarGroupCode(rawGc);
                                resolve(parseInt(rawGc));
                                return;
                            }
                        }
                    }
                    resolve(null);
                },
                error: function () {
                    resolve(null);
                }
            });
        });
    }

    function obtenerEstadoServicio() {
        return _estadoServicioDigemid;
    }

    function fijarEstadoServicio(estado) {
        _estadoServicioDigemid = estado || { disponible: true, motivo: "", fechaConsulta: null };
        actualizarBadgeDigemid();
    }

    function obtenerFechaLocalIso(d) {
        d = d || new Date();
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        return d.getFullYear() + "-" +
            pad(d.getMonth() + 1) + "-" +
            pad(d.getDate()) + "T" +
            pad(d.getHours()) + ":" +
            pad(d.getMinutes()) + ":" +
            pad(d.getSeconds());
    }

    function parsearFechaLocal(fechaVal) {
        if (!fechaVal) return new Date();
        if (fechaVal instanceof Date) return fechaVal;

        var s = String(fechaVal).trim();
        // Extraer componentes numéricos de forma directa para evitar corrimientos por UTC
        var m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (m) {
            return new Date(
                parseInt(m[1], 10),
                parseInt(m[2], 10) - 1,
                parseInt(m[3], 10),
                parseInt(m[4], 10),
                parseInt(m[5], 10),
                parseInt(m[6] || 0, 10)
            );
        }

        var d = new Date(s);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    function actualizarBadgeDigemid() {
        var $btn = $("#btnConsultarDigemid");
        if (!$btn.length) return;

        var tieneCaptura = _digemidCapturaActual && (_digemidCapturaActual.imagenBase64 || _digemidCapturaActual.nombreArchivo);
        var requiereReg = _digemidCapturaActual && _digemidCapturaActual.requiereRegularizacion;
        var esExcluido = esGrupoExcluidoDigemid();

        if (tieneCaptura && !requiereReg) {
            var fc = parsearFechaLocal(_digemidCapturaActual.fechaCaptura);
            var fcFmt = ("0" + fc.getHours()).slice(-2) + ":" + ("0" + fc.getMinutes()).slice(-2);
            $btn.removeClass("btn-info btn-warning btn-danger btn-secondary").addClass("btn-success")
                .html('<i class="fa fa-check-circle mr-1"></i> DIGEMID (' + fcFmt + ')')
                .attr("title", "DIGEMID capturado correctamente (" + fc.toLocaleDateString() + " " + fcFmt + "). Clic para ver.");
        } else if (requiereReg) {
            $btn.removeClass("btn-info btn-success btn-danger btn-secondary").addClass("btn-warning")
                .html('<i class="fa fa-exclamation-circle mr-1"></i> DIGEMID (Pendiente)')
                .attr("title", "Constancia DIGEMID pendiente de regularización. Clic para regularizar.");
        } else if (_estadoServicioDigemid && !_estadoServicioDigemid.disponible) {
            $btn.removeClass("btn-info btn-success btn-danger btn-secondary").addClass("btn-warning")
                .html('<i class="fa fa-exclamation-triangle mr-1"></i> DIGEMID (Offline)')
                .attr("title", "Servicio DIGEMID fuera de servicio (" + (_estadoServicioDigemid.motivo || "") + "). Clic para reintentar.");
        } else if (esExcluido) {
            $btn.removeClass("btn-success btn-warning btn-danger btn-secondary").addClass("btn-info")
                .html('<i class="fa fa-hospital-alt mr-1"></i> DIGEMID (Opcional)')
                .attr("title", "Cliente del grupo OTRO (121). Consulta DIGEMID opcional.");
        } else {
            $btn.removeClass("btn-success btn-warning btn-danger btn-secondary").addClass("btn-info")
                .html('<i class="fa fa-hospital-alt mr-1"></i> DIGEMID')
                .attr("title", "Consultar situación en DIGEMID (MINSA)");
        }
    }

    function mostrarVisorImagenDigemid(captura) {
        if (!captura) return;

        const esModoLectura = PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly();
        const nombreArchivo = captura.nombreArchivo || captura.nombreOriginal || "Constancia_DIGEMID.png";
        let srcImg = "";

        if (captura.imagenBase64 && captura.imagenBase64.length > 50) {
            srcImg = captura.imagenBase64.startsWith("data:") ? captura.imagenBase64 : "data:image/png;base64," + captura.imagenBase64;
        } else if (captura.nombreArchivo) {
            srcImg = "/PuntoVenta/Ver_ImagenDigemid?nombreArchivo=" + encodeURIComponent(captura.nombreArchivo);
        }

        const tituloModal = esModoLectura 
            ? '<i class="fa fa-file-image mr-2"></i> Constancia DIGEMID Registrada (Solo Lectura)' 
            : '<i class="fa fa-file-image mr-2"></i> Constancia DIGEMID Registrada';
        $("#modalConsultaDigemidTitle").html(tituloModal);
        $("#lblVisorNombreArchivo").text(nombreArchivo);

        const fc = parsearFechaLocal(captura.fechaCaptura);
        const fcFmt = ("0" + fc.getDate()).slice(-2) + "/" + ("0" + (fc.getMonth() + 1)).slice(-2) + "/" + fc.getFullYear() + " " + ("0" + fc.getHours()).slice(-2) + ":" + ("0" + fc.getMinutes()).slice(-2) + ":" + ("0" + fc.getSeconds()).slice(-2);
        $("#lblVisorFechaCaptura").text("Fecha Captura: " + fcFmt);
        $("#lblVisorEstadoServicio").text(captura.estadoServicioDigemid || "EXITOSO");

        // Auditoría: Creación
        const usrCreacion = captura.usuarioCreacion || captura.USUARIO_CREACION || "";
        if (usrCreacion) {
            const fechaCrea = captura.fechaCreacion || captura.FECHA_CREACION;
            const fcfCrea = fechaCrea ? parsearFechaLocal(fechaCrea) : fc;
            const fcfCreaFmt = ("0" + fcfCrea.getDate()).slice(-2) + "/" + ("0" + (fcfCrea.getMonth() + 1)).slice(-2) + "/" + fcfCrea.getFullYear() + " " + ("0" + fcfCrea.getHours()).slice(-2) + ":" + ("0" + fcfCrea.getMinutes()).slice(-2);
            $("#lblVisorAuditoriaCreacion").html('<i class="fa fa-user mr-1"></i> Creado por: <strong>' + PV.esc(usrCreacion) + '</strong> <span class="text-muted">(' + fcfCreaFmt + ')</span>').show();
        } else {
            $("#lblVisorAuditoriaCreacion").hide();
        }

        // Auditoría: Modificación
        const usrMod = captura.usuarioModificacion || captura.USUARIO_MODIFICACION || "";
        if (usrMod) {
            const fechaMod = captura.fechaModificacion || captura.FECHA_MODIFICACION;
            const fcfMod = fechaMod ? parsearFechaLocal(fechaMod) : new Date();
            const fcfModFmt = ("0" + fcfMod.getDate()).slice(-2) + "/" + ("0" + (fcfMod.getMonth() + 1)).slice(-2) + "/" + fcfMod.getFullYear() + " " + ("0" + fcfMod.getHours()).slice(-2) + ":" + ("0" + fcfMod.getMinutes()).slice(-2);
            $("#lblVisorAuditoriaModificacion").html('<i class="fa fa-user-edit mr-1"></i> Modificado por: <strong>' + PV.esc(usrMod) + '</strong> <span class="text-muted">(' + fcfModFmt + ')</span>').show();
        } else {
            $("#lblVisorAuditoriaModificacion").hide();
        }

        // Auditoría: Regularización
        const usrReg = captura.usuarioRegularizacion || captura.USUARIO_REGULARIZACION || "";
        if (usrReg) {
            const fechaReg = captura.fechaRegularizacion || captura.FECHA_REGULARIZACION;
            const fcfReg = fechaReg ? parsearFechaLocal(fechaReg) : new Date();
            const fcfRegFmt = ("0" + fcfReg.getDate()).slice(-2) + "/" + ("0" + (fcfReg.getMonth() + 1)).slice(-2) + "/" + fcfReg.getFullYear() + " " + ("0" + fcfReg.getHours()).slice(-2) + ":" + ("0" + fcfReg.getMinutes()).slice(-2);
            $("#lblVisorAuditoriaRegularizacion").html('<i class="fa fa-check-double mr-1"></i> Regularizado por: <strong>' + PV.esc(usrReg) + '</strong> <span class="text-muted">(' + fcfRegFmt + ')</span>').show();
        } else {
            $("#lblVisorAuditoriaRegularizacion").hide();
        }

        $("#imgDigemidPreview").attr("src", srcImg);

        $("#seccionConsultaDigemid").hide();
        $("#seccionVisorImagenDigemid").show();

        // Ocultar botón de capturar mientras se visualiza la imagen
        $("#btnCapturarImagenDigemid").hide();

        // Si estamos editando o reabriendo, mostrar botón para actualizar/recapturar
        if (!esModoLectura) {
            $("#btnRecapturarDigemid").show();
        } else {
            $("#btnRecapturarDigemid").hide();
        }

        // Se muestra el botón de descarga
        if (srcImg) {
            $("#btnDescargarImagenDigemid").attr("href", srcImg).attr("download", nombreArchivo).show();
        } else {
            $("#btnDescargarImagenDigemid").hide();
        }

        $("#modalConsultaDigemid").modal("show");
    }

    function actualizarEstadoBotonDigemid() {
        $("#btnConsultarDigemid").prop("disabled", false);
        actualizarBadgeDigemid();
    }

    function consultarDigemid(ruc, razonSocial) {
        const codigoCliente = ($("#txtClienteCodigo").val() || "").trim();
        ruc = (ruc || $("#txtClienteRuc").val() || "").trim();
        razonSocial = (razonSocial || $("#txtClienteNombre").val() || "").trim();

        if (!codigoCliente || !ruc) {
            Swal.fire({
                type: "warning",
                title: "Cliente no seleccionado",
                text: "Por favor seleccione un cliente primero para realizar la consulta en DIGEMID.",
                confirmButtonColor: "#1ab394"
            });
            return;
        }

        if (ruc.length !== 11) {
            Swal.fire({
                type: "warning",
                title: "RUC requerido para DIGEMID",
                text: "El cliente seleccionado cuenta con " + (ruc.length === 8 ? "DNI (" + ruc + ")" : "documento (" + ruc + ")") + ". El portal oficial de DIGEMID requiere un número de RUC de 11 dígitos para consultar el establecimiento farmacéutico.",
                confirmButtonColor: "#1ab394"
            });
            return;
        }

        Swal.fire({
            title: "Consultando DIGEMID...",
            html: "Obteniendo información del establecimiento farmacéutico para el RUC <b>" + PV.esc(ruc) + "</b>",
            allowOutsideClick: false,
            allowEscapeKey: false,
            onBeforeOpen: function () {
                Swal.showLoading();
            }
        });

        $.ajax({
            url: "/PuntoVenta/ConsultarDigemid",
            type: "GET",
            data: { ruc: ruc },
            dataType: "json",
            success: function (resp) {
                Swal.close();
                if (resp && (resp.success || resp.Success)) {
                    const ahora = new Date();
                    const ahoraLocalIso = obtenerFechaLocalIso(ahora);
                    _estadoServicioDigemid = { disponible: true, motivo: "", fechaConsulta: ahoraLocalIso };
                    actualizarBadgeDigemid();

                    const datos = resp.establecimientos || resp.Establecimientos || resp.data || resp.Data || [];
                    const rs = razonSocial || (datos.length > 0 ? (datos[0].razonSocial || datos[0].RazonSocial) : ($("#txtClienteNombre").val() || "-"));

                    $("#lblDigemidClienteNombre").text(rs);
                    $("#lblDigemidClienteRuc").text(ruc);
                    $("#lblDigemidCoincidencias").text("Coincidencias: " + datos.length + " registro(s)");

                    const fechaFmt = ("0" + ahora.getDate()).slice(-2) + "/" +
                        ("0" + (ahora.getMonth() + 1)).slice(-2) + "/" +
                        ahora.getFullYear() + " " +
                        ("0" + ahora.getHours()).slice(-2) + ":" +
                        ("0" + ahora.getMinutes()).slice(-2) + ":" +
                        ("0" + ahora.getSeconds()).slice(-2);
                    $("#lblDigemidFechaConsulta").text(fechaFmt).data("rawDate", ahoraLocalIso);

                    let tbodyHtml = "";
                    if (datos.length > 0) {
                        datos.forEach(function (item, idx) {
                            const itemNum = item.item || item.Item || (idx + 1);
                            const situacion = item.situacion || item.Situacion || "";
                            const sitUpper = situacion.trim().toUpperCase();
                            const numReg = item.numeroRegistro || item.NumeroRegistro || "";
                            const cat = item.categoria || item.Categoria || "";
                            const nomCom = item.nombreComercial || item.NombreComercial || "";
                            const razSoc = item.razonSocial || item.RazonSocial || "";
                            const rucEst = item.ruc || item.Ruc || "";
                            const dir = item.direccion || item.Direccion || "";
                            const ubi = item.ubigeo || item.Ubigeo || "";
                            const emp = item.empadronado || item.Empadronado || "NO APLICA";

                            let badgeSituacion = "";
                            if (sitUpper === "ACTIVO") {
                                badgeSituacion = '<span class="badge" style="background-color:#1ab394; color:#ffffff; font-size:12px; font-weight:bold; padding:4px 8px; border-radius:4px;"><i class="fa fa-check-circle mr-1"></i>ACTIVO</span>';
                            } else if (sitUpper.indexOf("CIERRE") !== -1 || sitUpper.indexOf("SUSPENSION") !== -1 || sitUpper.indexOf("BAJA") !== -1 || sitUpper.indexOf("CANCELADO") !== -1 || sitUpper.indexOf("NO") !== -1) {
                                badgeSituacion = '<span class="badge" style="background-color:#ed5565; color:#ffffff; font-size:12px; font-weight:bold; padding:4px 8px; border-radius:4px;"><i class="fa fa-times-circle mr-1"></i>' + PV.esc(situacion) + '</span>';
                            } else {
                                badgeSituacion = '<span class="badge badge-warning" style="font-size:12px; font-weight:bold; padding:4px 8px; border-radius:4px;">' + PV.esc(situacion || "DESCONOCIDO") + '</span>';
                            }

                            tbodyHtml += '<tr class="fila-digemid-item" style="cursor:pointer;">' +
                                '<td class="text-center font-bold" style="vertical-align:middle;">' + itemNum + '</td>' +
                                '<td class="text-center font-bold text-navy" style="vertical-align:middle;">' + PV.esc(numReg) + '</td>' +
                                '<td class="text-center font-bold" style="vertical-align:middle;">' + PV.esc(cat) + '</td>' +
                                '<td style="vertical-align:middle;">' + PV.esc(nomCom) + '</td>' +
                                '<td style="vertical-align:middle;">' + PV.esc(razSoc) + '</td>' +
                                '<td class="text-center font-bold" style="vertical-align:middle;">' + PV.esc(rucEst) + '</td>' +
                                '<td style="vertical-align:middle;"><small>' + PV.esc(dir) + '</small></td>' +
                                '<td style="vertical-align:middle;"><small>' + PV.esc(ubi) + '</small></td>' +
                                '<td class="text-center" style="vertical-align:middle;">' + badgeSituacion + '</td>' +
                                '<td class="text-center" style="vertical-align:middle;"><small class="font-bold">' + PV.esc(emp) + '</small></td>' +
                                '</tr>';
                        });
                    } else {
                        tbodyHtml = '<tr><td colspan="10" class="text-center text-muted p-4"><i class="fa fa-info-circle fa-2x mb-2 d-block text-warning"></i>No se encontraron registros de establecimientos en DIGEMID para el RUC especificado.</td></tr>';
                    }

                    $("#tblDigemidResultados tbody").html(tbodyHtml);
                    if (datos.length === 1) {
                        seleccionarFilaDigemid($("#tblDigemidResultados tbody tr:first")[0]);
                    }
                    $("#modalConsultaDigemid").modal("show");
                } else {
                    const msgError = (resp && (resp.error || resp.Error || resp.mensajeResumen || resp.MensajeResumen || resp.message || resp.Message)) || "Error al obtener datos de DIGEMID.";
                    _estadoServicioDigemid = { disponible: false, motivo: msgError, fechaConsulta: new Date().toISOString() };
                    actualizarBadgeDigemid();

                    Swal.fire({
                        type: "error",
                        title: "Consulta DIGEMID",
                        text: msgError,
                        confirmButtonColor: "#1ab394"
                    });
                }
            },
            error: function (xhr) {
                Swal.close();
                console.error("Error al consultar DIGEMID:", xhr.responseText);
                var errDetail = "No se pudo conectar con el servicio de DIGEMID.";
                try {
                    var jsonErr = JSON.parse(xhr.responseText);
                    if (jsonErr && (jsonErr.error || jsonErr.Error || jsonErr.message || jsonErr.Message || jsonErr.mensajeResumen)) {
                        errDetail = jsonErr.error || jsonErr.Error || jsonErr.message || jsonErr.Message || jsonErr.mensajeResumen;
                    }
                } catch (e) { }

                _estadoServicioDigemid = { disponible: false, motivo: errDetail, fechaConsulta: new Date().toISOString() };
                actualizarBadgeDigemid();

                Swal.fire({
                    type: "error",
                    title: "Error en Consulta DIGEMID",
                    text: errDetail,
                    confirmButtonColor: "#1ab394"
                });
            }
        });
    }

    function seleccionarFilaDigemid(elementoTr) {
        if (!elementoTr) return;
        var $tr = $(elementoTr);
        if ($tr.find("td[colspan]").length > 0) return; // Ignorar fila vacía / mensaje

        var yaSeleccionado = $tr.hasClass("fila-digemid-seleccionada");

        // Quitar selección de todas las filas
        $("#tblDigemidResultados tbody tr").removeClass("fila-digemid-seleccionada");
        $("#tblDigemidResultados tbody tr td").each(function () {
            this.style.removeProperty("background-color");
            this.style.removeProperty("color");
        });

        if (!yaSeleccionado) {
            $tr.addClass("fila-digemid-seleccionada");
            $tr.find("td").each(function () {
                this.style.setProperty("background-color", "#fff275", "important");
                this.style.setProperty("color", "#1a1a1a", "important");
            });
        }
    }

    function capturarImagenDigemid() {
        if (typeof html2canvas !== "function") {
            Swal.fire({
                type: "error",
                title: "Módulo no disponible",
                text: "No se encontró el módulo de captura html2canvas.",
                confirmButtonColor: "#1ab394"
            });
            return;
        }

        const $filaSeleccionada = $("#tblDigemidResultados tbody tr.fila-digemid-seleccionada");
        if ($filaSeleccionada.length === 0) {
            Swal.fire({
                type: "warning",
                title: "Seleccione un establecimiento",
                text: "Debe hacer clic sobre la fila del establecimiento farmacéutico correspondiente para seleccionarla antes de realizar la captura.",
                confirmButtonColor: "#1ab394"
            });
            return;
        }

        var estData = {
            item: $filaSeleccionada.find("td:eq(0)").text().trim(),
            numeroRegistro: $filaSeleccionada.find("td:eq(1)").text().trim(),
            categoria: $filaSeleccionada.find("td:eq(2)").text().trim(),
            nombreComercial: $filaSeleccionada.find("td:eq(3)").text().trim(),
            razonSocial: $filaSeleccionada.find("td:eq(4)").text().trim(),
            ruc: $filaSeleccionada.find("td:eq(5)").text().trim(),
            direccion: $filaSeleccionada.find("td:eq(6)").text().trim(),
            ubigeo: $filaSeleccionada.find("td:eq(7)").text().trim(),
            situacion: $filaSeleccionada.find("td:eq(8)").text().trim(),
            empadronado: $filaSeleccionada.find("td:eq(9)").text().trim()
        };

        const $btn = $("#btnCapturarImagenDigemid");
        const originalHtml = $btn.html();
        $btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin mr-1"></i> Generando imagen...');

        const areaElement = document.getElementById("areaCapturaDigemid");
        const ruc = ($("#txtClienteRuc").val() || $("#lblDigemidClienteRuc").text() || "DIGEMID").trim();
        const ahora = new Date();
        const fechaHora = ahora.getFullYear() +
            ("0" + (ahora.getMonth() + 1)).slice(-2) +
            ("0" + ahora.getDate()).slice(-2) + "_" +
            ("0" + ahora.getHours()).slice(-2) +
            ("0" + ahora.getMinutes()).slice(-2) +
            ("0" + ahora.getSeconds()).slice(-2);

        var docEntryActual = parseInt($("#hdfDocEntry").val()) || 0;
        var nombreArchivo = (docEntryActual > 0 ? docEntryActual : "0") + "-" + ruc + "-" + fechaHora + ".png";

        html2canvas(areaElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff"
        }).then(function (canvas) {
            $btn.prop("disabled", false).html(originalHtml);

            const imgData = canvas.toDataURL("image/png");
            const ahoraIso = obtenerFechaLocalIso(ahora);

            _digemidCapturaActual = {
                docEntry: docEntryActual,
                cardCode: ($("#txtClienteCodigo").val() || "").trim(),
                cardName: ($("#txtClienteNombre").val() || "").trim(),
                licTradNum: ruc,
                fechaConsulta: $("#lblDigemidFechaConsulta").data("rawDate") || ahoraIso,
                fechaCaptura: ahoraIso,
                nombreArchivo: nombreArchivo,
                nombreOriginal: nombreArchivo,
                imagenBase64: imgData,
                estadoServicioDigemid: "EXITOSO",
                tieneDataDigemid: true,
                establecimientoJson: JSON.stringify(estData),
                requiereRegularizacion: false
            };

            actualizarBadgeDigemid();

            // Si estamos en modo regularización en modo VER (orden ya guardada en BD)
            if (PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly() && docEntryActual > 0) {
                regularizarCapturaEnServidor(docEntryActual, _digemidCapturaActual);
            } else {
                if (typeof toastr !== "undefined") {
                    toastr.success("Constancia DIGEMID capturada en memoria (" + nombreArchivo + ").");
                }

                if (PV.DraftManager && typeof PV.DraftManager.notificarCambio === "function") {
                    PV.DraftManager.notificarCambio();
                }

                $("#modalConsultaDigemid").modal("hide");
            }
        }).catch(function (err) {
            $btn.prop("disabled", false).html(originalHtml);
            console.error("Error al capturar imagen DIGEMID:", err);
            Swal.fire({
                type: "error",
                title: "Error al capturar",
                text: "Ocurrió un error al generar la captura en imagen del resultado.",
                confirmButtonColor: "#1ab394"
            });
        });
    }

    function regularizarCapturaEnServidor(docEntry, captura) {
        if (!docEntry || !captura) return;

        Swal.fire({
            title: "Regularizando DIGEMID...",
            text: "Guardando constancia en el servidor...",
            allowOutsideClick: false,
            onBeforeOpen: function () { Swal.showLoading(); }
        });

        var docEntrySap = parseInt($("#hdfDocEntrySap").val()) || null;
        var cardCode = ($("#txtClienteCodigo").val() || captura.cardCode || "").trim();
        var cardName = ($("#txtClienteNombre").val() || captura.cardName || "").trim();
        var licTradNum = captura.licTradNum || ($("#txtClienteRuc").val() || "").trim();

        $.ajax({
            url: "/PuntoVenta/RegularizarDigemid",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                DOCENTRY: docEntry,
                DOCENTRY_SAP: docEntrySap,
                CARDCODE: cardCode,
                CARDNAME: cardName,
                LICTRADNUM: licTradNum,
                FECHA_CONSULTA: captura.fechaConsulta,
                FECHA_CAPTURA: captura.fechaCaptura,
                ESTADO_SERVICIO_DIGEMID: captura.estadoServicioDigemid || "EXITOSO",
                TIENE_DATA_DIGEMID: true,
                ESTABLECIMIENTO_JSON: captura.establecimientoJson,
                IMAGEN_BASE64: captura.imagenBase64
            }),
            dataType: "json",
            success: function (resp) {
                Swal.close();
                if (resp && (resp.success || resp.Success)) {
                    _digemidCapturaActual.requiereRegularizacion = false;
                    actualizarBadgeDigemid();
                    $("#modalConsultaDigemid").modal("hide");
                    Swal.fire({
                        type: "success",
                        title: "Constancia Regularizada",
                        text: resp.message || "La constancia de DIGEMID se guardó y regularizó exitosamente en el servidor.",
                        confirmButtonColor: "#1ab394"
                    });
                } else {
                    Swal.fire({
                        type: "error",
                        title: "Error al regularizar",
                        text: resp.message || "No se pudo regularizar la constancia DIGEMID.",
                        confirmButtonColor: "#1ab394"
                    });
                }
            },
            error: function (xhr) {
                Swal.close();
                var msg = "No se pudo regularizar la constancia en el servidor.";
                try {
                    var j = JSON.parse(xhr.responseText);
                    if (j && (j.message || j.error)) msg = j.message || j.error;
                } catch (e) { }
                Swal.fire({
                    type: "error",
                    title: "Error",
                    text: msg,
                    confirmButtonColor: "#1ab394"
                });
            }
        });
    }

    function cargarDigemidPorDocEntry(docEntry, onComplete) {
        if (!docEntry) {
            if (typeof onComplete === "function") onComplete(null);
            return;
        }

        $.ajax({
            url: "/PuntoVenta/ObtenerDigemidPorDocEntry",
            type: "GET",
            data: { docEntry: docEntry },
            dataType: "json",
            success: function (data) {
                if (data && (data.ID_DIGEMID_PV > 0 || data.id_DIGEMID_PV > 0 || data.DOCENTRY > 0 || data.docentry > 0)) {
                    _digemidCapturaActual = {
                        idDigemidPv: data.ID_DIGEMID_PV || data.id_DIGEMID_PV,
                        docEntry: data.DOCENTRY || data.docentry,
                        docEntrySap: data.DOCENTRY_SAP || data.docentry_SAP,
                        cardCode: data.CARDCODE || data.cardcode,
                        cardName: data.CARDNAME || data.cardname,
                        licTradNum: data.LICTRADNUM || data.lictradnum,
                        fechaConsulta: data.FECHA_CONSULTA || data.fecha_CONSULTA,
                        fechaCaptura: data.FECHA_CAPTURA || data.fecha_CAPTURA,
                        nombreArchivo: data.NOMBRE_ARCHIVO || data.nombre_ARCHIVO,
                        estadoServicioDigemid: data.ESTADO_SERVICIO_DIGEMID || data.estado_SERVICIO_DIGEMID,
                        tieneDataDigemid: data.TIENE_DATA_DIGEMID !== undefined ? data.TIENE_DATA_DIGEMID : data.tiene_DATA_DIGEMID,
                        establecimientoJson: data.ESTABLECIMIENTO_JSON || data.establecimiento_JSON,
                        requiereRegularizacion: data.REQUIERE_REGULARIZACION !== undefined ? data.REQUIERE_REGULARIZACION : data.requiere_REGULARIZACION
                    };
                } else {
                    _digemidCapturaActual = null;
                }
                actualizarBadgeDigemid();
                if (typeof onComplete === "function") onComplete(_digemidCapturaActual);
            },
            error: function () {
                if (typeof onComplete === "function") onComplete(null);
            }
        });
    }

    function validarClienteBloqueado(codigoCliente) {
            if (!codigoCliente) {
                PV._clienteBloqueado = false;
                PV._motivoBloqueo = null;
                if (PV.Detalle && typeof PV.Detalle.bloquearPorClienteBloqueado === "function") {
                    PV.Detalle.bloquearPorClienteBloqueado(false);
                }
                return;
            }

            $.ajax({
                url: "/PuntoVenta/Validar_ClienteBloqueado",
                type: "GET",
                data: { carcode: codigoCliente },
                dataType: "json",
                success: function (data) {
                    if (data && data.bloqueado) {
                        PV._clienteBloqueado = true;
                        PV._motivoBloqueo = data.motivo;

                        const nombreCliente = ($("#txtClienteNombre").val() || "").trim();
                        const rucCliente = ($("#txtClienteRuc").val() || "").trim();
                        const motivoBloqueo = data.motivo || "Sin motivo especificado";

                        let htmlMsg = `<div class="text-center mb-2">`;
                        if (nombreCliente) {
                            htmlMsg += `<p class="mb-1" style="font-size: 1.05rem; font-weight: 600; color: #333;">${nombreCliente}</p>`;
                        }
                        if (rucCliente) {
                            htmlMsg += `<p class="text-muted mb-2"><small><strong>RUC/DNI:</strong> ${rucCliente}</small></p>`;
                        }
                        htmlMsg += `</div>`;
                        htmlMsg += `<div class="text-left" style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 10px; color: #856404; font-size: 0.9rem;">`;
                        htmlMsg += `<strong>Motivo del bloqueo:</strong><br>${motivoBloqueo}`;
                        htmlMsg += `</div>`;

                        Swal.fire({
                            type: "warning",
                            title: "Cliente Bloqueado",
                            html: htmlMsg,
                            confirmButtonText: "Aceptar"
                        }).then(function () {
                            const $btnClear = $("#txtClienteNombre").closest(".input-clear").find(".btn-clear-input");
                            if ($btnClear.length) {
                                $btnClear.trigger("click");
                            } else {
                                limpiarSeleccionCliente();
                                $("#txtClienteNombre").focus();
                            }
                        });
                    } else {
                        PV._clienteBloqueado = false;
                        PV._motivoBloqueo = null;
                        if (PV.Detalle && typeof PV.Detalle.bloquearPorClienteBloqueado === "function") {
                            PV.Detalle.bloquearPorClienteBloqueado(false);
                        }
                    }
                },
                error: function () {
                    PV._clienteBloqueado = false;
                    PV._motivoBloqueo = null;
                    if (PV.Detalle && typeof PV.Detalle.bloquearPorClienteBloqueado === "function") {
                        PV.Detalle.bloquearPorClienteBloqueado(false);
                    }
                }
            });
        }
    function limpiarDireccionesCliente() {
            $("#ddlClienteDireccionEnvioId").html("");
            $("#txtClienteDireccionEnvio").val("");

            $("#ddlClienteDireccionFacturaId").html("");
            $("#txtClienteDireccionFactura").val("");
        }
    function limpiarNotasCreditoCliente() {
            $("#contenedorNotasCredito").html(
                '<small class="text-muted">Seleccione un cliente para cargar notas de crédito.</small>'
            );
    }

    return {
        inicializar: inicializar,
        inicializarAutocompleteCliente: inicializarAutocompleteCliente,
        limpiarSeleccionCliente: limpiarSeleccionCliente,
        actualizarEstadoBotonDigemid: actualizarEstadoBotonDigemid,
        actualizarBadgeDigemid: actualizarBadgeDigemid,
        limpiarCapturaDigemid: limpiarCapturaDigemid,
        obtenerCapturaActual: obtenerCapturaActual,
        fijarCapturaActual: fijarCapturaActual,
        obtenerEstadoServicio: obtenerEstadoServicio,
        fijarEstadoServicio: fijarEstadoServicio,
        consultarDigemid: consultarDigemid,
        capturarImagenDigemid: capturarImagenDigemid,
        cargarDigemidPorDocEntry: cargarDigemidPorDocEntry,
        bloquearBusquedaCliente: bloquearBusquedaCliente,
        cancelarPeticionesPendientes: cancelarPeticionesPendientes,
        cargarNotasCreditoCliente: cargarNotasCreditoCliente,
        cargarDesgloseCredito: cargarDesgloseCredito,
        cargarCreditoCliente: cargarCreditoCliente,
        cargarDireccionesCliente: cargarDireccionesCliente,
        aplicarEstadoCreditoPorFormaPago: aplicarEstadoCreditoPorFormaPago,
        aplicarEstadoCreditoDesdeSap: aplicarEstadoCreditoDesdeSap,
        aplicarEstadoCreditoDesdeSqlServer: aplicarEstadoCreditoDesdeSqlServer,
        validarClienteBloqueado: validarClienteBloqueado,
        mostrarInfoControladosDireccion: mostrarInfoControladosDireccion,
        seleccionarFilaDigemid: seleccionarFilaDigemid,
        mostrarVisorImagenDigemid: mostrarVisorImagenDigemid,
        esGrupoExcluidoDigemid: esGrupoExcluidoDigemid,
        obtenerGroupCode: obtenerGroupCode,
        fijarGroupCode: fijarGroupCode,
        verificarGroupCodeClienteAsync: verificarGroupCodeClienteAsync
    };

})();
