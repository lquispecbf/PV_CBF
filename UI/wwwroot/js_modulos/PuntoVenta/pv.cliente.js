window.PV = window.PV || {};

PV.Cliente = (function () {

    var _reqIdDirecciones = 0;
    var _reqIdNotasCredito = 0;
    var _reqIdCredito = 0;
    var _reqIdEstadoCredito = 0;
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

                if (tipo === "ruc") {
                    $(this).val(c.RUC);
                } else {
                    $(this).val(c.CLIENTE);
                }

                if (PV.DraftManager && typeof PV.DraftManager.notificarCambio === "function") {
                    PV.DraftManager.notificarCambio();
                }

                return false;
            }
        });
    }
    function registrarEventos() {
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
        $("#txtVentaLimiteCredito").val("").removeClass("credito-excedido").removeAttr("title");
        $("#btnDesgloseCredito").prop("disabled", true);
        $("#ddlFinancieroFormaPago").html("");
        $("#hdfDocEntrySap").val("");

        PV._clienteBloqueado = false;
        PV._motivoBloqueo = null;

        desbloquearBusquedaCliente();
        limpiarDireccionesCliente();
        limpiarNotasCreditoCliente();
        $("#tblDesgloseCredito tbody").empty();

        if (PV.Detalle && typeof PV.Detalle.bloquearPorClienteBloqueado === "function") {
            PV.Detalle.bloquearPorClienteBloqueado(false);
        }
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
        mostrarInfoControladosDireccion: mostrarInfoControladosDireccion
    };

})();
