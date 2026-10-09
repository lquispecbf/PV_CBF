$(document).ready(function () {
    var _tabla = null;
    var _tablaRoles = null;
    var _roles = [];
    var _usuarioActualId = 0;
    var _matrizActual = null;
    var _moduloFiltroActivo = "TODOS";
    var _moduloFiltroActivoRol = "TODOS";
    var _rolEditandoId = 0;
    var _plantillasRolesDinamicas = {};

    // Metadatos y estilos temáticos por módulo (con fallback automático para nuevos módulos)
    var MODULOS_INFO = {
        "VENTA": {
            titulo: "Ventas y Pedidos",
            icono: "fa-shopping-cart",
            color: "text-navy",
            badgeBg: "badge-primary",
            descripcion: "Operaciones de caja, consulta, reapertura, anulación y envío a WMS."
        },
        "CLIENTE_BLOQUEADO": {
            titulo: "Clientes Bloqueados",
            icono: "fa-user-slash",
            color: "text-danger",
            badgeBg: "badge-danger",
            descripcion: "Consulta y gestión de restricciones comerciales para clientes."
        },
        "ARTICULO_FRACCIONADO": {
            titulo: "Artículos Fraccionados",
            icono: "fa-pills",
            color: "text-warning",
            badgeBg: "badge-warning",
            descripcion: "Configuración y consulta de reglas de fraccionamiento de productos."
        },
        "STOCK_ALMACEN": {
            titulo: "Stock y Reportes",
            icono: "fa-boxes",
            color: "text-info",
            badgeBg: "badge-info",
            descripcion: "Existencias físicas por almacén y exportación de reportes."
        }
    };

    var PLANTILLAS_ROLES = {
        "SOLO_CONSULTA_PV": [
            "VENTA.VER",
            "CLIENTE_BLOQUEADO.VER",
            "ARTICULO_FRACCIONADO.VER",
            "STOCK_ALMACEN.VER",
            "STOCK_ALMACEN.EXPORTAR"
        ],
        "VENDEDOR_PV": [
            "VENTA.VER",
            "VENTA.CREAR",
            "VENTA.GUARDAR_BORRADOR",
            "VENTA.ANULAR",
            "VENTA.ENVIAR_WMS",
            "VENTA.REABRIR",
            "VENTA.IMPRIMIR",
            "VENTA.EXPORTAR_EXCEL",
            "CLIENTE_BLOQUEADO.VER",
            "ARTICULO_FRACCIONADO.VER",
            "STOCK_ALMACEN.VER",
            "STOCK_ALMACEN.EXPORTAR"
        ],
        "SUPERVISOR_PV": [
            "VENTA.VER",
            "VENTA.CREAR",
            "VENTA.GUARDAR_BORRADOR",
            "VENTA.ANULAR",
            "VENTA.ANULAR_ENVIADO_WMS",
            "VENTA.ENVIAR_WMS",
            "VENTA.REABRIR",
            "VENTA.MODIFICAR_COND_PAGO",
            "VENTA.MODIFICAR_COND_PAGO_COBRANZA",
            "VENTA.MANTENER_SESION",
            "VENTA.IMPRIMIR",
            "VENTA.EXPORTAR_EXCEL",
            "CLIENTE_BLOQUEADO.VER",
            "ARTICULO_FRACCIONADO.VER",
            "STOCK_ALMACEN.VER",
            "STOCK_ALMACEN.EXPORTAR"
        ],
        "ADMINISTRADOR_PV": [
            "VENTA.VER",
            "VENTA.CREAR",
            "VENTA.GUARDAR_BORRADOR",
            "VENTA.ANULAR",
            "VENTA.ANULAR_ENVIADO_WMS",
            "VENTA.ENVIAR_WMS",
            "VENTA.REABRIR",
            "VENTA.MODIFICAR_COND_PAGO",
            "VENTA.MODIFICAR_COND_PAGO_COBRANZA",
            "VENTA.MANTENER_SESION",
            "VENTA.IMPRIMIR",
            "VENTA.EXPORTAR_EXCEL",
            "CLIENTE_BLOQUEADO.VER",
            "CLIENTE_BLOQUEADO.GESTIONAR",
            "ARTICULO_FRACCIONADO.VER",
            "ARTICULO_FRACCIONADO.GESTIONAR",
            "STOCK_ALMACEN.VER",
            "STOCK_ALMACEN.EXPORTAR"
        ]
    };

    inicializar();

    function inicializar() {
        inicializarDataTable();
        inicializarDataTableRoles();
        cargarRoles();
        cargarPlantillasDinamicas();
        registrarEventos();
        BUSCAR(); // Búsqueda inicial automática de usuarios
    }

    function cargarPlantillasDinamicas() {
        $.ajax({
            url: "/Permisos/ListarPlantillasRoles",
            type: "GET",
            dataType: "json",
            success: function (data) {
                if (data && data.length > 0) {
                    _plantillasRolesDinamicas = {};
                    $.each(data, function (i, p) {
                        _plantillasRolesDinamicas[p.CodigoRol] = p.Acciones || [];
                        PLANTILLAS_ROLES[p.CodigoRol] = p.Acciones || [];
                    });
                }
            },
            error: function () {
                console.warn("No se pudieron cargar las plantillas dinámicas de roles. Usando plantillas base.");
            }
        });
    }

    function cargarRoles() {
        $.ajax({
            url: "/Permisos/ListarRoles",
            type: "GET",
            dataType: "json",
            success: function (data) {
                _roles = data || [];

                // Poblar filtro superior
                var $filtro = $("#ddlFiltroRolPv");
                $filtro.empty().append('<option value="">-- Todos los Roles --</option>');

                // Poblar selector del modal de usuario
                var $ddlModal = $("#ddlModalRolPv");
                $ddlModal.empty().append('<option value="">-- Seleccionar Rol PVD --</option>');

                // Poblar botones de plantillas rápidas
                var $btnGroup = $("#btnGroupPlantillas");
                $btnGroup.empty();

                $.each(_roles, function (i, r) {
                    var esActivo = (r.Estado === "A" || r.Activo === true);
                    if (esActivo) {
                        $filtro.append('<option value="' + r.IdRolPv + '">' + escapeHtml(r.NombreRol) + '</option>');
                        $ddlModal.append('<option value="' + r.IdRolPv + '" data-codigo="' + r.CodigoRol + '">' + escapeHtml(r.NombreRol) + '</option>');

                        // Iconos para cada rol
                        var iconClass = "fa-tag";
                        if (r.CodigoRol === "SOLO_CONSULTA_PV") { iconClass = "fa-eye"; }
                        else if (r.CodigoRol === "VENDEDOR_PV") { iconClass = "fa-shopping-cart"; }
                        else if (r.CodigoRol === "SUPERVISOR_PV") { iconClass = "fa-user-tie"; }
                        else if (r.CodigoRol === "ADMINISTRADOR_PV") { iconClass = "fa-star"; }

                        $btnGroup.append(
                            '<button type="button" class="btn btn-preset-rol mr-1 mb-1 btn-plantilla-rapida" data-rol="' + r.CodigoRol + '" data-id="' + r.IdRolPv + '" title="' + escapeHtml(r.Descripcion || r.NombreRol) + '">' +
                            '<i class="fa ' + iconClass + ' mr-1"></i> ' + escapeHtml(r.NombreRol) +
                            '</button>'
                        );
                    }
                });

                // Botones de acciones masivas
                $btnGroup.append(
                    '<button type="button" class="btn btn-outline-secondary btn-preset-rol mr-1 mb-1" id="btnMarcarTodasAcciones" title="Marcar todas las acciones">' +
                    '<i class="fa fa-check-double text-navy mr-1"></i> Todos' +
                    '</button>' +
                    '<button type="button" class="btn btn-outline-secondary btn-preset-rol mr-1 mb-1" id="btnDesmarcarTodasAcciones" title="Desmarcar todas las acciones">' +
                    '<i class="fa fa-ban text-danger mr-1"></i> Ninguno' +
                    '</button>'
                );

                // Refrescar tabla de roles
                if (_tablaRoles) {
                    _tablaRoles.clear();
                    _tablaRoles.rows.add(_roles).draw();
                }
            },
            error: function () {
                console.error("Error al cargar roles de PVD");
            }
        });
    }

    function inicializarDataTable() {
        _tabla = $('#tablaUsuarios').DataTable({
            data: [],
            responsive: true,
            processing: false,
            serverSide: false,
            searching: true,
            ordering: true,
            pageLength: 15,
            lengthMenu: [[10, 15, 25, 50, -1], [10, 15, 25, 50, "Todos"]],
            language: {
                lengthMenu: "Mostrar _MENU_ registros por página",
                zeroRecords: "No se encontraron usuarios coincidentes",
                info: "Mostrando _START_ a _END_ de _TOTAL_ usuarios",
                infoEmpty: "Mostrando 0 a 0 de 0 usuarios",
                infoFiltered: "(filtrado de _MAX_ usuarios en total)",
                search: "Filtrar en tabla:",
                paginate: {
                    first: "Primero",
                    last: "Último",
                    next: "Siguiente",
                    previous: "Anterior"
                },
                loadingRecords: "Cargando usuarios...",
                processing: "Procesando..."
            },
            columns: [
                {
                    data: null,
                    className: "text-center align-middle",
                    orderable: false,
                    render: function (data, type, row, meta) {
                        return meta.row + 1;
                    }
                },
                {
                    data: "UsuarioLogin",
                    className: "align-middle font-bold",
                    render: function (data) {
                        return '<i class="fa fa-user text-muted mr-1"></i> ' + escapeHtml(data);
                    }
                },
                {
                    data: "NombreCompleto",
                    className: "align-middle",
                    render: function (data) {
                        return escapeHtml(data);
                    }
                },
                {
                    data: "PerfilIntranet",
                    className: "align-middle",
                    render: function (data) {
                        var perfil = (data || "").trim();
                        if (perfil.toUpperCase() === "B") {
                            perfil = "";
                        }
                        return perfil ? '<span class="badge badge-secondary" style="font-size:0.75rem;">' + escapeHtml(perfil) + '</span>' : '';
                    }
                },
                {
                    data: "NombreRolPv",
                    className: "align-middle",
                    render: function (data, type, row) {
                        var badgeClass = "badge-info";
                        if (row.CodigoRolPv === "ADMINISTRADOR_PV") badgeClass = "badge-primary";
                        else if (row.CodigoRolPv === "SUPERVISOR_PV") badgeClass = "badge-warning";
                        else if (row.CodigoRolPv === "SOLO_CONSULTA_PV") badgeClass = "badge-secondary";

                        return '<span class="badge ' + badgeClass + ' badge-pvd-rol">' + escapeHtml(data || "Vendedor") + '</span>';
                    }
                },
                {
                    data: "TieneAccesoIntranetPv",
                    className: "text-center align-middle",
                    render: function (data) {
                        if (data === true || data === 1 || String(data) === "true") {
                            return '<span class="badge badge-success" title="Tiene menú de Punto de Venta activo en Intranet"><i class="fa fa-check-circle"></i> Habilitado</span>';
                        } else {
                            return '<span class="badge badge-danger" title="Sin menú de Punto de Venta en Intranet"><i class="fa fa-times-circle"></i> Inactivo</span>';
                        }
                    }
                },
                {
                    data: null,
                    className: "text-center align-middle",
                    orderable: false,
                    render: function (data, type, row) {
                        return '<img src="../img/editar_2.png" class="btnEditar btn-editar-permisos" data-id="' + row.IdUsuario + '" style="width:20px;height:20px;cursor:pointer;" title="Editar Permisos y Rol PVD" />';
                    }
                }
            ]
        });
    }

    function BUSCAR() {
        var busqueda = ($("#txtBuscarUsuario").val() || "").trim();
        var idRol = parseInt($("#ddlFiltroRolPv").val()) || 0;

        $('body').addClass('loading');

        $.ajax({
            url: "/Permisos/ListarUsuarios",
            type: "GET",
            data: { busqueda: busqueda },
            dataType: "json",
            success: function (data) {
                $('body').removeClass('loading');
                var lista = data || [];
                if (idRol > 0) {
                    lista = lista.filter(function (u) {
                        return u.IdRolPv === idRol;
                    });
                }
                _tabla.clear();
                if (lista.length > 0) {
                    _tabla.rows.add(lista).draw();
                } else {
                    _tabla.draw();
                }
            },
            error: function () {
                $('body').removeClass('loading');
                swal("Error", "Error al consultar usuarios.", "error");
            }
        });
    }

    function abrirModalEdicion(idUsuario) {
        _usuarioActualId = idUsuario;
        $('body').addClass('loading');

        $.ajax({
            url: "/Permisos/ObtenerMatriz",
            type: "GET",
            data: { idUsuario: idUsuario },
            dataType: "json",
            success: function (data) {
                $('body').removeClass('loading');
                if (!data) {
                    swal("Aviso", "No se encontraron datos de configuración para el usuario.", "warning");
                    return;
                }

                _matrizActual = data;
                poblarModal(data);
                $('#modalEditarPermisos').modal('show');
            },
            error: function (xhr) {
                $('body').removeClass('loading');
                var msg = xhr.responseJSON ? xhr.responseJSON.error : xhr.statusText;
                swal("Error", "No se pudo cargar la matriz de permisos: " + msg, "error");
            }
        });
    }

    function poblarModal(data) {
        $("#txtModalIdUsuario").val(data.IdUsuario || 0);
        $("#lblModalNombreCompleto").text(data.NombreCompleto || "");
        $("#lblModalUsuario").text(data.UsuarioLogin || "");

        var perfil = (data.PerfilIntranet || "").trim();
        if (perfil.toUpperCase() === "B") {
            perfil = "";
        }
        if (perfil) {
            $("#lblModalPerfilIntranet").text(perfil).show();
            $("#lblModalPerfilIntranet").closest("span").show();
        } else {
            $("#lblModalPerfilIntranet").text("").hide();
            $("#lblModalPerfilIntranet").closest("span").hide();
        }

        // Generar Iniciales Avatar
        var nombre = (data.NombreCompleto || data.UsuarioLogin || "U").trim();
        var partes = nombre.split(" ");
        var iniciales = partes.length >= 2 ? (partes[0].charAt(0) + partes[1].charAt(0)) : nombre.substring(0, 2);
        $("#lblModalAvatar").text(iniciales.toUpperCase());

        // Seleccionar Rol PVD
        if (data.IdRolPvActual > 0) {
            $("#ddlModalRolPv").val(data.IdRolPvActual);
        } else {
            var rolVendedor = _roles.find(function (r) { return r.CodigoRol === "VENDEDOR_PV"; });
            if (rolVendedor) $("#ddlModalRolPv").val(rolVendedor.IdRolPv);
        }

        // Actualizar botón de preset activo
        actualizarBotonPresetActivo();

        // Agrupar acciones por CodigoModulo
        var modulosMap = {};
        $.each(data.Acciones || [], function (i, acc) {
            var mod = acc.CodigoModulo || "GENERAL";
            if (!modulosMap[mod]) {
                modulosMap[mod] = [];
            }
            modulosMap[mod].push(acc);
        });

        var modKeys = Object.keys(modulosMap);
        var $pills = $("#pillsModulosPermisos");
        var $contenedor = $("#contenedorModulosAcciones");
        $pills.empty();
        $contenedor.empty();

        if (modKeys.length === 0) {
            $contenedor.html(
                '<div class="alert alert-warning py-4 text-center my-3 border">' +
                '<i class="fa fa-exclamation-triangle fa-2x mb-2 text-warning"></i><br/>' +
                '<h5 class="font-bold text-dark mb-1">Sin Módulos de Punto de Venta Asignados en la Intranet</h5>' +
                '<p class="text-muted small mb-0">Este usuario no tiene ningún check activo en el menú de Punto de Venta en la administración de la Intranet.<br/>Debe concederle acceso a los menús correspondientes (Venta, Clientes Bloqueados, Artículos Fraccionados o Stock) para configurar sus permisos granulares.</p>' +
                '</div>'
            );
            $("#btnGuardarPermisos, #btnGuardarPermisosModal").prop("disabled", true);
            actualizarMedidorProgreso();
            return;
        }

        $("#btnGuardarPermisos, #btnGuardarPermisosModal").prop("disabled", false);

        if (modKeys.length > 1) {
            $pills.append(
                '<li class="nav-item">' +
                '<a class="nav-link active btn-tab-modulo" href="javascript:void(0);" data-modulo="TODOS">' +
                '<i class="fa fa-th-large mr-1"></i> Todos los Módulos' +
                '</a>' +
                '</li>'
            );
        }

        $.each(modKeys, function (i, codMod) {
            var info = MODULOS_INFO[codMod] || {
                titulo: codMod.replace(/_/g, ' '),
                icono: "fa-folder",
                color: "text-navy"
            };
            var totalMod = modulosMap[codMod].length;
            var isActive = (modKeys.length === 1 && i === 0) || (modKeys.length > 1 && i === -1);

            $pills.append(
                '<li class="nav-item">' +
                '<a class="nav-link ' + (isActive ? 'active' : '') + ' btn-tab-modulo" href="javascript:void(0);" data-modulo="' + codMod + '">' +
                '<i class="fa ' + info.icono + ' mr-1"></i> ' + escapeHtml(info.titulo) +
                ' <span class="badge badge-light border ml-1 stat-badge-tab" data-modulo-stat="' + codMod + '">0/' + totalMod + '</span>' +
                '</a>' +
                '</li>'
            );
        });

        _moduloFiltroActivo = modKeys.length === 1 ? modKeys[0] : "TODOS";
        $("#txtFiltroAccionesModal").val("");

        // Renderizar secciones de módulos y tarjetas de acción
        $.each(modulosMap, function (codModulo, acciones) {
            var info = MODULOS_INFO[codModulo] || {
                titulo: codModulo.replace(/_/g, ' '),
                icono: "fa-folder",
                color: "text-navy",
                descripcion: "Acciones del módulo " + codModulo
            };

            var moduloSectionHtml =
                '<div class="modulo-section card border mb-3 shadow-none bg-white" data-modulo="' + codModulo + '">' +
                '<div class="card-header py-2 px-3 bg-light d-flex justify-content-between align-items-center flex-wrap">' +
                '<div class="d-flex align-items-center mb-1 mb-md-0">' +
                '<span class="mr-2 ' + info.color + '" style="font-size:1.15rem;"><i class="fa ' + info.icono + '"></i></span>' +
                '<div>' +
                '<h5 class="mb-0 font-bold text-dark" style="font-size:0.95rem;">' + escapeHtml(info.titulo) + '</h5>' +
                '<small class="text-muted">' + escapeHtml(info.descripcion) + '</small>' +
                '</div>' +
                '</div>' +
                '<div class="d-flex align-items-center gap-1">' +
                '<span class="badge badge-secondary mr-2 stat-modulo-header" data-modulo-header-stat="' + codModulo + '">0/' + acciones.length + ' activos</span>' +
                '<button type="button" class="btn btn-xs btn-outline-primary btn-marcar-modulo mr-1" data-modulo="' + codModulo + '" title="Habilitar todas las acciones de este módulo"><i class="fa fa-check"></i> Marcar Todo</button>' +
                '<button type="button" class="btn btn-xs btn-outline-secondary btn-desmarcar-modulo" data-modulo="' + codModulo + '" title="Deshabilitar todas las acciones de este módulo"><i class="fa fa-times"></i> Desmarcar</button>' +
                '</div>' +
                '</div>' +
                '<div class="card-body p-3">' +
                '<div class="row g-2" id="gridAcciones_' + codModulo + '"></div>' +
                '</div>' +
                '</div>';

            $contenedor.append(moduloSectionHtml);
            var $grid = $("#gridAcciones_" + codModulo);

            $.each(acciones, function (j, acc) {
                var isPermitido = (acc.PermitidoFinal === true || acc.PermitidoFinal === 1 || String(acc.PermitidoFinal).toLowerCase() === "true" || String(acc.PermitidoFinal) === "1");
                var checkedAttr = isPermitido ? "checked" : "";
                var isOverride = (acc.TieneOverride === true || acc.TieneOverride === 1 || String(acc.TieneOverride).toLowerCase() === "true" || String(acc.TieneOverride) === "1");
                var overrideBadge = isOverride ? ' <span class="badge badge-warning ml-1" style="font-size:0.68rem;" title="Configuración personalizada para este usuario">Excepción</span>' : "";

                var cardHtml =
                    '<div class="col-12 col-md-6 col-xl-4 mb-2 item-accion-col" data-modulo="' + codModulo + '" data-busqueda="' + (acc.NombreAccion + ' ' + acc.CodigoAccion + ' ' + (acc.Descripcion || '')).toLowerCase() + '">' +
                    '<div class="action-card ' + (isPermitido ? 'activo' : '') + '">' +
                    '<div>' +
                    '<div class="d-flex justify-content-between align-items-start mb-1">' +
                    '<div class="custom-control custom-switch pr-2">' +
                    '<input type="checkbox" class="custom-control-input chk-modal-accion" id="chkModalAcc_' + acc.IdAccion + '" data-codigo="' + acc.CodigoAccion + '" data-modulo="' + codModulo + '" ' + checkedAttr + ' />' +
                    '<label class="custom-control-label font-bold text-dark" for="chkModalAcc_' + acc.IdAccion + '">' +
                    escapeHtml(acc.NombreAccion) +
                    '</label>' +
                    '</div>' +
                    overrideBadge +
                    '</div>' +
                    (acc.Descripcion ? '<p class="text-muted small mb-2" style="font-size:0.78rem; line-height:1.3;">' + escapeHtml(acc.Descripcion) + '</p>' : '') +
                    '</div>' +
                    '<div class="mt-auto pt-1 d-flex justify-content-between align-items-center border-top">' +
                    '<span class="codigo-accion-tag">' + escapeHtml(acc.CodigoAccion) + '</span>' +
                    '<small class="text-muted font-italic status-text" style="font-size:0.72rem;">' + (isPermitido ? 'Permitido' : 'Restringido') + '</small>' +
                    '</div>' +
                    '</div>' +
                    '</div>';

                $grid.append(cardHtml);
            });
        });

        // Actualizar estadísticas y medidores en tiempo real
        actualizarMedidorProgreso();
    }

    function actualizarMedidorProgreso() {
        var $todas = $(".chk-modal-accion");
        var total = $todas.length;
        var activas = $todas.filter(":checked").length;
        var porcentaje = total > 0 ? Math.round((activas / total) * 100) : 0;

        $("#lblConteoActivas").text(activas);
        $("#lblConteoTotales").text(total);
        $("#lblPorcentajeActivas").text(porcentaje + "%");
        $("#progressBarPermisos").css("width", porcentaje + "%").attr("aria-valuenow", porcentaje);

        if (porcentaje >= 80) {
            $("#progressBarPermisos").css("background-color", "#1ab394");
        } else if (porcentaje >= 40) {
            $("#progressBarPermisos").css("background-color", "#f8ac59");
        } else {
            $("#progressBarPermisos").css("background-color", "#ed5565");
        }

        // Actualizar contadores por módulo
        $(".modulo-section").each(function () {
            var mod = $(this).data("modulo");
            var $modAcc = $(this).find(".chk-modal-accion");
            var modTot = $modAcc.length;
            var modAct = $modAcc.filter(":checked").length;

            $("[data-modulo-header-stat='" + mod + "']").text(modAct + "/" + modTot + " activos");
            $("[data-modulo-stat='" + mod + "']").text(modAct + "/" + modTot);

            if (modAct === modTot && modTot > 0) {
                $("[data-modulo-stat='" + mod + "']").removeClass("border-secondary").addClass("badge-primary text-white").css("background-color", "#1ab394");
            } else {
                $("[data-modulo-stat='" + mod + "']").removeClass("badge-primary text-white").addClass("badge-light").css("background-color", "");
            }
        });
    }

    function actualizarBotonPresetActivo() {
        var selectedId = parseInt($("#ddlModalRolPv").val()) || 0;
        var rol = _roles.find(function (r) { return r.IdRolPv === selectedId; });
        var codigoRol = rol ? rol.CodigoRol : "";

        var coincide = false;
        if (codigoRol && PLANTILLAS_ROLES[codigoRol]) {
            var plantilla = PLANTILLAS_ROLES[codigoRol];
            var activas = [];
            $(".chk-modal-accion:checked").each(function () {
                var cod = $(this).data("codigo");
                if (cod) activas.push(cod);
            });
            var todasVisibles = [];
            $(".chk-modal-accion").each(function () {
                var cod = $(this).data("codigo");
                if (cod) todasVisibles.push(cod);
            });

            var diff = false;
            for (var k = 0; k < todasVisibles.length; k++) {
                var c = todasVisibles[k];
                var enPlantilla = plantilla.indexOf(c) !== -1;
                var estaActiva = activas.indexOf(c) !== -1;
                if (enPlantilla !== estaActiva) {
                    diff = true;
                    break;
                }
            }
            coincide = !diff;
        }

        $(".btn-plantilla-rapida").removeClass("active");
        if (codigoRol && coincide) {
            $('.btn-plantilla-rapida[data-rol="' + codigoRol + '"]').addClass("active");
        }
    }

    function detectarYActualizarRolModal() {
        var activas = [];
        $(".chk-modal-accion:checked").each(function () {
            var cod = $(this).data("codigo");
            if (cod) activas.push(cod);
        });

        var todasVisibles = [];
        $(".chk-modal-accion").each(function () {
            var cod = $(this).data("codigo");
            if (cod) todasVisibles.push(cod);
        });

        var rolCoincidente = null;
        for (var codRol in PLANTILLAS_ROLES) {
            var plantilla = PLANTILLAS_ROLES[codRol];
            var diff = false;
            for (var k = 0; k < todasVisibles.length; k++) {
                var c = todasVisibles[k];
                var enPlantilla = plantilla.indexOf(c) !== -1;
                var estaActiva = activas.indexOf(c) !== -1;
                if (enPlantilla !== estaActiva) {
                    diff = true;
                    break;
                }
            }
            if (!diff) {
                rolCoincidente = codRol;
                break;
            }
        }

        if (rolCoincidente) {
            var rMatch = _roles.find(function (r) { return r.CodigoRol === rolCoincidente; });
            if (rMatch) {
                $("#ddlModalRolPv").val(rMatch.IdRolPv);
            }
        } else {
            var rPers = _roles.find(function (r) { return r.CodigoRol === "PERSONALIZADO_PV"; });
            if (rPers) {
                $("#ddlModalRolPv").val(rPers.IdRolPv);
            }
        }
        actualizarBotonPresetActivo();
    }

    function aplicarPlantilla(codigoRol) {
        var listaPermitidas = PLANTILLAS_ROLES[codigoRol] || [];
        $(".chk-modal-accion").each(function () {
            var cod = $(this).data("codigo");
            var debeEstarChequeado = listaPermitidas.indexOf(cod) !== -1;
            $(this).prop("checked", debeEstarChequeado);
            var $card = $(this).closest(".action-card");
            $card.toggleClass("activo", debeEstarChequeado);
            $card.find(".status-text").text(debeEstarChequeado ? "Permitido" : "Restringido");
        });

        var rolMatch = _roles.find(function (r) { return r.CodigoRol === codigoRol; });
        if (rolMatch) {
            $("#ddlModalRolPv").val(rolMatch.IdRolPv);
        }

        actualizarBotonPresetActivo();
        actualizarMedidorProgreso();
    }

    function filtrarAccionesModal() {
        var texto = ($("#txtFiltroAccionesModal").val() || "").toLowerCase().trim();

        $(".modulo-section").each(function () {
            var codMod = $(this).data("modulo");
            var moduloVisible = (_moduloFiltroActivo === "TODOS" || _moduloFiltroActivo === codMod);

            if (!moduloVisible) {
                $(this).hide();
                return;
            }

            var itemsVisiblesEnModulo = 0;
            $(this).find(".item-accion-col").each(function () {
                var searchData = $(this).data("busqueda") || "";
                var match = (!texto || searchData.indexOf(texto) !== -1);
                $(this).toggle(match);
                if (match) itemsVisiblesEnModulo++;
            });

            $(this).toggle(itemsVisiblesEnModulo > 0 || !texto);
        });
    }

    function guardarPermisosModal() {
        if (!_usuarioActualId) {
            swal("Aviso", "No hay un usuario seleccionado.", "warning");
            return;
        }

        var idRolPv = parseInt($("#ddlModalRolPv").val()) || 0;
        if (idRolPv <= 0) {
            swal("Atención", "Debe seleccionar un Rol de Punto de Venta para el usuario.", "warning");
            return;
        }

        var accionesSeleccionadas = [];
        $(".chk-modal-accion:checked").each(function () {
            var cod = $(this).data("codigo");
            if (cod) accionesSeleccionadas.push(cod);
        });

        // Garantizar que si hay cualquier acción operativa de un módulo, su *.VER esté presente
        var modulosConAccion = {};
        $.each(accionesSeleccionadas, function (i, acc) {
            var partes = acc.split(".");
            if (partes.length === 2) {
                modulosConAccion[partes[0]] = true;
            }
        });
        for (var mod in modulosConAccion) {
            var verAcc = mod + ".VER";
            if (accionesSeleccionadas.indexOf(verAcc) === -1) {
                accionesSeleccionadas.push(verAcc);
            }
        }

        var requestData = {
            IdUsuario: _usuarioActualId,
            IdRolPv: idRolPv,
            AccionesPermitidas: accionesSeleccionadas
        };

        swal({
            title: "¿Guardar configuración de permisos?",
            text: "Se actualizará el Rol PVD y las " + accionesSeleccionadas.length + " acciones permitidas para el usuario.",
            type: "question",
            showCancelButton: true,
            confirmButtonColor: "#1ab394",
            cancelButtonColor: "#d9d9d9",
            confirmButtonText: "Sí, guardar",
            cancelButtonText: "Cancelar"
        }).then(function (result) {
            if (result.value) {
                var $btnGuardar = $("#btnGuardarPermisos, #btnGuardarPermisosModal");
                $btnGuardar.prop("disabled", true).html('<i class="fa fa-spinner fa-spin mr-1"></i> Guardando...');
                $('body').addClass('loading');

                $.ajax({
                    url: "/Permisos/GuardarConfiguracion",
                    type: "POST",
                    contentType: "application/json; charset=utf-8",
                    data: JSON.stringify(requestData),
                    success: function (resp) {
                        $('body').removeClass('loading');
                        $btnGuardar.prop("disabled", false).html('<i class="fa fa-save mr-1"></i> Guardar Permisos');
                        $('#modalEditarPermisos').modal('hide');

                        swal({
                            title: "¡Configuración Guardada!",
                            text: "Los permisos del usuario se actualizaron correctamente.",
                            type: "success",
                            confirmButtonColor: "#1ab394"
                        });

                        // Refrescar tabla si está visible
                        BUSCAR();
                    },
                    error: function (xhr) {
                        $('body').removeClass('loading');
                        $btnGuardar.prop("disabled", false).html('<i class="fa fa-save mr-1"></i> Guardar Permisos');
                        var msg = xhr.responseJSON ? xhr.responseJSON.error : "Error interno al guardar.";
                        swal("Error", msg, "error");
                    }
                });
            }
        });
    }

    // =========================================================================
    // MÓDULO DE GESTIÓN Y MANTENIMIENTO DE ROLES (PESTAÑA 2)
    // =========================================================================

    function inicializarDataTableRoles() {
        _tablaRoles = $('#tablaRoles').DataTable({
            data: [],
            responsive: true,
            processing: false,
            serverSide: false,
            searching: true,
            ordering: true,
            pageLength: 10,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "Todos"]],
            language: {
                lengthMenu: "Mostrar _MENU_ roles por página",
                zeroRecords: "No se encontraron roles configurados",
                info: "Mostrando _START_ a _END_ de _TOTAL_ roles",
                infoEmpty: "Mostrando 0 a 0 de 0 roles",
                infoFiltered: "(filtrado de _MAX_ roles en total)",
                search: "Filtrar en tabla:",
                paginate: {
                    first: "Primero",
                    last: "Último",
                    next: "Siguiente",
                    previous: "Anterior"
                },
                loadingRecords: "Cargando catálogo de roles...",
                processing: "Procesando..."
            },
            columns: [
                {
                    data: null,
                    className: "text-center align-middle",
                    orderable: false,
                    render: function (data, type, row, meta) {
                        return meta.row + 1;
                    }
                },
                {
                    data: "CodigoRol",
                    className: "align-middle font-bold",
                    render: function (data) {
                        return '<code class="text-navy font-bold" style="font-size:0.85rem;">' + escapeHtml(data) + '</code>';
                    }
                },
                {
                    data: "NombreRol",
                    className: "align-middle font-bold",
                    render: function (data, type, row) {
                        var iconClass = row.EsSistema ? "fa-shield-alt text-navy" : "fa-user-tag text-muted";
                        return '<i class="fa ' + iconClass + ' mr-1"></i> ' + escapeHtml(data);
                    }
                },
                {
                    data: "Descripcion",
                    className: "align-middle text-muted small",
                    render: function (data) {
                        return escapeHtml(data || "-");
                    }
                },
                {
                    data: "EsSistema",
                    className: "text-center align-middle",
                    render: function (data) {
                        if (data) {
                            return '<span class="badge badge-primary badge-pvd-rol"><i class="fa fa-lock mr-1"></i> Sistema</span>';
                        } else {
                            return '<span class="badge badge-info badge-pvd-rol"><i class="fa fa-cog mr-1"></i> Personalizado</span>';
                        }
                    }
                },
                {
                    data: null,
                    className: "text-center align-middle",
                    render: function (data, type, row) {
                        var cant = row.CantidadAcciones ?? row.TotalAcciones ?? 0;
                        return '<span class="badge badge-secondary" style="font-size:0.8rem;"><i class="fa fa-check-square mr-1"></i> ' + cant + ' acciones</span>';
                    }
                },
                {
                    data: null,
                    className: "text-center align-middle",
                    render: function (data, type, row) {
                        var usrs = row.CantidadUsuarios ?? row.TotalUsuarios ?? 0;
                        return '<span class="badge badge-light border" style="font-size:0.8rem;"><i class="fa fa-users mr-1"></i> ' + usrs + ' usuarios</span>';
                    }
                },
                {
                    data: null,
                    className: "text-center align-middle",
                    render: function (data, type, row) {
                        var esActivo = (row.Estado === "A" || row.Activo === true);
                        if (esActivo) {
                            return '<span class="badge badge-success"><i class="fa fa-check-circle"></i> Activo</span>';
                        } else {
                            return '<span class="badge badge-danger"><i class="fa fa-ban"></i> Inactivo</span>';
                        }
                    }
                },
                {
                    data: null,
                    className: "text-center align-middle",
                    orderable: false,
                    render: function (data, type, row) {
                        var esActivo = (row.Estado === "A" || row.Activo === true);
                        var html = '<div class="d-flex justify-content-center align-items-center gap-2">';
                        html += '<img src="../img/editar_2.png" class="btnEditar btn-editar-rol mr-2" data-id="' + row.IdRolPv + '" style="width:20px;height:20px;cursor:pointer;" title="Editar Rol y Matriz Base" />';

                        if (!row.EsSistema) {
                            if (esActivo) {
                                html += '<button type="button" class="btn btn-outline-danger btn-xs btn-toggle-estado-rol" data-id="' + row.IdRolPv + '" data-estado="I" data-nombre="' + escapeHtml(row.NombreRol) + '" title="Desactivar Rol"><i class="fa fa-ban"></i></button>';
                            } else {
                                html += '<button type="button" class="btn btn-outline-success btn-xs btn-toggle-estado-rol" data-id="' + row.IdRolPv + '" data-estado="A" data-nombre="' + escapeHtml(row.NombreRol) + '" title="Activar Rol"><i class="fa fa-check"></i></button>';
                            }
                        } else {
                            html += '<span class="text-muted small" title="Rol protegido del sistema"><i class="fa fa-lock text-muted"></i></span>';
                        }

                        html += '</div>';
                        return html;
                    }
                }
            ]
        });
    }

    function abrirModalRol(idRolPv) {
        _rolEditandoId = idRolPv || 0;
        $('body').addClass('loading');

        $.ajax({
            url: "/Permisos/ObtenerMatrizRol",
            type: "GET",
            data: { idRolPv: _rolEditandoId },
            dataType: "json",
            success: function (data) {
                $('body').removeClass('loading');
                if (!data) {
                    swal("Aviso", "No se encontraron datos del rol.", "warning");
                    return;
                }

                _matrizRolActual = data;
                poblarModalRol(data);
                $('#modalEditarRol').modal('show');
            },
            error: function (xhr) {
                $('body').removeClass('loading');
                var msg = xhr.responseJSON ? xhr.responseJSON.error : xhr.statusText;
                swal("Error", "No se pudo cargar la información del rol: " + msg, "error");
            }
        });
    }

    function poblarModalRol(data) {
        $("#txtRolId").val(data.IdRolPv || 0);
        $("#txtRolNombre").val(data.NombreRol || "");
        $("#txtRolCodigo").val(data.CodigoRol || "");
        $("#txtRolDescripcion").val(data.Descripcion || "");

        if (data.IdRolPv > 0) {
            $("#tituloModalRol").html('<i class="fa fa-edit mr-1"></i> Editar Rol: ' + escapeHtml(data.NombreRol));
            if (data.EsSistema) {
                $("#txtRolCodigo").prop("readonly", true);
                $("#lblInfoCodigoRol").html('<span class="text-warning"><i class="fa fa-lock mr-1"></i> Identificador protegido por el sistema.</span>');
            } else {
                $("#txtRolCodigo").prop("readonly", false);
                $("#lblInfoCodigoRol").html('En mayúsculas, sin espacios (usar guiones bajos).');
            }
        } else {
            $("#tituloModalRol").html('<i class="fa fa-plus-circle mr-1"></i> Nuevo Rol de Punto de Venta');
            $("#txtRolCodigo").prop("readonly", false);
            $("#lblInfoCodigoRol").html('En mayúsculas, sin espacios (usar guiones bajos).');
        }

        // Agrupar acciones por CodigoModulo
        var modulosMap = {};
        $.each(data.Acciones || [], function (i, acc) {
            var mod = acc.CodigoModulo || "GENERAL";
            if (!modulosMap[mod]) {
                modulosMap[mod] = [];
            }
            modulosMap[mod].push(acc);
        });

        var modKeys = Object.keys(modulosMap);
        var $pills = $("#pillsModulosRol");
        var $contenedor = $("#contenedorModulosAccionesRol");
        $pills.empty();
        $contenedor.empty();

        if (modKeys.length === 0) {
            $contenedor.html(
                '<div class="alert alert-warning py-4 text-center my-3 border">' +
                '<i class="fa fa-exclamation-triangle fa-2x mb-2 text-warning"></i><br/>' +
                '<h5 class="font-bold text-dark mb-1">No hay acciones registradas en el catálogo</h5>' +
                '</div>'
            );
            actualizarConteoAccionesRol();
            return;
        }

        if (modKeys.length > 1) {
            $pills.append(
                '<li class="nav-item">' +
                '<a class="nav-link active btn-tab-modulo-rol" href="javascript:void(0);" data-modulo="TODOS">' +
                '<i class="fa fa-th-large mr-1"></i> Todos los Módulos' +
                '</a>' +
                '</li>'
            );
        }

        $.each(modKeys, function (i, codMod) {
            var info = MODULOS_INFO[codMod] || {
                titulo: codMod.replace(/_/g, ' '),
                icono: "fa-folder",
                color: "text-navy"
            };
            var totalMod = modulosMap[codMod].length;
            var isActive = (modKeys.length === 1 && i === 0) || (modKeys.length > 1 && i === -1);

            $pills.append(
                '<li class="nav-item">' +
                '<a class="nav-link ' + (isActive ? 'active' : '') + ' btn-tab-modulo-rol" href="javascript:void(0);" data-modulo="' + codMod + '">' +
                '<i class="fa ' + info.icono + ' mr-1"></i> ' + escapeHtml(info.titulo) +
                ' <span class="badge badge-light border ml-1 stat-badge-tab-rol" data-modulo-stat-rol="' + codMod + '">0/' + totalMod + '</span>' +
                '</a>' +
                '</li>'
            );
        });

        _moduloFiltroActivoRol = modKeys.length === 1 ? modKeys[0] : "TODOS";

        // Renderizar secciones de módulos y tarjetas de acción del rol
        $.each(modulosMap, function (codModulo, acciones) {
            var info = MODULOS_INFO[codModulo] || {
                titulo: codModulo.replace(/_/g, ' '),
                icono: "fa-folder",
                color: "text-navy",
                descripcion: "Acciones del módulo " + codModulo
            };

            var moduloSectionHtml =
                '<div class="modulo-section-rol card border mb-3 shadow-none bg-white" data-modulo="' + codModulo + '">' +
                '<div class="card-header py-2 px-3 bg-light d-flex justify-content-between align-items-center flex-wrap">' +
                '<div class="d-flex align-items-center mb-1 mb-md-0">' +
                '<span class="mr-2 ' + info.color + '" style="font-size:1.15rem;"><i class="fa ' + info.icono + '"></i></span>' +
                '<div>' +
                '<h5 class="mb-0 font-bold text-dark" style="font-size:0.95rem;">' + escapeHtml(info.titulo) + '</h5>' +
                '<small class="text-muted">' + escapeHtml(info.descripcion) + '</small>' +
                '</div>' +
                '</div>' +
                '<div class="d-flex align-items-center gap-1">' +
                '<span class="badge badge-secondary mr-2 stat-modulo-header-rol" data-modulo-header-stat-rol="' + codModulo + '">0/' + acciones.length + ' activos</span>' +
                '<button type="button" class="btn btn-xs btn-outline-primary btn-marcar-modulo-rol mr-1" data-modulo="' + codModulo + '" title="Habilitar todas las acciones de este módulo"><i class="fa fa-check"></i> Marcar Todo</button>' +
                '<button type="button" class="btn btn-xs btn-outline-secondary btn-desmarcar-modulo-rol" data-modulo="' + codModulo + '" title="Deshabilitar todas las acciones de este módulo"><i class="fa fa-times"></i> Desmarcar</button>' +
                '</div>' +
                '</div>' +
                '<div class="card-body p-3">' +
                '<div class="row g-2" id="gridAccionesRol_' + codModulo + '"></div>' +
                '</div>' +
                '</div>';

            $contenedor.append(moduloSectionHtml);
            var $grid = $("#gridAccionesRol_" + codModulo);

            $.each(acciones, function (j, acc) {
                var isPermitido = (acc.PermitidoFinal === true || acc.PermitidoFinal === 1 || String(acc.PermitidoFinal).toLowerCase() === "true" || String(acc.PermitidoFinal) === "1");
                var checkedAttr = isPermitido ? "checked" : "";

                var cardHtml =
                    '<div class="col-12 col-md-6 col-xl-4 mb-2 item-accion-rol-col" data-modulo="' + codModulo + '">' +
                    '<div class="action-card ' + (isPermitido ? 'activo' : '') + '">' +
                    '<div>' +
                    '<div class="d-flex justify-content-between align-items-start mb-1">' +
                    '<div class="custom-control custom-switch pr-2">' +
                    '<input type="checkbox" class="custom-control-input chk-modal-rol-accion" id="chkModalRolAcc_' + acc.IdAccion + '" data-codigo="' + acc.CodigoAccion + '" data-modulo="' + codModulo + '" ' + checkedAttr + ' />' +
                    '<label class="custom-control-label font-bold text-dark" for="chkModalRolAcc_' + acc.IdAccion + '">' +
                    escapeHtml(acc.NombreAccion) +
                    '</label>' +
                    '</div>' +
                    '</div>' +
                    (acc.Descripcion ? '<p class="text-muted small mb-2" style="font-size:0.78rem; line-height:1.3;">' + escapeHtml(acc.Descripcion) + '</p>' : '') +
                    '</div>' +
                    '<div class="mt-auto pt-1 d-flex justify-content-between align-items-center border-top">' +
                    '<span class="codigo-accion-tag">' + escapeHtml(acc.CodigoAccion) + '</span>' +
                    '<small class="text-muted font-italic status-text-rol" style="font-size:0.72rem;">' + (isPermitido ? 'Permitido' : 'Restringido') + '</small>' +
                    '</div>' +
                    '</div>' +
                    '</div>';

                $grid.append(cardHtml);
            });
        });

        actualizarConteoAccionesRol();
    }

    function actualizarConteoAccionesRol() {
        var $todas = $(".chk-modal-rol-accion");
        var total = $todas.length;
        var activas = $todas.filter(":checked").length;

        $("#lblRolConteoActivas").text(activas);
        $("#lblRolConteoTotales").text(total);

        // Actualizar contadores por módulo del rol
        $(".modulo-section-rol").each(function () {
            var mod = $(this).data("modulo");
            var $modAcc = $(this).find(".chk-modal-rol-accion");
            var modTot = $modAcc.length;
            var modAct = $modAcc.filter(":checked").length;

            $("[data-modulo-header-stat-rol='" + mod + "']").text(modAct + "/" + modTot + " activos");
            $("[data-modulo-stat-rol='" + mod + "']").text(modAct + "/" + modTot);

            if (modAct === modTot && modTot > 0) {
                $("[data-modulo-stat-rol='" + mod + "']").removeClass("border-secondary").addClass("badge-primary text-white").css("background-color", "#1ab394");
            } else {
                $("[data-modulo-stat-rol='" + mod + "']").removeClass("badge-primary text-white").addClass("badge-light").css("background-color", "");
            }
        });
    }

    function filtrarAccionesModalRol() {
        $(".modulo-section-rol").each(function () {
            var codMod = $(this).data("modulo");
            var moduloVisible = (_moduloFiltroActivoRol === "TODOS" || _moduloFiltroActivoRol === codMod);
            $(this).toggle(moduloVisible);
        });
    }

    function guardarRol() {
        var idRol = parseInt($("#txtRolId").val()) || 0;
        var nombreRol = ($("#txtRolNombre").val() || "").trim();
        var codigoRol = ($("#txtRolCodigo").val() || "").trim().toUpperCase();
        var descripcion = ($("#txtRolDescripcion").val() || "").trim();

        if (!nombreRol) {
            swal("Atención", "Debe ingresar el Nombre del Rol.", "warning");
            $("#txtRolNombre").focus();
            return;
        }

        if (!codigoRol) {
            swal("Atención", "Debe ingresar el Código Único del Rol.", "warning");
            $("#txtRolCodigo").focus();
            return;
        }

        // Validar formato del código (alfanumérico y guion bajo)
        var regexCodigo = /^[A-Z0-9_]+$/;
        if (!regexCodigo.test(codigoRol)) {
            swal("Atención", "El código del rol solo puede contener letras mayúsculas, números y guiones bajos (sin espacios ni caracteres especiales).", "warning");
            $("#txtRolCodigo").focus();
            return;
        }

        var accionesSeleccionadas = [];
        $(".chk-modal-rol-accion:checked").each(function () {
            var cod = $(this).data("codigo");
            if (cod) accionesSeleccionadas.push(cod);
        });

        // Garantizar dependencias *.VER
        var modulosConAccion = {};
        $.each(accionesSeleccionadas, function (i, acc) {
            var partes = acc.split(".");
            if (partes.length === 2) {
                modulosConAccion[partes[0]] = true;
            }
        });
        for (var mod in modulosConAccion) {
            var verAcc = mod + ".VER";
            if (accionesSeleccionadas.indexOf(verAcc) === -1) {
                accionesSeleccionadas.push(verAcc);
            }
        }

        var requestData = {
            IdRolPv: idRol,
            CodigoRol: codigoRol,
            NombreRol: nombreRol,
            Descripcion: descripcion,
            AccionesPermitidas: accionesSeleccionadas,
            AccionesBase: accionesSeleccionadas
        };

        swal({
            title: "¿Guardar Rol y Plantilla?",
            text: "Se guardarán los datos del rol '" + nombreRol + "' con " + accionesSeleccionadas.length + " acciones base.",
            type: "question",
            showCancelButton: true,
            confirmButtonColor: "#1ab394",
            cancelButtonColor: "#d9d9d9",
            confirmButtonText: "Sí, guardar",
            cancelButtonText: "Cancelar"
        }).then(function (result) {
            if (result.value) {
                var $btnGuardar = $("#btnGuardarRol");
                $btnGuardar.prop("disabled", true).html('<i class="fa fa-spinner fa-spin mr-1"></i> Guardando...');
                $('body').addClass('loading');

                $.ajax({
                    url: "/Permisos/GuardarRol",
                    type: "POST",
                    contentType: "application/json; charset=utf-8",
                    data: JSON.stringify(requestData),
                    success: function (resp) {
                        $('body').removeClass('loading');
                        $btnGuardar.prop("disabled", false).html('<i class="fa fa-save mr-1"></i> Guardar Rol y Plantilla');
                        $('#modalEditarRol').modal('hide');

                        swal({
                            title: "¡Rol Guardado!",
                            text: resp.mensaje || "El rol y su plantilla de acciones base se guardaron exitosamente.",
                            type: "success",
                            confirmButtonColor: "#1ab394"
                        });

                        cargarRoles();
                        cargarPlantillasDinamicas();
                    },
                    error: function (xhr) {
                        $('body').removeClass('loading');
                        $btnGuardar.prop("disabled", false).html('<i class="fa fa-save mr-1"></i> Guardar Rol y Plantilla');
                        var msg = xhr.responseJSON ? xhr.responseJSON.error : "Error interno al guardar el rol.";
                        swal("Error", msg, "error");
                    }
                });
            }
        });
    }

    function cambiarEstadoRol(idRolPv, nuevoEstado, nombreRol) {
        var accionTxt = (nuevoEstado === "A") ? "activar" : "desactivar";
        var estadoTxt = (nuevoEstado === "A") ? "Activo" : "Inactivo";

        swal({
            title: "¿Desea " + accionTxt + " este rol?",
            text: "El rol '" + (nombreRol || "") + "' cambiará su estado a " + estadoTxt + ".",
            type: "warning",
            showCancelButton: true,
            confirmButtonColor: (nuevoEstado === "A") ? "#1ab394" : "#ed5565",
            cancelButtonColor: "#d9d9d9",
            confirmButtonText: "Sí, " + accionTxt,
            cancelButtonText: "Cancelar"
        }).then(function (result) {
            if (result.value) {
                $('body').addClass('loading');
                $.ajax({
                    url: "/Permisos/CambiarEstadoRol",
                    type: "POST",
                    contentType: "application/json; charset=utf-8",
                    data: JSON.stringify({ IdRolPv: idRolPv, Estado: nuevoEstado, Activo: (nuevoEstado === "A") }),
                    success: function (resp) {
                        $('body').removeClass('loading');
                        swal({
                            title: "Estado Actualizado",
                            text: resp.mensaje || "El estado del rol se actualizó exitosamente.",
                            type: "success",
                            confirmButtonColor: "#1ab394"
                        });
                        cargarRoles();
                        cargarPlantillasDinamicas();
                    },
                    error: function (xhr) {
                        $('body').removeClass('loading');
                        var msg = xhr.responseJSON ? xhr.responseJSON.error : "Error al cambiar el estado del rol.";
                        swal("Error", msg, "error");
                    }
                });
            }
        });
    }

    function registrarEventos() {
        // Tab header de roles -> Recalcular responsive de DataTable
        $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            var target = $(e.target).attr("href");
            if (target === "#tab-roles" && _tablaRoles) {
                _tablaRoles.columns.adjust();
                if (_tablaRoles.responsive && typeof _tablaRoles.responsive.recalc === 'function') {
                    _tablaRoles.responsive.recalc();
                }
            } else if (target === "#tab-usuarios" && _tabla) {
                _tabla.columns.adjust();
                if (_tabla.responsive && typeof _tabla.responsive.recalc === 'function') {
                    _tabla.responsive.recalc();
                }
            }
        });

        // Botón Buscar superior
        $("#btnBuscar").on("click", function () {
            BUSCAR();
        });

        $("#txtBuscarUsuario").on("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                BUSCAR();
            }
        });

        // Cambio en filtro de Rol -> Filtrar de inmediato
        $("#ddlFiltroRolPv").on("change", function () {
            BUSCAR();
        });

        // Botón Limpiar del input de búsqueda
        $("#btnLimpiarBusqueda, #btnClearBuscarUsuario").on("click", function () {
            $("#txtBuscarUsuario").val("").focus();
            BUSCAR();
        });

        // Clic en botón / imagen Editar de la tabla de usuarios
        $(document).on("click", ".btn-editar-permisos", function () {
            var id = $(this).data("id");
            if (id) {
                abrirModalEdicion(id);
            }
        });

        // Botón Nuevo Rol
        $("#btnNuevoRol").on("click", function () {
            abrirModalRol(0);
        });

        // Clic en editar rol de la tabla de roles
        $(document).on("click", ".btn-editar-rol", function () {
            var id = $(this).data("id");
            if (id) {
                abrirModalRol(id);
            }
        });

        // Botón Activar / Desactivar Rol
        $(document).on("click", ".btn-toggle-estado-rol", function () {
            var id = $(this).data("id");
            var estado = $(this).data("estado") || "A";
            var nombre = $(this).data("nombre") || "";
            if (id) {
                cambiarEstadoRol(id, estado, nombre);
            }
        });

        // Botones de plantilla rápida en el modal de usuario
        $(document).on("click", ".btn-plantilla-rapida", function () {
            var codRol = $(this).data("rol");
            if (codRol) {
                aplicarPlantilla(codRol);
            }
        });

        // Cambio en selector de rol del modal de usuario
        $("#ddlModalRolPv").on("change", function () {
            var selectedId = parseInt($(this).val()) || 0;
            var rol = _roles.find(function (r) { return r.IdRolPv === selectedId; });
            if (rol && PLANTILLAS_ROLES[rol.CodigoRol]) {
                aplicarPlantilla(rol.CodigoRol);
            } else {
                actualizarBotonPresetActivo();
            }
        });

        // Botón "Marcar Todas" (Modal Usuario)
        $(document).on("click", "#btnMarcarTodasAcciones", function () {
            $(".chk-modal-accion").each(function () {
                $(this).prop("checked", true);
                var $card = $(this).closest(".action-card");
                $card.addClass("activo");
                $card.find(".status-text").text("Permitido");
            });
            actualizarMedidorProgreso();
        });

        // Botón "Desmarcar Todas" (Modal Usuario)
        $(document).on("click", "#btnDesmarcarTodasAcciones", function () {
            $(".chk-modal-accion").each(function () {
                $(this).prop("checked", false);
                var $card = $(this).closest(".action-card");
                $card.removeClass("activo");
                $card.find(".status-text").text("Restringido");
            });
            actualizarMedidorProgreso();
        });

        // Botones de módulo individual (Marcar / Desmarcar Modal Usuario)
        $(document).on("click", ".btn-marcar-modulo", function () {
            var mod = $(this).data("modulo");
            $('.modulo-section[data-modulo="' + mod + '"] .chk-modal-accion').each(function () {
                $(this).prop("checked", true);
                var $card = $(this).closest(".action-card");
                $card.addClass("activo");
                $card.find(".status-text").text("Permitido");
            });
            actualizarMedidorProgreso();
        });

        $(document).on("click", ".btn-desmarcar-modulo", function () {
            var mod = $(this).data("modulo");
            $('.modulo-section[data-modulo="' + mod + '"] .chk-modal-accion').each(function () {
                $(this).prop("checked", false);
                var $card = $(this).closest(".action-card");
                $card.removeClass("activo");
                $card.find(".status-text").text("Restringido");
            });
            actualizarMedidorProgreso();
        });

        // Switches de acciones dentro del modal con Dependencia Jerárquica (Gestionar requiere Ver)
        $(document).on("change", ".chk-modal-accion", function () {
            var checked = $(this).is(":checked");
            var codigoAccion = ($(this).data("codigo") || "").toUpperCase();
            var $section = $(this).closest(".modulo-section");

            var $card = $(this).closest(".action-card");
            $card.toggleClass("activo", checked);
            $card.find(".status-text").text(checked ? "Permitido" : "Restringido");

            var esAccionVer = codigoAccion.endsWith(".VER");

            if (!checked && esAccionVer) {
                // Si se desmarca VER, se desmarcan automáticamente todas las acciones de gestión de ese módulo
                $section.find(".chk-modal-accion").each(function () {
                    var cod = ($(this).data("codigo") || "").toUpperCase();
                    if (cod !== codigoAccion) {
                        $(this).prop("checked", false);
                        var $c = $(this).closest(".action-card");
                        $c.removeClass("activo");
                        $c.find(".status-text").text("Restringido");
                    }
                });
            } else if (checked && !esAccionVer) {
                // Si se marca cualquier acción operativa/gestión, automáticamente se marca VER de ese módulo
                var $chkVer = $section.find(".chk-modal-accion").filter(function () {
                    return ($(this).data("codigo") || "").toUpperCase().endsWith(".VER");
                });
                if ($chkVer.length && !$chkVer.is(":checked")) {
                    $chkVer.prop("checked", true);
                    var $cVer = $chkVer.closest(".action-card");
                    $cVer.addClass("activo");
                    $cVer.find(".status-text").text("Permitido");
                }
            }
            detectarYActualizarRolModal();
            actualizarMedidorProgreso();
        });

        // Pestañas de módulos (Nav pills Modal Usuario)
        $(document).on("click", ".btn-tab-modulo", function () {
            $(".btn-tab-modulo").removeClass("active");
            $(this).addClass("active");
            _moduloFiltroActivo = $(this).data("modulo") || "TODOS";
            filtrarAccionesModal();
        });

        // Buscador de acciones en vivo en el modal de usuario
        $("#txtFiltroAccionesModal").on("input", function () {
            filtrarAccionesModal();
        });

        $("#btnClearFiltroAccionesModal").on("click", function () {
            $("#txtFiltroAccionesModal").val("");
            filtrarAccionesModal();
        });

        // Botón Guardar del Modal de Usuario
        $("#btnGuardarPermisos, #btnGuardarPermisosModal").on("click", function () {
            guardarPermisosModal();
        });

        // ---------------------------------------------------------------------
        // EVENTOS DEL MODAL DE ROL
        // ---------------------------------------------------------------------

        // Botón "Marcar Todas" (Modal Rol)
        $("#btnMarcarTodasRol").on("click", function () {
            $(".chk-modal-rol-accion").each(function () {
                $(this).prop("checked", true);
                var $card = $(this).closest(".action-card");
                $card.addClass("activo");
                $card.find(".status-text-rol").text("Permitido");
            });
            actualizarConteoAccionesRol();
        });

        // Botón "Desmarcar Todas" (Modal Rol)
        $("#btnDesmarcarTodasRol").on("click", function () {
            $(".chk-modal-rol-accion").each(function () {
                $(this).prop("checked", false);
                var $card = $(this).closest(".action-card");
                $card.removeClass("activo");
                $card.find(".status-text-rol").text("Restringido");
            });
            actualizarConteoAccionesRol();
        });

        // Botones de módulo individual (Marcar / Desmarcar Modal Rol)
        $(document).on("click", ".btn-marcar-modulo-rol", function () {
            var mod = $(this).data("modulo");
            $('.modulo-section-rol[data-modulo="' + mod + '"] .chk-modal-rol-accion').each(function () {
                $(this).prop("checked", true);
                var $card = $(this).closest(".action-card");
                $card.addClass("activo");
                $card.find(".status-text-rol").text("Permitido");
            });
            actualizarConteoAccionesRol();
        });

        $(document).on("click", ".btn-desmarcar-modulo-rol", function () {
            var mod = $(this).data("modulo");
            $('.modulo-section-rol[data-modulo="' + mod + '"] .chk-modal-rol-accion').each(function () {
                $(this).prop("checked", false);
                var $card = $(this).closest(".action-card");
                $card.removeClass("activo");
                $card.find(".status-text-rol").text("Restringido");
            });
            actualizarConteoAccionesRol();
        });

        // Switches de acciones dentro del modal de Rol con Dependencia Jerárquica
        $(document).on("change", ".chk-modal-rol-accion", function () {
            var checked = $(this).is(":checked");
            var codigoAccion = ($(this).data("codigo") || "").toUpperCase();
            var $section = $(this).closest(".modulo-section-rol");

            var $card = $(this).closest(".action-card");
            $card.toggleClass("activo", checked);
            $card.find(".status-text-rol").text(checked ? "Permitido" : "Restringido");

            var esAccionVer = codigoAccion.endsWith(".VER");

            if (!checked && esAccionVer) {
                // Si se desmarca VER, se desmarcan automáticamente todas las acciones de gestión de ese módulo
                $section.find(".chk-modal-rol-accion").each(function () {
                    var cod = ($(this).data("codigo") || "").toUpperCase();
                    if (cod !== codigoAccion) {
                        $(this).prop("checked", false);
                        var $c = $(this).closest(".action-card");
                        $c.removeClass("activo");
                        $c.find(".status-text-rol").text("Restringido");
                    }
                });
            } else if (checked && !esAccionVer) {
                // Si se marca cualquier acción operativa/gestión, automáticamente se marca VER de ese módulo
                var $chkVer = $section.find(".chk-modal-rol-accion").filter(function () {
                    return ($(this).data("codigo") || "").toUpperCase().endsWith(".VER");
                });
                if ($chkVer.length && !$chkVer.is(":checked")) {
                    $chkVer.prop("checked", true);
                    var $cVer = $chkVer.closest(".action-card");
                    $cVer.addClass("activo");
                    $cVer.find(".status-text-rol").text("Permitido");
                }
            }
            actualizarConteoAccionesRol();
        });

        // Pestañas de módulos (Nav pills Modal Rol)
        $(document).on("click", ".btn-tab-modulo-rol", function () {
            $(".btn-tab-modulo-rol").removeClass("active");
            $(this).addClass("active");
            _moduloFiltroActivoRol = $(this).data("modulo") || "TODOS";
            filtrarAccionesModalRol();
        });

        // Botón Guardar del Modal de Rol
        $("#btnGuardarRol").on("click", function () {
            guardarRol();
        });
    }

    function escapeHtml(text) {
        if (!text) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
