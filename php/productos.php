<?php
require_once 'config.php';

class Productos {
    
    // Buscar producto por código de barras
    public function buscarPorCodigo($codigo) {
        global $conn;
        
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
        
        $termino_like = "%$termino%";
        
        $stmt = $conn->prepare("SELECT * FROM productos WHERE 
                nombre LIKE ? OR 
                codigo_barras LIKE ? OR
                descripcion LIKE ?
                ORDER BY nombre LIMIT 10");
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
}
?>