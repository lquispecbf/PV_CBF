
    $(document).ready(function () {

        $.datepicker.regional['es'] = {
            closeText: 'Cerrar',
            prevText: '<Ant',
            nextText: 'Sig>',
            currentText: 'Hoy',
            monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
            monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
            dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Juv', 'Vie', 'Sáb'],
            dayNamesMin: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
            weekHeader: 'Sm',
            dateFormat: 'dd/mm/yy',
            firstDay: 1,
            isRTL: false,
            showMonthAfterYear: false,
            yearSuffix: ''
        };
        $.datepicker.setDefaults($.datepicker.regional['es']);


     });

    $(function () {
      
        $("#txtfecha_tipo_cambio").datepicker({ showAnim: 'drop' });
        $("#txtfecha_buscar").datepicker({ showAnim: 'drop' });
        $("#txt_fecha_servicio_transporte").datepicker({ showAnim: 'drop' });
        $("#txtfecha_factura").datepicker({ showAnim: 'drop' });
        $("#fecha_inicio_comprobante_buscar").datepicker({ showAnim: 'drop' });
        $("#fecha_fin_comprobante_buscar").datepicker({ showAnim: 'drop' });
        $("#fecha_inicio_comprobante_buscar2").datepicker({ showAnim: 'drop' });
        $("#fecha_fin_comprobante_buscar2").datepicker({ showAnim: 'drop' });
        
    }); 

    function pageLoad() {
     
        $("#txtfecha_tipo_cambio").datepicker({ showAnim: 'drop' });
        $("#txtfecha_buscar").datepicker({ showAnim: 'drop' });
        $("#txt_fecha_servicio_transporte").datepicker({ showAnim: 'drop' });
        $("#txtfecha_factura").datepicker({ showAnim: 'drop' });
        $("#fecha_fin_comprobante_buscar").datepicker({ showAnim: 'drop' });
        $("#fecha_inicio_comprobante_buscar2").datepicker({ showAnim: 'drop' });
        $("#fecha_fin_comprobante_buscar2").datepicker({ showAnim: 'drop' });
    };
 