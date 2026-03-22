<?php
require_once 'config.php';
require_once 'productos.php';

class Carrito {
    
    public function agregar($producto_id, $cantidad = 1) {
        global $conn;
        
        $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
        $cantidad = filter_var($cantidad, FILTER_VALIDATE_INT);
        
        if (!$producto_id || $producto_id <= 0 || !$cantidad || $cantidad <= 0) {
            return ['success' => false, 'message' => 'Datos inválidos'];
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
                'precio' => $producto['precio_venta'],
                'cantidad' => $cantidad,
                'stock' => $producto['stock_actual']
            ];
        } else {
            $nueva_cantidad = $_SESSION['carrito'][$producto_id]['cantidad'] + $cantidad;
            if ($nueva_cantidad > $producto['stock_actual']) {
                return ['success' => false, 'message' => 'Stock insuficiente. Disponible: ' . $producto['stock_actual']];
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
        
        if ($cantidad <= 0) {
            return $this->eliminar($producto_id);
        }
        
        if (isset($_SESSION['carrito'][$producto_id])) {
            // Obtener stock actual del producto
            $stmt = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ?");
            $stmt->bind_param("i", $producto_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $producto = $result->fetch_assoc();
            $stmt->close();
            
            if ($producto && $cantidad > $producto['stock_actual']) {
                return [
                    'success' => false, 
                    'message' => 'Stock insuficiente. Disponible: ' . $producto['stock_actual'],
                    'max_stock' => $producto['stock_actual']
                ];
            }
            
            $_SESSION['carrito'][$producto_id]['cantidad'] = $cantidad;
            $_SESSION['carrito'][$producto_id]['subtotal'] = $cantidad * $_SESSION['carrito'][$producto_id]['precio'];
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
        
        if ($metodo_pago === 'Efectivo') {
            $efectivo_recibido = filter_var($efectivo_recibido, FILTER_VALIDATE_FLOAT);
            $cambio = filter_var($cambio, FILTER_VALIDATE_FLOAT);
            
            if ($efectivo_recibido === false || $efectivo_recibido <= 0) {
                return ['success' => false, 'message' => 'Cantidad de efectivo inválida'];
            }
            
            if ($cambio === false || $cambio < 0) {
                return ['success' => false, 'message' => 'Cambio inválido'];
            }
        }
        
        $conn->begin_transaction();
        
        try {
            foreach ($carrito['items'] as $item) {
                $stmt = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ? FOR UPDATE");
                $stmt->bind_param("i", $item['id']);
                $stmt->execute();
                $result = $stmt->get_result();
                $producto = $result->fetch_assoc();
                $stmt->close();
                
                if (!$producto || $item['cantidad'] > $producto['stock_actual']) {
                    throw new Exception("Stock insuficiente para: {$item['nombre']}");
                }
            }
            
            $folio = generarFolio();
            
            $stmt = $conn->prepare("INSERT INTO ventas (folio, subtotal, total, metodo_pago, efectivo_recibido, cambio) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("sddsss", $folio, $carrito['subtotal'], $carrito['total'], $metodo_pago, $efectivo_recibido, $cambio);
            $stmt->execute();
            $venta_id = $conn->insert_id;
            $stmt->close();
            
            // Verificar si hay caja abierta y asociar la venta
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
                $stmt->bind_param("iiidd", $venta_id, $item['id'], $item['cantidad'], $item['precio'], $item['subtotal']);
                $stmt->execute();
                $stmt->close();
                
                $stmt = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ?");
                $stmt->bind_param("i", $item['id']);
                $stmt->execute();
                $result = $stmt->get_result();
                $producto = $result->fetch_assoc();
                $stock_anterior = $producto['stock_actual'];
                $stmt->close();
                
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
}
?>