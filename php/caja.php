<?php
require_once 'config.php';

class Caja {
    
    public function obtenerEstado() {
        global $conn;
        
        try {
            // Verificar si hay caja abierta
            $stmt = $conn->prepare("SELECT * FROM cortes_caja WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
            $stmt->execute();
            $result = $stmt->get_result();
            $caja_abierta = $result->fetch_assoc();
            $stmt->close();
            
            if ($caja_abierta) {
                // Obtener ventas del día que NO están asociadas a ningún corte (ventas del día actual)
                $stmt = $conn->prepare("SELECT COUNT(*) as total_ventas, COALESCE(SUM(total), 0) as total_ingresos 
                                        FROM ventas 
                                        WHERE DATE(fecha) = CURDATE()");
                $stmt->execute();
                $result = $stmt->get_result();
                $ventas_hoy = $result->fetch_assoc();
                $stmt->close();
                
                return [
                    'success' => true,
                    'caja_abierta' => true,
                    'caja' => $caja_abierta,
                    'ventas_hoy' => intval($ventas_hoy['total_ventas']),
                    'total_ventas_hoy' => floatval($ventas_hoy['total_ingresos'])
                ];
            }
            
            return [
                'success' => true,
                'caja_abierta' => false
            ];
            
        } catch (Exception $e) {
            error_log("Error en obtenerEstado: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener estado de caja'];
        }
    }
    
    public function abrirCaja($monto_inicial) {
        global $conn;
        
        try {
            $monto_inicial = filter_var($monto_inicial, FILTER_VALIDATE_FLOAT);
            
            if (!$monto_inicial || $monto_inicial < 0) {
                return ['success' => false, 'message' => 'Monto inicial inválido'];
            }
            
            // Verificar que no haya caja abierta
            $stmt = $conn->prepare("SELECT id FROM cortes_caja WHERE estado = 'abierta'");
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $stmt->close();
                return ['success' => false, 'message' => 'Ya hay una caja abierta'];
            }
            $stmt->close();
            
            $conn->begin_transaction();
            
            $stmt = $conn->prepare("INSERT INTO cortes_caja (fecha_apertura, monto_inicial, estado) VALUES (NOW(), ?, 'abierta')");
            $stmt->bind_param("d", $monto_inicial);
            
            if ($stmt->execute()) {
                $corte_id = $conn->insert_id;
                $stmt->close();
                
                // Registrar movimiento inicial
                $this->registrarMovimiento($corte_id, 'ingreso', 'Apertura de caja', $monto_inicial);
                
                $conn->commit();
                return ['success' => true, 'message' => 'Caja abierta exitosamente', 'corte_id' => $corte_id];
            } else {
                $conn->rollback();
                $stmt->close();
                return ['success' => false, 'message' => 'Error al abrir caja'];
            }
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
            
            if (!$monto_final || $monto_final < 0) {
                return ['success' => false, 'message' => 'Monto final inválido'];
            }
            
            // Obtener caja abierta
            $stmt = $conn->prepare("SELECT * FROM cortes_caja WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
            $stmt->execute();
            $result = $stmt->get_result();
            $caja = $result->fetch_assoc();
            $stmt->close();
            
            if (!$caja) {
                return ['success' => false, 'message' => 'No hay caja abierta'];
            }
            
            // Obtener ventas del día (TODAS las ventas del día, no solo las no asignadas)
            $stmt = $conn->prepare("SELECT COALESCE(SUM(total), 0) as total_ventas FROM ventas WHERE DATE(fecha) = CURDATE()");
            $stmt->execute();
            $result = $stmt->get_result();
            $ventas = $result->fetch_assoc();
            $total_ventas = floatval($ventas['total_ventas']);
            $stmt->close();
            
            // Obtener gastos del día
            $stmt = $conn->prepare("SELECT COALESCE(SUM(monto), 0) as total_gastos FROM movimientos_caja WHERE corte_caja_id = ? AND tipo = 'egreso'");
            $stmt->bind_param("i", $caja['id']);
            $stmt->execute();
            $result = $stmt->get_result();
            $gastos = $result->fetch_assoc();
            $total_gastos = floatval($gastos['total_gastos']);
            $stmt->close();
            
            // Calcular esperado vs real (considerando gastos)
            $esperado = $caja['monto_inicial'] + $total_ventas - $total_gastos;
            $diferencia = $monto_final - $esperado;
            
            $conn->begin_transaction();
            
            // Actualizar ventas con este corte
            $stmt = $conn->prepare("UPDATE ventas SET corte_caja_id = ? WHERE DATE(fecha) = CURDATE()");
            $stmt->bind_param("i", $caja['id']);
            $stmt->execute();
            $stmt->close();
            
            // Cerrar caja
            $stmt = $conn->prepare("UPDATE cortes_caja SET 
                                    fecha_cierre = NOW(), 
                                    monto_final = ?, 
                                    total_ventas = ?, 
                                    diferencia = ?, 
                                    estado = 'cerrada',
                                    observaciones = ? 
                                    WHERE id = ?");
            $stmt->bind_param("dddssi", $monto_final, $total_ventas, $diferencia, $observaciones, $caja['id']);
            $stmt->execute();
            $stmt->close();
            
            $conn->commit();
            
            return [
                'success' => true, 
                'message' => 'Caja cerrada exitosamente',
                'datos' => [
                    'inicial' => floatval($caja['monto_inicial']),
                    'ventas' => $total_ventas,
                    'gastos' => $total_gastos,
                    'esperado' => $esperado,
                    'final' => $monto_final,
                    'diferencia' => $diferencia,
                    'estado' => $diferencia == 0 ? 'cuadra' : ($diferencia > 0 ? 'sobró' : 'faltó')
                ]
            ];
            
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en cerrarCaja: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al cerrar caja: ' . $e->getMessage()];
        }
    }
    
    public function registrarMovimiento($corte_id, $tipo, $concepto, $monto, $referencia = '') {
        global $conn;
        
        try {
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
            // Obtener caja abierta
            $stmt = $conn->prepare("SELECT id FROM cortes_caja WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
            $stmt->execute();
            $result = $stmt->get_result();
            $caja = $result->fetch_assoc();
            $stmt->close();
            
            if (!$caja) {
                return ['success' => false, 'message' => 'No hay caja abierta'];
            }
            
            $monto = filter_var($monto, FILTER_VALIDATE_FLOAT);
            if (!$monto || $monto <= 0) {
                return ['success' => false, 'message' => 'Monto inválido'];
            }
            
            if ($this->registrarMovimiento($caja['id'], 'egreso', $concepto, $monto, $referencia)) {
                return ['success' => true, 'message' => 'Gasto registrado'];
            } else {
                return ['success' => false, 'message' => 'Error al registrar gasto'];
            }
        } catch (Exception $e) {
            error_log("Error en agregarGasto: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al registrar gasto: ' . $e->getMessage()];
        }
    }
    
    public function obtenerHistorial($fecha_inicio = null, $fecha_fin = null) {
        global $conn;
        
        try {
            $sql = "SELECT c.*, 
                           (SELECT COUNT(*) FROM ventas WHERE corte_caja_id = c.id) as num_ventas 
                    FROM cortes_caja c 
                    ORDER BY c.fecha_apertura DESC";
            
            $result = $conn->query($sql);
            
            $historial = [];
            while ($row = $result->fetch_assoc()) {
                $historial[] = $row;
            }
            
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
            if (!$corte_id) {
                return ['success' => false, 'message' => 'ID inválido'];
            }
            
            // Obtener datos del corte
            $stmt = $conn->prepare("SELECT * FROM cortes_caja WHERE id = ?");
            $stmt->bind_param("i", $corte_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $corte = $result->fetch_assoc();
            $stmt->close();
            
            if (!$corte) {
                return ['success' => false, 'message' => 'Corte no encontrado'];
            }
            
            // Obtener ventas de ese corte
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
            while ($row = $result->fetch_assoc()) {
                $ventas[] = $row;
            }
            $stmt->close();
            
            // Obtener movimientos de caja
            $stmt = $conn->prepare("SELECT * FROM movimientos_caja WHERE corte_caja_id = ? ORDER BY fecha");
            $stmt->bind_param("i", $corte_id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $movimientos = [];
            while ($row = $result->fetch_assoc()) {
                $movimientos[] = $row;
            }
            $stmt->close();
            
            return [
                'success' => true,
                'corte' => $corte,
                'ventas' => $ventas,
                'movimientos' => $movimientos
            ];
            
        } catch (Exception $e) {
            error_log("Error en obtenerDetalleCorte: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener detalle del corte'];
        }
    }
}
?>