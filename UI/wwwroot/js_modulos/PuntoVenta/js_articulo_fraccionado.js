$(document).ready(function () {

    var tblArticulos = null;

    var _puedeGestionar = (function () {
        if (!window.PERMISOS_PV) return true;
        if (typeof window.PERMISOS_PV.puedeArticuloFraccionadoGestionar === 'boolean') {
            return window.PERMISOS_PV.puedeArticuloFraccionadoGestionar;
        }
        if (typeof window.PERMISOS_PV.PuedeArticuloFraccionadoGestionar === 'boolean') {
            return window.PERMISOS_PV.PuedeArticuloFraccionadoGestionar;
        }
        return true;
    })();

    if (!_puedeGestionar) {
        $('#imgmas, #btnnuevo, #btnimportar, #btnEliminarTodos').hide();
    }

    inicializarTabla();
    registrarEventos();
    $('#txtBuscarArticulo').focus();
    $('#btnexportar, #btnEliminarTodos').prop('disabled', true);

    function inicializarTabla() {
        tblArticulos = $('#tabla').DataTable({
            data: [],
            columns: [
                { data: "ID_ARTICULO_FRACCIONADO", title: "ID", width: "50px", visible: false },
                { data: "ARTICULO", title: "ARTÍCULO" },
                { data: "ITEMCODE", title: "CÓDIGO", width: "100px" },
                { data: "FRACCIONADO", title: "FRACCIONADO", className: "text-center", width: "100px" },
                { data: "MONTO_MINIMO", title: "MONTO MÍNIMO", className: "text-center", width: "110px" },
                {
                    data: "ESTADO", title: "ESTADO", className: "text-center", width: "100px",
                    render: function (data) {
                        return data
                            ? '<span class="badge badge-primary">ACTIVO</span>'
                            : '<span class="badge badge-danger">INACTIVO</span>';
                    }
                },
                { data: "FECHAHORA_CREACION", title: "FECHA CREACIÓN", width: "120px", visible: false },
                {
                    data: null, title: "EDITAR", className: "text-center", width: "60px",
                    visible: _puedeGestionar,
                    render: function () {
                        return '<img src="../img/editar_2.png" class="btnEditar" style="width:20px;height:20px;cursor:pointer;" title="Editar" />';
                    }
                },
                {
                    data: "ESTADO", title: "ELIMINAR", className: "text-center", width: "60px",
                    visible: _puedeGestionar,
                    render: function (data) {
                        if (data) {
                            return '<img src="../img/eliminar.png" class="btnEliminar" style="width:20px;height:20px;cursor:pointer;" title="Eliminar" />';
                        } else {
                            return '<img src="../img/eliminar.png" style="width:20px;height:20px;opacity:0.3;cursor:not-allowed;" title="Registro inactivo" />';
                        }
                    }
                }
            ],
            language: {
                url: "/js/plugins/dataTables/Spanish.js"
            },
            pageLength: 10,
            order: [[1, "asc"]]
        });
    }

    function registrarEventos() {

        $('#btnbuscar').on('click', function () {
            BUSCAR();
        });

        $('#txtBuscarArticulo').on('keypress', function (e) {
            if (e.which === 13) { e.preventDefault(); BUSCAR(); }
        });

        $('.btn-clear-input').on('click', function () {
            $(this).closest('.input-clear').find('input').val('').focus();
        });

        $('#btnnuevo').on('click', function () {
            NUEVO();
        });

        $('#btnGuardar').on('click', function () {
            GUARDAR();
        });

        $('#tabla').on('click', '.btnEditar', function () {
            var data = tblArticulos.row($(this).closest('tr')).data();
            if (data) EDITAR(data.ID_ARTICULO_FRACCIONADO);
        });

        $('#tabla').on('click', '.btnEliminar', function () {
            var data = tblArticulos.row($(this).closest('tr')).data();
            if (data) ELIMINAR(data.ID_ARTICULO_FRACCIONADO, data.ARTICULO);
        });

        $('#btnexportar').on('click', function () {
            EXPORTAR();
        });

        $('#btnimportar').on('click', function () {
            abrirModalImportar();
        });

        $('#btnEliminarTodos').on('click', function () {
            ELIMINAR_TODOS();
        });

        $('#fileImportarExcel').on('change', function () {
            procesarArchivoExcel(this);
        });

        $('#ddlImportarHoja').on('change', function () {
            cargarPreviewExcel();
        });

        $('#btnCargarExcel').on('click', function () {
            importarArticulosExcel();
        });

        inicializarAutocompleteArticuloModal();

        $('#txtModalFraccionado').on('input change keyup', function () {
            actualizarOpcionesMontoMinimo();
        });

        $('#modalArticuloFraccionado').on('hidden.bs.modal', function () {
            limpiarModal();
        });

        $('.btn-clear-modal-articulo').on('click', function () {
            _articuloseleccionado = false;
            _factorUmdPredeterminada = 0;
            $('#txtModalArticulo').val('').prop('disabled', false).focus();
            $('#txtModalDescripcion').val('');
            $('#txtModalFraccionado').val('').prop('disabled', true).removeAttr('max');
            $('#ddlModalMontoMinimo').empty().append('<option value="">Seleccionar</option>').prop('disabled', true);
            $('#divUmds').hide();
            $('#tblUmdsModal tbody').empty();
            $('#lblSinUmds').hide();
            $('#lblErrorFactorUmd').remove();
            $('#btnGuardar').prop('disabled', false);
        });

        $('#modalArticuloFraccionado').on('shown.bs.modal', function () {
            var id = parseInt($('#txtIdArticuloFraccionado').val()) || 0;
            if (id === 0) {
                $('#txtModalArticulo').focus();
            } else {
                $('#txtModalFraccionado').focus();
            }
        });
    }

    var _articuloseleccionado = false;

    function inicializarAutocompleteArticuloModal() {
        $(".autocomplete-articulo-modal").autocomplete({
            minLength: 3,
            delay: 300,
            source: function (request, response) {
                $.ajax({
                    url: '/PuntoVenta/Buscar_ArticuloSap',
                    type: 'GET',
                    data: { criterioBusqueda: request.term },
                    success: function (data) {
                        response($.map(data, function (item) {
                            return {
                                label: item.CODIGO + ' - ' + item.DESCRIPCION,
                                value: item.CODIGO,
                                data: item
                            };
                        }));
                    },
                    error: function () {
                        console.log("Error al buscar artículos");
                    }
                });
            },
            focus: function (event, ui) { return false; },
            select: function (event, ui) {
                var a = ui.item.data;
                _articuloseleccionado = true;
                $("#txtModalArticulo").val(a.CODIGO).prop('disabled', true);
                $("#txtModalDescripcion").val(a.DESCRIPCION);
                cargarUmdsArticulo(a.CODIGO, function (factorPred) {
                    if (factorPred > 1) {
                        $("#txtModalFraccionado").prop('disabled', false).val('').focus();
                        $('#ddlModalMontoMinimo').empty().append('<option value="">Seleccionar</option>').prop('disabled', true);
                    }
                });
                return false;
            }
        }).on('input', function () {
            _articuloseleccionado = false;
        });
    }

    function BUSCAR() {
        var filtro = {
            ITEMCODE: ($("#txtBuscarArticulo").val() || "").trim(),
            ESTADO: $("#ddlEstado").val() === "" ? null : $("#ddlEstado").val() === "1"
        };

        $('body').addClass('loading');

        $.ajax({
            url: '/PuntoVenta/Buscar_ArticulosFraccionados',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(filtro),
            dataType: 'json',
            success: function (data) {
                $('body').removeClass('loading');
                tblArticulos.clear();
                if (data && data.length > 0) {
                    tblArticulos.rows.add(data).draw();
                } else {
                    tblArticulos.draw();
                }
                $('#contenedorTabla').show();
                $('#btnexportar, #btnEliminarTodos').prop('disabled', !(data && data.length > 0));
            },
            error: function (xhr) {
                $('body').removeClass('loading');
                tblArticulos.clear().draw();
                $('#contenedorTabla').hide();
                $('#btnexportar, #btnEliminarTodos').prop('disabled', true);
                if (xhr.status !== 403 && xhr.status !== 401) {
                    Swal.fire({ type: 'error', title: 'Error', text: 'Error al buscar artículos fraccionados.' });
                }
            }
        });
    }

    function NUEVO() {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para registrar artículos fraccionados.' });
            return;
        }
        _articuloseleccionado = false;
        _factorUmdPredeterminada = 0;
        $('#txtIdArticuloFraccionado').val(0);
        $('#tituloModal').html('<strong>Nuevo Artículo Fraccionado</strong>');
        $('#txtModalArticulo').prop('disabled', false).val('');
        $('#txtModalDescripcion').val('');
        $('#txtModalFraccionado').val('').prop('disabled', true).prop('readonly', false).removeAttr('max');
        $('#ddlModalMontoMinimo').empty().append('<option value="">Seleccionar</option>').prop('disabled', true);
        $('#ddlModalEstado').val('true').prop('disabled', false);
        $('#divModalEstado').hide();
        $('.btn-clear-modal-articulo').show();
        $('#btnGuardar').prop('disabled', false);
        $('#divUmds').hide();
        $('#tblUmdsModal tbody').empty();
        $('#lblSinUmds').hide();
        $('#lblErrorFactorUmd').remove();
        $('#modalArticuloFraccionado').modal('show');
    }

    function EDITAR(id) {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para modificar artículos fraccionados.' });
            return;
        }
        $('body').addClass('loading');

        $.ajax({
            url: '/PuntoVenta/Obtener_ArticuloFraccionado',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ ID_ARTICULO_FRACCIONADO: id }),
            dataType: 'json',
            success: function (data) {
                $('body').removeClass('loading');
                if (!data) {
                    Swal.fire({ type: 'warning', title: 'No encontrado', text: 'El registro no fue encontrado.' });
                    return;
                }
                $('#txtIdArticuloFraccionado').val(data.ID_ARTICULO_FRACCIONADO);
                $('#tituloModal').html('<strong>Editar Artículo Fraccionado</strong>');
                _articuloseleccionado = true;
                $('#txtModalArticulo').val(data.ITEMCODE).prop('disabled', true);
                $('#txtModalDescripcion').val(data.ARTICULO || '');
                $('#txtModalFraccionado').val(data.FRACCIONADO);
                $('#ddlModalEstado').val(data.ESTADO ? 'true' : 'false');
                $('#divModalEstado').show();
                $('.btn-clear-modal-articulo').hide();

                cargarUmdsArticulo(data.ITEMCODE, function (factorPred) {
                    actualizarOpcionesMontoMinimo(data.MONTO_MINIMO);

                    if (!data.ESTADO) {
                        $('#txtModalFraccionado').prop('readonly', true).prop('disabled', true);
                        $('#ddlModalMontoMinimo').prop('disabled', true);
                        $('#ddlModalEstado').prop('disabled', true);
                        $('#btnGuardar').prop('disabled', true);
                    } else {
                        $('#txtModalFraccionado').prop('readonly', false).prop('disabled', false);
                        $('#ddlModalMontoMinimo').prop('disabled', false);
                        $('#ddlModalEstado').prop('disabled', false);
                        $('#btnGuardar').prop('disabled', false);
                    }
                });

                $('#modalArticuloFraccionado').modal('show');
            },
            error: function (xhr) {
                $('body').removeClass('loading');
                Swal.fire({ type: 'error', title: 'Error', text: 'Error al obtener el registro.' });
            }
        });
    }

    var _factorUmdPredeterminada = 0;

    function actualizarOpcionesMontoMinimo(valorSeleccionado) {
        var fraccionado = parseInt($('#txtModalFraccionado').val(), 10) || 0;
        var $ddl = $('#ddlModalMontoMinimo');

        var valorPrevio = valorSeleccionado !== undefined ? parseInt(valorSeleccionado, 10) : (parseInt($ddl.val(), 10) || 0);

        $ddl.empty().append('<option value="">Seleccionar</option>');

        var factorUmd = Math.round(parseFloat(_factorUmdPredeterminada) || 0);

        if (fraccionado > 0 && factorUmd > 1 && fraccionado < factorUmd) {
            var numOpciones = Math.floor((factorUmd - fraccionado) / fraccionado) + 1;
            if (numOpciones > 0 && numOpciones <= 200) {
                for (var m = fraccionado, iter = 0; m < factorUmd && iter < 200; m += fraccionado, iter++) {
                    $ddl.append('<option value="' + m + '">' + m + '</option>');
                }
                $ddl.prop('disabled', false);
                if (valorPrevio > 0) {
                    $ddl.val(valorPrevio);
                }
                return;
            }
        }
        $ddl.prop('disabled', true);
    }

    function GUARDAR() {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para guardar o modificar artículos fraccionados.' });
            return;
        }
        var id = parseInt($('#txtIdArticuloFraccionado').val()) || 0;
        var itemcode = ($('#txtModalArticulo').val() || '').trim();
        var fraccionado = parseInt($('#txtModalFraccionado').val()) || 0;
        var montoMinimo = parseInt($('#ddlModalMontoMinimo').val()) || 0;
        var estado = $('#ddlModalEstado').val() === 'true';

        if (!itemcode || !_articuloseleccionado) {
            Swal.fire({ type: 'warning', title: 'Datos incompletos', text: 'Debe seleccionar un artículo del listado SAP.' });
            return;
        }
        if (!fraccionado || fraccionado <= 0) {
            Swal.fire({ type: 'warning', title: 'Datos incompletos', text: 'Debe ingresar un valor de fraccionado mayor a 0.' });
            return;
        }

        if (_factorUmdPredeterminada > 0 && _factorUmdPredeterminada <= 1) {
            Swal.fire({ type: 'warning', title: 'Artículo no fraccionable', text: 'El artículo no se puede registrar como fraccionado porque su unidad predeterminada tiene factor 1.' });
            return;
        }

        if (_factorUmdPredeterminada > 1 && fraccionado >= _factorUmdPredeterminada) {
            Swal.fire({ type: 'warning', title: 'Fracción no válida', text: 'El valor fraccionado (' + fraccionado + ') debe ser menor al factor de la unidad predeterminada (' + _factorUmdPredeterminada + ').' });
            return;
        }

        if (!montoMinimo || montoMinimo <= 0) {
            Swal.fire({ type: 'warning', title: 'Datos incompletos', text: 'Debe seleccionar el monto mínimo.' });
            return;
        }

        if (montoMinimo < fraccionado || montoMinimo % fraccionado !== 0) {
            Swal.fire({ type: 'warning', title: 'Monto Mínimo inválido', text: 'El monto mínimo debe ser un múltiplo exacto del valor fraccionado.' });
            return;
        }

        if (_factorUmdPredeterminada > 1 && montoMinimo >= _factorUmdPredeterminada) {
            Swal.fire({ type: 'warning', title: 'Monto Mínimo no válido', text: 'El monto mínimo (' + montoMinimo + ') debe ser menor al factor de la unidad predeterminada (' + _factorUmdPredeterminada + ').' });
            return;
        }

        var dto = {
            ID_ARTICULO_FRACCIONADO: id,
            ITEMCODE: itemcode,
            FRACCIONADO: fraccionado,
            MONTO_MINIMO: montoMinimo,
            ESTADO: id === 0 ? true : estado
        };

        var url = id === 0
            ? '/PuntoVenta/Insertar_ArticuloFraccionado'
            : '/PuntoVenta/Actualizar_ArticuloFraccionado';

        $('body').addClass('loading');

        $.ajax({
            url: url,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(dto),
            dataType: 'json',
            success: function (resp) {
                $('body').removeClass('loading');
                if (resp.success) {
                    Swal.fire({ type: 'success', title: 'Guardado', text: resp.message })
                        .then(function () {
                            $('#modalArticuloFraccionado').modal('hide');
                            BUSCAR();
                        });
                } else {
                    Swal.fire({ type: 'error', title: 'Error', text: resp.error || 'Error al guardar.' });
                }
            },
            error: function (xhr) {
                $('body').removeClass('loading');
                var msg = 'Error al guardar el registro.';
                if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                var tipo = xhr.status === 400 ? 'warning' : 'error';
                var titulo = xhr.status === 400 ? 'Atención' : 'Error';
                Swal.fire({ type: tipo, title: titulo, text: msg });
            }
        });
    }

    function ELIMINAR(id, nombre) {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para inactivar artículos fraccionados.' });
            return;
        }
        Swal.fire({
            title: '¿Eliminar registro?',
            text: 'Se cambiará el estado del artículo "' + (nombre || '') + '" a inactivo.',
            type: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(function (result) {
            if (!result.value) return;

            $('body').addClass('loading');

            $.ajax({
                url: '/PuntoVenta/Eliminar_ArticuloFraccionado',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ ID_ARTICULO_FRACCIONADO: id }),
                dataType: 'json',
                success: function (resp) {
                    $('body').removeClass('loading');
                    if (resp.success) {
                        Swal.fire({ type: 'success', title: 'Eliminado', text: resp.message })
                            .then(function () { BUSCAR(); });
                    } else {
                        Swal.fire({ type: 'error', title: 'Error', text: resp.error || 'Error al eliminar.' });
                    }
                },
                error: function (xhr) {
                    $('body').removeClass('loading');
                    var msg = 'Error al eliminar el registro.';
                    if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                    Swal.fire({ type: 'error', title: 'Error', text: msg });
                }
            });
        });
    }

    function ELIMINAR_TODOS() {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para inactivar artículos fraccionados.' });
            return;
        }
        Swal.fire({
            title: '¿Inactivar todos los registros?',
            text: 'Se cambiará el estado de todos los artículos fraccionados activos a inactivo.',
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, inactivar todos',
            cancelButtonText: 'Cancelar'
        }).then(function (result) {
            if (!result.value) return;

            $('body').addClass('loading');

            $.ajax({
                url: '/PuntoVenta/EliminarTodos_ArticulosFraccionados',
                type: 'POST',
                dataType: 'json',
                success: function (resp) {
                    $('body').removeClass('loading');
                    if (resp.success) {
                        Swal.fire({ type: 'success', title: 'Completado', text: resp.message })
                            .then(function () { BUSCAR(); });
                    } else {
                        Swal.fire({ type: 'error', title: 'Error', text: resp.error || 'Error al procesar la solicitud.' });
                    }
                },
                error: function (xhr) {
                    $('body').removeClass('loading');
                    var msg = 'Error al inactivar los registros.';
                    if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                    Swal.fire({ type: 'error', title: 'Error', text: msg });
                }
            });
        });
    }

    function EXPORTAR() {
        if (!tblArticulos || tblArticulos.rows().count() === 0) {
            Swal.fire({ type: 'warning', title: 'Sin datos', text: 'No hay datos para exportar. Realice una búsqueda primero.' });
            return;
        }

        var filtro = {
            ITEMCODE: ($("#txtBuscarArticulo").val() || "").trim(),
            ESTADO: $("#ddlEstado").val() === "" ? null : $("#ddlEstado").val() === "1"
        };

        $('body').addClass('loading');

        $.ajax({
            url: '/PuntoVenta/Exportar_ArticulosFraccionados',
            type: 'POST',
            data: JSON.stringify(filtro),
            contentType: 'application/json',
            xhrFields: { responseType: 'blob' },
            success: function (blob, status, xhr) {
                $('body').removeClass('loading');
                var contentType = xhr.getResponseHeader('Content-Type') || '';
                if (contentType.includes('spreadsheetml')) {
                    var url = window.URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'Articulos_Fraccionados.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } else {
                    var reader = new FileReader();
                    reader.onload = function () { Swal.fire({ type: 'error', title: 'Error', text: reader.result }); };
                    reader.readAsText(blob);
                }
            },
            error: function (xhr) {
                $('body').removeClass('loading');
                $('#btnexportar').prop('disabled', true);
                var msg = 'Error al exportar.';
                if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                if (xhr.status !== 403 && xhr.status !== 401) {
                    Swal.fire({ type: 'error', title: 'Error', text: msg });
                }
            }
        });
    }

    function cargarUmdsArticulo(codigoArticulo, callback) {
        _factorUmdPredeterminada = 0;
        $('#divUmds').hide();
        $('#tblUmdsModal tbody').empty();
        $('#lblSinUmds').hide();
        $('#lblErrorFactorUmd').remove();

        if (!codigoArticulo) {
            if (typeof callback === 'function') callback(0);
            return;
        }

        $.ajax({
            url: '/PuntoVenta/Buscar_UmdArticulo',
            type: 'GET',
            data: { codigoArticulo: codigoArticulo },
            success: function (data) {
                if (!data || data.length === 0) {
                    $('#lblSinUmds').show();
                    $('#divUmds').show();
                    if (typeof callback === 'function') callback(0);
                    return;
                }

                var $tbody = $('#tblUmdsModal tbody');
                var predeterminada = null;

                $.each(data, function (i, umd) {
                    var esPredeterminada = (umd.ES_PREDETERMINADA || '').toUpperCase() === 'Y';
                    if (esPredeterminada) predeterminada = umd;
                    var trClass = esPredeterminada ? 'style="background-color:#e8f8f5;"' : '';
                    var badge = esPredeterminada
                        ? '<span class="badge badge-primary">Sí</span>'
                        : '<span class="badge badge-secondary">No</span>';

                    $tbody.append(
                        '<tr ' + trClass + '>' +
                        '<td>' + (umd.CODIGO_UMD || '') + '</td>' +
                        '<td>' + (umd.NOMBRE || '') + '</td>' +
                        '<td class="text-right">' + (umd.FACTOR != null ? umd.FACTOR.toFixed(2) : '') + '</td>' +
                        '<td class="text-center">' + badge + '</td>' +
                        '</tr>'
                    );
                });

                if (!predeterminada && data.length > 0) predeterminada = data[0];
                var factorPred = predeterminada ? (parseFloat(predeterminada.FACTOR) || 1) : 1;
                _factorUmdPredeterminada = factorPred;

                if (factorPred <= 1) {
                    $('#divUmds').append(
                        '<div id="lblErrorFactorUmd" class="alert alert-danger mt-2 py-1 px-2 mb-0" style="font-size:13px;">' +
                        '<i class="fa fa-exclamation-triangle"></i> <strong>Atención:</strong> Este artículo tiene unidad predeterminada con factor 1 (' + (predeterminada ? predeterminada.NOMBRE : 'PZA') + '). <strong>No es fraccionable</strong>.' +
                        '</div>'
                    );
                    $('#btnGuardar').prop('disabled', true);
                    $('#txtModalFraccionado').prop('disabled', true).val('');
                    $('#ddlModalMontoMinimo').empty().append('<option value="">Seleccionar</option>').prop('disabled', true);
                } else {
                    $('#btnGuardar').prop('disabled', false);
                    $('#txtModalFraccionado').prop('disabled', false).attr('max', factorPred - 1);
                }

                $('#divUmds').show();
                if (typeof callback === 'function') callback(factorPred);
            },
            error: function () {
                console.log('Error al buscar unidades de medida del artículo.');
                if (typeof callback === 'function') callback(0);
            }
        });
    }

    function limpiarModal() {
        _articuloseleccionado = false;
        _factorUmdPredeterminada = 0;
        $('#txtIdArticuloFraccionado').val(0);
        $('#txtModalArticulo').val('').prop('disabled', false);
        $('#txtModalDescripcion').val('');
        $('#txtModalFraccionado').val('').prop('readonly', false).prop('disabled', true).removeAttr('max');
        $('#ddlModalMontoMinimo').empty().append('<option value="">Seleccionar</option>').prop('disabled', true);
        $('#ddlModalEstado').val('true').prop('disabled', false);
        $('#divModalEstado').hide();
        $('#btnGuardar').prop('disabled', false);
        $('.btn-clear-modal-articulo').show();
        $('#divUmds').hide();
        $('#tblUmdsModal tbody').empty();
        $('#lblSinUmds').hide();
        $('#lblErrorFactorUmd').remove();
    }

    // ========== IMPORTAR DESDE EXCEL ==========

    var _workbookExcel = null;
    var _datosExcel = [];
    var _mapaExistentesFraccionados = {};

    function cargarExistentesFraccionados(callback) {
        $.ajax({
            url: '/PuntoVenta/Buscar_ArticulosFraccionados',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ ESTADO: null }),
            dataType: 'json',
            success: function (data) {
                _mapaExistentesFraccionados = {};
                if (Array.isArray(data)) {
                    $.each(data, function (i, item) {
                        if (item.ITEMCODE) {
                            _mapaExistentesFraccionados[item.ITEMCODE.trim().toUpperCase()] = item;
                        }
                    });
                }
                if (typeof callback === 'function') callback();
            },
            error: function () {
                _mapaExistentesFraccionados = {};
                if (typeof callback === 'function') callback();
            }
        });
    }

    function abrirModalImportar() {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para importar artículos fraccionados.' });
            return;
        }
        _workbookExcel = null;
        _datosExcel = [];
        _mapaExistentesFraccionados = {};
        $('#fileImportarExcel').fileinput('destroy');
        $('#fileImportarExcel').fileinput({
            language: 'es',
            showUpload: false,
            showRemove: true,
            showPreview: false,
            allowedFileExtensions: ['xls', 'xlsx', 'xlsm'],
            browseLabel: 'Examinar...',
            removeLabel: 'Limpiar'
        });
        $('#ddlImportarHoja').empty().append('<option value="">-- Seleccionar hoja --</option>');
        $('#divSeleccionHoja').hide();
        $('#divVistaPrevia').hide();
        $('#tblVistaPreviaExcel tbody').empty();
        $('#lblTotalFilasExcel').text('');
        cargarExistentesFraccionados();
        $('#modalImportarExcel').modal('show');
    }

    function procesarArchivoExcel(input) {
        var archivo = input.files[0];
        if (!archivo) return;
        $('#lblArchivoExcel').text(archivo.name);

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = new Uint8Array(e.target.result);
                _workbookExcel = XLSX.read(data, { type: 'array' });
                var hojas = _workbookExcel.SheetNames;

                $('#ddlImportarHoja').empty().append('<option value="">-- Seleccionar hoja --</option>');
                $.each(hojas, function (i, nombre) {
                    $('#ddlImportarHoja').append('<option value="' + nombre + '">' + nombre + '</option>');
                });

                if (hojas.length === 1) {
                    $('#ddlImportarHoja').val(hojas[0]);
                    $('#divSeleccionHoja').hide();
                    cargarPreviewExcel();
                } else {
                    $('#divSeleccionHoja').show();
                }
            } catch (err) {
                Swal.fire({ type: 'error', title: 'Error al leer archivo', text: err.message });
            }
        };
        reader.readAsArrayBuffer(archivo);
    }

    function cargarPreviewExcel() {
        var nombreHoja = $('#ddlImportarHoja').val();
        if (!_workbookExcel || !nombreHoja) return;

        if ($.isEmptyObject(_mapaExistentesFraccionados)) {
            cargarExistentesFraccionados(function () {
                renderizarTablaPreview(nombreHoja);
            });
        } else {
            renderizarTablaPreview(nombreHoja);
        }
    }

    function renderizarTablaPreview(nombreHoja) {
        var sheet = _workbookExcel.Sheets[nombreHoja];
        var json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        _datosExcel = [];
        var $tbody = $('#tblVistaPreviaExcel tbody').empty();
        var totalConCodigo = 0;
        var totalNuevos = 0;
        var totalExistentes = 0;

        for (var i = 1; i < json.length; i++) {
            var fila = json[i];
            var itemcode = (fila[0] || '').toString().trim();
            var descripcion = (fila[1] || '').toString().trim();
            var fraccionado = parseInt(fila[2]) || 0;
            var montoMinimo = parseInt(fila[3]) || 0;

            if (!itemcode) continue;

            totalConCodigo++;

            var existente = _mapaExistentesFraccionados[itemcode.toUpperCase()];
            var fraccionActual = existente ? (existente.FRACCIONADO || 0) : null;
            var montoMinimoActual = existente ? (existente.MONTO_MINIMO || existente.FRACCIONADO || 0) : null;

            var esFraccionValida = fraccionado > 0;
            var esMontoMinimoValido = montoMinimo > 0 && montoMinimo >= fraccionado && (montoMinimo % fraccionado === 0);
            var esValido = esFraccionValida && esMontoMinimoValido;

            if (esValido) {
                _datosExcel.push({
                    ITEMCODE: itemcode,
                    FRACCIONADO: fraccionado,
                    MONTO_MINIMO: montoMinimo,
                    FILA: i + 1
                });

                if (existente) {
                    totalExistentes++;
                } else {
                    totalNuevos++;
                }
            }

            var htmlFracActual = existente
                ? '<span class="badge badge-secondary" style="font-size:12px;">' + fraccionActual + '</span>'
                : '<span class="text-muted">-</span>';

            var htmlFracImportada = esFraccionValida
                ? '<strong class="text-navy" style="font-size:12px;">' + fraccionado + '</strong>'
                : '<span class="text-danger font-weight-bold">' + (fila[2] != null && fila[2] !== '' ? fila[2] : '-') + '</span>';

            var htmlMontoMinActual = existente
                ? '<span class="badge badge-secondary" style="font-size:12px;">' + montoMinimoActual + '</span>'
                : '<span class="text-muted">-</span>';

            var htmlMontoMinImportado = esMontoMinimoValido
                ? '<strong class="text-navy" style="font-size:12px;">' + montoMinimo + '</strong>'
                : '<span class="text-danger font-weight-bold">' + (fila[3] != null && fila[3] !== '' ? fila[3] : '-') + '</span>';

            var badgeEstado;
            if (!esFraccionValida) {
                badgeEstado = '<span class="badge badge-danger" title="El valor fraccionado debe ser mayor a 0"><i class="fa fa-times"></i> Fracc. inválido</span>';
            } else if (montoMinimo <= 0) {
                badgeEstado = '<span class="badge badge-danger" title="El monto mínimo debe ser mayor a 0"><i class="fa fa-times"></i> Monto mín. inválido</span>';
            } else if (montoMinimo < fraccionado || montoMinimo % fraccionado !== 0) {
                badgeEstado = '<span class="badge badge-danger" title="El monto mínimo (' + montoMinimo + ') no es múltiplo del valor fraccionado (' + fraccionado + '). No se importará."><i class="fa fa-times"></i> No se importará (No es múltiplo)</span>';
            } else if (existente) {
                if (fraccionActual !== fraccionado || montoMinimoActual !== montoMinimo) {
                    badgeEstado = '<span class="badge badge-warning" title="El artículo ya existe. Se actualizará la fracción a ' + fraccionado + ' y monto mínimo a ' + montoMinimo + '"><i class="fa fa-refresh"></i> Ya existe (Se actualizará)</span>';
                } else {
                    badgeEstado = '<span class="badge badge-info" title="El artículo ya existe con los mismos valores"><i class="fa fa-check"></i> Ya existe (Mismos valores)</span>';
                }
            } else {
                badgeEstado = '<span class="badge badge-primary"><i class="fa fa-plus"></i> Nuevo</span>';
            }

            $tbody.append(
                '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + itemcode + '</td>' +
                '<td>' + descripcion + '</td>' +
                '<td class="text-center">' + htmlFracActual + '</td>' +
                '<td class="text-center">' + htmlFracImportada + '</td>' +
                '<td class="text-center">' + htmlMontoMinActual + '</td>' +
                '<td class="text-center">' + htmlMontoMinImportado + '</td>' +
                '<td class="text-center">' + badgeEstado + '</td>' +
                '</tr>'
            );
        }

        $('#lblTotalFilasExcel').html('Filas válidas: <strong>' + _datosExcel.length + '</strong> (<strong>' + totalNuevos + '</strong> nuevos, <strong>' + totalExistentes + '</strong> a actualizar) de ' + totalConCodigo + ' filas con código.');
        $('#divVistaPrevia').show();
    }

    function importarArticulosExcel() {
        if (_datosExcel.length === 0) {
            Swal.fire({ type: 'warning', title: 'Sin datos', text: 'No hay filas válidas para importar. Verifique que el archivo tenga código, fraccionado y monto mínimo múltiplo del fraccionado.' });
            return;
        }

        $('#modalImportarExcel').modal('hide');
        Swal.fire({ title: 'Importando artículos...', html: 'Procesando registros...', allowOutsideClick: false, onOpen: function () { Swal.showLoading(); } });

        $.ajax({
            url: '/PuntoVenta/Importar_ArticulosFraccionados',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(_datosExcel),
            dataType: 'json',
            success: function (resultado) {
                Swal.close();
                mostrarResumenImportacion(resultado);
            },
            error: function (xhr) {
                Swal.close();
                var msg = 'Error al importar artículos fraccionados.';
                if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                Swal.fire({ type: 'error', title: 'Error', text: msg });
            }
        });
    }

    function mostrarResumenImportacion(resultado) {
        var exitosos = resultado.Exitosos || 0;
        var nuevos = resultado.Nuevos || 0;
        var actualizados = resultado.Actualizados || 0;
        var errores = resultado.Errores || [];

        if (errores.length === 0) {
            var mensaje = 'Se importaron <strong>' + exitosos + '</strong> artículos fraccionados correctamente.';
            if (nuevos > 0 || actualizados > 0) {
                mensaje = 'Se procesaron <strong>' + exitosos + '</strong> artículos fraccionados correctamente (<strong>' + nuevos + '</strong> nuevos, <strong>' + actualizados + '</strong> actualizados).';
            }
            Swal.fire({
                type: 'success',
                title: 'Importación completada',
                html: mensaje
            }).then(function () { BUSCAR(); });
        } else {
            var html = '<div style="text-align:left;">';
            html += '<p><strong>Exitosos:</strong> ' + exitosos + ' (' + nuevos + ' nuevos, ' + actualizados + ' actualizados) | <strong>Con errores:</strong> ' + errores.length + '</p>';
            html += '<div style="max-height:300px;overflow:auto;border:1px solid #ddd;border-radius:4px;">';
            html += '<table class="table table-sm table-bordered mb-0">';
            html += '<thead style="background-color:#1ab394;color:white;"><tr><th>Fila</th><th>Código</th><th>Frac.</th><th>Monto Mín.</th><th>Error</th></tr></thead>';
            html += '<tbody>';
            $.each(errores, function (i, e) {
                html += '<tr><td>' + e.Fila + '</td><td>' + e.Itemcode + '</td><td class="text-center">' + e.Fraccionado + '</td><td class="text-center">' + (e.MontoMinimo || '-') + '</td><td>' + e.Error + '</td></tr>';
            });
            html += '</tbody></table></div></div>';

            Swal.fire({
                type: 'warning',
                title: 'Importación con errores',
                html: html,
                width: 650
            }).then(function () { if (exitosos > 0) BUSCAR(); });
        }
    }

});
