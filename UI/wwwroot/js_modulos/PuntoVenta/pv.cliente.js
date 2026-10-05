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

                actualizarEstadoBotonDigemid();

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
            const ruc = ($("#txtClienteRuc").val() || "").trim();
            const razonSocial = ($("#txtClienteNombre").val() || "").trim();
            consultarDigemid(ruc, razonSocial);
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
        $("#txtVentaLimiteCredito").val("").removeClass("credito-excedido").removeAttr("title");
        $("#btnDesgloseCredito").prop("disabled", true);
        $("#ddlFinancieroFormaPago").html("");
        $("#hdfDocEntrySap").val("");

        PV._clienteBloqueado = false;
        PV._motivoBloqueo = null;

        desbloquearBusquedaCliente();
        actualizarEstadoBotonDigemid();
        limpiarDireccionesCliente();
        limpiarNotasCreditoCliente();
        $("#tblDesgloseCredito tbody").empty();

        if (PV.Detalle && typeof PV.Detalle.bloquearPorClienteBloqueado === "function") {
            PV.Detalle.bloquearPorClienteBloqueado(false);
        }
    }

    function actualizarEstadoBotonDigemid() {
        $("#btnConsultarDigemid").prop("disabled", false);
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
                    const datos = resp.establecimientos || resp.Establecimientos || resp.data || resp.Data || [];
                    const rs = razonSocial || (datos.length > 0 ? (datos[0].razonSocial || datos[0].RazonSocial) : ($("#txtClienteNombre").val() || "-"));

                    $("#lblDigemidClienteNombre").text(rs);
                    $("#lblDigemidClienteRuc").text(ruc);
                    $("#lblDigemidCoincidencias").text("Coincidencias: " + datos.length + " registro(s)");

                    const ahora = new Date();
                    const fechaFmt = ("0" + ahora.getDate()).slice(-2) + "/" +
                        ("0" + (ahora.getMonth() + 1)).slice(-2) + "/" +
                        ahora.getFullYear() + " " +
                        ("0" + ahora.getHours()).slice(-2) + ":" +
                        ("0" + ahora.getMinutes()).slice(-2) + ":" +
                        ("0" + ahora.getSeconds()).slice(-2);
                    $("#lblDigemidFechaConsulta").text(fechaFmt);

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

        const $btn = $("#btnCapturarImagenDigemid");
        const originalHtml = $btn.html();
        $btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin mr-1"></i> Generando imagen...');

        const areaElement = document.getElementById("areaCapturaDigemid");
        const ruc = ($("#lblDigemidClienteRuc").text() || "DIGEMID").trim();
        const ahora = new Date();
        const fechaHora = ahora.getFullYear() +
            ("0" + (ahora.getMonth() + 1)).slice(-2) +
            ("0" + ahora.getDate()).slice(-2) + "_" +
            ("0" + ahora.getHours()).slice(-2) +
            ("0" + ahora.getMinutes()).slice(-2) +
            ("0" + ahora.getSeconds()).slice(-2);

        html2canvas(areaElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff"
        }).then(function (canvas) {
            $btn.prop("disabled", false).html(originalHtml);

            const imgData = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = "DIGEMID_" + ruc + "_" + fechaHora + ".png";
            link.href = imgData;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (typeof toastr !== "undefined") {
                toastr.success("Captura de DIGEMID descargada exitosamente.");
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
        consultarDigemid: consultarDigemid,
        capturarImagenDigemid: capturarImagenDigemid,
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
        seleccionarFilaDigemid: seleccionarFilaDigemid
    };

})();
