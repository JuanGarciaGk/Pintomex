<?php
require_once 'config.php';

class Productos {
    
    // Buscar producto por código de barras
    public function buscarPorCodigo($codigo) {
        global $conn;
        $codigo = escape($codigo);
        $sql = "SELECT * FROM productos WHERE codigo_barras = '$codigo'";
        $result = $conn->query($sql);
        
        if ($result->num_rows > 0) {
            return $result->fetch_assoc();
        }
        return null;
    }
    
    // Buscar productos por término
    public function buscar($termino) {
        global $conn;
        $termino = escape($termino);
        $sql = "SELECT * FROM productos WHERE 
                nombre LIKE '%$termino%' OR 
                codigo_barras LIKE '%$termino%' OR
                descripcion LIKE '%$termino%'
                ORDER BY nombre";
        $result = $conn->query($sql);
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
        return $productos;
    }
    
    // Obtener productos por categoría
    public function porCategoria($categoria) {
        global $conn;
        $categoria = escape($categoria);
        
        if ($categoria === 'Todas') {
            $sql = "SELECT * FROM productos ORDER BY nombre";
        } else {
            $sql = "SELECT * FROM productos WHERE categoria = '$categoria' ORDER BY nombre";
        }
        
        $result = $conn->query($sql);
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
        return $productos;
    }
    
    // Obtener todos los productos
    public function todos() {
        global $conn;
        $sql = "SELECT * FROM productos ORDER BY nombre";
        $result = $conn->query($sql);
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
        return $productos;
    }
    
    // Registrar nuevo producto
    public function registrar($datos) {
        global $conn;
        
        $codigo = escape($datos['codigo_barras']);
        $nombre = escape($datos['nombre']);
        $descripcion = escape($datos['descripcion']);
        $categoria = escape($datos['categoria']);
        $marca = escape($datos['marca']);
        $precio_compra = floatval($datos['precio_compra']);
        $precio_venta = floatval($datos['precio_venta']);
        $stock_minimo = intval($datos['stock_minimo']);
        $stock_actual = intval($datos['stock_actual']);
        
        $sql = "INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, marca, precio_compra, precio_venta, stock_minimo, stock_actual) 
                VALUES ('$codigo', '$nombre', '$descripcion', '$categoria', '$marca', $precio_compra, $precio_venta, $stock_minimo, $stock_actual)";
        
        if ($conn->query($sql)) {
            return $conn->insert_id;
        }
        return false;
    }
    
    // Actualizar producto
    public function actualizar($id, $datos) {
        global $conn;
        
        $id = intval($id);
        $codigo = escape($datos['codigo_barras']);
        $nombre = escape($datos['nombre']);
        $descripcion = escape($datos['descripcion']);
        $categoria = escape($datos['categoria']);
        $marca = escape($datos['marca']);
        $precio_compra = floatval($datos['precio_compra']);
        $precio_venta = floatval($datos['precio_venta']);
        $stock_minimo = intval($datos['stock_minimo']);
        $stock_actual = intval($datos['stock_actual']);
        
        $sql = "UPDATE productos SET 
                codigo_barras = '$codigo',
                nombre = '$nombre',
                descripcion = '$descripcion',
                categoria = '$categoria',
                marca = '$marca',
                precio_compra = $precio_compra,
                precio_venta = $precio_venta,
                stock_minimo = $stock_minimo,
                stock_actual = $stock_actual
                WHERE id = $id";
        
        return $conn->query($sql);
    }
    
    // Eliminar producto
    public function eliminar($id) {
        global $conn;
        $id = intval($id);
        $sql = "DELETE FROM productos WHERE id = $id";
        return $conn->query($sql);
    }
    
    // Obtener producto por ID
    public function obtenerPorId($id) {
        global $conn;
        $id = intval($id);
        $sql = "SELECT * FROM productos WHERE id = $id";
        $result = $conn->query($sql);
        
        if ($result->num_rows > 0) {
            return $result->fetch_assoc();
        }
        return null;
    }
    
    // Obtener productos con stock bajo
    public function stockBajo() {
        global $conn;
        $sql = "SELECT * FROM productos WHERE stock_actual <= stock_minimo ORDER BY stock_actual ASC";
        $result = $conn->query($sql);
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
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

// Manejar peticiones AJAX
if (isset($_GET['accion'])) {
    header('Content-Type: application/json');
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
    }
}
?>