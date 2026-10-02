$(document).ready(function () {

    var tblClientes = null;

    var _puedeGestionar = (function () {
        if (!window.PERMISOS_PV) return true;
        if (typeof window.PERMISOS_PV.puedeClienteBloqueadoGestionar === 'boolean') {
            return window.PERMISOS_PV.puedeClienteBloqueadoGestionar;
        }
        if (typeof window.PERMISOS_PV.PuedeClienteBloqueadoGestionar === 'boolean') {
            return window.PERMISOS_PV.PuedeClienteBloqueadoGestionar;
        }
        return true;
    })();

    if (!_puedeGestionar) {
        $('#imgmas, #btnnuevo, #btnimportar').hide();
    }

    inicializarTabla();
    registrarEventos();
    $('#txtBuscarCliente').focus();
    $('#btnexportar').prop('disabled', true);

    function inicializarTabla() {
        tblClientes = $('#tabla').DataTable({
            data: [],
            columns: [
                { data: "ID_CLIENTE_BLOQUEADO", title: "ID", width: "50px", visible: false },
                { data: "CLIENTE", title: "CLIENTE" },
                { data: "RUC", title: "RUC", width: "120px" },
                { data: "CARCODE", title: "CÓDIGO", width: "100px" },
                { data: "MOTIVO_BLOQUEO", title: "MOTIVO" },
                {
                    data: "ESTADO", title: "ESTADO", className: "text-center", width: "190px",
                    render: function (data) {
                        if (data) {
                            return '<span class="badge badge-danger" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;font-size:11px;">' +
                                   '<span style="background:#ffffff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,0.2);">' +
                                   '<img src="../img/anula4.png" style="width:12px;height:12px;" />' +
                                   '</span> CLIENTE BLOQUEADO</span>';
                        } else {
                            return '<span class="badge badge-primary" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;font-size:11px;">' +
                                   '<span style="background:#ffffff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,0.2);">' +
                                   '<img src="../img/cheque.png" style="width:12px;height:12px;" />' +
                                   '</span> CLIENTE DESBLOQUEADO</span>';
                        }
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
                            return '<img src="../img/eliminar.png" class="btnEliminar" style="width:20px;height:20px;cursor:pointer;" title="Desbloquear cliente" />';
                        } else {
                            return '<img src="../img/eliminar.png" style="width:20px;height:20px;opacity:0.3;cursor:not-allowed;" title="Cliente ya desbloqueado" />';
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

        $('#txtBuscarCliente').on('keypress', function (e) {
            if (e.which === 13) { e.preventDefault(); BUSCAR(); }
        });

        $('.btn-clear-input').on('click', function () {
            $(this).closest('.input-clear').find('input').val('').focus();
        });

        $('.btn-clear-modal-cliente').on('click', function () {
            $('#txtModalCliente').val('').focus();
            $('#txtModalNombre').val('');
            $('#txtModalRuc').val('');
        });

        $('#btnnuevo').on('click', function () {
            NUEVO();
        });

        $('#btnGuardar').on('click', function () {
            GUARDAR();
        });

        $('#tabla').on('click', '.btnEditar', function () {
            var data = tblClientes.row($(this).closest('tr')).data();
            if (data) EDITAR(data.ID_CLIENTE_BLOQUEADO);
        });

        $('#tabla').on('click', '.btnEliminar', function () {
            var data = tblClientes.row($(this).closest('tr')).data();
            if (data) ELIMINAR(data.ID_CLIENTE_BLOQUEADO, data.CLIENTE);
        });

        $('#btnexportar').on('click', function () {
            EXPORTAR();
        });

        $('#btnimportar').on('click', function () {
            abrirModalImportar();
        });

        $('#fileImportarExcel').on('change', function () {
            procesarArchivoExcel(this);
        });

        $('#ddlImportarHoja').on('change', function () {
            cargarPreviewExcel();
        });

        $('#btnCargarExcel').on('click', function () {
            importarClientesExcel();
        });

        inicializarAutocompleteClienteModal();

        $('#modalClienteBloqueado').on('hidden.bs.modal', function () {
            limpiarModal();
        });

        $('.btn-clear-modal-cliente').on('click', function () {
            _clienteSeleccionado = false;
            $('#txtModalCliente').val('').prop('disabled', false).focus();
            $('#txtModalNombre').val('');
            $('#txtModalRuc').val('');
        });

        $('#modalClienteBloqueado').on('shown.bs.modal', function () {
            var id = parseInt($('#txtIdClienteBloqueado').val()) || 0;
            if (id === 0) {
                $('#txtModalCliente').focus();
            } else {
                $('#txtModalMotivo').focus();
            }
        });
    }

    var _clienteSeleccionado = false;

    function inicializarAutocompleteClienteModal() {
        $(".autocomplete-cliente-modal").autocomplete({
            minLength: 3,
            delay: 300,
            source: function (request, response) {
                $.ajax({
                    url: '/PuntoVenta/Buscar_ClienteSap',
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
            focus: function (event, ui) { return false; },
            select: function (event, ui) {
                var c = ui.item.data;
                _clienteSeleccionado = true;
                $("#txtModalCliente").val(c.CODIGO_CLIENTE).prop('disabled', true);
                $("#txtModalNombre").val(c.CLIENTE);
                $("#txtModalRuc").val(c.RUC);
                return false;
            }
        }).on('input', function () {
            _clienteSeleccionado = false;
        });
    }

    function BUSCAR() {
        var filtro = {
            CARCODE: ($("#txtBuscarCliente").val() || "").trim(),
            ESTADO: $("#ddlEstado").val() === "" ? null : $("#ddlEstado").val() === "1"
        };

        $('body').addClass('loading');

        $.ajax({
            url: '/PuntoVenta/Buscar_ClientesBloqueados',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(filtro),
            dataType: 'json',
            success: function (data) {
                $('body').removeClass('loading');
                tblClientes.clear();
                if (data && data.length > 0) {
                    tblClientes.rows.add(data).draw();
                } else {
                    tblClientes.draw();
                }
                $('#contenedorTabla').show();
                $('#btnexportar').prop('disabled', !(data && data.length > 0));
            },
            error: function (xhr) {
                $('body').removeClass('loading');
                tblClientes.clear().draw();
                $('#contenedorTabla').hide();
                $('#btnexportar').prop('disabled', true);
                if (xhr.status !== 403 && xhr.status !== 401) {
                    Swal.fire({ type: 'error', title: 'Error', text: 'Error al buscar clientes bloqueados.' });
                }
            }
        });
    }

    function NUEVO() {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para registrar o gestionar clientes bloqueados.' });
            return;
        }
        _clienteSeleccionado = false;
        $('#txtIdClienteBloqueado').val(0);
        $('#tituloModal').html('<strong>Nuevo Cliente Bloqueado</strong>');
        $('#txtModalCliente').prop('disabled', false).val('');
        $('#txtModalNombre').val('');
        $('#txtModalRuc').val('');
        $('#txtModalMotivo').val('');
        $('#ddlModalEstado').val('true');
        $('#divModalEstado').hide();
        $('.btn-clear-modal-cliente').show();
        $('#modalClienteBloqueado').modal('show');
    }

    function EDITAR(id) {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para modificar clientes bloqueados.' });
            return;
        }
        $('body').addClass('loading');

        $.ajax({
            url: '/PuntoVenta/Obtener_ClienteBloqueado',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ ID_CLIENTE_BLOQUEADO: id }),
            dataType: 'json',
            success: function (data) {
                $('body').removeClass('loading');
                if (!data) {
                    Swal.fire({ type: 'warning', title: 'No encontrado', text: 'El registro no fue encontrado.' });
                    return;
                }
                $('#txtIdClienteBloqueado').val(data.ID_CLIENTE_BLOQUEADO);
                $('#tituloModal').html('<strong>Editar Cliente Bloqueado</strong>');
                _clienteSeleccionado = true;
                $('#txtModalCliente').val(data.CARCODE).prop('disabled', true);
                $('#txtModalNombre').val(data.CLIENTE || '');
                $('#txtModalRuc').val(data.RUC || '');
                $('#txtModalMotivo').val(data.MOTIVO_BLOQUEO || '');
                $('#ddlModalEstado').val(data.ESTADO ? 'true' : 'false');
                $('#divModalEstado').show();
                $('.btn-clear-modal-cliente').hide();

                if (!data.ESTADO) {
                    $('#txtModalMotivo').prop('readonly', true);
                    $('#ddlModalEstado').prop('disabled', true);
                    $('#btnGuardar').prop('disabled', true);
                } else {
                    $('#txtModalMotivo').prop('readonly', false);
                    $('#ddlModalEstado').prop('disabled', false);
                    $('#btnGuardar').prop('disabled', false);
                }

                $('#modalClienteBloqueado').modal('show');
            },
            error: function (xhr) {
                $('body').removeClass('loading');
                Swal.fire({ type: 'error', title: 'Error', text: 'Error al obtener el registro.' });
            }
        });
    }

    function GUARDAR() {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para registrar o modificar clientes bloqueados.' });
            return;
        }
        var id = parseInt($('#txtIdClienteBloqueado').val()) || 0;
        var carcode = ($('#txtModalCliente').val() || '').trim();
        var motivo = ($('#txtModalMotivo').val() || '').trim();
        var estado = $('#ddlModalEstado').val() === 'true';

        if (!carcode || !_clienteSeleccionado) {
            Swal.fire({ type: 'warning', title: 'Datos incompletos', text: 'Debe seleccionar un cliente del listado SAP.' });
            return;
        }
        if (!motivo) {
            Swal.fire({ type: 'warning', title: 'Datos incompletos', text: 'Debe ingresar el motivo del bloqueo.' });
            return;
        }

        var dto = {
            ID_CLIENTE_BLOQUEADO: id,
            CARCODE: carcode,
            MOTIVO_BLOQUEO: motivo,
            ESTADO: id === 0 ? true : estado
        };

        var url = id === 0
            ? '/PuntoVenta/Insertar_ClienteBloqueado'
            : '/PuntoVenta/Actualizar_ClienteBloqueado';

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
                            $('#modalClienteBloqueado').modal('hide');
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
                var tipo = (xhr.status === 400 || xhr.status === 403) ? 'warning' : 'error';
                var titulo = xhr.status === 403 ? 'Acceso Denegado' : (xhr.status === 400 ? 'Atención' : 'Error');
                Swal.fire({ type: tipo, title: titulo, text: msg }).then(function () {
                    if (xhr.status === 403) {
                        $('#modalClienteBloqueado').modal('hide');
                        window.location.reload();
                    }
                });
            }
        });
    }

    function ELIMINAR(id, nombre) {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para desbloquear clientes.' });
            return;
        }
        Swal.fire({
            title: '¿Desbloquear cliente?',
            text: 'Se cambiará el estado del cliente "' + (nombre || '') + '" a desbloqueado.',
            type: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, desbloquear',
            cancelButtonText: 'Cancelar'
        }).then(function (result) {
            if (!result.value) return;

            $('body').addClass('loading');

            $.ajax({
                url: '/PuntoVenta/Eliminar_ClienteBloqueado',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ ID_CLIENTE_BLOQUEADO: id }),
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
                    var tipo = (xhr.status === 400 || xhr.status === 403) ? 'warning' : 'error';
                    var titulo = xhr.status === 403 ? 'Acceso Denegado' : (xhr.status === 400 ? 'Atención' : 'Error');
                    Swal.fire({ type: tipo, title: titulo, text: msg }).then(function () {
                        if (xhr.status === 403) {
                            window.location.reload();
                        }
                    });
                }
            });
        });
    }

    function EXPORTAR() {
        if (!tblClientes || tblClientes.rows().count() === 0) {
            Swal.fire({ type: 'warning', title: 'Sin datos', text: 'No hay datos para exportar. Realice una búsqueda primero.' });
            return;
        }

        var filtro = {
            CARCODE: ($("#txtBuscarCliente").val() || "").trim(),
            ESTADO: $("#ddlEstado").val() === "" ? null : $("#ddlEstado").val() === "1"
        };

        $('body').addClass('loading');

        $.ajax({
            url: '/PuntoVenta/Exportar_ClientesBloqueados',
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
                    a.download = 'Clientes_Bloqueados.xlsx';
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

    function limpiarModal() {
        _clienteSeleccionado = false;
        $('#txtIdClienteBloqueado').val(0);
        $('#txtModalCliente').val('').prop('disabled', false);
        $('#txtModalNombre').val('');
        $('#txtModalRuc').val('');
        $('#txtModalMotivo').val('').prop('readonly', false);
        $('#ddlModalEstado').val('true').prop('disabled', false);
        $('#divModalEstado').hide();
        $('#btnGuardar').prop('disabled', false);
        $('.btn-clear-modal-cliente').show();
    }

    // ========== IMPORTAR DESDE EXCEL ==========

    var _workbookExcel = null;
    var _datosExcel = [];

    function abrirModalImportar() {
        if (!_puedeGestionar) {
            Swal.fire({ type: 'warning', title: 'Acceso Denegado', text: 'No cuenta con permisos para importar clientes bloqueados.' });
            return;
        }
        _workbookExcel = null;
        _datosExcel = [];
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

        var sheet = _workbookExcel.Sheets[nombreHoja];
        var json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        _datosExcel = [];
        var $tbody = $('#tblVistaPreviaExcel tbody').empty();
        var totalConRuc = 0;

        for (var i = 1; i < json.length; i++) {
            var fila = json[i];
            var ruc = (fila[0] || '').toString().trim();
            var nombre = (fila[1] || '').toString().trim();
            var motivo = (fila[2] || '').toString().trim();

            if (!ruc) continue;

            totalConRuc++;

            if (ruc && motivo) {
                _datosExcel.push({ ruc: ruc, nombre: nombre, motivo: motivo, fila: i + 1 });
            }

            var esValido = motivo.length > 0;
            var badge = esValido
                ? '<span class="text-success font-weight-bold">Sí</span>'
                : '<span class="text-danger font-weight-bold">No</span>';

            $tbody.append(
                '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + ruc + '</td>' +
                '<td>' + motivo + '</td>' +
                '<td class="text-center">' + badge + '</td>' +
                '</tr>'
            );
        }

        $('#lblTotalFilasExcel').text('Filas válidas: ' + _datosExcel.length + ' de ' + totalConRuc + ' filas con RUC');
        $('#divVistaPrevia').show();
    }

    function importarClientesExcel() {
        if (_datosExcel.length === 0) {
            Swal.fire({ type: 'warning', title: 'Sin datos', text: 'No hay filas válidas para importar. Verifique que el archivo tenga RUC y Motivo.' });
            return;
        }

        $('#modalImportarExcel').modal('hide');
        Swal.fire({ title: 'Importando clientes...', html: 'Procesando registros...', allowOutsideClick: false, onOpen: function () { Swal.showLoading(); } });

        $.ajax({
            url: '/PuntoVenta/Importar_ClientesBloqueados',
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
                var msg = 'Error al importar clientes bloqueados.';
                if (xhr.responseJSON && xhr.responseJSON.error) msg = xhr.responseJSON.error;
                var tipo = (xhr.status === 400 || xhr.status === 403) ? 'warning' : 'error';
                var titulo = xhr.status === 403 ? 'Acceso Denegado' : (xhr.status === 400 ? 'Atención' : 'Error');
                Swal.fire({ type: tipo, title: titulo, text: msg }).then(function () {
                    if (xhr.status === 403) {
                        window.location.reload();
                    }
                });
            }
        });
    }

    function mostrarResumenImportacion(resultado) {
        var exitosos = resultado.Exitosos || 0;
        var errores = resultado.Errores || [];

        if (errores.length === 0) {
            Swal.fire({
                type: 'success',
                title: 'Importación completada',
                html: 'Se importaron <strong>' + exitosos + '</strong> clientes bloqueados correctamente.'
            }).then(function () { BUSCAR(); });
        } else {
            var html = '<div style="text-align:left;">';
            html += '<p><strong>Importados:</strong> ' + exitosos + ' | <strong>Con errores:</strong> ' + errores.length + '</p>';
            html += '<div style="max-height:300px;overflow:auto;border:1px solid #ddd;border-radius:4px;">';
            html += '<table class="table table-sm table-bordered mb-0">';
            html += '<thead style="background-color:#1ab394;color:white;"><tr><th>Fila</th><th>RUC</th><th>Error</th></tr></thead>';
            html += '<tbody>';
            $.each(errores, function (i, e) {
                html += '<tr><td>' + e.Fila + '</td><td>' + e.Ruc + '</td><td>' + e.Error + '</td></tr>';
            });
            html += '</tbody></table></div></div>';

            Swal.fire({
                type: 'warning',
                title: 'Importación con errores',
                html: html,
                width: 600
            }).then(function () { if (exitosos > 0) BUSCAR(); });
        }
    }

});
