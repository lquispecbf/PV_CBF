window.PV = window.PV || {};

PV.Hotkeys = (function () {

    var _$filaModalBusqueda = null;
    var _$filaModalLotes = null;
    var _itemsModalLotes = [];
    var _itemSeleccionadoIndice = -1;
    var _seleccionAvanzadaCodigos = [];
    var _procesandoSeleccionAvanzada = false;
    var _$controlInvocadorBusqueda = null;
    var _$controlInvocadorLotes = null;
    var _$controlInvocadorLotesFila = null;
    var _lotesGuardados = false;
    var _lotesGuardadosFila = false;
    var _bloqueoAperturaLotes = false;
    var _bloqueoAperturaBusqueda = false;

    function inicializar() {
        registrarHotkeys();
        registrarEventosModales();
    }

    function activarTab(tabId) {
        if (PV.Core && typeof PV.Core.conmutarTab === "function") {
            PV.Core.conmutarTab(tabId, { enfocar: true });
        } else {
            var $link = $('a[href="' + tabId + '"]');
            if ($link.length && !$link.hasClass("active")) {
                $link.tab("show");
            }
        }
    }

    function registrarHotkeys() {
        $(document).off("keydown.hotkeys").on("keydown.hotkeys", function (e) {

            if ( ($("#tab-1").hasClass("active") || $("#tab-2").hasClass("active")) &&
                 ["F6","F7","F8","F9","F10","F11","F12"].includes(e.key) ) {
                e.preventDefault();
            }

            // Atajo para eliminar fila activa en tabla de detalle (Ctrl+D o Ctrl+Delete/Supr)
            if ($("#tab-2").hasClass("active") && $(".modal:visible").length === 0 && $(".swal2-container:visible").length === 0 &&
                e.ctrlKey && !e.altKey && !e.shiftKey &&
                (e.key.toLowerCase() === "d" || e.key === "Delete")) {

                var $filaActual = $(document.activeElement).closest("#tblVentaDetalle tbody tr");
                if ($filaActual.length > 0 && PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && !PV.Detalle.isReadOnly()) {
                    var $btnEliminar = $filaActual.find(".btn-detalle-eliminar");
                    if ($btnEliminar.length > 0 && !$btnEliminar.is(":disabled")) {
                        e.preventDefault();
                        e.stopPropagation();
                        $btnEliminar.trigger("click");
                        return;
                    }
                }
            }

            // Atajo para abrir buscador de detalle (Ctrl+F o Ctrl+B) en pestaña Venta
            if ($("#tab-2").hasClass("active") && $(".modal:visible").length === 0 && $(".swal2-container:visible").length === 0 &&
                e.ctrlKey && !e.altKey && (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "b")) {
                e.preventDefault();
                e.stopPropagation();

                var $filaActual = $(document.activeElement).closest("#tblVentaDetalle tbody tr");
                var $target = $filaActual.length > 0 ? $filaActual : $("#tblVentaDetalle tbody tr").first();

                if (PV.Detalle && typeof PV.Detalle.abrirMenuContextualDetalle === "function") {
                    PV.Detalle.abrirMenuContextualDetalle(null, null, $target, $(document.activeElement));
                }
                return;
            }

            // Atajo para enfocar la fila vacía final de ingreso de artículos (Ctrl+I)
            if ($("#tab-2").hasClass("active") && $(".modal:visible").length === 0 && $(".swal2-container:visible").length === 0 &&
                e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "i") {

                if (PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && !PV.Detalle.isReadOnly()) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof PV.Detalle.enfocarFilaVaciaFinal === "function") {
                        PV.Detalle.enfocarFilaVaciaFinal();
                    }
                    return;
                }
            }

            // Atajo de navegación vertical estilo Excel (Ctrl+Flecha Abajo / Ctrl+Flecha Arriba) en detalle de venta
            if ($("#tab-2").hasClass("active") && $(".modal:visible").length === 0 && $(".swal2-container:visible").length === 0 &&
                e.ctrlKey && !e.altKey && !e.shiftKey &&
                (e.key === "ArrowDown" || e.key === "ArrowUp")) {

                var $inputActual = $(document.activeElement).closest("#tblVentaDetalle tbody tr").find(document.activeElement);
                if ($inputActual.length > 0 && PV.Detalle && typeof PV.Detalle.navegarCeldaVertical === "function") {
                    e.preventDefault();
                    e.stopPropagation();
                    PV.Detalle.navegarCeldaVertical($inputActual, e.key === "ArrowDown" ? 1 : -1);
                    return;
                }
            }

            if ($("#tab-2").hasClass("active") && e.ctrlKey && !e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
                e.preventDefault();

                switch (e.key) {
                    case "1":
                        activarTab("#tab-cliente");
                        break;
                    case "2":
                        activarTab("#tab-logistica");
                        break;
                    case "3":
                        activarTab("#tab-financiero");
                        break;
                    case "4":
                        var $input = $("#tblVentaDetalle").find(".txtDetalleDescripcion").first();
                        if ($input.length) {
                            $input.focus().select();
                        }
                        break;
                }
                return;
            }

            if ($("#tab-2").hasClass("active") && ["F9", "F10", "F11", "F12"].includes(e.key)) {
                if (!PV.Utils.puedeInteractuar()) return;
                e.preventDefault();

                switch (e.key) {
                    case "F9":
                        if (!$("#btnVentaLimpiar").is(":disabled")) {
                            $("#btnVentaLimpiar").trigger("click");
                        }
                        break;
                    case "F10":
                        if (!$("#btnVentaGuardar").is(":disabled")) {
                            $("#btnVentaGuardar").trigger("click");
                        }
                        break;
                    case "F11":
                        if (!$("#btnVentaBorrador").is(":disabled")) {
                            $("#btnVentaBorrador").trigger("click");
                        }
                        break;
                    case "F12":
                        if (!$("#btnVentaImportarArticulo").is(":disabled")) {
                            $("#btnVentaImportarArticulo").trigger("click");
                        }
                        break;
                }
                return;
            }

            if ($("#tab-1").hasClass("active") && ["F6", "F7", "F8", "F9", "F10", "F11", "F12"].includes(e.key)) {
                var tag = document.activeElement ? document.activeElement.tagName : "";
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
                if ($(".modal:visible").length > 0) return;
                if ($(".swal2-container:visible").length > 0) return;
                if (!PV.Utils.puedeInteractuar()) return;

                e.preventDefault();

                switch (e.key) {
                    case "F6":
                        $("#btnBusquedaExportar").trigger("click");
                        break;
                    case "F7":
                        if (!$("#btnBusquedaImprimir").is(":disabled")) {
                            imprimirDesdeBusqueda();
                        }
                        break;
                    case "F8":
                        if (!$("#btnBusquedaEnviarWms").is(":disabled")) {
                            enviarWmsDesdeBusqueda();
                        }
                        break;
                    case "F9":
                        if (!$("#btnBusquedaAcciones").is(":disabled")) {
                            $("#btnBusquedaAcciones").dropdown("toggle");
                        }
                        break;
                    case "F10":
                        imprimirPreliminarSapDesdeBusqueda();
                        break;
                    case "F11":
                        imprimirPreliminarPvDesdeBusqueda();
                        break;
                    case "F12":
                        imprimirTicketDesdeBusqueda();
                        break;
                }
                return;
            }

            if (e.key !== "F2" && e.key !== "F3") return;
            if (!$("#tab-2").hasClass("active")) return;
            if (!PV.Utils.puedeInteractuar()) return;

            e.preventDefault();

            if (e.key === "F2") {
                if ($("#btnVentaGuardar").is(":disabled") || _bloqueoAperturaLotes || PV.Utils.modalAbierto("#modalLotesTodos") || $("#modalLotesTodos").is(":visible")) return;
                abrirModalLotesTodosItems();
                return;
            }

            if (e.key === "F3") {
                if ($("#btnVentaGuardar").is(":disabled") || _bloqueoAperturaBusqueda || PV.Utils.modalAbierto("#modalBusquedaAvanzada") || $("#modalBusquedaAvanzada").is(":visible")) return;

                const $control = $(document.activeElement);
                let $fila = $control.closest("#tblVentaDetalle tbody tr");

                if (!$fila.length) {
                    $fila = $("#tblVentaDetalle tbody tr").filter(function () {
                        return !$(this).attr("data-itemcode");
                    }).first();
                    if (!$fila.length) {
                        $fila = $("#tblVentaDetalle tbody tr").last();
                    }
                }

                abrirModalBusquedaItems($fila);
            }
        });
    }

    function seleccionarFilaAvanzada($fila, scroll) {
        if (!$fila || $fila.length === 0) return;
        $("#tblBusquedaAvanzada tbody tr").removeClass("selected");
        $fila.addClass("selected");
        if (scroll !== false && $fila[0]) {
            $fila[0].scrollIntoView({ block: "nearest" });
        }
    }

    function registrarEventosModales() {
        $("#btnFiltroBuscar").off("click.modalBuscar").on("click.modalBuscar", function () {
            buscarArticulosAvanzado();
        });

        $(document).off("change.hotkeysLotes").on("change.hotkeysLotes", "#chkSeleccionarTodosLotes", function () {
            var marcado = $(this).prop("checked");
            $("#tblLotes tbody .chk-lote").prop("checked", marcado);
        });

        $("#btnSelLotes").off("click.selLotes").on("click.selLotes", function () {
            seleccionarLotes();
        });

        $("#modalBusquedaAvanzada").off("hidden.bs.modal").on("hidden.bs.modal", function () {
            try {
                if ($.fn.DataTable.isDataTable("#tblBusquedaAvanzada")) {
                    $("#tblBusquedaAvanzada").DataTable().destroy();
                }
            } catch (e) { }
            $("#chkSeleccionarTodosAvanzada").prop("checked", false);
            _seleccionAvanzadaCodigos = [];
            _bloqueoAperturaBusqueda = false;
            $(".modal-backdrop").remove();
            $("body").removeClass("modal-open");

            if (!_procesandoSeleccionAvanzada) {
                setTimeout(function () {
                    if (_$controlInvocadorBusqueda && _$controlInvocadorBusqueda.length && document.body.contains(_$controlInvocadorBusqueda[0])) {
                        _$controlInvocadorBusqueda.focus();
                        if (_$controlInvocadorBusqueda.is("input:text") && typeof _$controlInvocadorBusqueda.select === "function") {
                            _$controlInvocadorBusqueda.select();
                        }
                    } else if (_$filaModalBusqueda && _$filaModalBusqueda.length && document.body.contains(_$filaModalBusqueda[0])) {
                        PV.Detalle.enfocarCantidadFila(_$filaModalBusqueda);
                    }
                }, 50);
            }
            _procesandoSeleccionAvanzada = false;
        });

        $(document).off("keydown.hotkeysBuscar").on("keydown.hotkeysBuscar", function (e) {
            if (!$("#modalBusquedaAvanzada").hasClass("show") && !$("#modalBusquedaAvanzada").is(":visible")) return;

            var $target = $(e.target);
            var esFiltroInput = $target.is("#txtFiltroDescripcion, #txtFiltroCodigo, #txtFiltroLaboratorio, #txtFiltroPrincipioActivo, #ddlFiltroTitularRs") || $target.hasClass("select2-selection") || $target.closest(".select2-container").length > 0;

            if (esFiltroInput) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    var id = $target.attr("id");
                    var esTitularRs = id === "ddlFiltroTitularRs" || $target.closest(".select2-container").prev("select").attr("id") === "ddlFiltroTitularRs";
                    $("#txtFiltroDescripcion, #txtFiltroCodigo, #txtFiltroLaboratorio, #txtFiltroPrincipioActivo").each(function () {
                        if ($(this).attr("id") !== id) {
                            $(this).val("");
                        }
                    });
                    if (esTitularRs) {
                        $("#ddlFiltroTitularRs").select2("close");
                    } else {
                        $("#ddlFiltroTitularRs").val(null).trigger("change");
                    }
                    $("#btnFiltroBuscar").trigger("click");
                    return;
                } else if (e.key === "ArrowDown" || e.key === "Down") {
                    var $filasDisponibles = $("#tblBusquedaAvanzada tbody tr.fila-articulo-avanzado");
                    if ($filasDisponibles.length > 0) {
                        e.preventDefault();
                        var $sel = $("#tblBusquedaAvanzada tbody tr.selected:first");
                        if ($sel.length === 0) $sel = $filasDisponibles.first();
                        seleccionarFilaAvanzada($sel, true);
                        $target.blur();
                        return;
                    }
                }
                return;
            }

            var $filas = $("#tblBusquedaAvanzada tbody tr.fila-articulo-avanzado");
            if ($filas.length === 0) return;

            var $seleccionada = $("#tblBusquedaAvanzada tbody tr.selected:first");
            if ($seleccionada.length === 0) $seleccionada = $filas.first();
            var idxActual = $filas.index($seleccionada);

            if (e.key === "ArrowDown" || e.key === "Down") {
                e.preventDefault();
                var nextIdx = idxActual + 1 < $filas.length ? idxActual + 1 : idxActual;
                if (nextIdx === -1) nextIdx = 0;
                seleccionarFilaAvanzada($filas.eq(nextIdx), true);
            } else if (e.key === "ArrowUp" || e.key === "Up") {
                e.preventDefault();
                var prevIdx = idxActual > 0 ? idxActual - 1 : 0;
                seleccionarFilaAvanzada($filas.eq(prevIdx), true);
            } else if (e.key === "PageDown") {
                e.preventDefault();
                var pDownIdx = Math.min((idxActual === -1 ? 0 : idxActual) + 10, $filas.length - 1);
                seleccionarFilaAvanzada($filas.eq(pDownIdx), true);
            } else if (e.key === "PageUp") {
                e.preventDefault();
                var pUpIdx = Math.max((idxActual === -1 ? 0 : idxActual) - 10, 0);
                seleccionarFilaAvanzada($filas.eq(pUpIdx), true);
            } else if (e.key === "Home") {
                e.preventDefault();
                seleccionarFilaAvanzada($filas.first(), true);
            } else if (e.key === "End") {
                e.preventDefault();
                seleccionarFilaAvanzada($filas.last(), true);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (_procesandoSeleccionAvanzada) return;
                if (_seleccionAvanzadaCodigos && _seleccionAvanzadaCodigos.length > 0) {
                    agregarArticulosSeleccionados();
                } else if ($seleccionada.length > 0) {
                    seleccionarArticuloBusqueda();
                }
            } else if (e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
                if ($seleccionada.length > 0) {
                    var $chk = $seleccionada.find(".chk-seleccionar-avanzada");
                    $chk.prop("checked", !$chk.prop("checked")).trigger("change");
                }
            }
        });

        $(document).off("click.hotkeysSelRow").on("click.hotkeysSelRow", "#tblBusquedaAvanzada tbody tr", function (e) {
            if ($(e.target).is("input[type='checkbox']")) return;
            seleccionarFilaAvanzada($(this), false);
        });

        $(document).off("dblclick.hotkeysSelRow", "#tblBusquedaAvanzada tbody tr");

        $(document).off("change.hotkeysChkAvanzada").on("change.hotkeysChkAvanzada", "#tblBusquedaAvanzada tbody .chk-seleccionar-avanzada", function () {
            var $tr = $(this).closest("tr");
            var codigo = $tr.data("codigo");
            var checked = $(this).prop("checked");
            $tr.toggleClass("selected", checked);
            if (checked) {
                if (_seleccionAvanzadaCodigos.indexOf(codigo) === -1) _seleccionAvanzadaCodigos.push(codigo);
            } else {
                _seleccionAvanzadaCodigos = _seleccionAvanzadaCodigos.filter(function (c) { return c !== codigo; });
            }
        });

        $(document).off("change.hotkeysChkTodosAvanzada").on("change.hotkeysChkTodosAvanzada", "#chkSeleccionarTodosAvanzada", function () {
            var marcado = $(this).prop("checked");
            _seleccionAvanzadaCodigos = [];
            if (marcado) {
                var dt = $("#tblBusquedaAvanzada").DataTable();
                dt.rows().every(function () {
                    var codigo = $(this.node()).data("codigo");
                    if (codigo) _seleccionAvanzadaCodigos.push(codigo);
                });
            }
            $("#tblBusquedaAvanzada tbody .chk-seleccionar-avanzada").prop("checked", marcado);
            $("#tblBusquedaAvanzada tbody tr").toggleClass("selected", marcado);
        });

        $("#btnAgregarArticulosAvanzada").off("click.agregarAvanzada").on("click.agregarAvanzada", function () {
            agregarArticulosSeleccionados();
        });

        $(document).off("click.hotkeysBtnSelFila").on("click.hotkeysBtnSelFila", "#tblBusquedaAvanzada tbody .btn-seleccionar-fila", function () {
            var $tr = $(this).closest("tr");
            $tr.addClass("selected").siblings().removeClass("selected");
            seleccionarArticuloBusqueda();
        });

        $("#btnSelLotesTodos").off("click.selLotesTodos").on("click.selLotesTodos", function () {
            seleccionarLotesTodos();
        });

        $(document).off("change.hotkeysLoteItem").on("change.hotkeysLoteItem", ".chk-lote-todos-item", function () {
            var marcado = $(this).prop("checked");
            $(this).closest("table").find(".chk-lote-linea").prop("checked", marcado);
        });

        // --- Eventos para modal rediseñado de 3 paneles ---
        $(document).off("click.hotkeysSelProducto").on("click.hotkeysSelProducto", "#tblLotesProductos tbody tr", function () {
            $(this).addClass("selected").siblings().removeClass("selected");
            var idx = parseInt($(this).data("idx"));
            if (!isNaN(idx)) {
                seleccionarItemLote(idx);
            }
        });

        $(document).off("keydown.hotkeysLoteCant").on("keydown.hotkeysLoteCant", ".txt-cantidad-lote, .txt-cantidad-lote-disponible", function (e) {
            if (e.key === "." || e.key === "," || e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                e.preventDefault();
            }
        });

        $(document).off("input.hotkeysLoteCant").on("input.hotkeysLoteCant", ".txt-cantidad-lote, .txt-cantidad-lote-disponible", function () {
            var val = $(this).val();
            if (/[^0-9]/.test(val)) {
                $(this).val(val.replace(/[^0-9]/g, ""));
            }
        });

        $(document).off("click.hotkeysAsignarLote").on("click.hotkeysAsignarLote", ".btn-asignar-lote", function () {
            asignarLote($(this));
        });

        $(document).off("click.hotkeysEliminarLote").on("click.hotkeysEliminarLote", ".btn-eliminar-lote", function () {
            eliminarLoteAsignado($(this));
        });

        $("#btnAsignacionAutomatica").off("click.asigAuto").on("click.asigAuto", function () {
            asignacionAutomatica();
        });

        $("#modalLotesTodos").off("hidden.bs.modal").on("hidden.bs.modal", function () {
            try {
                if ($.fn.DataTable.isDataTable("#tblLotesProductos")) {
                    $("#tblLotesProductos").DataTable().destroy();
                }
                if ($.fn.DataTable.isDataTable("#tblLotesDisponibles")) {
                    $("#tblLotesDisponibles").DataTable().destroy();
                }
                if ($.fn.DataTable.isDataTable("#tblLotesAsignados")) {
                    $("#tblLotesAsignados").DataTable().destroy();
                }
            } catch (e) { }
            _itemsModalLotes = [];
            _itemSeleccionadoIndice = -1;
            _bloqueoAperturaLotes = false;

            if (!_lotesGuardados) {
                setTimeout(function () {
                    if (_$controlInvocadorLotes && _$controlInvocadorLotes.length && document.body.contains(_$controlInvocadorLotes[0])) {
                        _$controlInvocadorLotes.focus();
                        if (_$controlInvocadorLotes.is("input:text") && typeof _$controlInvocadorLotes.select === "function") {
                            _$controlInvocadorLotes.select();
                        }
                    }
                }, 50);
            }
            _lotesGuardados = false;
        });

    }

    function abrirModalBusquedaItems($fila) {
        if (_bloqueoAperturaBusqueda || PV.Utils.modalAbierto("#modalBusquedaAvanzada") || $("#modalBusquedaAvanzada").hasClass("show") || $("#modalBusquedaAvanzada").is(":visible")) return;
        _bloqueoAperturaBusqueda = true;

        var $elActivo = $(document.activeElement);
        if ($elActivo.length && $elActivo.closest("#tblVentaDetalle").length) {
            _$controlInvocadorBusqueda = $elActivo;
        } else if ($fila && $fila.length) {
            _$controlInvocadorBusqueda = $fila.find(".txtDetalleDescripcion:not([readonly]), .txtDetalleCodigo:not([readonly]), .txtDetalleCantidad:not([readonly])").first();
        } else {
            _$controlInvocadorBusqueda = null;
        }

        if (PV._clienteBloqueado) {
            _bloqueoAperturaBusqueda = false;
            Swal.fire({
                type: "warning",
                title: "Cliente Bloqueado",
                html: "El cliente seleccionado se encuentra bloqueado.<br><br><strong>Motivo:</strong> " + (PV._motivoBloqueo || "Sin motivo especificado"),
                confirmButtonText: "Aceptar"
            });
            return;
        }
        _procesandoSeleccionAvanzada = false;
        _$filaModalBusqueda = $fila;

        var textoDescripcion = $fila.find(".txtDetalleDescripcion").val() || "";
        var textoCodigo = $fila.find(".txtDetalleCodigo").val() || "";

        $("#txtFiltroDescripcion").val(textoDescripcion);
        $("#txtFiltroCodigo").val(textoCodigo);
        $("#txtFiltroLaboratorio").val("");
        $("#txtFiltroPrincipioActivo").val("");

        if ($("#ddlFiltroTitularRs").data("select2")) {
            $("#ddlFiltroTitularRs").val(null).trigger("change");
        }

        try {
            if ($.fn.DataTable.isDataTable("#tblBusquedaAvanzada")) {
                $("#tblBusquedaAvanzada").DataTable().destroy();
            }
        } catch (e) { }
        $("#tblBusquedaAvanzada tbody").empty();
        $("#modalBusquedaAvanzada").modal("show");

        $("#modalBusquedaAvanzada").off("shown.bs.modal.initBusqueda").on("shown.bs.modal.initBusqueda", function () {
            _bloqueoAperturaBusqueda = false;
            cargarTitularesRs();
            $("#txtFiltroDescripcion").focus();
        });

        if (textoDescripcion || textoCodigo) {
            buscarArticulosAvanzado();
        }
    }

    function cargarTitularesRs() {
        var $ddl = $("#ddlFiltroTitularRs");
        $.get("/PuntoVenta/Buscar_TitularesRs", function (data) {
            $ddl.empty().append('<option value="">Todos</option>');
            if (data && data.length > 0) {
                data.forEach(function (item) {
                    if (item && item.trim() !== "") {
                        $ddl.append('<option value="' + item + '">' + item + '</option>');
                    }
                });
            }
            inicializarSelect2TitularRs();
        });
    }

    function inicializarSelect2TitularRs() {
        var $ddl = $("#ddlFiltroTitularRs");
        if ($ddl.data("select2")) return;

        $ddl.select2({
            width: "100%",
            placeholder: "Todos",
            allowClear: true,
            dropdownParent: $("#modalBusquedaAvanzada")
        });

        $ddl.on("select2:select", function () {
            var val = $ddl.val();
            if (val) {
                $ddl.find("option").filter(function () {
                    return $(this).val() === "";
                }).remove();
            }
        });

    }

    function buscarArticulosAvanzado() {
        _seleccionAvanzadaCodigos = [];
        $("#chkSeleccionarTodosAvanzada").prop("checked", false);

        var listaPrecio = $("#ddlClienteListaPrecio").val();
        var almacen = $("#ddlVentaAlmacen").val();

        if (!listaPrecio || !almacen) {
            Swal.fire({
                type: "warning",
                title: "Faltan datos",
                text: "Seleccione lista de precios y almacén primero."
            });
            return;
        }

        $("body").addClass("loading");

        $.ajax({
            url: "/PuntoVenta/Buscar_ArticulosAvanzado",
            type: "GET",
            dataType: "json",
            data: {
                descripcion: $("#txtFiltroDescripcion").val() || "",
                codigo: $("#txtFiltroCodigo").val() || "",
                laboratorio: $("#txtFiltroLaboratorio").val() || "",
                principioActivo: $("#txtFiltroPrincipioActivo").val() || "",
                titularRs: $("#ddlFiltroTitularRs").val() || "",
                codigoListaPrecio: listaPrecio,
                codigoAlmacen: almacen
            },
            success: function (data) {
                $("body").removeClass("loading");

                try {
                    if ($.fn.DataTable.isDataTable("#tblBusquedaAvanzada")) {
                        $("#tblBusquedaAvanzada").DataTable().destroy();
                    }
                } catch (e) { }

                if (!data || data.length === 0) {
                    $("#tblBusquedaAvanzada tbody").html(
                        '<tr><td colspan="14" class="text-center text-muted">No se encontraron resultados.</td></tr>'
                    );
                    return;
                }

                var rows = "";

                data.forEach(function (item, idx) {
                    rows += `
                        <tr data-codigo="${item.CODIGO || ""}"
                            data-descripcion="${item.DESCRIPCION || ""}"
                            data-precio="${item.PRECIO || 0}"
                            data-stock="${item.STOCK || 0}"
                            data-codebars="${item.CODEBARS || ""}"
                            data-igvafect="${item.IGV_AFECT || "IGV"}"
                            data-vencimiento="${item.FECHA_VENCIMIENTO || ""}"
                            data-principio="${item.PRINCIPIO_ACTIVO || ""}"
                            data-laboratorio="${item.LABORATORIO || ""}"
                            data-estadosku="${item.ESTADO_SKU || ""}"
                            data-observacion="${item.OBSERVACION || ""}"
                            data-cajonm="${item.CAJON_M || ""}"
                            data-especificacion="${item.ESPECIFICACION || ""}"
                            data-protocolos="${item.PROTOCOLOS || ""}"
                            data-titularrs="${item.REGISTRO_SANITARIO || ""}"
                            data-preciocaja="${item.PRECIO_CAJA || 0}"
                            class="fila-articulo-avanzado">
                            <td class="text-center">
                                <div class="checkbox checkbox-success" style="margin:0; padding-left:20px; line-height:1;">
                                    <input type="checkbox" class="chk-seleccionar-avanzada" id="chk_av_${idx}">
                                    <label for="chk_av_${idx}"></label>
                                </div>
                            </td>
                            <td>${item.DESCRIPCION || ""}</td>
                            <td>${item.CODIGO || ""}</td>
                            <td class="text-right">${Number(item.PRECIO || 0).toFixed(2)}</td>
                            <td class="text-right">${Number(item.PRECIO_CAJA || 0).toFixed(2)}</td>
                            <td class="text-right">${Number(item.STOCK_CAJAS || 0).toFixed(2)}</td>
                            <td>${item.FECHA_VENCIMIENTO || ""}</td>
                            <td>${item.PRINCIPIO_ACTIVO || ""}</td>
                            <td>${item.ESTADO_SKU || ""}</td>
                            <td>${item.OBSERVACION || ""}</td>
                            <td>${item.CAJON_M || ""}</td>
                            <td>${item.ESPECIFICACION || ""}</td>
                            <td>${item.PROTOCOLOS || ""}</td>
                            <td>${item.REGISTRO_SANITARIO || ""}</td>
                        </tr>`;
                });

                $("#tblBusquedaAvanzada tbody").html(rows);

                $("#tblBusquedaAvanzada").DataTable({
                    language: { url: "/js/plugins/dataTables/Spanish.js" },
                    info: true,
                    pageLength: -1,
                    lengthChange: true,
                    lengthMenu: [[-1, 25, 50, 100], ["Todos", 25, 50, 100]],
                    autoWidth: false,
                    dom: "t<'row'<'col-6'l><'col-6'f>>rt<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
                    order: [[2, "asc"]],
                    columnDefs: [
                        { targets: [3, 4, 5], className: "text-right" },
                        { targets: [0], orderable: false, searchable: false }
                    ],
                    drawCallback: function () {
                        var dt = this.api();
                        dt.rows().every(function () {
                            var $tr = $(this.node());
                            var codigo = $tr.data("codigo");
                            var seleccionado = _seleccionAvanzadaCodigos.indexOf(codigo) !== -1;
                            $tr.find(".chk-seleccionar-avanzada").prop("checked", seleccionado);
                            $tr.toggleClass("selected", seleccionado);
                        });
                    },
                    initComplete: function () {
                        $("#tblBusquedaAvanzada_wrapper select, #tblBusquedaAvanzada_wrapper input").attr("tabindex", "-1");
                        var $primeraFila = $("#tblBusquedaAvanzada tbody tr.fila-articulo-avanzado:first");
                        if ($primeraFila.length > 0) {
                            seleccionarFilaAvanzada($primeraFila, true);
                        }
                        if (document.activeElement) {
                            $(document.activeElement).blur();
                        }
                    }
                });
            },
            error: function (xhr) {
                $("body").removeClass("loading");
                Swal.fire({
                    type: "error",
                    title: "Error",
                    text: xhr.responseJSON?.error || "Error al buscar artículos."
                });
            }
        });
    }

    function escaparHtml(s) {
        if (typeof PV.esc === "function") return PV.esc(s);
        return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function obtenerCodigosArticulosEnDetalle() {
        var codigos = [];
        $("#tblVentaDetalle tbody tr").each(function () {
            var cod = ($(this).find(".txtDetalleCodigo").val() || $(this).attr("data-itemcode") || $(this).data("itemcode") || "").trim();
            if (cod) {
                codigos.push(cod.toUpperCase());
            }
        });
        return codigos;
    }

    function insertarArticuloIndividualBusqueda(item) {
        _procesandoSeleccionAvanzada = true;

        var $filaDestino = _$filaModalBusqueda;
        if ((!$filaDestino || !$filaDestino.length) && typeof PV.Detalle.agregarFilaDetalleVacia === "function") {
            $filaDestino = $("#tblVentaDetalle tbody tr").filter(function () {
                return !$(this).attr("data-itemcode");
            }).first();
            if (!$filaDestino.length) {
                PV.Detalle.agregarFilaDetalleVacia();
                $filaDestino = $("#tblVentaDetalle tbody tr").filter(function () {
                    return !$(this).attr("data-itemcode");
                }).first();
            }
        }

        if ($filaDestino && $filaDestino.length) {
            if (typeof PV.Detalle.llenarFilaDetalle === "function") {
                PV.Detalle.llenarFilaDetalle($filaDestino, item);
            }
        }

        $("#modalBusquedaAvanzada").off("hidden.bs.modal.foco").on("hidden.bs.modal.foco", function () {
            _procesandoSeleccionAvanzada = false;
            $(this).off("hidden.bs.modal.foco");
            if ($filaDestino && $filaDestino.length && typeof PV.Detalle.asegurarFocoEnCantidad === "function") {
                PV.Detalle.asegurarFocoEnCantidad($filaDestino);
            } else {
                setTimeout(function () {
                    if ($filaDestino && $filaDestino.length) {
                        var $inputCant = $filaDestino.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
                        if ($inputCant.length) {
                            $inputCant.focus();
                            if (typeof $inputCant.select === "function" && !$inputCant.is("select")) {
                                $inputCant.select();
                            }
                            return;
                        }
                    }
                    var $ultimaFila = $("#tblVentaDetalle tbody tr").last();
                    if ($ultimaFila.length) {
                        var $desc = $ultimaFila.find(".txtDetalleDescripcion");
                        if ($desc.length > 0) {
                            $desc.focus().select();
                        }
                    }
                }, 80);
            }
        });

        $("#modalBusquedaAvanzada").modal("hide");
    }

    function seleccionarArticuloBusqueda() {
        if (_procesandoSeleccionAvanzada) return;

        var $seleccionada = $("#tblBusquedaAvanzada").find("tr.selected");

        if ($seleccionada.length === 0) {
            Swal.fire({
                type: "warning",
                title: "Seleccione un artículo",
                text: "Haga clic en una fila para seleccionarla."
            });
            return;
        }

        var item = {
            CODIGO: $seleccionada.data("codigo"),
            DESCRIPCION: $seleccionada.data("descripcion"),
            PRECIO: $seleccionada.data("precio"),
            STOCK: $seleccionada.data("stock"),
            CODEBARS: $seleccionada.data("codebars"),
            IGV_AFECT: $seleccionada.data("igvafect"),
            FECHA_VENCIMIENTO: $seleccionada.data("vencimiento"),
            PRINCIPIO_ACTIVO: $seleccionada.data("principio"),
            LABORATORIO: $seleccionada.data("laboratorio"),
            ESTADO_SKU: $seleccionada.data("estadosku"),
            OBSERVACION: $seleccionada.data("observacion"),
            CAJON_M: $seleccionada.data("cajonm"),
            ESPECIFICACION: $seleccionada.data("especificacion"),
            PROTOCOLOS: $seleccionada.data("protocolos"),
            REGISTRO_SANITARIO: $seleccionada.data("titularrs"),
            PRECIO_CAJA: $seleccionada.data("preciocaja")
        };

        var codigosExistentes = obtenerCodigosArticulosEnDetalle();
        var esDuplicado = codigosExistentes.indexOf((item.CODIGO || "").toUpperCase()) !== -1;

        if (esDuplicado) {
            var mensajeHtml =
                '<div style="text-align:left; font-size:13px; margin-bottom:10px;">' +
                '<p>El artículo <strong>' + escaparHtml(item.CODIGO) + ' - ' + escaparHtml(item.DESCRIPCION) + '</strong> ya se encuentra en el detalle de la venta.</p>' +
                '<p class="mb-0 font-weight-bold" style="color:#333;">¿Desea agregarlo de todas formas?</p>' +
                '</div>';

            Swal.fire({
                title: "Artículo Duplicado",
                html: mensajeHtml,
                type: "question",
                width: 580,
                showCancelButton: true,
                confirmButtonColor: "#1ab394",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, agregar",
                cancelButtonText: "Cancelar"
            }).then(function (result) {
                if (result.value) {
                    insertarArticuloIndividualBusqueda(item);
                }
            });
            return;
        }

        insertarArticuloIndividualBusqueda(item);
    }

    function ejecutarInsercionArticulosEnLote(items) {
        _procesandoSeleccionAvanzada = true;

        var total = items.length;
        var procesados = 0;
        var exitosos = 0;
        var $primeraFilaAgregada = null;

        PV.Utils.mostrarModalProgreso("Agregando artículos...", "Artículo 0 de " + total, total);

        function procesarSiguiente() {
            if (procesados >= total) {
                PV.Utils.actualizarModalProgreso(total, total, "Completado");
                PV.Utils.cerrarModalProgreso(400, function () {
                    var enfocarCantidadPrimerRegistro = function () {
                        if ($primeraFilaAgregada && $primeraFilaAgregada.length && typeof PV.Detalle.asegurarFocoEnCantidad === "function") {
                            PV.Detalle.asegurarFocoEnCantidad($primeraFilaAgregada);
                            return;
                        }
                        if ($primeraFilaAgregada && $primeraFilaAgregada.length) {
                            var $inputCant = $primeraFilaAgregada.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
                            if ($inputCant.length) {
                                $inputCant.focus();
                                if (typeof $inputCant.select === "function" && !$inputCant.is("select")) {
                                    $inputCant.select();
                                }
                                return;
                            }
                        }
                        var $ultimaFila = $("#tblVentaDetalle tbody tr").last();
                        if ($ultimaFila.length) {
                            var $desc = $ultimaFila.find(".txtDetalleDescripcion");
                            if ($desc.length > 0) {
                                $desc.focus().select();
                            }
                        }
                    };

                    $("#modalBusquedaAvanzada").off("hidden.bs.modal.foco").on("hidden.bs.modal.foco", function () {
                        _procesandoSeleccionAvanzada = false;
                        $(this).off("hidden.bs.modal.foco");
                        enfocarCantidadPrimerRegistro();
                    });

                    $("#modalBusquedaAvanzada").modal("hide");

                    var mensaje = exitosos + " artículo(s) agregado(s) al detalle.";
                    Swal.fire({
                        type: "success",
                        title: "Completado",
                        html: mensaje,
                        timer: 1200,
                        showConfirmButton: false
                    }).then(function () {
                        enfocarCantidadPrimerRegistro();
                    });
                });
                return;
            }

            var item = items[procesados];
            procesados++;

            var $filaVacia = $("#tblVentaDetalle tbody tr").filter(function () {
                return !$(this).attr("data-itemcode");
            }).first();

            if ($filaVacia.length === 0) {
                PV.Detalle.agregarFilaDetalleVacia();
                $filaVacia = $("#tblVentaDetalle tbody tr").filter(function () {
                    return !$(this).attr("data-itemcode");
                }).first();
            }

            if (!$primeraFilaAgregada) {
                $primeraFilaAgregada = $filaVacia;
            }

            if (PV.Detalle.llenarFilaDetalle) {
                PV.Detalle.llenarFilaDetalle($filaVacia, item);
                exitosos++;
            }

            PV.Utils.actualizarModalProgreso(procesados, total, item.CODIGO);

            setTimeout(procesarSiguiente, 30);
        }

        procesarSiguiente();
    }

    function agregarArticulosSeleccionados() {
        if (_procesandoSeleccionAvanzada) return;

        if (_seleccionAvanzadaCodigos.length === 0) {
            Swal.fire({ type: "warning", title: "Sin selección", text: "Seleccione al menos un artículo con el checkbox." });
            return;
        }

        var items = [];
        _seleccionAvanzadaCodigos.forEach(function (codigo) {
            var $tr = $("#tblBusquedaAvanzada tbody tr").filter(function () { return $(this).data("codigo") === codigo; }).first();
            if ($tr.length) {
                items.push({
                    CODIGO: $tr.data("codigo"),
                    DESCRIPCION: $tr.data("descripcion"),
                    PRECIO: $tr.data("precio"),
                    STOCK: $tr.data("stock"),
                    CODEBARS: $tr.data("codebars"),
                    IGV_AFECT: $tr.data("igvafect"),
                    FECHA_VENCIMIENTO: $tr.data("vencimiento"),
                    PRINCIPIO_ACTIVO: $tr.data("principio"),
                    LABORATORIO: $tr.data("laboratorio"),
                    ESTADO_SKU: $tr.data("estadosku"),
                    OBSERVACION: $tr.data("observacion"),
                    CAJON_M: $tr.data("cajonm"),
                    ESPECIFICACION: $tr.data("especificacion"),
                    PROTOCOLOS: $tr.data("protocolos"),
                    REGISTRO_SANITARIO: $tr.data("titularrs"),
                    PRECIO_CAJA: $tr.data("preciocaja")
                });
            }
        });

        if (items.length === 0) return;

        var codigosExistentes = obtenerCodigosArticulosEnDetalle();
        var duplicados = items.filter(function (it) {
            return codigosExistentes.indexOf((it.CODIGO || "").toUpperCase()) !== -1;
        });

        if (duplicados.length > 0) {
            var filasHtml = duplicados.map(function (d) {
                return '<tr><td style="font-weight:600;">' + escaparHtml(d.CODIGO) + '</td><td>' + escaparHtml(d.DESCRIPCION) + '</td></tr>';
            }).join("");

            var mensajeHtml =
                '<div style="text-align:left; font-size:13px; max-height:220px; overflow-y:auto; margin-bottom:12px;">' +
                '<p>Los siguientes <strong>' + duplicados.length + '</strong> artículo(s) ya se encuentran en el detalle de la venta:</p>' +
                '<table class="table table-sm table-bordered" style="width:100%; margin-bottom:8px;">' +
                '<thead><tr style="background-color:#1ab394; color:white;"><th style="background-color:#1ab394; color:white; width:110px;">Código</th><th style="background-color:#1ab394; color:white;">Descripción</th></tr></thead>' +
                '<tbody>' + filasHtml + '</tbody>' +
                '</table>' +
                '<p class="mb-0 font-weight-bold" style="color:#333;">¿Desea agregarlos de todas formas?</p>' +
                '</div>';

            Swal.fire({
                title: "Artículos Duplicados",
                html: mensajeHtml,
                type: "question",
                width: 700,
                showCancelButton: true,
                confirmButtonColor: "#1ab394",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, agregar",
                cancelButtonText: "Omitir duplicados"
            }).then(function (result) {
                if (result.value) {
                    ejecutarInsercionArticulosEnLote(items);
                } else {
                    var noDuplicados = items.filter(function (it) {
                        return codigosExistentes.indexOf((it.CODIGO || "").toUpperCase()) === -1;
                    });
                    if (noDuplicados.length > 0) {
                        ejecutarInsercionArticulosEnLote(noDuplicados);
                    } else {
                        Swal.fire({
                            type: "info",
                            title: "Artículos omitidos",
                            text: "No se agregaron artículos al detalle porque todos los seleccionados ya estaban presentes.",
                            timer: 1500,
                            showConfirmButton: false
                        });
                    }
                }
            });
            return;
        }

        ejecutarInsercionArticulosEnLote(items);
    }

    function obtenerCantidadLoteAsignadoOtrosItems(itemIndexActual, codigoArticulo, sysnumber) {
        var totalAsignado = 0;
        _itemsModalLotes.forEach(function (it, idx) {
            if (idx === itemIndexActual) return;
            if (it.codigo !== codigoArticulo) return;

            var lotes = it.lotesTemp && it.lotesTemp.length > 0
                ? it.lotesTemp
                : (it.$fila.data("lotes") || []);

            lotes.forEach(function (l) {
                if (String(l.SYSNUMBER) === String(sysnumber)) {
                    totalAsignado += (parseInt(l.QUANTITY) || 0);
                }
            });
        });
        return totalAsignado;
    }

    function obtenerCantidadLoteAsignadoOtrasFilasDetalle($filaActual, codigoArticulo, sysnumber) {
        var totalAsignado = 0;
        $("#tblVentaDetalle tbody tr").each(function () {
            var $f = $(this);
            if ($filaActual && $f[0] === $filaActual[0]) return;
            var cod = $f.find(".txtDetalleCodigo").val();
            if (cod !== codigoArticulo) return;

            var lotes = $f.data("lotes") || [];
            lotes.forEach(function (l) {
                if (String(l.SYSNUMBER) === String(sysnumber)) {
                    totalAsignado += (parseInt(l.QUANTITY) || 0);
                }
            });
        });
        return totalAsignado;
    }

    function abrirModalLotesFila($fila) {
        if (_bloqueoAperturaLotes || PV.Utils.modalAbierto("#modalLotes") || $("#modalLotes").hasClass("show") || $("#modalLotes").is(":visible")) return;
        _bloqueoAperturaLotes = true;
        _lotesGuardadosFila = false;
        _$filaModalLotes = $fila;

        var $elActivoFila = $(document.activeElement);
        if ($elActivoFila.length && $elActivoFila.closest("#tblVentaDetalle").length) {
            _$controlInvocadorLotesFila = $elActivoFila;
        } else if ($fila && $fila.length) {
            _$controlInvocadorLotesFila = $fila.find(".txtDetalleCantidad, .btn-detalle-lote").first();
        } else {
            _$controlInvocadorLotesFila = null;
        }

        var codigoArticulo = $fila.find(".txtDetalleCodigo").val();
        var codigoAlmacen = $("#ddlVentaAlmacen").val();

        if (!codigoArticulo) {
            _bloqueoAperturaLotes = false;
            return;
        }

        try {
            if ($.fn.DataTable.isDataTable("#tblLotes")) {
                $("#tblLotes").DataTable().destroy();
            }
        } catch (e) {
            console.warn("DataTable destroy warning:", e);
        }

        $("#tblLotes").html(
            '<thead><tr>' +
            '<th style="width:40px"><input type="checkbox" id="chkSeleccionarTodosLotes"></th>' +
            '<th>Lote</th>' +
            '<th>Nº Serie</th>' +
            '<th>Cantidad Disponible</th>' +
            '<th>F. Vencimiento</th>' +
            '<th>Ubicación</th>' +
            '<th>Cantidad a Usar</th>' +
            '</tr></thead>' +
            '<tbody><tr><td colspan="7" class="text-center text-muted">Cargando...</td></tr></tbody>'
        );

        $("#modalLotes")
            .off("shown.bs.modal.lotesFila")
            .on("shown.bs.modal.lotesFila", function () {
                _bloqueoAperturaLotes = false;
            })
            .off("hidden.bs.modal.lotesFila")
            .on("hidden.bs.modal.lotesFila", function () {
                _bloqueoAperturaLotes = false;
                if (!_lotesGuardadosFila) {
                    setTimeout(function () {
                        if (_$controlInvocadorLotesFila && _$controlInvocadorLotesFila.length && document.body.contains(_$controlInvocadorLotesFila[0])) {
                            _$controlInvocadorLotesFila.focus();
                            if (_$controlInvocadorLotesFila.is("input:text") && typeof _$controlInvocadorLotesFila.select === "function") {
                                _$controlInvocadorLotesFila.select();
                            }
                        } else if (_$filaModalLotes && _$filaModalLotes.length && document.body.contains(_$filaModalLotes[0])) {
                            PV.Detalle.enfocarCantidadFila(_$filaModalLotes);
                        }
                    }, 50);
                }
                _lotesGuardadosFila = false;
            })
            .modal("show");

        $.ajax({
            url: "/PuntoVenta/Buscar_LotesArticulo",
            type: "GET",
            dataType: "json",
            data: {
                codigoArticulo: codigoArticulo,
                codigoAlmacen: codigoAlmacen
            },
            success: function (data) {
                if (!data || data.length === 0) {
                    $("#tblLotes tbody").html(
                        '<tr><td colspan="7" class="text-center text-muted">No hay lotes disponibles.</td></tr>'
                    );
                    return;
                }

                var lotesAsignados = _$filaModalLotes.data("lotes") || [];
                var rows = "";

                data.forEach(function (item) {
                    var asignadoEnOtras = obtenerCantidadLoteAsignadoOtrasFilasDetalle(_$filaModalLotes, codigoArticulo, item.SYSNUMBER);
                    var dispLote = Math.max(0, (parseFloat(item.QUANTITY) || 0) - asignadoEnOtras);

                    var asignado = lotesAsignados.find(function (l) {
                        return l.SYSNUMBER === String(item.SYSNUMBER) &&
                               l.DISTNUMBER === String(item.DISTNUMBER);
                    });
                    var cantidad = asignado ? asignado.QUANTITY : 0;
                    var checked = cantidad > 0 ? 'checked' : '';
                    var disabledLote = dispLote <= 0 && cantidad <= 0;
                    rows += `
                        <tr data-sysnumber="${item.SYSNUMBER || ""}"
                            data-distnumber="${item.DISTNUMBER || ""}"
                            data-quantity="${dispLote}">
                            <td class="text-center">
                                <input type="checkbox" class="chk-lote" ${checked} ${disabledLote ? "disabled" : ""} />
                            </td>
                            <td>${item.DISTNUMBER || ""}</td>
                            <td>${item.SYSNUMBER || ""}</td>
                            <td class="text-right">${Number(dispLote).toFixed(2)}</td>
                            <td>${item.FECHA_VENCIMIENTO || ""}</td>
                            <td>${item.UBICACION || ""}</td>
                            <td>
                                <input type="number"
                                       class="form-control form-control-sm txt-cantidad-lote"
                                       min="0"
                                       max="${dispLote}"
                                       step="1"
                                       value="${cantidad}"
                                       ${disabledLote ? "disabled" : ""} />
                            </td>
                        </tr>`;
                });

                $("#tblLotes tbody").html(rows);
                $("#chkSeleccionarTodosLotes").prop("checked", false);

                if ($.fn.DataTable.isDataTable("#tblLotes")) {
                    $("#tblLotes").DataTable().destroy();
                }

                $("#tblLotes").DataTable({
                    language: { url: "/js/plugins/dataTables/Spanish.js" },
                    pageLength: 10,
                    lengthChange: false,
                    autoWidth: false,
                    order: [[4, "asc"]],
                    columnDefs: [
                        { targets: [0], orderable: false },
                        { targets: [3], className: "text-right" },
                        { targets: [6], orderable: false }
                    ]
                });

                if ($("#btnVentaGuardar").is(":disabled")) {
                    $("#chkSeleccionarTodosLotes, .chk-lote, .txt-cantidad-lote, #btnSelLotes").prop("disabled", true);
                }
            },
            error: function (xhr) {
                Swal.fire({
                    type: "error",
                    title: "Error",
                    text: xhr.responseJSON?.error || "Error al cargar lotes."
                });
            }
        });
    }

    function abrirModalLotesTodosItems() {
        if (_bloqueoAperturaLotes || PV.Utils.modalAbierto("#modalLotesTodos") || $("#modalLotesTodos").hasClass("show") || $("#modalLotesTodos").is(":visible")) return;
        _bloqueoAperturaLotes = true;
        _lotesGuardados = false;

        var $elActivoLotes = $(document.activeElement);
        if ($elActivoLotes.length && $elActivoLotes.closest("#tblVentaDetalle").length) {
            _$controlInvocadorLotes = $elActivoLotes;
        } else {
            _$controlInvocadorLotes = null;
        }

        var $filasConProducto = $("#tblVentaDetalle tbody tr").filter(function () {
            return $(this).find(".txtDetalleCodigo").val() ? true : false;
        });

        if ($filasConProducto.length === 0) {
            _bloqueoAperturaLotes = false;
            Swal.fire({
                type: "info",
                title: "Sin productos",
                text: "Agregue productos al detalle antes de asignar lotes."
            });
            return;
        }

        var haySinCantidad = false;
        $filasConProducto.each(function () {
            var cant = parseFloat(PV.Detalle.leerCantidadFila($(this))) || 0;
            if (!cant || cant <= 0) {
                haySinCantidad = true;
                return false;
            }
        });

        if (haySinCantidad) {
            _bloqueoAperturaLotes = false;
            Swal.fire({
                type: "warning",
                title: "Productos sin cantidad",
                text: "Todos los productos deben tener una cantidad mayor a 0 antes de asignar lotes."
            });
            return;
        }

        _itemsModalLotes = [];
        _itemSeleccionadoIndice = -1;
        PV.Utils._procesando = false;

        $filasConProducto.each(function () {
            var $fila = $(this);
            var cantidad = parseFloat(PV.Detalle.leerCantidadFila($fila)) || 0;
            var factor = parseFloat($fila.find(".ddlDetalleUmd option:selected").data("factor")) || 1;
            var lotesExistentes = $fila.data("lotes") || [];
            _itemsModalLotes.push({
                codigo: $fila.find(".txtDetalleCodigo").val(),
                descripcion: $fila.find(".txtDetalleDescripcion").val(),
                cantidadAsignar: cantidad * factor,
                $fila: $fila,
                lotesTemp: (lotesExistentes.length > 0 ? lotesExistentes.slice() : []),
                estadoAuto: null
            });
        });

        // Destruir DataTables existentes antes de modificar el DOM
        try {
            if ($.fn.DataTable.isDataTable("#tblLotesProductos"))
                $("#tblLotesProductos").DataTable().destroy();
            if ($.fn.DataTable.isDataTable("#tblLotesDisponibles"))
                $("#tblLotesDisponibles").DataTable().destroy();
            if ($.fn.DataTable.isDataTable("#tblLotesAsignados"))
                $("#tblLotesAsignados").DataTable().destroy();
        } catch (e) { }
        // Limpiar metadata residual de DataTable
        $("#tblLotesProductos, #tblLotesDisponibles, #tblLotesAsignados")
            .removeData("dtable").removeData("DataTable").removeData("dataTable");

        // Limpiar el contenido visible de las 3 tablas
        $("#tblLotesProductos tbody, #tblLotesDisponibles tbody, #tblLotesAsignados tbody").empty();

        // Poblar tabla de productos (antes de mostrar el modal)
        var rows = "";
        _itemsModalLotes.forEach(function (item, idx) {
            var sinCantidad = !item.cantidadAsignar || item.cantidadAsignar <= 0;
            var totalAsignado = (item.lotesTemp || []).reduce(function (s, l) {
                return s + (parseFloat(l.QUANTITY) || 0);
            }, 0);
            var req = Number(item.cantidadAsignar || 0).toFixed(0);
            var asig = Number(totalAsignado).toFixed(0);
            var cls = "";
            var badgeHtml = "";

            if (sinCantidad) {
                cls = "lote-sin-cantidad";
                badgeHtml = '<span class="badge badge-secondary">Sin Cantidad</span>';
            } else if (totalAsignado >= item.cantidadAsignar) {
                cls = "";
                badgeHtml = '<span class="badge badge-primary">Completo</span>';
            } else if (totalAsignado > 0) {
                cls = "lote-asignacion-parcial";
                badgeHtml = '<span class="badge badge-warning" style="background-color:#fd7e14;color:#fff;">Parcial (-' + (item.cantidadAsignar - totalAsignado) + ')</span>';
            } else {
                cls = "";
                badgeHtml = '<span class="badge badge-secondary">Sin Asignar</span>';
            }

            rows += '<tr data-idx="' + idx + '" class="' + cls + '">' +
                '<td>' + (item.codigo || "") + '</td>' +
                '<td>' + (item.descripcion || "") + '</td>' +
                '<td class="text-right">' + req + '</td>' +
                '<td class="text-right celda-lote-asig">' + asig + '</td>' +
                '<td class="text-center celda-lote-estado">' + badgeHtml + '</td>' +
                '</tr>';
        });
        $("#tblLotesProductos tbody").html(rows);

        // Mostrar modal primero, luego inicializar DataTables (evita error parentNode en tabla oculta)
        $("#modalLotesTodos")
            .off("shown.bs.modal.lotesInit")
            .on("shown.bs.modal.lotesInit", function () {
                $(this).off("shown.bs.modal.lotesInit");
                _bloqueoAperturaLotes = false;

                // Inicializar DataTable de productos
                if (!$.fn.DataTable.isDataTable("#tblLotesProductos")) {
                    $("#tblLotesProductos").DataTable({
                        language: { url: "/js/plugins/dataTables/Spanish.js" },
                        pageLength: 10,
                        lengthChange: false,
                        autoWidth: false,
                        searching: false,
                        info: false,
                        paging: false,
                        ordering: false,
                        columnDefs: [
                            { targets: [2], className: "text-right" },
                            { targets: [3], className: "text-right" },
                            { targets: [4], className: "text-center" }
                        ]
                    });
                }

                // Inicializar DataTable de disponibles
                if (!$.fn.DataTable.isDataTable("#tblLotesDisponibles")) {
                    $("#tblLotesDisponibles").DataTable({
                        language: {
                            url: "/js/plugins/dataTables/Spanish.js",
                            emptyTable: "Seleccione un producto para ver sus lotes."
                        },
                        pageLength: 10,
                        lengthChange: false,
                        autoWidth: false,
                        searching: false,
                        info: false,
                        paging: true,
                        ordering: false,
                        columnDefs: [
                            { targets: [2], className: "text-right" },
                            { targets: [3], className: "text-right" }
                        ]
                    });
                }

                // Inicializar DataTable de asignados
                if (!$.fn.DataTable.isDataTable("#tblLotesAsignados")) {
                    $("#tblLotesAsignados").DataTable({
                        language: {
                            url: "/js/plugins/dataTables/Spanish.js",
                            emptyTable: "Sin lotes asignados."
                        },
                        pageLength: 10,
                        lengthChange: false,
                        autoWidth: false,
                        searching: false,
                        info: false,
                        paging: true,
                        ordering: false,
                        columnDefs: [
                            { targets: [2], className: "text-right" }
                        ]
                    });
                }

                $("#btnAsignacionAutomatica, #btnSelLotesTodos")
                    .prop("disabled", $("#btnVentaGuardar").is(":disabled"));
            })
            .modal("show");
    }

    function seleccionarItemLote(idx) {
        if (idx < 0 || idx >= _itemsModalLotes.length) return;

        // Guardar lotes temporales del item anterior
        if (_itemSeleccionadoIndice >= 0 && _itemSeleccionadoIndice < _itemsModalLotes.length) {
            _itemsModalLotes[_itemSeleccionadoIndice].lotesTemp = recolectarLotesAsignadosTabla();
        }

        _itemSeleccionadoIndice = idx;
        $("#tblLotesProductos tbody tr").removeClass("selected");
        $("#tblLotesProductos").find('tr[data-idx="' + idx + '"]').addClass("selected");

        var item = _itemsModalLotes[idx];
        var $fila = item.$fila;
        var codigoArticulo = item.codigo;
        var codigoAlmacen = $("#ddlVentaAlmacen").val();

        if (!codigoArticulo) return;

        // Si el item no tiene cantidad, limpiar tablas y deshabilitar asignacion
        if (!item.cantidadAsignar || item.cantidadAsignar <= 0) {
            var dtDisp = $("#tblLotesDisponibles").DataTable();
            dtDisp.clear().draw();
            var dtAsig = $("#tblLotesAsignados").DataTable();
            dtAsig.clear().draw();
            return;
        }

        // Cargar lotes asignados previos (desde $fila.data("lotes") la primera vez, o desde lotesTemp)
        var lotesPrevios = item.lotesTemp.length > 0 ? item.lotesTemp : ($fila.data("lotes") || []);

        // Mostrar cargando en disponibles
        var dtDisp = $("#tblLotesDisponibles").DataTable();
        dtDisp.clear().draw();
        $("#tblLotesDisponibles tbody").html('<tr><td colspan="7" class="text-center text-muted">Cargando...</td></tr>');

        $.ajax({
            url: "/PuntoVenta/Buscar_LotesArticulo",
            type: "GET",
            dataType: "json",
            data: {
                codigoArticulo: codigoArticulo,
                codigoAlmacen: codigoAlmacen
            },
            success: function (data) {
                // Poblar lotes disponibles
                dtDisp.clear();

                if (!data || data.length === 0) {
                    dtDisp.draw();
                    $("#tblLotesDisponibles tbody").html('<tr><td colspan="7" class="text-center text-muted">No hay lotes disponibles.</td></tr>');
                } else {
                    var readOnly = $("#btnVentaGuardar").is(":disabled");
                    data.forEach(function (lote) {
                        var sysnumber = String(lote.SYSNUMBER || "");
                        var asignadoOtros = obtenerCantidadLoteAsignadoOtrosItems(idx, codigoArticulo, sysnumber);
                        var dispReal = Math.max(0, (parseFloat(lote.QUANTITY) || 0) - asignadoOtros);

                        dtDisp.row.add([
                            lote.DISTNUMBER || "",
                            lote.FECHA_VENCIMIENTO || "",
                            Number(dispReal).toFixed(2),
                            readOnly || dispReal <= 0
                                ? '<input type="number" class="form-control form-control-sm txt-cantidad-lote-disponible" min="0" max="' + dispReal + '" step="1" value="0" style="width:80px" disabled />'
                                : '<input type="number" class="form-control form-control-sm txt-cantidad-lote-disponible" min="0" max="' + dispReal + '" step="1" value="0" style="width:80px" />',
                            lote.FECHA_INGRESO || "",
                            readOnly || dispReal <= 0
                                ? '<button type="button" class="btn btn-sm btn-custom btn-asignar-lote" title="Asignar" disabled><i class="fa fa-plus"></i></button>'
                                : '<button type="button" class="btn btn-sm btn-custom btn-asignar-lote" title="Asignar"><i class="fa fa-plus"></i></button>',
                            lote.PROTOCOLO || ""
                        ]).node().setAttribute("data-sysnumber", sysnumber);
                    });
                    dtDisp.draw();
                    // Asignar data a las filas agregadas
                    $("#tblLotesDisponibles tbody tr").each(function (i) {
                        if (data[i]) {
                            var sysnumber = String(data[i].SYSNUMBER || "");
                            var asignadoOtros = obtenerCantidadLoteAsignadoOtrosItems(idx, codigoArticulo, sysnumber);
                            var dispReal = Math.max(0, (parseFloat(data[i].QUANTITY) || 0) - asignadoOtros);
                            $(this).attr("data-sysnumber", sysnumber);
                            $(this).attr("data-distnumber", data[i].DISTNUMBER || "");
                            $(this).attr("data-quantity", dispReal);
                        }
                    });
                }

                // Poblar lotes asignados
                poblarLotesAsignados(lotesPrevios, codigoArticulo);
            },
            error: function (xhr) {
                Swal.fire({
                    type: "error",
                    title: "Error",
                    text: xhr.responseJSON?.error || "Error al cargar lotes."
                });
            }
        });
    }

    function poblarLotesAsignados(lotes, codigoArticulo) {
        var dtAsig = $("#tblLotesAsignados").DataTable();
        dtAsig.clear();

        if (!lotes || lotes.length === 0) {
            dtAsig.draw();
            return;
        }

        var readOnly = $("#btnVentaGuardar").is(":disabled");
        lotes.forEach(function (l) {
            dtAsig.row.add([
                l.DISTNUMBER || "",
                l.SYSNUMBER || "",
                Number(l.QUANTITY || 0).toFixed(0),
                readOnly
                    ? '<button type="button" class="btn btn-sm btn-danger btn-eliminar-lote" title="Eliminar" disabled><i class="fa fa-trash"></i></button>'
                    : '<button type="button" class="btn btn-sm btn-danger btn-eliminar-lote" title="Eliminar"><i class="fa fa-trash"></i></button>'
            ]).node().setAttribute("data-sysnumber", l.SYSNUMBER || "");
        });
        dtAsig.draw();

        // Asignar data a las filas agregadas
        $("#tblLotesAsignados tbody tr").each(function (i) {
            if (lotes[i]) {
                $(this).attr("data-sysnumber", lotes[i].SYSNUMBER || "");
                $(this).attr("data-distnumber", lotes[i].DISTNUMBER || "");
            }
        });

        // Descontar de disponibles los lotes que ya estaban asignados
        if (lotes && lotes.length > 0) {
            lotes.forEach(function (l) {
                var $dr = $("#tblLotesDisponibles").find('tr[data-sysnumber="' + l.SYSNUMBER + '"]');
                if ($dr.length) {
                    var da = parseFloat($dr.data("quantity")) || 0;
                    var nd = Math.max(0, da - (parseFloat(l.QUANTITY) || 0));
                    $dr.data("quantity", nd);
                    $dr.find("td").eq(2).text(nd.toFixed(2));
                    if (nd <= 0) {
                        $dr.find(".txt-cantidad-lote-disponible, .btn-asignar-lote").prop("disabled", true);
                    }
                }
            });
        }
    }

    function recolectarLotesAsignadosTabla() {
        var lotes = [];
        var dtAsig = $("#tblLotesAsignados").DataTable();
        dtAsig.rows().every(function () {
            var data = this.data();
            if (!data || data.length < 3) return;
            var rowNode = this.node();
            var distnumber = $(rowNode).data("distnumber") || String(data[0] || "");
            var sysnumber = $(rowNode).data("sysnumber") || String(data[1] || "");
            var cantidad = parseInt(String(data[2]).trim()) || 0;
            if (cantidad <= 0) return;
            lotes.push({
                ITEMCODE: "",
                SYSNUMBER: sysnumber,
                DISTNUMBER: distnumber,
                QUANTITY: cantidad
            });
        });
        return lotes;
    }

    function asignarLote($btn) {
        if (_itemSeleccionadoIndice < 0) return;
        if ($("#btnVentaGuardar").is(":disabled")) return;

        var $row = $btn.closest("tr");
        var sysnumber = $row.data("sysnumber") || $row.find("td").eq(1).text().trim();
        var distnumber = $row.data("distnumber") || $row.find("td").eq(0).text().trim();
        var cantidadDisp = parseFloat($row.data("quantity")) || parseFloat($row.find("td").eq(2).text().trim()) || 0;
        var cantidad = parseInt($row.find(".txt-cantidad-lote-disponible").val()) || 0;

        if (cantidad <= 0) {
            Swal.fire({
                type: "warning",
                title: "Cantidad inválida",
                text: "Ingrese una cantidad mayor a cero."
            });
            return;
        }

        if (cantidad > cantidadDisp) {
            Swal.fire({
                type: "warning",
                title: "Cantidad excede disponible",
                text: "La cantidad a asignar (" + cantidad + ") supera la disponible (" + cantidadDisp.toFixed(2) + ")."
            });
            return;
        }

        // Validar que no exceda la cantidad requerida del item
        var item = _itemsModalLotes[_itemSeleccionadoIndice];
        var totalAsignado = 0;
        var dtAsig = $("#tblLotesAsignados").DataTable();
        dtAsig.rows().every(function () {
            var data = this.data();
            if (data && data.length >= 3) {
                totalAsignado += parseInt(String(data[2]).trim()) || 0;
            }
        });
        var maxPosible = item.cantidadAsignar - totalAsignado;

        if (cantidad > maxPosible) {
            Swal.fire({
                type: "warning",
                title: "Cantidad excede lo requerido",
                text: "La cantidad total a asignar (" + (totalAsignado + cantidad) + ") supera la cantidad requerida (" + item.cantidadAsignar + "). Solo puede asignar " + maxPosible + " más."
            });
            return;
        }

        // Verificar si el lote ya está asignado
        var yaAsignado = false;
        $("#tblLotesAsignados tbody tr").each(function () {
            var s = $(this).data("sysnumber") || $(this).find("td").eq(1).text().trim();
            if (s === sysnumber) {
                yaAsignado = true;
            }
        });

        if (yaAsignado) {
            Swal.fire({
                type: "warning",
                title: "Lote ya asignado",
                text: "Este lote ya ha sido asignado. Elimínelo primero si desea cambiarlo."
            });
            return;
        }

        var dtAsig = $("#tblLotesAsignados").DataTable();
        dtAsig.row.add([
            distnumber,
            sysnumber,
            Number(cantidad).toFixed(0),
            '<button type="button" class="btn btn-sm btn-danger btn-eliminar-lote" title="Eliminar"><i class="fa fa-trash"></i></button>'
        ]).node().setAttribute("data-sysnumber", sysnumber);
        dtAsig.draw();
        $("#tblLotesAsignados tbody tr:last")
            .attr("data-sysnumber", sysnumber)
            .attr("data-distnumber", distnumber);

        // Limpiar input
        $row.find(".txt-cantidad-lote-disponible").val("0");

        // Descontar visualmente de la tabla disponibles
        var cantDisp = parseFloat($row.data("quantity")) || 0;
        var nuevoDisp = Math.max(0, cantDisp - cantidad);
        $row.data("quantity", nuevoDisp);
        $row.find("td").eq(2).text(nuevoDisp.toFixed(2));
        if (nuevoDisp <= 0) {
            $row.find(".txt-cantidad-lote-disponible").prop("disabled", true);
            $btn.prop("disabled", true);
        }

        _itemsModalLotes[_itemSeleccionadoIndice].lotesTemp = recolectarLotesAsignadosTabla();
        actualizarFilasProductos();
    }

    function eliminarLoteAsignado($btn) {
        if ($("#btnVentaGuardar").is(":disabled")) return;
        var $row = $btn.closest("tr");
        var sysnumber = $row.data("sysnumber") || $row.find("td").eq(1).text().trim();
        var cantidad = parseInt($row.find("td").eq(2).text().trim()) || 0;
        var dtAsig = $("#tblLotesAsignados").DataTable();
        dtAsig.row($row).remove().draw();

        // Restaurar cantidad en disponibles
        var $dispRow = $("#tblLotesDisponibles").find('tr[data-sysnumber="' + sysnumber + '"]');
        if ($dispRow.length) {
            var dispActual = parseFloat($dispRow.data("quantity")) || 0;
            var nuevoDisp = dispActual + cantidad;
            $dispRow.data("quantity", nuevoDisp);
            $dispRow.find("td").eq(2).text(nuevoDisp.toFixed(2));
            $dispRow.find(".txt-cantidad-lote-disponible, .btn-asignar-lote").prop("disabled", false);
        }

        if (_itemSeleccionadoIndice >= 0 && _itemSeleccionadoIndice < _itemsModalLotes.length) {
            _itemsModalLotes[_itemSeleccionadoIndice].lotesTemp = recolectarLotesAsignadosTabla();
            actualizarFilasProductos();
        }
    }

    function actualizarFilasProductos() {
        _itemsModalLotes.forEach(function (item, idx) {
            var sinCantidad = !item.cantidadAsignar || item.cantidadAsignar <= 0;
            var totalAsignado = (item.lotesTemp || []).reduce(function (s, l) {
                return s + (parseFloat(l.QUANTITY) || 0);
            }, 0);
            var faltante = item.cantidadAsignar - totalAsignado;
            var cls = "";
            var badgeHtml = "";

            if (sinCantidad) {
                cls = "lote-sin-cantidad";
                badgeHtml = '<span class="badge badge-secondary">Sin Cantidad</span>';
            } else if (item.errorMultiLote) {
                cls = "lote-asignacion-multilote";
                badgeHtml = '<span class="badge badge-danger">MultiLote Pza</span>';
            } else if (totalAsignado >= item.cantidadAsignar) {
                cls = "";
                badgeHtml = '<span class="badge badge-primary">Completo</span>';
            } else if (totalAsignado > 0) {
                cls = "lote-asignacion-parcial";
                badgeHtml = '<span class="badge badge-warning" style="background-color:#fd7e14;color:#fff;">Parcial (-' + faltante + ')</span>';
            } else {
                if (item.estadoAuto === "sin_lote") {
                    cls = "lote-asignacion-parcial";
                    badgeHtml = '<span class="badge badge-danger">Sin Lote</span>';
                } else {
                    cls = "";
                    badgeHtml = '<span class="badge badge-secondary">Sin Asignar</span>';
                }
            }

            var $row = $("#tblLotesProductos").find('tr[data-idx="' + idx + '"]');
            $row.removeClass("lote-sin-cantidad lote-asignacion-parcial lote-asignacion-multilote");
            if (cls) $row.addClass(cls);
            $row.find(".celda-lote-asig").text(Number(totalAsignado).toFixed(0));
            $row.find(".celda-lote-estado").html(badgeHtml);
        });
    }

    function asignacionAutomatica() {
        if (PV.Utils._procesando) return;
        if ($("#btnVentaGuardar").is(":disabled")) return;
        var itemsPendientes = _itemsModalLotes.filter(function (item) {
            return item.cantidadAsignar && item.cantidadAsignar > 0;
        });

        if (itemsPendientes.length === 0) return;

        _itemsModalLotes.forEach(function (it) { it.errorMultiLote = false; });

        PV.Utils._procesando = true;

        // Guardar lotes temporales del item actual primero
        if (_itemSeleccionadoIndice >= 0 && _itemSeleccionadoIndice < _itemsModalLotes.length) {
            _itemsModalLotes[_itemSeleccionadoIndice].lotesTemp = recolectarLotesAsignadosTabla();
        }
        _itemSeleccionadoIndice = -1;

        var total = itemsPendientes.length;
        var almacen = $("#ddlVentaAlmacen").val();
        var codigosItems = itemsPendientes.map(function (it) { return it.codigo; });

        PV.Utils.mostrarModalProgreso("Asignando lotes automáticos...", "Consultando lotes desde SAP...", total);

        $.ajax({
            url: "/PuntoVenta/Buscar_LotesArticulosBatch",
            type: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                Items: codigosItems,
                CodigoAlmacen: almacen
            }),
            success: function (dictLotes) {
                dictLotes = dictLotes || {};
                var sinLoteUnico = [];
                var itemsIncompletos = [];
                var consumoLotesPorArticulo = {};

                itemsPendientes.forEach(function (item) {
                    var rawLotes = dictLotes[item.codigo] || dictLotes[item.codigo.toUpperCase()] || [];
                    var lotes = rawLotes.slice().sort(function (a, b) {
                        var da = (a.FECHA_VENCIMIENTO || "").split("/");
                        var db = (b.FECHA_VENCIMIENTO || "").split("/");
                        return new Date(da[2], da[1] - 1, da[0]) - new Date(db[2], db[1] - 1, db[0]);
                    });

                    var esPza = PV.Detalle.esUmdPza(item.$fila);
                    var restante = item.cantidadAsignar;
                    var asignados = [];

                    if (esPza) {
                        for (var i = 0; i < lotes.length; i++) {
                            var sysKey = item.codigo + "___" + String(lotes[i].SYSNUMBER || "");
                            var yaConsumido = consumoLotesPorArticulo[sysKey] || 0;
                            var disp = Math.max(0, (parseFloat(lotes[i].QUANTITY) || 0) - yaConsumido);
                            if (disp <= 0) continue;
                            if (disp >= restante) {
                                asignados.push({
                                    ITEMCODE: item.codigo,
                                    SYSNUMBER: String(lotes[i].SYSNUMBER || ""),
                                    DISTNUMBER: String(lotes[i].DISTNUMBER || ""),
                                    QUANTITY: restante
                                });
                                consumoLotesPorArticulo[sysKey] = yaConsumido + restante;
                                restante = 0;
                                break;
                            }
                        }
                        if (restante > 0) {
                            sinLoteUnico.push({
                                codigo: item.codigo,
                                descripcion: item.descripcion,
                                asignado: item.cantidadAsignar - restante,
                                requerido: item.cantidadAsignar,
                                faltante: restante
                            });
                            item.errorMultiLote = true;
                            item.estadoAuto = "multilote";
                        } else {
                            item.estadoAuto = "completo";
                        }
                    } else {
                        for (var i = 0; i < lotes.length && restante > 0; i++) {
                            var sysKey = item.codigo + "___" + String(lotes[i].SYSNUMBER || "");
                            var yaConsumido = consumoLotesPorArticulo[sysKey] || 0;
                            var disp = Math.max(0, (parseFloat(lotes[i].QUANTITY) || 0) - yaConsumido);
                            if (disp <= 0) continue;
                            var asignar = Math.min(restante, disp);
                            asignados.push({
                                ITEMCODE: item.codigo,
                                SYSNUMBER: String(lotes[i].SYSNUMBER || ""),
                                DISTNUMBER: String(lotes[i].DISTNUMBER || ""),
                                QUANTITY: asignar
                            });
                            consumoLotesPorArticulo[sysKey] = yaConsumido + asignar;
                            restante -= asignar;
                        }
                        if (restante > 0) {
                            itemsIncompletos.push({
                                codigo: item.codigo,
                                descripcion: item.descripcion,
                                asignado: item.cantidadAsignar - restante,
                                requerido: item.cantidadAsignar,
                                faltante: restante
                            });
                            item.estadoAuto = asignados.length > 0 ? "parcial" : "sin_lote";
                        } else {
                            item.estadoAuto = "completo";
                        }
                    }

                    item.lotesTemp = asignados;
                });

                PV.Utils.actualizarModalProgreso(total, total, "Completado");
                PV.Utils.cerrarModalProgreso(400, function () {
                    PV.Utils._procesando = false;
                    actualizarFilasProductos();

                    if (_itemsModalLotes.length > 0) {
                        for (var i = 0; i < _itemsModalLotes.length; i++) {
                            if (_itemsModalLotes[i].lotesTemp.length > 0) {
                                seleccionarItemLote(i);
                                break;
                            }
                        }
                    }

                    if (sinLoteUnico.length > 0 || itemsIncompletos.length > 0) {
                        var filasTablaHtml = "";

                        sinLoteUnico.forEach(function (f) {
                            filasTablaHtml += '<tr>' +
                                '<td class="text-center font-weight-bold">' + f.codigo + '</td>' +
                                '<td class="text-left">' + f.descripcion + '</td>' +
                                '<td class="text-right">' + Number(f.requerido || 0).toFixed(0) + '</td>' +
                                '<td class="text-right">' + Number(f.asignado || 0).toFixed(0) + '</td>' +
                                '<td class="text-right font-weight-bold text-danger">' + Number(f.faltante || 0).toFixed(0) + '</td>' +
                                '<td class="text-center"><span class="badge badge-danger">MultiLote Pza</span></td>' +
                                '</tr>';
                        });

                        itemsIncompletos.forEach(function (p) {
                            var badge = p.asignado > 0
                                ? '<span class="badge badge-warning" style="background-color:#fd7e14;color:#fff;">Parcial</span>'
                                : '<span class="badge badge-danger">Sin Lote</span>';

                            filasTablaHtml += '<tr>' +
                                '<td class="text-center font-weight-bold">' + p.codigo + '</td>' +
                                '<td class="text-left">' + p.descripcion + '</td>' +
                                '<td class="text-right">' + Number(p.requerido || 0).toFixed(0) + '</td>' +
                                '<td class="text-right">' + Number(p.asignado || 0).toFixed(0) + '</td>' +
                                '<td class="text-right font-weight-bold text-danger">' + Number(p.faltante || 0).toFixed(0) + '</td>' +
                                '<td class="text-center">' + badge + '</td>' +
                                '</tr>';
                        });

                        var htmlTabla = '<div class="table-responsive mb-2" style="max-height: 260px; overflow-y: auto;">' +
                            '<table class="table table-sm table-bordered table-striped text-left mb-0" style="font-size: 12px; width: 100%;">' +
                            '<thead>' +
                            '<tr style="background-color: #1ab394; color: white;">' +
                            '<th style="background-color: #1ab394; color: white; width: 85px; text-align: center; border-color: #16987e;">Código</th>' +
                            '<th style="background-color: #1ab394; color: white; border-color: #16987e;">Descripción</th>' +
                            '<th style="background-color: #1ab394; color: white; width: 50px; text-align: right; border-color: #16987e;">Req.</th>' +
                            '<th style="background-color: #1ab394; color: white; width: 50px; text-align: right; border-color: #16987e;">Asig.</th>' +
                            '<th style="background-color: #1ab394; color: white; width: 55px; text-align: right; border-color: #16987e;">Faltan</th>' +
                            '<th style="background-color: #1ab394; color: white; width: 105px; text-align: center; border-color: #16987e;">Motivo</th>' +
                            '</tr>' +
                            '</thead>' +
                            '<tbody>' + filasTablaHtml + '</tbody>' +
                            '</table>' +
                            '</div>' +
                            '<div class="alert alert-warning py-2 px-3 text-left mb-0" style="background-color:#ffe8cc;border-color:#fd7e14;color:#7d3c00;font-size:12px;">' +
                            '<i class="fa fa-info-circle"></i> Los productos con asignación incompleta están resaltados en <b>color naranja</b> en la lista de productos para su revisión o asignación manual.</div>';

                        Swal.fire({
                            type: "warning",
                            title: "Asignación Parcial / Incompleta",
                            html: htmlTabla,
                            width: "750px",
                            confirmButtonText: "Entendido"
                        });
                    } else {
                        Swal.fire({
                            type: "success",
                            title: "Asignación completada",
                            text: "Se han asignado todos los lotes correctamente.",
                            timer: 2500
                        });
                    }
                });
            },
            error: function () {
                PV.Utils._procesando = false;
                PV.Utils.cerrarModalProgreso(100);
                Swal.fire({
                    type: "error",
                    title: "Error",
                    text: "Error al realizar la asignación automática de lotes en lote."
                });
            }
        });
    }

    function seleccionarLotesTodos() {
        PV.registrarCambios();
        if (PV.Utils._procesando) return;
        PV.Utils._procesando = true;
        // Guardar lotes temporales del item actual
        if (_itemSeleccionadoIndice >= 0 && _itemSeleccionadoIndice < _itemsModalLotes.length) {
            _itemsModalLotes[_itemSeleccionadoIndice].lotesTemp = recolectarLotesAsignadosTabla();
        }

        // Validar que cada producto tenga la cantidad exacta de lotes asignados
        for (var i = 0; i < _itemsModalLotes.length; i++) {
            var item = _itemsModalLotes[i];
            if (!item.cantidadAsignar || item.cantidadAsignar <= 0) continue;

            var lotesAPersistir;
            if (item.lotesTemp.length > 0) {
                lotesAPersistir = item.lotesTemp;
            } else {
                lotesAPersistir = item.$fila.data("lotes") || [];
            }

            var sumaAsignada = lotesAPersistir.reduce(function (sum, l) {
                return sum + (parseInt(l.QUANTITY) || 0);
            }, 0);

            if (sumaAsignada !== item.cantidadAsignar) {
                PV.Utils._procesando = false;
                var dif = item.cantidadAsignar - sumaAsignada;
                var msg = "Producto " + item.codigo + " (" + item.descripcion + "): "
                    + "tiene " + sumaAsignada + " de " + item.cantidadAsignar + " lotes asignados. "
                    + (dif > 0 ? "Faltan " + dif + "." : "Sobra " + Math.abs(dif) + ".");
                Swal.fire({
                    type: "error",
                    title: "Asignaci\u00f3n incorrecta",
                    text: msg
                });
                return;
            }
        }

        // Persistir a cada fila del detalle (mismo formato que la version anterior)
        _itemsModalLotes.forEach(function (item) {
            var $fila = item.$fila;
            var codigo = item.codigo;

            // Solo guardar si el usuario interactuo con este item en el modal
            // Si lotesTemp esta vacio y nunca se selecciono, preservar lo anterior
            var lotes;
            if (item.lotesTemp.length > 0) {
                lotes = item.lotesTemp.map(function (l) {
                    return {
                        ITEMCODE: codigo,
                        SYSNUMBER: String(l.SYSNUMBER || ""),
                        DISTNUMBER: String(l.DISTNUMBER || ""),
                        QUANTITY: parseInt(l.QUANTITY) || 0
                    };
                });
            } else {
                lotes = $fila.data("lotes") || [];
            }

            $fila.data("lotes", lotes);
            PV.Detalle.setearFechaDesdeLotes($fila, lotes);

            var $loteBtn = $fila.find(".btn-detalle-lote");
            if (lotes.length > 0) {
                $loteBtn.removeClass("btn-outline-primary").addClass("btn-success");
            } else {
                $loteBtn.removeClass("btn-success").addClass("btn-outline-primary");
            }
        });

        _lotesGuardados = true;
        $("#modalLotesTodos").modal("hide");

        PV.Utils._procesando = false;
        Swal.fire({
            type: "success",
            title: "Lotes asignados",
            timer: 1000,
            showConfirmButton: false
        }).then(function () {
            setTimeout(function () {
                if (_$controlInvocadorLotes && _$controlInvocadorLotes.length && document.body.contains(_$controlInvocadorLotes[0])) {
                    _$controlInvocadorLotes.focus();
                    if (_$controlInvocadorLotes.is("input:text") && typeof _$controlInvocadorLotes.select === "function") {
                        _$controlInvocadorLotes.select();
                    }
                }
            }, 50);
        });
    }

    function seleccionarLotes() {
        PV.registrarCambios();
        if (!_$filaModalLotes || !_$filaModalLotes.length) {
            $("#modalLotes").modal("hide");
            return;
        }

        var lotes = [];

        $("#tblLotes tbody tr").each(function () {
            var $chk = $(this).find(".chk-lote");

            if (!$chk.prop("checked")) return;

            var cantidad = parseInt($(this).find(".txt-cantidad-lote").val()) || 0;

            if (cantidad <= 0) return;

            lotes.push({
                ITEMCODE: _$filaModalLotes.find(".txtDetalleCodigo").val() || "",
                SYSNUMBER: String($(this).data("sysnumber") || ""),
                DISTNUMBER: String($(this).data("distnumber") || ""),
                QUANTITY: cantidad
            });
        });

        if (lotes.length === 0) {
            Swal.fire({
                type: "warning",
                title: "Seleccione lotes",
                text: "Marque al menos un lote y especifique la cantidad."
            });
            return;
        }

        _$filaModalLotes.data("lotes", lotes);
        PV.Detalle.setearFechaDesdeLotes(_$filaModalLotes, lotes);

        var totalLote = lotes.reduce(function (sum, l) { return sum + l.QUANTITY; }, 0);
        var msg = lotes.map(function (l) {
            return l.DISTNUMBER + " (" + l.QUANTITY + ")";
        }).join(", ");

        _lotesGuardadosFila = true;
        $("#modalLotes").modal("hide");

        var $loteBtn = _$filaModalLotes.find(".btn-detalle-lote");
        $loteBtn.removeClass("btn-outline-primary").addClass("btn-success");

        Swal.fire({
            type: "success",
            title: "Lotes asignados",
            text: msg,
            timer: 1000,
            showConfirmButton: false
        }).then(function () {
            setTimeout(function () {
                if (_$controlInvocadorLotesFila && _$controlInvocadorLotesFila.length && document.body.contains(_$controlInvocadorLotesFila[0])) {
                    _$controlInvocadorLotesFila.focus();
                    if (_$controlInvocadorLotesFila.is("input:text") && typeof _$controlInvocadorLotesFila.select === "function") {
                        _$controlInvocadorLotesFila.select();
                    }
                } else if (_$filaModalLotes && _$filaModalLotes.length && document.body.contains(_$filaModalLotes[0])) {
                    PV.Detalle.enfocarCantidadFila(_$filaModalLotes);
                }
            }, 50);
        });
    }

    return {
        inicializar: inicializar,
        abrirModalBusquedaItems: abrirModalBusquedaItems,
        abrirModalLotesFila: abrirModalLotesFila,
        abrirModalLotesTodosItems: abrirModalLotesTodosItems
    };

})();
