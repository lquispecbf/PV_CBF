var tblStockPorAlmacen = null;

$(document).ready(function () {

    PV.Core.inicializar();

    cargarAlmacenes();
    cargarListaPrecios();

    inicializarTablaStockPorAlmacen();

    $("#btnStockBuscar").on("click", function (e) {
        e.preventDefault();

        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $("#btnStockBuscar").prop("disabled", true);
            buscarStock(function () {
                $("#btnStockBuscar").prop("disabled", false);
                reHabilitar();
            });
        });
    });

    $("#btnStockExportar").on("click", function (e) {
        e.preventDefault();

        PV.Utils.ejecutarAccion(function (reHabilitar) {
            $("#btnStockExportar").prop("disabled", true);

            const filtro = obtenerFiltroStock();

            $.ajax({
                url: "/PuntoVenta/ExportarExcel_StockPorAlmacen",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(filtro),
                xhrFields: { responseType: "blob" },
                beforeSend: function () {
                    $("body").addClass("loading");
                },
                success: function (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "Reporte Stock por Almacen.xlsx";
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
                    $("body").removeClass("loading");
                    $("#btnStockExportar").prop("disabled", false);
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

        buscarStock();
    });
});

function cargarAlmacenes() {
    $.ajax({
        url: "/PuntoVenta/Buscar_Almacenes",
        type: "GET",
        data: { nombreBusqueda: "" },
        dataType: "json",
        success: function (data) {
            let html = '';

            data.forEach(function (item) {
                html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
            });

            $("#ddlStockAlmacen").html(html);
            $("#ddlStockAlmacen").val($("#ddlStockAlmacen option:first").val());
        },
        error: function (xhr) {
            console.log("Error al cargar almacenes", xhr.responseText);
        }
    });
}

function cargarListaPrecios() {
    $.ajax({
        url: "/PuntoVenta/Buscar_ListaPrecios",
        type: "GET",
        data: { nombreBusqueda: "" },
        dataType: "json",
        success: function (data) {
            let html = '';

            data.forEach(function (item) {
                html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
            });

            $("#ddlStockListaPrecio").html(html);
            $("#ddlStockListaPrecio").val($("#ddlStockListaPrecio option:first").val());
        },
        error: function (xhr) {
            console.log("Error al cargar listas de precio", xhr.responseText);
        }
    });
}

function inicializarTablaStockPorAlmacen() {
    tblStockPorAlmacen = $("#tblStockPorAlmacen").DataTable({
        data: [],
        columns: [
            { data: "CODIGO" },
            { data: "DESCRIPCION" },
            { data: "UMD" },
            { data: "LABORATORIO" },
            {
                data: "PRECIO",
                render: function (data) {
                    return data != null ? parseFloat(data).toFixed(4) : "";
                },
                className: "text-right"
            },
            {
                data: "PRECIO_CAJA",
                render: function (data) {
                    return data != null ? parseFloat(data).toFixed(4) : "";
                },
                className: "text-right"
            },
            {
                data: "STOCK",
                render: function (data) {
                    return data != null ? parseFloat(data).toFixed(2) : "";
                },
                className: "text-right"
            },
            { data: "FECHA_VENCIMIENTO" },
            { data: "PRINCIPIO_ACTIVO" },
            { data: "ESTADO_SKU" },
            { data: "OBSERVACION" }
        ],
        language: {
            url: "/js/plugins/dataTables/Spanish.js",
            emptyTable: "No se encontraron resultados para mostrar."
        },
        ordering: true,
        pageLength: 25,
        lengthMenu: [[25, 50, 100, 200, -1], [25, 50, 100, 200, "Todos"]],
        searching: true,
        initComplete: function () {
            $("#tblStockPorAlmacen").hide();
            $("#tblStockPorAlmacen_wrapper").hide();
        }
    });
}

function obtenerFiltroStock() {
    return {
        TEXTO_BUSQUEDA: $("#txtStockBusqueda").val() || "",
        CODIGO_LISTA_PRECIO: parseInt($("#ddlStockListaPrecio").val(), 10) || 0,
        CODIGO_ALMACEN: $("#ddlStockAlmacen").val() || ""
    };
}

function buscarStock(onComplete) {
    const filtro = obtenerFiltroStock();

    $.ajax({
        url: "/PuntoVenta/Buscar_StockPorAlmacen",
        type: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(filtro),
        beforeSend: function () {
            $("#tblStockPorAlmacen_wrapper").hide();
            $("body").addClass("loading");
        },
        success: function (data) {
            tblStockPorAlmacen.clear();
            tblStockPorAlmacen.rows.add(data || []);
            tblStockPorAlmacen.draw();
            $("#tblStockPorAlmacen").show();
            $("#tblStockPorAlmacen_wrapper").show();
        },
        error: function (xhr) {
            var msg = "Error al buscar stock por almacén.";
            if (xhr.responseJSON && xhr.responseJSON.error) {
                msg = xhr.responseJSON.error;
            }
            console.error(msg, xhr.responseText);
            Swal.fire({ type: "error", title: "Error", text: msg });
        },
        complete: function () {
            $("body").removeClass("loading");
            if (typeof onComplete === "function") onComplete();
        }
    });
}
