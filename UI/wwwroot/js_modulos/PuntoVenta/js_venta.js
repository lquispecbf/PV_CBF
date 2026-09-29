var tblBusquedaVentas = null;

$(document).ready(function () {

    PV.Core.inicializar();
    PV.Catalogos.cargarTodo();
    PV.Cliente.inicializar();
    PV.Detalle.inicializar();
    PV.Hotkeys.inicializar();
    PV.Validaciones.inicializar();
    if (PV.DraftManager && typeof PV.DraftManager.inicializar === "function") {
        PV.DraftManager.inicializar();
    }

    inicializarTablaBusqueda();



    $("#btnBusquedaBuscar").on("click", function (e) {
        e.preventDefault();
        if (!PV.Utils.puedeInteractuar()) return;

        if (rangoFechasInvalido()) {
            Swal.fire({
                type: "warning",
                title: "Rango de fechas inválido",
                text: "La fecha de inicio no puede ser mayor que la fecha de fin."
            });
            return;
        }

        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $("#btnBusquedaBuscar").prop("disabled", true);
            buscarVentas(function () {
                $("#btnBusquedaBuscar").prop("disabled", false);
                reHabilitar();
            });
        });
    });

    $("#btnBusquedaExportar").on("click", function (e) {
        e.preventDefault();
        if (!PV.Utils.puedeInteractuar()) return;
        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $("#btnBusquedaExportar").prop("disabled", true);
            const filtro = {
                CLIENTE: $("#txtBusquedaClienteDocumento").val() || "",
                VENDEDOR: $("#ddlBusquedaVendedor").val() || "",
                FECHA_INICIO: $("#txtBusquedaFechaInicio").val() || "",
                FECHA_FIN: $("#txtBusquedaFechaFin").val() || ""
            };
            $.ajax({
                url: "/PuntoVenta/ExportarExcel_Ventas",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(filtro),
                xhrFields: { responseType: "blob" },
                success: function (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "Reporte Ventas.xlsx";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                },
                error: function (xhr) {
                    if (xhr.status === 404) {
                        Swal.fire({ type: "warning", title: "Sin datos", text: "No se encontraron datos para exportar." });
                    } else {
                        Swal.fire({ type: "error", title: "Error", text: "Error al exportar el reporte." });
                    }
                },
                complete: function () {
                    $("#btnBusquedaExportar").prop("disabled", false);
                    reHabilitar();
                }
            });
        });
    });

    $(document).on("keydown", ".filtros-busqueda input, .filtros-busqueda select", function (e) {
        if (e.key !== "Enter") return;

        const $control = $(this);
        const ac = $control.data("ui-autocomplete") || $control.data("autocomplete");
        if (ac && ac.menu && ac.menu.element && ac.menu.element.is(":visible")) {
            ac.close();
        }

        e.preventDefault();

        if (rangoFechasInvalido()) {
            Swal.fire({
                type: "warning",
                title: "Rango de fechas inválido",
                text: "La fecha de inicio no puede ser mayor que la fecha de fin."
            });
            return;
        }

        buscarVentas();
    });

    $(document).on("click", "#btnBusquedaAcciones + .dropdown-menu .dropdown-item", function (e) {
        var accion = $(this).data("accion");
        if (accion === "enviar-sap") {
            trasladarDesdeBusqueda();
            return;
        }
        if (accion === "ticket") {
            imprimirTicketDesdeBusqueda();
            return;
        }
        if (accion === "preliminar-sap") {
            imprimirPreliminarSapDesdeBusqueda();
            return;
        }
        if (accion === "preliminar-pv") {
            imprimirPreliminarPvDesdeBusqueda();
            return;
        }
        e.preventDefault();
    });

    $("#btnBusquedaEnviarWms").on("click", function (e) {
        e.preventDefault();
        enviarWmsDesdeBusqueda();
    });

    $("#btnBusquedaImprimir").on("click", function (e) {
        e.preventDefault();
        imprimirDesdeBusqueda();
    });
});

function inicializarTablaBusqueda() {
    tblBusquedaVentas = $("#tblBusquedaVentas").DataTable({
        data: [],
        autoWidth: false,
        columns: [
            {
                data: null,
                defaultContent: '<button type="button" class="btn btn-sm btn-ver-venta" style="background-color:#1d81ce;color:#fff;" tabindex="-1" title="Ver venta"><i class="fa fa-eye"></i></button>',
                orderable: false,
                searchable: false,
                className: "text-center",
                width: "50px"
            },
            {
                data: null,
                defaultContent: '<button type="button" class="btn btn-sm btn-danger btn-anular-venta" tabindex="-1" title="Anular venta"><i class="fa fa-trash"></i></button>',
                orderable: false,
                searchable: false,
                className: "text-center",
                width: "50px"
            },
            {
                data: null,
                defaultContent: '<button type="button" class="btn btn-sm btn-reabrir-venta" style="background-color:#f3af5e;color:#fff;" tabindex="-1" title="Reabrir venta"><i class="fa fa-edit"></i></button>',
                orderable: false,
                searchable: false,
                className: "text-center",
                width: "50px"
            },
            {
                data: null,
                orderable: false,
                searchable: false,
                className: "text-center",
                width: "50px",
                visible: !!window.PUEDE_MODIFICAR_CONDICION_PAGO,
                render: function (data, type, row) {
                    var estado = (row.ESTADO_ENVIO || "").toUpperCase().trim();
                    var docStatus = (row.DOCSTATUS || "").toUpperCase().trim();
                    var habilitado = (estado === "ENVIADO WMS" || docStatus === "W");
                    if (habilitado) {
                        return '<button type="button" class="btn btn-sm btn-info btn-cambiar-cond-pago" tabindex="-1" title="Modificar Condición de Pago"><i class="fa fa-credit-card"></i></button>';
                    } else {
                        return '<button type="button" class="btn btn-sm btn-secondary btn-cambiar-cond-pago" disabled tabindex="-1" title="Solo disponible para estado ENVIADO WMS"><i class="fa fa-credit-card"></i></button>';
                    }
                }
            },
            {
                data: "CLIENTE",
                className: "col-cliente-cell",
                width: "280px",
                render: function (data) {
                    var val = data || "";
                    var escaped = $("<div>").text(val).html();
                    return '<span class="celda-cliente" title="' + escaped + '">' + escaped + '</span>';
                }
            },
            { data: "RUC_DNI" },
            {
                data: "FECHA",
                render: function (data, type, row) {
                    var info = formatearFechaDDMMYYYY(data);
                    if (type === "sort" || type === "type") {
                        return info.sort;
                    }
                    return info.display;
                }
            },
            {
                data: "VENDEDOR",
                className: "col-vendedor-cell",
                width: "130px",
                render: function (data) {
                    var val = data || "";
                    var escaped = $("<div>").text(val).html();
                    return '<span class="celda-vendedor" title="' + escaped + '">' + escaped + '</span>';
                }
            },
            { data: "ALMACEN" },
            {
                data: "COMENTARIO",
                className: "col-comentario-cell",
                width: "220px",
                render: function (data) {
                    var val = data || "";
                    var escaped = $("<div>").text(val).html();
                    return '<span class="celda-comentario" title="' + escaped + '">' + escaped + '</span>';
                }
            },
            { data: "LUGAR_ENTREGA" },
            {
                data: "TOTAL",
                render: function (data) {
                    return data != null ? parseFloat(data).toFixed(2) : "";
                },
                className: "text-right"
            },
            { data: "NROSAP" },
            { data: "ESTADO_ENVIO" },
            { data: "USUARIO_MODIFICA" },
            { data: "FECHA_HORA" },
            { data: "PC" },
            { data: "DOCENTRY" },
            { data: "DOCSTATUS" },
            { data: "DOCENTRY_SAP" },
            { data: "DOCENTRY_OWTR" },
            {
                data: null,
                title: "LOG",
                defaultContent: '<button type="button" class="btn btn-sm btn-log-importador" style="background-color:#1d81ce;color:#fff;" tabindex="-1" title="Ver log del importador"><i class="fa fa-history"></i></button>',
                orderable: false,
                searchable: false,
                className: "text-center",
                width: "50px"
            }
        ],
        columnDefs: [
            {
                targets: [0, 1, 2, 3],
                createdCell: function (td) {
                    td.style.width = "50px";
                }
            },
            {
                targets: [14, 15, 16, 17, 18, 19, 20], // USUARIO_MODIFICA, FECHA_HORA, PC, DOCENTRY, DOCSTATUS, DOCENTRY_SAP, DOCENTRY_OWTR
                visible: false
            }
        ],
        language: {
            url: "/js/plugins/dataTables/Spanish.js",
            emptyTable: "No se encontraron resultados para mostrar."
        },
        ordering: true,
        pageLength: 25,
        lengthMenu: [[25, 50, 100, 200, -1], [25, 50, 100, 200, "Todos"]],
        searching: true,
        dom: "t<'row'<'col-6'l><'col-6'f>>rt<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
        initComplete: function () {
            $("#tblBusquedaVentas").hide();
            $("#tblBusquedaVentas_wrapper").hide();
        }
    });

    $("#tblBusquedaVentas tbody").on("dblclick", "tr", function () {
        var data = tblBusquedaVentas.row(this).data();
        if (data) {
            console.log("Seleccionado DOCENTRY:", data.DOCENTRY);
        }
    });

    inicializarSeleccionBusqueda();
    inicializarResizerBusqueda();
}

function inicializarResizerBusqueda() {
    var headersResizer = document.querySelectorAll("#tblBusquedaVentas thead th .col-resizer");
    headersResizer.forEach(function (resizer) {
        var th = resizer.closest("th");
        if (th && !th._resizerCaptureAttached) {
            th._resizerCaptureAttached = true;
            th.addEventListener("click", function (e) {
                if (e.target && (e.target.classList.contains("col-resizer") || e.target.closest(".col-resizer"))) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            }, true); // Captura únicamente el clic para que DataTables no reordene
        }
    });

    $(document).off("mousedown.colResizeBusqueda", "#tblBusquedaVentas thead .col-resizer").on("mousedown.colResizeBusqueda", "#tblBusquedaVentas thead .col-resizer", function (e) {
        e.preventDefault();
        e.stopPropagation();

        var $resizer = $(this);
        var $th = $resizer.closest("th");
        var startX = e.pageX;
        var startWidth = $th.outerWidth();

        $resizer.addClass("active");
        $("body").addClass("col-resizing");

        $(document).on("mousemove.colResizeDragBusqueda", function (eMove) {
            var deltaX = eMove.pageX - startX;
            var newWidth = Math.max(80, Math.min(1200, startWidth + deltaX));
            $th.css({
                "width": newWidth + "px",
                "min-width": newWidth + "px",
                "max-width": newWidth + "px"
            });
        });

        $(document).on("mouseup.colResizeDragBusqueda", function () {
            $resizer.removeClass("active");
            $("body").removeClass("col-resizing");
            $(document).off("mousemove.colResizeDragBusqueda mouseup.colResizeDragBusqueda");
        });
    });

    $(document).off("dblclick.colResizeBusqueda", "#tblBusquedaVentas thead .col-resizer").on("dblclick.colResizeBusqueda", "#tblBusquedaVentas thead .col-resizer", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var $th = $(this).closest("th");
        $th.css({
            "width": "",
            "min-width": "",
            "max-width": ""
        });
    });
}

function formatearFechaDDMMYYYY(fechaRaw) {
    if (!fechaRaw) return { display: "", sort: 0 };
    var str = String(fechaRaw).trim();
    if (!str) return { display: "", sort: 0 };

    var day, month, year;

    // Caso 1: ISO o YYYY-MM-DD (ej: 2026-09-09 o 2026-09-09T00:00:00)
    var matchIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (matchIso) {
        year = parseInt(matchIso[1], 10);
        month = parseInt(matchIso[2], 10);
        day = parseInt(matchIso[3], 10);
    } else {
        // Caso 2: Formato latino / estándar: DD/MM/YYYY o D/M/YYYY
        var matchLatam = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
        if (matchLatam) {
            day = parseInt(matchLatam[1], 10);
            month = parseInt(matchLatam[2], 10);
            year = parseInt(matchLatam[3], 10);
        } else {
            var parsed = new Date(str);
            if (!isNaN(parsed.getTime())) {
                day = parsed.getDate();
                month = parsed.getMonth() + 1;
                year = parsed.getFullYear();
            }
        }
    }

    if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
        return { display: str, sort: 0 };
    }

    var dd = String(day).padStart(2, "0");
    var mm = String(month).padStart(2, "0");
    var yyyy = String(year).padStart(4, "0");

    return {
        display: dd + "/" + mm + "/" + yyyy,
        sort: parseInt(yyyy + mm + dd, 10)
    };
}

function formatearFechaHoraDDMMYYYYHHmmss(fechaRaw) {
    if (!fechaRaw) return { display: "", sort: 0 };
    var str = String(fechaRaw).trim();
    if (!str) return { display: "", sort: 0 };

    var day, month, year, hours = 0, minutes = 0, seconds = 0;

    // Patrón ISO: YYYY-MM-DD[T| ]HH:mm:ss
    var matchIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (matchIso) {
        year = parseInt(matchIso[1], 10);
        month = parseInt(matchIso[2], 10);
        day = parseInt(matchIso[3], 10);
        hours = matchIso[4] ? parseInt(matchIso[4], 10) : 0;
        minutes = matchIso[5] ? parseInt(matchIso[5], 10) : 0;
        seconds = matchIso[6] ? parseInt(matchIso[6], 10) : 0;
    } else {
        // Patrón Latino: DD/MM/YYYY[ HH:mm:ss] o D/M/YYYY[ H:m:s]
        var matchLatam = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
        if (matchLatam) {
            day = parseInt(matchLatam[1], 10);
            month = parseInt(matchLatam[2], 10);
            year = parseInt(matchLatam[3], 10);
            hours = matchLatam[4] ? parseInt(matchLatam[4], 10) : 0;
            minutes = matchLatam[5] ? parseInt(matchLatam[5], 10) : 0;
            seconds = matchLatam[6] ? parseInt(matchLatam[6], 10) : 0;
        } else {
            var parsed = new Date(str);
            if (!isNaN(parsed.getTime())) {
                day = parsed.getDate();
                month = parsed.getMonth() + 1;
                year = parsed.getFullYear();
                hours = parsed.getHours();
                minutes = parsed.getMinutes();
                seconds = parsed.getSeconds();
            }
        }
    }

    if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
        return { display: str, sort: 0 };
    }

    var dd = String(day).padStart(2, "0");
    var mm = String(month).padStart(2, "0");
    var yyyy = String(year).padStart(4, "0");
    var hh = String(hours).padStart(2, "0");
    var min = String(minutes).padStart(2, "0");
    var ss = String(seconds).padStart(2, "0");

    var display = dd + "/" + mm + "/" + yyyy + " " + hh + ":" + min + ":" + ss;
    var sortKey = parseInt(yyyy + mm + dd + hh + min + ss, 10);

    return { display: display, sort: sortKey };
}

function inicializarSeleccionBusqueda() {
    $("#tblBusquedaVentas tbody").on("click", "tr", function (e) {
        if ($(e.target).closest("button").length) return;

        var $tr = $(this);
        var yaSeleccionada = $tr.hasClass("row-selected");

        $("#tblBusquedaVentas tbody tr.row-selected").removeClass("row-selected");
        $tr.toggleClass("row-selected", !yaSeleccionada);
        actualizarBarraAccionesBusqueda();
    });
}

function actualizarBarraAccionesBusqueda() {
    var haySeleccion = $("#tblBusquedaVentas tbody tr.row-selected").length > 0;
    var data = obtenerFilaSeleccionadaBusqueda();
    var esBorrador = !!data && (data.DOCSTATUS || "").trim() === "E";
    ["#btnBusquedaImprimir", "#btnBusquedaAcciones"].forEach(function (sel) {
        $(sel).prop("disabled", !haySeleccion);
    });
    $("#btnBusquedaEnviarWms").prop("disabled", !haySeleccion || !data || !(data.DOCENTRY_SAP > 0));
}

function rangoFechasInvalido() {
    const fIni = $("#txtBusquedaFechaInicio").val() || "";
    const fFin = $("#txtBusquedaFechaFin").val() || "";
    if (!fIni || !fFin) return false;

    const dIni = new Date(fIni.split("/").reverse().join("-"));
    const dFin = new Date(fFin.split("/").reverse().join("-"));
    return dIni > dFin;
}

function buscarVentas(onComplete) {
    const filtro = {
        CLIENTE: $("#txtBusquedaClienteDocumento").val() || "",
        VENDEDOR: $("#ddlBusquedaVendedor").val() || "",
        FECHA_INICIO: $("#txtBusquedaFechaInicio").val() || "",
        FECHA_FIN: $("#txtBusquedaFechaFin").val() || ""
    };

    $.ajax({
        url: "/PuntoVenta/Buscar_Ventas",
        type: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(filtro),
        beforeSend: function () {
            $("#tblBusquedaVentas_wrapper").hide();
            $("body").addClass("loading");
        },
        success: function (data) {
            $("#tblBusquedaVentas tbody tr.row-selected").removeClass("row-selected");
            actualizarBarraAccionesBusqueda();
            tblBusquedaVentas.clear();
            tblBusquedaVentas.rows.add(data || []);
            tblBusquedaVentas.draw();
            tblBusquedaVentas.order([17, "desc"]).draw();
            $("#tblBusquedaVentas").show();
            $("#tblBusquedaVentas_wrapper").show();
        },
        error: function (xhr) {
            var msg = "Error al buscar ventas.";
            if (xhr.responseJSON && xhr.responseJSON.error) {
                msg = xhr.responseJSON.error;
            }
            console.error(msg, xhr.responseText);
            Swal.fire({
                type: "error",
                title: "Error",
                text: msg
            });
        },
        complete: function () {
            $("body").removeClass("loading");
            if (typeof onComplete === "function") onComplete();
        }
    });
}

function obtenerFilaSeleccionadaBusqueda() {
    var $tr = $("#tblBusquedaVentas tbody tr.row-selected");
    if (!$tr.length) return null;
    var data = tblBusquedaVentas.row($tr).data();
    return data && data.DOCENTRY ? data : null;
}

function abrirReportePdfPost(url, data) {
    var form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    form.target = "_blank";
    form.style.display = "none";

    for (var key in data) {
        if (data.hasOwnProperty(key) && data[key] !== null && data[key] !== undefined) {
            var input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = data[key];
            form.appendChild(input);
        }
    }

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

function imprimirTicketDesdeBusqueda() {
    if (PV.Utils._procesando) return;

    var data = obtenerFilaSeleccionadaBusqueda();
    if (!data) return;

    var docEntrySap = data.DOCENTRY_SAP || 0;
    var nroSap = (data.NROSAP || data.DOCNUM_SAP || "").toString().trim();

    if (!docEntrySap || docEntrySap === 0) {
        Swal.fire({
            type: "warning",
            title: "No se puede imprimir",
            text: "NO SE PUEDE IMPRIMIR TICKET DE DOCUMENTOS QUE NO ESTAN EN SAP"
        });
        return;
    }

    abrirReportePdfPost("/PuntoVenta/Ticket_Venta", {
        docEntrySap: docEntrySap,
        nroSap: nroSap
    });
}

function imprimirPreliminarSapDesdeBusqueda() {
    if (PV.Utils._procesando) return;

    var data = obtenerFilaSeleccionadaBusqueda();
    if (!data) return;

    var docEntrySap = data.DOCENTRY_SAP || 0;
    var docEntryOwtr = data.DOCENTRY_OWTR || 0;
    var whs = data.ALMACEN || "";
    var nroSap = (data.NROSAP || data.DOCNUM_SAP || "").toString().trim();

    if (!docEntrySap || docEntrySap === 0) {
        Swal.fire({
            type: "warning",
            title: "No se puede imprimir",
            text: "REFRESQUE LA PANTALLA PARA TRAER EL NRO SAP"
        });
        return;
    }

    abrirReportePdfPost("/PuntoVenta/PreliminarSap_Venta", {
        docEntrySap: docEntrySap,
        docEntryOwtr: docEntryOwtr,
        whs: whs,
        nroSap: nroSap
    });
}

function imprimirDesdeBusqueda() {
    if (PV.Utils._procesando) return;

    var data = obtenerFilaSeleccionadaBusqueda();
    if (!data) return;

    var docStatus = (data.DOCSTATUS || "").trim();
    var docEntrySap = data.DOCENTRY_SAP || 0;
    var docEntryOwtr = data.DOCENTRY_OWTR || 0;
    var docEntry = data.DOCENTRY || 0;
    var whs = data.ALMACEN || "";
    var nroSap = (data.NROSAP || data.DOCNUM_SAP || "").toString().trim();

    if (docStatus === "W") {
        Swal.fire({
            type: "info",
            title: "Documento en WMS/SAP",
            text: "EL DOCUMENTO YA SE ENCUENTRA EN WMS/SAP, solo se mostrará la vista previa."
        }).then(function () {
            imprimirPreliminarSapDesdeBusqueda();
        });
        return;
    }

    if (!docEntrySap || docEntrySap === 0) {
        Swal.fire({
            type: "warning",
            title: "No se puede imprimir",
            text: "NO SE PUEDE IMPRIMIR DOCUMENTOS QUE NO ESTAN EN SAP"
        });
        return;
    }

    Swal.fire({
        title: "¿Esta seguro de Imprimir el Pedido?",
        type: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, imprimir",
        cancelButtonText: "Cancelar"
    }).then(function (result) {
        if (!result.value) return;

        abrirReportePdfPost("/PuntoVenta/Imprimir_Venta", {
            docEntrySap: docEntrySap,
            docEntryOwtr: docEntryOwtr,
            whs: whs,
            docEntry: docEntry,
            nroSap: nroSap
        });

        setTimeout(function () {
            buscarVentas();
        }, 1000);
    });
}

function imprimirPreliminarPvDesdeBusqueda() {
    if (PV.Utils._procesando) return;

    var data = obtenerFilaSeleccionadaBusqueda();
    if (!data) return;

    var docEntry = data.DOCENTRY || 0;
    var whs = data.ALMACEN || "";

    if (!docEntry || docEntry === 0) {
        Swal.fire({
            type: "warning",
            title: "No se puede imprimir",
            text: "NO SE PUEDE IMPRIMIR PRELIMINAR PV DE DOCUMENTOS SIN DOCENTRY"
        });
        return;
    }

    abrirReportePdfPost("/PuntoVenta/PreliminarPv_Venta", {
        docEntry: docEntry,
        whs: whs
    });
}

function trasladarDesdeBusqueda() {
    if (PV.Utils._procesando) return;

    var data = obtenerFilaSeleccionadaBusqueda();
    if (!data) return;

    var docStatus = (data.DOCSTATUS || "").trim();

    if (docStatus === "C" || docStatus === "O" || docStatus === "U") {
        Swal.fire({
            type: "warning",
            title: "No se puede trasladar",
            text: "EL DOCUMENTO NO SE PUEDE TRASLADAR"
        });
        return;
    }
    if (docStatus === "W") {
        Swal.fire({
            type: "warning",
            title: "No se puede trasladar",
            text: "EL DOCUMENTO NO SE PUEDE TRASLADAR ESTA EN WMS"
        });
        return;
    }
    if (docStatus === "E") {
        Swal.fire({
            type: "warning",
            title: "No se puede trasladar",
            text: "EL DOCUMENTO ESTA EN BORRADOR, PRIMERO GUARDELO COMO VENTA"
        });
        return;
    }

    Swal.fire({
        title: "Trasladar a SAP",
        text: "¿Esta seguro de Trasladar el Borrador?",
        type: "question",
        showCancelButton: true,
        confirmButtonColor: "#1ab394",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Sí, trasladar",
        cancelButtonText: "Cancelar"
    }).then(function (result) {
        if (!result.value) return;

        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $.ajax({
                url: "/PuntoVenta/Trasladar_Venta",
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({ docEntry: data.DOCENTRY, docStatus: docStatus }),
                beforeSend: function () {
                    $("body").addClass("loading");
                },
                success: function (resp) {
                    Swal.fire({
                        type: "success",
                        title: "Trasladado",
                        text: resp.message || "BORRADOR TRASLADADO CORRECTAMENTE"
                    }).then(function () {
                        buscarVentas();
                    });
                },
                error: function (xhr) {
                    var msg = "Error al trasladar la venta.";
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        msg = xhr.responseJSON.error;
                    }
                    Swal.fire({
                        type: "error",
                        title: "Error",
                        text: msg
                    }).then(function () {
                        buscarVentas();
                    });
                },
                complete: function () {
                    $("body").removeClass("loading");
                    reHabilitar();
                }
            });
        });
    });
}

function enviarWmsDesdeBusqueda() {
    if (!PV.Utils.puedeInteractuar()) return;

    var data = obtenerFilaSeleccionadaBusqueda();
    if (!data) return;

    var docStatus = (data.DOCSTATUS || "").trim();
    var docEntrySap = data.DOCENTRY_SAP || 0;

    if (docStatus === "W") {
        Swal.fire({
            type: "warning",
            title: "No se puede enviar a WMS",
            text: "NO SE PUEDE ENVIAR NUEVAMENTE A WMS UN DOCUMENTO YA ENVIADO"
        });
        return;
    }
    if (!docEntrySap || docEntrySap === 0) {
        Swal.fire({
            type: "warning",
            title: "No se puede enviar a WMS",
            text: "NO SE PUEDE ENVIAR A WMS DOCUMENTOS QUE NO ESTAN EN SAP"
        });
        return;
    }

    Swal.fire({
        title: "Enviar a WMS",
        text: "¿Esta seguro de enviar a WMS el Pedido?",
        type: "question",
        showCancelButton: true,
        confirmButtonColor: "#1ab394",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Sí, enviar a WMS",
        cancelButtonText: "Cancelar"
    }).then(function (result) {
        if (!result.value) return;

        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $.ajax({
                url: "/PuntoVenta/EnviarWMS_Venta",
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({ docEntry: data.DOCENTRY, docStatus: docStatus }),
                beforeSend: function () {
                    $("body").addClass("loading");
                },
                success: function (resp) {
                    Swal.fire({
                        type: "success",
                        title: "Enviado a WMS",
                        text: resp.message || "DOCUMENTO ENVIADO A WMS CORRECTAMENTE"
                    }).then(function () {
                        buscarVentas();
                    });
                },
                error: function (xhr) {
                    var msg = "Error al enviar a WMS la venta.";
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        msg = xhr.responseJSON.error;
                    }
                    var esSincronizacion = msg.toLowerCase().indexOf("sincronizando") !== -1 || msg.toLowerCase().indexOf("segundos") !== -1;
                    Swal.fire({
                        type: esSincronizacion ? "warning" : "error",
                        title: esSincronizacion ? "Sincronización en proceso" : "Error",
                        text: msg
                    }).then(function () {
                        buscarVentas();
                    });
                },
                complete: function () {
                    $("body").removeClass("loading");
                    reHabilitar();
                }
            });
        });
    });
}

$(document).on("click", ".btn-ver-venta", function () {
    if (!PV.Utils.puedeInteractuar()) return;
    var $btn = $(this);

    PV.confirmarNavegacion(function () {
        var data = tblBusquedaVentas.row($btn.closest("tr")).data();
        if (!data || !data.DOCENTRY) return;

        PV.Utils.mostrarModalProgreso("Cargando orden de venta...", "Obteniendo datos del pedido N° " + data.DOCENTRY + "...", 1);

        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $.ajax({
                url: "/PuntoVenta/Ver_Venta",
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({ docEntry: data.DOCENTRY }),
                beforeSend: function () {
                    $("body").addClass("loading");
                },
                success: function (resp) {
                    cargarVentaReadOnly(resp);
                },
                error: function (xhr) {
                    var msg = "Error al cargar venta.";
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        msg = xhr.responseJSON.error;
                    }
                    Swal.fire({
                        type: "error",
                        title: "Error",
                        text: msg
                    });
                },
                complete: function () {
                    $("body").removeClass("loading");
                    reHabilitar();
                }
            });
        });
    });
});

$(document).on("click", ".btn-anular-venta", function () {
    if (!PV.Utils.puedeInteractuar()) return;
    var data = tblBusquedaVentas.row($(this).closest("tr")).data();
    if (!data || !data.DOCENTRY) return;

    $("#txtClienteNombre").attr("tabindex", "-1");
    document.activeElement.blur();

    var docStatus = (data.DOCSTATUS || "").trim();

    if (docStatus === "C" || docStatus === "Z") {
        Swal.fire({
            type: "warning",
            title: "Documento anulado",
            text: "El documento se encuentra anulado."
        }).then(function () { $("#txtClienteNombre").removeAttr("tabindex"); });
        return;
    }
    if (docStatus === "U") {
        Swal.fire({
            type: "warning",
            title: "No se puede anular",
            text: "El documento ya fue procesado en SAP y no se puede anular."
        }).then(function () { $("#txtClienteNombre").removeAttr("tabindex"); });
        return;
    }
    if (docStatus === "W" && !window.PUEDE_ANULAR_ENVIADO_WMS) {
        Swal.fire({
            type: "warning",
            title: "No autorizado",
            text: "No tiene permisos para anular órdenes en estado ENVIADO WMS."
        }).then(function () { $("#txtClienteNombre").removeAttr("tabindex"); });
        return;
    }
    Swal.fire({
        title: "Anular Venta",
        text: "¿Está seguro de anular este documento? Esta acción no se puede deshacer.",
        type: "question",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Sí, anular",
        cancelButtonText: "Cancelar"
    }).then(function (result) {
        $("#txtClienteNombre").removeAttr("tabindex");
        if (!result.value) return;

        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $.ajax({
                url: "/PuntoVenta/Anular_Venta",
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({ docEntry: data.DOCENTRY, docStatus: docStatus }),
                beforeSend: function () {
                    $("body").addClass("loading");
                },
                success: function (resp) {
                    Swal.fire({
                        type: "success",
                        title: "Anulado",
                        text: resp.message || "Documento anulado correctamente."
                    }).then(function () {
                        buscarVentas();
                    });
                },
                error: function (xhr) {
                    var msg = "Error al anular la venta.";
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        msg = xhr.responseJSON.error;
                    }
                    Swal.fire({
                        type: "error",
                        title: "Error",
                        text: msg
                    }).then(function () {
                        buscarVentas();
                    });
                },
                complete: function () {
                    $("body").removeClass("loading");
                    reHabilitar();
                }
            });
        });
    });
});

$(document).on("click", ".btn-reabrir-venta", function () {
    if (!PV.Utils.puedeInteractuar()) return;
    var $btn = $(this);

    PV.confirmarNavegacion(function () {
        var data = tblBusquedaVentas.row($btn.closest("tr")).data();
        if (!data || !data.DOCENTRY) return;

        $("#txtClienteNombre").attr("tabindex", "-1");
        document.activeElement.blur();

        var docStatus = (data.DOCSTATUS || "").trim();
        var estadoEnvio = (data.ESTADO_ENVIO || "").trim().toUpperCase();

        if (docStatus === "C") {
            Swal.fire({ type: "warning", title: "Documento anulado", text: "El documento se encuentra anulado." }).then(function () { $("#txtClienteNombre").removeAttr("tabindex"); });
            return;
        }
        if (docStatus === "U") {
            Swal.fire({ type: "warning", title: "No se puede modificar", text: "El documento ya fue procesado en SAP y no se puede modificar." }).then(function () { $("#txtClienteNombre").removeAttr("tabindex"); });
            return;
        }
        if (docStatus === "W") {
            Swal.fire({
                type: "warning",
                title: "Documento en WMS",
                text: "EL DOCUMENTO YA SE ENCUENTRA EN ESTADO ENVIADO WMS Y NO SE PUEDE MODIFICAR."
            }).then(function () {
                $("#txtClienteNombre").removeAttr("tabindex");
            });
            return;
        }

        var estabaEnSap = docStatus === "O" || docStatus === "P" || (data.DOCENTRY_SAP && data.DOCENTRY_SAP > 0);
        var titulo = "Reabrir Venta";
        var texto = estabaEnSap
            ? "¿Está seguro de modificar el pedido N° " + data.DOCENTRY + "? Se cancelará el pedido previo en SAP y se actualizará sobre el mismo registro."
            : "¿Está seguro de modificar la orden de venta N° " + data.DOCENTRY + "? Se actualizará sobre el mismo registro.";

        Swal.fire({
            title: titulo,
            text: texto,
            type: "question",
            showCancelButton: true,
            confirmButtonColor: "#1ab394",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Sí, reabrir",
            cancelButtonText: "Cancelar"
        }).then(function (result) {
            $("#txtClienteNombre").removeAttr("tabindex");
            if (!result.value) return;

            PV.Utils.ejecutarAccion(function (reHabilitar) {
                PV.Utils.mostrarModalProgreso("Reabriendo venta...", "Cargando artículos de la orden N° " + data.DOCENTRY + "...", 1);
                $.ajax({
                    url: "/PuntoVenta/Reabrir_Venta",
                    type: "POST",
                    contentType: "application/json",
                    dataType: "json",
                    data: JSON.stringify({ docEntry: data.DOCENTRY, docStatus: docStatus }),
                    beforeSend: function () {
                        $("body").addClass("loading");
                    },
                    success: function (resp) {
                        PV.confirmarGuardado();
                        cargarVentaEditable(resp, docStatus, estadoEnvio);
                    },
                    error: function (xhr) {
                        var msg = "Error al reabrir la venta.";
                        if (xhr.responseJSON && xhr.responseJSON.error) {
                            msg = xhr.responseJSON.error;
                        }
                        var esSincronizacion = msg.toLowerCase().indexOf("sincronizando") !== -1 || msg.toLowerCase().indexOf("segundos") !== -1;
                        Swal.fire({
                            type: esSincronizacion ? "warning" : "error",
                            title: esSincronizacion ? "Sincronización en proceso" : "Error",
                            text: msg
                        }).then(function () {
                            buscarVentas();
                        });
                        reHabilitar();
                    },
                    complete: function () {
                        $("body").removeClass("loading");
                    }
                });
            });
        });
    });
});

$(document).on("click", ".btn-log-importador", function () {
    if (!PV.Utils.puedeInteractuar()) return;
    var data = tblBusquedaVentas.row($(this).closest("tr")).data();
    if (!data || !data.DOCENTRY) return;

    PV.Utils.ejecutarAccion(function (reHabilitar) {
        $.ajax({
            url: "/PuntoVenta/Buscar_LogImportador",
            type: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({ docEntry: data.DOCENTRY }),
            beforeSend: function () {
                $("body").addClass("loading");
            },
            success: function (resp) {
                mostrarLogImportador(data.DOCENTRY, resp || []);
            },
            error: function (xhr) {
                var msg = "Error al consultar el log del importador.";
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    msg = xhr.responseJSON.error;
                }
                Swal.fire({
                    type: "error",
                    title: "Error",
                    text: msg
                });
            },
            complete: function () {
                $("body").removeClass("loading");
                reHabilitar();
            }
        });
    });
});

function mostrarLogImportador(docEntry, registros) {
    $("#lblLogImportadorDocEntry").text("DOCENTRY " + docEntry);

    var $tbl = $("#tblLogImportador");
    if ($.fn.DataTable.isDataTable("#tblLogImportador")) {
        var dt = $tbl.DataTable();
        dt.clear();
        dt.rows.add(registros || []);
        dt.order([[3, "desc"]]).draw();
    } else {
        $tbl.DataTable({
            data: registros,
            columns: [
                { data: "ID", width: "70px" },
                { data: "OV" },
                { data: "DOC_ENTRY", width: "90px" },
                {
                    data: "FECHA_HORA",
                    render: function (data, type, row) {
                        var info = formatearFechaHoraDDMMYYYYHHmmss(data);
                        if (type === "sort" || type === "type") {
                            return info.sort;
                        }
                        return info.display;
                    }
                },
                {
                    data: "TIPO_ERROR",
                    render: function (data) {
                        if (!data) return "";
                        var esTecnico = data.toUpperCase() === "TECNICO";
                        return '<span class="badge ' + (esTecnico ? "badge-danger" : "badge-warning") + '">' + data + '</span>';
                    }
                },
                { data: "DESCRIPCION" },
                { data: "RUC_CLIENTE" },
                { data: "NOMBRE_CLIENTE" },
                { data: "USUARIO_CREACION" },
                {
                    data: "MONTO_TOTAL",
                    className: "text-right",
                    render: function (data) {
                        return data != null ? parseFloat(data).toFixed(2) : "";
                    }
                }
            ],
            language: {
                url: "/js/plugins/dataTables/Spanish.js",
                emptyTable: "No se encontraron registros de log para este documento."
            },
            order: [[3, "desc"]],
            pageLength: 25,
            lengthMenu: [[25, 50, 100, -1], [25, 50, 100, "Todos"]]
        });
    }

    $("#modalLogImportador").modal("show");
}

$(document).on("click", ".btn-cambiar-cond-pago", function () {
    if (!PV.Utils.puedeInteractuar()) return;
    var $btn = $(this);
    var data = tblBusquedaVentas.row($btn.closest("tr")).data();
    if (!data || !data.DOCENTRY) return;

    var docEntrySap = data.DOCENTRY_SAP || 0;
    if (!docEntrySap || docEntrySap <= 0) {
        Swal.fire({
            type: "warning",
            title: "Sin N° SAP",
            text: "El pedido seleccionado no cuenta con un DocEntry de SAP válido."
        });
        return;
    }

    PV.Utils.ejecutarAccion(function (reHabilitar) {
        $.ajax({
            url: "/PuntoVenta/ObtenerDatosModificarCondicionPago",
            type: "GET",
            data: { docEntry: data.DOCENTRY, docEntrySap: docEntrySap },
            beforeSend: function () {
                $("body").addClass("loading");
            },
            success: function (resp) {
                var esExito = resp && (resp.success === true || resp.Success === true);
                if (!esExito) {
                    var mensaje = resp ? (resp.message || resp.Message || "Error al obtener datos de la orden SAP.") : "Error al obtener datos de la orden SAP.";
                    Swal.fire({
                        type: "warning",
                        title: "No permitido",
                        text: mensaje
                    });
                    return;
                }

                var d = resp.data || resp.Data || {};
                var docEntryVal = d.DocEntry != null ? d.DocEntry : d.docEntry;
                var docEntrySapVal = d.DocEntrySap != null ? d.DocEntrySap : d.docEntrySap;
                var actualGroupNumVal = d.CondicionPagoActualCodigo != null ? d.CondicionPagoActualCodigo : d.condicionPagoActualCodigo;
                var puedeModificar = d.PuedeModificar !== undefined ? d.PuedeModificar : (d.puedeModificar !== undefined ? d.puedeModificar : true);
                var motivoBloqueo = d.MotivoBloqueo || d.motivoBloqueo || "";

                // Reset a la primera pestaña
                $('#tabCondicionPago a[href="#tab-modificar-cond"]').tab("show");

                $("#hdnModalDocEntry").val(docEntryVal != null ? docEntryVal : "");
                $("#hdnModalDocEntrySap").val(docEntrySapVal != null ? docEntrySapVal : "");
                $("#hdnModalActualGroupNum").val(actualGroupNumVal != null ? actualGroupNumVal : "");

                $("#lblModalDocNum").val((d.DocNum != null ? d.DocNum : d.docNum) || "");
                $("#lblModalCardName").val(d.CardName || d.cardName || "");
                $("#lblModalRuc").val(d.Ruc || d.ruc || "");
                $("#lblModalEstadoSap").val(d.EstadoSap || d.estadoSap || "");
                $("#lblModalCondicionActual").val(d.CondicionPagoActualNombre || d.condicionPagoActualNombre || "");

                // Configuración de visualización y edición según puedeModificar
                if (!puedeModificar) {
                    $("#alertBloqueoCondicionPago").removeClass("d-none");
                    $("#lblMensajeBloqueoCondicion").text(motivoBloqueo || "No es posible modificar la condición de pago de este pedido.");
                    $("#pnlNuevaCondicionPago").hide();
                    $("#btnGuardarCondicionPago").hide();
                    $("#lblModalRolBadge").text("");
                } else {
                    $("#alertBloqueoCondicionPago").addClass("d-none");
                    $("#lblMensajeBloqueoCondicion").text("");
                    $("#pnlNuevaCondicionPago").show();
                    $("#btnGuardarCondicionPago").show();

                    var $ddl = $("#ddlModalNuevaCondicionPago");
                    $ddl.empty();
                    $ddl.append('<option value=""><< SELECCIONAR >></option>');

                    var opciones = d.OpcionesPermitidas || d.opcionesPermitidas || [];
                    if (opciones && opciones.length > 0) {
                        opciones.forEach(function (opc) {
                            var cod = opc.CODIGO != null ? opc.CODIGO : (opc.codigo != null ? opc.codigo : (opc.Codigo != null ? opc.Codigo : ""));
                            var nom = opc.NOMBRE || opc.nombre || opc.Nombre || "";
                            $ddl.append($("<option>", {
                                value: cod,
                                text: nom
                            }));
                        });
                    }

                    var rol = d.RolUsuario || d.rolUsuario || "";
                    $("#lblModalRolBadge").text(rol ? ("Permiso: " + rol) : "");
                }

                // Helper insensible a mayúsculas/minúsculas y guiones bajos
                function obtenerProp(obj, clave) {
                    if (!obj) return "";
                    if (obj[clave] !== undefined && obj[clave] !== null) return obj[clave];
                    var cl = String(clave).toLowerCase().replace(/_/g, "");
                    for (var k in obj) {
                        if (Object.prototype.hasOwnProperty.call(obj, k)) {
                            if (String(k).toLowerCase().replace(/_/g, "") === cl) {
                                if (obj[k] !== undefined && obj[k] !== null) return obj[k];
                            }
                        }
                    }
                    return "";
                }

                // Carga de historial en Tab 2
                if ($.fn.DataTable.isDataTable("#tblHistorialCondicionPago")) {
                    $("#tblHistorialCondicionPago").DataTable().destroy();
                }

                var $tbody = $("#tblHistorialCondicionPago tbody");
                $tbody.empty();

                var histList = d.Historial || d.historial || d.HISTORIAL || [];
                if (histList && histList.length > 0) {
                    histList.forEach(function (h, idx) {
                        var fecha = obtenerProp(h, "FECHA_REGISTRO_TEXTO");
                        if (!fecha) {
                            var fRaw = obtenerProp(h, "FECHA_REGISTRO");
                            if (fRaw) fecha = String(fRaw).replace("T", " ").substring(0, 19);
                        }
                        var user = obtenerProp(h, "USUARIO");
                        var ant = obtenerProp(h, "CONDICION_PAGO_ANTERIOR") || "-";
                        var nue = obtenerProp(h, "CONDICION_PAGO_NUEVO") || "-";
                        var row = `<tr>
                            <td class="text-center font-weight-bold">${idx + 1}</td>
                            <td class="text-center">${fecha}</td>
                            <td class="text-center font-weight-bold text-dark">${user}</td>
                            <td>${ant}</td>
                            <td><span class="badge badge-primary font-weight-bold p-1">${nue}</span></td>
                        </tr>`;
                        $tbody.append(row);
                    });
                }

                $("#tblHistorialCondicionPago").DataTable({
                    pageLength: 5,
                    lengthChange: false,
                    searching: false,
                    ordering: false,
                    language: {
                        emptyTable: "No se encontraron modificaciones registradas para esta orden.",
                        paginate: {
                            previous: "<",
                            next: ">"
                        },
                        info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
                        infoEmpty: "Mostrando 0 a 0 de 0 registros"
                    }
                });

                $("#modalModificarCondicionPago").modal("show");
            },
            error: function (xhr, status, error) {
                console.error("Error AJAX ObtenerDatosModificarCondicionPago:", xhr, status, error);
                var msg = "Error al obtener datos para modificar la condición de pago.";
                if (xhr.responseJSON && (xhr.responseJSON.message || xhr.responseJSON.Message)) {
                    msg = xhr.responseJSON.message || xhr.responseJSON.Message;
                } else if (xhr.responseText) {
                    try {
                        var parsed = JSON.parse(xhr.responseText);
                        if (parsed && (parsed.message || parsed.Message)) msg = parsed.message || parsed.Message;
                    } catch (e) {
                        msg += " (HTTP " + xhr.status + ": " + (xhr.statusText || error) + ")";
                    }
                }
                Swal.fire({
                    type: "error",
                    title: "Error",
                    text: msg
                });
            },
            complete: function () {
                $("body").removeClass("loading");
                reHabilitar();
            }
        });
    });
});

$(document).on("shown.bs.tab", 'a[data-toggle="tab"][href="#tab-historial-cond"]', function () {
    if ($.fn.DataTable.isDataTable("#tblHistorialCondicionPago")) {
        $("#tblHistorialCondicionPago").DataTable().columns.adjust().draw();
    }
});

$(document).on("click", "#btnGuardarCondicionPago", function () {
    var docEntrySap = parseInt($("#hdnModalDocEntrySap").val(), 10) || 0;
    var docEntry = parseInt($("#hdnModalDocEntry").val(), 10) || 0;
    var actualGroupNum = parseInt($("#hdnModalActualGroupNum").val(), 10) || 0;
    var nuevoGroupNum = parseInt($("#ddlModalNuevaCondicionPago").val(), 10) || 0;
    var nuevaCondicionTexto = $("#ddlModalNuevaCondicionPago option:selected").text().trim();

    if (!docEntrySap || docEntrySap <= 0) {
        Swal.fire({ type: "warning", title: "Validación", text: "No se identificó el DocEntry de la orden SAP." });
        return;
    }

    if (!nuevoGroupNum || nuevoGroupNum <= 0) {
        Swal.fire({ type: "warning", title: "Validación", text: "Debe seleccionar una nueva condición de pago válida." });
        return;
    }

    if (nuevoGroupNum === actualGroupNum) {
        Swal.fire({
            type: "info",
            title: "Sin cambios",
            text: "La condición de pago seleccionada es la misma que la actual. No hay cambios que guardar."
        });
        return;
    }

    var docNum = $("#lblModalDocNum").val();

    Swal.fire({
        title: "¿Confirmar cambio?",
        text: "¿Está seguro de cambiar la condición de pago de la orden SAP N° " + docNum + " a '" + nuevaCondicionTexto + "'?",
        type: "question",
        showCancelButton: true,
        confirmButtonColor: "#1ab394",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Sí, guardar",
        cancelButtonText: "Cancelar"
    }).then(function (result) {
        if (!result.value) return;

        var payload = {
            docEntry: docEntry,
            docEntrySap: docEntrySap,
            nuevoGroupNum: nuevoGroupNum,
            actualGroupNum: actualGroupNum,
            condicionPagoActualNombre: $("#lblModalCondicionActual").val(),
            condicionPagoNuevoNombre: nuevaCondicionTexto
        };

        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $.ajax({
                url: "/PuntoVenta/ActualizarCondicionPago",
                type: "POST",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify(payload),
                beforeSend: function () {
                    $("body").addClass("loading");
                },
                success: function (resp) {
                    if (resp && resp.success) {
                        $("#modalModificarCondicionPago").modal("hide");
                        Swal.fire({
                            type: "success",
                            title: "Actualizado",
                            text: resp.message || "Condición de pago actualizada correctamente en SAP."
                        }).then(function () {
                            buscarVentas();
                        });
                    } else {
                        Swal.fire({
                            type: "error",
                            title: "No se pudo actualizar",
                            text: resp ? resp.message : "Error al actualizar en SAP."
                        });
                    }
                },
                error: function (xhr) {
                    var msg = "Error al actualizar la condición de pago en SAP.";
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        msg = xhr.responseJSON.message;
                    }
                    Swal.fire({
                        type: "error",
                        title: "Error",
                        text: msg
                    });
                },
                complete: function () {
                    $("body").removeClass("loading");
                    reHabilitar();
                }
            });
        });
    });
});

function fijarListaPrecio(priceList) {
    if (!priceList && priceList !== 0) return;
    var valStr = priceList.toString().trim();
    if (!valStr) return;

    var $ddl = $("#ddlClienteListaPrecio");
    $ddl.attr("data-pending-val", valStr);

    if ($ddl.find("option").length > 0) {
        $ddl.val(valStr);
        if ($ddl.val() !== valStr) {
            $ddl.find("option").each(function () {
                var optVal = $(this).val().toString().trim();
                var optText = $(this).text().trim();
                if (optVal === valStr || optText === valStr) {
                    $ddl.val($(this).val());
                    return false;
                }
            });
        }
    }
}

function cargarVentaEditable(resp, docStatus, estadoEnvio) {
    if (PV.Core && typeof PV.Core.limpiarFormularioParaCarga === "function") {
        PV.Core.limpiarFormularioParaCarga();
    }

    if (PV.Core && typeof PV.Core.conmutarTab === "function") {
        PV.Core.conmutarTab("#tab-2");
    } else {
        $('a[href="#tab-2"]').tab('show');
    }

    if (resp && resp.DOCENTRY && resp.DOCENTRY > 0) {
        $("#hdfDocEntry").val(resp.DOCENTRY);
        var statusOrig = (docStatus && docStatus !== "BORRADOR_LOCAL") ? docStatus : (resp.DOCSTATUS_ORIGINAL || resp.DOCSTATUS || "");
        $("#hdfDocStatusOriginal").val(statusOrig);
    } else {
        $("#hdfDocEntry").val("");
        $("#hdfDocStatusOriginal").val("");
    }

    if (resp && resp.DOCENTRY_SAP && resp.DOCENTRY_SAP > 0) {
        $("#hdfDocEntrySap").val(resp.DOCENTRY_SAP);
    } else {
        $("#hdfDocEntrySap").val("");
    }

    $("#txtClienteNombre").val(resp.CARDNAME || "");
    $("#txtClienteRuc").val(resp.LICTRADNUM || "");
    $("#txtClienteCodigo").val(resp.CARDCODE || "");
    PV.Cliente.bloquearBusquedaCliente();
    PV.Cliente.cargarDireccionesCliente(
        resp.CARDCODE,
        resp.DELIVERY_PLACE,
        resp.INVOICE_PLACE,
        resp.DELIVERY_ADDRESS,
        resp.INVOICE_ADDRESS
    );
    PV.Cliente.cargarNotasCreditoCliente(resp.CARDCODE, function () {
        marcarNotasCreditoGuardadas(resp);
    });

    if (resp.SLPCODE) $("#ddlVentaVendedor").val(resp.SLPCODE);
    if (resp.WHSCODE) $("#ddlVentaAlmacen").val(resp.WHSCODE);

    if (resp.DOCDATE) {
        PV.Utils.fijarFechaFlatpickr("#txtVentaFechaAtencion", resp.DOCDATE, true);
    }
    fijarListaPrecio(resp.PRICE_LIST);

    $("#txtLogisticaComentarios").val(resp.COMMENTS || "");
    $("#ddlLogisticaTipoEmbalaje").val(resp.PACKING_TYPE || $("#ddlLogisticaTipoEmbalaje option:first").val());
    $("#ddlLogisticaModoEnvio").val(resp.SEND_MODE || $("#ddlLogisticaModoEnvio option:first").val());
    if (resp.DELIVERY_DATE) {
        PV.Utils.fijarFechaFlatpickr("#txtLogisticaFechaEntrega", resp.DELIVERY_DATE, true);
    }
    $("#ddlLogisticaLugarEntrega").val(resp.DELIVERY_POINT || "CENTRO");

    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
        PV.Catalogos.actualizarEstadoHorasEntrega(false, resp.DELIVERY_TIME);
    } else if (resp.DELIVERY_TIME) {
        var dTime = String(resp.DELIVERY_TIME).trim();
        if (dTime) {
            if ($("#ddlLogisticaHoraEntrega option[value='" + dTime + "']").length === 0) {
                $("#ddlLogisticaHoraEntrega").append(new Option(dTime, dTime, true, true));
            }
            $("#ddlLogisticaHoraEntrega").val(dTime);
        }
    }

    $("#txtLogisticaAgencia").val(resp.AGENCY_DATA || "");
    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoAgencia === "function") {
        PV.Catalogos.actualizarEstadoAgencia({ esCambioManual: false });
    }

    $("#txtLogisticaRuc").val(resp.SEND_NDOC || "");
    $("#txtLogisticaContactoNombre").val(resp.SEND_NAME || "");
    $("#txtLogisticaTelefono").val(resp.SEND_PHONE || "");
    $("#txtLogisticaLugarEnvio").val(resp.SEND_PLACE || "");

    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoLugarEnvio === "function") {
        PV.Catalogos.actualizarEstadoLugarEnvio({ esCambioManual: false });
    }

    if (resp.DOCTYPE) {
        $("#ddlFinancieroTipoComprobante").val(resp.DOCTYPE);
    }

    if (resp.PAYFORM) {
        PV.Cliente.aplicarEstadoCreditoDesdeSap(resp.CARDCODE, resp.LICTRADNUM, function (condicionPago) {
            PV.Catalogos.cargarFormasPago(condicionPago, function () {
                if (PV.Catalogos && typeof PV.Catalogos.fijarFormaPago === "function") {
                    PV.Catalogos.fijarFormaPago(resp.PAYFORM);
                } else {
                    $("#ddlFinancieroFormaPago").val(resp.PAYFORM);
                }
            }, resp.PAYFORM);
        });
    } else {
        $("#ddlFinancieroFormaPago").html("");
        PV.Cliente.aplicarEstadoCreditoDesdeSap(resp.CARDCODE, resp.LICTRADNUM);
    }

    if (PV.Detalle && typeof PV.Detalle.resetearFlete === "function") {
        PV.Detalle.resetearFlete(resp.IMP_DELIVERY);
    } else {
        $("#txtVentaFlete").val(resp.IMP_DELIVERY ? resp.IMP_DELIVERY.toFixed(2) : "0.00").prop("readonly", true).addClass("bg-light");
    }
    $("#txtVentaDescuento").val(resp.IMP_DSCTO ? resp.IMP_DSCTO.toFixed(2) : "0.00");
    $("#txtVentaTotal").val("0.00");
    $("#txtVentaNeto").val(resp.IMP_NET ? resp.IMP_NET.toFixed(2) : "0.00");

    PV.Detalle.setFormReadOnly(false);

    cargarDetalleEditableOptimizado(resp);
}

function mostrarErroresFraccionadoFinal() {
    var errores = PV.Detalle.setRecolectarErroresFraccionado(false);
    if (!errores || errores.length === 0) return;

    var html = '<ul style="text-align:left;">' + errores.map(function (e) {
        return '<li><strong>' + e.codigo + '</strong> — ' + e.descripcion + ': ' + e.motivo + '</li>';
    }).join("") + '</ul>';

    Swal.fire({
        type: "warning",
        title: "Artículos sin venta fraccionada",
        html: html,
        confirmButtonText: "Aceptar"
    });
}

function cargarDetalleEditableOptimizado(resp) {
    var itemsLocal = resp.DETALLE || [];
    var listaPrecio = (resp.PRICE_LIST || $("#ddlClienteListaPrecio").attr("data-pending-val") || $("#ddlClienteListaPrecio").val() || "1").toString().trim();
    var almacen = resp.WHSCODE || $("#ddlVentaAlmacen").val();
    var codigoCliente = resp.CARDCODE || $("#txtClienteCodigo").val() || "";

    $("#tblVentaDetalle tbody").empty();

    if (itemsLocal.length === 0) {
        PV.Detalle.agregarFilaDetalleVacia();
        return;
    }

    var total = itemsLocal.length;
    PV.Detalle.setRecolectarErroresFraccionado(true);
    PV.Utils._procesando = true;

    var itemsParaConsultar = itemsLocal.map(function (it) {
        return {
            CodigoArticulo: it.ITEMCODE,
            CodigoUmd: it.UOMENTRY || null
        };
    });

    PV.Detalle.cargarDetalleArticulosVentaBatch(itemsParaConsultar, listaPrecio, almacen, codigoCliente, function (dictResultados) {
        var index = 0;
        var batchSize = 10;

        function procesarLoteReapertura() {
            var limite = Math.min(index + batchSize, total);
            for (; index < limite; index++) {
                var itemLocal = itemsLocal[index];
                var $fila = PV.Detalle.agregarFilaDetalleVacia();
                var codUpper = (itemLocal.ITEMCODE || "").toUpperCase();
                var detalle = dictResultados[codUpper];

                if (detalle && detalle.ARTICULO) {
                    PV.Detalle.llenarFilaDetalleDesdeDetalleVenta($fila, detalle, {
                        cantidad: itemLocal.QUANTITY || 0,
                        codigoUmd: itemLocal.UOMENTRY || 0,
                        descuento: itemLocal.WMS_DSC || 0,
                        regalo: itemLocal.WMS_GIF || "NO",
                        mantenerFoco: true,
                        omitirAsegurarFilaFinal: true,
                        omitirRecalcularTotales: true,
                        omitirFechasVencimientoAjax: true,
                        omitirFraccionadoAjax: true
                    });

                    if (itemLocal.LOTES && itemLocal.LOTES.length > 0) {
                        var lotes = itemLocal.LOTES.map(function (l) {
                            return {
                                ITEMCODE: l.ITEMCODE,
                                SYSNUMBER: l.SYSNUMBER,
                                DISTNUMBER: l.DISTNUMBER,
                                QUANTITY: parseInt(l.QUANTITY) || 0
                            };
                        });
                        $fila.data("lotes", lotes);
                        PV.Detalle.setearFechaDesdeLotes($fila, lotes);
                        $fila.find(".btn-detalle-lote")
                            .removeClass("btn-outline-primary")
                            .addClass("btn-success");
                    }
                } else {
                    PV.Detalle.cargarFilaDetalleDesdeVenta($fila, itemLocal);
                }
            }

            PV.Utils.actualizarModalProgreso(index, total, itemsLocal[index - 1] ? itemsLocal[index - 1].ITEMCODE : "");

            if (index < total) {
                setTimeout(procesarLoteReapertura, 10);
            } else {
                PV.Utils.actualizarModalProgreso(total, total, "Completado");
                PV.Detalle.recalcularTotales();
                PV.Detalle.agregarFilaDetalleVacia();
                mostrarErroresFraccionadoFinal();
                PV.Utils.cerrarModalProgreso(400, function () {
                    PV.Utils._procesando = false;
                });
            }
        }

        procesarLoteReapertura();
    }, function () {
        var index = 0;
        var batchSize = 15;

        function procesarLoteFallback() {
            var limite = Math.min(index + batchSize, total);
            for (; index < limite; index++) {
                var itemLocal = itemsLocal[index];
                var $fila = PV.Detalle.agregarFilaDetalleVacia();
                PV.Detalle.cargarFilaDetalleDesdeVenta($fila, itemLocal);
            }

            PV.Utils.actualizarModalProgreso(index, total, itemsLocal[index - 1] ? itemsLocal[index - 1].ITEMCODE : "");

            if (index < total) {
                setTimeout(procesarLoteFallback, 10);
            } else {
                PV.Utils.actualizarModalProgreso(total, total, "Completado");
                PV.Detalle.recalcularTotales();
                PV.Detalle.agregarFilaDetalleVacia();
                PV.Utils.cerrarModalProgreso(400, function () {
                    PV.Utils._procesando = false;
                });
            }
        }

        procesarLoteFallback();
    });
}

function marcarNotasCreditoGuardadas(resp) {
    if (!resp.ORIN_RECORD) return;

    var partes = resp.ORIN_RECORD.split(";");
    partes.forEach(function (parte) {
        var datos = parte.split(".");
        if (datos.length < 2) return;
        var docnum = parseInt(datos[0], 10);

        var $chk = $(".chk-nota-credito").filter(function () {
            return $(this).data("docnum") === docnum;
        });

        if ($chk.length > 0) {
            $chk.prop("checked", true);
        }
    });

    PV.Detalle.recalcularTotales();
}

function recargarDetalleDesdeSAP(resp, docStatus, estadoEnvio) {
    if (PV.Core && typeof PV.Core.limpiarFormularioParaCarga === "function") {
        PV.Core.limpiarFormularioParaCarga();
    }

    if (PV.Core && typeof PV.Core.conmutarTab === "function") {
        PV.Core.conmutarTab("#tab-2");
    } else {
        $('a[href="#tab-2"]').tab('show');
    }

    if (resp && resp.DOCENTRY && resp.DOCENTRY > 0) {
        $("#hdfDocEntry").val(resp.DOCENTRY);
        $("#hdfDocStatusOriginal").val(docStatus || resp.DOCSTATUS || "");
    } else {
        $("#hdfDocEntry").val("");
        $("#hdfDocStatusOriginal").val("");
    }

    if (resp && resp.DOCENTRY_SAP && resp.DOCENTRY_SAP > 0) {
        $("#hdfDocEntrySap").val(resp.DOCENTRY_SAP);
    } else {
        $("#hdfDocEntrySap").val("");
    }

    $("#txtClienteNombre").val(resp.CARDNAME || "");
    $("#txtClienteRuc").val(resp.LICTRADNUM || "");
    $("#txtClienteCodigo").val(resp.CARDCODE || "");
    PV.Cliente.bloquearBusquedaCliente();
    PV.Cliente.cargarDireccionesCliente(
        resp.CARDCODE,
        resp.DELIVERY_PLACE,
        resp.INVOICE_PLACE,
        resp.DELIVERY_ADDRESS,
        resp.INVOICE_ADDRESS
    );
    PV.Cliente.cargarNotasCreditoCliente(resp.CARDCODE, function () {
        marcarNotasCreditoGuardadas(resp);
    });

    if (resp.SLPCODE) $("#ddlVentaVendedor").val(resp.SLPCODE);
    if (resp.WHSCODE) $("#ddlVentaAlmacen").val(resp.WHSCODE);

    if (resp.DOCDATE) {
        PV.Utils.fijarFechaFlatpickr("#txtVentaFechaAtencion", resp.DOCDATE, true);
    }
    fijarListaPrecio(resp.PRICE_LIST);

    $("#txtLogisticaComentarios").val(resp.COMMENTS || "");
    $("#ddlLogisticaTipoEmbalaje").val(resp.PACKING_TYPE || $("#ddlLogisticaTipoEmbalaje option:first").val());
    $("#ddlLogisticaModoEnvio").val(resp.SEND_MODE || $("#ddlLogisticaModoEnvio option:first").val());
    if (resp.DELIVERY_DATE) {
        PV.Utils.fijarFechaFlatpickr("#txtLogisticaFechaEntrega", resp.DELIVERY_DATE, true);
    }
    $("#ddlLogisticaLugarEntrega").val(resp.DELIVERY_POINT || "CENTRO");

    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
        PV.Catalogos.actualizarEstadoHorasEntrega(false, resp.DELIVERY_TIME);
    } else if (resp.DELIVERY_TIME) {
        var dTime = String(resp.DELIVERY_TIME).trim();
        if (dTime) {
            if ($("#ddlLogisticaHoraEntrega option[value='" + dTime + "']").length === 0) {
                $("#ddlLogisticaHoraEntrega").append(new Option(dTime, dTime, true, true));
            }
            $("#ddlLogisticaHoraEntrega").val(dTime);
        }
    }

    $("#txtLogisticaAgencia").val(resp.AGENCY_DATA || "");
    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoAgencia === "function") {
        PV.Catalogos.actualizarEstadoAgencia({ esCambioManual: false });
    }

    $("#txtLogisticaRuc").val(resp.SEND_NDOC || "");
    $("#txtLogisticaContactoNombre").val(resp.SEND_NAME || "");
    $("#txtLogisticaTelefono").val(resp.SEND_PHONE || "");
    $("#txtLogisticaLugarEnvio").val(resp.SEND_PLACE || "");

    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoLugarEnvio === "function") {
        PV.Catalogos.actualizarEstadoLugarEnvio({ esCambioManual: false });
    }

    if (resp.DOCTYPE) {
        $("#ddlFinancieroTipoComprobante").val(resp.DOCTYPE);
    }

    if (resp.PAYFORM) {
        PV.Cliente.aplicarEstadoCreditoDesdeSap(resp.CARDCODE, resp.LICTRADNUM, function (condicionPago) {
            PV.Catalogos.cargarFormasPago(condicionPago, function () {
                if (PV.Catalogos && typeof PV.Catalogos.fijarFormaPago === "function") {
                    PV.Catalogos.fijarFormaPago(resp.PAYFORM);
                } else {
                    $("#ddlFinancieroFormaPago").val(resp.PAYFORM);
                }
            }, resp.PAYFORM);
        });
    } else {
        $("#ddlFinancieroFormaPago").html("");
        PV.Cliente.aplicarEstadoCreditoDesdeSap(resp.CARDCODE, resp.LICTRADNUM);
    }

    if (PV.Detalle && typeof PV.Detalle.resetearFlete === "function") {
        PV.Detalle.resetearFlete(resp.IMP_DELIVERY);
    } else {
        $("#txtVentaFlete").val(resp.IMP_DELIVERY ? resp.IMP_DELIVERY.toFixed(2) : "0.00").prop("readonly", true).addClass("bg-light");
    }
    $("#txtVentaDescuento").val(resp.IMP_DSCTO ? resp.IMP_DSCTO.toFixed(2) : "0.00");
    $("#txtVentaTotal").val("0.00");
    $("#txtVentaNeto").val(resp.IMP_NET ? resp.IMP_NET.toFixed(2) : "0.00");

    PV.Detalle.setFormReadOnly(false);

    var itemsLocal = resp.DETALLE || [];
    var listaPrecio = resp.PRICE_LIST || "";
    var almacen = resp.WHSCODE || "";

    $("#tblVentaDetalle tbody").empty();

    if (itemsLocal.length === 0) {
        PV.Detalle.agregarFilaDetalleVacia();
        return;
    }

    if ($("#txtClienteNombre").data("ui-autocomplete")) {
        $("#txtClienteNombre").autocomplete("destroy");
    }
    $("#txtClienteNombre").prop("disabled", true);
    document.activeElement.blur();

    Swal.fire({
        title: "Cargando artículos desde SAP...",
        text: "Procesando 0 de " + itemsLocal.length + "...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        onOpen: function () {
            Swal.showLoading();
        }
    });

    var procesados = 0;
    var total = itemsLocal.length;

    PV.Detalle.setRecolectarErroresFraccionado(true);

    function precioReabrirConIgv(itemLocal) {
        var igv = String(itemLocal.IGV_AFECT || "IGV").toUpperCase().trim();
        var precio = Number(itemLocal.PRICE || 0);
        var esAfecto = (igv === "IGV" || igv === "S" || igv === "Y");
        var conIgv = esAfecto ? precio * 1.18 : precio;
        return Math.round(conIgv * 100) / 100;
    }

    function preservarDatosReapertura($fila, itemLocal) {
        $fila.data("ugpentry", parseInt(itemLocal.UGPENTRY) || 0);
        $fila.data("price_uom", Number(itemLocal.PRICE_UOM || 0));
        $fila.data("price_bef", Number(itemLocal.PRICE_BEF || 0));
        $fila.data("uomentry_cargado", parseInt(itemLocal.UOMENTRY) || 0);
        $fila.data("pricelist_cargado", String(itemLocal.PRICE_LIST || ""));
    }

    function marcarLotesRestaurados($fila) {
        $fila.find(".btn-detalle-lote")
            .removeClass("btn-outline-primary")
            .addClass("btn-success");
    }

    function restaurarOReasignarLotes($fila, itemLocal) {
        if (!itemLocal.LOTES || itemLocal.LOTES.length === 0) return;

        var itemCode = itemLocal.ITEMCODE || $fila.attr("data-itemcode") || "";
        var almacen = $("#ddlVentaAlmacen").val();

        $.ajax({
            url: "/PuntoVenta/Buscar_LotesArticulo",
            type: "GET",
            dataType: "json",
            timeout: 30000,
            data: { codigoArticulo: itemCode, codigoAlmacen: almacen }
        }).done(function (data) {
            try {
                var disponibilidad = (data || []).filter(function (l) {
                    return (parseFloat(l.QUANTITY) || 0) > 0;
                });

                var cubreTodos = itemLocal.LOTES.every(function (loteGuardado) {
                    var disponibleLote = disponibilidad
                        .filter(function (d) { return String(d.DISTNUMBER) === String(loteGuardado.DISTNUMBER); })
                        .reduce(function (s, d) { return s + (parseFloat(d.QUANTITY) || 0); }, 0);
                    return disponibleLote >= (parseFloat(loteGuardado.QUANTITY) || 0);
                });

                if (cubreTodos) {
                    $fila.data("lotes", itemLocal.LOTES);
                    PV.Detalle.setearFechaDesdeLotes($fila, itemLocal.LOTES);
                    marcarLotesRestaurados($fila);
                    return;
                }

                var factor = parseFloat($fila.find(".ddlDetalleUmd :selected").data("factor")) || 1;
                var cantidad = parseFloat(PV.Detalle.leerCantidadFila($fila)) || 0;
                var restante = cantidad * factor;
                var asignados = [];
                var esPza = PV.Detalle.esUmdPza($fila);

                var ordenados = disponibilidad.slice().sort(function (a, b) {
                    var da = (a.FECHA_VENCIMIENTO || "").split("/");
                    var db = (b.FECHA_VENCIMIENTO || "").split("/");
                    return new Date(da[2], da[1] - 1, da[0]) - new Date(db[2], db[1] - 1, db[0]);
                });

                if (esPza) {
                    for (var i = 0; i < ordenados.length; i++) {
                        var disp = parseFloat(ordenados[i].QUANTITY) || 0;
                        if (disp <= 0) continue;
                        if (disp >= restante) {
                            asignados.push({
                                ITEMCODE: itemCode,
                                SYSNUMBER: String(ordenados[i].SYSNUMBER || ""),
                                DISTNUMBER: String(ordenados[i].DISTNUMBER || ""),
                                QUANTITY: restante
                            });
                            restante = 0;
                            break;
                        }
                    }
                } else {
                    for (var i = 0; i < ordenados.length && restante > 0; i++) {
                        var disp = parseFloat(ordenados[i].QUANTITY) || 0;
                        if (disp <= 0) continue;
                        var asignar = Math.min(restante, disp);
                        asignados.push({
                            ITEMCODE: itemCode,
                            SYSNUMBER: String(ordenados[i].SYSNUMBER || ""),
                            DISTNUMBER: String(ordenados[i].DISTNUMBER || ""),
                            QUANTITY: asignar
                        });
                        restante -= asignar;
                    }
                }

                if (asignados.length > 0) {
                    $fila.data("lotes", asignados);
                    PV.Detalle.setearFechaDesdeLotes($fila, asignados);
                    marcarLotesRestaurados($fila);
                }
            } catch (e) {
                console.error("Error al restaurar lotes de " + (itemLocal.ITEMCODE || ""), e);
                $fila.data("lotes", itemLocal.LOTES);
                PV.Detalle.setearFechaDesdeLotes($fila, itemLocal.LOTES);
                marcarLotesRestaurados($fila);
            }
        }).fail(function () {
            $fila.data("lotes", itemLocal.LOTES);
            PV.Detalle.setearFechaDesdeLotes($fila, itemLocal.LOTES);
            marcarLotesRestaurados($fila);
        });
    }

    function cargarSiguienteArticulo() {
        if (procesados >= total) {
            Swal.close();
            $("#txtClienteNombre").prop("disabled", false);
            PV.Cliente.inicializarAutocompleteCliente();
            PV.Detalle.recalcularTotales();
            PV.Detalle.agregarFilaDetalleVacia();
            mostrarErroresFraccionadoFinal();
            return;
        }

        var itemLocal = itemsLocal[procesados];
        procesados++;

        PV.Detalle.cargarDetalleArticuloVenta(itemLocal.ITEMCODE, listaPrecio, almacen, function (detalle) {
            try {
                var $fila = PV.Detalle.agregarFilaDetalleVacia();
                preservarDatosReapertura($fila, itemLocal);

                if (detalle && detalle.ARTICULO) {
                    PV.Detalle.llenarFilaDetalleDesdeDetalleVenta($fila, detalle, {
                        cantidad: itemLocal.QUANTITY || 0,
                        codigoUmd: itemLocal.UOMENTRY || 0,
                        descuento: itemLocal.WMS_DSC || 0,
                        regalo: itemLocal.WMS_GIF || "NO",
                        mantenerFoco: true,
                        omitirAsegurarFilaFinal: true
                    });
                } else {
                    PV.Detalle.cargarFilaDetalleDesdeVenta($fila, itemLocal);
                }

                if (document.activeElement && typeof document.activeElement.blur === "function") {
                    document.activeElement.blur();
                }
                restaurarOReasignarLotes($fila, itemLocal);
            } catch (e) {
                console.error("Error al procesar artículo " + (itemLocal.ITEMCODE || ""), e);
            }

            Swal.getTitle().textContent =
                "Cargando artículos desde SAP... " + procesados + " de " + total;

            var swalContent = Swal.getContent ? Swal.getContent() : document.querySelector(".swal2-content");
            if (swalContent) {
                var swalContentInner = swalContent.querySelector("#swal2-content") || swalContent;
                swalContentInner.textContent = "Procesando " + procesados + " de " + total + "...";
            }

            cargarSiguienteArticulo();
        }, {
            codigoCliente: resp.CARDCODE || "",
            codigoUmd: itemLocal.UOMENTRY || ""
        });
    }

    cargarSiguienteArticulo();
}

function cargarVentaReadOnly(resp) {
    if (PV.Core && typeof PV.Core.limpiarFormularioParaCarga === "function") {
        PV.Core.limpiarFormularioParaCarga();
    }

    // Activar modo lectura al inicio para evitar que apliquen validaciones de edición/fechas actuales
    PV.Detalle.setFormReadOnly(true);

    // Cambiar al tab VENTA
    if (PV.Core && typeof PV.Core.conmutarTab === "function") {
        PV.Core.conmutarTab("#tab-2");
    } else {
        $('a[href="#tab-2"]').tab('show');
    }

    // Poblar identificadores
    if (resp && resp.DOCENTRY && resp.DOCENTRY > 0) {
        $("#hdfDocEntry").val(resp.DOCENTRY);
        $("#hdfDocStatusOriginal").val(resp.DOCSTATUS || "");
    }
    if (resp && resp.DOCENTRY_SAP && resp.DOCENTRY_SAP > 0) {
        $("#hdfDocEntrySap").val(resp.DOCENTRY_SAP);
    }

    // Poblar cliente
    $("#txtClienteNombre").val(resp.CARDNAME || "");
    $("#txtClienteRuc").val(resp.LICTRADNUM || "");
    $("#txtClienteCodigo").val(resp.CARDCODE || "");
    PV.Cliente.bloquearBusquedaCliente();

    // Cargar direcciones del cliente (rellena dropdowns y texto)
    PV.Cliente.cargarDireccionesCliente(
        resp.CARDCODE,
        resp.DELIVERY_PLACE,
        resp.INVOICE_PLACE,
        resp.DELIVERY_ADDRESS,
        resp.INVOICE_ADDRESS
    );

    // Cargar notas de crédito
    PV.Cliente.cargarNotasCreditoCliente(resp.CARDCODE, function () {
        marcarNotasCreditoGuardadas(resp);
    });

    // Vendedor
    if (resp.SLPCODE) {
        $("#ddlVentaVendedor").val(resp.SLPCODE);
    }

    // Almacén
    if (resp.WHSCODE) {
        $("#ddlVentaAlmacen").val(resp.WHSCODE);
    }

    // Fecha atención
    if (resp.DOCDATE) {
        PV.Utils.fijarFechaFlatpickr("#txtVentaFechaAtencion", resp.DOCDATE, true);
    }

    // Lista precio
    fijarListaPrecio(resp.PRICE_LIST);

    // Comentarios y Logística
    $("#txtLogisticaComentarios").val(resp.COMMENTS || "");
    $("#ddlLogisticaTipoEmbalaje").val(resp.PACKING_TYPE || $("#ddlLogisticaTipoEmbalaje option:first").val());
    $("#ddlLogisticaModoEnvio").val(resp.SEND_MODE || $("#ddlLogisticaModoEnvio option:first").val());
    if (resp.DELIVERY_DATE) {
        PV.Utils.fijarFechaFlatpickr("#txtLogisticaFechaEntrega", resp.DELIVERY_DATE, true);
    }
    $("#ddlLogisticaLugarEntrega").val(resp.DELIVERY_POINT || "CENTRO");

    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
        PV.Catalogos.actualizarEstadoHorasEntrega(false, resp.DELIVERY_TIME);
    } else if (resp.DELIVERY_TIME) {
        $("#ddlLogisticaHoraEntrega option").prop("disabled", false);
        var dTime = String(resp.DELIVERY_TIME).trim();
        if (dTime) {
            if ($("#ddlLogisticaHoraEntrega option[value='" + dTime + "']").length === 0) {
                $("#ddlLogisticaHoraEntrega").append(new Option(dTime, dTime, true, true));
            }
            $("#ddlLogisticaHoraEntrega").val(dTime);
        }
    }

    $("#txtLogisticaAgencia").val(resp.AGENCY_DATA || "");
    $("#txtLogisticaRuc").val(resp.SEND_NDOC || "");
    $("#txtLogisticaContactoNombre").val(resp.SEND_NAME || "");
    $("#txtLogisticaTelefono").val(resp.SEND_PHONE || "");
    $("#txtLogisticaLugarEnvio").val(resp.SEND_PLACE || "");

    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoLugarEnvio === "function") {
        PV.Catalogos.actualizarEstadoLugarEnvio({ esReadOnly: true, esCambioManual: false });
    }

    // Financiero
    if (resp.PAYFORM) {
        PV.Cliente.aplicarEstadoCreditoDesdeSap(resp.CARDCODE, resp.LICTRADNUM, function (condicionPago) {
            PV.Catalogos.cargarFormasPago(condicionPago, function () {
                if (PV.Catalogos && typeof PV.Catalogos.fijarFormaPago === "function") {
                    PV.Catalogos.fijarFormaPago(resp.PAYFORM);
                } else {
                    $("#ddlFinancieroFormaPago").val(resp.PAYFORM);
                }
            }, resp.PAYFORM);
        });
    } else {
        $("#ddlFinancieroFormaPago").html("");
        PV.Cliente.aplicarEstadoCreditoDesdeSqlServer(resp.CARDCODE);
    }
    if (resp.DOCTYPE) {
        $("#ddlFinancieroTipoComprobante").val(resp.DOCTYPE);
    }

    // Totales
    $("#txtVentaFlete").val(resp.IMP_DELIVERY ? resp.IMP_DELIVERY.toFixed(2) : "0.00");
    $("#txtVentaDescuento").val(resp.IMP_DSCTO ? resp.IMP_DSCTO.toFixed(2) : "0.00");
    $("#txtVentaTotal").val("0.00");
    $("#txtVentaNeto").val(resp.IMP_NET ? resp.IMP_NET.toFixed(2) : "0.00");

    // Bloquear formulario en modo lectura
    PV.Detalle.setFormReadOnly(true);

    // Poblar detalle en lote ultrarrápido
    if (resp.DETALLE && resp.DETALLE.length > 0) {
        PV.Utils.actualizarModalProgreso(resp.DETALLE.length, resp.DETALLE.length, "Completado");
        PV.Detalle.cargarDetalleVentaReadOnlyBatch(resp.DETALLE);
        PV.Detalle.recalcularTotales();
        PV.Detalle.setFormReadOnly(true);
        PV.Utils.cerrarModalProgreso(400, function () {
            PV.Utils._procesando = false;
        });
    } else {
        $("#tblVentaDetalle tbody").empty();
        PV.Utils.cerrarModalProgreso(100, function () {
            PV.Utils._procesando = false;
        });
    }
}
