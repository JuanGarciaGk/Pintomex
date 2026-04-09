<?php
require_once 'config.php';
require_once 'productos.php';

class Carrito {
    
    public function agregar($producto_id, $cantidad = 1) {
        global $conn;
        
        $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
        $cantidad = filter_var($cantidad, FILTER_VALIDATE_INT);
        
        if (!$producto_id || $producto_id <= 0) {
            return ['success' => false, 'message' => 'ID de producto inválido'];
        }
        
        if (!$cantidad || $cantidad <= 0) {
            return ['success' => false, 'message' => 'Cantidad inválida'];
        }
        
        $MAX_CANTIDAD = 999;
        if ($cantidad > $MAX_CANTIDAD) {
            return ['success' => false, 'message' => "Cantidad máxima permitida es $MAX_CANTIDAD"];
        }
        
        $stmt = $conn->prepare("SELECT * FROM productos WHERE id = ?");
        $stmt->bind_param("i", $producto_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows == 0) {
            $stmt->close();
            return ['success' => false, 'message' => 'Producto no encontrado'];
        }
        
        $producto = $result->fetch_assoc();
        $stmt->close();
        
        if ($producto['stock_actual'] < $cantidad) {
            return ['success' => false, 'message' => 'Stock insuficiente. Disponible: ' . $producto['stock_actual']];
        }
        
        if (!isset($_SESSION['carrito'][$producto_id])) {
            $_SESSION['carrito'][$producto_id] = [
                'id' => $producto['id'],
                'codigo' => $producto['codigo_barras'],
                'nombre' => $producto['nombre'],
                'descripcion' => $producto['descripcion'],
                'precio' => floatval($producto['precio']),
                'cantidad' => $cantidad,
                'stock' => intval($producto['stock_actual'])
            ];
        } else {
            $nueva_cantidad = $_SESSION['carrito'][$producto_id]['cantidad'] + $cantidad;
            
            if ($nueva_cantidad > $producto['stock_actual']) {
                return ['success' => false, 'message' => 'Stock insuficiente. Disponible: ' . $producto['stock_actual']];
            }
            
            $MAX_POR_PRODUCTO = 99;
            if ($nueva_cantidad > $MAX_POR_PRODUCTO) {
                return ['success' => false, 'message' => "Máximo $MAX_POR_PRODUCTO unidades por producto"];
            }
            
            $_SESSION['carrito'][$producto_id]['cantidad'] = $nueva_cantidad;
        }
        
        return ['success' => true, 'carrito' => $this->obtener()];
    }
    
    public function modificar($producto_id, $cantidad) {
        global $conn;
        
        $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
        $cantidad = filter_var($cantidad, FILTER_VALIDATE_INT);
        
        if (!$producto_id || $producto_id <= 0) {
            return $this->obtener();
        }
        
        $MAX_POR_PRODUCTO = 99;
        if ($cantidad > $MAX_POR_PRODUCTO) {
            return [
                'success' => false,
                'message' => "Máximo $MAX_POR_PRODUCTO unidades por producto",
                'max_stock' => $MAX_POR_PRODUCTO
            ];
        }
        
        if ($cantidad <= 0) {
            return $this->eliminar($producto_id);
        }
        
        if (isset($_SESSION['carrito'][$producto_id])) {
            $stmt = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ?");
            $stmt->bind_param("i", $producto_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $producto = $result->fetch_assoc();
            $stmt->close();
            
            if (!$producto) {
                return $this->eliminar($producto_id);
            }
            
            if ($cantidad > $producto['stock_actual']) {
                return [
                    'success' => false,
                    'message' => 'Stock insuficiente. Disponible: ' . $producto['stock_actual'],
                    'max_stock' => intval($producto['stock_actual'])
                ];
            }
            
            $_SESSION['carrito'][$producto_id]['cantidad'] = $cantidad;
        }
        
        return $this->obtener();
    }
    
    public function eliminar($producto_id) {
        $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
        
        if ($producto_id && isset($_SESSION['carrito'][$producto_id])) {
            unset($_SESSION['carrito'][$producto_id]);
        }
        return $this->obtener();
    }
    
    public function obtener() {
        $carrito = array_values($_SESSION['carrito']);
        $subtotal = 0;
        
        foreach ($carrito as &$item) {
            $item['subtotal'] = $item['precio'] * $item['cantidad'];
            $subtotal += $item['subtotal'];
        }
        
        return [
            'items' => $carrito,
            'subtotal' => $subtotal,
            'total' => $subtotal
        ];
    }
    
    public function vaciar() {
        $_SESSION['carrito'] = [];
        return $this->obtener();
    }
    
    public function procesarVenta($metodo_pago, $efectivo_recibido = null, $cambio = null) {
        global $conn;
        
        $metodos_validos = ['Efectivo', 'Tarjeta', 'Transferencia'];
        if (!in_array($metodo_pago, $metodos_validos)) {
            return ['success' => false, 'message' => 'Método de pago inválido'];
        }
        
        $carrito = $this->obtener();
        
        if (empty($carrito['items'])) {
            return ['success' => false, 'message' => 'Carrito vacío'];
        }
        
        foreach ($carrito['items'] as $item) {
            if (!isset($item['id']) || !isset($item['cantidad'])) {
                return ['success' => false, 'message' => 'Datos de producto inválidos'];
            }
            if ($item['cantidad'] <= 0) {
                return ['success' => false, 'message' => 'Cantidad inválida para ' . ($item['nombre'] ?? 'producto')];
            }
        }
        
        if ($metodo_pago === 'Efectivo') {
            $efectivo_recibido = filter_var($efectivo_recibido, FILTER_VALIDATE_FLOAT);
            $cambio = filter_var($cambio, FILTER_VALIDATE_FLOAT);
            
            if ($efectivo_recibido === false || $efectivo_recibido <= 0) {
                return ['success' => false, 'message' => 'Cantidad de efectivo inválida'];
            }
            
            $MAX_EXCESO = 10000;
            if ($efectivo_recibido - $carrito['total'] > $MAX_EXCESO) {
                return ['success' => false, 'message' => 'El efectivo recibido excede el total por más de $' . number_format($MAX_EXCESO, 2)];
            }
            
            if ($cambio === false || $cambio < 0) {
                return ['success' => false, 'message' => 'Cambio inválido'];
            }
        }
        
        $conn->begin_transaction();
        
        try {
            $productos_ids = array_column($carrito['items'], 'id');
            $placeholders = implode(',', array_fill(0, count($productos_ids), '?'));
            $types = str_repeat('i', count($productos_ids));
            
            $stmt = $conn->prepare("SELECT id, stock_actual FROM productos WHERE id IN ($placeholders) FOR UPDATE");
            $stmt->bind_param($types, ...$productos_ids);
            $stmt->execute();
            $result = $stmt->get_result();
            $productos_stock = [];
            while ($row = $result->fetch_assoc()) {
                $productos_stock[$row['id']] = $row['stock_actual'];
            }
            $stmt->close();
            
            foreach ($carrito['items'] as $item) {
                if (!isset($productos_stock[$item['id']])) {
                    throw new Exception("Producto no encontrado: {$item['nombre']}");
                }
                if ($item['cantidad'] > $productos_stock[$item['id']]) {
                    throw new Exception("Stock insuficiente para: {$item['nombre']}. Disponible: {$productos_stock[$item['id']]}");
                }
            }
            
            $folio = generarFolio();
            
            $stmt = $conn->prepare("SELECT id FROM ventas WHERE folio = ?");
            $stmt->bind_param("s", $folio);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $folio = generarFolio() . '-' . random_int(1, 99);
            }
            $stmt->close();
            
            // ✅ Insertar venta con estado 'activa'
            $stmt = $conn->prepare("INSERT INTO ventas (folio, subtotal, total, metodo_pago, efectivo_recibido, cambio, estado) VALUES (?, ?, ?, ?, ?, ?, 'activa')");
            $subtotal = floatval($carrito['subtotal']);
            $total = floatval($carrito['total']);
            $efectivo_recibido_db = $efectivo_recibido !== null ? floatval($efectivo_recibido) : null;
            $cambio_db = $cambio !== null ? floatval($cambio) : null;
            
            $stmt->bind_param("sddssd", $folio, $subtotal, $total, $metodo_pago, $efectivo_recibido_db, $cambio_db);
            $stmt->execute();
            $venta_id = $conn->insert_id;
            $stmt->close();
            
            $caja_stmt = $conn->prepare("SELECT id FROM cortes_caja WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
            $caja_stmt->execute();
            $caja_result = $caja_stmt->get_result();
            $caja_abierta = $caja_result->fetch_assoc();
            $caja_stmt->close();

            if ($caja_abierta) {
                $update_venta = $conn->prepare("UPDATE ventas SET corte_caja_id = ? WHERE id = ?");
                $update_venta->bind_param("ii", $caja_abierta['id'], $venta_id);
                $update_venta->execute();
                $update_venta->close();
            }
            
            foreach ($carrito['items'] as $item) {
                $stmt = $conn->prepare("INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)");
                $precio = floatval($item['precio']);
                $subtotal_item = floatval($item['subtotal']);
                $stmt->bind_param("iiidd", $venta_id, $item['id'], $item['cantidad'], $precio, $subtotal_item);
                $stmt->execute();
                $stmt->close();
                
                $stock_anterior = $productos_stock[$item['id']];
                $stock_nuevo = $stock_anterior - $item['cantidad'];
                
                $stmt = $conn->prepare("UPDATE productos SET stock_actual = ? WHERE id = ?");
                $stmt->bind_param("ii", $stock_nuevo, $item['id']);
                $stmt->execute();
                $stmt->close();
                
                $justificacion = "Venta #$folio";
                $stmt = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, 'salida', ?, ?, ?, ?)");
                $stmt->bind_param("iiiss", $item['id'], $item['cantidad'], $stock_anterior, $stock_nuevo, $justificacion);
                $stmt->execute();
                $stmt->close();
            }
            
            $conn->commit();
            $this->vaciar();
            
            return ['success' => true, 'folio' => $folio, 'venta_id' => $venta_id];
            
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en venta: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al procesar la venta: ' . $e->getMessage()];
        }
    }

    // ✅ NUEVO: Cancelar venta y restaurar stock
    public function cancelarVenta($folio, $motivo) {
        global $conn;

        if (empty($folio)) {
            return ['success' => false, 'message' => 'Folio requerido'];
        }

        $folio = substr(trim($folio), 0, 20);
        $motivo = substr(trim($motivo ?? 'Sin motivo'), 0, 255);

        try {
            // Buscar la venta por folio
            $stmt = $conn->prepare("SELECT * FROM ventas WHERE folio = ?");
            $stmt->bind_param("s", $folio);
            $stmt->execute();
            $result = $stmt->get_result();
            $venta = $result->fetch_assoc();
            $stmt->close();

            if (!$venta) {
                return ['success' => false, 'message' => 'No se encontró ningún ticket con ese folio'];
            }

            if ($venta['estado'] === 'cancelada') {
                return ['success' => false, 'message' => 'Este ticket ya fue cancelado anteriormente'];
            }

            // Obtener los detalles de la venta para restaurar el stock
            $stmt = $conn->prepare("SELECT dv.producto_id, dv.cantidad, p.stock_actual, p.nombre 
                                    FROM detalles_venta dv 
                                    JOIN productos p ON p.id = dv.producto_id 
                                    WHERE dv.venta_id = ?");
            $stmt->bind_param("i", $venta['id']);
            $stmt->execute();
            $result = $stmt->get_result();
            $detalles = [];
            while ($row = $result->fetch_assoc()) {
                $detalles[] = $row;
            }
            $stmt->close();

            $conn->begin_transaction();

            // Marcar la venta como cancelada
            $stmt = $conn->prepare("UPDATE ventas SET estado = 'cancelada' WHERE id = ?");
            $stmt->bind_param("i", $venta['id']);
            $stmt->execute();
            $stmt->close();

            // Restaurar el stock de cada producto
            foreach ($detalles as $detalle) {
                $stock_anterior = intval($detalle['stock_actual']);
                $stock_nuevo = $stock_anterior + intval($detalle['cantidad']);

                $stmt = $conn->prepare("UPDATE productos SET stock_actual = ? WHERE id = ?");
                $stmt->bind_param("ii", $stock_nuevo, $detalle['producto_id']);
                $stmt->execute();
                $stmt->close();

                $justificacion = "Cancelación ticket #$folio";
                $stmt = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, 'entrada', ?, ?, ?, ?)");
                $stmt->bind_param("iiiss", $detalle['producto_id'], $detalle['cantidad'], $stock_anterior, $stock_nuevo, $justificacion);
                $stmt->execute();
                $stmt->close();
            }

            // Registrar la cancelación
            $monto = floatval($venta['total']);
            $stmt = $conn->prepare("INSERT INTO cancelaciones_venta (venta_id, folio_venta, motivo, monto_cancelado) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("issd", $venta['id'], $folio, $motivo, $monto);
            $stmt->execute();
            $stmt->close();

            $conn->commit();

            return [
                'success' => true,
                'message' => "Ticket #$folio cancelado exitosamente. Se restauró el stock de " . count($detalles) . " producto(s).",
                'monto_cancelado' => $monto,
                'metodo_pago' => $venta['metodo_pago']
            ];

        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en cancelarVenta: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al cancelar el ticket: ' . $e->getMessage()];
        }
    }

    // ✅ NUEVO: Buscar venta por folio para previsualizar
    public function buscarVentaPorFolio($folio) {
        global $conn;

        $folio = substr(trim($folio), 0, 20);

        if (empty($folio)) {
            return ['success' => false, 'message' => 'Folio requerido'];
        }

        try {
            $stmt = $conn->prepare("SELECT v.*, 
                                    GROUP_CONCAT(CONCAT(p.nombre, ' x', dv.cantidad, ' ($', FORMAT(dv.precio_unitario,2), ')') SEPARATOR ', ') as productos_resumen
                                    FROM ventas v
                                    LEFT JOIN detalles_venta dv ON dv.venta_id = v.id
                                    LEFT JOIN productos p ON p.id = dv.producto_id
                                    WHERE v.folio = ?
                                    GROUP BY v.id");
            $stmt->bind_param("s", $folio);
            $stmt->execute();
            $result = $stmt->get_result();
            $venta = $result->fetch_assoc();
            $stmt->close();

            if (!$venta) {
                return ['success' => false, 'message' => 'No se encontró ningún ticket con ese folio'];
            }

            // Detalles completos
            $stmt = $conn->prepare("SELECT dv.*, p.nombre as producto_nombre 
                                    FROM detalles_venta dv 
                                    JOIN productos p ON p.id = dv.producto_id 
                                    WHERE dv.venta_id = ?");
            $stmt->bind_param("i", $venta['id']);
            $stmt->execute();
            $result = $stmt->get_result();
            $detalles = [];
            while ($row = $result->fetch_assoc()) {
                $detalles[] = $row;
            }
            $stmt->close();

            return ['success' => true, 'venta' => $venta, 'detalles' => $detalles];

        } catch (Exception $e) {
            error_log("Error en buscarVentaPorFolio: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al buscar el ticket'];
        }
    }
}
?>