<?php
require_once 'config.php';

class Inventario {

    public function registrarEntrada(array $datos): array {
        global $conn;
        try {
            $producto_id  = filter_var($datos['producto_id']  ?? 0, FILTER_VALIDATE_INT);
            $cantidad     = filter_var($datos['cantidad']     ?? 0, FILTER_VALIDATE_INT);
            $tipo_entrada = $datos['tipo_entrada'] ?? '';
            $justificacion = isset($datos['justificacion'])
                ? substr(sanitize($datos['justificacion']), 0, 255)
                : '';

            if (!$producto_id || $producto_id <= 0)
                return ['success' => false, 'message' => 'ID de producto inválido'];
            if (!$cantidad || $cantidad <= 0)
                return ['success' => false, 'message' => 'La cantidad debe ser mayor a 0'];
            if ($cantidad > 9999)
                return ['success' => false, 'message' => 'Cantidad máxima permitida es 9,999'];

            $tipos_validos = ['compra', 'devolucion_cliente'];
            if (!in_array($tipo_entrada, $tipos_validos, true))
                return ['success' => false, 'message' => 'Tipo de entrada inválido'];

            $conn->begin_transaction();

            $stmt = $conn->prepare(
                "SELECT id, nombre, stock_actual FROM productos WHERE id = ? FOR UPDATE"
            );
            $stmt->bind_param("i", $producto_id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 0) {
                $stmt->close();
                $conn->rollback();
                return ['success' => false, 'message' => 'Producto no encontrado'];
            }
            $producto = $result->fetch_assoc();
            $stmt->close();

            $stock_anterior = intval($producto['stock_actual']);
            $stock_nuevo    = $stock_anterior + $cantidad;

            $stmt = $conn->prepare(
                "UPDATE productos SET stock_actual = ? WHERE id = ?"
            );
            $stmt->bind_param("ii", $stock_nuevo, $producto_id);
            $stmt->execute();
            $stmt->close();

            $this->_insertarMovimiento(
                $producto_id, 'entrada', $tipo_entrada, $cantidad,
                $stock_anterior, $stock_nuevo, $justificacion
            );

            $conn->commit();

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

    public function registrarSalida(array $datos): array {
        global $conn;
        try {
            $producto_id  = filter_var($datos['producto_id']  ?? 0, FILTER_VALIDATE_INT);
            $cantidad     = filter_var($datos['cantidad']     ?? 0, FILTER_VALIDATE_INT);
            $tipo_salida  = $datos['tipo_salida'] ?? '';
            $justificacion = isset($datos['justificacion'])
                ? substr(sanitize($datos['justificacion']), 0, 255)
                : '';

            if (!$producto_id || $producto_id <= 0)
                return ['success' => false, 'message' => 'ID de producto inválido'];
            if (!$cantidad || $cantidad <= 0)
                return ['success' => false, 'message' => 'La cantidad debe ser mayor a 0'];

            $tipos_validos = ['ajuste_derrame', 'ajuste_danio', 'ajuste_merma'];
            if (!in_array($tipo_salida, $tipos_validos, true))
                return ['success' => false, 'message' => 'Tipo de salida inválido'];

            $conn->begin_transaction();

            $stmt = $conn->prepare(
                "SELECT id, nombre, stock_actual FROM productos WHERE id = ? FOR UPDATE"
            );
            $stmt->bind_param("i", $producto_id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 0) {
                $stmt->close();
                $conn->rollback();
                return ['success' => false, 'message' => 'Producto no encontrado'];
            }
            $producto = $result->fetch_assoc();
            $stmt->close();

            $stock_anterior = intval($producto['stock_actual']);
            if ($stock_anterior < $cantidad) {
                $conn->rollback();
                return ['success' => false, 'message' => 'Stock insuficiente'];
            }

            $stock_nuevo = $stock_anterior - $cantidad;

            $stmt = $conn->prepare(
                "UPDATE productos SET stock_actual = ? WHERE id = ?"
            );
            $stmt->bind_param("ii", $stock_nuevo, $producto_id);
            $stmt->execute();
            $stmt->close();

            $this->_insertarMovimiento(
                $producto_id, 'salida', $tipo_salida, $cantidad,
                $stock_anterior, $stock_nuevo, $justificacion
            );

            $conn->commit();

            return [
                'success'         => true,
                'message'         => "Salida registrada — {$producto['nombre']}: {$stock_anterior} → {$stock_nuevo}",
                'stock_anterior'  => $stock_anterior,
                'stock_nuevo'     => $stock_nuevo,
                'producto_nombre' => $producto['nombre']
            ];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en registrarSalida: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al registrar salida: ' . $e->getMessage()];
        }
    }

    private function _insertarMovimiento(
        int $producto_id, string $tipo, string $tipo_detalle,
        int $cantidad, int $stock_anterior, int $stock_nuevo, string $justificacion
    ): void {
        global $conn;

        $tiene_tipo_detalle = $this->_columnExists('movimientos_inventario', 'tipo_detalle');

        if ($tiene_tipo_detalle) {
            $stmt = $conn->prepare(
                "INSERT INTO movimientos_inventario
                 (producto_id, tipo, tipo_detalle, cantidad, stock_anterior, stock_nuevo, justificacion)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->bind_param(
                "issiiis",
                $producto_id, $tipo, $tipo_detalle, $cantidad,
                $stock_anterior, $stock_nuevo, $justificacion
            );
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO movimientos_inventario
                 (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion)
                 VALUES (?, ?, ?, ?, ?, ?)"
            );
            $stmt->bind_param(
                "isiiis",
                $producto_id, $tipo, $cantidad,
                $stock_anterior, $stock_nuevo, $justificacion
            );
        }

        $stmt->execute();
        $stmt->close();
    }

    private function _columnExists(string $table, string $column): bool {
        global $conn;
        $stmt = $conn->prepare(
            "SELECT 1 FROM information_schema.COLUMNS
             WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?"
        );
        $stmt->bind_param("ss", $table, $column);
        $stmt->execute();
        $result = $stmt->get_result();
        $exists = $result->num_rows > 0;
        $stmt->close();
        return $exists;
    }

    public function obtenerHistorial(array $filtros = []): array {
        global $conn;
        try {
            $page     = max(1, intval($filtros['page']     ?? 1));
            $per_page = min(200, max(1, intval($filtros['per_page'] ?? 50)));
            $offset   = ($page - 1) * $per_page;

            $producto_id  = isset($filtros['producto_id'])
                ? filter_var($filtros['producto_id'], FILTER_VALIDATE_INT)
                : null;
            $tipo         = $filtros['tipo']        ?? null;
            $fecha_inicio = $filtros['fecha_inicio'] ?? null;
            $fecha_fin    = $filtros['fecha_fin']    ?? null;

            $tipos_validos = ['entrada', 'salida', 'ajuste'];

            $where  = [];
            $params = [];
            $types  = '';

            if ($producto_id && $producto_id > 0) {
                $where[]  = 'mi.producto_id = ?';
                $params[] = $producto_id;
                $types   .= 'i';
            }

            if ($tipo && in_array($tipo, $tipos_validos, true)) {
                $where[]  = 'mi.tipo = ?';
                $params[] = $tipo;
                $types   .= 's';
            }

            if ($fecha_inicio && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha_inicio)) {
                $where[]  = 'DATE(mi.fecha) >= ?';
                $params[] = $fecha_inicio;
                $types   .= 's';
            }

            if ($fecha_fin && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha_fin)) {
                $where[]  = 'DATE(mi.fecha) <= ?';
                $params[] = $fecha_fin;
                $types   .= 's';
            }

            $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

            $tiene_tipo_detalle = $this->_columnExists('movimientos_inventario', 'tipo_detalle');
            $tipoDetalleCol     = $tiene_tipo_detalle ? 'mi.tipo_detalle' : 'NULL';

            $countSQL = "SELECT COUNT(*) AS total
                         FROM movimientos_inventario mi
                         JOIN productos p ON p.id = mi.producto_id
                         $whereSQL";

            $stmt = $conn->prepare($countSQL);
            if ($types) $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $total = intval($stmt->get_result()->fetch_assoc()['total']);
            $stmt->close();

            $sql = "SELECT mi.id, mi.producto_id, mi.tipo, {$tipoDetalleCol} AS tipo_detalle,
                           mi.cantidad, mi.stock_anterior, mi.stock_nuevo, mi.justificacion,
                           mi.fecha, p.nombre, p.codigo_barras
                    FROM movimientos_inventario mi
                    JOIN productos p ON p.id = mi.producto_id
                    $whereSQL
                    ORDER BY mi.fecha DESC, mi.id DESC
                    LIMIT ? OFFSET ?";

            $stmt = $conn->prepare($sql);
            $allParams = $params;
            $allTypes  = $types . 'ii';
            $allParams[] = $per_page;
            $allParams[] = $offset;
            $stmt->bind_param($allTypes, ...$allParams);
            $stmt->execute();
            $result = $stmt->get_result();

            $movimientos = [];
            while ($row = $result->fetch_assoc()) $movimientos[] = $row;
            $stmt->close();

            return [
                'success'      => true,
                'movimientos'  => $movimientos,
                'total'        => $total,
                'page'         => $page,
                'per_page'     => $per_page,
                'total_pages'  => $per_page > 0 ? (int) ceil($total / $per_page) : 1
            ];
        } catch (Exception $e) {
            error_log("Error en obtenerHistorial: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener historial'];
        }
    }

    public function obtenerAlertasStock(): array {
        global $conn;
        try {
            $stmt = $conn->prepare(
                "SELECT id, codigo_barras, nombre, categoria, precio, stock_minimo, stock_actual
                 FROM productos
                 WHERE stock_actual = 0
                 ORDER BY nombre"
            );
            $stmt->execute();
            $result    = $stmt->get_result();
            $sin_stock = [];
            while ($row = $result->fetch_assoc()) $sin_stock[] = $row;
            $stmt->close();

            $stmt = $conn->prepare(
                "SELECT id, codigo_barras, nombre, categoria, precio, stock_minimo, stock_actual
                 FROM productos
                 WHERE stock_actual > 0 AND stock_actual <= stock_minimo
                 ORDER BY stock_actual ASC"
            );
            $stmt->execute();
            $result     = $stmt->get_result();
            $stock_bajo = [];
            while ($row = $result->fetch_assoc()) $stock_bajo[] = $row;
            $stmt->close();

            return [
                'success'          => true,
                'sin_stock'        => $sin_stock,
                'stock_bajo'       => $stock_bajo,
                'total_sin_stock'  => count($sin_stock),
                'total_stock_bajo' => count($stock_bajo)
            ];
        } catch (Exception $e) {
            error_log("Error en obtenerAlertasStock: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener alertas de stock'];
        }
    }

    public function obtenerProductosMasVendidos(int $dias = 7): array {
        global $conn;
        try {
            $dias = max(1, min(365, $dias));
            $stmt = $conn->prepare(
                "SELECT p.id, p.nombre, p.codigo_barras, p.categoria,
                        SUM(dv.cantidad) AS total_vendido,
                        SUM(dv.subtotal) AS total_ingresos
                 FROM detalles_venta dv
                 JOIN ventas v  ON v.id  = dv.venta_id
                 JOIN productos p ON p.id = dv.producto_id
                 WHERE v.fecha >= DATE_SUB(NOW(), INTERVAL ? DAY)
                   AND v.estado = 'activa'
                 GROUP BY p.id
                 ORDER BY total_vendido DESC
                 LIMIT 10"
            );
            $stmt->bind_param("i", $dias);
            $stmt->execute();
            $result   = $stmt->get_result();
            $productos = [];
            while ($row = $result->fetch_assoc()) $productos[] = $row;
            $stmt->close();

            return ['success' => true, 'productos' => $productos, 'periodo_dias' => $dias];
        } catch (Exception $e) {
            error_log("Error en obtenerProductosMasVendidos: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener productos más vendidos'];
        }
    }

    public function obtenerProductosMenosVendidos(int $dias = 7): array {
        global $conn;
        try {
            $dias = max(1, min(365, $dias));
            $stmt = $conn->prepare(
                "SELECT p.id, p.nombre, p.codigo_barras, p.categoria,
                        SUM(dv.cantidad) AS total_vendido,
                        SUM(dv.subtotal) AS total_ingresos
                 FROM detalles_venta dv
                 JOIN ventas v  ON v.id  = dv.venta_id
                 JOIN productos p ON p.id = dv.producto_id
                 WHERE v.fecha >= DATE_SUB(NOW(), INTERVAL ? DAY)
                   AND v.estado = 'activa'
                 GROUP BY p.id
                 ORDER BY total_vendido ASC
                 LIMIT 10"
            );
            $stmt->bind_param("i", $dias);
            $stmt->execute();
            $result   = $stmt->get_result();
            $productos = [];
            while ($row = $result->fetch_assoc()) $productos[] = $row;
            $stmt->close();

            return ['success' => true, 'productos' => $productos, 'periodo_dias' => $dias];
        } catch (Exception $e) {
            error_log("Error en obtenerProductosMenosVendidos: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener productos menos vendidos'];
        }
    }

    public function obtenerResumenInventario(): array {
        global $conn;
        try {
            $stmt = $conn->prepare(
                "SELECT COUNT(*) AS total_productos,
                        COALESCE(SUM(precio * stock_actual), 0) AS valor_total_inventario
                 FROM productos"
            );
            $stmt->execute();
            $resumen = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            $stmt = $conn->prepare(
                "SELECT COUNT(*) AS total_movimientos_hoy,
                        SUM(CASE WHEN tipo = 'entrada' THEN 1 ELSE 0 END) AS entradas_hoy,
                        SUM(CASE WHEN tipo IN ('salida','ajuste') THEN 1 ELSE 0 END) AS salidas_hoy
                 FROM movimientos_inventario
                 WHERE DATE(fecha) = CURDATE()"
            );
            $stmt->execute();
            $movimientos = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            return [
                'success'                 => true,
                'total_productos'         => intval($resumen['total_productos']),
                'valor_total_inventario'  => floatval($resumen['valor_total_inventario']),
                'total_movimientos_hoy'   => intval($movimientos['total_movimientos_hoy']),
                'entradas_hoy'            => intval($movimientos['entradas_hoy']),
                'salidas_hoy'             => intval($movimientos['salidas_hoy'])
            ];
        } catch (Exception $e) {
            error_log("Error en obtenerResumenInventario: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener resumen de inventario'];
        }
    }
}
?>
