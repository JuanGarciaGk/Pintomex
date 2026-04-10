<?php
require_once 'config.php';

class Caja {

    public function obtenerEstado() {
        global $conn;
        try {
            $stmt = $conn->prepare("SELECT * FROM cortes_caja WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
            $stmt->execute();
            $caja_abierta = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if ($caja_abierta) {
                $stmt = $conn->prepare("SELECT
                        COUNT(*) as total_ventas,
                        COUNT(CASE WHEN metodo_pago = 'Efectivo' THEN 1 END) as ventas_efectivo,
                        COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' THEN total ELSE 0 END), 0) as total_efectivo,
                        COALESCE(SUM(CASE WHEN metodo_pago != 'Efectivo' THEN total ELSE 0 END), 0) as total_electronico
                    FROM ventas
                    WHERE DATE(fecha) = CURDATE()
                    AND estado = 'activa'
                    AND (corte_caja_id = ? OR corte_caja_id IS NULL)");
                $stmt->bind_param("i", $caja_abierta['id']);
                $stmt->execute();
                $ventas_hoy = $stmt->get_result()->fetch_assoc();
                $stmt->close();

                $stmt = $conn->prepare("SELECT COALESCE(SUM(monto), 0) as total_gastos
                    FROM movimientos_caja WHERE corte_caja_id = ? AND tipo = 'egreso'");
                $stmt->bind_param("i", $caja_abierta['id']);
                $stmt->execute();
                $gastos_hoy = $stmt->get_result()->fetch_assoc();
                $stmt->close();

                return [
                    'success'          => true,
                    'caja_abierta'     => true,
                    'caja'             => $caja_abierta,
                    'ventas_hoy'       => intval($ventas_hoy['total_ventas']),
                    'ventas_efectivo'  => intval($ventas_hoy['ventas_efectivo']),
                    'total_ventas_hoy' => floatval($ventas_hoy['total_efectivo']),
                    'total_electronico'=> floatval($ventas_hoy['total_electronico']),
                    'total_gastos'     => floatval($gastos_hoy['total_gastos'])
                ];
            }

            return ['success' => true, 'caja_abierta' => false];
        } catch (Exception $e) {
            error_log("Error en obtenerEstado: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener estado de caja'];
        }
    }

    public function abrirCaja($monto_inicial) {
        global $conn;
        try {
            $monto_inicial = filter_var($monto_inicial, FILTER_VALIDATE_FLOAT);
            if ($monto_inicial === false || $monto_inicial < 0)
                return ['success' => false, 'message' => 'Monto inicial inválido'];
            if ($monto_inicial > 100000)
                return ['success' => false, 'message' => 'Monto inicial no puede exceder $100,000.00'];

            $stmt = $conn->prepare("SELECT id FROM cortes_caja WHERE estado = 'abierta'");
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) { $stmt->close(); return ['success' => false, 'message' => 'Ya hay una caja abierta']; }
            $stmt->close();

            $conn->begin_transaction();
            $stmt = $conn->prepare("INSERT INTO cortes_caja (fecha_apertura, monto_inicial, estado) VALUES (NOW(), ?, 'abierta')");
            $stmt->bind_param("d", $monto_inicial);
            if ($stmt->execute()) {
                $corte_id = $conn->insert_id;
                $stmt->close();
                $this->registrarMovimiento($corte_id, 'ingreso', 'Apertura de caja', $monto_inicial);
                $conn->commit();
                return ['success' => true, 'message' => 'Caja abierta exitosamente', 'corte_id' => $corte_id];
            }
            $conn->rollback();
            $stmt->close();
            return ['success' => false, 'message' => 'Error al abrir caja'];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en abrirCaja: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al abrir caja: ' . $e->getMessage()];
        }
    }

    public function cerrarCaja($monto_final, $observaciones = '') {
        global $conn;
        try {
            $monto_final = filter_var($monto_final, FILTER_VALIDATE_FLOAT);
            if ($monto_final === false || $monto_final < 0)
                return ['success' => false, 'message' => 'Monto final inválido'];
            if ($monto_final > 1000000)
                return ['success' => false, 'message' => 'Monto final no puede exceder $1,000,000.00'];

            $observaciones = substr($observaciones, 0, 500);

            $stmt = $conn->prepare("SELECT * FROM cortes_caja WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
            $stmt->execute();
            $caja = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$caja) return ['success' => false, 'message' => 'No hay caja abierta'];

            $stmt = $conn->prepare("SELECT
                    COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' THEN total ELSE 0 END), 0) as total_efectivo,
                    COALESCE(SUM(CASE WHEN metodo_pago != 'Efectivo' THEN total ELSE 0 END), 0) as total_electronico
                FROM ventas
                WHERE DATE(fecha) = CURDATE() AND estado = 'activa'
                AND (corte_caja_id = ? OR corte_caja_id IS NULL)");
            $stmt->bind_param("i", $caja['id']);
            $stmt->execute();
            $ventas = $stmt->get_result()->fetch_assoc();
            $total_efectivo    = floatval($ventas['total_efectivo']);
            $total_electronico = floatval($ventas['total_electronico']);
            $stmt->close();

            $stmt = $conn->prepare("SELECT COALESCE(SUM(monto), 0) as total_gastos
                FROM movimientos_caja WHERE corte_caja_id = ? AND tipo = 'egreso'");
            $stmt->bind_param("i", $caja['id']);
            $stmt->execute();
            $gastos = $stmt->get_result()->fetch_assoc();
            $total_gastos = floatval($gastos['total_gastos']);
            $stmt->close();

            $esperado   = $caja['monto_inicial'] + $total_efectivo - $total_gastos;
            $diferencia = $monto_final - $esperado;

            $conn->begin_transaction();

            $stmt = $conn->prepare("UPDATE ventas SET corte_caja_id = ? WHERE DATE(fecha) = CURDATE() AND corte_caja_id IS NULL AND estado = 'activa'");
            $stmt->bind_param("i", $caja['id']);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("UPDATE cortes_caja SET
                fecha_cierre = NOW(), monto_final = ?, total_ventas = ?, diferencia = ?,
                estado = 'cerrada', observaciones = ? WHERE id = ?");
            $stmt->bind_param("dddsi", $monto_final, $total_efectivo, $diferencia, $observaciones, $caja['id']);
            $stmt->execute();
            $stmt->close();

            $conn->commit();

            return [
                'success' => true,
                'message' => 'Caja cerrada exitosamente',
                'datos'   => [
                    'inicial'            => floatval($caja['monto_inicial']),
                    'ventas_efectivo'    => $total_efectivo,
                    'ventas_electronico' => $total_electronico,
                    'gastos'             => $total_gastos,
                    'esperado'           => $esperado,
                    'final'              => $monto_final,
                    'diferencia'         => $diferencia,
                    'estado'             => $diferencia == 0 ? 'cuadra' : ($diferencia > 0 ? 'sobró' : 'faltó')
                ]
            ];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en cerrarCaja: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al cerrar caja: ' . $e->getMessage()];
        }
    }

    public function recalcularCorte($corte_id) {
        global $conn;
        try {
            $stmt = $conn->prepare("SELECT * FROM cortes_caja WHERE id = ? AND estado = 'cerrada'");
            $stmt->bind_param("i", $corte_id);
            $stmt->execute();
            $corte = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$corte) return false;

            $stmt = $conn->prepare("SELECT
                    COALESCE(SUM(CASE WHEN metodo_pago = 'Efectivo' THEN total ELSE 0 END), 0) as total_efectivo
                FROM ventas WHERE corte_caja_id = ? AND estado = 'activa'");
            $stmt->bind_param("i", $corte_id);
            $stmt->execute();
            $ventas = $stmt->get_result()->fetch_assoc();
            $total_efectivo = floatval($ventas['total_efectivo']);
            $stmt->close();

            $stmt = $conn->prepare("SELECT COALESCE(SUM(monto), 0) as total_gastos
                FROM movimientos_caja WHERE corte_caja_id = ? AND tipo = 'egreso'");
            $stmt->bind_param("i", $corte_id);
            $stmt->execute();
            $gastos = $stmt->get_result()->fetch_assoc();
            $total_gastos = floatval($gastos['total_gastos']);
            $stmt->close();

            $esperado   = floatval($corte['monto_inicial']) + $total_efectivo - $total_gastos;
            $diferencia = floatval($corte['monto_final']) - $esperado;

            $stmt = $conn->prepare("UPDATE cortes_caja SET total_ventas = ?, diferencia = ? WHERE id = ?");
            $stmt->bind_param("ddi", $total_efectivo, $diferencia, $corte_id);
            $result = $stmt->execute();
            $stmt->close();
            return $result;
        } catch (Exception $e) {
            error_log("Error en recalcularCorte: " . $e->getMessage());
            return false;
        }
    }

    public function registrarMovimiento($corte_id, $tipo, $concepto, $monto, $referencia = '') {
        global $conn;
        try {
            if (!in_array($tipo, ['ingreso', 'egreso'])) return false;
            $concepto   = substr($concepto, 0, 255);
            $monto      = floatval($monto);
            if ($monto <= 0) return false;
            $referencia = substr($referencia, 0, 100);

            $stmt = $conn->prepare("INSERT INTO movimientos_caja (corte_caja_id, tipo, concepto, monto, referencia) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("issds", $corte_id, $tipo, $concepto, $monto, $referencia);
            $result = $stmt->execute();
            $stmt->close();
            return $result;
        } catch (Exception $e) {
            error_log("Error en registrarMovimiento: " . $e->getMessage());
            return false;
        }
    }

    public function agregarGasto($concepto, $monto, $referencia = '') {
        global $conn;
        try {
            if (empty($concepto)) return ['success' => false, 'message' => 'Concepto requerido'];
            $concepto = substr($concepto, 0, 255);
            $monto    = filter_var($monto, FILTER_VALIDATE_FLOAT);
            if ($monto === false || $monto <= 0) return ['success' => false, 'message' => 'Monto inválido'];
            if ($monto > 50000) return ['success' => false, 'message' => 'El gasto no puede exceder $50,000.00'];
            $referencia = substr($referencia, 0, 100);

            $stmt = $conn->prepare("SELECT id FROM cortes_caja WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
            $stmt->execute();
            $caja = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$caja) return ['success' => false, 'message' => 'No hay caja abierta'];

            if ($this->registrarMovimiento($caja['id'], 'egreso', $concepto, $monto, $referencia))
                return ['success' => true, 'message' => 'Gasto registrado'];

            return ['success' => false, 'message' => 'Error al registrar gasto'];
        } catch (Exception $e) {
            error_log("Error en agregarGasto: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al registrar gasto: ' . $e->getMessage()];
        }
    }

    public function obtenerHistorial($fecha_inicio = null, $fecha_fin = null) {
        global $conn;
        try {
            $result = $conn->query("SELECT c.*,
                (SELECT COUNT(*) FROM ventas WHERE corte_caja_id = c.id AND estado = 'activa') as num_ventas,
                (SELECT COALESCE(SUM(monto), 0) FROM movimientos_caja WHERE corte_caja_id = c.id AND tipo = 'egreso') as total_gastos
                FROM cortes_caja c ORDER BY c.fecha_apertura DESC");

            $historial = [];
            while ($row = $result->fetch_assoc()) $historial[] = $row;
            return ['success' => true, 'historial' => $historial];
        } catch (Exception $e) {
            error_log("Error en obtenerHistorial: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener historial'];
        }
    }

    public function obtenerDetalleCorte($corte_id) {
        global $conn;
        try {
            $corte_id = filter_var($corte_id, FILTER_VALIDATE_INT);
            if (!$corte_id || $corte_id <= 0) return ['success' => false, 'message' => 'ID inválido'];

            $stmt = $conn->prepare("SELECT * FROM cortes_caja WHERE id = ?");
            $stmt->bind_param("i", $corte_id);
            $stmt->execute();
            $corte = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$corte) return ['success' => false, 'message' => 'Corte no encontrado'];

            $stmt = $conn->prepare("SELECT v.*, COUNT(dv.id) as total_productos
                FROM ventas v
                LEFT JOIN detalles_venta dv ON v.id = dv.venta_id
                WHERE v.corte_caja_id = ?
                GROUP BY v.id
                ORDER BY v.fecha DESC");
            $stmt->bind_param("i", $corte_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $ventas = [];
            while ($row = $result->fetch_assoc()) $ventas[] = $row;
            $stmt->close();

            $stmt = $conn->prepare("SELECT * FROM movimientos_caja WHERE corte_caja_id = ? ORDER BY fecha");
            $stmt->bind_param("i", $corte_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $movimientos = [];
            while ($row = $result->fetch_assoc()) $movimientos[] = $row;
            $stmt->close();

            $total_ventas_activas    = 0;
            $total_ventas_canceladas = 0;
            $count_activas           = 0;
            $count_canceladas        = 0;
            foreach ($ventas as $v) {
                if ($v['estado'] === 'activa') {
                    $total_ventas_activas += floatval($v['total']);
                    $count_activas++;
                } else {
                    $total_ventas_canceladas += floatval($v['total']);
                    $count_canceladas++;
                }
            }

            return [
                'success'                 => true,
                'corte'                   => $corte,
                'ventas'                  => $ventas,
                'movimientos'             => $movimientos,
                'resumen'                 => [
                    'total_ventas_activas'    => $total_ventas_activas,
                    'total_ventas_canceladas' => $total_ventas_canceladas,
                    'count_activas'           => $count_activas,
                    'count_canceladas'        => $count_canceladas
                ]
            ];
        } catch (Exception $e) {
            error_log("Error en obtenerDetalleCorte: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener detalle del corte'];
        }
    }
}
?>