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
                descripcion LIKE '%$termino%'";
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
        $sql = "SELECT * FROM productos WHERE categoria = '$categoria' OR categoria = 'Todos'";
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
}
?>