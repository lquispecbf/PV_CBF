window.PV = window.PV || {};

PV.Validaciones = (function () {

    function inicializar() {
        $("#btnVentaGuardar").on("click", function (e) {
            e.preventDefault();
            $(this).blur();
            guardarVenta();
        });

        $("#btnVentaBorrador").on("click", function (e) {
            e.preventDefault();
            $(this).blur();
            guardarBorrador();
        });

        $("#btnVentaImportarArticulo").on("click", function (e) {
            e.preventDefault();
            abrirModalImportarExcel();
        });

        $("#fileImportarExcel").on("change", function () {
            procesarArchivoExcel(this);
        });

        $("#ddlImportarHoja").on("change", function () {
            cargarHojaExcel();
        });

        $("#btnCargarExcel").on("click", function () {
            importarArticulosExcel();
        });

        $("#btnVentaLimpiar").on("click", function () {
            $(this).blur();
            Swal.fire({
                title: "¿Limpiar formulario?",
                text: "Se iniciará una nueva venta en blanco (el borrador actual se conserva en la lista de borradores).",
                type: "question",
                showCancelButton: true,
                confirmButtonText: "Sí, limpiar",
                cancelButtonText: "Cancelar"
            }).then(function (result) {
                if (!result.value) return;
                limpiarFormulario(false);
                enfocarCliente();
                $("#btnBusquedaBuscar").trigger("click");
            });
        });
    }

    function validarCabeceraVenta() {
        const errores = [];

        if (PV._clienteBloqueado) {
            errores.push("El cliente se encuentra bloqueado. Motivo: " + (PV._motivoBloqueo || ""));
            return errores;
        }

        if (!$("#txtClienteCodigo").val()) errores.push("Debe seleccionar un cliente.");
        if (!$("#txtClienteNombre").val()) errores.push("Debe ingresar el nombre del cliente.");
        if (!$("#txtClienteRuc").val()) errores.push("Debe ingresar el DNI/RUC del cliente.");
        if (!$("#ddlClienteListaPrecio").val()) errores.push("Debe seleccionar una lista de precios.");
        if ($("#ddlVentaVendedor").val() === "-1") errores.push("Debe seleccionar un vendedor.");
        if (!$("#ddlVentaAlmacen").val()) errores.push("Debe seleccionar un almacén.");
        const fechaAtencion = ($("#txtVentaFechaAtencion").val() || "").trim();
        const fechaEntrega = ($("#txtLogisticaFechaEntrega").val() || "").trim();

        if (!fechaAtencion) errores.push("Debe ingresar la fecha de atención.");
        if (!$("#ddlClienteDireccionEnvioId").val()) errores.push("Debe seleccionar una dirección de envío.");
        if (!$("#ddlClienteDireccionFacturaId").val()) errores.push("Debe seleccionar una dirección fiscal.");
        if (!$("#ddlLogisticaTipoEmbalaje").val()) errores.push("Debe seleccionar un tipo de embalaje.");
        if (!$("#ddlLogisticaLugarEntrega").val()) errores.push("Debe seleccionar un lugar de entrega.");
        if (!fechaEntrega) errores.push("Debe ingresar una fecha de entrega.");
        if (!$("#ddlLogisticaHoraEntrega").val()) {
            errores.push("Debe seleccionar una hora de entrega.");
        } else if ($("#ddlLogisticaHoraEntrega option:selected").is(":disabled")) {
            errores.push("La hora de entrega seleccionada ya no se encuentra disponible para la fecha seleccionada.");
        }
        if (!$("#ddlLogisticaModoEnvio").val()) errores.push("Debe seleccionar un modo de envío.");

        if (fechaAtencion && fechaEntrega) {
            const parsearFecha = function (str) {
                if (!str) return null;
                if (str.indexOf("/") !== -1) {
                    const partes = str.split("/");
                    if (partes.length === 3) {
                        return new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
                    }
                } else if (str.indexOf("-") !== -1) {
                    const partes = str.split("-");
                    if (partes.length === 3) {
                        return new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
                    }
                }
                const d = new Date(str);
                return isNaN(d.getTime()) ? null : d;
            };

            const dAtencion = parsearFecha(fechaAtencion);
            const dEntrega = parsearFecha(fechaEntrega);

            if (dAtencion && dEntrega && dEntrega < dAtencion) {
                errores.push("La fecha de entrega no puede ser menor a la fecha de atención.");
            }
        }

        const lugarEntregaText = $("#ddlLogisticaLugarEntrega option:selected").text().toUpperCase();

        if (lugarEntregaText === "AGENCIA") {
            if (!$("#txtLogisticaAgencia").val()) errores.push("Debe ingresar la agencia.");
            if (!$("#txtLogisticaRuc").val()) errores.push("Debe ingresar el DNI/RUC.");
            if (!$("#txtLogisticaContactoNombre").val()) errores.push("Debe ingresar el nombre de contacto.");
            if (!$("#txtLogisticaTelefono").val()) errores.push("Debe ingresar el teléfono.");
            if (!$("#txtLogisticaLugarEnvio").val()) errores.push("Debe ingresar el lugar de envío.");
        }

        if (!$("#ddlFinancieroFormaPago").val()) errores.push("Debe seleccionar una forma de pago.");
        if (!$("#ddlFinancieroTipoComprobante").val()) errores.push("Debe seleccionar un tipo de comprobante.");

        return errores;
    }

    function validarCreditoVenta() {
        const limite = parseFloat($("#txtVentaLimiteCredito").val()) || 0;
        const total = parseFloat($("#txtVentaNeto").val()) || 0;
        const formaPago = ($("#ddlFinancieroFormaPago option:selected").text() || "").toUpperCase();

        if (formaPago.indexOf("CREDITO") !== -1 && total > limite) {
            return "La orden no puede superar la línea de crédito del cliente.";
        }

        return "";
    }

    function validarDetalleLotes() {
        const errores = [];

        $("#tblVentaDetalle tbody tr").each(function () {
            const codigo = $(this).find(".txtDetalleCodigo").val();
            if (!codigo) return;

            const descripcion = $(this).find(".txtDetalleDescripcion").val() || codigo;
            const cantidad = parseFloat(PV.Detalle.leerCantidadFila($(this)));

            if (!cantidad || cantidad <= 0) {
                errores.push(`El producto "${descripcion}" tiene cantidad 0.`);
                return;
            }

            const lotes = $(this).data("lotes");
            if (!lotes || !Array.isArray(lotes) || lotes.length === 0) {
                errores.push(`El producto "${descripcion}" no tiene lotes asignados.`);
                return;
            }

            const factor = parseFloat($(this).find(".ddlDetalleUmd :selected").data("factor")) || 1;
            const baseQty = cantidad * factor;
            const sumaLotes = lotes.reduce(function (s, l) { return s + (parseFloat(l.QUANTITY) || 0); }, 0);

            if (Math.abs(sumaLotes - baseQty) > 0.01) {
                errores.push(`El producto "${descripcion}" tiene ${sumaLotes} unidades en lotes, pero la cantidad es ${baseQty}.`);
            }
        });

        return errores;
    }

    function validarFraccionadoDetalle() {
        const errores = [];

        // 1. Filas que perdieron permiso de fraccionado al reabrir (fondo amarillo)
        $("#tblVentaDetalle tbody tr.fila-error-fraccionado").each(function () {
            const $fila = $(this);
            const codigo = $fila.find(".txtDetalleCodigo").val() || "";
            const descripcion = $fila.find(".txtDetalleDescripcion").val() || codigo;
            errores.push(
                `El producto "${descripcion}" (${codigo}) no permite venta fraccionada y la línea está marcada en amarillo. Cambie su UMD o retire la línea.`
            );
        });

        // 2. Validación de reglas fraccionadas solo para UMD = PZA / PIEZA
        $("#tblVentaDetalle tbody tr").each(function () {
            const $fila = $(this);
            const codigo = $fila.find(".txtDetalleCodigo").val();
            if (!codigo || $fila.hasClass("fila-error-fraccionado")) return;

            const umdTexto = ($fila.find(".ddlDetalleUmd :selected").text() || "").trim().toUpperCase();
            const esPza = umdTexto === "PZA" || umdTexto === "PIEZA";
            if (!esPza) return;

            const fraccionado = $fila.data("fraccionado");
            const descripcion = $fila.find(".txtDetalleDescripcion").val() || codigo;
            const cantidad = parseFloat(PV.Detalle.leerCantidadFila($fila)) || 0;

            if (!fraccionado) {
                errores.push(`El producto "${descripcion}" no permite venta fraccionada y su UMD es PZA.`);
                return;
            }

            if (cantidad > 0) {
                const montoMinimo = $fila.data("montominimo") || fraccionado;
                if (cantidad < montoMinimo) {
                    errores.push(`El producto "${descripcion}" tiene una cantidad mínima de ${montoMinimo} para venta fraccionada.`);
                    return;
                }
                if (cantidad % fraccionado !== 0) {
                    errores.push(`El producto "${descripcion}" cantidad ${cantidad} no es múltiplo de ${fraccionado}.`);
                    return;
                }
            }
        });

        return errores;
    }

    function validarClienteSeleccionadoParaDetalle() {
        var cliente = ($("#txtClienteCodigo").val() || "").trim();
        var dirEnvio = ($("#ddlClienteDireccionEnvioId").val() || "").trim();

        if (!cliente) {
            Swal.fire({
                type: "warning",
                title: "Seleccione un Cliente",
                text: "Primero debe seleccionar un cliente para elegir una dirección de envío válida antes de ingresar artículos.",
                confirmButtonText: "Entendido",
                confirmButtonColor: "#1ab394"
            }).then(function () {
                enfocarCliente();
            });
            return false;
        }

        if (!dirEnvio) {
            Swal.fire({
                type: "warning",
                title: "Dirección de Envío Requerida",
                text: "El cliente seleccionado no cuenta con una dirección de envío válida seleccionada.",
                confirmButtonText: "Entendido",
                confirmButtonColor: "#1ab394"
            });
            return false;
        }

        return true;
    }

    function _obtenerNombreTipoControlado(tipo) {
        tipo = (tipo || "").toString().trim();
        if (tipo === "02" || tipo === "2") return "Precursores";
        if (tipo === "03" || tipo === "3") return "Psicotrópicos";
        if (tipo === "04" || tipo === "4") return "Estupefacientes";
        if (tipo === "05" || tipo === "5") return "Psicotrópicos IV B";
        return "Controlado";
    }

    function validarArticuloControlado(tipoControlado) {
        var tipo = (tipoControlado || "01").toString().trim();
        if (tipo === "01" || tipo === "1" || !tipo) {
            return { autorizado: true, tipo: "01", tipoNombre: "Normal" };
        }

        var $optEnvio = $("#ddlClienteDireccionEnvioId option:selected");
        if ($optEnvio.length === 0 || !$("#ddlClienteDireccionEnvioId").val()) {
            return { autorizado: false, tipo: tipo, tipoNombre: _obtenerNombreTipoControlado(tipo) };
        }

        var prec = ($optEnvio.data("prec") || "NO").toString().toUpperCase();
        var psi = ($optEnvio.data("psi") || "NO").toString().toUpperCase();
        var estu = ($optEnvio.data("estu") || "NO").toString().toUpperCase();
        var psiIv = ($optEnvio.data("psi-iv") || $optEnvio.data("psiIv") || "NO").toString().toUpperCase();

        var autorizado = false;
        var tipoNombre = _obtenerNombreTipoControlado(tipo);

        if (tipo === "02" || tipo === "2") {
            autorizado = (prec === "SI" || prec === "Y" || prec === "1");
        } else if (tipo === "03" || tipo === "3") {
            autorizado = (psi === "SI" || psi === "Y" || psi === "1");
        } else if (tipo === "04" || tipo === "4") {
            autorizado = (estu === "SI" || estu === "Y" || estu === "1");
        } else if (tipo === "05" || tipo === "5") {
            autorizado = (psiIv === "SI" || psiIv === "Y" || psiIv === "1");
        }

        return {
            autorizado: autorizado,
            tipo: tipo,
            tipoNombre: tipoNombre
        };
    }

    function mostrarAlertaControladosNoAutorizados(listaErrores, titulo) {
        if (!listaErrores || listaErrores.length === 0) return;

        var htmlTabla = '<div style="max-height:300px; overflow-y:auto; margin-top:10px; text-align:left;">';
        htmlTabla += '<p class="text-danger font-weight-bold" style="font-size:13px; margin-bottom:8px;">' +
            'Los siguientes artículos <strong>NO están autorizados</strong> para ser comercializados en el local / dirección de envío seleccionada:</p>';
        htmlTabla += '<table class="table table-bordered table-striped table-hover mb-0" style="font-size:12px; width:100%;">';
        htmlTabla += '<thead>' +
            '<tr style="background-color:#1ab394; color:white;">' +
            '<th style="background-color:#1ab394; color:white; border-color:#16987e; text-align:center; width:90px;">Código</th>' +
            '<th style="background-color:#1ab394; color:white; border-color:#16987e; text-align:left;">Descripción</th>' +
            '<th style="background-color:#1ab394; color:white; border-color:#16987e; text-align:center; width:130px;">Categoría</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>';

        listaErrores.forEach(function (e) {
            htmlTabla += '<tr>' +
                '<td class="text-center font-weight-bold" style="vertical-align:middle;">' + (e.codigo || "-") + '</td>' +
                '<td style="vertical-align:middle;">' + (e.descripcion || "-") + '</td>' +
                '<td class="text-center" style="vertical-align:middle;"><span class="label label-danger">' + (e.tipo || "Controlado") + '</span></td>' +
                '</tr>';
        });

        htmlTabla += '</tbody></table></div>';

        Swal.fire({
            type: "error",
            title: titulo || "Productos Controlados No Autorizados",
            html: htmlTabla,
            confirmButtonText: "Entendido",
            confirmButtonColor: "#1ab394",
            width: 650
        });
    }

    function validarControladosEnDetalle() {
        const errores = [];
        $("#tblVentaDetalle tbody tr").each(function () {
            const $fila = $(this);
            const codigo = ($fila.find(".txtDetalleCodigo").val() || "").trim();
            if (!codigo) return;

            const descripcion = ($fila.find(".txtDetalleDescripcion").val() || codigo).trim();
            const tipoControlado = ($fila.data("tipocontrolado") || $fila.attr("data-tipocontrolado") || "01").toString().trim();

            const res = validarArticuloControlado(tipoControlado);
            if (!res.autorizado) {
                errores.push({
                    codigo: codigo,
                    descripcion: descripcion,
                    tipo: res.tipoNombre
                });
            }
        });
        return errores;
    }

    function revalidarControladosEnDetalle() {
        if (PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly()) {
            return [];
        }

        const errores = [];

        $("#tblVentaDetalle tbody tr").each(function () {
            const $fila = $(this);
            const codigo = ($fila.find(".txtDetalleCodigo").val() || "").trim();
            if (!codigo) return;

            const descripcion = ($fila.find(".txtDetalleDescripcion").val() || codigo).trim();
            const tipoControlado = ($fila.data("tipocontrolado") || $fila.attr("data-tipocontrolado") || "01").toString().trim();

            const res = validarArticuloControlado(tipoControlado);
            const $txtDesc = $fila.find(".txtDetalleDescripcion");

            if (!res.autorizado) {
                $fila.addClass("fila-error-controlado");
                $txtDesc.css({
                    "background-color": "#ed5565",
                    "color": "#ffffff"
                }).attr("title", "Artículo no autorizado para la dirección de envío seleccionada (" + res.tipoNombre + ")");

                errores.push({
                    codigo: codigo,
                    descripcion: descripcion,
                    tipo: res.tipoNombre
                });
            } else {
                $fila.removeClass("fila-error-controlado");
                $txtDesc.css({
                    "background-color": "",
                    "color": ""
                }).removeAttr("title");
            }
        });

        if (errores.length > 0) {
            mostrarAlertaControladosNoAutorizados(errores, "Artículos no autorizados en dirección de envío");
        }

        return errores;
    }

    function recolectarDetalle(docstatus) {
        const items = [];
        const esBorrador = docstatus === "E";

        $("#tblVentaDetalle tbody tr").each(function () {
            const $fila = $(this);
            const codigo = $fila.find(".txtDetalleCodigo").val();
            if (!codigo) return;

            let cantidad = parseFloat(PV.Detalle.leerCantidadFila($fila));
            if (isNaN(cantidad)) cantidad = 0;

            if (!esBorrador && (!cantidad || cantidad <= 0)) return;

            const stock = parseFloat($fila.find(".txtDetallePorVender").val()) || 0;
            const $ddlUmd = $fila.find(".ddlDetalleUmd");
            const umdEntry = parseInt($ddlUmd.val()) || 0;
            const umdFactor = parseFloat($ddlUmd.find(":selected").data("factor")) || 1;
            const ugpEntry = parseInt($fila.data("ugpentry")) || 0;
            const baseQuantity = cantidad * umdFactor;
            const descuento = parseFloat($fila.find(".txtDetalleDescuento").val()) || 0;
            const regalo = $fila.find(".txtDetalleRegalo").val() || "NO";
            const precioBase = parseFloat($fila.find(".txtDetallePrecio").data("preciobase")) || 0;
            const precioFinal = parseFloat($fila.find(".txtDetallePrecio").val()) || 0;

            const item = {
                ITEMCODE: codigo,
                ITEMNAME: $fila.find(".txtDetalleDescripcion").val() || "",
                CODEBARS: "-",
                QUANTITY: cantidad,
                PRICE: umdFactor ? precioFinal / umdFactor : precioFinal,
                DSCT_PERCENT: cantidad === 0 || !precioBase ? 0 : (descuento / (baseQuantity * precioBase)) * 100,
                IGV_AFECT: ($fila.data("igvafect") || $fila.attr("data-igvafect") || "IGV").toString().trim(),
                LINE_TOTAL: cantidad === 0 ? 0 : cantidad * precioFinal - descuento,
                FORSALE: stock,
                UOMENTRY: umdEntry,
                UMD_NOMBRE: ($ddlUmd.find(":selected").text() || "").trim(),
                QUANTITY_UOM: umdFactor,
                TOTAL_UOM: baseQuantity,
                PRICE_UOM: precioFinal,
                UGPENTRY: ugpEntry,
                PRICE_BEF: precioFinal,
                PRICE_LIST: $("#ddlClienteListaPrecio").val() || "",
                WMS_GIF: regalo,
                WMS_DSC: descuento,
                LOTES: []
            };

            const lotes = $fila.data("lotes");
            if (lotes && Array.isArray(lotes) && lotes.length > 0) {
                item.LOTES = lotes;
            }

            items.push(item);
        });

        return items;
    }

    function recolectarNotasCredito() {
        const notas = [];

        $(".chk-nota-credito:checked").each(function () {
            notas.push(parseInt($(this).val()));
        });

        return notas;
    }

    function recolectarRequest(docstatus) {
        const detalle = recolectarDetalle(docstatus);

        if (detalle.length === 0) {
            Swal.fire({
                type: "warning",
                title: "Sin productos",
                text: "Debe agregar al menos un producto al detalle."
            });
            return null;
        }

        const flete = parseFloat($("#txtVentaFlete").val()) || 0;

        let orinTotal = 0;
        const orinRecordParts = [];

        $(".chk-nota-credito:checked").each(function () {
            const total = parseFloat($(this).data("total")) || 0;
            const docnum = $(this).data("docnum") || "";
            orinTotal += total;
            orinRecordParts.push(`${docnum}.${total}`);
        });

        const descuentoTotal = parseFloat($("#txtVentaDescuento").val()) || 0;
        const descuentoLinea = Math.max(descuentoTotal - orinTotal, 0);
        const neto = parseFloat($("#txtVentaNeto").val()) || 0;

        return {
            OBJTYPE: "17",
            WHSCODE: $("#ddlVentaAlmacen").val() || "",
            BINCODE: 0,
            DOCDATE: $("#txtVentaFechaAtencion").val() || "",
            CARDCODE: $("#txtClienteCodigo").val() || "",
            CARDNAME: $("#txtClienteNombre").val() || "",
            SLPCODE: parseInt($("#ddlVentaVendedor").val()) || 0,
            SLPNAME: $("#ddlVentaVendedor option:selected").text() || "",
            LICTRADNUM: $("#txtClienteRuc").val() || "",
            COMMENTS: ($("#txtLogisticaComentarios").val() || "").trim().substring(0, 254),
            ORIN_TOTAL: orinTotal,
            ORIN_RECORD: orinRecordParts.join(";"),
            IMP_DELIVERY: flete,
            IMP_DSCTO: descuentoLinea,
            IMP_NET: neto,
            DELIVERY_DATE: $("#txtLogisticaFechaEntrega").val() || "",
            DELIVERY_TIME: $("#ddlLogisticaHoraEntrega").val() || "",
            DELIVERY_PLACE: $("#ddlClienteDireccionEnvioId").val() || "",
            DELIVERY_ADDRESS: $("#txtClienteDireccionEnvio").val() || "",
            DELIVERY_ADDRESS2: "",
            DELIVERY_POINT: $("#ddlLogisticaLugarEntrega").val() || "",
            INVOICE_PLACE: $("#ddlClienteDireccionFacturaId").val() || "",
            INVOICE_ADDRESS: $("#txtClienteDireccionFactura").val() || "",
            PRICE_LIST: $("#ddlClienteListaPrecio").val() || "",
            DOCTYPE: $("#ddlFinancieroTipoComprobante").val() || "",
            PAYFORM: $("#ddlFinancieroFormaPago").val() || "",
            AGENCY_DATA: ($("#txtLogisticaAgencia").val() || "").trim().substring(0, 150),
            PACKING_TYPE: $("#ddlLogisticaTipoEmbalaje").val() || "",
            SEND_MODE: $("#ddlLogisticaModoEnvio").val() || "",
            SEND_NDOC: ($("#txtLogisticaRuc").val() || "").replace(/\D/g, "").substring(0, 25),
            SEND_NAME: ($("#txtLogisticaContactoNombre").val() || "").trim().substring(0, 50),
            SEND_PHONE: ($("#txtLogisticaTelefono").val() || "").replace(/\D/g, "").substring(0, 20),
            SEND_PLACE: ($("#txtLogisticaLugarEnvio").val() || "").trim().substring(0, 250),
            DOCENTRY: parseInt($("#hdfDocEntry").val()) || 0,
            DOCENTRY_SAP: parseInt($("#hdfDocEntrySap").val()) || null,
            DOCSTATUS: docstatus || "Z",
            DOCSTATUS_ORIGINAL: $("#hdfDocStatusOriginal").val() || "",
            DETALLE: detalle,
            NOTAS_CREDITO: recolectarNotasCredito()
        };
    }

    function revalidarClienteBloqueado() {
        return new Promise(function (resolve) {
            var carcode = ($("#txtClienteCodigo").val() || "").trim();
            if (!carcode) { resolve(false); return; }
            $.ajax({
                url: "/PuntoVenta/Validar_ClienteBloqueado",
                type: "GET",
                data: { carcode: carcode },
                dataType: "json",
                success: function (data) {
                    if (data && data.bloqueado) {
                        PV._clienteBloqueado = true;
                        PV._motivoBloqueo = data.motivo;
                        resolve(true);
                    } else {
                        PV._clienteBloqueado = false;
                        PV._motivoBloqueo = null;
                        resolve(false);
                    }
                },
                error: function () { resolve(false); }
            });
        });
    }

    function revalidarCreditoCliente() {
        return new Promise(function (resolve) {
            const formaPago = ($("#ddlFinancieroFormaPago option:selected").text() || "").toUpperCase();
            if (formaPago.indexOf("CREDITO") === -1) {
                resolve({ valido: true });
                return;
            }

            const codigoCliente = ($("#txtClienteCodigo").val() || "").trim();
            if (!codigoCliente) {
                resolve({ valido: true });
                return;
            }

            const rawDocEntrySap = $("#hdfDocEntrySap").val();
            const docEntrySap = (rawDocEntrySap && !isNaN(parseInt(rawDocEntrySap, 10)) && parseInt(rawDocEntrySap, 10) > 0)
                ? parseInt(rawDocEntrySap, 10)
                : null;

            $.ajax({
                url: "/PuntoVenta/Buscar_DesgloseCreditoCliente",
                type: "GET",
                data: { codigoCliente: codigoCliente, docEntrySap: docEntrySap },
                dataType: "json",
                success: function (data) {
                    var d = (Array.isArray(data) && data.length > 0) ? data[0] : (data && typeof data === "object" && !Array.isArray(data) ? data : null);
                    if (d) {
                        var disp = (d.DISPONIBLE_EFECTIVO !== undefined)
                            ? d.DISPONIBLE_EFECTIVO
                            : ((d.disponiblE_EFECTIVO !== undefined)
                                ? d.disponiblE_EFECTIVO
                                : ((d.DISPONIBLE !== undefined)
                                    ? d.DISPONIBLE
                                    : d.disponible));

                        if (disp !== undefined && disp !== null) {
                            const nuevoLimite = parseFloat(disp) || 0;
                            $("#txtVentaLimiteCredito").val(nuevoLimite.toFixed(2));

                            if (PV.Detalle && typeof PV.Detalle.verificarAlertaLimiteCredito === "function") {
                                PV.Detalle.verificarAlertaLimiteCredito();
                            }

                            const totalNeto = parseFloat($("#txtVentaNeto").val()) || 0;
                            if (totalNeto > nuevoLimite) {
                                resolve({
                                    valido: false,
                                    mensaje: `El total de la orden (S/ ${totalNeto.toFixed(2)}) supera la línea de crédito disponible actualizada en SAP (S/ ${nuevoLimite.toFixed(2)}).`
                                });
                                return;
                            }
                        }
                    }

                    // Fallback con el valor actual en el input
                    const limiteFallback = parseFloat($("#txtVentaLimiteCredito").val()) || 0;
                    const totalNetoFallback = parseFloat($("#txtVentaNeto").val()) || 0;
                    if (totalNetoFallback > limiteFallback) {
                        resolve({
                            valido: false,
                            mensaje: `La orden (S/ ${totalNetoFallback.toFixed(2)}) supera la línea de crédito del cliente (S/ ${limiteFallback.toFixed(2)}).`
                        });
                        return;
                    }

                    resolve({ valido: true });
                },
                error: function () {
                    const limite = parseFloat($("#txtVentaLimiteCredito").val()) || 0;
                    const total = parseFloat($("#txtVentaNeto").val()) || 0;
                    if (total > limite) {
                        resolve({
                            valido: false,
                            mensaje: `La orden (S/ ${total.toFixed(2)}) supera la línea de crédito del cliente (S/ ${limite.toFixed(2)}).`
                        });
                    } else {
                        resolve({ valido: true });
                    }
                }
            });
        });
    }

    async function guardarVenta() {
        if (!PV.Utils.puedeInteractuar()) return;
        if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur();

        var bloqueado = await revalidarClienteBloqueado();
        if (bloqueado) {
            Swal.fire({
                type: "warning",
                title: "Cliente Bloqueado",
                html: "El cliente seleccionado se encuentra bloqueado.<br><strong>Motivo:</strong> " + (PV._motivoBloqueo || ""),
                confirmButtonText: "Aceptar"
            });
            return;
        }

        const errores = [...validarCabeceraVenta(), ...validarDetalleLotes(), ...validarFraccionadoDetalle()];
        if (errores.length > 0) {
            Swal.fire({
                type: "warning",
                title: "Datos incompletos",
                html: errores.join("<br>"),
                confirmButtonText: "Aceptar"
            });
            return;
        }

        const erroresControlados = validarControladosEnDetalle();
        if (erroresControlados.length > 0) {
            revalidarControladosEnDetalle();
            return;
        }

        const checkCredito = await revalidarCreditoCliente();
        if (!checkCredito.valido) {
            Swal.fire({
                type: "warning",
                title: "Línea de Crédito Excedida",
                text: checkCredito.mensaje || "La orden supera la línea de crédito del cliente.",
                confirmButtonText: "Aceptar"
            });
            return;
        }

        const request = recolectarRequest("Z");
        if (!request) return;

        Swal.fire({
            type: "question",
            title: "¿Guardar venta?",
            text: "Se registrará la venta en el sistema.",
            showCancelButton: true,
            confirmButtonText: "Sí, guardar",
            cancelButtonText: "Cancelar"
        }).then((result) => {
            if (!result.value) return;

            PV.Utils.ejecutarAccion(function (reHabilitar) {
                $("#btnVentaGuardar").prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Guardando...');
                $("#btnVentaBorrador").prop("disabled", true);

                $.ajax({
                    url: "/PuntoVenta/Guardar_Venta",
                    type: "POST",
                    contentType: "application/json",
                    data: JSON.stringify(request),
                    dataType: "json",
                    beforeSend: function () {
                        $("body").addClass("loading");
                    },
                    success: function (response) {
                        if (response.EXITO) {
                            if (PV.DraftManager && typeof PV.DraftManager.eliminarBorradorVentaExitosa === "function") {
                                PV.DraftManager.eliminarBorradorVentaExitosa();
                            }
                            Swal.fire({
                                type: "success",
                                title: "Venta registrada",
                                html: `Venta N° <strong>${response.DOCENTRY}</strong> registrada correctamente.`,
                                confirmButtonText: "Aceptar"
                            }).then(function () {
                                PV.confirmarGuardado();
                                limpiarFormulario(true);
                                activarTabBusqueda();
                            });
                        } else {
                            Swal.fire({
                                type: "error",
                                title: "Error",
                                text: response.MENSAJE || "No se pudo registrar la venta."
                            });
                        }
                    },
                    error: function (xhr) {
                        if (typeof esErrorSesion === "function" && esErrorSesion(xhr) || xhr && (xhr.status === 401 || xhr.status === 403 || (xhr.getResponseHeader && xhr.getResponseHeader('X-Session-Expired') === 'true'))) return;
                        let msg = "Error al guardar la venta.";

                        if (xhr.responseJSON) {
                            if (typeof xhr.responseJSON === "string") {
                                msg = xhr.responseJSON;
                            } else if (xhr.responseJSON.error) {
                                msg = xhr.responseJSON.error;
                            } else if (xhr.responseJSON.MENSAJE) {
                                msg = xhr.responseJSON.MENSAJE;
                            } else if (xhr.responseJSON.mensaje) {
                                msg = xhr.responseJSON.mensaje;
                            }
                        } else if (xhr.responseText) {
                            try {
                                const parsed = JSON.parse(xhr.responseText);
                                msg = parsed.error || parsed.MENSAJE || parsed.mensaje || xhr.responseText;
                            } catch (e) {
                                msg = xhr.responseText;
                            }
                        }

                        Swal.fire({
                            type: "warning",
                            title: "No se puede guardar",
                            text: msg
                        });
                    },
                    complete: function () {
                        $("body").removeClass("loading");
                        $("#btnVentaGuardar").prop("disabled", false).html('<i class="fa fa-save"></i> Guardar Venta');
                        $("#btnVentaBorrador").prop("disabled", false);
                        reHabilitar();
                    }
                });
            });
        });
    }

    async function guardarBorrador() {
        if (!PV.Utils.puedeInteractuar()) return;
        if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur();

        var bloqueado = await revalidarClienteBloqueado();
        if (bloqueado) {
            Swal.fire({
                type: "warning",
                title: "Cliente Bloqueado",
                html: "El cliente seleccionado se encuentra bloqueado.<br><strong>Motivo:</strong> " + (PV._motivoBloqueo || ""),
                confirmButtonText: "Aceptar"
            });
            return;
        }

        const errores = validarCabeceraVenta();
        if (errores.length > 0) {
            Swal.fire({
                type: "warning",
                title: "Campos requeridos",
                html: errores.map(e => `<div>${e}</div>`).join("")
            });
            return;
        }

        const erroresFraccionado = validarFraccionadoDetalle();
        if (erroresFraccionado.length > 0) {
            Swal.fire({
                type: "warning",
                title: "Validación de artículos",
                html: erroresFraccionado.map(e => `<div>${e}</div>`).join("")
            });
            return;
        }

        const checkCredito = await revalidarCreditoCliente();
        if (!checkCredito.valido) {
            Swal.fire({
                type: "warning",
                title: "Línea de Crédito Excedida",
                text: checkCredito.mensaje || "La orden supera la línea de crédito del cliente."
            });
            return;
        }

        Swal.fire({
            title: "¿Guardar borrador?",
            text: "Se guardará el borrador de la venta.",
            type: "question",
            showCancelButton: true,
            confirmButtonText: "Sí, guardar",
            cancelButtonText: "Cancelar"
        }).then(function (result) {
            if (!result.value) return;

            const datosVenta = recolectarRequest("E");
            if (!datosVenta) return;

            PV.Utils.ejecutarAccion(function (reHabilitar) {
                $("#btnVentaBorrador").prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Guardando...');
                $("#btnVentaGuardar").prop("disabled", true);

                $.ajax({
                    url: "/PuntoVenta/Guardar_Venta",
                    type: "POST",
                    contentType: "application/json",
                    data: JSON.stringify(datosVenta),
                    dataType: "json",
                    beforeSend: function () {
                        $("body").addClass("loading");
                    },
                    success: function (response) {
                        if (response.EXITO) {
                            if (PV.DraftManager && typeof PV.DraftManager.eliminarBorradorVentaExitosa === "function") {
                                PV.DraftManager.eliminarBorradorVentaExitosa();
                            }
                            Swal.fire({
                                type: "success",
                                title: "Borrador guardado",
                                html: `Borrador N° <strong>${response.DOCENTRY}</strong> guardado correctamente.`,
                                confirmButtonText: "Aceptar"
                            }).then(function () {
                                PV.confirmarGuardado();
                                limpiarFormulario(true);
                                activarTabBusqueda();
                            });
                        } else {
                            Swal.fire({
                                type: "error",
                                title: "Error",
                                text: response.MENSAJE || "No se pudo guardar el borrador."
                            });
                        }
                    },
                    error: function (xhr) {
                        if (typeof esErrorSesion === "function" && esErrorSesion(xhr) || xhr && (xhr.status === 401 || xhr.status === 403 || (xhr.getResponseHeader && xhr.getResponseHeader('X-Session-Expired') === 'true'))) return;
                        let msg = "Error al guardar el borrador.";
                        if (xhr.responseJSON && xhr.responseJSON.error) {
                            msg = xhr.responseJSON.error;
                        }
                        Swal.fire({
                            type: "warning",
                            title: "No se puede guardar",
                            text: msg
                        });
                    },
                    complete: function () {
                        $("body").removeClass("loading");
                        $("#btnVentaBorrador").prop("disabled", false).html('<i class="fa fa-file-text-o"></i> Guardar Borrador');
                        $("#btnVentaGuardar").prop("disabled", false);
                        reHabilitar();
                    }
                });
            });
        });
    }

    function limpiarFormulario(esGuardadoExitoso = false) {
        if (esGuardadoExitoso) {
            if (PV.DraftManager && typeof PV.DraftManager.limpiarPestanaSinGuardar === "function") {
                PV.DraftManager.limpiarPestanaSinGuardar();
            }
        } else {
            var eraReadOnly = PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly();
            var teniaDocEntry = !!(($("#hdfDocEntry").val() || "").trim() || ($("#hdfDocEntrySap").val() || "").trim());

            if (eraReadOnly || teniaDocEntry) {
                if (PV.DraftManager && typeof PV.DraftManager.limpiarPestanaSinGuardar === "function") {
                    PV.DraftManager.limpiarPestanaSinGuardar();
                }
            } else {
                if (PV.DraftManager && typeof PV.DraftManager.desvincularBorradorPestana === "function") {
                    PV.DraftManager.desvincularBorradorPestana();
                }
            }
        }

        PV.Detalle.setFormReadOnly(false);
        PV.confirmarGuardado();
        PV.Cliente.limpiarSeleccionCliente();

        $("#tab-logistica input:not(#txtLogisticaFechaEntrega), #tab-logistica textarea").val("");
        $("#tab-logistica select").each(function () {
            var $s = $(this);
            if ($s.attr("id") === "ddlLogisticaLugarEntrega") {
                $s.val("CENTRO");
            } else if ($s.attr("id") !== "ddlLogisticaHoraEntrega") {
                $s.val($s.find("option:first").val());
            }
        });
        $("#tab-financiero input, #tab-financiero textarea").val("");
        $("#tab-financiero select").each(function () {
            var $s = $(this);
            $s.val($s.attr("id") === "ddlFinancieroTipoComprobante" ? "01" : $s.find("option:first").val());
        });

        $("#ddlVentaVendedor, #ddlVentaAlmacen, #ddlClienteListaPrecio").val(function () {
            return $(this).find("option:first").val();
        });

        var $tbody = $("#tblVentaDetalle tbody");
        $tbody.find("tr").each(function () {
            $(this).removeData("lotes");
        });
        $tbody.empty();
        PV.Detalle.agregarFilaDetalleVacia();
        PV.Detalle.recalcularTotales();

        $(".chk-nota-credito").prop("checked", false);
        $("#hdfDocEntry").val("");
        $("#hdfDocEntrySap").val("");
        $("#hdfDocStatusOriginal").val("");

        $("#txtVentaFechaAtencion, #txtLogisticaFechaEntrega").each(function () {
            var fp = this._flatpickr;
            if (fp) {
                fp.set("minDate", "today");
                fp.setDate("today", true);
            }
        });

        if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
            PV.Catalogos.actualizarEstadoHorasEntrega(true);
        }
        if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoLugarEnvio === "function") {
            PV.Catalogos.actualizarEstadoLugarEnvio({ esLimpieza: true });
        }
        if (PV.Detalle && typeof PV.Detalle.resetearFlete === "function") {
            PV.Detalle.resetearFlete(0);
        }

        if (PV.Core && typeof PV.Core.conmutarTab === "function") {
            PV.Core.conmutarTab("#tab-cliente");
        } else {
            $('a[href="#tab-cliente"]').tab("show");
        }
    }

    function enfocarCliente() {
        if (PV.Core && typeof PV.Core.conmutarTab === "function") {
            PV.Core.conmutarTab("#tab-cliente");
        } else {
            $('a[href="#tab-cliente"]').tab("show");
        }

        var $input = $("#txtClienteNombre");
        if ($input.length === 0) return;

        $input.removeAttr("tabindex").prop("disabled", false).prop("readonly", false);
        setTimeout(function () {
            $input.focus();
        }, 50);
    }

    function activarTabBusqueda() {
        if (PV.Core && typeof PV.Core.conmutarTab === "function") {
            PV.Core.conmutarTab("#tab-1");
        } else {
            $('a[href="#tab-1"]').tab("show");
        }
        if (typeof buscarVentas === "function") {
            buscarVentas();
        }
    }

    var _workbookExcel = null;
    var _datosExcel = [];

    function abrirModalImportarExcel() {
        if (!validarClienteSeleccionadoParaDetalle()) return;
        if (PV.Utils.modalAbierto("#modalImportarExcel")) return;
        _workbookExcel = null;
        _datosExcel = [];
        $("#fileImportarExcel").val("");
        $("#lblArchivoExcel").text("Seleccionar archivo...");
        $("#ddlImportarHoja").empty().append('<option value="">-- Seleccionar hoja --</option>');
        $("#divSeleccionHoja").hide();
        $("#divVistaPrevia").hide();
        $("#tblVistaPreviaExcel tbody").empty();
        $("#lblTotalFilasExcel").text("");
        $("#modalImportarExcel").modal("show");
    }

    function procesarArchivoExcel(input) {
        var archivo = input.files[0];
        if (!archivo) return;

        $("#lblArchivoExcel").text(archivo.name);
        $("#divVistaPrevia").hide();
        $("#tblVistaPreviaExcel tbody").empty();
        _datosExcel = [];

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = new Uint8Array(e.target.result);
                _workbookExcel = XLSX.read(data, { type: "array" });

                var hojas = _workbookExcel.SheetNames;

                var $ddl = $("#ddlImportarHoja");
                $ddl.empty().append('<option value="">-- Seleccionar hoja --</option>');
                hojas.forEach(function (nombre) {
                    $ddl.append('<option value="' + nombre + '">' + nombre + '</option>');
                });

                if (hojas.length === 1) {
                    $ddl.val(hojas[0]);
                    $("#divSeleccionHoja").hide();
                    cargarHojaExcel();
                } else {
                    $("#divSeleccionHoja").show();
                }
            } catch (err) {
                Swal.fire({ type: "error", title: "Error al leer archivo", text: err.message });
            }
        };
        reader.readAsArrayBuffer(archivo);
    }

    function cargarHojaExcel() {
        var nombreHoja = $("#ddlImportarHoja").val();
        if (!_workbookExcel || !nombreHoja) return;

        var sheet = _workbookExcel.Sheets[nombreHoja];
        var json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        _datosExcel = [];
        for (var i = 1; i < json.length; i++) {
            var fila = json[i];
            var codigo = (fila[0] || "").toString().trim();
            var cantidad = parseFloat(fila[2]) || 0;

            if (codigo && cantidad > 0) {
                _datosExcel.push({ codigo: codigo, cantidad: cantidad, fila: i + 1 });
            }
        }

        var $tbody = $("#tblVistaPreviaExcel tbody").empty();
        var maxVista = Math.min(_datosExcel.length, 10);
        for (var j = 0; j < maxVista; j++) {
            var item = _datosExcel[j];
            $tbody.append(
                '<tr><td class="text-center">' + item.fila + '</td>' +
                '<td>' + item.codigo + '</td>' +
                '<td class="text-right">' + item.cantidad + '</td></tr>'
            );
        }

        $("#lblTotalFilasExcel").text("Total de filas a importar: " + _datosExcel.length +
            (_datosExcel.length > 10 ? " (mostrando primeras 10)" : ""));
        $("#divVistaPrevia").show();
    }

    function importarArticulosExcel() {
        if (PV.Utils._procesando) return;
        if (_datosExcel.length === 0) {
            Swal.fire({ type: "warning", title: "Sin datos", text: "No hay filas válidas para importar." });
            return;
        }

        var listaPrecio = $("#ddlClienteListaPrecio").val();
        var almacen = $("#ddlVentaAlmacen").val();
        var cliente = ($("#txtClienteCodigo").val() || "").trim();

        if (!listaPrecio || !almacen) {
            Swal.fire({ type: "warning", title: "Datos requeridos", text: "Debe seleccionar una lista de precios y un almacén." });
            return;
        }

        $("#modalImportarExcel").modal("hide");
        PV.Utils._procesando = true;

        var total = _datosExcel.length;
        PV.Utils.mostrarModalProgreso("Importando artículos...", "Consultando artículos desde SAP...", total);

        var itemsParaConsultar = _datosExcel.map(function (it) {
            return {
                CodigoArticulo: it.codigo,
                CodigoUmd: null
            };
        });

        PV.Detalle.cargarDetalleArticulosVentaBatch(itemsParaConsultar, listaPrecio, almacen, cliente, function (dictResultados) {
            var exitosos = 0;
            var errores = [];
            var index = 0;
            var batchSize = 10;

            function procesarLoteExcel() {
                var limite = Math.min(index + batchSize, total);
                for (; index < limite; index++) {
                    var itemActual = _datosExcel[index];
                    var codUpper = (itemActual.codigo || "").toUpperCase();
                    var data = dictResultados[codUpper];

                    if (data && data.ARTICULO) {
                        var checkControlado = validarArticuloControlado(data.ARTICULO.TIPO_CONTROLADO);
                        if (!checkControlado.autorizado) {
                            errores.push({
                                fila: itemActual.fila,
                                codigo: itemActual.codigo,
                                error: "No autorizado en dirección de envío (" + checkControlado.tipoNombre + ")"
                            });
                            continue;
                        }

                        var $filaVacia = $("#tblVentaDetalle tbody tr").filter(function () {
                            return !$(this).attr("data-itemcode");
                        }).first();

                        if ($filaVacia.length === 0) {
                            $filaVacia = PV.Detalle.agregarFilaDetalleVacia();
                        }

                        PV.Detalle.llenarFilaDetalleDesdeDetalleVenta($filaVacia, data, {
                            cantidad: itemActual.cantidad,
                            mantenerFoco: true,
                            omitirAsegurarFilaFinal: true,
                            omitirRecalcularTotales: true,
                            omitirFechasVencimientoAjax: true,
                            omitirFraccionadoAjax: true
                        });
                        exitosos++;
                    } else {
                        errores.push({
                            fila: itemActual.fila,
                            codigo: itemActual.codigo,
                            error: "Artículo no encontrado"
                        });
                    }
                }

                PV.Utils.actualizarModalProgreso(index, total, _datosExcel[index - 1] ? _datosExcel[index - 1].codigo : "");

                if (index < total) {
                    setTimeout(procesarLoteExcel, 10);
                } else {
                    PV.Utils.actualizarModalProgreso(total, total, "Completado");
                    PV.Detalle.recalcularTotales();
                    PV.Detalle.agregarFilaDetalleVacia();
                    PV.Utils.cerrarModalProgreso(400, function () {
                        finalizarImportacion(exitosos, errores);
                    });
                }
            }

            procesarLoteExcel();
        }, function (xhr) {
            PV.Utils._procesando = false;
            PV.Utils.cerrarModalProgreso(100);
            Swal.fire({
                type: "error",
                title: "Error al importar",
                text: "No se pudieron obtener los datos de los artículos desde SAP."
            });
        });
    }

    function finalizarImportacion(exitosos, errores) {
        PV.Utils._procesando = false;
        if (Swal.isVisible()) Swal.close();

        if (errores.length === 0) {
            Swal.fire({
                type: "success",
                title: "Importación completada",
                html: "Se importaron <strong>" + exitosos + "</strong> artículos correctamente.",
                confirmButtonText: "Aceptar"
            });
        } else {
            var htmlErrores = '<div style="max-height:300px;overflow:auto;text-align:left">';
            htmlErrores += '<p><strong>Importados:</strong> ' + exitosos + ' | <strong>Con observaciones / errores:</strong> ' + errores.length + '</p>';
            htmlErrores += '<table class="table table-sm table-bordered table-striped mb-0" style="font-size:12px">';
            htmlErrores += '<thead><tr style="background-color:#1ab394;color:white;"><th style="background-color:#1ab394;color:white;width:60px;text-align:center;border-color:#16987e;">Fila</th><th style="background-color:#1ab394;color:white;border-color:#16987e;">Código</th><th style="background-color:#1ab394;color:white;border-color:#16987e;">Observación</th></tr></thead><tbody>';
            errores.forEach(function (e) {
                htmlErrores += '<tr><td class="text-center">' + e.fila + '</td><td><b>' + e.codigo + '</b></td><td class="text-danger">' + e.error + '</td></tr>';
            });
            htmlErrores += '</tbody></table></div>';

            Swal.fire({
                type: "warning",
                title: "Importación con observaciones",
                html: htmlErrores,
                confirmButtonText: "Aceptar",
                width: 600
            });
        }

        PV.Detalle.recalcularTotales();
    }

    return {
        inicializar: inicializar,
        validarCabeceraVenta: validarCabeceraVenta,
        guardarVenta: guardarVenta,
        guardarBorrador: guardarBorrador,
        validarClienteSeleccionadoParaDetalle: validarClienteSeleccionadoParaDetalle,
        validarArticuloControlado: validarArticuloControlado,
        mostrarAlertaControladosNoAutorizados: mostrarAlertaControladosNoAutorizados,
        validarControladosEnDetalle: validarControladosEnDetalle,
        revalidarControladosEnDetalle: revalidarControladosEnDetalle
    };

})();
