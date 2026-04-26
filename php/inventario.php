<?php
require_once 'config.php';

class Inventario {

    public function getResumen() {
        global $conn;
        try {
            $resumen = [];
            $resumen['total_productos']  = (int)$conn->query("SELECT COUNT(*) FROM productos")->fetch_row()[0];
            $resumen['valor_inventario'] = (float)$conn->query("SELECT COALESCE(SUM(stock_actual * precio),0) FROM productos")->fetch_row()[0];
            $resumen['stock_bajo']       = (int)$conn->query("SELECT COUNT(*) FROM productos WHERE stock_actual <= stock_minimo AND stock_actual > 0")->fetch_row()[0];
            $resumen['sin_stock']        = (int)$conn->query("SELECT COUNT(*) FROM productos WHERE stock_actual = 0")->fetch_row()[0];

            $hoy = $conn->query("
                SELECT
                    COUNT(*) AS total,
                    COUNT(CASE WHEN tipo = 'entrada' THEN 1 END) AS entradas,
                    COUNT(CASE WHEN tipo = 'salida'  THEN 1 END) AS salidas,
                    COUNT(CASE WHEN tipo = 'ajuste'  THEN 1 END) AS ajustes
                FROM movimientos_inventario
                WHERE DATE(fecha) = CURDATE()")->fetch_assoc();

            $resumen['movimientos_hoy'] = (int)($hoy['total'] ?? 0);

            $semana = $conn->query("
                SELECT
                    COUNT(CASE WHEN tipo = 'entrada' THEN 1 END) AS entradas_semana,
                    COUNT(CASE WHEN tipo IN ('salida','ajuste') THEN 1 END) AS salidas_semana
                FROM movimientos_inventario
                WHERE fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)")->fetch_assoc();

            $resumen['entradas_semana'] = (int)($semana['entradas_semana'] ?? 0);
            $resumen['salidas_semana']  = (int)($semana['salidas_semana']  ?? 0);

            return ['success' => true, 'resumen' => $resumen];
        } catch (Exception $e) {
            error_log("Error en getResumen: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener resumen'];
        }
    }

    public function getAlertas() {
        global $conn;
        try {
            $result = $conn->query("
                SELECT id, codigo_barras, nombre, categoria, stock_actual, stock_minimo
                FROM productos
                WHERE stock_actual <= stock_minimo
                ORDER BY stock_actual ASC
                LIMIT 50");

            $alertas = [];
            while ($row = $result->fetch_assoc()) {
                if ((int)$row['stock_actual'] === 0) {
                    $row['nivel_alerta'] = 'critico';
                } elseif ((int)$row['stock_actual'] <= (int)ceil($row['stock_minimo'] * 0.5)) {
                    $row['nivel_alerta'] = 'bajo';
                } else {
                    $row['nivel_alerta'] = 'precaucion';
                }
                $alertas[] = $row;
            }

            $mas = $conn->query("
                SELECT p.id, p.nombre, p.categoria, p.stock_actual,
                    COALESCE(SUM(dv.cantidad), 0) AS total_vendido,
                    COUNT(DISTINCT v.id) AS num_ventas
                FROM productos p
                LEFT JOIN detalles_venta dv ON dv.producto_id = p.id
                LEFT JOIN ventas v ON v.id = dv.venta_id
                    AND v.estado = 'activa'
                    AND v.fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY p.id
                ORDER BY total_vendido DESC
                LIMIT 5")->fetch_all(MYSQLI_ASSOC);

            $menos = $conn->query("
                SELECT p.id, p.nombre, p.categoria, p.stock_actual,
                    COALESCE(SUM(dv.cantidad), 0) AS total_vendido,
                    COUNT(DISTINCT v.id) AS num_ventas
                FROM productos p
                INNER JOIN detalles_venta dv ON dv.producto_id = p.id
                INNER JOIN ventas v ON v.id = dv.venta_id
                    AND v.estado = 'activa'
                    AND v.fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY p.id
                HAVING total_vendido > 0
                ORDER BY total_vendido ASC
                LIMIT 5")->fetch_all(MYSQLI_ASSOC);

            return [
                'success'        => true,
                'alertas'        => $alertas,
                'total'          => count($alertas),
                'mas_vendidos'   => $mas,
                'menos_vendidos' => $menos,
            ];
        } catch (Exception $e) {
            error_log("Error en getAlertas: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener alertas'];
        }
    }

    public function getMasVendidos(string $periodo = 'semana'): array {
        global $conn;
        try {
            $dias = match($periodo) {
                'mes'  => 30,
                'año'  => 365,
                default => 7,
            };
            $productos = $conn->query("
                SELECT p.id, p.nombre, p.categoria, p.stock_actual,
                    COALESCE(SUM(dv.cantidad), 0) AS total_vendido
                FROM productos p
                LEFT JOIN detalles_venta dv ON dv.producto_id = p.id
                LEFT JOIN ventas v ON v.id = dv.venta_id
                    AND v.estado = 'activa'
                    AND v.fecha >= DATE_SUB(NOW(), INTERVAL {$dias} DAY)
                GROUP BY p.id
                ORDER BY total_vendido DESC
                LIMIT 10")->fetch_all(MYSQLI_ASSOC);

            return ['success' => true, 'productos' => $productos];
        } catch (Exception $e) {
            error_log("Error en getMasVendidos: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener tendencias'];
        }
    }

    public function getMenosVendidos(string $periodo = 'semana'): array {
        global $conn;
        try {
            $dias = match($periodo) {
                'mes'  => 30,
                'año'  => 365,
                default => 7,
            };
            $productos = $conn->query("
                SELECT p.id, p.nombre, p.categoria, p.stock_actual,
                    COALESCE(SUM(dv.cantidad), 0) AS total_vendido
                FROM productos p
                INNER JOIN detalles_venta dv ON dv.producto_id = p.id
                INNER JOIN ventas v ON v.id = dv.venta_id
                    AND v.estado = 'activa'
                    AND v.fecha >= DATE_SUB(NOW(), INTERVAL {$dias} DAY)
                GROUP BY p.id
                HAVING total_vendido > 0
                ORDER BY total_vendido ASC
                LIMIT 10")->fetch_all(MYSQLI_ASSOC);

            return ['success' => true, 'productos' => $productos];
        } catch (Exception $e) {
            error_log("Error en getMenosVendidos: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener tendencias'];
        }
    }

    public function getMovimientos($producto_id = null, $tipo = null, $subtipo = null, $fecha_inicio = null, $fecha_fin = null, $limite = 100) {
        global $conn;
        try {
            $limite = max(1, min(500, (int)$limite));
            $where  = ['1=1'];
            $params = [];
            $types  = '';

            if ($producto_id) {
                $where[]  = 'mi.producto_id = ?';
                $params[] = (int)$producto_id;
                $types   .= 'i';
            }
            if ($tipo && in_array($tipo, ['entrada','salida','ajuste'])) {
                $where[]  = 'mi.tipo = ?';
                $params[] = $tipo;
                $types   .= 's';
            }
            $subtipos_validos = ['compra','devolucion_cliente','venta','derrame','daño','merma','ajuste_manual','inicial','importacion'];
            if ($subtipo && in_array($subtipo, $subtipos_validos)) {
                $where[]  = 'mi.subtipo = ?';
                $params[] = $subtipo;
                $types   .= 's';
            }
            if ($fecha_inicio) {
                $where[]  = 'DATE(mi.fecha) >= ?';
                $params[] = $fecha_inicio;
                $types   .= 's';
            }
            if ($fecha_fin) {
                $where[]  = 'DATE(mi.fecha) <= ?';
                $params[] = $fecha_fin;
                $types   .= 's';
            }

            $sql = "SELECT mi.*, p.nombre AS producto_nombre, p.categoria AS producto_categoria
                    FROM movimientos_inventario mi
                    JOIN productos p ON p.id = mi.producto_id
                    WHERE " . implode(' AND ', $where) . "
                    ORDER BY mi.fecha DESC LIMIT $limite";

            $stmt = $conn->prepare($sql);
            if ($types) $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $movimientos = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $stmt->close();

            return ['success' => true, 'movimientos' => $movimientos];
        } catch (Exception $e) {
            error_log("Error en getMovimientos: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener movimientos'];
        }
    }

    public function registrarEntrada($producto_id, $cantidad, $subtipo, $notas = '') {
        global $conn;
        try {
            $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
            $cantidad    = filter_var($cantidad,    FILTER_VALIDATE_INT);
            $subtipos    = ['compra'];

            if (!$producto_id || $producto_id <= 0) return ['success' => false, 'message' => 'ID de producto inválido'];
            if (!$cantidad    || $cantidad    <= 0) return ['success' => false, 'message' => 'Cantidad inválida'];
            if ($cantidad > 9999)                   return ['success' => false, 'message' => 'Cantidad máxima 9,999'];
            if (!in_array($subtipo, $subtipos))     return ['success' => false, 'message' => 'Subtipo inválido'];

            $notas = substr(trim($notas), 0, 500);
            if (empty($notas)) $notas = 'Sin notas adicionales';

            $stmt = $conn->prepare("SELECT id, nombre, stock_actual FROM productos WHERE id = ? LIMIT 1");
            $stmt->bind_param("i", $producto_id);
            $stmt->execute();
            $producto = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$producto) return ['success' => false, 'message' => 'Producto no encontrado'];

            $stock_anterior = (int)$producto['stock_actual'];
            $stock_nuevo    = $stock_anterior + $cantidad;
            $justificacion  = 'Compra de mercancía';

            $conn->begin_transaction();

            $stmt = $conn->prepare("UPDATE productos SET stock_actual = ? WHERE id = ?");
            $stmt->bind_param("ii", $stock_nuevo, $producto_id);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, subtipo, cantidad, stock_anterior, stock_nuevo, justificacion, notas) VALUES (?, 'entrada', ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("isiiiss", $producto_id, $subtipo, $cantidad, $stock_anterior, $stock_nuevo, $justificacion, $notas);
            $stmt->execute();
            $stmt->close();

            $conn->commit();
            
            $this->limpiarCacheCompleta();

            return [
                'success'         => true,
                'message'         => "Entrada registrada — {$producto['nombre']}: {$stock_anterior} → {$stock_nuevo}",
                'stock_anterior'  => $stock_anterior,
                'stock_nuevo'     => $stock_nuevo,
                'producto_nombre' => $producto['nombre']
            ];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en registrarEntrada: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al registrar entrada: ' . $e->getMessage()];
        }
    }

    public function registrarAjuste($producto_id, $cantidad, $subtipo, $notas = '') {
        global $conn;
        try {
            $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
            $cantidad    = filter_var($cantidad,    FILTER_VALIDATE_INT);
            $subtipos    = ['derrame', 'daño', 'merma', 'ajuste_manual'];

            if (!$producto_id || $producto_id <= 0) return ['success' => false, 'message' => 'ID de producto inválido'];
            if (!$cantidad    || $cantidad    <= 0) return ['success' => false, 'message' => 'Cantidad inválida'];
            if (!in_array($subtipo, $subtipos))     return ['success' => false, 'message' => 'Subtipo inválido'];
            if (empty(trim($notas)))                return ['success' => false, 'message' => 'Las notas son obligatorias para ajustes'];

            $notas = substr(trim($notas), 0, 500);

            $stmt = $conn->prepare("SELECT id, nombre, stock_actual FROM productos WHERE id = ? LIMIT 1");
            $stmt->bind_param("i", $producto_id);
            $stmt->execute();
            $producto = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$producto) return ['success' => false, 'message' => 'Producto no encontrado'];

            $stock_anterior = (int)$producto['stock_actual'];
            if ($cantidad > $stock_anterior) {
                return ['success' => false, 'message' => "Stock insuficiente. Disponible: {$stock_anterior}"];
            }

            $stock_nuevo   = $stock_anterior - $cantidad;
            $etiquetas     = ['derrame' => 'Derrame', 'daño' => 'Daño', 'merma' => 'Merma', 'ajuste_manual' => 'Ajuste manual'];
            $justificacion = ($etiquetas[$subtipo] ?? 'Ajuste') . ': ' . $notas;

            $conn->begin_transaction();

            $stmt = $conn->prepare("UPDATE productos SET stock_actual = ? WHERE id = ?");
            $stmt->bind_param("ii", $stock_nuevo, $producto_id);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, subtipo, cantidad, stock_anterior, stock_nuevo, justificacion, notas) VALUES (?, 'ajuste', ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("isiiiss", $producto_id, $subtipo, $cantidad, $stock_anterior, $stock_nuevo, $justificacion, $notas);
            $stmt->execute();
            $stmt->close();

            $conn->commit();
            
            $this->limpiarCacheCompleta();

            return [
                'success'         => true,
                'message'         => "Ajuste registrado — {$producto['nombre']}: {$stock_anterior} → {$stock_nuevo}",
                'stock_anterior'  => $stock_anterior,
                'stock_nuevo'     => $stock_nuevo,
                'producto_nombre' => $producto['nombre']
            ];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en registrarAjuste: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al registrar ajuste: ' . $e->getMessage()];
        }
    }
    
    private function limpiarCacheCompleta() {
        $cacheFiles = [
            sys_get_temp_dir() . '/pos_productos_cache.json',
            sys_get_temp_dir() . '/pos_productos_admin_cache.json',
            sys_get_temp_dir() . '/pos_resumen_inventario_cache.json',
            sys_get_temp_dir() . '/pos_alertas_inventario_cache.json'
        ];
        foreach ($cacheFiles as $file) {
            if (file_exists($file)) {
                @unlink($file);
            }
        }
        array_map('unlink', glob(sys_get_temp_dir() . '/pos_cache_*.json'));
    }
}
?>