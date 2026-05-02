<?php
require_once 'config.php';

class Productos {
    
    private $cacheTtl = 300;
    
    public function buscarPorCodigo($codigo) {
        global $conn;
        
        $codigo = substr($codigo, 0, 50);
        
        $stmt = $conn->prepare("SELECT id, codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual FROM productos WHERE codigo_barras = ? LIMIT 1");
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
    
    public function buscar($termino) {
        global $conn;
        
        $termino = substr($termino, 0, 100);
        $termino = preg_replace('/[^a-zA-Z0-9áéíóúñÑ\s\-]/u', '', $termino);
        
        $termino_like = "%$termino%";
        
        $stmt = $conn->prepare("SELECT id, codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual FROM productos WHERE 
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
    
    public function porCategoria($categoria) {
        global $conn;
        
        $categorias_validas = [
            'Todas', 'Acrílicas', 'Esmaltes', 'Selladores', 
            'Barniz', 'Aerosol', 'Impermeabilizante', 'Complementos'
        ];
        
        if (!in_array($categoria, $categorias_validas)) {
            $categoria = 'Todas';
        }
        
        if ($categoria === 'Todas') {
            $stmt = $conn->prepare("SELECT id, codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual FROM productos ORDER BY nombre");
            $stmt->execute();
        } else {
            $stmt = $conn->prepare("SELECT id, codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual FROM productos WHERE categoria = ? ORDER BY nombre");
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
    
    public function todos($forceRefresh = false) {
        global $conn;
        
        $cacheFile = sys_get_temp_dir() . '/pos_productos_cache.json';
        
        if (!$forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $this->cacheTtl) {
            $cached = file_get_contents($cacheFile);
            if ($cached) {
                return json_decode($cached, true);
            }
        }
        
        $stmt = $conn->prepare("SELECT id, codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual FROM productos ORDER BY nombre");
        $stmt->execute();
        $result = $stmt->get_result();
        
        $productos = [];
        while ($row = $result->fetch_assoc()) {
            $productos[] = $row;
        }
        $stmt->close();
        
        file_put_contents($cacheFile, json_encode($productos, JSON_UNESCAPED_UNICODE));
        
        return $productos;
    }
    
    public function obtenerPorId($id) {
        global $conn;
        
        $id = filter_var($id, FILTER_VALIDATE_INT);
        if (!$id || $id <= 0) {
            return null;
        }
        
        $stmt = $conn->prepare("SELECT id, codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual FROM productos WHERE id = ? LIMIT 1");
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
    
    public function stockBajo() {
        global $conn;
        
        $stmt = $conn->prepare("SELECT id, codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual FROM productos WHERE stock_actual <= stock_minimo ORDER BY stock_actual ASC LIMIT 50");
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