<?php
require_once 'config.php';

class Productos {
    
    // Buscar producto por código de barras (CONSULTA PREPARADA)
    public function buscarPorCodigo($codigo) {
        global $conn;
        
        $codigo = sanitize($codigo);
        $stmt = $conn->prepare("SELECT * FROM productos WHERE codigo_barras = ?");
        $stmt->bind_param("s", $codigo);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $producto = $result->fetch_assoc();
            $stmt->close();
            return $producto;
        }
        $stmt->close();
        return null;
    }
    
    // Buscar productos por término
    public function buscar($termino) {
        global $conn;
        
        $termino = sanitize($termino);
        $termino_like = "%$termino%";
        
        $stmt = $conn->prepare("SELECT * FROM productos WHERE 
                nombre LIKE ? OR 
                codigo_barras LIKE ? OR
                descripcion LIKE ?
                ORDER BY nombre");
        $stmt->bind_param("sss", $termino_like, $termino_like, $termino_like);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
        $stmt->close();
        return $productos;
    }
    
    // Obtener productos por categoría
    public function porCategoria($categoria) {
        global $conn;
        
        $categoria = sanitize($categoria);
        
        if ($categoria === 'Todas') {
            $stmt = $conn->prepare("SELECT * FROM productos ORDER BY nombre");
            $stmt->execute();
        } else {
            $stmt = $conn->prepare("SELECT * FROM productos WHERE categoria = ? ORDER BY nombre");
            $stmt->bind_param("s", $categoria);
            $stmt->execute();
        }
        
        $result = $stmt->get_result();
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
        $stmt->close();
        return $productos;
    }
    
    // Obtener todos los productos
    public function todos() {
        global $conn;
        
        $stmt = $conn->prepare("SELECT * FROM productos ORDER BY nombre");
        $stmt->execute();
        $result = $stmt->get_result();
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
        $stmt->close();
        return $productos;
    }
    
    // Registrar nuevo producto
    public function registrar($datos) {
        global $conn;
        
        // Validar y sanitizar datos
        $codigo = sanitize($datos['codigo_barras']);
        $nombre = sanitize($datos['nombre']);
        $descripcion = sanitize($datos['descripcion']);
        $categoria = sanitize($datos['categoria']);
        $marca = sanitize($datos['marca']);
        $precio_compra = filter_var($datos['precio_compra'], FILTER_VALIDATE_FLOAT);
        $precio_venta = filter_var($datos['precio_venta'], FILTER_VALIDATE_FLOAT);
        $stock_minimo = filter_var($datos['stock_minimo'], FILTER_VALIDATE_INT);
        $stock_actual = filter_var($datos['stock_actual'], FILTER_VALIDATE_INT);
        
        if (!$precio_compra || !$precio_venta || !$stock_minimo || !$stock_actual) {
            return false;
        }
        
        $stmt = $conn->prepare("INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, marca, precio_compra, precio_venta, stock_minimo, stock_actual) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssssddii", $codigo, $nombre, $descripcion, $categoria, $marca, $precio_compra, $precio_venta, $stock_minimo, $stock_actual);
        
        if ($stmt->execute()) {
            $id = $conn->insert_id;
            $stmt->close();
            return $id;
        }
        $stmt->close();
        return false;
    }
    
    // Actualizar producto
    public function actualizar($id, $datos) {
        global $conn;
        
        $id = filter_var($id, FILTER_VALIDATE_INT);
        if (!$id || $id <= 0) {
            return false;
        }
        
        // Validar y sanitizar datos
        $codigo = sanitize($datos['codigo_barras']);
        $nombre = sanitize($datos['nombre']);
        $descripcion = sanitize($datos['descripcion']);
        $categoria = sanitize($datos['categoria']);
        $marca = sanitize($datos['marca']);
        $precio_compra = filter_var($datos['precio_compra'], FILTER_VALIDATE_FLOAT);
        $precio_venta = filter_var($datos['precio_venta'], FILTER_VALIDATE_FLOAT);
        $stock_minimo = filter_var($datos['stock_minimo'], FILTER_VALIDATE_INT);
        $stock_actual = filter_var($datos['stock_actual'], FILTER_VALIDATE_INT);
        
        if (!$precio_compra || !$precio_venta || !$stock_minimo || !$stock_actual) {
            return false;
        }
        
        $stmt = $conn->prepare("UPDATE productos SET 
                codigo_barras = ?,
                nombre = ?,
                descripcion = ?,
                categoria = ?,
                marca = ?,
                precio_compra = ?,
                precio_venta = ?,
                stock_minimo = ?,
                stock_actual = ?
                WHERE id = ?");
        $stmt->bind_param("sssssddiii", $codigo, $nombre, $descripcion, $categoria, $marca, $precio_compra, $precio_venta, $stock_minimo, $stock_actual, $id);
        
        $resultado = $stmt->execute();
        $stmt->close();
        return $resultado;
    }
    
    // Eliminar producto
    public function eliminar($id) {
        global $conn;
        
        $id = filter_var($id, FILTER_VALIDATE_INT);
        if (!$id || $id <= 0) {
            return false;
        }
        
        $stmt = $conn->prepare("DELETE FROM productos WHERE id = ?");
        $stmt->bind_param("i", $id);
        $resultado = $stmt->execute();
        $stmt->close();
        return $resultado;
    }
    
    // Obtener producto por ID
    public function obtenerPorId($id) {
        global $conn;
        
        $id = filter_var($id, FILTER_VALIDATE_INT);
        if (!$id || $id <= 0) {
            return null;
        }
        
        $stmt = $conn->prepare("SELECT * FROM productos WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $producto = $result->fetch_assoc();
            $stmt->close();
            return $producto;
        }
        $stmt->close();
        return null;
    }
    
    // Obtener productos con stock bajo
    public function stockBajo() {
        global $conn;
        
        $stmt = $conn->prepare("SELECT * FROM productos WHERE stock_actual <= stock_minimo ORDER BY stock_actual ASC");
        $stmt->execute();
        $result = $stmt->get_result();
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
        $stmt->close();
        return $productos;
    }
    
    // Obtener todas las categorías
    public function obtenerCategorias() {
        return [
            'Todas',
            'Acrílicas',
            'Esmaltes',
            'Selladores',
            'Barniz',
            'Aerosol',
            'Impermeabilizante',
            'Complementos'
        ];
    }
}

// Manejar peticiones AJAX con validación
if (isset($_GET['accion'])) {
    header('Content-Type: application/json');
    
    // Validación básica de origen
    $origen = $_SERVER['HTTP_REFERER'] ?? '';
    if (strpos($origen, $_SERVER['HTTP_HOST']) === false && $origen != '') {
        echo json_encode(['error' => 'Origen no válido']);
        exit;
    }
    
    $productos = new Productos();
    
    switch ($_GET['accion']) {
        case 'buscar':
            if (isset($_GET['codigo'])) {
                echo json_encode($productos->buscarPorCodigo($_GET['codigo']));
            } elseif (isset($_GET['termino'])) {
                echo json_encode($productos->buscar($_GET['termino']));
            }
            break;
            
        case 'categoria':
            if (isset($_GET['categoria'])) {
                echo json_encode($productos->porCategoria($_GET['categoria']));
            }
            break;
            
        case 'todos':
            echo json_encode($productos->todos());
            break;
            
        case 'stock-bajo':
            echo json_encode($productos->stockBajo());
            break;
            
        case 'categorias':
            echo json_encode($productos->obtenerCategorias());
            break;
            
        default:
            echo json_encode(['error' => 'Acción no válida']);
    }
}
?>