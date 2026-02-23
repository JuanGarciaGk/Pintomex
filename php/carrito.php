<?php
require_once 'config.php';
require_once 'productos.php';

class Carrito {
    
    // Agregar producto al carrito (CONSULTA PREPARADA)
    public function agregar($producto_id, $cantidad = 1) {
        global $conn;
        
        // Validar que sean números
        $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
        $cantidad = filter_var($cantidad, FILTER_VALIDATE_INT);
        
        if (!$producto_id || $producto_id <= 0 || !$cantidad || $cantidad <= 0) {
            return ['success' => false, 'message' => 'Datos inválidos'];
        }
        
        // Verificar producto y stock con consulta preparada
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
            return ['success' => false, 'message' => 'Stock insuficiente'];
        }
        
        // Agregar al carrito en sesión
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
                return ['success' => false, 'message' => 'Stock insuficiente'];
            }
            $_SESSION['carrito'][$producto_id]['cantidad'] = $nueva_cantidad;
        }
        
        return ['success' => true, 'carrito' => $this->obtener()];
    }
    
    // Modificar cantidad
    public function modificar($producto_id, $cantidad) {
        $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
        $cantidad = filter_var($cantidad, FILTER_VALIDATE_INT);
        
        if (!$producto_id || $producto_id <= 0) {
            return $this->obtener();
        }
        
        if ($cantidad <= 0) {
            return $this->eliminar($producto_id);
        }
        
        if (isset($_SESSION['carrito'][$producto_id])) {
            $_SESSION['carrito'][$producto_id]['cantidad'] = $cantidad;
        }
        
        return $this->obtener();
    }
    
    // Eliminar producto
    public function eliminar($producto_id) {
        $producto_id = filter_var($producto_id, FILTER_VALIDATE_INT);
        
        if ($producto_id && isset($_SESSION['carrito'][$producto_id])) {
            unset($_SESSION['carrito'][$producto_id]);
        }
        return $this->obtener();
    }
    
    // Obtener carrito con cálculos
    public function obtener() {
        $carrito = array_values($_SESSION['carrito']);
        $subtotal = 0;
        
        foreach ($carrito as &$item) {
            $item['subtotal'] = $item['precio'] * $item['cantidad'];
            $subtotal += $item['subtotal'];
        }
        
        $total = $subtotal;
        
        return [
            'items' => $carrito,
            'subtotal' => $subtotal,
            'total' => $total
        ];
    }
    
    // Vaciar carrito
    public function vaciar() {
        $_SESSION['carrito'] = [];
        return $this->obtener();
    }
    
    // Procesar venta con consultas preparadas y validación mejorada
    public function procesarVenta($metodo_pago, $efectivo_recibido = null, $cambio = null) {
        global $conn;
        
        // Validar método de pago
        $metodos_validos = ['Efectivo', 'Tarjeta', 'Transferencia'];
        if (!in_array($metodo_pago, $metodos_validos)) {
            return ['success' => false, 'message' => 'Método de pago inválido'];
        }
        
        $carrito = $this->obtener();
        
        if (empty($carrito['items'])) {
            return ['success' => false, 'message' => 'Carrito vacío'];
        }
        
        // Validar efectivo si aplica
        if ($metodo_pago === 'Efectivo') {
            $efectivo_recibido = filter_var($efectivo_recibido, FILTER_VALIDATE_FLOAT);
            $cambio = filter_var($cambio, FILTER_VALIDATE_FLOAT);
            
            if ($efectivo_recibido === false || $efectivo_recibido <= 0) {
                return ['success' => false, 'message' => 'Cantidad de efectivo inválida'];
            }
            
            if ($cambio === false || $cambio < 0) {
                return ['success' => false, 'message' => 'Cambio inválido'];
            }
        } else {
            $efectivo_recibido = null;
            $cambio = null;
        }
        
        $conn->begin_transaction();
        
        try {
            // VALIDACIÓN DE STOCK CON CONSULTAS PREPARADAS
            foreach ($carrito['items'] as $item) {
                $stmt_stock = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ? FOR UPDATE");
                $stmt_stock->bind_param("i", $item['id']);
                $stmt_stock->execute();
                $result_stock = $stmt_stock->get_result();
                $producto_db = $result_stock->fetch_assoc();
                $stmt_stock->close();
                
                if (!$producto_db) {
                    throw new Exception("Producto no encontrado: {$item['nombre']}");
                }
                
                if ($item['cantidad'] > $producto_db['stock_actual']) {
                    throw new Exception("Stock insuficiente para: {$item['nombre']}. Disponible: {$producto_db['stock_actual']}");
                }
            }
            
            // Crear venta con consulta preparada
            $folio = generarFolio();
            $subtotal = $carrito['subtotal'];
            $total = $carrito['total'];
            
            $stmt_venta = $conn->prepare("INSERT INTO ventas (folio, subtotal, total, metodo_pago, efectivo_recibido, cambio) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt_venta->bind_param("sddsss", $folio, $subtotal, $total, $metodo_pago, $efectivo_recibido, $cambio);
            $stmt_venta->execute();
            $venta_id = $conn->insert_id;
            $stmt_venta->close();
            
            // Registrar detalles y actualizar inventario
            foreach ($carrito['items'] as $item) {
                // Detalle de venta
                $stmt_detalle = $conn->prepare("INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)");
                $stmt_detalle->bind_param("iiidd", $venta_id, $item['id'], $item['cantidad'], $item['precio'], $item['subtotal']);
                $stmt_detalle->execute();
                $stmt_detalle->close();
                
                // Obtener stock anterior
                $stmt_stock_anterior = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ?");
                $stmt_stock_anterior->bind_param("i", $item['id']);
                $stmt_stock_anterior->execute();
                $result = $stmt_stock_anterior->get_result();
                $producto = $result->fetch_assoc();
                $stock_anterior = $producto['stock_actual'];
                $stmt_stock_anterior->close();
                
                $stock_nuevo = $stock_anterior - $item['cantidad'];
                
                // Actualizar stock
                $stmt_update = $conn->prepare("UPDATE productos SET stock_actual = ? WHERE id = ?");
                $stmt_update->bind_param("ii", $stock_nuevo, $item['id']);
                $stmt_update->execute();
                $stmt_update->close();
                
                // Registrar movimiento
                $justificacion = "Venta #$folio";
                $stmt_movimiento = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, 'salida', ?, ?, ?, ?)");
                $stmt_movimiento->bind_param("iiiis", $item['id'], $item['cantidad'], $stock_anterior, $stock_nuevo, $justificacion);
                $stmt_movimiento->execute();
                $stmt_movimiento->close();
            }
            
            $conn->commit();
            $this->vaciar();
            
            return ['success' => true, 'folio' => $folio, 'venta_id' => $venta_id];
            
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en venta: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al procesar la venta'];
        }
    }
}

// Manejar peticiones AJAX con validación de token CSRF (opcional pero recomendado)
if (isset($_POST['accion'])) {
    header('Content-Type: application/json');
    
    // Validación básica de origen
    $origen = $_SERVER['HTTP_REFERER'] ?? '';
    if (strpos($origen, $_SERVER['HTTP_HOST']) === false && $origen != '') {
        echo json_encode(['success' => false, 'message' => 'Origen no válido']);
        exit;
    }
    
    $carrito = new Carrito();
    
    switch ($_POST['accion']) {
        case 'agregar':
            if (!isset($_POST['producto_id'])) {
                echo json_encode(['success' => false, 'message' => 'ID de producto requerido']);
                break;
            }
            $cantidad = isset($_POST['cantidad']) ? $_POST['cantidad'] : 1;
            echo json_encode($carrito->agregar($_POST['producto_id'], $cantidad));
            break;
            
        case 'modificar':
            if (!isset($_POST['producto_id']) || !isset($_POST['cantidad'])) {
                echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
                break;
            }
            echo json_encode($carrito->modificar($_POST['producto_id'], $_POST['cantidad']));
            break;
            
        case 'eliminar':
            if (!isset($_POST['producto_id'])) {
                echo json_encode(['success' => false, 'message' => 'ID de producto requerido']);
                break;
            }
            echo json_encode($carrito->eliminar($_POST['producto_id']));
            break;
            
        case 'obtener':
            echo json_encode($carrito->obtener());
            break;
            
        case 'vaciar':
            echo json_encode($carrito->vaciar());
            break;
            
        case 'procesar':
            if (!isset($_POST['metodo_pago'])) {
                echo json_encode(['success' => false, 'message' => 'Método de pago requerido']);
                break;
            }
            $efectivo_recibido = isset($_POST['efectivo_recibido']) ? floatval($_POST['efectivo_recibido']) : null;
            $cambio = isset($_POST['cambio']) ? floatval($_POST['cambio']) : null;
            echo json_encode($carrito->procesarVenta($_POST['metodo_pago'], $efectivo_recibido, $cambio));
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'Acción no válida']);
    }
}
?>