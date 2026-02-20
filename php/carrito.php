<?php
require_once 'config.php';
require_once 'productos.php';

class Carrito {
    
    // Agregar producto al carrito
    public function agregar($producto_id, $cantidad = 1) {
        global $conn;
        
        // Verificar producto y stock
        $sql = "SELECT * FROM productos WHERE id = $producto_id";
        $result = $conn->query($sql);
        
        if ($result->num_rows == 0) {
            return ['success' => false, 'message' => 'Producto no encontrado'];
        }
        
        $producto = $result->fetch_assoc();
        
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
        if (isset($_SESSION['carrito'][$producto_id])) {
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
        
        $impuestos = $subtotal * 0.16; // IVA 16%
        $total = $subtotal + $impuestos;
        
        return [
            'items' => $carrito,
            'subtotal' => $subtotal,
            'impuestos' => $impuestos,
            'total' => $total
        ];
    }
    
    // Vaciar carrito
    public function vaciar() {
        $_SESSION['carrito'] = [];
        return $this->obtener();
    }
    
    // Procesar venta
    public function procesarVenta($metodo_pago) {
        global $conn;
        
        $carrito = $this->obtener();
        
        if (empty($carrito['items'])) {
            return ['success' => false, 'message' => 'Carrito vacío'];
        }
        
        $conn->begin_transaction();
        
        try {
            // Crear venta
            $folio = generarFolio();
            $subtotal = $carrito['subtotal'];
            $impuestos = $carrito['impuestos'];
            $total = $carrito['total'];
            
            $sql = "INSERT INTO ventas (folio, subtotal, impuestos, total, metodo_pago) 
                    VALUES ('$folio', $subtotal, $impuestos, $total, '$metodo_pago')";
            $conn->query($sql);
            $venta_id = $conn->insert_id;
            
            // Registrar detalles y actualizar inventario
            foreach ($carrito['items'] as $item) {
                // Detalle de venta
                $sql = "INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal) 
                        VALUES ($venta_id, {$item['id']}, {$item['cantidad']}, {$item['precio']}, {$item['subtotal']})";
                $conn->query($sql);
                
                // Actualizar stock
                $sql = "SELECT stock_actual FROM productos WHERE id = {$item['id']}";
                $result = $conn->query($sql);
                $producto = $result->fetch_assoc();
                $stock_anterior = $producto['stock_actual'];
                $stock_nuevo = $stock_anterior - $item['cantidad'];
                
                $sql = "UPDATE productos SET stock_actual = $stock_nuevo WHERE id = {$item['id']}";
                $conn->query($sql);
                
                // Registrar movimiento
                $sql = "INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) 
                        VALUES ({$item['id']}, 'salida', {$item['cantidad']}, $stock_anterior, $stock_nuevo, 'Venta #$folio')";
                $conn->query($sql);
            }
            
            $conn->commit();
            $this->vaciar();
            
            return ['success' => true, 'folio' => $folio, 'venta_id' => $venta_id];
            
        } catch (Exception $e) {
            $conn->rollback();
            return ['success' => false, 'message' => 'Error al procesar venta: ' . $e->getMessage()];
        }
    }
}

// Manejar peticiones AJAX
if (isset($_POST['accion'])) {
    header('Content-Type: application/json');
    $carrito = new Carrito();
    
    switch ($_POST['accion']) {
        case 'agregar':
            echo json_encode($carrito->agregar($_POST['producto_id'], $_POST['cantidad'] ?? 1));
            break;
            
        case 'modificar':
            echo json_encode($carrito->modificar($_POST['producto_id'], $_POST['cantidad']));
            break;
            
        case 'eliminar':
            echo json_encode($carrito->eliminar($_POST['producto_id']));
            break;
            
        case 'obtener':
            echo json_encode($carrito->obtener());
            break;
            
        case 'vaciar':
            echo json_encode($carrito->vaciar());
            break;
            
        case 'procesar':
            echo json_encode($carrito->procesarVenta($_POST['metodo_pago']));
            break;
    }
}
?>