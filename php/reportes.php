<?php

date_default_timezone_set('America/Mexico_City');
class Reportes {
    private function periodoRango($periodo) {
        $periodo = in_array($periodo, ['dia','semana','mes'], true) ? $periodo : 'dia';
        if ($periodo === 'semana') return [date('Y-m-d', strtotime('-6 days')), date('Y-m-d')];
        if ($periodo === 'mes') return [date('Y-m-01'), date('Y-m-d')];
        return [date('Y-m-d'), date('Y-m-d')];
    }

    private function rangoFechas($inicio = null, $fin = null) {
        $inicio = $inicio ?: date('Y-m-d');
        $fin = $fin ?: $inicio;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $inicio)) $inicio = date('Y-m-d');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fin)) $fin = $inicio;
        return [$inicio . ' 00:00:00', $fin . ' 23:59:59', $inicio, $fin];
    }

    public function getHistorialCortes($fecha_inicio = null, $fecha_fin = null, $busqueda = '') {
        global $conn;
        try {
            [$iniDT, $finDT] = $this->rangoFechas($fecha_inicio ?: date('Y-m-d'), $fecha_fin ?: date('Y-m-d'));
            $busqueda = trim((string)$busqueda);

            $sql = "SELECT
                    c.id,
                    c.fecha_apertura,
                    c.fecha_cierre,
                    c.monto_inicial,
                    c.monto_final,
                    c.total_ventas,
                    c.diferencia,
                    c.estado,
                    c.observaciones,
                    COALESCE(SUM(CASE WHEN v.estado='activa' THEN v.total ELSE 0 END),0) AS total_vendido,
                    COALESCE(SUM(CASE WHEN v.estado='activa' AND v.metodo_pago='Efectivo' THEN v.total ELSE 0 END),0) AS total_efectivo,
                    COALESCE(SUM(CASE WHEN v.estado='activa' AND v.metodo_pago='Tarjeta' THEN v.total ELSE 0 END),0) AS total_tarjeta,
                    COALESCE(SUM(CASE WHEN v.estado='activa' AND v.metodo_pago='Transferencia' THEN v.total ELSE 0 END),0) AS total_transferencia,
                    COUNT(DISTINCT CASE WHEN v.estado='activa' THEN v.id END) AS ventas_realizadas,
                    COUNT(DISTINCT CASE WHEN v.estado='cancelada' THEN v.id END) AS tickets_cancelados,
                    COALESCE((SELECT SUM(mc.monto) FROM movimientos_caja mc WHERE mc.corte_caja_id=c.id AND mc.tipo='egreso'),0) AS total_gastos
                FROM cortes_caja c
                LEFT JOIN ventas v ON v.corte_caja_id = c.id
                WHERE c.fecha_apertura BETWEEN ? AND ?";
            $params = [$iniDT, $finDT];
            $types = 'ss';
            if ($busqueda !== '') {
                $sql .= " AND (c.id = ? OR c.observaciones LIKE ?)";
                $id = intval($busqueda);
                $like = '%' . $busqueda . '%';
                $params[] = $id;
                $params[] = $like;
                $types .= 'is';
            }
            $sql .= " GROUP BY c.id ORDER BY c.fecha_apertura DESC LIMIT 200";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $result = $stmt->get_result();
            $cortes = [];
            while ($row = $result->fetch_assoc()) $cortes[] = $row;
            $stmt->close();
            return ['success' => true, 'cortes' => $cortes];
        } catch (Exception $e) {
            error_log('Error getHistorialCortes: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Error al cargar historial de cortes'];
        }
    }

    public function getDetalleCorteReporte($corte_id) {
        global $conn;
        try {
            $corte_id = filter_var($corte_id, FILTER_VALIDATE_INT);
            if (!$corte_id) return ['success'=>false,'message'=>'Corte inválido'];

            $stmt = $conn->prepare("SELECT * FROM cortes_caja WHERE id=?");
            $stmt->bind_param('i', $corte_id);
            $stmt->execute();
            $corte = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$corte) return ['success'=>false,'message'=>'Corte no encontrado'];

            $stmt = $conn->prepare("SELECT metodo_pago, estado, COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS total FROM ventas WHERE corte_caja_id=? GROUP BY metodo_pago, estado ORDER BY metodo_pago");
            $stmt->bind_param('i', $corte_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $metodos = [];
            while ($row = $result->fetch_assoc()) $metodos[] = $row;
            $stmt->close();

            $stmt = $conn->prepare("SELECT folio, fecha, metodo_pago, subtotal, total, estado FROM ventas WHERE corte_caja_id=? ORDER BY fecha DESC LIMIT 150");
            $stmt->bind_param('i', $corte_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $ventas = [];
            while ($row = $result->fetch_assoc()) $ventas[] = $row;
            $stmt->close();

            $stmt = $conn->prepare("SELECT tipo, concepto, monto, referencia, fecha FROM movimientos_caja WHERE corte_caja_id=? ORDER BY fecha DESC");
            $stmt->bind_param('i', $corte_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $movimientos = [];
            while ($row = $result->fetch_assoc()) $movimientos[] = $row;
            $stmt->close();

            return ['success'=>true,'corte'=>$corte,'metodos'=>$metodos,'ventas'=>$ventas,'movimientos'=>$movimientos];
        } catch (Exception $e) {
            error_log('Error getDetalleCorteReporte: ' . $e->getMessage());
            return ['success'=>false,'message'=>'Error al cargar detalle del corte'];
        }
    }

    public function getResumenFinanciero($periodo='dia') {
        global $conn;
        try {
            [$inicio, $fin] = $this->periodoRango($periodo);
            [$iniDT, $finDT] = $this->rangoFechas($inicio, $fin);

            $stmt = $conn->prepare("SELECT
                    COALESCE(SUM(CASE WHEN estado='activa' THEN total ELSE 0 END),0) AS ingresos,
                    COALESCE(SUM(CASE WHEN estado='cancelada' THEN total ELSE 0 END),0) AS cancelaciones,
                    COUNT(CASE WHEN estado='activa' THEN 1 END) AS ventas_activas,
                    COUNT(CASE WHEN estado='cancelada' THEN 1 END) AS ventas_canceladas,
                    COALESCE(SUM(CASE WHEN estado='activa' AND metodo_pago='Efectivo' THEN total ELSE 0 END),0) AS efectivo,
                    COALESCE(SUM(CASE WHEN estado='activa' AND metodo_pago='Tarjeta' THEN total ELSE 0 END),0) AS tarjeta,
                    COALESCE(SUM(CASE WHEN estado='activa' AND metodo_pago='Transferencia' THEN total ELSE 0 END),0) AS transferencia
                FROM ventas WHERE fecha BETWEEN ? AND ?");
            $stmt->bind_param('ss', $iniDT, $finDT);
            $stmt->execute();
            $resumen = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            $stmt = $conn->prepare("SELECT COALESCE(SUM(mc.monto),0) AS egresos FROM movimientos_caja mc WHERE mc.tipo='egreso' AND mc.fecha BETWEEN ? AND ?");
            $stmt->bind_param('ss', $iniDT, $finDT);
            $stmt->execute();
            $egresos = floatval($stmt->get_result()->fetch_assoc()['egresos'] ?? 0);
            $stmt->close();

            $stmt = $conn->prepare("SELECT p.id, p.nombre, p.categoria, COALESCE(SUM(dv.cantidad),0) AS unidades, COALESCE(SUM(dv.subtotal),0) AS ingreso FROM detalles_venta dv JOIN ventas v ON v.id=dv.venta_id AND v.estado='activa' JOIN productos p ON p.id=dv.producto_id WHERE v.fecha BETWEEN ? AND ? GROUP BY p.id, p.nombre, p.categoria ORDER BY ingreso DESC LIMIT 8");
            $stmt->bind_param('ss', $iniDT, $finDT);
            $stmt->execute();
            $result = $stmt->get_result();
            $mayor = [];
            while ($row = $result->fetch_assoc()) $mayor[] = $row;
            $stmt->close();

            $stmt = $conn->prepare("SELECT p.id, p.nombre, p.categoria, COALESCE(SUM(dv.cantidad),0) AS unidades, COALESCE(SUM(dv.subtotal),0) AS ingreso FROM productos p LEFT JOIN detalles_venta dv ON dv.producto_id=p.id LEFT JOIN ventas v ON v.id=dv.venta_id AND v.estado='activa' AND v.fecha BETWEEN ? AND ? GROUP BY p.id, p.nombre, p.categoria HAVING ingreso >= 0 ORDER BY ingreso ASC, unidades ASC LIMIT 8");
            $stmt->bind_param('ss', $iniDT, $finDT);
            $stmt->execute();
            $result = $stmt->get_result();
            $menor = [];
            while ($row = $result->fetch_assoc()) $menor[] = $row;
            $stmt->close();

            $stmt = $conn->prepare("SELECT p.id, p.nombre, p.categoria, p.stock_actual, p.precio, (p.stock_actual*p.precio) AS valor_detenido FROM productos p WHERE p.stock_actual > 0 AND NOT EXISTS (SELECT 1 FROM detalles_venta dv JOIN ventas v ON v.id=dv.venta_id AND v.estado='activa' WHERE dv.producto_id=p.id AND v.fecha BETWEEN ? AND ?) AND NOT EXISTS (SELECT 1 FROM movimientos_inventario mi WHERE mi.producto_id=p.id AND mi.fecha BETWEEN ? AND ?) ORDER BY valor_detenido DESC LIMIT 10");
            $stmt->bind_param('ssss', $iniDT, $finDT, $iniDT, $finDT);
            $stmt->execute();
            $result = $stmt->get_result();
            $estancados = [];
            while ($row = $result->fetch_assoc()) $estancados[] = $row;
            $stmt->close();

            $valor_estancado = 0;
            foreach ($estancados as $p) $valor_estancado += floatval($p['valor_detenido']);

            $ingresos = floatval($resumen['ingresos'] ?? 0);
            $cancelaciones = floatval($resumen['cancelaciones'] ?? 0);
            $utilidad = $ingresos - $egresos - $cancelaciones;

            return [
                'success'=>true,
                'periodo'=>['tipo'=>$periodo,'inicio'=>$inicio,'fin'=>$fin],
                'resumen'=>[
                    'ingresos'=>$ingresos,
                    'egresos'=>$egresos,
                    'cancelaciones'=>$cancelaciones,
                    'utilidad'=>$utilidad,
                    'ventas_activas'=>intval($resumen['ventas_activas'] ?? 0),
                    'ventas_canceladas'=>intval($resumen['ventas_canceladas'] ?? 0),
                    'efectivo'=>floatval($resumen['efectivo'] ?? 0),
                    'tarjeta'=>floatval($resumen['tarjeta'] ?? 0),
                    'transferencia'=>floatval($resumen['transferencia'] ?? 0),
                    'valor_estancado'=>$valor_estancado
                ],
                'productos_mayor_ganancia'=>$mayor,
                'productos_menor_rendimiento'=>$menor,
                'productos_estancados'=>$estancados
            ];
        } catch (Exception $e) {
            error_log('Error getResumenFinanciero: ' . $e->getMessage());
            return ['success'=>false,'message'=>'Error al cargar resumen financiero'];
        }
    }
}
?>
