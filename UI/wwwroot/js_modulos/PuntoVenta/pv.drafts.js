window.PV = window.PV || {};

/**
 * PV.DraftManager
 * Administrador de autoguardado local y recuperación de ventas multi-pestaña.
 * Protege contra pérdidas por caídas de red, reinicio de IIS, reciclaje de sesión o cierres de navegador.
 * Soporta ventas nuevas, borradores de BD y órdenes reabiertas desde SAP con preservación de ID y estado.
 */
PV.DraftManager = (function () {

    const STORAGE_KEY = "CBF_PV_DRAFTS_V1";
    const SESSION_TAB_KEY = "CBF_PV_TAB_ID";
    const SESSION_DRAFT_KEY = "CBF_PV_CURRENT_DRAFT_ID";
    const DEBOUNCE_DELAY_MS = 800;

    let _debounceTimer = null;
    let _tabId = null;
    let _currentDraftId = null;
    let _autoSaveHabilitado = true;
    let _restaurandoBorrador = false;

    // Obtener usuario autenticado de forma unificada
    function _obtenerUsuarioActual() {
        let u = "";
        try {
            if (typeof $ !== "undefined" && $.session && typeof $.session.get === "function") {
                u = $.session.get("SESSION_USUARIO") || "";
            }
        } catch (e) {}

        if (!u) {
            u = sessionStorage.getItem("SESSION_USUARIO") || localStorage.getItem("CBF_PV_SESSION_ACTIVE_USER") || "";
        }
        return (u || "").trim().toLowerCase();
    }

    // Inicializar identificadores de sesión / pestaña
    function _obtenerTabId() {
        if (!_tabId) {
            _tabId = sessionStorage.getItem(SESSION_TAB_KEY);
            if (!_tabId) {
                _tabId = "TAB_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
                sessionStorage.setItem(SESSION_TAB_KEY, _tabId);
            }
        }
        return _tabId;
    }

    function _obtenerCurrentDraftId() {
        if (!_currentDraftId) {
            _currentDraftId = sessionStorage.getItem(SESSION_DRAFT_KEY);
            if (!_currentDraftId) {
                _currentDraftId = "DRAFT_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
                sessionStorage.setItem(SESSION_DRAFT_KEY, _currentDraftId);
            }
        }
        return _currentDraftId;
    }

    function _setCurrentDraftId(draftId) {
        _currentDraftId = draftId;
        if (draftId) {
            sessionStorage.setItem(SESSION_DRAFT_KEY, draftId);
        } else {
            sessionStorage.removeItem(SESSION_DRAFT_KEY);
        }
    }

    function _obtenerTodosBorradores() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.error("Error al leer borradores de localStorage", e);
            return {};
        }
    }

    function _guardarTodosBorradores(mapa) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
        } catch (e) {
            console.error("Error al guardar borradores en localStorage", e);
        }
    }

    // Purgar borradores viejos (> 7 días)
    function _purgarBorradoresViejos() {
        try {
            const mapa = _obtenerTodosBorradores();
            const limite = Date.now() - (7 * 24 * 60 * 60 * 1000);
            let cambios = false;

            for (const key in mapa) {
                if (mapa.hasOwnProperty(key)) {
                    const item = mapa[key];
                    const mod = item.fechaModificacion ? new Date(item.fechaModificacion).getTime() : 0;
                    if (mod < limite) {
                        delete mapa[key];
                        cambios = true;
                    }
                }
            }
            if (cambios) {
                _guardarTodosBorradores(mapa);
            }
        } catch (e) {
            console.warn("Error purgando borradores viejos", e);
        }
    }

    // Recolectar datos actuales del formulario de venta
    function recolectarEstadoActual() {
        if (PV.Detalle && PV.Detalle.isReadOnly()) {
            return null;
        }

        const docEntryVal = parseInt($("#hdfDocEntry").val()) || 0;
        const docEntrySapVal = parseInt($("#hdfDocEntrySap").val()) || 0;
        const docStatusOriginalVal = ($("#hdfDocStatusOriginal").val() || "").trim();

        const clienteCodigo = ($("#txtClienteCodigo").val() || "").trim();
        const clienteNombre = ($("#txtClienteNombre").val() || "").trim();
        const $filas = $("#tblVentaDetalle tbody tr");
        const items = [];

        $filas.each(function () {
            const $fila = $(this);
            const codigo = ($fila.find(".txtDetalleCodigo").val() || "").trim();
            if (!codigo) return;

            const desc = ($fila.find(".txtDetalleDescripcion").val() || "").trim();
            const $ddlUmd = $fila.find(".ddlDetalleUmd");
            const umdEntry = parseInt($ddlUmd.val()) || 0;
            const umdNombre = ($ddlUmd.find("option:selected").text() || "").trim();
            const factor = parseFloat($ddlUmd.find("option:selected").data("factor")) || 1;
            const cantidad = parseFloat(PV.Detalle.leerCantidadFila($fila)) || 0;
            const stock = parseFloat($fila.find(".txtDetalleStock").val()) || 0;
            const porVender = parseFloat($fila.find(".txtDetallePorVender").val()) || 0;
            const precio = parseFloat($fila.find(".txtDetallePrecio").val()) || 0;
            const total = parseFloat($fila.find(".txtDetalleTotal").val()) || 0;
            const descuento = parseFloat($fila.find(".txtDetalleDescuento").val()) || 0;
            const regalo = ($fila.find(".ddlDetalleRegalo").val() || "NO").toUpperCase();
            const lotes = $fila.data("lotes") || [];

            items.push({
                ITEMCODE: codigo,
                ITEMNAME: desc,
                QUANTITY: cantidad,
                PRICE: precio,
                LINETOTAL: total,
                ONHAND: stock,
                FORSALE: porVender,
                UOMENTRY: umdEntry,
                UMD_NOMBRE: umdNombre,
                QUANTITY_UOM: factor,
                WMS_DSC: descuento,
                WMS_GIF: regalo,
                LOTES: lotes
            });
        });

        if (!clienteCodigo && !clienteNombre && items.length === 0) {
            return null;
        }

        const usuarioActual = _obtenerUsuarioActual() || "DESCONOCIDO";

        const flete = parseFloat($("#txtVentaFlete").val()) || 0;
        const descuento = parseFloat($("#txtVentaDescuento").val()) || 0;
        const totalVenta = parseFloat($("#txtVentaTotal").val()) || 0;
        const subtotal = parseFloat($("#txtVentaSubTotal").val()) || 0;
        const igv = parseFloat($("#txtVentaIgv").val()) || 0;

        let tipoOrigen = "NUEVA";
        if (docEntryVal > 0) {
            tipoOrigen = (docEntrySapVal > 0 || docStatusOriginalVal === "C") ? "REABIERTA_SAP" : "BORRADOR_BD";
        }

        return {
            draftId: _obtenerCurrentDraftId(),
            tabId: _obtenerTabId(),
            usuario: usuarioActual,
            fechaCreacion: new Date().toISOString(),
            fechaModificacion: new Date().toISOString(),
            resumen: {
                docEntry: docEntryVal,
                docEntrySap: docEntrySapVal,
                docStatusOriginal: docStatusOriginalVal,
                tipoOrigen: tipoOrigen,
                clienteCodigo: clienteCodigo,
                clienteNombre: clienteNombre,
                clienteRuc: ($("#txtClienteRuc").val() || "").trim(),
                almacen: $("#ddlVentaAlmacen").val() || "",
                almacenNombre: $("#ddlVentaAlmacen option:selected").text() || "",
                listaPrecio: $("#ddlClienteListaPrecio").val() || "",
                totalArticulos: items.length,
                montoTotal: totalVenta,
                comentarios: ($("#txtLogisticaComentarios").val() || "").trim()
            },
            datosVenta: {
                DOCENTRY: docEntryVal,
                DOCENTRY_SAP: docEntrySapVal,
                DOCSTATUS_ORIGINAL: docStatusOriginalVal,
                OBJTYPE: "17",
                WHSCODE: $("#ddlVentaAlmacen").val() || "",
                CARDCODE: clienteCodigo,
                CARDNAME: clienteNombre,
                LICTRADNUM: ($("#txtClienteRuc").val() || "").trim(),
                SLPCODE: parseInt($("#ddlVentaVendedor").val()) || 0,
                SLPNAME: $("#ddlVentaVendedor option:selected").text() || "",
                PRICE_LIST: $("#ddlClienteListaPrecio").val() || "",
                DOCTYPE: $("#ddlFinancieroTipoComprobante").val() || "",
                PAYFORM: $("#ddlFinancieroFormaPago").val() || "",
                COMMENTS: ($("#txtLogisticaComentarios").val() || "").trim(),
                IMP_DELIVERY: flete,
                IMP_DSCTO: descuento,
                IMP_NET: subtotal,
                IMP_IGV: igv,
                IMP_TOTAL: totalVenta,
                DELIVERY_DATE: $("#txtLogisticaFechaEntrega").val() || "",
                DELIVERY_TIME: $("#ddlLogisticaHoraEntrega").val() || "",
                DELIVERY_PLACE: $("#ddlClienteDireccionEnvioId").val() || "",
                DELIVERY_ADDRESS: $("#txtClienteDireccionEnvio").val() || "",
                DELIVERY_POINT: $("#ddlLogisticaLugarEntrega").val() || "",
                INVOICE_PLACE: $("#ddlClienteDireccionFacturaId").val() || "",
                INVOICE_ADDRESS: $("#txtClienteDireccionFactura").val() || "",
                AGENCY_DATA: ($("#txtLogisticaAgencia").val() || "").trim(),
                PACKING_TYPE: $("#ddlLogisticaTipoEmbalaje").val() || "",
                SEND_MODE: $("#ddlLogisticaModoEnvio").val() || "",
                SEND_NDOC: ($("#txtLogisticaRuc").val() || "").trim(),
                SEND_NAME: ($("#txtLogisticaContactoNombre").val() || "").trim(),
                SEND_PHONE: ($("#txtLogisticaTelefono").val() || "").trim(),
                SEND_PLACE: ($("#txtLogisticaLugarEnvio").val() || "").trim(),
                DETALLE: items
            }
        };
    }

    function guardarBorradorActual(silencioso = true) {
        if (!_autoSaveHabilitado || _restaurandoBorrador) return;
        if (PV.Detalle && PV.Detalle.isReadOnly()) return;

        const estado = recolectarEstadoActual();
        const mapa = _obtenerTodosBorradores();
        const draftId = _obtenerCurrentDraftId();

        if (!estado) {
            _mostrarEstadoAutoSave("");
            return;
        }

        if (mapa[draftId] && mapa[draftId].fechaCreacion) {
            estado.fechaCreacion = mapa[draftId].fechaCreacion;
        }

        mapa[draftId] = estado;
        _guardarTodosBorradores(mapa);
        actualizarBadgeBorradores();

        const hora = new Date().toLocaleTimeString();
        _mostrarEstadoAutoSave(`<i class="fa fa-check text-success mr-1"></i> Borrador guardado localmente (${hora})`);
    }

    function notificarCambio() {
        if (!_autoSaveHabilitado || _restaurandoBorrador) return;
        if (PV.Detalle && PV.Detalle.isReadOnly()) return;

        _mostrarEstadoAutoSave('<i class="fa fa-spinner fa-spin text-muted mr-1"></i> Guardando cambios...');

        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(function () {
            guardarBorradorActual(true);
        }, DEBOUNCE_DELAY_MS);
    }

    function _mostrarEstadoAutoSave(html) {
        $("#lblAutoSaveStatus").html(html);
    }

    function listarBorradores() {
        const mapa = _obtenerTodosBorradores();
        const lista = [];
        const usuarioActual = _obtenerUsuarioActual();

        for (const key in mapa) {
            if (mapa.hasOwnProperty(key)) {
                const b = mapa[key];
                if (b.usuario && usuarioActual && b.usuario.toLowerCase() === usuarioActual) {
                    lista.push(b);
                }
            }
        }

        lista.sort(function (a, b) {
            return new Date(b.fechaModificacion) - new Date(a.fechaModificacion);
        });

        return lista;
    }

    function eliminarBorrador(draftId, callback) {
        const mapa = _obtenerTodosBorradores();
        if (mapa[draftId]) {
            delete mapa[draftId];
            _guardarTodosBorradores(mapa);
        }

        if (_currentDraftId === draftId) {
            _setCurrentDraftId(null);
            _mostrarEstadoAutoSave("");
        }

        actualizarBadgeBorradores();
        if (typeof callback === "function") callback();
    }

    function eliminarBorradoresMultiples(draftIds, callback) {
        if (!Array.isArray(draftIds) || draftIds.length === 0) return;

        const mapa = _obtenerTodosBorradores();
        draftIds.forEach(function (id) {
            if (mapa[id]) {
                delete mapa[id];
            }
            if (_currentDraftId === id) {
                _setCurrentDraftId(null);
                _mostrarEstadoAutoSave("");
            }
        });

        _guardarTodosBorradores(mapa);
        actualizarBadgeBorradores();
        if (typeof callback === "function") callback();
    }

    function eliminarTodosBorradores(callback) {
        const usuarioActual = (typeof $ !== 'undefined' && $.session && $.session.get('SESSION_USUARIO'))
            || sessionStorage.getItem('SESSION_USUARIO') || "";

        const mapa = _obtenerTodosBorradores();
        for (const key in mapa) {
            if (mapa.hasOwnProperty(key)) {
                const b = mapa[key];
                if (!usuarioActual || !b.usuario || b.usuario.toLowerCase() === usuarioActual.toLowerCase()) {
                    delete mapa[key];
                }
            }
        }

        _guardarTodosBorradores(mapa);
        _setCurrentDraftId(null);
        _mostrarEstadoAutoSave("");
        actualizarBadgeBorradores();
        if (typeof callback === "function") callback();
    }

    // Al limpiar formulario:
    // Asegura el borrador de la venta actual en localStorage y genera un nuevo draftId para la pestaña
    function desvincularBorradorPestana() {
        if (PV.Detalle && PV.Detalle.isReadOnly()) {
            limpiarPestanaSinGuardar();
            return;
        }

        guardarBorradorActual(true);
        _setCurrentDraftId(null); // Generará uno nuevo en el siguiente cambio
        _mostrarEstadoAutoSave("");
        actualizarBadgeBorradores();
    }

    function limpiarPestanaSinGuardar() {
        clearTimeout(_debounceTimer);
        _setCurrentDraftId(null);
        _mostrarEstadoAutoSave("");
        actualizarBadgeBorradores();
    }

    // Solo al emitir venta o borrador exitoso en BD: se elimina definitivamente de los borradores locales
    function eliminarBorradorVentaExitosa() {
        clearTimeout(_debounceTimer);
        const draftId = _currentDraftId || sessionStorage.getItem(SESSION_DRAFT_KEY);
        if (draftId) {
            eliminarBorrador(draftId);
        }
        _setCurrentDraftId(null);
        _mostrarEstadoAutoSave("");
        actualizarBadgeBorradores();
    }

    function restaurarBorrador(draftId) {
        const mapa = _obtenerTodosBorradores();
        const borrador = mapa[draftId];

        if (!borrador || !borrador.datosVenta) {
            Swal.fire({
                type: "warning",
                title: "Borrador no encontrado",
                text: "No se pudo recuperar la información del borrador seleccionado."
            });
            return;
        }

        _restaurandoBorrador = true;
        _setCurrentDraftId(draftId);

        try {
            $('a[data-pv-tab="main"][href="#tab-2"]').tab("show");

            const datos = borrador.datosVenta;
            cargarVentaEditable(datos, "BORRADOR_LOCAL", "LOCAL");

            $("#modalBorradoresLocales").modal("hide");

            const tipoDesc = (borrador.resumen.docEntry > 0)
                ? (borrador.resumen.docStatusOriginal === "C" ? `Orden Reabierta N° ${borrador.resumen.docEntry}` : `Borrador BD N° ${borrador.resumen.docEntry}`)
                : "Borrador Local";

            Swal.fire({
                type: "success",
                title: `${tipoDesc} Restaurado`,
                html: `Se restauró la venta de <strong>${borrador.resumen.clienteNombre || 'Cliente sin nombre'}</strong> con <strong>${borrador.resumen.totalArticulos}</strong> artículos.`,
                timer: 2500,
                showConfirmButton: false
            });

            setTimeout(function () {
                _restaurandoBorrador = false;
                guardarBorradorActual(true);
            }, 1000);

        } catch (e) {
            _restaurandoBorrador = false;
            console.error("Error al restaurar borrador", e);
            Swal.fire({
                type: "error",
                title: "Error al restaurar",
                text: "Ocurrió un error al intentar cargar el borrador seleccionado."
            });
        }
    }

    function actualizarBadgeBorradores() {
        const lista = listarBorradores();
        const count = lista.length;
        const $badge = $("#badgeBorradoresCount");

        if (count > 0) {
            $badge.text(count).show();
            $("#btnBorradoresLocales").removeClass("d-none");
        } else {
            $badge.text("0").hide();
        }
    }

    function _actualizarEstadoSeleccionModal() {
        const seleccionados = $(".chk-borrador-item:checked").length;
        const total = $(".chk-borrador-item").length;

        $("#lblCountSeleccionados").text(seleccionados);
        $("#btnEliminarBorradoresSeleccionados").prop("disabled", seleccionados === 0);
        $("#chkSeleccionarTodosBorradores").prop("checked", total > 0 && seleccionados === total);
    }

    function abrirModalBorradores() {
        const lista = listarBorradores();
        const $tbody = $("#tblBorradoresLocales tbody");
        $tbody.empty();
        $("#chkSeleccionarTodosBorradores").prop("checked", false);
        $("#btnEliminarBorradoresSeleccionados").prop("disabled", true);
        $("#lblCountSeleccionados").text("0");

        if (lista.length === 0) {
            $tbody.html('<tr><td colspan="8" class="text-center text-muted p-4"><i class="fa fa-info-circle mr-1"></i> No hay borradores de venta guardados localmente.</td></tr>');
            $("#btnEliminarTodosBorradores").prop("disabled", true);
        } else {
            $("#btnEliminarTodosBorradores").prop("disabled", false);
            lista.forEach(function (b, idx) {
                const fecha = new Date(b.fechaModificacion).toLocaleString();
                const totalFmt = (parseFloat(b.resumen.montoTotal) || 0).toFixed(2);
                const esEstaPestana = (b.draftId === _currentDraftId);
                const badgePestana = esEstaPestana ? '<span class="badge badge-primary ml-1">Esta pestaña</span>' : '';

                let badgeTipo = '<span class="badge badge-secondary ml-1">Nuevo</span>';
                if (b.resumen.docEntry > 0) {
                    if (b.resumen.docStatusOriginal === 'C' || (b.resumen.docEntrySap && b.resumen.docEntrySap > 0)) {
                        badgeTipo = `<span class="badge badge-info ml-1" title="Orden Reabierta N° ${b.resumen.docEntry}">Reabierta #${b.resumen.docEntry}</span>`;
                    } else {
                        badgeTipo = `<span class="badge badge-warning ml-1" title="Borrador BD N° ${b.resumen.docEntry}">Borrador BD #${b.resumen.docEntry}</span>`;
                    }
                }

                const tr = `
                    <tr>
                        <td class="text-center">
                            <input type="checkbox" class="chk-borrador-item" value="${b.draftId}" />
                        </td>
                        <td class="text-center font-weight-bold">${idx + 1}</td>
                        <td>${fecha} ${badgeTipo} ${badgePestana}</td>
                        <td>
                            <strong>${b.resumen.clienteNombre || 'Sin nombre'}</strong>
                            ${b.resumen.clienteRuc ? '<br><small class="text-muted">RUC/DNI: ' + b.resumen.clienteRuc + '</small>' : ''}
                        </td>
                        <td class="text-center"><span class="badge badge-info">${b.resumen.totalArticulos}</span></td>
                        <td class="text-right font-weight-bold">S/ ${totalFmt}</td>
                        <td><small class="text-muted">${b.resumen.almacenNombre || b.resumen.almacen || '-'}</small></td>
                        <td class="text-center" style="white-space:nowrap;">
                            <button type="button" class="btn btn-xs btn-primary btn-restaurar-borrador" data-draft-id="${b.draftId}" title="Restaurar en esta pestaña">
                                <i class="fa fa-upload"></i> Cargar
                            </button>
                            <button type="button" class="btn btn-xs btn-danger btn-eliminar-borrador" data-draft-id="${b.draftId}" title="Eliminar borrador">
                                <i class="fa fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                $tbody.append(tr);
            });
        }

        $("#modalBorradoresLocales").modal("show");
    }

    function verificarRecuperacionPestana() {
        const currentId = sessionStorage.getItem(SESSION_DRAFT_KEY);
        if (!currentId) return;

        const mapa = _obtenerTodosBorradores();
        const borrador = mapa[currentId];
        const usuarioActual = _obtenerUsuarioActual();

        if (borrador && borrador.usuario && usuarioActual && borrador.usuario.toLowerCase() !== usuarioActual) {
            _setCurrentDraftId(null);
            return;
        }

        if (borrador && borrador.resumen && (borrador.resumen.totalArticulos > 0 || borrador.resumen.clienteCodigo)) {
            const fecha = new Date(borrador.fechaModificacion).toLocaleTimeString();
            const cliente = borrador.resumen.clienteNombre || "Cliente sin registrar";
            const total = (parseFloat(borrador.resumen.montoTotal) || 0).toFixed(2);
            const cant = borrador.resumen.totalArticulos;

            let tipoTexto = "una venta sin finalizar";
            if (borrador.resumen.docEntry > 0) {
                if (borrador.resumen.docStatusOriginal === "C") {
                    tipoTexto = `la modificación de la orden reabierta N° ${borrador.resumen.docEntry}`;
                } else {
                    tipoTexto = `la edición del borrador de BD N° ${borrador.resumen.docEntry}`;
                }
            }

            Swal.fire({
                title: "Venta pendiente detectada",
                html: `Se encontró ${tipoTexto} en esta pestaña:<br><br>
                       <strong>Cliente:</strong> ${cliente}<br>
                       <strong>Artículos:</strong> ${cant} ítems &nbsp;|&nbsp; <strong>Total:</strong> S/ ${total}<br>
                       <small class="text-muted">Última modificación: ${fecha}</small><br><br>
                       ¿Deseas restaurarla para continuar trabajando?`,
                type: "question",
                showCancelButton: true,
                confirmButtonText: '<i class="fa fa-undo"></i> Restaurar Venta',
                cancelButtonText: '<i class="fa fa-times"></i> Descartar de esta Pestaña',
                confirmButtonColor: "#1ab394",
                cancelButtonColor: "#6c757d"
            }).then(function (result) {
                if (result.value) {
                    restaurarBorrador(currentId);
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    _setCurrentDraftId(null);
                    _mostrarEstadoAutoSave("");
                }
            });
        }
    }

    function inicializar() {
        _obtenerTabId();
        _obtenerCurrentDraftId();
        _purgarBorradoresViejos();
        actualizarBadgeBorradores();

        // Listeners para detectar cambios de formulario en cabecera
        $(document).on("input change", "#tab-cliente input, #tab-cliente select, #tab-logistica input, #tab-logistica select, #tab-financiero input, #tab-financiero select", function () {
            notificarCambio();
        });

        // Abrir modal de borradores
        $(document).on("click", "#btnBorradoresLocales", function (e) {
            e.preventDefault();
            abrirModalBorradores();
        });

        // Checkbox seleccionar todos en modal
        $(document).on("change", "#chkSeleccionarTodosBorradores", function () {
            const checked = $(this).is(":checked");
            $(".chk-borrador-item").prop("checked", checked);
            _actualizarEstadoSeleccionModal();
        });

        // Checkbox individual en modal
        $(document).on("change", ".chk-borrador-item", function () {
            _actualizarEstadoSeleccionModal();
        });

        // Botón Cargar Borrador
        $(document).on("click", ".btn-restaurar-borrador", function () {
            const draftId = $(this).data("draft-id");
            restaurarBorrador(draftId);
        });

        // Botón Eliminar Borrador Individual
        $(document).on("click", ".btn-eliminar-borrador", function () {
            const draftId = $(this).data("draft-id");
            Swal.fire({
                title: "¿Eliminar borrador?",
                text: "Esta acción no se puede deshacer.",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#d33",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, eliminar",
                cancelButtonText: "Cancelar"
            }).then(function (res) {
                if (res.value) {
                    eliminarBorrador(draftId, function () {
                        abrirModalBorradores();
                    });
                }
            });
        });

        // Botón Eliminar Seleccionados
        $(document).on("click", "#btnEliminarBorradoresSeleccionados", function () {
            const ids = [];
            $(".chk-borrador-item:checked").each(function () {
                ids.push($(this).val());
            });

            if (ids.length === 0) return;

            Swal.fire({
                title: `¿Eliminar ${ids.length} borrador(es) seleccionado(s)?`,
                text: "Esta acción no se puede deshacer.",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#d33",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, eliminar",
                cancelButtonText: "Cancelar"
            }).then(function (res) {
                if (res.value) {
                    eliminarBorradoresMultiples(ids, function () {
                        abrirModalBorradores();
                    });
                }
            });
        });

        // Botón Vaciar Todos los Borradores
        $(document).on("click", "#btnEliminarTodosBorradores", function () {
            const total = listarBorradores().length;
            if (total === 0) return;

            Swal.fire({
                title: "¿Vaciar TODOS los borradores?",
                text: `Se eliminarán los ${total} borradores locales de este navegador. Esta acción no se puede deshacer.`,
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#d33",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, vaciar todos",
                cancelButtonText: "Cancelar"
            }).then(function (res) {
                if (res.value) {
                    eliminarTodosBorradores(function () {
                        abrirModalBorradores();
                    });
                }
            });
        });

        // Verificar si la pestaña actual tiene un borrador para recuperar
        setTimeout(function () {
            verificarRecuperacionPestana();
        }, 600);
    }

    return {
        inicializar: inicializar,
        notificarCambio: notificarCambio,
        guardarBorradorActual: guardarBorradorActual,
        restaurarBorrador: restaurarBorrador,
        listarBorradores: listarBorradores,
        eliminarBorrador: eliminarBorrador,
        eliminarBorradoresMultiples: eliminarBorradoresMultiples,
        eliminarTodosBorradores: eliminarTodosBorradores,
        desvincularBorradorPestana: desvincularBorradorPestana,
        limpiarPestanaSinGuardar: limpiarPestanaSinGuardar,
        eliminarBorradorVentaExitosa: eliminarBorradorVentaExitosa,
        abrirModalBorradores: abrirModalBorradores,
        actualizarBadgeBorradores: actualizarBadgeBorradores
    };

})();
