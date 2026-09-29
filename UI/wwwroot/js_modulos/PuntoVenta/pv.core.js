window.PV = window.PV || {};

PV.cambiosPendientes = false;
PV.registrarCambios = function () { PV.cambiosPendientes = true; };
PV.confirmarGuardado = function () { PV.cambiosPendientes = false; };

PV.confirmarNavegacion = function (callback) {
    if (!PV.cambiosPendientes) { callback(); return; }
    Swal.fire({
        title: "Cambios sin guardar",
        text: "Si continua se perderán los cambios no guardados.",
        type: "warning",
        showCancelButton: true,
        confirmButtonText: "Continuar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#1ab394",
        cancelButtonColor: "#d9d9d9"
    }).then(function (result) {
        if (result.value) {
            PV.cambiosPendientes = false;
            callback();
        }
    });
};

PV.Utils = {
    _procesando: false,
    _ultimoClicMs: 0,
    puedeInteractuar: function () {
        if (PV.Utils._procesando) return false;
        var ahora = Date.now();
        if (ahora - PV.Utils._ultimoClicMs < 300) return false;
        PV.Utils._ultimoClicMs = ahora;
        return true;
    },
    ejecutarAccion: function (callback, onComplete) {
        if (PV.Utils._procesando) return;
        PV.Utils._procesando = true;
        try {
            var reHabilitar = function () {
                PV.Utils._procesando = false;
                if (typeof onComplete === "function") onComplete();
            };
            callback(reHabilitar);
        } catch (e) {
            PV.Utils._procesando = false;
            if (typeof onComplete === "function") onComplete();
            throw e;
        }
    },
    modalAbierto: function (selector) {
        return $(selector).hasClass("show");
    },
    formatearFechaParaInput: function (fechaStr) {
        if (!fechaStr) return "";
        fechaStr = String(fechaStr).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(fechaStr)) {
            var partes = fechaStr.substring(0, 10).split("-");
            return partes[2] + "/" + partes[1] + "/" + partes[0];
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(fechaStr)) {
            return fechaStr.substring(0, 10);
        }
        return fechaStr.substring(0, 10);
    },
    fijarFechaFlatpickr: function (selector, fechaStr, permitirPasada) {
        var el = typeof selector === "string" ? document.querySelector(selector) : selector;
        if (!el) return;
        var fechaFmt = PV.Utils.formatearFechaParaInput(fechaStr);
        if (!fechaFmt) {
            if (el._flatpickr) el._flatpickr.clear();
            else $(el).val("");
            return;
        }

        if (el._flatpickr) {
            if (permitirPasada) {
                el._flatpickr.set("minDate", null);
            }
            el._flatpickr.setDate(fechaFmt, false, "d/m/Y");
        } else {
            $(el).val(fechaFmt);
        }
    },
    mostrarModalProgreso: function (titulo, subtituloInicial, total) {
        var subTxt = subtituloInicial || (total > 0 ? ("Artículo 0 de " + total) : "Procesando...");

        if (Swal.isVisible() && $("#swalProgressBar").length) {
            $(".swal2-title").text(titulo || "Procesando...");
            $("#swalProgressMsg").html(subTxt);
            $("#swalProgressBar").css("width", "0%").attr("aria-valuenow", 0);
            $("#swalProgressPercent").text("0%");
            return;
        }

        var html = '<div style="margin-top:10px;text-align:center;">' +
            '<div id="swalProgressMsg" style="font-size:14px;font-weight:600;margin-bottom:10px;color:#333;">' + subTxt + '</div>' +
            '<div class="progress" style="height:14px;background-color:#e9ecef;border-radius:7px;overflow:hidden;margin-bottom:6px;">' +
            '<div id="swalProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width:0%; background-color:#1ab394;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>' +
            '</div>' +
            '<div id="swalProgressPercent" style="font-size:12px;font-weight:600;color:#1ab394;">0%</div>' +
            '</div>';

        Swal.fire({
            title: titulo || "Procesando...",
            html: html,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false
        });
    },
    actualizarModalProgreso: function (actual, total, extraInfo) {
        total = Number(total) || 1;
        actual = Number(actual) || 0;
        var pct = Math.min(100, Math.max(0, Math.round((actual / total) * 100)));

        var $msg = $("#swalProgressMsg");
        if ($msg.length) {
            var txt = "Artículo <strong>" + actual + "</strong> de <strong>" + total + "</strong>";
            if (extraInfo) {
                txt += " <span style='font-size:12px;color:#666;font-weight:normal;'>(" + extraInfo + ")</span>";
            }
            $msg.html(txt);
        }
        var $bar = $("#swalProgressBar");
        if ($bar.length) {
            $bar.css("width", pct + "%").attr("aria-valuenow", pct);
        }
        var $pct = $("#swalProgressPercent");
        if ($pct.length) {
            $pct.text(pct + "%");
        }
    },
    cerrarModalProgreso: function (delayMs, callback) {
        var delay = (typeof delayMs === "number") ? delayMs : 350;
        if (typeof delayMs === "function") {
            callback = delayMs;
            delay = 350;
        }

        setTimeout(function () {
            if (Swal.isVisible()) {
                Swal.close();
            }
            if (typeof callback === "function") {
                callback();
            }
        }, delay);
    }
};

PV.Core = (function () {

    function inicializar() {
        controlarSesionExpirada();
        inicializarFechas();
        registrarFocusTabs();
        enfocarTabActivoInicial();
        registrarClearInputs();
        registrarFiltrosNumericosLogistica();
    }

    function controlarSesionExpirada() {
        let sesionExpiradaMostrada = false;

        $(document).ajaxError(function (event, xhr) {

            if (xhr.status === 401 && !sesionExpiradaMostrada && !window.__sesionExpiradaMostrada) {

                sesionExpiradaMostrada = true;
                window.__sesionExpiradaMostrada = true;

                Swal.fire({
                    type: "warning",
                    title: "Sesión expirada",
                    text: "Tu sesión ha finalizado. Serás redirigido al login.",
                    confirmButtonText: "Aceptar",
                    allowOutsideClick: false
                }).then(() => {
                    window.location.href = "/Seguridad/Login";
                });
            }
        });
    }

    function parsearFecha(str) {
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
    }

    function sincronizarFechaEntregaConAtencion() {
        if (window.PV && PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly()) {
            return;
        }
        const valAtencion = ($("#txtVentaFechaAtencion").val() || "").trim();
        const elEntrega = document.getElementById("txtLogisticaFechaEntrega");
        const fpEntrega = elEntrega?._flatpickr;

        if (fpEntrega && valAtencion) {
            fpEntrega.set("minDate", valAtencion);

            const valEntrega = ($(elEntrega).val() || "").trim();
            const dAtencion = parsearFecha(valAtencion);
            const dEntrega = parsearFecha(valEntrega);

            if (!valEntrega || (dAtencion && dEntrega && dEntrega < dAtencion)) {
                fpEntrega.setDate(valAtencion, true);
            }

            if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
                PV.Catalogos.actualizarEstadoHorasEntrega(true);
            }
        }
    }

    var _timerSincronizacionFecha = null;

    function inicializarFechas() {
        $(".input-fecha").flatpickr({
            dateFormat: "d/m/Y",
            locale: "es",
            defaultDate: "today",
            theme: "material_green",
            disableMobile: true,
            onChange: function (selectedDates, dateStr, instance) {
                if (instance.element.id === "txtVentaFechaAtencion") {
                    if (_timerSincronizacionFecha) clearTimeout(_timerSincronizacionFecha);
                    _timerSincronizacionFecha = setTimeout(function () {
                        sincronizarFechaEntregaConAtencion();
                    }, 50);
                } else if (instance.element.id === "txtLogisticaFechaEntrega") {
                    if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
                        PV.Catalogos.actualizarEstadoHorasEntrega();
                    }
                }
            }
        });

        $("#txtVentaFechaAtencion, #txtLogisticaFechaEntrega").each(function () {
            this._flatpickr?.set("minDate", "today");
        });

        $(document).on("change", "#ddlLogisticaLugarEntrega", function () {
            if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
                PV.Catalogos.actualizarEstadoHorasEntrega(true);
            }
            if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoLugarEnvio === "function") {
                PV.Catalogos.actualizarEstadoLugarEnvio({ esCambioManual: true });
            }
        });

        $(document).on("click", "#btnDesbloquearLugarEnvio", function (e) {
            e.preventDefault();
            if ($(this).is(":disabled") || (PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly())) return;

            Swal.fire({
                title: "¿Desea habilitar el campo Lugar de Envío?",
                text: "El lugar de entrega actual no es Agencia. ¿Desea ingresar un lugar de envío de todas formas?",
                type: "question",
                showCancelButton: true,
                confirmButtonColor: "#1ab394",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, habilitar",
                cancelButtonText: "Cancelar"
            }).then(function (result) {
                if (result.value) {
                    $("#txtLogisticaLugarEnvio").prop("readonly", false).removeClass("bg-light").focus();
                    $("#btnDesbloquearLugarEnvio").prop("disabled", true);
                }
            });
        });

        $(document).on("click", "#btnDesbloquearFlete", function (e) {
            e.preventDefault();
            if ($(this).is(":disabled") || (PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly())) return;

            Swal.fire({
                title: "¿Desea habilitar el campo Flete?",
                text: "¿Está seguro de habilitar el ingreso manual del monto de flete?",
                type: "question",
                showCancelButton: true,
                confirmButtonColor: "#1ab394",
                cancelButtonColor: "#6c757d",
                confirmButtonText: "Sí, habilitar",
                cancelButtonText: "Cancelar"
            }).then(function (result) {
                if (result.value) {
                    $("#txtVentaFlete").prop("readonly", false).removeClass("bg-light").focus().select();
                    $("#btnDesbloquearFlete").prop("disabled", true);
                }
            });
        });
    }

    function registrarClearInputs() {
        $(document).on("click", ".btn-clear-input", function () {
            const $btn = $(this);
            const targets = $btn.data("clear-targets");

            if (targets) {
                $(targets).each(function () {
                    $(this).val("").trigger("change");
                });

                if (targets.includes("#txtClienteCodigo") || targets.includes("#txtClienteNombre") || targets.includes("#txtClienteRuc")) {
                    PV.Cliente.limpiarSeleccionCliente();
                }
            } else {
                const $grupo = $btn.closest(".input-clear");
                const $input = $grupo.find(".form-control").first();

                $input.val("").trigger("change").focus();

                const id = $input.attr("id");
                if (id === "txtClienteNombre" || id === "txtClienteRuc" || id === "txtClienteCodigo") {
                    PV.Cliente.limpiarSeleccionCliente();
                }
                return;
            }

            const $grupo = $btn.closest(".input-clear");
            const $input = $grupo.find(".form-control").first();
            $input.focus();
        });
    }
    
    var _timerEnfoqueTab = null;

    function cerrarWidgetsFlotantes() {
        try {
            var $autocompletesAbiertos = $(".ui-autocomplete:visible");
            if ($autocompletesAbiertos.length) {
                $(".ui-autocomplete-input").each(function () {
                    var ac = $(this).data("ui-autocomplete") || $(this).data("autocomplete");
                    if (ac && typeof ac.close === "function") {
                        ac.close();
                    }
                });
            }
        } catch (e) { }

        try {
            var $calendariosAbiertos = $(".flatpickr-calendar.open");
            if ($calendariosAbiertos.length) {
                $calendariosAbiertos.removeClass("open");
            }
        } catch (e) { }
    }

    function enfocarPrimerControl(selectorTab) {
        if (_timerEnfoqueTab) {
            clearTimeout(_timerEnfoqueTab);
            _timerEnfoqueTab = null;
        }

        cerrarWidgetsFlotantes();

        _timerEnfoqueTab = setTimeout(function () {
            _timerEnfoqueTab = null;
            if (!selectorTab) return;

            var $tab = $(selectorTab);
            if (!$tab.length || !$tab.is(":visible") || !$tab.hasClass("active")) return;

            // Si es un tab contenedor como #tab-2, buscar dentro del sub-tab actualmente activo
            var $scope = $tab;
            var $subTabActivo = $tab.find(".tab-pane.active");
            if ($subTabActivo.length && $subTabActivo.is(":visible")) {
                $scope = $subTabActivo;
            }

            // Enfocar solo el primer control de texto editable visible sin forzar select()
            var $primerControl = $scope
                .find('input:text:visible:not([type="hidden"]):not([readonly]):not([disabled]), textarea:visible:not([readonly]):not([disabled])')
                .first();

            if ($primerControl.length && $primerControl.is(":visible") && $primerControl.closest(".tab-pane.active.show, .tab-pane.active").length > 0) {
                try {
                    $primerControl.focus();
                } catch (e) { }
            }
        }, 50);
    }

    function conmutarTab(targetSelector, options) {
        if (!targetSelector || typeof targetSelector !== "string") return;
        targetSelector = targetSelector.trim();
        if (targetSelector.indexOf("#") !== 0) return;

        var $targetPane = $(targetSelector);
        if (!$targetPane.length) return;

        // Idempotencia: si la pestaña ya está activa y visible, no hacer nada (0ms NO-OP)
        if ($targetPane.hasClass("active") && $targetPane.is(":visible")) {
            if (targetSelector === "#tab-2") {
                var $subActivoActual = $("#tab-2 .nav-pills-pv .nav-link.active");
                if ($subActivoActual.length) {
                    var subActivoHref = $subActivoActual.attr("href");
                    if (subActivoHref && $(subActivoHref).hasClass("active") && $(subActivoHref).is(":visible")) {
                        return;
                    }
                }
            } else {
                return;
            }
        }

        // 1. Limpiar selección de texto residual para evitar que Edge active su menú flotante (Smart Copy / Mini Menu)
        if (window.getSelection) {
            try {
                window.getSelection().removeAllRanges();
            } catch (ex) { }
        }

        // 2. Si un elemento tiene foco dentro del tab actual, desenfocarlo limpiamente ANTES de ocultar el contenedor
        if (document.activeElement && document.activeElement !== document.body && typeof document.activeElement.blur === "function") {
            try {
                document.activeElement.blur();
            } catch (e) { }
        }

        cerrarWidgetsFlotantes();

        var $link = $('a[href="' + targetSelector + '"]');
        var debeEnfocar = (options && options.enfocar === true);

        // Caso A: Tab Principal (#tab-1 [BÚSQUEDA] o #tab-2 [VENTA])
        if (targetSelector === "#tab-1" || targetSelector === "#tab-2") {
            $(".tabs-pv .nav-link").removeClass("active");
            if ($link.length) $link.addClass("active");

            $("#tab-1, #tab-2").removeClass("active show");
            $targetPane.addClass("active show");

            if (targetSelector === "#tab-2") {
                var $subActivo = $("#tab-2 .nav-pills-pv .nav-link.active");
                var subHref = $subActivo.length ? $subActivo.attr("href") : "#tab-cliente";
                if (!subHref || !$(subHref).length) subHref = "#tab-cliente";

                $(".nav-pills-pv .nav-link").removeClass("active");
                $('a[href="' + subHref + '"]').addClass("active");

                $("#tab-cliente, #tab-logistica, #tab-financiero").removeClass("active show");
                $(subHref).addClass("active show");
            }
        }
        // Caso B: Sub-Tab dentro de Venta (#tab-cliente, #tab-logistica, #tab-financiero)
        else if (targetSelector === "#tab-cliente" || targetSelector === "#tab-logistica" || targetSelector === "#tab-financiero") {
            // Asegurar que el contenedor principal #tab-2 esté activo
            if (!$("#tab-2").hasClass("active")) {
                $(".tabs-pv .nav-link").removeClass("active");
                $('a[href="#tab-2"]').addClass("active");

                $("#tab-1").removeClass("active show");
                $("#tab-2").addClass("active show");
            }

            // Activar el sub-tab específico
            $(".nav-pills-pv .nav-link").removeClass("active");
            if ($link.length) $link.addClass("active");

            $("#tab-cliente, #tab-logistica, #tab-financiero").removeClass("active show");
            $targetPane.addClass("active show");
        }

        if (debeEnfocar) {
            enfocarPrimerControl(targetSelector);
        }
    }

    function registrarFocusTabs() {
        // Prevenir mousedown para evitar arrastre de enlaces (drag), cambio de foco no deseado y selección de texto
        $(document).on("mousedown", ".tabs-pv a, .nav-pills-pv a", function (e) {
            e.preventDefault();
        });

        // Prevenir dblclick para evitar que Edge seleccione la palabra al hacer clics rápidos
        $(document).on("dblclick", ".tabs-pv a, .nav-pills-pv a", function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        // Interceptar clics en pestañas de Punto de Venta y conmutar atómicamente de forma 100% sincrónica
        $(document).on("click", ".tabs-pv a, .nav-pills-pv a", function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            var target = $(this).attr("href");
            if (target) {
                conmutarTab(target, { enfocar: false });
            }
        });
    }

    function enfocarTabActivoInicial() {
        setTimeout(function () {
            const $tabActivo = $(".tabs-pv .nav-link.active, .nav-pills-pv .nav-link.active").first();
            const selectorTab = $tabActivo.attr("href");

            if (selectorTab) {
                conmutarTab(selectorTab, { enfocar: false });
            }
        }, 80);
    }

    function registrarFiltrosNumericosLogistica() {
        var selector = "#txtLogisticaRuc, #txtLogisticaTelefono";

        // 1. Bloqueo al tipear directamente caracteres no numericos
        $(document).on("keypress", selector, function (e) {
            if (e.which !== 0 && e.which !== 8 && (e.which < 48 || e.which > 57)) {
                e.preventDefault();
            }
        });

        // 2. Intercepcion sincrona al pegar (Ctrl+V, Clic Derecho -> Pegar)
        $(document).on("paste", selector, function (e) {
            e.preventDefault();
            var clipboardData = e.originalEvent?.clipboardData || window.clipboardData;
            var textoPegado = clipboardData ? clipboardData.getData("text") : "";
            var soloNumeros = (textoPegado || "").replace(/\D/g, "");

            if (!soloNumeros) return; // Si era solo texto sin digitos, no pega nada

            var input = this;
            var max = parseInt($(input).attr("maxlength"), 10) || 0;
            var valActual = input.value || "";
            var start = input.selectionStart != null ? input.selectionStart : valActual.length;
            var end = input.selectionEnd != null ? input.selectionEnd : valActual.length;

            var parteAntes = valActual.substring(0, start);
            var parteDespues = valActual.substring(end);
            var nuevoValor = parteAntes + soloNumeros + parteDespues;

            if (max > 0 && nuevoValor.length > max) {
                var espacioDisponible = max - (parteAntes.length + parteDespues.length);
                if (espacioDisponible <= 0) return;
                soloNumeros = soloNumeros.substring(0, espacioDisponible);
                nuevoValor = parteAntes + soloNumeros + parteDespues;
            }

            input.value = nuevoValor;
            var nuevaPos = start + soloNumeros.length;
            if (input.setSelectionRange) {
                input.setSelectionRange(nuevaPos, nuevaPos);
            }
            $(input).trigger("input").trigger("change");
        });

        // 3. Intercepcion al arrastrar texto (Drag & Drop)
        $(document).on("drop", selector, function (e) {
            e.preventDefault();
            var dt = e.originalEvent?.dataTransfer;
            var textoArrastrado = dt ? dt.getData("text") : "";
            var soloNumeros = (textoArrastrado || "").replace(/\D/g, "");
            if (!soloNumeros) return;

            var input = this;
            var max = parseInt($(input).attr("maxlength"), 10) || 0;
            var valActual = input.value || "";
            var nuevoValor = valActual + soloNumeros;
            if (max > 0 && nuevoValor.length > max) {
                nuevoValor = nuevoValor.substring(0, max);
            }
            input.value = nuevoValor;
            $(input).trigger("input").trigger("change");
        });

        // 4. Respaldo para autocompletado y teclados virtuales
        $(document).on("input", selector, function () {
            var limpio = (this.value || "").replace(/\D/g, "");
            var max = parseInt($(this).attr("maxlength"), 10) || 0;
            if (max > 0 && limpio.length > max) {
                limpio = limpio.substring(0, max);
            }
            if (this.value !== limpio) {
                this.value = limpio;
            }
        });
    }

    function limpiarFormularioParaCarga() {
        PV.confirmarGuardado();

        // 1. Cabeceras e identificadores
        $("#hdfDocEntry").val("");
        $("#hdfDocEntrySap").val("");
        $("#hdfDocStatusOriginal").val("");

        // 2. Cliente y Crédito
        $("#txtClienteNombre").val("");
        $("#txtClienteRuc").val("");
        $("#txtClienteCodigo").val("");
        $("#txtVentaLimiteCredito").val("0.00");
        $("#ddlClienteDireccionEnvioId").empty();
        $("#txtClienteDireccionEnvio").val("");
        $("#ddlClienteDireccionFacturaId").empty();
        $("#txtClienteDireccionFactura").val("");
        $("#contenedorNotasCredito").html('<small class="text-muted">Seleccione un cliente para cargar notas de crédito.</small>');
        $(".chk-nota-credito").prop("checked", false);
        $("#tblDesgloseCredito tbody").empty();

        if (PV.Cliente && typeof PV.Cliente.cancelarPeticionesPendientes === "function") {
            PV.Cliente.cancelarPeticionesPendientes();
        }

        // 3. Logística y Despacho
        $("#tab-logistica input:not(#txtLogisticaFechaEntrega), #tab-logistica textarea").val("");
        $("#txtLogisticaComentarios").val("");
        $("#txtLogisticaAgencia").val("");
        $("#txtLogisticaRuc").val("");
        $("#txtLogisticaContactoNombre").val("");
        $("#txtLogisticaTelefono").val("");
        $("#txtLogisticaLugarEnvio").val("");
        $("#ddlLogisticaLugarEntrega").val("CENTRO");
        var $optEmbalaje = $("#ddlLogisticaTipoEmbalaje option:first").val();
        if ($optEmbalaje !== undefined) $("#ddlLogisticaTipoEmbalaje").val($optEmbalaje);
        var $optEnvio = $("#ddlLogisticaModoEnvio option:first").val();
        if ($optEnvio !== undefined) $("#ddlLogisticaModoEnvio").val($optEnvio);
        var $optHora = $("#ddlLogisticaHoraEntrega option:first").val();
        if ($optHora !== undefined) $("#ddlLogisticaHoraEntrega").val($optHora);

        // 4. Financiero
        $("#tab-financiero input, #tab-financiero textarea").val("");
        $("#ddlFinancieroTipoComprobante").val("01");
        $("#ddlFinancieroFormaPago").empty();
        $("#txtVentaFlete").val("0.00");
        $("#txtVentaDescuento").val("0.00");
        $("#txtVentaTotal").val("0.00");
        $("#txtVentaNeto").val("0.00");

        // 5. Detalle de productos
        var $tbody = $("#tblVentaDetalle tbody");
        $tbody.find("tr").each(function () {
            $(this).removeData("lotes");
        });
        $tbody.empty();

        // 6. Resetear estados visuales
        if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoHorasEntrega === "function") {
            PV.Catalogos.actualizarEstadoHorasEntrega(true);
        }
        if (PV.Catalogos && typeof PV.Catalogos.actualizarEstadoLugarEnvio === "function") {
            PV.Catalogos.actualizarEstadoLugarEnvio({ esLimpieza: true });
        }
        if (PV.Detalle && typeof PV.Detalle.verificarAlertaLimiteCredito === "function") {
            PV.Detalle.verificarAlertaLimiteCredito();
        }
    }

    return {
        inicializar: inicializar,
        conmutarTab: conmutarTab,
        enfocarPrimerControl: enfocarPrimerControl,
        cerrarWidgetsFlotantes: cerrarWidgetsFlotantes,
        limpiarFormularioParaCarga: limpiarFormularioParaCarga
    };

})();