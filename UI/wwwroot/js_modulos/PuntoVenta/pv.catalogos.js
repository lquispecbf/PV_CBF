window.PV = window.PV || {};

PV.Catalogos = (function () {

    function cargarTodo() {
        cargarListaPrecios();
        cargarVendedores();
        cargarAlmacenes();
        cargarTiposEmbalaje();
        cargarLugaresEntrega();
        cargarHorasEntrega();
        cargarModosEnvio();
        cargarTiposComprobante();
    }

    function cargarListaPrecios(callback) {
        return $.ajax({
            url: "/PuntoVenta/Buscar_ListaPrecios",
            type: "GET",
            data: { nombreBusqueda: "" },
            dataType: "json",
            success: function (data) {
                let html = '';

                data.forEach(function (item) {
                    html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
                });

                const $ddl = $("#ddlClienteListaPrecio");
                const pendingVal = $ddl.attr("data-pending-val") || $ddl.val();
                $ddl.html(html);

                if (pendingVal) {
                    $ddl.val(pendingVal);
                    if ($ddl.val() !== pendingVal) {
                        $ddl.find("option").each(function () {
                            const optVal = $(this).val().toString().trim();
                            const optText = $(this).text().trim();
                            if (optVal === pendingVal.toString().trim() || optText === pendingVal.toString().trim()) {
                                $ddl.val($(this).val());
                                return false;
                            }
                        });
                    }
                }

                if (typeof callback === "function") callback(data);
            },
            error: function () {
                console.log("Error al cargar listas de precio");
                if (typeof callback === "function") callback([]);
            }
        });
    }
    function cargarVendedores() {
        $.ajax({
            url: "/PuntoVenta/Buscar_Vendedores",
            type: "GET",
            dataType: "json",
            success: function (data) {
                //let html = '<option value=""><< Seleccionar >></option>';
                let html = '';

                data.forEach(function (item) {
                    html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
                });

                $("#ddlVentaVendedor").html(html);
                $("#ddlBusquedaVendedor").html(html);
            },
            error: function (xhr) {
                console.log("Error al cargar vendedores", xhr.responseText);
            }
        });
    }
    function cargarAlmacenes() {
        $.ajax({
            url: "/PuntoVenta/Buscar_Almacenes",
            type: "GET",
            data: { nombreBusqueda: "" },
            dataType: "json",
            success: function (data) {
                //let html = '<option value=""><< Seleccionar >></option>';
                let html = '';

                data.forEach(function (item) {
                    html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
                });

                $("#ddlVentaAlmacen").html(html);
            },
            error: function (xhr) {
                console.log("Error al cargar almacenes", xhr.responseText);
            }
        });
    }
    function cargarTiposEmbalaje() {
        $.ajax({
            url: "/PuntoVenta/Buscar_TiposEmbalaje",
            type: "GET",
            dataType: "json",
            success: function (data) {

                let html = '';

                data.forEach(function (item) {
                    html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
                });

                $("#ddlLogisticaTipoEmbalaje").html(html);
            },
            error: function (xhr) {
                console.log("Error al cargar tipos de embalaje", xhr.responseText);
            }
        });
    }
    let catalogoHorasEntregaMaster = [];

    function cargarLugaresEntrega(callback) {
        $.ajax({
            url: "/PuntoVenta/Buscar_LugaresEntrega",
            type: "GET",
            dataType: "json",
            success: function (data) {

                let html = '';

                data.forEach(function (item) {
                    html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
                });

                $("#ddlLogisticaLugarEntrega").html(html);
                $("#ddlLogisticaLugarEntrega").val("CENTRO");
                actualizarEstadoHorasEntrega();
                actualizarEstadoLugarEnvio({ esLimpieza: false });
                if (typeof callback === "function") callback(data);
            },
            error: function (xhr) {
                console.log("Error al cargar lugares de entrega", xhr.responseText);
                if (typeof callback === "function") callback([]);
            }
        });
    }

    function actualizarEstadoLugarEnvio(opciones) {
        opciones = opciones || {};
        var lugar = ($("#ddlLogisticaLugarEntrega").val() || "").trim().toUpperCase();
        var $txtLugarEnvio = $("#txtLogisticaLugarEnvio");
        var $btnDesbloquear = $("#btnDesbloquearLugarEnvio");
        var esReadOnly = opciones.esReadOnly || (PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly());

        if (esReadOnly) {
            $txtLugarEnvio.prop("readonly", true);
            $btnDesbloquear.prop("disabled", true);
            return;
        }

        if (lugar === "AGENCIA") {
            $txtLugarEnvio.prop("readonly", false).removeClass("bg-light");
            $btnDesbloquear.prop("disabled", true).addClass("d-none");
        } else {
            if (opciones.esCambioManual || opciones.esLimpieza) {
                $txtLugarEnvio.val("");
            }
            $txtLugarEnvio.prop("readonly", true).addClass("bg-light");
            $btnDesbloquear.prop("disabled", false).removeClass("d-none");
        }
    }

    function actualizarEstadoAgencia(opciones) {
        actualizarEstadoLugarEnvio(opciones);
    }
    function parsearFecha(fechaStr) {
        if (!fechaStr) return null;
        let dia, mes, anio;
        if (fechaStr.indexOf("/") !== -1) {
            const partes = fechaStr.split("/");
            if (partes.length === 3) {
                dia = parseInt(partes[0], 10);
                mes = parseInt(partes[1], 10) - 1;
                anio = parseInt(partes[2], 10);
            }
        } else if (fechaStr.indexOf("-") !== -1) {
            const partes = fechaStr.split("-");
            if (partes.length === 3) {
                anio = parseInt(partes[0], 10);
                mes = parseInt(partes[1], 10) - 1;
                dia = parseInt(partes[2], 10);
            }
        }
        if (dia !== undefined && mes !== undefined && anio !== undefined) {
            return new Date(anio, mes, dia);
        }
        const d = new Date(fechaStr);
        return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function esFechaHoy(fechaStr) {
        const d = parsearFecha(fechaStr);
        if (!d) return false;
        const hoy = new Date();
        return hoy.getFullYear() === d.getFullYear() && hoy.getMonth() === d.getMonth() && hoy.getDate() === d.getDate();
    }

    function obtenerHora24DesdeOpcion(val, texto) {
        const numVal = parseInt(val, 10);
        if (!isNaN(numVal) && numVal >= 1 && numVal <= 14) {
            return numVal + 6; // '01' -> 7, '06' -> 12, '07' -> 13, '14' -> 20
        }
        const str = ((texto || "") + " " + (val || "")).toLowerCase();
        const match = str.match(/(\d{1,2})(?::(\d{2}))?/);
        if (!match) return -1;
        let h = parseInt(match[1], 10);
        if (/\b(p\.?\s*m\.?|pm)\b/.test(str) && h < 12) h += 12;
        else if (/\b(a\.?\s*m\.?|am)\b/.test(str) && h === 12) h = 0;
        return h;
    }

    function actualizarEstadoHorasEntrega(forzarPrimera, valorPreservar) {
        const $select = $("#ddlLogisticaHoraEntrega");
        if (!$select.length) return;

        // Si la lista maestra aún no tiene datos pero el select sí tiene opciones, capturarlas
        if (catalogoHorasEntregaMaster.length === 0 && $select.find("option").length > 0) {
            $select.find("option").each(function () {
                const val = $(this).val();
                const nom = $(this).text();
                if (val || nom) {
                    catalogoHorasEntregaMaster.push({ CODIGO: val, NOMBRE: nom });
                }
            });
        }

        const isReadOnly = window.PV && PV.Detalle && typeof PV.Detalle.isReadOnly === "function" && PV.Detalle.isReadOnly();

        const $ddlLugar = $("#ddlLogisticaLugarEntrega");
        const lugarVal = ($ddlLugar.val() || "").trim().toUpperCase();
        const lugarTexto = ($ddlLugar.find("option:selected").text() || "").trim().toUpperCase();
        const lugaresRestringidos = ["AGENCIA", "CENTRO", "DOMICILIO"];
        const esRestringido = lugaresRestringidos.includes(lugarVal) || lugaresRestringidos.includes(lugarTexto);

        const fechaAtencion = ($("#txtVentaFechaAtencion").val() || "").trim();
        const fechaEntrega = ($("#txtLogisticaFechaEntrega").val() || "").trim();
        const esHoy = esFechaHoy(fechaEntrega);

        const dAtencion = parsearFecha(fechaAtencion);
        const dEntrega = parsearFecha(fechaEntrega);
        const esPosterior = dAtencion && dEntrega && dEntrega.getTime() > dAtencion.getTime();

        const now = new Date();
        const horaActual = now.getHours();

        // Determinar qué valor intentar seleccionar/preservar
        const valActual = (valorPreservar !== undefined && valorPreservar !== null)
            ? String(valorPreservar).trim()
            : ($select.val() || "").trim();

        if (catalogoHorasEntregaMaster.length > 0) {
            let html = "";
            let tieneOpcionPreservar = false;

            catalogoHorasEntregaMaster.forEach(function (item) {
                const horaOpcion = obtenerHora24DesdeOpcion(item.CODIGO, item.NOMBRE);

                // Si es lugar restringido (Agencia, Centro, Domicilio), solo permitimos 8:00 a.m. y 1:00 p.m. (horas 8 y 13)
                if (esRestringido && horaOpcion !== 8 && horaOpcion !== 13) {
                    return;
                }

                let disabled = false;
                if (!isReadOnly && esHoy && horaOpcion !== -1 && horaOpcion <= horaActual) {
                    disabled = true;
                }

                if (valActual && (String(item.CODIGO).trim() === valActual || String(item.NOMBRE).trim() === valActual)) {
                    tieneOpcionPreservar = true;
                }

                html += `<option value="${item.CODIGO}" ${disabled ? "disabled" : ""}>${item.NOMBRE}</option>`;
            });

            // En modo consulta / ver, si el valor guardado no estuviera en las opciones filtradas, agregarlo para no perder visualización histórica
            if (isReadOnly && valActual && !tieneOpcionPreservar) {
                html += `<option value="${valActual}">${valActual}</option>`;
            }

            $select.html(html);
        } else {
            // Si no hay catálogo maestro cargado aún, solo actualizar disabled sobre el HTML existente
            $select.find("option").each(function () {
                const $opt = $(this);
                const val = $opt.val();
                const texto = $opt.text();
                if (!val && !texto) return;

                if (!isReadOnly && esHoy) {
                    const horaOpcion = obtenerHora24DesdeOpcion(val, texto);
                    if (horaOpcion !== -1 && horaOpcion <= horaActual) {
                        $opt.prop("disabled", true);
                    } else {
                        $opt.prop("disabled", false);
                    }
                } else {
                    $opt.prop("disabled", false);
                }
            });
        }

        if (isReadOnly) {
            $select.find("option").prop("disabled", false);
            if (valActual) {
                $select.val(valActual);
            }
            return;
        }

        if (valActual && $select.find(`option[value='${valActual}']:not(:disabled)`).length > 0) {
            $select.val(valActual);
        } else if (forzarPrimera || esPosterior || $select.find("option:selected").length === 0 || $select.find("option:selected").is(":disabled")) {
            const $primerHabilitado = $select.find("option:not(:disabled):first");
            if ($primerHabilitado.length > 0) {
                $select.val($primerHabilitado.val());
            } else {
                $select.val("");
            }
        }
    }

    function cargarHorasEntrega(onComplete) {
        $.ajax({
            url: "/PuntoVenta/Buscar_HorasEntrega",
            type: "GET",
            dataType: "json",
            success: function (data) {
                catalogoHorasEntregaMaster = data || [];
                actualizarEstadoHorasEntrega();
                if (typeof onComplete === "function") onComplete();
            },
            error: function (xhr) {
                console.log("Error al cargar horas de entrega", xhr.responseText);
                if (typeof onComplete === "function") onComplete();
            }
        });
    }
    function cargarModosEnvio() {
        $.ajax({
            url: "/PuntoVenta/Buscar_ModosEnvio",
            type: "GET",
            dataType: "json",
            success: function (data) {

                let html = '';

                data.forEach(function (item) {
                    html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
                });

                $("#ddlLogisticaModoEnvio").html(html);
            },
            error: function (xhr) {
                console.log("Error al cargar modos de envío", xhr.responseText);
            }
        });
    }
    function cargarTiposComprobante() {
        $.ajax({
            url: "/PuntoVenta/Buscar_TiposComprobante",
            type: "GET",
            data: { nombreBusqueda: "" },
            dataType: "json",
            success: function (data) {
                let html = "";

                data.forEach(function (item) {
                    html += `<option value="${item.CODIGO}">${item.NOMBRE}</option>`;
                });

                $("#ddlFinancieroTipoComprobante").html(html);
                $("#ddlFinancieroTipoComprobante").val('01');
            },
            error: function (xhr) {
                console.log("Error al cargar tipos de comprobante", xhr.responseText);
            }
        });
    }
    function fijarFormaPagoEnCombo(valorOTexto) {
        if (valorOTexto === undefined || valorOTexto === null || String(valorOTexto).trim() === "") return;
        var targetStr = String(valorOTexto).trim();
        var targetUpper = targetStr.toUpperCase();
        var $combo = $("#ddlFinancieroFormaPago");

        // 1. Coincidencia por value (código)
        var $optByVal = $combo.find("option").filter(function () {
            return String($(this).val()).trim() === targetStr;
        });
        if ($optByVal.length > 0) {
            $combo.val($optByVal.val());
            return;
        }

        // 2. Coincidencia por texto exacto
        var $optByText = $combo.find("option").filter(function () {
            return $(this).text().trim().toUpperCase() === targetUpper;
        });
        if ($optByText.length > 0) {
            $combo.val($optByText.val());
            return;
        }

        // 3. Coincidencia normalizada sin asteriscos (ej. "CONTRA ENTREGA" vs "CONTRA ENTREGA *")
        var targetNorm = targetUpper.replace(/\*/g, "").trim();
        var $optByNorm = $combo.find("option").filter(function () {
            var optNorm = $(this).text().trim().toUpperCase().replace(/\*/g, "").trim();
            return optNorm === targetNorm;
        });
        if ($optByNorm.length > 0) {
            $combo.val($optByNorm.val());
            return;
        }

        // 4. Fallback: agregar opción para no perder el dato guardado en SQL
        $combo.append(new Option(targetStr, targetStr, true, true));
        $combo.val(targetStr);
    }

    function cargarFormasPago(condicionPago, onComplete, valorSeleccionado) {
        $.ajax({
            url: "/PuntoVenta/Buscar_FormasPago",
            type: "GET",
            data: { condicionPago: condicionPago || "" },
            dataType: "json",
            success: function (data) {
                var defaultUpper = (condicionPago || "").trim().toUpperCase();
                var siempreIncluir = ["CONTADO *", "CONTRA ENTREGA *"];
                var nombresPermitidos = new Set(siempreIncluir.map(function (s) { return s.toUpperCase(); }));

                if (defaultUpper && !nombresPermitidos.has(defaultUpper)) {
                    nombresPermitidos.add(defaultUpper);
                }

                var filtrados = (data || []).filter(function (item) {
                    return nombresPermitidos.has((item.NOMBRE || "").trim().toUpperCase());
                });

                var html = "";
                filtrados.forEach(function (item) {
                    html += '<option value="' + item.CODIGO + '">' + item.NOMBRE + '</option>';
                });

                var $combo = $("#ddlFinancieroFormaPago");
                $combo.html(html);

                var tieneValorExplícito = valorSeleccionado !== undefined && valorSeleccionado !== null && String(valorSeleccionado).trim() !== "";

                if (tieneValorExplícito) {
                    fijarFormaPagoEnCombo(valorSeleccionado);
                } else if (condicionPago) {
                    $combo.find("option").filter(function () {
                        return $(this).text().trim().toUpperCase() === defaultUpper;
                    }).prop("selected", true);
                }

                if (typeof onComplete === "function") onComplete();
            },
            error: function (xhr) {
                console.log("Error al cargar formas de pago", xhr.responseText);
                if (typeof onComplete === "function") onComplete();
            }
        });
    }

    return {
        cargarTodo,
        cargarListaPrecios,
        cargarFormasPago,
        fijarFormaPago: fijarFormaPagoEnCombo,
        cargarHorasEntrega,
        actualizarEstadoHorasEntrega,
        actualizarEstadoLugarEnvio,
        actualizarEstadoAgencia
    };

})();