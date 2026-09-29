window.PV = window.PV || {};

PV.esc = function (s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

PV.mostrarSinImagen = function (img, codigo, descripcion) {
    if (!codigo && img) codigo = img.getAttribute("data-codigo") || "";
    if (!descripcion && img) descripcion = img.getAttribute("data-descripcion") || "";
    var titulo = descripcion || codigo;
    Swal.fire({
        title: titulo,
        html:
            '<div style="color:#6c757d;font-size:0.9rem;margin-bottom:12px;">Código: ' + PV.esc(codigo || "") + '</div>' +
            '<div style="text-align:center;padding:15px;color:#6c757d;">' +
                '<i class="fa fa-image fa-3x text-muted mb-2 d-block" style="opacity:0.45;"></i>' +
                '<div>La imagen aún no está cargada en el catálogo.</div>' +
            '</div>',
        width: 480,
        confirmButtonColor: "#1ab394",
        confirmButtonText: "Cerrar"
    });
};

PV.Detalle = (function () {

    var _modoLectura = false;
    var _bloqueadoPorCliente = false;
    var _batchPromoEnProceso = false;
    var _filaFraccionadoEnCurso = null;
    var _filaFraccionadoDialogo = null;
    var _recolectarErroresFraccionado = false;
    var _erroresFraccionado = [];

    function _resaltarPorVender($fila) {
        var codigo = ($fila.find(".txtDetalleCodigo").val() || "").trim();
        var $txtPorVender = $fila.find(".txtDetallePorVender");
        var $tdPorVender = $txtPorVender.closest("td");
        if (!codigo) {
            $txtPorVender.removeClass("por-vender-cero por-vender-cambiado").removeAttr("title").css({
                "background-color": "",
                "color": "",
                "font-weight": "",
                "border": ""
            });
            $tdPorVender.removeClass("td-por-vender-cambiado").css("background-color", "");
            return;
        }
        var valor = parseFloat($txtPorVender.val()) || 0;
        $txtPorVender.toggleClass("por-vender-cero", valor === 0);
    }

    function _obtenerValorOrden($fila, colIndex) {
        switch (colIndex) {
            case 2: return ($fila.find(".txtDetalleDescripcion").val() || "").toUpperCase();
            case 3: return ($fila.find(".txtDetalleCodigo").val() || "").toUpperCase();
            case 4: return parseFloat($fila.find(".txtDetallePorVender").val()) || 0;
            case 5: return parseFloat(leerCantidadFila($fila)) || 0;
            case 7: return parseFloat($fila.find(".txtDetallePrecio").val()) || 0;
            case 8: return parseFloat($fila.find(".txtDetalleTotal").val()) || 0;
            case 9: return ($fila.find(".txtDetalleVencimiento").val() || "").toUpperCase();
            default: return "";
        }
    }

    function ordenarDetalle(colIndex, tipo) {
        var $tbody = $("#tblVentaDetalle tbody");
        var $filas = $tbody.find("tr").filter(function () {
            var codigo = $(this).find(".txtDetalleCodigo").val();
            return codigo && codigo.trim() !== "";
        });
        var $filaVacia = $tbody.find("tr").filter(function () {
            var codigo = $(this).find(".txtDetalleCodigo").val();
            return !codigo || codigo.trim() === "";
        });

        $filaVacia.detach();

        $filas.sort(function (a, b) {
            var valA = _obtenerValorOrden($(a), colIndex);
            var valB = _obtenerValorOrden($(b), colIndex);
            if (typeof valA === "number") return tipo === "asc" ? valA - valB : valB - valA;
            return tipo === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });

        $filas.each(function () { $tbody.append(this); });
        $tbody.append($filaVacia);
    }

    function enfocarCantidadFila($fila) {
        if (!$fila || !$fila.length) return;
        var $inputCant = $fila.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
        if ($inputCant.length) {
            $inputCant.focus();
            if (typeof $inputCant.select === "function" && !$inputCant.is("select")) {
                $inputCant.select();
            }
        }
    }

    function asegurarFocoEnCantidad($fila) {
        if (!$fila || !$fila.length || _modoLectura) return;
        if ($(".modal:visible").length > 0 || $(".swal2-container:visible").length > 0) return;

        setTimeout(function () {
            if ($(".modal:visible").length > 0 || $(".swal2-container:visible").length > 0) return;
            enfocarCantidadFila($fila);
        }, 30);
    }

    function navegarGridVertical($elementoActual, direccion) {
        if (!$elementoActual || !$elementoActual.length) return;

        var $filaActual = $elementoActual.closest("tr");
        var $filas = $("#tblVentaDetalle tbody tr");
        if ($filas.length === 0) return;

        var indexActual = $filas.index($filaActual);
        if (indexActual === -1) return;

        var indexDestino = indexActual + direccion;
        if (direccion > 0 && indexDestino >= $filas.length) {
            if (!filaDetalleEstaVacia($filaActual)) {
                asegurarFilaVaciaFinal();
                $filas = $("#tblVentaDetalle tbody tr");
                indexDestino = $filas.length - 1;
            } else {
                return;
            }
        }
        if (indexDestino < 0 || indexDestino >= $filas.length) return;

        var $filaDestino = $filas.eq(indexDestino);
        var $target = null;

        if ($elementoActual.hasClass("txtDetalleCantidad") || $elementoActual.hasClass("txtDetalleCantidadSelect")) {
            $target = $filaDestino.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
            if (!$target.length) {
                var $desc = $filaDestino.find(".txtDetalleDescripcion:not([disabled])");
                if ($desc.length) {
                    $target = $desc;
                } else {
                    $target = $filaDestino.find("input:not([readonly]):not(:disabled), select:not(:disabled)").first();
                }
            }
        } else if ($elementoActual.hasClass("txtDetalleDescripcion")) {
            $target = $filaDestino.find(".txtDetalleDescripcion:not([disabled])").first();
            if (!$target.length) {
                var $cant = $filaDestino.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
                if ($cant.length) $target = $cant;
            }
        } else if ($elementoActual.hasClass("txtDetalleCodigo")) {
            $target = $filaDestino.find(".txtDetalleCodigo:not([disabled])").first();
            if (!$target.length || $target.prop("readonly")) {
                var $cant = $filaDestino.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
                if ($cant.length) $target = $cant;
            }
        } else if ($elementoActual.hasClass("ddlDetalleUmd")) {
            $target = $filaDestino.find(".ddlDetalleUmd:not(:disabled)").first();
            if (!$target.length) {
                $target = $filaDestino.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
            }
        } else if ($elementoActual.hasClass("txtDetalleVencimiento")) {
            $target = $filaDestino.find(".txtDetalleVencimiento:not(:disabled)").first();
            if (!$target.length) {
                $target = $filaDestino.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
            }
        } else {
            var clases = ($elementoActual.attr("class") || "").split(/\s+/);
            for (var i = 0; i < clases.length; i++) {
                var c = clases[i];
                if (c && (c.indexOf("txtDetalle") === 0 || c.indexOf("ddlDetalle") === 0)) {
                    $target = $filaDestino.find("." + c + ":not(:disabled):not([readonly])").first();
                    if ($target.length) break;
                }
            }
            if (!$target || !$target.length) {
                $target = $filaDestino.find("input:not([readonly]):not(:disabled), select:not(:disabled)").first();
            }
        }

        if ($target && $target.length) {
            $target.focus();
            if ($target.is("input")) {
                setTimeout(function () {
                    $target.select();
                }, 10);
            }
            if ($filaDestino[0] && $filaDestino[0].scrollIntoView) {
                $filaDestino[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }
    }

    function navegarGridHorizontal($elementoActual, direccion, e) {
        if (!$elementoActual || !$elementoActual.length) return;

        var $fila = $elementoActual.closest("tr");
        if (!$fila.length) return;

        if ($elementoActual.is("input[type='text'], input[type='number']")) {
            var val = $elementoActual.val() || "";
            var el = $elementoActual[0];
            var isReadonly = $elementoActual.prop("readonly");

            if (!isReadonly && el.selectionStart !== undefined && el.selectionEnd !== undefined) {
                var todoSeleccionado = el.selectionStart === 0 && el.selectionEnd === val.length && val.length > 0;
                if (direccion > 0) {
                    if (!todoSeleccionado && el.selectionStart !== val.length) {
                        return;
                    }
                } else {
                    if (!todoSeleccionado && el.selectionStart !== 0) {
                        return;
                    }
                }
            }
        }

        var $target = null;

        if (direccion > 0) {
            if ($elementoActual.hasClass("txtDetalleDescripcion")) {
                var $cod = $fila.find(".txtDetalleCodigo:not([disabled]):not([readonly])");
                if ($cod.length) {
                    $target = $cod;
                } else {
                    $target = $fila.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
                }
            } else if ($elementoActual.hasClass("txtDetalleCodigo")) {
                $target = $fila.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
            } else if ($elementoActual.hasClass("txtDetalleCantidad") || $elementoActual.hasClass("txtDetalleCantidadSelect")) {
                var $umd = $fila.find(".ddlDetalleUmd:not(:disabled)");
                if ($umd.length) {
                    $target = $umd;
                } else {
                    var $venc = $fila.find(".txtDetalleVencimiento:not(:disabled)");
                    if ($venc.length) $target = $venc;
                }
            } else if ($elementoActual.hasClass("ddlDetalleUmd")) {
                var $venc = $fila.find(".txtDetalleVencimiento:not(:disabled)");
                if ($venc.length) $target = $venc;
            }
        } else {
            if ($elementoActual.hasClass("txtDetalleVencimiento")) {
                var $umd = $fila.find(".ddlDetalleUmd:not(:disabled)");
                if ($umd.length) {
                    $target = $umd;
                } else {
                    $target = $fila.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
                }
            } else if ($elementoActual.hasClass("ddlDetalleUmd")) {
                $target = $fila.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
            } else if ($elementoActual.hasClass("txtDetalleCantidad") || $elementoActual.hasClass("txtDetalleCantidadSelect")) {
                var $cod = $fila.find(".txtDetalleCodigo:not([disabled]):not([readonly])");
                if ($cod.length) {
                    $target = $cod;
                } else {
                    $target = $fila.find(".txtDetalleDescripcion:not([disabled])").first();
                }
            } else if ($elementoActual.hasClass("txtDetalleCodigo")) {
                $target = $fila.find(".txtDetalleDescripcion:not([disabled])").first();
            }
        }

        if ($target && $target.length) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            $target.focus();
            if ($target.is("input")) {
                setTimeout(function () {
                    $target.select();
                }, 10);
            }
        }
    }

    function navegarEnterEnDetalle($elementoActual, e) {
        if (!$elementoActual || !$elementoActual.length) return;

        var $fila = $elementoActual.closest("tr");
        if (!$fila.length) return;

        if ($elementoActual.hasClass("txtDetalleCantidad") || $elementoActual.hasClass("txtDetalleCantidadSelect")) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            $elementoActual.trigger("blur");
            recalcularLinea($fila);
            recalcularTotales();

            var $filas = $("#tblVentaDetalle tbody tr");
            var indexActual = $filas.index($fila);
            var indexSiguiente = indexActual + 1;

            if (indexSiguiente >= $filas.length) {
                if (!filaDetalleEstaVacia($fila)) {
                    asegurarFilaVaciaFinal();
                    $filas = $("#tblVentaDetalle tbody tr");
                    indexSiguiente = $filas.length - 1;
                }
            }

            if (indexSiguiente < $filas.length) {
                var $filaSiguiente = $filas.eq(indexSiguiente);
                if (filaDetalleEstaVacia($filaSiguiente)) {
                    var $desc = $filaSiguiente.find(".txtDetalleDescripcion:not([disabled])");
                    if ($desc.length) {
                        $desc.focus().select();
                        if ($filaSiguiente[0] && $filaSiguiente[0].scrollIntoView) {
                            $filaSiguiente[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }
                        return;
                    }
                } else {
                    var $cant = $filaSiguiente.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
                    if ($cant.length) {
                        $cant.focus();
                        if ($cant.is("input")) $cant.select();
                        if ($filaSiguiente[0] && $filaSiguiente[0].scrollIntoView) {
                            $filaSiguiente[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }
                        return;
                    }
                }
            }
        } else if ($elementoActual.hasClass("txtDetalleDescripcion") || $elementoActual.hasClass("txtDetalleCodigo")) {
            if ($elementoActual.prop("readonly")) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                var $cant = $fila.find(".txtDetalleCantidad:not([readonly]):not(:disabled), .txtDetalleCantidadSelect:not(:disabled)").first();
                if ($cant.length) {
                    $cant.focus();
                    if ($cant.is("input")) $cant.select();
                }
            }
        } else if ($elementoActual.hasClass("ddlDetalleUmd")) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            navegarGridVertical($elementoActual, 1);
        }
    }

    function navegarCeldaVertical($elementoActual, direccion) {
        navegarGridVertical($elementoActual, direccion);
    }

    function inicializar() {
        agregarFilaDetalleVacia();
        registrarEventos();
    }

    function registrarEventos() {
        // Redimensionamiento manual de la columna Descripción
        $(document).off("mousedown.colResize", "#tblVentaDetalle thead .col-resizer").on("mousedown.colResize", "#tblVentaDetalle thead .col-resizer", function (e) {
            e.preventDefault();
            e.stopPropagation();

            var $resizer = $(this);
            var $th = $resizer.closest("th");
            var startX = e.pageX;
            var startWidth = $th.outerWidth();

            $resizer.addClass("active");
            $("body").addClass("col-resizing");

            $(document).on("mousemove.colResizeDrag", function (eMove) {
                var deltaX = eMove.pageX - startX;
                var newWidth = Math.max(150, Math.min(1000, startWidth + deltaX));
                $th.css({
                    "width": newWidth + "px",
                    "min-width": newWidth + "px"
                });
            });

            $(document).on("mouseup.colResizeDrag", function () {
                $resizer.removeClass("active");
                $("body").removeClass("col-resizing");
                $(document).off("mousemove.colResizeDrag mouseup.colResizeDrag");
            });
        });

        $(document).off("dblclick.colResize", "#tblVentaDetalle thead .col-resizer").on("dblclick.colResize", "#tblVentaDetalle thead .col-resizer", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var $th = $(this).closest("th");
            $th.css({
                "width": "",
                "min-width": ""
            });
        });

        $(document).off("click.ordenarDetalle").on("click.ordenarDetalle", "#tblVentaDetalle .ordenar-col", function (e) {
            if ($(e.target).hasClass("col-resizer") || $(e.target).closest(".col-resizer").length > 0 ||
                $(e.target).is("#btnActualizarStockDetalle, #btnActualizarStockDetalle *") || $(e.target).closest("#btnActualizarStockDetalle").length > 0 ||
                $(e.target).is("button, i.fa-sync-alt") || $(e.target).closest("button").length > 0) {
                return;
            }
            var $th = $(this);
            var colIndex = parseInt($th.data("col"));
            var tipo = $th.hasClass("asc") ? "desc" : "asc";
            $("#tblVentaDetalle .ordenar-col").removeClass("asc desc");
            $th.addClass(tipo);
            ordenarDetalle(colIndex, tipo);
        });

        $(document).off("click.actualizarStockDetalle").on("click.actualizarStockDetalle", "#btnActualizarStockDetalle", function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            actualizarStockPorVenderDetalle();
        });

        $(document).off("click.detalleEliminar").on("click.detalleEliminar", ".btn-detalle-eliminar", function () {
            const $fila = $(this).closest("tr");
            const $tbody = $("#tblVentaDetalle tbody");

            if ($tbody.find("tr").length <= 1) {
                Swal.fire({
                    type: "warning",
                    title: "Última fila",
                    text: "No puede eliminar la única fila."
                });
                return;
            }

            const rowIndex = $fila.index();

            Swal.fire({
                title: "¿Eliminar producto?",
                text: "Esta acción no se puede deshacer.",
                type: "question",
                showCancelButton: true,
                confirmButtonText: "Sí, eliminar",
                cancelButtonText: "Cancelar"
            }).then(function (result) {
                if (result.value) {
                    $fila.removeData("lotes");
                    $fila.remove();
                    PV.registrarCambios();
                    recalcularTotales();
                    asegurarFilaVaciaFinal();

                    var $filasRestantes = $("#tblVentaDetalle tbody tr");
                    var $filaOcupante = $filasRestantes.eq(rowIndex);
                    if (!$filaOcupante.length) {
                        $filaOcupante = $filasRestantes.last();
                    }

                    if ($filaOcupante.length) {
                        var $target = $filaOcupante.find(".txtDetalleDescripcion");
                        if ($target.length && !$target.is(":disabled")) {
                            setTimeout(function () {
                                $target.focus();
                                if (typeof $target.select === "function") {
                                    $target.select();
                                }
                            }, 50);
                        }
                    }
                }
            });
        });

        $(document).off("click.detalleBuscar").on("click.detalleBuscar", ".btn-detalle-buscar", function (e) {
            e.preventDefault();
            const $fila = $(this).closest("tr");
            PV.Hotkeys.abrirModalBusquedaItems($fila);
        });

        $(document).off("click.detalleLote").on("click.detalleLote", ".btn-detalle-lote", function (e) {
            e.preventDefault();
            const $fila = $(this).closest("tr");
            const codigo = $fila.find(".txtDetalleCodigo").val();

            if (!codigo) {
                Swal.fire({
                    type: "warning",
                    title: "Sin producto",
                    text: "Debe seleccionar un producto primero."
                });
                return;
            }

            PV.Hotkeys.abrirModalLotesTodosItems();
        });

        $(document).off("focus.detalleCantidad").on("focus.detalleCantidad", ".txtDetalleCantidad", function () {
            $(this).data("prev-val", $(this).val());
            $(this).select();
        });

        $(document).off("keydown.detalleCantidad").on("keydown.detalleCantidad", ".txtDetalleCantidad", function (e) {
            if (e.key === "." || e.key === "," || e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                e.preventDefault();
                return;
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                navegarGridVertical($(this), 1);
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                navegarGridVertical($(this), -1);
                return;
            }

            if (e.key === "ArrowRight") {
                navegarGridHorizontal($(this), 1, e);
                return;
            }

            if (e.key === "ArrowLeft") {
                navegarGridHorizontal($(this), -1, e);
                return;
            }

            if (e.key === "Enter") {
                navegarEnterEnDetalle($(this), e);
                return;
            }
        });

        $(document).off("keydown.detalleCantidadSelect").on("keydown.detalleCantidadSelect", ".txtDetalleCantidadSelect", function (e) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                navegarGridVertical($(this), 1);
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                navegarGridVertical($(this), -1);
                return;
            }

            if (e.key === "ArrowRight") {
                navegarGridHorizontal($(this), 1, e);
                return;
            }

            if (e.key === "ArrowLeft") {
                navegarGridHorizontal($(this), -1, e);
                return;
            }

            if (e.key === "Enter") {
                navegarEnterEnDetalle($(this), e);
                return;
            }
        });

        $(document).off("keydown.detalleUmd").on("keydown.detalleUmd", ".ddlDetalleUmd", function (e) {
            if (e.key === "ArrowDown" && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                navegarGridVertical($(this), 1);
                return;
            }

            if (e.key === "ArrowUp" && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                navegarGridVertical($(this), -1);
                return;
            }

            if (e.key === "ArrowRight") {
                navegarGridHorizontal($(this), 1, e);
                return;
            }

            if (e.key === "ArrowLeft") {
                navegarGridHorizontal($(this), -1, e);
                return;
            }

            if (e.key === "Enter") {
                navegarEnterEnDetalle($(this), e);
                return;
            }
        });

        $(document).off("keydown.detalleVencimiento").on("keydown.detalleVencimiento", ".txtDetalleVencimiento", function (e) {
            if (e.key === "ArrowDown" && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                navegarGridVertical($(this), 1);
                return;
            }

            if (e.key === "ArrowUp" && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                navegarGridVertical($(this), -1);
                return;
            }

            if (e.key === "ArrowLeft") {
                navegarGridHorizontal($(this), -1, e);
                return;
            }

            if (e.key === "Enter") {
                navegarEnterEnDetalle($(this), e);
                return;
            }
        });

        $(document).off("input.detalleCantidad").on("input.detalleCantidad", ".txtDetalleCantidad", function () {
            var val = $(this).val();
            if (/[^0-9]/.test(val)) {
                $(this).val(val.replace(/[^0-9]/g, ""));
            }
        });

        $(document).off("change.detallePrecio").on("change.detallePrecio", ".txtDetalleCantidad, .txtDetalleCantidadSelect, .txtDetallePrecio", function () {
            const $fila = $(this).closest("tr");
            if ($(this).hasClass("txtDetalleCantidad")) {
                const rawVal = $(this).val();
                if (rawVal !== "") {
                    let valor = parseInt(rawVal, 10);
                    if (isNaN(valor) || valor < 0) {
                        valor = 0;
                    }
                    $(this).val(valor);
                }
            }
            PV.registrarCambios();
            recalcularLinea($fila);
            aplicarPromoArticulo($fila);
            recalcularTotales();
        });

        $(document).off("blur.detalleCantidad").on("blur.detalleCantidad", ".txtDetalleCantidad", function () {
            var $input = $(this);
            var prevVal = $input.data("prev-val");
            var rawVal = $input.val();
            if (rawVal !== "") {
                let valor = parseInt(rawVal, 10);
                if (isNaN(valor) || valor < 0) {
                    valor = 0;
                }
                $input.val(valor);
                rawVal = String(valor);
            }
            if (prevVal === undefined || String(prevVal) !== String(rawVal)) {
                $input.data("prev-val", rawVal);
                const $fila = $input.closest("tr");
                recalcularLinea($fila);
                aplicarPromoArticulo($fila);
                recalcularTotales();
            }
        });

        $(document).off("click.detalleLimpiar").on("click.detalleLimpiar", ".btn-detalle-limpiar", function () {
            const $fila = $(this).closest("tr");
            limpiarFilaDetalle($fila);
            $(this).closest(".input-group").find(".form-control").focus();
        });

        $(document).off("click.detalleImagen").on("click.detalleImagen", ".btn-detalle-imagen", function () {
            const $fila = $(this).closest("tr");
            const codigo = ($fila.attr("data-itemcode") || $fila.find(".txtDetalleCodigo").val() || "").trim();
            if (!codigo) {
                Swal.fire({
                    icon: "warning",
                    title: "Atención",
                    text: "No se ha seleccionado o ingresado el código del artículo en esta fila."
                });
                return;
            }
            const descripcion = ($fila.find(".txtDetalleDescripcion").val() || "").trim() || codigo;

            // Abrir modal con spinner inicial
            Swal.fire({
                title: descripcion,
                html:
                    '<div style="color:#6c757d;font-size:0.9rem;margin-bottom:12px;">' +
                        'Código: <strong>' + PV.esc(codigo) + '</strong>' +
                    '</div>' +
                    '<div id="cntModalImagenArticulo" style="min-height:220px;display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:6px;border:1px dashed #dee2e6;padding:15px;margin-bottom:5px;">' +
                        '<div class="text-center py-3">' +
                            '<i class="fa fa-spinner fa-spin fa-2x" style="color:#1ab394;"></i>' +
                            '<div class="text-muted mt-2" style="font-size:0.85rem;">Buscando imagen en catálogo...</div>' +
                        '</div>' +
                    '</div>',
                width: 500,
                showConfirmButton: true,
                confirmButtonColor: "#1ab394",
                confirmButtonText: "Cerrar"
            });

            // Consultar endpoint
            $.ajax({
                url: "/PuntoVenta/Obtener_ImagenArticulo",
                type: "GET",
                cache: false,
                data: { codigoArticulo: codigo },
                success: function (data) {
                    var $cnt = $("#cntModalImagenArticulo");
                    if (!$cnt.length) return; // Modal cerrado por el usuario

                    var rawSrc = (data && (data.imgRuta || data.ImgRuta || data.ruta || data.Ruta)) || "";
                    if (!rawSrc) {
                        _renderSinImagenModal($cnt);
                        return;
                    }

                    var imgSrc = "/" + rawSrc.replace(/^\/+/, "");
                    var sep = imgSrc.indexOf("?") >= 0 ? "&" : "?";
                    var imgUrl = imgSrc + sep + "t=" + Date.now();

                    $cnt.css({
                        "background": "transparent",
                        "border": "none",
                        "min-height": "auto",
                        "padding": "0"
                    }).html(
                        '<div style="text-align:center;max-height:420px;overflow:hidden;">' +
                            '<img id="imgArticuloModal" src="' + imgUrl + '"' +
                            ' alt="Imagen del producto"' +
                            ' style="max-width:100%;max-height:400px;object-fit:contain;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.12);display:inline-block;" />' +
                        '</div>'
                    );

                    $("#imgArticuloModal").on("error", function () {
                        var $container = $("#cntModalImagenArticulo");
                        if ($container.length) {
                            _renderSinImagenModal($container);
                        }
                    });
                },
                error: function (xhr, status, error) {
                    console.error("Error al consultar imagen:", xhr.status, xhr.responseText, error);
                    var $container = $("#cntModalImagenArticulo");
                    if ($container.length) {
                        _renderErrorCargaModal($container);
                    }
                }
            });
        });

        function _renderSinImagenModal($cnt) {
            $cnt.css({
                "background": "#fbfbfb",
                "border": "1px dashed #ced4da",
                "min-height": "160px",
                "padding": "20px 15px"
            }).html(
                '<div class="text-center py-2">' +
                    '<i class="fa fa-image fa-3x text-muted mb-2 d-block" style="opacity:0.45;"></i>' +
                    '<div class="text-secondary font-weight-500" style="font-size:0.95rem;">La imagen aún no está cargada en el catálogo.</div>' +
                '</div>'
            );
        }

        function _renderErrorCargaModal($cnt) {
            $cnt.css({
                "background": "#fff5f5",
                "border": "1px dashed #f5c6cb",
                "min-height": "160px",
                "padding": "20px 15px"
            }).html(
                '<div class="text-center py-2">' +
                    '<i class="fa fa-exclamation-circle fa-3x text-danger mb-2 d-block" style="opacity:0.7;"></i>' +
                    '<div class="text-danger font-weight-500" style="font-size:0.95rem;">No se pudo obtener la información de la imagen.</div>' +
                '</div>'
            );
        }

        $(document).off("click.detallePromo").on("click.detallePromo", ".btn-detalle-promo", function () {
            var $fila = $(this).closest("tr");
            var codigo = $fila.attr("data-itemcode");
            if (!codigo) return;

            var descripcion = ($fila.find(".txtDetalleDescripcion").val() || "").trim() || codigo;
            var codigoUmd = $fila.find(".ddlDetalleUmd").val();

            if (!codigoUmd) {
                Swal.fire({ type: "info", title: "Incomplete", text: "Seleccione una UMD primero." });
                return;
            }

            var mapListas = {};
            $("#ddlClienteListaPrecio option").each(function () {
                var val = $(this).val();
                if (val) mapListas[val] = $(this).text().trim();
            });

            $.ajax({
                url: "/PuntoVenta/Buscar_PromoArticulo",
                type: "GET",
                data: {
                    codigoArticulo: codigo,
                    codigoCliente: "",
                    codigoListaPrecio: 0,
                    codigoUmd: codigoUmd
                },
                success: function (data) {
                    var promosActivas = (data || []).filter(function (p) {
                        return p.CANTIDAD > 0 && p.PRECIO > 0;
                    });

                    if (promosActivas.length === 0) {
                        Swal.fire({
                            type: "info",
                            title: "Sin promociones",
                            text: "No hay promociones activas para este artículo."
                        });
                        return;
                    }

                    var typeLabels = { Q: "Cantidad", R: "Regalo", P: "Precio", D: "Descuento" };

                    promosActivas.sort(function (a, b) {
                        var cmp = Number(a.CANTIDAD) - Number(b.CANTIDAD);
                        if (cmp !== 0) return cmp;
                        return (a.CODIGO_LISTA_PRECIO || "").localeCompare(b.CODIGO_LISTA_PRECIO || "");
                    });

                    var html = '<div style="text-align:left;">';
                    html += '<table class="table table-sm table-bordered mb-0">';
                    html += '<thead><tr style="background:#1ab394;color:#fff;"><th style="background:transparent;color:#fff;border-color:#18a689;">Cantidad</th><th style="background:transparent;color:#fff;border-color:#18a689;">Precio</th><th style="background:transparent;color:#fff;border-color:#18a689;">Tipo</th><th style="background:transparent;color:#fff;border-color:#18a689;">Lista</th></tr></thead>';
                    html += '<tbody>';
                    promosActivas.forEach(function (p) {
                        var nombreLista = mapListas[p.CODIGO_LISTA_PRECIO] || p.CODIGO_LISTA_PRECIO || "-";
                        html += '<tr>';
                        html += '<td class="text-center">' + Number(p.CANTIDAD).toFixed(0) + '</td>';
                        html += '<td class="text-right">' + Number(p.PRECIO).toFixed(2) + '</td>';
                        html += '<td class="text-center">' + (typeLabels[p.PROMO_TYPE] || p.PROMO_TYPE || "-") + '</td>';
                        html += '<td>' + nombreLista + '</td>';
                        html += '</tr>';
                    });
                    html += '</tbody></table></div>';

                    Swal.fire({
                        title: "Promociones — " + descripcion,
                        html: html,
                        width: 560,
                        confirmButtonText: "Cerrar",
                        confirmButtonColor: "#1ab394"
                    });
                }
            });
        });

        $(document).off("keydown.detalleDescripcion").on("keydown.detalleDescripcion", ".txtDetalleDescripcion", function (e) {
            if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                var autocompleteInstance = $(this).data("ui-autocomplete");
                if (autocompleteInstance) {
                    try { $(this).autocomplete("close"); } catch (ex) { }
                }
                var $fila = $(this).closest("tr");
                PV.Hotkeys.abrirModalBusquedaItems($fila);
                return;
            }

            var autocompleteInstance = $(this).data("ui-autocomplete");
            var menuVisible = autocompleteInstance && autocompleteInstance.menu && (autocompleteInstance.menu.active || (autocompleteInstance.menu.element && autocompleteInstance.menu.element.is(":visible")));

            if (menuVisible) {
                return; // Dejar que jQuery UI Autocomplete maneje flechas y Enter
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                if (autocompleteInstance) {
                    try { $(this).autocomplete("close"); } catch (ex) { }
                }
                navegarGridVertical($(this), 1);
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                if (autocompleteInstance) {
                    try { $(this).autocomplete("close"); } catch (ex) { }
                }
                navegarGridVertical($(this), -1);
                return;
            }

            if (e.key === "ArrowRight") {
                navegarGridHorizontal($(this), 1, e);
                return;
            }

            if (e.key === "ArrowLeft") {
                navegarGridHorizontal($(this), -1, e);
                return;
            }

            if (e.key === "Enter") {
                if (autocompleteInstance) {
                    try { $(this).autocomplete("close"); } catch (ex) { }
                }
                navegarEnterEnDetalle($(this), e);
            }
        });

        $(document).off("keydown.detalleCodigo").on("keydown.detalleCodigo", ".txtDetalleCodigo", function (e) {
            var autocompleteInstance = $(this).data("ui-autocomplete");
            var menuVisible = autocompleteInstance && autocompleteInstance.menu && (autocompleteInstance.menu.active || (autocompleteInstance.menu.element && autocompleteInstance.menu.element.is(":visible")));

            if (menuVisible) {
                return;
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                if (autocompleteInstance) {
                    try { $(this).autocomplete("close"); } catch (ex) { }
                }
                navegarGridVertical($(this), 1);
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                if (autocompleteInstance) {
                    try { $(this).autocomplete("close"); } catch (ex) { }
                }
                navegarGridVertical($(this), -1);
                return;
            }

            if (e.key === "ArrowRight") {
                navegarGridHorizontal($(this), 1, e);
                return;
            }

            if (e.key === "ArrowLeft") {
                navegarGridHorizontal($(this), -1, e);
                return;
            }

            if (e.key === "Enter" || e.key === "Tab") {
                if (e.isDefaultPrevented && e.isDefaultPrevented()) {
                    return;
                }

                if ($(this).prop("readonly")) {
                    navegarEnterEnDetalle($(this), e);
                    return;
                }

                var lastSelectedTime = $(this).data("autocomplete-just-selected") || 0;
                if (Date.now() - lastSelectedTime < 500) {
                    return;
                }

                e.preventDefault();
                if (_modoLectura) return;
                const $fila = $(this).closest("tr");
                const codigo = $(this).val().trim();
                if (!codigo) return;

                const listaPrecio = $("#ddlClienteListaPrecio").val();
                const almacen = $("#ddlVentaAlmacen").val();

                cargarDetalleArticuloVenta(codigo, listaPrecio, almacen, function (detalle) {
                    if (!detalle || !detalle.ARTICULO) return;

                    confirmarItemDuplicado(detalle.ARTICULO.CODIGO, $fila).then(function (ok) {
                        if (ok) {
                            llenarFilaDetalleDesdeDetalleVenta($fila, detalle);
                            asegurarFocoEnCantidad($fila);
                        }
                    });
                }, {
                    mostrarLoading: true,
                    onError: function () {
                        limpiarFilaDetalle($fila);
                        Swal.fire({ type: "error", title: "Error", text: "No se pudo cargar el artículo. Verifique el código e intente nuevamente." });
                    }
                });
            }
        });

        $(document).off("paste.detalleBusqueda").on("paste.detalleBusqueda", ".txtDetalleDescripcion, .txtDetalleCodigo", function () {
            if (_modoLectura) return;
            const $input = $(this);
            setTimeout(function () {
                var term = ($input.val() || "").trim();
                if (term.length >= 1) {
                    $input.autocomplete("search", term);
                }
            }, 30);
        });

        $(document).off("change.detalleListaPrecio").on("change.detalleListaPrecio", "#ddlClienteListaPrecio", function () {
            if (PV.Utils._procesando) return;

            const $rows = $("#tblVentaDetalle tbody tr");
            const items = [];
            const rowsArr = [];

            $rows.each(function () {
                const codigo = $(this).attr("data-itemcode");
                if (codigo) {
                    items.push(codigo);
                    rowsArr.push(this);
                }
            });

            if (items.length === 0) return;

            const listaPrecio = $(this).val();
            const almacen = $("#ddlVentaAlmacen").val();
            const codigoCliente = ($("#txtClienteCodigo").val() || "").trim();
            const total = items.length;

            PV.Utils._procesando = true;
            PV.Utils.mostrarModalProgreso("Actualizando precios...", "Consultando precios desde SAP...", total);

            $.ajax({
                url: "/PuntoVenta/Calcular_PreciosBatch",
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({
                    Items: items,
                    CodigoListaPrecio: parseInt(listaPrecio),
                    CodigoAlmacen: almacen,
                    CodigoCliente: codigoCliente
                }),
                success: function (data) {
                    if (!data || data.length === 0) {
                        PV.Utils.cerrarModalProgreso(200, function () {
                            PV.Utils._procesando = false;
                        });
                        return;
                    }

                    const priceMap = {};
                    const promoMap = {};
                    data.forEach(function (item) {
                        priceMap[item.CODIGO_ARTICULO] = item.PRECIO;
                        if (item.PROMO_TYPE) {
                            promoMap[item.CODIGO_ARTICULO] = promoMap[item.CODIGO_ARTICULO] || [];
                            promoMap[item.CODIGO_ARTICULO].push({
                                PROMO_TYPE: item.PROMO_TYPE,
                                PRECIO: Number(item.PRECIO_PROMO) || 0,
                                CANTIDAD: Number(item.CANTIDAD_PROMO) || 0,
                                DESCUENTO: Number(item.DESCUENTO_PROMO) || 0,
                                UMD: item.UMD_PROMO
                            });
                        }
                    });

                    var index = 0;
                    var batchSize = 10;

                    function procesarLotePrecios() {
                        var limite = Math.min(index + batchSize, rowsArr.length);
                        for (; index < limite; index++) {
                            var $row = $(rowsArr[index]);
                            var codigo = $row.attr("data-itemcode");
                            if (!codigo || priceMap[codigo] === undefined) continue;

                            var $precio = $row.find(".txtDetallePrecio");
                            $precio.data("preciobase", Number(priceMap[codigo]));

                            _batchPromoEnProceso = true;
                            $row.find(".ddlDetalleUmd").trigger("change");
                            _batchPromoEnProceso = false;

                            var promo = promoMap[codigo];
                            var $ddl = $row.find(".ddlDetalleUmd");
                            var umdSeleccionada = $ddl.val();
                            var umdBase = $ddl.data("baseumd");

                            if (String(umdSeleccionada) === String(umdBase)) {
                                aplicarPromoLinea($row, promo || null);
                            } else {
                                aplicarPromoArticulo($row);
                            }
                        }

                        PV.Utils.actualizarModalProgreso(index, total, rowsArr[index - 1] ? $(rowsArr[index - 1]).attr("data-itemcode") : "");

                        if (index < rowsArr.length) {
                            setTimeout(procesarLotePrecios, 10);
                        } else {
                            PV.Utils.actualizarModalProgreso(total, total, "Completado");
                            recalcularTotales();
                            PV.Utils.cerrarModalProgreso(350, function () {
                                PV.Utils._procesando = false;
                            });
                        }
                    }

                    procesarLotePrecios();
                },
                error: function () {
                    PV.Utils._procesando = false;
                    Swal.fire({
                        type: "error",
                        title: "Error",
                        text: "Ocurrió un error al actualizar los precios con la nueva lista."
                    });
                }
            });
        });

        $(document).on("change", ".ddlDetalleUmd", function () {
            const $fila = $(this).closest("tr");
            const factor = parseFloat($(this).find(":selected").data("factor")) || 1;
            const precioBase = parseFloat($fila.find(".txtDetallePrecio").data("preciobase")) || 0;

            $fila.find(".txtDetallePrecio").val((precioBase * factor).toFixed(5));

            const stockBase = parseFloat($fila.find(".txtDetallePorVender").data("stockbase")) || 0;
            $fila.find(".txtDetallePorVender").val((stockBase / factor).toFixed(2));
            _resaltarPorVender($fila);

            const fraccionado = $fila.data("fraccionado");
            const montoMinimo = $fila.data("montominimo");
            if (fraccionado && fraccionado > 0 && esUmdPza($fila)) {
                configurarCantidadFraccionada($fila, fraccionado, montoMinimo);
            } else {
                configurarCantidadFraccionada($fila, 0, 0);
            }

            PV.registrarCambios();
            recalcularLinea($fila);
            recalcularTotales();
            if (!_batchPromoEnProceso) {
                aplicarPromoArticulo($fila);
            }

            if (esUmdPza($fila) && !_batchPromoEnProceso && !_modoLectura && $(".modal:visible").length === 0) {
                asegurarFocoEnCantidad($fila);
            }
        });

        $(document).off("contextmenu.detalleCopiar").on("contextmenu.detalleCopiar", "#tblVentaDetalle tbody tr", function (e) {
            e.preventDefault();
            var $elementoClickeado = $(e.target).closest("input, select, button");
            abrirMenuContextualDetalle(e.clientX, e.clientY, $(this), $elementoClickeado);
        });

        $(document).off("keydown.ctxBuscarDetalle").on("keydown.ctxBuscarDetalle", "#txtCtxBuscarDetalle", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                ejecutarBusquedaEnDetalle(e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") {
                e.preventDefault();
                ocultarMenuContextual(true);
            }
        });

        $(document).off("click.ctxBuscarLimpiar").on("click.ctxBuscarLimpiar", "#btnCtxBuscarLimpiar", function (e) {
            e.preventDefault();
            $("#txtCtxBuscarDetalle").val("");
            limpiarResaltadoBusqueda();
            $("#txtCtxBuscarDetalle").focus();
        });

        $(document).off("click.ctxBuscarSiguiente").on("click.ctxBuscarSiguiente", "#btnCtxBuscarSiguiente", function (e) {
            e.preventDefault();
            ejecutarBusquedaEnDetalle(1);
        });

        $(document).off("click.ctxBuscarAnterior").on("click.ctxBuscarAnterior", "#btnCtxBuscarAnterior", function (e) {
            e.preventDefault();
            ejecutarBusquedaEnDetalle(-1);
        });

        // Fase de captura en pointerdown/mousedown/click: garantiza detectar cualquier clic fuera del menú contextual,
        // incluso sobre elementos con 'disabled' (modo solo lectura / Ver Venta) o que detengan propagación
        function _cerrarMenuContextualSiClickFuera(e) {
            // Ignorar clic derecho para permitir que contextmenu abra el menú
            if (e.button === 2 || e.which === 3) return;

            var menu = document.getElementById("menuContextualDetalleVenta");
            if (menu && menu.style.display !== "none") {
                if (!menu.contains(e.target)) {
                    ocultarMenuContextual();
                }
            }
        }

        document.removeEventListener("pointerdown", _cerrarMenuContextualSiClickFuera, true);
        document.removeEventListener("mousedown", _cerrarMenuContextualSiClickFuera, true);
        document.removeEventListener("click", _cerrarMenuContextualSiClickFuera, true);

        document.addEventListener("pointerdown", _cerrarMenuContextualSiClickFuera, true);
        document.addEventListener("mousedown", _cerrarMenuContextualSiClickFuera, true);
        document.addEventListener("click", _cerrarMenuContextualSiClickFuera, true);

        $(document).off("pointerdown.ocultarMenuCtx mousedown.ocultarMenuCtx click.ocultarMenuCtx")
            .on("pointerdown.ocultarMenuCtx mousedown.ocultarMenuCtx click.ocultarMenuCtx", function (e) {
                if (e.which === 1 || e.button === 0) {
                    var menu = document.getElementById("menuContextualDetalleVenta");
                    if (menu && menu.style.display !== "none") {
                        if (!$(e.target).closest("#menuContextualDetalleVenta").length) {
                            ocultarMenuContextual();
                        }
                    }
                }
            });

        $(document).off("pointerdown.detalleDismiss mousedown.detalleDismiss click.detalleDismiss", "#tblVentaDetalle, #tblVentaDetalle tbody, #tblVentaDetalle tr, #tblVentaDetalle td, #detalleScrollContainer")
            .on("pointerdown.detalleDismiss mousedown.detalleDismiss click.detalleDismiss", "#tblVentaDetalle, #tblVentaDetalle tbody, #tblVentaDetalle tr, #tblVentaDetalle td, #detalleScrollContainer", function (e) {
                if (e.which === 1 || e.button === 0) {
                    var menu = document.getElementById("menuContextualDetalleVenta");
                    if (menu && menu.style.display !== "none") {
                        if (!menu.contains(e.target)) {
                            ocultarMenuContextual();
                        }
                    }
                }
            });

        $(document).off("keydown.ocultarMenuCtx").on("keydown.ocultarMenuCtx", function (e) {
            if (e.key === "Escape") {
                var menu = document.getElementById("menuContextualDetalleVenta");
                if (menu && menu.style.display !== "none") {
                    e.preventDefault();
                    ocultarMenuContextual(true);
                }
            }
        });

        $('a[data-toggle="tab"]').off("show.bs.tab.ctxMenu").on("show.bs.tab.ctxMenu", function () {
            ocultarMenuContextual();
        });

        $(window).off("resize.ctxMenu").on("resize.ctxMenu", function () {
            ocultarMenuContextual();
        });

        $(document).off("click.copiarFilaCtx").on("click.copiarFilaCtx", "#btnCtxCopiarFila", function () {
            $menuContextual.hide();
            if (!$filaContextualActiva || !$filaContextualActiva.length) return;

            var linea = extraer4ColumnasFila($filaContextualActiva);
            if (!linea) {
                Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2500
                }).fire({
                    type: 'warning',
                    title: 'La fila no contiene un artículo válido'
                });
                return;
            }

            copiarTextoPortapapeles(linea, "Fila copiada al portapapeles");
        });

        $(document).off("click.copiarTodasCtx").on("click.copiarTodasCtx", "#btnCtxCopiarTodas", function () {
            $menuContextual.hide();
            var lineas = [];

            $("#tblVentaDetalle tbody tr").each(function () {
                var l = extraer4ColumnasFila($(this));
                if (l) lineas.push(l);
            });

            if (lineas.length === 0) {
                Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2500
                }).fire({
                    type: 'warning',
                    title: 'No hay artículos en el detalle para copiar'
                });
                return;
            }

            var textoCompleto = lineas.join("\r\n");
            copiarTextoPortapapeles(textoCompleto, lineas.length + " filas copiadas al portapapeles");
        });
    }

    // ==========================================================
    // MENÚ CONTEXTUAL: BUSCAR Y COPIAR EN DETALLE DE VENTA
    // ==========================================================
    var $menuContextual = $("#menuContextualDetalleVenta");
    var $filaContextualActiva = null;
    var $elementoContextualPrevio = null;
    var _matchesBusquedaDetalle = [];
    var _indiceMatchActual = -1;
    var _ultimoTerminoBuscado = "";

    function normalizarTextoBusqueda(str) {
        return (str || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function limpiarResaltadoBusqueda() {
        $(".fila-busqueda-resaltada").removeClass("fila-busqueda-resaltada");
        _matchesBusquedaDetalle = [];
        _indiceMatchActual = -1;
        _ultimoTerminoBuscado = "";
        $("#lblCtxBuscarDetalleConteo").html("0 coincidencias");
        $("#lblCtxBuscarDetalleInfo").css("display", "none");
    }

    function ocultarMenuContextual(devolverFoco) {
        var menu = document.getElementById("menuContextualDetalleVenta");
        if (menu) {
            menu.style.display = "none";
        }
        if ($menuContextual && $menuContextual.length) {
            $menuContextual.hide();
        }

        // Determinar la fila objetivo para el foco:
        // Si hay una fila activa encontrada por la búsqueda, se prioriza esa fila.
        // Si no se buscó o no hubo resultados, se regresa a la fila donde se hizo clic derecho inicialmente.
        var $filaObjetivo = null;
        var esFilaResultadoBusqueda = false;

        if (_matchesBusquedaDetalle && _matchesBusquedaDetalle.length > 0 && _indiceMatchActual >= 0 && _indiceMatchActual < _matchesBusquedaDetalle.length) {
            $filaObjetivo = $(_matchesBusquedaDetalle[_indiceMatchActual]);
            esFilaResultadoBusqueda = true;
        } else if ($filaContextualActiva && $filaContextualActiva.length) {
            $filaObjetivo = $filaContextualActiva;
        }

        limpiarResaltadoBusqueda();

        if (devolverFoco && $filaObjetivo && $filaObjetivo.length) {
            if (!esFilaResultadoBusqueda && $elementoContextualPrevio && $elementoContextualPrevio.length &&
                !$elementoContextualPrevio.is(":disabled") && !$elementoContextualPrevio.prop("readonly") &&
                $.contains($filaObjetivo[0], $elementoContextualPrevio[0])) {
                $elementoContextualPrevio.focus();
                if ($elementoContextualPrevio.is("input[type='text'], input[type='number']")) {
                    $elementoContextualPrevio.select();
                }
            } else {
                var $target = $filaObjetivo.find(".txtDetalleDescripcion");
                if ($target.length && !$target.is(":disabled") && !$target.prop("readonly")) {
                    $target.focus().select();
                } else {
                    var $input = $filaObjetivo.find("input:not(:disabled):not([readonly]), select:not(:disabled)").first();
                    if ($input.length) {
                        $input.focus().select();
                    }
                }
            }

            if ($filaObjetivo[0] && $filaObjetivo[0].scrollIntoView) {
                $filaObjetivo[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }
    }

    function ejecutarBusquedaEnDetalle(direccion) {
        var rawTerm = ($("#txtCtxBuscarDetalle").val() || "").trim();
        var term = normalizarTextoBusqueda(rawTerm);

        if (!term) {
            limpiarResaltadoBusqueda();
            return;
        }

        if (term !== _ultimoTerminoBuscado) {
            _matchesBusquedaDetalle = [];
            _ultimoTerminoBuscado = term;
            _indiceMatchActual = -1;

            $("#tblVentaDetalle tbody tr").each(function () {
                var $tr = $(this);
                var desc = normalizarTextoBusqueda($tr.find(".txtDetalleDescripcion").val());
                var cod = normalizarTextoBusqueda($tr.find(".txtDetalleCodigo").val() || $tr.attr("data-itemcode"));
                var bar = normalizarTextoBusqueda($tr.attr("data-codebars"));

                if (desc.indexOf(term) !== -1 || cod.indexOf(term) !== -1 || bar.indexOf(term) !== -1) {
                    _matchesBusquedaDetalle.push($tr[0]);
                }
            });
        }

        if (_matchesBusquedaDetalle.length === 0) {
            $(".fila-busqueda-resaltada").removeClass("fila-busqueda-resaltada");
            $("#lblCtxBuscarDetalleConteo").html('<span class="text-danger font-weight-bold">0 coincidencias</span>');
            $("#lblCtxBuscarDetalleInfo").css("display", "flex");
            return;
        }

        if (direccion >= 0) {
            _indiceMatchActual = (_indiceMatchActual + 1) % _matchesBusquedaDetalle.length;
        } else {
            _indiceMatchActual = (_indiceMatchActual - 1 + _matchesBusquedaDetalle.length) % _matchesBusquedaDetalle.length;
        }

        $("#lblCtxBuscarDetalleConteo").html(
            '<span class="text-success font-weight-bold">' + (_indiceMatchActual + 1) + ' de ' + _matchesBusquedaDetalle.length + '</span>'
        );
        $("#lblCtxBuscarDetalleInfo").css("display", "flex");

        $(".fila-busqueda-resaltada").removeClass("fila-busqueda-resaltada");
        var $targetRow = $(_matchesBusquedaDetalle[_indiceMatchActual]);
        $targetRow.addClass("fila-busqueda-resaltada");

        if ($targetRow.length && $targetRow[0].scrollIntoView) {
            $targetRow[0].scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    function abrirMenuContextualDetalle(posX, posY, $fila, $elemento) {
        $menuContextual = $("#menuContextualDetalleVenta");
        $filaContextualActiva = $fila || $("#tblVentaDetalle tbody tr").first();
        $elementoContextualPrevio = ($elemento && $elemento.length) ? $elemento : null;

        // Limpiar memoria de búsqueda y el campo de texto cada vez que se abre
        limpiarResaltadoBusqueda();
        $("#txtCtxBuscarDetalle").val("");

        var winWidth = $(window).width();
        var winHeight = $(window).height();
        var menuWidth = 295;
        var menuHeight = 165;

        // Si no se pasaron coordenadas (o son nulas), centrar en la columna Descripción y verticalmente en el detalle
        if (posX === undefined || posX === null || posY === undefined || posY === null) {
            var $thDesc = $("#tblVentaDetalle thead th.ordenar-col[data-col='2']");
            if (!$thDesc.length) {
                $thDesc = $("#tblVentaDetalle thead th").filter(function () { return $(this).text().indexOf("Descripción") !== -1; });
            }

            if ($thDesc.length) {
                var rectTh = $thDesc[0].getBoundingClientRect();
                posX = rectTh.left + (rectTh.width / 2) - (menuWidth / 2);
            } else {
                posX = (winWidth / 2) - (menuWidth / 2);
            }

            var $cnt = $("#detalleScrollContainer");
            if ($cnt.length) {
                var rectCnt = $cnt[0].getBoundingClientRect();
                posY = rectCnt.top + (rectCnt.height / 2) - (menuHeight / 2);
            } else {
                posY = (winHeight / 2) - (menuHeight / 2);
            }
        }

        // Reubicación inteligente si el menú sobrepasa los límites de pantalla
        if (posX + menuWidth > winWidth - 10) {
            posX = winWidth - menuWidth - 15;
        }
        if (posX < 10) posX = 10;

        if (posY + menuHeight > winHeight - 10) {
            posY = Math.max(10, posY - menuHeight - 5);
        }
        if (posY < 10) posY = 10;

        $menuContextual.css({
            position: "fixed",
            top: posY + "px",
            left: posX + "px",
            display: "block"
        });

        setTimeout(function () {
            $("#txtCtxBuscarDetalle").focus();
        }, 60);
    }

    function extraer4ColumnasFila($fila) {
        if (!$fila || !$fila.length) return null;
        var desc = ($fila.find(".txtDetalleDescripcion").val() || "").replace(/[\t\r\n]+/g, ' ').trim();
        var cod = ($fila.find(".txtDetalleCodigo").val() || $fila.attr("data-itemcode") || "").replace(/[\t\r\n]+/g, ' ').trim();
        var porVender = ($fila.find(".txtDetallePorVender").val() || "").replace(/[\t\r\n]+/g, ' ').trim();

        var $selectCant = $fila.find(".txtDetalleCantidadSelect");
        var cant = $selectCant.length > 0
            ? ($selectCant.val() || "").replace(/[\t\r\n]+/g, ' ').trim()
            : ($fila.find(".txtDetalleCantidad").val() || "").replace(/[\t\r\n]+/g, ' ').trim();

        if (!desc && !cod) return null;
        var umd = ($fila.find(".ddlDetalleUmd option:selected").text() || "").replace(/[\t\r\n]+/g, ' ').trim();
        var precio = ($fila.find(".txtDetallePrecio").val() || "").replace(/[\t\r\n]+/g, ' ').trim();
        var total = ($fila.find(".txtDetalleTotal").val() || "").replace(/[\t\r\n]+/g, ' ').trim();
        var vencimiento = ($fila.find(".txtDetalleVencimiento option:selected").text() || "").replace(/[\t\r\n]+/g, ' ').trim();
        var regalo = ($fila.find(".txtDetalleRegalo").val() || "").replace(/[\t\r\n]+/g, ' ').trim();
        var descuento = ($fila.find(".txtDetalleDescuento").val() || "").replace(/[\t\r\n]+/g, ' ').trim();

        return desc + "\t" + cod + "\t" + porVender + "\t" + cant + "\t" + umd + "\t" + precio + "\t" + total + "\t" + vencimiento + "\t" + regalo + "\t" + descuento;
    } 

    function copiarTextoPortapapeles(texto, mensajeExito) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(texto).then(function () {
                mostrarToastCopiado(mensajeExito);
            }).catch(function () {
                copiarFallback(texto, mensajeExito);
            });
        } else {
            copiarFallback(texto, mensajeExito);
        }
    }

    function copiarFallback(texto, mensajeExito) {
        var $temp = $("<textarea>");
        $("body").append($temp);
        $temp.val(texto).select();
        try {
            document.execCommand("copy");
            mostrarToastCopiado(mensajeExito);
        } catch (err) {
            Swal.fire({ type: "error", title: "Error", text: "No se pudo copiar al portapapeles." });
        }
        $temp.remove();
    }

    function mostrarToastCopiado(mensaje) {
        Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true
        }).fire({
            type: 'success',
            title: mensaje
        });
    }

    function agregarFilaDetalleVacia() {
        const html = `
        <tr class="fila-detalle" data-itemcode="" data-codebars="" data-igvafect="IGV" data-lotes="[]">
            <td class="text-center">
                <button type="button" class="btn btn-outline-primary btn-detalle-lote" tabindex="-1" title="Seleccionar lote">
                    <i class="fa fa-box"></i>
                </button>
            </td>

            <td class="text-center">
                <button type="button" class="btn btn-primary btn-detalle-buscar" tabindex="-1" title="Buscar producto">
                    <i class="fa fa-search"></i>
                </button>
            </td>

            <td>
                <div class="input-group input-group-sm input-clear">
                    <input type="text"
                           class="form-control txtDetalleDescripcion font-weight-bold"
                           autocomplete="off"
                           maxlength="200" />
                    <div class="input-group-append">
                        <button type="button"
                                class="btn btn-outline-secondary btn-detalle-limpiar d-none"
                                title="Limpiar producto"
                                tabindex="-1"
                                aria-label="Limpiar">
                            <i class="fa fa-times" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            </td>

            <td>
                <div class="input-group input-group-sm input-clear">
                    <input type="text"
                           class="form-control txtDetalleCodigo"
                           autocomplete="off"
                           maxlength="50" />
                    <div class="input-group-append">
                        <button type="button"
                                class="btn btn-outline-secondary btn-detalle-limpiar d-none"
                                title="Limpiar producto"
                                tabindex="-1"
                                aria-label="Limpiar">
                            <i class="fa fa-times" aria-hidden="true"></i>
                        </button>
                        <button type="button"
                                class="btn btn-outline-primary btn-detalle-imagen d-none"
                                title="Ver imagen del producto"
                                tabindex="-1">
                            <i class="fa fa-image"></i>
                        </button>
                    </div>
                </div>
            </td>

            <td>
                <input type="text"
                       class="form-control txtDetallePorVender text-right"
                       readonly
                       tabindex="-1" />
            </td>

            <td>
                <div class="input-group input-group-sm">
                    <input type="text"
                           inputmode="numeric"
                           class="form-control txtDetalleCantidad text-right"
                           placeholder="0"
                           maxlength="8"
                           autocomplete="off"
                           value="" />
                    <div class="input-group-append">
                        <button type="button"
                                class="btn btn-outline-warning btn-detalle-promo d-none"
                                title="Ver promociones activas"
                                tabindex="-1"
                                disabled>
                            <i class="fa fa-tag"></i>
                        </button>
                    </div>
                </div>
            </td>

            <td>
                <select class="form-control ddlDetalleUmd"></select>
            </td>

            <td>
                <input type="text"
                       class="form-control txtDetallePrecio text-right"
                       readonly
                       tabindex="-1" />
            </td>

            <td>
                <input type="text"
                       class="form-control txtDetalleTotal text-right"
                       readonly
                       tabindex="-1" />
            </td>

            <td>
                <select class="form-control txtDetalleVencimiento"
                        tabindex="-1"
                        disabled>
                    <option value="">-- Seleccionar --</option>
                </select>
            </td>

            <td>
                <input type="text"
                       class="form-control txtDetalleRegalo"
                       value="NO"
                       readonly
                       tabindex="-1" />
            </td>

            <td>
                <input type="text"
                       class="form-control txtDetalleDescuento"
                       value="0"
                       readonly
                       tabindex="-1" />
            </td>

            <td class="text-center">
                <button type="button" class="btn btn-danger btn-detalle-eliminar" tabindex="-1" title="Eliminar (Ctrl+D)">
                    <i class="fa fa-trash"></i>
                </button>
            </td>
        </tr>
    `;

        $("#tblVentaDetalle tbody").append(html);
        const $fila = $("#tblVentaDetalle tbody tr").last();

        if (_modoLectura || _bloqueadoPorCliente) {
            $fila.find(".btn-detalle-buscar, .btn-detalle-eliminar, .btn-detalle-limpiar, .btn-detalle-lote, .btn-detalle-promo, .txtDetalleCodigo, .txtDetalleDescripcion, .txtDetalleCantidadSelect, .ddlDetalleUmd").prop("disabled", true);
            $fila.find(".btn-detalle-imagen").prop("disabled", false);
            $fila.find(".txtDetalleCantidad").prop("readonly", true);
        }

        inicializarAutocompleteDetalleDescripcion(
            $fila.find(".txtDetalleDescripcion")
        );

        return $fila;
    }

    function filaDetalleEstaVacia($fila) {
        const codigo = ($fila.find(".txtDetalleCodigo").val() || "").trim();
        const descripcion = ($fila.find(".txtDetalleDescripcion").val() || "").trim();

        return codigo === "" && descripcion === "";
    }

    function asegurarFilaVaciaFinal() {
        const $filas = $("#tblVentaDetalle tbody tr");

        if ($filas.length === 0) {
            agregarFilaDetalleVacia();
            return;
        }

        const $ultimaFila = $filas.last();

        if (!filaDetalleEstaVacia($ultimaFila)) {
            agregarFilaDetalleVacia();
        }
    }

    function limpiarFilaDetalle($fila) {
        $fila.find(".txtDetalleDescripcion").prop("readonly", false).val("");
        $fila.find(".txtDetalleCodigo").prop("readonly", false).val("");
        $fila.find(".txtDetallePorVender").val("");
        _resaltarPorVender($fila);

        var $select = $fila.find(".txtDetalleCantidadSelect");
        if ($select.length > 0) {
            $select.replaceWith('<input type="text" inputmode="numeric" class="form-control txtDetalleCantidad text-right" placeholder="0" maxlength="8" autocomplete="off" value="" />');
        } else {
            $fila.find(".txtDetalleCantidad").val("");
        }

        $fila.find(".txtDetallePrecio").val("").removeData("preciobase");
        $fila.find(".txtDetalleTotal").val("");
        $fila.find(".txtDetalleVencimiento").empty().append('<option value="">-- Seleccionar --</option>').prop("disabled", true).removeClass("vencimiento-proximo");
        $fila.find(".txtDetalleDescuento").val("0");
        $fila.find(".ddlDetalleUmd").empty().prop("disabled", false).css({ "background-color": "", "cursor": "" });
        $fila.attr("data-itemcode", "");
        $fila.attr("data-codebars", "");
        $fila.attr("data-igvafect", "IGV");
        $fila.removeData("ugpentry");
        $fila.removeData("lotesData");
        $fila.data("lotes", []);
        $fila.removeData("umds");
        $fila.removeData("fraccionado");
        $fila.removeData("montominimo");
        $fila.find(".btn-detalle-limpiar").addClass("d-none");
        $fila.find(".btn-detalle-imagen").addClass("d-none");
        $fila.find(".btn-detalle-promo").addClass("d-none").prop("disabled", true);
        $fila.removeClass("table-danger");
        $fila.find(".txtDetalleCantidad").removeClass("is-invalid").removeAttr("title");
        $fila.removeData("error-fraccionado");
        $fila.find(".btn-detalle-lote")
            .removeClass("btn-success")
            .addClass("btn-outline-primary");
    }

    function confirmarItemDuplicado(codigo, $fila) {
        const duplicado = $("#tblVentaDetalle tbody tr").filter(function () {
            return $(this).attr("data-itemcode") === codigo && $(this)[0] !== $fila[0];
        }).length > 0;

        if (!duplicado) return Promise.resolve(true);

        return Swal.fire({
            type: "question",
            title: "Item duplicado",
            text: "El item ya ha sido agregado con anterioridad. ¿Desea agregarlo nuevamente?",
            showCancelButton: true,
            confirmButtonText: "Sí",
            cancelButtonText: "No",
            focusConfirm: false,
            focusCancel: false
        }).then(function (result) {
            if (!result.value) {
                limpiarFilaDetalle($fila);
                return false;
            }
            return true;
        });
    }

    function llenarFilaDetalle($fila, item) {
        PV.registrarCambios();
        $fila.attr("data-itemcode", item.CODIGO || "");
        $fila.attr("data-codebars", item.CODEBARS || "");
        $fila.attr("data-igvafect", item.IGV_AFECT || "IGV");
        $fila.data("ugpentry", item.UOMENTRY || 0);

        $fila.find(".txtDetalleDescripcion").val(item.DESCRIPCION || "");
        $fila.find(".txtDetalleCodigo").val(item.CODIGO || "");
        $fila.find(".txtDetallePorVender").val(Number(item.STOCK || 0).toFixed(2));
        $fila.find(".txtDetallePorVender").data("stockbase", Number(item.STOCK || 0));
        _resaltarPorVender($fila);
        $fila.find(".txtDetalleCantidad").val("");

        $fila.find(".txtDetallePrecio").val(Number(item.PRECIO || 0).toFixed(5));
        $fila.find(".txtDetallePrecio").data("preciobase", Number(item.PRECIO || 0));

        _cargarFechasVencimiento($fila, item.CODIGO);

        cargarUmdArticulo($fila, item.CODIGO);

        $fila.find(".txtDetalleTotal").val("0.00");

        recalcularTotales();
        asegurarFilaVaciaFinal();

        $fila.find(".txtDetalleDescripcion").prop("readonly", true);
        $fila.find(".txtDetalleCodigo").prop("readonly", true);
        $fila.find(".btn-detalle-limpiar").removeClass("d-none");
        $fila.find(".btn-detalle-imagen").removeClass("d-none").prop("disabled", false);
        $fila.find(".btn-detalle-promo").removeClass("d-none").prop("disabled", false);
        if ($(".modal:visible").length === 0) {
            asegurarFocoEnCantidad($fila);
        }
    }

    function _renderizarUmds($fila, predeterminada, pzaUmd, codigoUmdSeleccionado, fraccionadoMultiplo, montoMinimo, omitirRecalcularTotales) {
        const $ddl = $fila.find(".ddlDetalleUmd");
        let html = "";

        if (predeterminada) {
            html += `<option value="${predeterminada.CODIGO_UMD}" data-factor="${predeterminada.FACTOR}">${predeterminada.NOMBRE}</option>`;
        }

        const esPredeterminadaPza = predeterminada && (
            (predeterminada.NOMBRE || "").trim().toUpperCase() === "PZA" ||
            (predeterminada.NOMBRE || "").trim().toUpperCase() === "PIEZA"
        );

        if (pzaUmd && !esPredeterminadaPza) {
            html += `<option value="${pzaUmd.CODIGO_UMD}" data-factor="${pzaUmd.FACTOR}">${pzaUmd.NOMBRE}</option>`;
        }

        $ddl.html(html);

        const targetVal = String(codigoUmdSeleccionado || "");
        if (targetVal && $ddl.find(`option[value="${targetVal}"]`).length > 0) {
            $ddl.val(targetVal);
        } else if (predeterminada) {
            $ddl.val(predeterminada.CODIGO_UMD);
        }

        const opcionesCount = $ddl.find("option").length;
        if (opcionesCount > 1 && !_modoLectura) {
            $ddl.prop("disabled", false).css({ "background-color": "", "cursor": "" });
        } else {
            $ddl.prop("disabled", true).css({ "background-color": "#e9ecef", "cursor": "not-allowed" });
        }

        const factor = parseFloat($ddl.find(":selected").data("factor")) || 1;
        const stockBase = parseFloat($fila.find(".txtDetallePorVender").data("stockbase")) || 0;
        $fila.find(".txtDetallePorVender").val((stockBase / factor).toFixed(2));
        _resaltarPorVender($fila);

        const precioBase = parseFloat($fila.find(".txtDetallePrecio").data("preciobase")) || 0;
        if (precioBase > 0) {
            $fila.find(".txtDetallePrecio").val((precioBase * factor).toFixed(5));
        }

        if (fraccionadoMultiplo && fraccionadoMultiplo > 0 && esUmdPza($fila)) {
            configurarCantidadFraccionada($fila, fraccionadoMultiplo, montoMinimo);
        } else {
            configurarCantidadFraccionada($fila, 0, 0);
        }

        recalcularLinea($fila);
        if (!omitirRecalcularTotales) {
            recalcularTotales();
        }
    }

    function cargarUmdsEnFila($fila, data, codigoUmdSeleccionado, callback, opciones, fraccionadoData) {
        opciones = opciones || {};
        if (!data || data.length === 0) {
            if (typeof callback === "function") callback($fila.find(".ddlDetalleUmd"), data);
            return $fila.find(".ddlDetalleUmd");
        }

        $fila.data("umds", data);

        const predeterminada = data.find(x => x.ES_PREDETERMINADA === "Y") || data[0];
        const $ddl = $fila.find(".ddlDetalleUmd");

        if (predeterminada) {
            $ddl.data("baseumd", predeterminada.CODIGO_UMD);
            $ddl.data("basefactor", parseFloat(predeterminada.FACTOR) || 1);
        }

        const factores = data.map(function (u) { return parseFloat(u.FACTOR) || 1; });
        const minFactor = factores.length > 0 ? Math.min(...factores) : 1;
        $ddl.data("basegroupfactor", minFactor);

        const codigo = $fila.attr("data-itemcode");
        if (!codigo) {
            _renderizarUmds($fila, predeterminada, null, codigoUmdSeleccionado, 0, 0, opciones.omitirRecalcularTotales);
            if (typeof callback === "function") callback($ddl, data);
            return $ddl;
        }

        const fracc = fraccionadoData !== undefined ? fraccionadoData : opciones.fraccionado;
        if (fracc !== undefined) {
            if (fracc && (fracc.FRACCIONADO > 0 || fracc.multiplo > 0)) {
                const multiplo = fracc.FRACCIONADO || fracc.multiplo;
                const montoMin = fracc.MONTO_MINIMO || fracc.montoMinimo || multiplo;
                $fila.data("fraccionado", multiplo);
                $fila.data("montominimo", montoMin);
                const pzaUmd = data.find(x => {
                    const n = (x.NOMBRE || "").trim().toUpperCase();
                    return n === "PZA" || n === "PIEZA";
                });
                _renderizarUmds($fila, predeterminada, pzaUmd || { CODIGO_UMD: -1, NOMBRE: "PZA", FACTOR: 1 }, codigoUmdSeleccionado, multiplo, montoMin, opciones.omitirRecalcularTotales);
            } else {
                $fila.removeData("fraccionado");
                $fila.removeData("montominimo");
                _renderizarUmds($fila, predeterminada, null, codigoUmdSeleccionado, 0, 0, opciones.omitirRecalcularTotales);
            }
            if (typeof callback === "function") callback($ddl, data);
            return $ddl;
        }

        if (opciones.omitirFraccionadoAjax) {
            _renderizarUmds($fila, predeterminada, null, codigoUmdSeleccionado, 0, 0, opciones.omitirRecalcularTotales);
            if (typeof callback === "function") callback($ddl, data);
            return $ddl;
        }

        $.ajax({
            url: "/PuntoVenta/Validar_ArticuloFraccionado",
            type: "GET",
            data: { itemcode: codigo },
            dataType: "json",
            success: function (resp) {
                if (resp.fraccionado && resp.multiplo > 0) {
                    var montoMin = resp.montoMinimo && resp.montoMinimo > 0 ? resp.montoMinimo : resp.multiplo;
                    $fila.data("fraccionado", resp.multiplo);
                    $fila.data("montominimo", montoMin);
                    const pzaUmd = data.find(x => {
                        const n = (x.NOMBRE || "").trim().toUpperCase();
                        return n === "PZA" || n === "PIEZA";
                    });
                    _renderizarUmds($fila, predeterminada, pzaUmd || { CODIGO_UMD: -1, NOMBRE: "PZA", FACTOR: 1 }, codigoUmdSeleccionado, resp.multiplo, montoMin, opciones.omitirRecalcularTotales);
                } else {
                    $fila.removeData("fraccionado");
                    $fila.removeData("montominimo");
                    _renderizarUmds($fila, predeterminada, null, codigoUmdSeleccionado, 0, 0, opciones.omitirRecalcularTotales);
                }
                if (typeof callback === "function") callback($ddl, data);
            },
            error: function () {
                $fila.removeData("fraccionado");
                $fila.removeData("montominimo");
                _renderizarUmds($fila, predeterminada, null, codigoUmdSeleccionado, 0, 0, opciones.omitirRecalcularTotales);
                if (typeof callback === "function") callback($ddl, data);
            }
        });

        return $ddl;
    }

    function llenarFilaDetalleDesdeDetalleVenta($fila, detalle, opciones) {
        PV.registrarCambios();
        opciones = opciones || {};
        const item = detalle.ARTICULO;

        $fila.attr("data-itemcode", item.CODIGO || "");
        $fila.attr("data-codebars", item.CODEBARS || "");
        $fila.attr("data-igvafect", item.IGV_AFECT || "IGV");
        $fila.data("ugpentry", item.UOMENTRY || 0);

        $fila.find(".txtDetalleDescripcion").val(item.DESCRIPCION || "");
        $fila.find(".txtDetalleCodigo").val(item.CODIGO || "");
        $fila.find(".txtDetallePorVender").val(Number(item.STOCK || 0).toFixed(2));
        $fila.find(".txtDetallePorVender").data("stockbase", Number(item.STOCK || 0));
        _resaltarPorVender($fila);
        $fila.find(".txtDetalleCantidad").val(opciones.cantidad !== undefined ? opciones.cantidad : "");

        $fila.find(".txtDetallePrecio").val(Number(item.PRECIO || 0).toFixed(5));
        $fila.find(".txtDetallePrecio").data("preciobase", Number(item.PRECIO || 0));

        if (opciones.omitirFechasVencimientoAjax) {
            if (item.FECHA_VENCIMIENTO) {
                var $sel = $fila.find(".txtDetalleVencimiento");
                if ($sel.find('option[value="' + item.FECHA_VENCIMIENTO + '"]').length === 0) {
                    $sel.append('<option value="' + item.FECHA_VENCIMIENTO + '">' + item.FECHA_VENCIMIENTO + '</option>');
                }
                $sel.val(item.FECHA_VENCIMIENTO);
                var partes = item.FECHA_VENCIMIENTO.split("/");
                if (partes.length === 3) {
                    var fechaLote = new Date(partes[2], partes[1] - 1, partes[0]);
                    var unAnio = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate());
                    $sel.toggleClass("vencimiento-proximo", fechaLote < unAnio);
                }
            }
        } else {
            _cargarFechasVencimiento($fila, item.CODIGO);
        }

        const $ddl = cargarUmdsEnFila($fila, detalle.UMDS || [], opciones.codigoUmd, null, opciones, detalle.FRACCIONADO);
        if (opciones.cantidad !== undefined) {
            var $selectCant = $fila.find(".txtDetalleCantidadSelect");
            if ($selectCant.length > 0) {
                $selectCant.val(opciones.cantidad);
            }
        }

        if (!_modoLectura) {
            aplicarPromoLinea($fila, detalle.PROMOS || null, opciones);
        }

        $fila.find(".txtDetalleTotal").val("0.00");

        if (opciones.descuento !== undefined) {
            $fila.find(".txtDetalleDescuento").val(Number(opciones.descuento || 0).toFixed(2));
        }
        if (opciones.regalo !== undefined) {
            $fila.find(".txtDetalleRegalo").val(opciones.regalo || "NO");
        }

        recalcularLinea($fila);
        if (!opciones.omitirRecalcularTotales) {
            recalcularTotales();
        }
        if (!opciones.omitirAsegurarFilaFinal) {
            asegurarFilaVaciaFinal();
        }

        $fila.find(".txtDetalleDescripcion").prop("readonly", true);
        $fila.find(".txtDetalleCodigo").prop("readonly", true);
        $fila.find(".btn-detalle-limpiar").removeClass("d-none");
        $fila.find(".btn-detalle-imagen").removeClass("d-none").prop("disabled", false);
        $fila.find(".btn-detalle-promo").removeClass("d-none").prop("disabled", false);
        if (!opciones.mantenerFoco) {
            asegurarFocoEnCantidad($fila);
        }
    }

    function cargarFilaDetalleDesdeVenta($fila, item) {
        $fila.attr("data-itemcode", item.ITEMCODE || "");
        $fila.attr("data-codebars", item.CODEBARS || "");
        $fila.attr("data-igvafect", item.IGV_AFECT || "IGV");
        $fila.data("ugpentry", item.UOMENTRY || 0);

        $fila.find(".txtDetalleDescripcion").val(item.ITEMNAME || "");
        $fila.find(".txtDetalleCodigo").val(item.ITEMCODE || "");
        $fila.find(".txtDetalleDescripcion").prop("readonly", true);
        $fila.find(".txtDetalleCodigo").prop("readonly", true);
        $fila.find(".btn-detalle-limpiar").removeClass("d-none");
        $fila.find(".btn-detalle-imagen").removeClass("d-none").prop("disabled", false);
        $fila.find(".btn-detalle-promo").removeClass("d-none");

        var factor = Number(item.UMD_FACTOR || 1);
        if (factor <= 0) factor = 1;
        var precioUom = Number(item.PRICE_UOM || item.PRICE_BEF || (item.PRICE ? item.PRICE * factor * (item.IGV_AFECT === "IGV" || item.IGV_AFECT === "S" || item.IGV_AFECT === "Y" ? 1.18 : 1) : 0));

        $fila.find(".txtDetalleCantidad").val(item.QUANTITY || 0);
        $fila.find(".txtDetallePrecio").val(precioUom.toFixed(5));
        $fila.find(".txtDetallePrecio").data("preciobase", precioUom / factor);
        $fila.find(".txtDetalleTotal").val((Number(item.QUANTITY || 0) * precioUom).toFixed(2));
        $fila.find(".txtDetalleDescuento").val(Number(item.WMS_DSC || 0).toFixed(2));
        $fila.find(".txtDetallePorVender").val(Number(item.FORSALE || 0).toFixed(2));
        $fila.find(".txtDetallePorVender").data("stockbase", Number(item.FORSALE || 0));
        _resaltarPorVender($fila);
        $fila.find(".txtDetalleRegalo").val(item.WMS_GIF || "NO");

        if (item.FECHA_VENCIMIENTO) {
            var $sel = $fila.find(".txtDetalleVencimiento");
            if ($sel.find('option[value="' + item.FECHA_VENCIMIENTO + '"]').length === 0) {
                $sel.append('<option value="' + item.FECHA_VENCIMIENTO + '">' + item.FECHA_VENCIMIENTO + '</option>');
            }
            $sel.val(item.FECHA_VENCIMIENTO).prop("disabled", true);
            var partes = item.FECHA_VENCIMIENTO.split("/");
            var fechaLote = new Date(partes[2], partes[1] - 1, partes[0]);
            var unAnio = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate());
            $sel.toggleClass("vencimiento-proximo", fechaLote < unAnio);
        }

        if (item.UMD_NOMBRE) {
            const $ddl = $fila.find(".ddlDetalleUmd");
            $ddl.html(`<option value="${item.UOMENTRY}" data-factor="${item.UMD_FACTOR || 1}">${item.UMD_NOMBRE}</option>`);
            $ddl.val(item.UOMENTRY);
            $ddl.data("baseumd", item.UOMENTRY);
            $ddl.data("basefactor", parseFloat(item.UMD_FACTOR) || 1);
            $fila.data("umds", [{ CODIGO_UMD: item.UOMENTRY, FACTOR: item.UMD_FACTOR, NOMBRE: item.UMD_NOMBRE }]);

            var esPza = (item.UMD_NOMBRE || "").trim().toUpperCase() === "PZA" 
                     || (item.UMD_NOMBRE || "").trim().toUpperCase() === "PIEZA";
            if (esPza && !_modoLectura) {
                $.ajax({
                    url: "/PuntoVenta/Validar_ArticuloFraccionado",
                    type: "GET",
                    data: { itemcode: item.ITEMCODE },
                    dataType: "json",
                    success: function (resp) {
                        if (resp && resp.FRACCIONADO && resp.FRACCIONADO > 0) {
                            configurarCantidadFraccionada($fila, resp.FRACCIONADO, resp.MONTO_MINIMO || resp.FRACCIONADO);
                        }
                    }
                });
            }

            if (!_modoLectura) {
                $ddl.trigger("change");
            }
        } else {
            cargarUmdArticulo($fila, item.ITEMCODE, function ($ddl, data) {
                if (item.UOMENTRY) {
                    var match = data.find(function (u) { return u.CODIGO_UMD == item.UOMENTRY; });
                    if (match) {
                        $ddl.val(match.CODIGO_UMD);
                        $ddl.data("baseumd", match.CODIGO_UMD);
                        $ddl.data("basefactor", parseFloat(match.FACTOR) || 1);
                        if (!_modoLectura) {
                            $ddl.trigger("change");
                        }
                    }
                }
            });
        }

        if (item.LOTES && item.LOTES.length > 0) {
            var lotes = item.LOTES.map(function (l) {
                return {
                    ITEMCODE: l.ITEMCODE,
                    SYSNUMBER: l.SYSNUMBER,
                    DISTNUMBER: l.DISTNUMBER,
                    QUANTITY: parseInt(l.QUANTITY) || 0
                };
            });
            $fila.data("lotes", lotes);
            $fila.find(".btn-detalle-lote")
                .removeClass("btn-outline-primary")
                .addClass("btn-success");
        }
    }

    function recalcularLinea($fila) {
        const cantidad = leerCantidadFila($fila);
        const precio = parseFloat($fila.find(".txtDetallePrecio").val()) || 0;
        const total = cantidad * precio;

        $fila.find(".txtDetalleTotal").val(total.toFixed(2));
    }

    function recalcularTotales() {
        let totalItems = 0;
        let total = 0;
        let descuentoSuma = 0;

        $("#tblVentaDetalle tbody tr").each(function () {
            const codigo = $(this).find(".txtDetalleCodigo").val();

            if (!codigo) return;

            totalItems++;
            total += parseFloat($(this).find(".txtDetalleTotal").val()) || 0;
            descuentoSuma += parseFloat($(this).find(".txtDetalleDescuento").val()) || 0;
        });

        const flete = parseFloat($("#txtVentaFlete").val()) || 0;

        let orinTotal = 0;
        $(".chk-nota-credito:checked").each(function () {
            orinTotal += parseFloat($(this).data("total")) || 0;
        });

        const descuentoTotal = descuentoSuma + orinTotal;

        $("#txtVentaTotalItems").val(totalItems);
        $("#txtVentaTotal").val(total.toFixed(2));
        $("#txtVentaDescuento").val(descuentoTotal.toFixed(2));
        $("#txtVentaNeto").val((total + flete - descuentoTotal).toFixed(2));
        verificarAlertaLimiteCredito();

        if (PV.DraftManager && typeof PV.DraftManager.notificarCambio === "function") {
            PV.DraftManager.notificarCambio();
        }
    }

    function verificarAlertaLimiteCredito() {
        var $limiteInput = $("#txtVentaLimiteCredito");
        var limite = parseFloat($limiteInput.val()) || 0;
        var totalNeto = parseFloat($("#txtVentaNeto").val()) || 0;
        var formaPago = ($("#ddlFinancieroFormaPago option:selected").text() || "").toUpperCase();
        var esCredito = formaPago.indexOf("CREDITO") !== -1;

        if (esCredito && totalNeto > limite) {
            $limiteInput.addClass("credito-excedido");
            $limiteInput.attr("title", "¡Atención! El total de la orden (S/ " + totalNeto.toFixed(2) + ") supera el crédito disponible (S/ " + limite.toFixed(2) + ")");
        } else {
            $limiteInput.removeClass("credito-excedido");
            $limiteInput.removeAttr("title");
        }
    }

    function inicializarAutocompleteDetalleDescripcion($input) {
        $input.autocomplete({
            minLength: 1,
            delay: 150,

            source: function (request, response) {
                if (_modoLectura || _bloqueadoPorCliente || (window.PV && PV._clienteBloqueado)) {
                    response([]);
                    return;
                }

                const listaPrecio = $("#ddlClienteListaPrecio").val();
                const almacen = $("#ddlVentaAlmacen").val();

                if (!listaPrecio || !almacen) {
                    response([]);
                    return;
                }

                $.ajax({
                    url: "/PuntoVenta/Buscar_ArticulosAutocomplete",
                    type: "GET",
                    data: {
                        textoBusqueda: request.term,
                        codigoListaPrecio: parseInt(listaPrecio, 10) || 0,
                        codigoAlmacen: almacen
                    },
                    dataType: "json",
                    success: function (data) {
                        if (!data || data.length === 0) {
                            response([]);
                            return;
                        }
                        response(data.map(function (item) {
                            return {
                                label: `${item.DESCRIPCION} | ${item.CODIGO}`,
                                value: item.DESCRIPCION,
                                codigo: item.CODIGO,
                                item: item
                            };
                        }));
                    },
                    error: function () {
                        response([]);
                    }
                });
            },

            focus: function () {
                return false;
            },

            select: function (event, ui) {
                const $input = $(this);
                $input.data("autocomplete-just-selected", Date.now());
                const $fila = $input.closest("tr");
                const codigo = ui.item.codigo || (ui.item.item ? ui.item.item.CODIGO : null);
                if (!codigo) return false;

                try {
                    $input.autocomplete("close");
                } catch (e) { }
                $input.blur();

                const listaPrecio = $("#ddlClienteListaPrecio").val();
                const almacen = $("#ddlVentaAlmacen").val();

                cargarDetalleArticuloVenta(codigo, listaPrecio, almacen, function (detalle) {
                    if (!detalle || !detalle.ARTICULO) return;

                    confirmarItemDuplicado(detalle.ARTICULO.CODIGO, $fila).then(function (ok) {
                        if (ok) {
                            llenarFilaDetalleDesdeDetalleVenta($fila, detalle);
                            asegurarFocoEnCantidad($fila);
                        }
                    });
                }, {
                    mostrarLoading: true,
                    onError: function () {
                        limpiarFilaDetalle($fila);
                        Swal.fire({ type: "error", title: "Error", text: "No se pudo cargar el artículo seleccionado. Verifique e intente nuevamente." });
                    }
                });
                return false;
            }
        });
    }

    function inicializarAutocompleteDetalleCodigo($input) {
        $input.autocomplete({
            minLength: 1,
            delay: 150,

            source: function (request, response) {
                if (_modoLectura || _bloqueadoPorCliente || (window.PV && PV._clienteBloqueado)) {
                    response([]);
                    return;
                }

                const listaPrecio = $("#ddlClienteListaPrecio").val();
                const almacen = $("#ddlVentaAlmacen").val();

                if (!listaPrecio || !almacen) {
                    response([]);
                    return;
                }

                $.ajax({
                    url: "/PuntoVenta/Buscar_ArticulosAutocomplete",
                    type: "GET",
                    data: {
                        textoBusqueda: request.term,
                        codigoListaPrecio: parseInt(listaPrecio, 10) || 0,
                        codigoAlmacen: almacen
                    },
                    dataType: "json",
                    success: function (data) {
                        if (!data || data.length === 0) {
                            response([]);
                            return;
                        }
                        response(data.map(function (item) {
                            return {
                                label: `${item.CODIGO} - ${item.DESCRIPCION}`,
                                value: item.CODIGO,
                                codigo: item.CODIGO,
                                item: item
                            };
                        }));
                    },
                    error: function () {
                        response([]);
                    }
                });
            },

            focus: function () {
                return false;
            },

            select: function (event, ui) {
                const $input = $(this);
                $input.data("autocomplete-just-selected", Date.now());
                const $fila = $input.closest("tr");
                const codigo = ui.item.codigo || (ui.item.item ? ui.item.item.CODIGO : null);
                if (!codigo) return false;

                try {
                    $input.autocomplete("close");
                } catch (e) { }
                $input.blur();

                const listaPrecio = $("#ddlClienteListaPrecio").val();
                const almacen = $("#ddlVentaAlmacen").val();

                cargarDetalleArticuloVenta(codigo, listaPrecio, almacen, function (detalle) {
                    if (!detalle || !detalle.ARTICULO) return;

                    confirmarItemDuplicado(detalle.ARTICULO.CODIGO, $fila).then(function (ok) {
                        if (ok) {
                            llenarFilaDetalleDesdeDetalleVenta($fila, detalle);
                            asegurarFocoEnCantidad($fila);
                        }
                    });
                }, {
                    mostrarLoading: true,
                    onError: function () {
                        limpiarFilaDetalle($fila);
                        Swal.fire({ type: "error", title: "Error", text: "No se pudo cargar el artículo seleccionado. Verifique e intente nuevamente." });
                    }
                });
                return false;
            }
        });
    }

    function cargarDetalleArticuloVenta(codigoArticulo, codigoListaPrecio, codigoAlmacen, onSuccess, opciones) {
        opciones = opciones || {};
        const reintentos = opciones.reintentos || 1;
        const mostrarLoading = opciones.mostrarLoading === true;

        function quitarLoading() {
            if (mostrarLoading) $("body").removeClass("loading");
        }

        if (mostrarLoading) $("body").addClass("loading");

        function peticion(intento) {
            $.ajax({
                url: "/PuntoVenta/Buscar_DetalleArticuloVenta",
                type: "GET",
                dataType: "json",
                data: {
                    codigoArticulo: codigoArticulo,
                    codigoListaPrecio: codigoListaPrecio,
                    codigoAlmacen: codigoAlmacen,
                    codigoCliente: opciones.codigoCliente || ($("#txtClienteCodigo").val() || "").trim(),
                    codigoUmd: opciones.codigoUmd || ""
                },
                success: function (data) {
                    quitarLoading();
                    if (typeof onSuccess === "function") onSuccess(data);
                },
                error: function (xhr) {
                    if (intento < reintentos && (xhr.status === 500 || xhr.status === 0)) {
                        setTimeout(function () {
                            peticion(intento + 1);
                        }, 300);
                        return;
                    }

                    quitarLoading();
                    console.log("Error al cargar detalle optimizado del artículo");
                    if (typeof opciones.onError === "function") opciones.onError(xhr);
                }
            });
        }

        peticion(0);
    }

    function cargarDetalleArticulosVentaBatch(items, listaPrecio, almacen, codigoCliente, callback) {
        if (!items || items.length === 0) {
            if (typeof callback === "function") callback({});
            return;
        }

        $.ajax({
            url: "/PuntoVenta/Buscar_DetalleArticulosVentaBatch",
            type: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                Items: items,
                CodigoListaPrecio: parseInt(listaPrecio) || 1,
                CodigoAlmacen: almacen || "",
                CodigoCliente: codigoCliente || ""
            }),
            success: function (dictResultados) {
                if (typeof callback === "function") {
                    callback(dictResultados || {});
                }
            },
            error: function (xhr) {
                console.error("Error al cargar lote de detalle de artículos:", xhr);
                if (typeof callback === "function") {
                    callback({});
                }
            }
        });
    }

    function actualizarStockPorVenderDetalle(callback) {
        if (!PV.Utils.puedeInteractuar() || _modoLectura || $("#btnActualizarStockDetalle").is(":disabled")) return;

        var rowsArr = [];
        var items = [];
        $("#tblVentaDetalle tbody tr").each(function () {
            var $fila = $(this);
            var codigo = ($fila.find(".txtDetalleCodigo").val() || "").trim();
            if (codigo !== "") {
                var $txtPorVender = $fila.find(".txtDetallePorVender");
                var valPrevio = parseFloat($txtPorVender.val());
                if (isNaN(valPrevio)) valPrevio = 0;
                $fila.data("porVenderPrevio", valPrevio);

                rowsArr.push($fila);
                var umd = $fila.find(".ddlDetalleUmd").val();
                items.push({
                    CodigoArticulo: codigo,
                    CodigoUmd: umd ? parseInt(umd) : null
                });
            }
        });

        if (items.length === 0) {
            Swal.fire({
                type: "info",
                title: "Sin productos",
                text: "No hay productos en la tabla para actualizar la columna Por Vender."
            });
            return;
        }

        var total = items.length;
        var listaPrecio = (parseInt($("#ddlClienteListaPrecio").val()) || 1);
        var almacen = ($("#ddlVentaAlmacen").val() || "").trim();
        var codigoCliente = ($("#txtClienteCodigo").val() || "").trim();

        // Limpiar resaltados previos de variación
        $("#tblVentaDetalle tbody .txtDetallePorVender").removeClass("por-vender-cambiado").removeAttr("title").css({
            "background-color": "",
            "color": "",
            "font-weight": "",
            "border": ""
        });
        $("#tblVentaDetalle tbody td.td-por-vender-cambiado").removeClass("td-por-vender-cambiado").css("background-color", "");

        PV.Utils._procesando = true;
        $("#btnActualizarStockDetalle").prop("disabled", true);
        PV.Utils.mostrarModalProgreso("Actualizando Por Vender...", "Consultando stock desde SAP...", total);

        var $icon = $("#btnActualizarStockDetalle i");
        $icon.addClass("fa-spin");

        cargarDetalleArticulosVentaBatch(items, listaPrecio, almacen, codigoCliente, function (dictResultados) {
            if (!dictResultados || Object.keys(dictResultados).length === 0) {
                $icon.removeClass("fa-spin");
                PV.Utils.cerrarModalProgreso(100, function () {
                    PV.Utils._procesando = false;
                    $("#btnActualizarStockDetalle").prop("disabled", false);
                    if (typeof callback === "function") callback();
                });
                return;
            }

            var index = 0;
            var batchSize = 10;
            var actualizados = 0;
            var variaron = 0;

            function procesarLoteStock() {
                var limite = Math.min(index + batchSize, rowsArr.length);
                for (; index < limite; index++) {
                    var $fila = $(rowsArr[index]);
                    var codigo = ($fila.find(".txtDetalleCodigo").val() || "").trim().toUpperCase();
                    if (!codigo) continue;

                    var detalle = dictResultados[codigo] || dictResultados[codigo.toUpperCase()] || dictResultados[codigo.toLowerCase()];
                    if (detalle && detalle.ARTICULO) {
                        var forsale = Number(detalle.ARTICULO.STOCK !== undefined ? detalle.ARTICULO.STOCK : (detalle.ARTICULO.FORSALE || 0));
                        var $txtPorVender = $fila.find(".txtDetallePorVender");
                        var $tdPorVender = $txtPorVender.closest("td");

                        var valorAnterior = $fila.data("porVenderPrevio");
                        if (valorAnterior === undefined || isNaN(valorAnterior)) {
                            valorAnterior = parseFloat($txtPorVender.val()) || 0;
                        }

                        $txtPorVender.data("stockbase", forsale);

                        var factor = parseFloat($fila.find(".ddlDetalleUmd option:selected").data("factor")) || 1;
                        var porVenderCalc = (forsale / factor).toFixed(2);
                        var valorNuevo = parseFloat(porVenderCalc) || 0;

                        $txtPorVender.val(porVenderCalc);
                        $txtPorVender.toggleClass("por-vender-cero", valorNuevo === 0);

                        // Si el valor cambió respecto al que tenía antes de actualizar
                        if (Math.abs(valorAnterior - valorNuevo) > 0.0001) {
                            $txtPorVender.addClass("por-vender-cambiado");
                            $tdPorVender.addClass("td-por-vender-cambiado");
                            $txtPorVender.css({
                                "background-color": valorNuevo === 0 ? "#ed5565" : "#d1ecf1",
                                "color": valorNuevo === 0 ? "#ffffff" : "#0c5460",
                                "font-weight": "bold",
                                "border": valorNuevo === 0 ? "2px solid #b71c1c" : "1.5px solid #17a2b8"
                            });
                            $tdPorVender.css({
                                "background-color": valorNuevo === 0 ? "#ed5565" : "#d1ecf1"
                            });
                            $txtPorVender.attr("title", "Stock actualizado: cambió de " + valorAnterior.toFixed(2) + " a " + valorNuevo.toFixed(2));
                            variaron++;
                        } else {
                            $txtPorVender.removeClass("por-vender-cambiado");
                            $tdPorVender.removeClass("td-por-vender-cambiado");
                            $txtPorVender.css({
                                "background-color": "",
                                "color": "",
                                "font-weight": "",
                                "border": ""
                            });
                            $tdPorVender.css({
                                "background-color": ""
                            });
                            $txtPorVender.removeAttr("title");
                        }

                        actualizados++;
                    }
                }

                var itemActualCod = rowsArr[index - 1] ? (rowsArr[index - 1].find(".txtDetalleCodigo").val() || "") : "";
                PV.Utils.actualizarModalProgreso(index, total, itemActualCod);

                if (index < rowsArr.length) {
                    setTimeout(procesarLoteStock, 10);
                } else {
                    $icon.removeClass("fa-spin");
                    PV.Utils.actualizarModalProgreso(total, total, "Completado");
                    PV.Utils.cerrarModalProgreso(300, function () {
                        PV.Utils._procesando = false;
                        $("#btnActualizarStockDetalle").prop("disabled", false);
                        if (variaron > 0) {
                            Swal.mixin({
                                toast: true,
                                position: 'top-end',
                                showConfirmButton: false,
                                timer: 4000
                            }).fire({
                                type: 'info',
                                title: 'Stock actualizado: ' + variaron + ' artículo(s) con variación resaltados.'
                            });
                        }
                        if (typeof callback === "function") callback();
                    });
                }
            }

            procesarLoteStock();
        });
    }

    function cargarDetalleVentaReadOnlyBatch(items) {
        $("#tblVentaDetalle tbody").empty();
        if (!items || items.length === 0) {
            return;
        }

        var html = "";
        items.forEach(function (item) {
            var itemcode = item.ITEMCODE || "";
            var itemname = (item.ITEMNAME || "").replace(/"/g, "&quot;");
            var codebars = item.CODEBARS || "";
            var igv = item.IGV_AFECT || "IGV";
            var ugpentry = item.UOMENTRY || 0;
            var cantidad = item.QUANTITY || 0;
            var factor = Number(item.UMD_FACTOR || 1);
            if (factor <= 0) factor = 1;
            var precioUom = Number(item.PRICE_UOM || item.PRICE_BEF || (item.PRICE ? item.PRICE * factor * (item.IGV_AFECT === "IGV" || item.IGV_AFECT === "S" || item.IGV_AFECT === "Y" ? 1.18 : 1) : 0));
            var precio = precioUom.toFixed(5);
            var total = (Number(item.QUANTITY || 0) * precioUom).toFixed(2);
            var dscto = Number(item.WMS_DSC || 0).toFixed(2);
            var forsale = Number(item.FORSALE || 0).toFixed(2);
            var regalo = item.WMS_GIF || "NO";
            var vencimiento = item.FECHA_VENCIMIENTO || "";
            var umdNombre = (item.UMD_NOMBRE || "").replace(/"/g, "&quot;");

            var optVenc = vencimiento ? `<option value="${vencimiento}" selected>${vencimiento}</option>` : '<option value="">-- Seleccionar --</option>';
            var optUmd = umdNombre ? `<option value="${ugpentry}" selected>${umdNombre}</option>` : '';

            html += `
            <tr class="fila-detalle" data-itemcode="${itemcode}" data-codebars="${codebars}" data-igvafect="${igv}" data-lotes="[]">
                <td class="text-center">
                    <button type="button" class="btn btn-outline-primary btn-detalle-lote" tabindex="-1" title="Seleccionar lote" disabled>
                        <i class="fa fa-box"></i>
                    </button>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-primary btn-detalle-buscar" tabindex="-1" title="Buscar producto" disabled>
                        <i class="fa fa-search"></i>
                    </button>
                </td>
                <td>
                    <div class="input-group input-group-sm input-clear">
                        <input type="text" class="form-control txtDetalleDescripcion font-weight-bold" value="${itemname}" readonly maxlength="200" />
                        <div class="input-group-append">
                            <button type="button" class="btn btn-outline-secondary btn-detalle-limpiar d-none" disabled tabindex="-1"><i class="fa fa-times"></i></button>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="input-group input-group-sm input-clear">
                        <input type="text" class="form-control txtDetalleCodigo" value="${itemcode}" readonly maxlength="50" />
                        <div class="input-group-append">
                            <button type="button" class="btn btn-outline-secondary btn-detalle-limpiar d-none" disabled tabindex="-1"><i class="fa fa-times"></i></button>
                            <button type="button" class="btn btn-outline-primary btn-detalle-imagen" title="Ver imagen del producto" tabindex="-1"><i class="fa fa-image"></i></button>
                        </div>
                    </div>
                </td>
                <td>
                    <input type="text" class="form-control txtDetallePorVender text-right" value="${forsale}" readonly tabindex="-1" />
                </td>
                <td>
                    <div class="input-group input-group-sm">
                        <input type="text" inputmode="numeric" class="form-control txtDetalleCantidad text-right" value="${cantidad}" readonly tabindex="-1" />
                    </div>
                </td>
                <td>
                    <select class="form-control ddlDetalleUmd" disabled>${optUmd}</select>
                </td>
                <td>
                    <input type="text" class="form-control txtDetallePrecio text-right" value="${precio}" readonly tabindex="-1" />
                </td>
                <td>
                    <input type="text" class="form-control txtDetalleTotal text-right" value="${total}" readonly tabindex="-1" />
                </td>
                <td>
                    <select class="form-control txtDetalleVencimiento" tabindex="-1" disabled>${optVenc}</select>
                </td>
                <td>
                    <input type="text" class="form-control txtDetalleRegalo" value="${regalo}" readonly tabindex="-1" />
                </td>
                <td>
                    <input type="text" class="form-control txtDetalleDescuento" value="${dscto}" readonly tabindex="-1" />
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-danger btn-detalle-eliminar" tabindex="-1" disabled title="Eliminar"><i class="fa fa-trash"></i></button>
                </td>
            </tr>`;
        });

        $("#tblVentaDetalle tbody").html(html);

        $("#tblVentaDetalle tbody tr").each(function (idx) {
            var item = items[idx];
            if (item) {
                var factor = Number(item.UMD_FACTOR || 1);
                if (factor <= 0) factor = 1;
                var precioUom = Number(item.PRICE_UOM || item.PRICE_BEF || (item.PRICE ? item.PRICE * factor * (item.IGV_AFECT === "IGV" || item.IGV_AFECT === "S" || item.IGV_AFECT === "Y" ? 1.18 : 1) : 0));
                $(this).data("ugpentry", item.UOMENTRY || 0);
                $(this).find(".txtDetallePrecio").data("preciobase", precioUom / factor);
                $(this).find(".txtDetallePorVender").data("stockbase", Number(item.FORSALE || 0));
                _resaltarPorVender($(this));
                if (item.LOTES && item.LOTES.length > 0) {
                    $(this).data("lotes", item.LOTES);
                    $(this).find(".btn-detalle-lote").removeClass("btn-outline-primary").addClass("btn-success");
                }
                var vencimiento = item.FECHA_VENCIMIENTO || "";
                if (vencimiento) {
                    var partes = vencimiento.split("/");
                    if (partes.length === 3) {
                        var fechaLote = new Date(partes[2], partes[1] - 1, partes[0]);
                        var unAnio = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate());
                        $(this).find(".txtDetalleVencimiento").toggleClass("vencimiento-proximo", fechaLote < unAnio);
                    }
                }
            }
        });
    }

    function cargarUmdArticulo($fila, codigoArticulo, callback) {
        $.ajax({
            url: "/PuntoVenta/Buscar_UmdArticulo",
            type: "GET",
            dataType: "json",
            data: {
                codigoArticulo: codigoArticulo
            },
            success: function (data) {
                cargarUmdsEnFila($fila, data, null, callback);
            },
            error: function () {
                console.log("Error al cargar UMD");
                if (typeof callback === "function") {
                    callback($fila.find(".ddlDetalleUmd"), []);
                }
            }
        });
    }

    function aplicarPromoLinea($fila, promos, opciones) {
        opciones = opciones || {};
        const factor = parseFloat($fila.find(".ddlDetalleUmd").find(":selected").data("factor")) || 1;
        const precioBase = parseFloat($fila.find(".txtDetallePrecio").data("preciobase")) || 0;
        const cantidad = leerCantidadFila($fila);
        const precioNormal = (precioBase * factor).toFixed(5);

        const $precio = $fila.find(".txtDetallePrecio");
        const $descuento = $fila.find(".txtDetalleDescuento");
        const $regalo = $fila.find(".txtDetalleRegalo");

        $precio.val(precioNormal);
        $descuento.val("0");
        $regalo.val("NO");

        const lista = Array.isArray(promos) ? promos : (promos ? [promos] : []);
        const lineaBase = lista.find(function (p) { return p && p.PROMO_TYPE; });
        if (!lineaBase) {
            recalcularLinea($fila);
            if (!opciones.omitirRecalcularTotales) {
                recalcularTotales();
            }
            return;
        }

        const tipo = lineaBase.PROMO_TYPE;

        switch (tipo) {
            case "P": {
                const linea = lista.find(function (p) {
                    return p && p.PROMO_TYPE === tipo && p.CANTIDAD === 0
                        && p.PRECIO > 0 && p.DESCUENTO === 0;
                });
                if (linea) {
                    $precio.val(Number(linea.PRECIO).toFixed(5));
                }
                break;
            }
            case "Q": {
                const linea = lista
                    .filter(function (p) {
                    return p && p.PROMO_TYPE === tipo && p.CANTIDAD > 0
                        && p.PRECIO > 0 && p.DESCUENTO === 0
                        && cantidad >= p.CANTIDAD;
                    })
                    .sort(function (a, b) { return Number(b.CANTIDAD) - Number(a.CANTIDAD); })[0];
                if (linea) {
                    $precio.val(Number(linea.PRECIO).toFixed(5));
                }
                break;
            }
            case "D": {
                const linea = lista
                    .filter(function (p) {
                    return p && p.PROMO_TYPE === tipo && p.PRECIO === 0
                        && p.DESCUENTO > 0 && cantidad >= p.CANTIDAD;
                    })
                    .sort(function (a, b) { return Number(b.CANTIDAD) - Number(a.CANTIDAD); })[0];
                if (linea) {
                    $descuento.val(Number(linea.DESCUENTO).toFixed(2));
                }
                break;
            }
            case "R": {
                const linea = lista
                    .filter(function (p) {
                    return p && p.PROMO_TYPE === tipo && p.PRECIO === 0
                        && p.DESCUENTO === 0 && cantidad >= p.CANTIDAD;
                    })
                    .sort(function (a, b) { return Number(b.CANTIDAD) - Number(a.CANTIDAD); })[0];
                $regalo.val(linea ? "SI" : "NO");
                break;
            }
        }

        recalcularLinea($fila);
        if (!opciones.omitirRecalcularTotales) {
            recalcularTotales();
        }
    }

    function aplicarPromoArticulo($fila) {
        const codigo = $fila.attr("data-itemcode");
        if (!codigo) return;

        const codigoCliente = ($("#txtClienteCodigo").val() || "").trim();
        const codigoListaPrecio = $("#ddlClienteListaPrecio").val();
        const codigoUmd = $fila.find(".ddlDetalleUmd").val();

        if (!codigoListaPrecio || !codigoUmd) return;

        var prevTimer = $fila.data("promoTimer");
        if (prevTimer) clearTimeout(prevTimer);

        var timer = setTimeout(function () {
            if (!$fila.closest("tbody").length) return;

            const version = ($fila.data("promoVersion") || 0) + 1;
            $fila.data("promoVersion", version);

            $.ajax({
                url: "/PuntoVenta/Buscar_PromoArticulo",
                type: "GET",
                dataType: "json",
                data: {
                    codigoArticulo: codigo,
                    codigoCliente: codigoCliente,
                    codigoListaPrecio: codigoListaPrecio,
                    codigoUmd: codigoUmd
                },
                success: function (data) {
                    if ($fila.data("promoVersion") !== version) return;

                    if (!data || data.length === 0) {
                        aplicarPromoLinea($fila, null);
                        return;
                    }
                    aplicarPromoLinea($fila, data);
                },
                error: function () {
                    console.log("Error al consultar promo");
                    aplicarPromoLinea($fila, null);
                }
            });
        }, 150);

        $fila.data("promoTimer", timer);
    }

    $(document).on("input", "#txtVentaFlete", function () {
        this.value = this.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
        if (typeof PV.Detalle.recalcularTotales === "function") {
            PV.Detalle.recalcularTotales();
        }
    });

    $(document).on("blur", "#txtVentaFlete", function () {
        const val = parseFloat(this.value);
        this.value = isNaN(val) ? "" : val.toFixed(2);
        if (typeof PV.Detalle.recalcularTotales === "function") {
            PV.Detalle.recalcularTotales();
        }
    });

    $(document).on("change", "#txtVentaDescuento", function () {
        if (typeof PV.Detalle.recalcularTotales === "function") {
            PV.Detalle.recalcularTotales();
        }
    });

    $(document).on("change", ".chk-nota-credito", function () {
        recalcularTotales();
    });

    function _cargarFechasVencimiento($fila, codigoArticulo) {
        var almacen = $("#ddlVentaAlmacen").val();
        if (!almacen || !codigoArticulo) return;

        $.ajax({
            url: "/PuntoVenta/Buscar_LotesArticulo",
            type: "GET",
            data: { codigoArticulo: codigoArticulo, codigoAlmacen: almacen },
            dataType: "json",
            success: function (data) {
                $fila.data("lotesData", data || []);

                var $select = $fila.find(".txtDetalleVencimiento");
                var fechas = [];
                (data || []).forEach(function (lote) {
                    var fecha = (lote.FECHA_VENCIMIENTO || "").trim();
                    if (fecha && fechas.indexOf(fecha) === -1 && parseFloat(lote.QUANTITY || 0) > 0) {
                        fechas.push(fecha);
                    }
                });

                fechas.sort(function (a, b) {
                    var da = a.split("/"), db = b.split("/");
                    return new Date(da[2], da[1] - 1, da[0]) - new Date(db[2], db[1] - 1, db[0]);
                });

                $select.empty().append('<option value="">-- Seleccionar --</option>');
                fechas.forEach(function (f) {
                    $select.append('<option value="' + f + '">' + f + '</option>');
                });

                if (fechas.length >= 1) {
                    $select.val(fechas[0]);
                    $select.prop("disabled", fechas.length === 1);
                }

                var hoy = new Date();
                var unAnio = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate());
                var vencimientoProximo = false;
                fechas.forEach(function (f) {
                    var partes = f.split("/");
                    var fechaLote = new Date(partes[2], partes[1] - 1, partes[0]);
                    if (fechaLote < unAnio) vencimientoProximo = true;
                });
                $select.toggleClass("vencimiento-proximo", vencimientoProximo);
            }
        });
    }

    function setearFechaDesdeLotes($fila, lotesAsignados) {
        var lotesData = $fila.data("lotesData") || [];
        if (!lotesAsignados || lotesAsignados.length === 0) {
            $fila.find(".txtDetalleVencimiento").prop("disabled", false).removeClass("vencimiento-proximo");
            return;
        }
        if (lotesData.length === 0) return;

        var fechas = [];
        lotesAsignados.forEach(function (loteAsig) {
            var match = lotesData.find(function (ld) {
                return String(ld.SYSNUMBER) === String(loteAsig.SYSNUMBER);
            });
            if (match && match.FECHA_VENCIMIENTO) {
                var f = match.FECHA_VENCIMIENTO.trim();
                if (fechas.indexOf(f) === -1) fechas.push(f);
            }
        });

        if (fechas.length === 0) return;

        fechas.sort(function (a, b) {
            var da = a.split("/"), db = b.split("/");
            return new Date(da[2], da[1] - 1, da[0]) - new Date(db[2], db[1] - 1, db[0]);
        });

        var $select = $fila.find(".txtDetalleVencimiento");
        $select.val(fechas[0]).prop("disabled", true);

        var partes = fechas[0].split("/");
        var fechaLote = new Date(partes[2], partes[1] - 1, partes[0]);
        var unAnio = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate());
        $select.toggleClass("vencimiento-proximo", fechaLote < unAnio);
    }

    function resetearFlete(valor) {
        var fleteVal = (valor !== undefined && valor !== null && String(valor).trim() !== "") ? parseFloat(valor) || 0 : 0;
        $("#txtVentaFlete").val(fleteVal.toFixed(2)).prop("readonly", true).addClass("bg-light");
        $("#btnDesbloquearFlete").prop("disabled", _modoLectura);
    }

    function setFormReadOnly(readOnly) {
        _modoLectura = readOnly;
        ocultarMenuContextual();
        $("#btnVentaGuardar, #btnVentaBorrador, #btnVentaImportarArticulo, #btnActualizarNotasCredito, #btnActualizarStockDetalle, #btnDesbloquearLugarEnvio, #btnDesbloquearFlete, .btn-clear-input").prop("disabled", readOnly);
        $("#tab-cliente input, #tab-cliente select, #tab-cliente textarea").prop("disabled", readOnly);
        $("#tab-logistica input, #tab-logistica select, #tab-logistica textarea").prop("disabled", readOnly);
        $("#tab-financiero input, #tab-financiero select, #tab-financiero textarea").prop("disabled", readOnly);
        $("#txtVentaFlete, #txtVentaDescuento, #txtVentaTotal, #txtVentaNeto, #txtVentaTotalItems").prop("disabled", readOnly);
        $(".btn-detalle-buscar, .btn-detalle-eliminar, .btn-detalle-limpiar, .btn-detalle-lote, .btn-detalle-promo, #btnActualizarStockDetalle").prop("disabled", readOnly);
        $(".btn-detalle-imagen").prop("disabled", false);
        $(".txtDetalleCantidad").prop("readonly", readOnly);
        $(".txtDetalleCantidadSelect").prop("disabled", readOnly);
        $(".txtDetalleCodigo, .txtDetalleDescripcion").prop("disabled", readOnly);
        $(".chk-nota-credito").prop("disabled", readOnly);
        $(".txtDetalleVencimiento").prop("disabled", readOnly);

        if (readOnly) {
            $(".ddlDetalleUmd").prop("disabled", true);
            $("#btnDesbloquearLugarEnvio").prop("disabled", true);
            $("#btnDesbloquearFlete").prop("disabled", true);
        } else {
            document.getElementById("txtVentaFechaAtencion")?._flatpickr?.set("minDate", "today");
            document.getElementById("txtLogisticaFechaEntrega")?._flatpickr?.set("minDate", "today");
            $("#tblVentaDetalle tbody tr").each(function () {
                var $ddl = $(this).find(".ddlDetalleUmd");
                if ($ddl.find("option").length > 1) {
                    $ddl.prop("disabled", false).css({ "background-color": "", "cursor": "" });
                } else {
                    $ddl.prop("disabled", true).css({ "background-color": "#e9ecef", "cursor": "not-allowed" });
                }
            });
            if (window.PV && PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
                PV.Catalogos.actualizarEstadoHorasEntrega();
            }
            if (window.PV && PV.Catalogos && typeof PV.Catalogos.actualizarEstadoLugarEnvio === "function") {
                PV.Catalogos.actualizarEstadoLugarEnvio({ esCambioManual: false });
            }
            $("#btnDesbloquearFlete").prop("disabled", false);
        }
    }

    function bloquearPorClienteBloqueado(bloqueado) {
        _bloqueadoPorCliente = bloqueado;

        if (bloqueado) {
            $("#btnVentaGuardar, #btnVentaBorrador, #btnVentaImportarArticulo, #btnActualizarStockDetalle").prop("disabled", true);
            $(".btn-detalle-buscar, .btn-detalle-eliminar, .btn-detalle-limpiar, .btn-detalle-lote, .btn-detalle-promo, #btnActualizarStockDetalle").prop("disabled", true);
            $(".btn-detalle-imagen").prop("disabled", false);
            $(".txtDetalleCantidad").prop("readonly", true);
            $(".txtDetalleCantidadSelect").prop("disabled", true);
            $(".txtDetalleCodigo, .txtDetalleDescripcion").prop("disabled", true);
            $(".ddlDetalleUmd").prop("disabled", true);
        } else {
            if (!_modoLectura) {
                $("#btnVentaGuardar, #btnVentaBorrador, #btnVentaImportarArticulo, #btnActualizarStockDetalle").prop("disabled", false);
                $(".btn-detalle-buscar, .btn-detalle-eliminar, .btn-detalle-limpiar, .btn-detalle-lote, .btn-detalle-promo, #btnActualizarStockDetalle").prop("disabled", false);
                $(".btn-detalle-imagen").prop("disabled", false);
                $(".txtDetalleCantidad").prop("readonly", false);
                $(".txtDetalleCantidadSelect").prop("disabled", false);
                $(".txtDetalleCodigo, .txtDetalleDescripcion").prop("disabled", false);

                $("#tblVentaDetalle tbody tr").each(function () {
                    var $ddl = $(this).find(".ddlDetalleUmd");
                    if ($ddl.find("option").length > 1) {
                        $ddl.prop("disabled", false).css({ "background-color": "", "cursor": "" });
                    } else {
                        $ddl.prop("disabled", true).css({ "background-color": "#e9ecef", "cursor": "not-allowed" });
                    }
                });
            }
        }
    }

    function esUmdPza($fila) {
        var texto = ($fila.find(".ddlDetalleUmd :selected").text() || "").trim().toUpperCase();
        return texto === "PZA" || texto === "PIEZA";
    }

    function obtenerUmdsFila($fila) {
        return $fila.data("umds") || [];
    }

    function configurarCantidadFraccionada($fila, fraccionado, montoMinimo) {
        var $td = $fila.find(".txtDetalleCantidad").closest("td");
        if ($td.length === 0) $td = $fila.find(".txtDetalleCantidadSelect").closest("td");
        var $wrapper = $td.find(".input-group");

        fraccionado = parseInt(fraccionado, 10) || 0;
        montoMinimo = parseInt(montoMinimo, 10) || (parseInt($fila.data("montominimo"), 10) || fraccionado);

        if (fraccionado > 0 && esUmdPza($fila)) {
            var $ddlUmd = $fila.find(".ddlDetalleUmd");
            var siguienteFactor = parseFloat($ddlUmd.data("basefactor")) || 0;

            if (siguienteFactor <= 1) {
                $ddlUmd.find("option").each(function () {
                    var texto = ($(this).text() || "").trim().toUpperCase();
                    if (texto !== "PZA" && texto !== "PIEZA") {
                        var f = parseFloat($(this).data("factor")) || 0;
                        if (f > 1) siguienteFactor = f;
                    }
                });
            }

            siguienteFactor = Math.round(siguienteFactor);
            var inicio = (montoMinimo > 0 && montoMinimo >= fraccionado) ? montoMinimo : fraccionado;
            var opciones = [];

            if (siguienteFactor > 1 && siguienteFactor > inicio) {
                var numOpciones = Math.floor((siguienteFactor - inicio) / fraccionado) + 1;
                // Si la cantidad de opciones es razonable (máx 150), armar el select desplegable
                if (numOpciones > 0 && numOpciones <= 150) {
                    for (var i = inicio, iter = 0; i < siguienteFactor && iter < 150; i += fraccionado, iter++) {
                        opciones.push(i);
                    }
                }
            }

            if (opciones.length > 0) {
                var $select = $wrapper.find(".txtDetalleCantidadSelect");
                var $input = $wrapper.find(".txtDetalleCantidad");

                if ($input.length > 0) {
                    var estabaEnfocado = $input.is(":focus");
                    var valorActual = parseInt($input.val(), 10) || inicio;
                    var closest = opciones.reduce(function (prev, curr) {
                        return Math.abs(curr - valorActual) < Math.abs(prev - valorActual) ? curr : prev;
                    });
                    var selectHtml = '<select class="form-control txtDetalleCantidadSelect text-center" style="max-width:110px; text-align: center; text-align-last: center;">';
                    opciones.forEach(function (op) {
                        var sel = op === closest ? " selected" : "";
                        selectHtml += '<option value="' + op + '"' + sel + ' style="text-align: center;">' + op + ' PZAS</option>';
                    });
                    selectHtml += '</select>';
                    var $nuevoSelect = $(selectHtml);
                    $input.replaceWith($nuevoSelect);
                    if (!_modoLectura && estabaEnfocado && $(".modal:visible").length === 0) {
                        $nuevoSelect.focus();
                    }
                } else if ($select.length > 0) {
                    var estabaEnfocado = $select.is(":focus");
                    var valorActual = parseInt($select.val(), 10) || inicio;
                    var closest = opciones.reduce(function (prev, curr) {
                        return Math.abs(curr - valorActual) < Math.abs(prev - valorActual) ? curr : prev;
                    });
                    var selectHtml = '';
                    opciones.forEach(function (op) {
                        var sel = op === closest ? " selected" : "";
                        selectHtml += '<option value="' + op + '"' + sel + ' style="text-align: center;">' + op + ' PZAS</option>';
                    });
                    $select.html(selectHtml);
                    if (!_modoLectura && estabaEnfocado && $(".modal:visible").length === 0) {
                        $select.focus();
                    }
                }
                return;
            }
        }

        var $select = $wrapper.find(".txtDetalleCantidadSelect");
        if ($select.length > 0) {
            var estabaEnfocado = $select.is(":focus");
            var $nuevoInput = $('<input type="text" inputmode="numeric" class="form-control txtDetalleCantidad text-right" placeholder="0" maxlength="8" autocomplete="off" value="" />');
            $select.replaceWith($nuevoInput);
            if (!_modoLectura && estabaEnfocado && $(".modal:visible").length === 0) {
                $nuevoInput.focus();
            }
        }
    }

    function leerCantidadFila($fila) {
        var $select = $fila.find(".txtDetalleCantidadSelect");
        if ($select.length > 0) {
            return parseInt($select.val(), 10) || 0;
        }
        return parseInt($fila.find(".txtDetalleCantidad").val(), 10) || 0;
    }

    function validarFraccionadoFila($fila) {
        var fraccionado = $fila.data("fraccionado");
        if (!fraccionado) return true;

        if (esUmdPza($fila)) {
            var cant = leerCantidadFila($fila);
            var montoMinimo = $fila.data("montominimo") || fraccionado;
            if (cant < montoMinimo || cant % fraccionado !== 0) {
                var desc = $fila.find(".txtDetalleDescripcion").val() || $fila.find(".txtDetalleCodigo").val();
                return false;
            }
        }
        return true;
    }

    function revertirUmddFila($fila) {
        var $ddl = $fila.find(".ddlDetalleUmd");
        var baseUmdd = $ddl.data("baseumd");
        if (baseUmdd) {
            $ddl.val(baseUmdd);
        } else {
            $ddl.prop("selectedIndex", 0);
        }
        $ddl.trigger("change");
    }

    function setRecolectarErroresFraccionado(activo) {
        if (activo) {
            _recolectarErroresFraccionado = true;
            _erroresFraccionado = [];
            return [];
        }
        _recolectarErroresFraccionado = false;
        var lista = _erroresFraccionado;
        _erroresFraccionado = [];
        return lista;
    }

    function _marcarErrorFraccionado($fila, motivo) {
        $fila.data("error-fraccionado", 1);
        $fila.addClass("fila-error-fraccionado");
        $fila.find(".txtDetalleDescripcion").attr("title", motivo);
    }

    function _quitarMarcaErrorFraccionado($fila) {
        if (!$fila.data("error-fraccionado")) return;
        $fila.removeData("error-fraccionado");
        $fila.removeClass("fila-error-fraccionado");
        $fila.find(".txtDetalleDescripcion").removeAttr("title");
    }

    function verificarFraccionadoFila($fila) {
        var tienePza = esUmdPza($fila);
        if (!tienePza) {
            $fila.removeData("fraccionado");
            $fila.removeData("montominimo");
            _quitarMarcaErrorFraccionado($fila);
            configurarCantidadFraccionada($fila, 0, 0);
            return;
        }

        var codigo = $fila.attr("data-itemcode");
        if (!codigo) return;

        var filaDom = $fila[0];
        if (_filaFraccionadoEnCurso === filaDom || _filaFraccionadoDialogo === filaDom) return;

        _filaFraccionadoEnCurso = filaDom;

        $.ajax({
            url: "/PuntoVenta/Validar_ArticuloFraccionado",
            type: "GET",
            data: { itemcode: codigo },
            dataType: "json",
            success: function (resp) {
                _filaFraccionadoEnCurso = null;

                if (resp.fraccionado && resp.multiplo > 0) {
                    var montoMin = resp.montoMinimo && resp.montoMinimo > 0 ? resp.montoMinimo : resp.multiplo;
                    $fila.data("fraccionado", resp.multiplo);
                    $fila.data("montominimo", montoMin);
                    _quitarMarcaErrorFraccionado($fila);
                    configurarCantidadFraccionada($fila, resp.multiplo, montoMin);
                    return;
                }

                $fila.removeData("fraccionado");
                $fila.removeData("montominimo");
                configurarCantidadFraccionada($fila, 0, 0);

                var umds = obtenerUmdsFila($fila);
                var soloPza = umds.length > 0 && umds.every(function (u) {
                    var n = (u.NOMBRE || "").trim().toUpperCase();
                    return n === "PZA" || n === "PIEZA";
                });

                var desc = $fila.find(".txtDetalleDescripcion").val() || $fila.find(".txtDetalleCodigo").val() || codigo;
                var motivo = soloPza
                    ? 'El artículo "' + desc + '" no permite venta fraccionada y su única UMD es PZA.'
                    : 'El artículo "' + desc + '" no permite venta fraccionada; cambie la UMD o retire la línea.';

                if (_recolectarErroresFraccionado) {
                    _marcarErrorFraccionado($fila, motivo);
                    _erroresFraccionado.push({
                        codigo: codigo,
                        descripcion: desc,
                        motivo: motivo
                    });
                    return;
                }

                if (soloPza) {
                    _filaFraccionadoDialogo = filaDom;
                    limpiarFilaDetalle($fila);
                    Swal.fire({
                        title: "Artículo no disponible",
                        text: 'El artículo "' + desc + '" no permite venta fraccionada y su única UMD es PZA.',
                        type: "warning",
                        confirmButtonText: "Aceptar"
                    }).then(function () {
                        _filaFraccionadoDialogo = null;
                    });
                    return;
                }

                _filaFraccionadoDialogo = filaDom;
                Swal.fire({
                    title: "Artículo no fraccionado",
                    text: "Este artículo no permite venta fraccionada.",
                    type: "warning",
                    confirmButtonText: "Aceptar"
                }).then(function () {
                    _filaFraccionadoDialogo = null;
                });
                revertirUmddFila($fila);
            },
            error: function () {
                _filaFraccionadoEnCurso = null;
                console.log("Error al validar fraccionado");
            }
        });
    }

    function isReadOnly() {
        return _modoLectura;
    }

    function enfocarFilaVaciaFinal() {
        if (_modoLectura || _bloqueadoPorCliente) return;

        asegurarFilaVaciaFinal();

        var $filas = $("#tblVentaDetalle tbody tr");
        if ($filas.length === 0) return;

        var $ultimaFila = $filas.last();
        var $inputDesc = $ultimaFila.find(".txtDetalleDescripcion");

        if ($inputDesc.length && !$inputDesc.is(":disabled") && !$inputDesc.prop("readonly")) {
            if ($ultimaFila[0] && $ultimaFila[0].scrollIntoView) {
                $ultimaFila[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
            $inputDesc.focus().select();
        }
    }

    return {
        inicializar: inicializar,
        agregarFilaDetalleVacia: agregarFilaDetalleVacia,
        recalcularLinea: recalcularLinea,
        recalcularTotales: recalcularTotales,
        llenarFilaDetalle: llenarFilaDetalle,
        llenarFilaDetalleDesdeDetalleVenta: llenarFilaDetalleDesdeDetalleVenta,
        cargarFilaDetalleDesdeVenta: cargarFilaDetalleDesdeVenta,
        setFormReadOnly: setFormReadOnly,
        isReadOnly: isReadOnly,
        enfocarFilaVaciaFinal: enfocarFilaVaciaFinal,
        bloquearPorClienteBloqueado: bloquearPorClienteBloqueado,
        cargarUmdArticulo: cargarUmdArticulo,
        cargarDetalleArticuloVenta: cargarDetalleArticuloVenta,
        cargarDetalleArticulosVentaBatch: cargarDetalleArticulosVentaBatch,
        cargarDetalleVentaReadOnlyBatch: cargarDetalleVentaReadOnlyBatch,
        aplicarPromoArticulo: aplicarPromoArticulo,
        aplicarPromoLinea: aplicarPromoLinea,
        setearFechaDesdeLotes: setearFechaDesdeLotes,
        esUmdPza: esUmdPza,
        obtenerUmdsFila: obtenerUmdsFila,
        configurarCantidadFraccionada: configurarCantidadFraccionada,
        leerCantidadFila: leerCantidadFila,
        validarFraccionadoFila: validarFraccionadoFila,
        revertirUmddFila: revertirUmddFila,
        verificarFraccionadoFila: verificarFraccionadoFila,
        setRecolectarErroresFraccionado: setRecolectarErroresFraccionado,
        abrirMenuContextualDetalle: abrirMenuContextualDetalle,
        ocultarMenuContextual: ocultarMenuContextual,
        navegarCeldaVertical: navegarCeldaVertical,
        enfocarCantidadFila: enfocarCantidadFila,
        asegurarFocoEnCantidad: asegurarFocoEnCantidad,
        verificarAlertaLimiteCredito: verificarAlertaLimiteCredito,
        actualizarStockPorVenderDetalle: actualizarStockPorVenderDetalle,
        resetearFlete: resetearFlete
    };

})();
