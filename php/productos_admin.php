<?php
require_once 'config.php';

class ProductosAdmin {

    private $cacheTtl = 60;

    public function obtenerTodos($forceRefresh = false) {
        global $conn;
        try {
            $cacheFile = sys_get_temp_dir() . '/pos_productos_admin_cache.json';
            
            if (!$forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $this->cacheTtl) {
                $cached = file_get_contents($cacheFile);
                if ($cached) {
                    $data = json_decode($cached, true);
                    if ($data && isset($data['success'])) {
                        return $data;
                    }
                }
            }
            
            $stmt = $conn->prepare("SELECT * FROM productos ORDER BY nombre");
            $stmt->execute();
            $result = $stmt->get_result();
            $productos = [];
            while ($row = $result->fetch_assoc()) $productos[] = $row;
            $stmt->close();
            
            $response = ['success' => true, 'productos' => $productos];
            file_put_contents($cacheFile, json_encode($response, JSON_UNESCAPED_UNICODE));
            
            return $response;
        } catch (Exception $e) {
            error_log("Error en obtenerTodos: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener productos'];
        }
    }

    public function obtenerPorId($id) {
        global $conn;
        try {
            $id = filter_var($id, FILTER_VALIDATE_INT);
            if (!$id || $id <= 0) return ['success' => false, 'message' => 'ID inválido'];
            $stmt = $conn->prepare("SELECT * FROM productos WHERE id = ? LIMIT 1");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 0) { $stmt->close(); return ['success' => false, 'message' => 'Producto no encontrado']; }
            $producto = $result->fetch_assoc();
            $stmt->close();
            return ['success' => true, 'producto' => $producto];
        } catch (Exception $e) {
            error_log("Error en obtenerPorId: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener producto'];
        }
    }

    public function verificarCodigo($codigo) {
        global $conn;
        try {
            $codigo = substr(trim($codigo), 0, 50);
            if (empty($codigo)) return ['success' => false, 'message' => 'Código requerido'];

            $stmt = $conn->prepare("SELECT id, codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual FROM productos WHERE codigo_barras = ? LIMIT 1");
            $stmt->bind_param("s", $codigo);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows > 0) {
                $producto = $result->fetch_assoc();
                $stmt->close();
                return ['success' => true, 'existe' => true, 'producto' => $producto];
            }

            $stmt->close();
            return ['success' => true, 'existe' => false];
        } catch (Exception $e) {
            error_log("Error en verificarCodigo: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al verificar código'];
        }
    }

    public function incrementarStock($id, $cantidad, $justificacion = 'Entrada de mercancía') {
        global $conn;
        try {
            $id       = filter_var($id, FILTER_VALIDATE_INT);
            $cantidad = filter_var($cantidad, FILTER_VALIDATE_INT);

            if (!$id || $id <= 0) return ['success' => false, 'message' => 'ID inválido'];
            if (!$cantidad || $cantidad <= 0) return ['success' => false, 'message' => 'Cantidad inválida'];
            if ($cantidad > 9999) return ['success' => false, 'message' => 'Cantidad máxima permitida es 9,999'];

            $justificacion = substr(trim($justificacion ?: 'Entrada de mercancía'), 0, 255);

            $stmt = $conn->prepare("SELECT id, nombre, stock_actual FROM productos WHERE id = ? LIMIT 1");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 0) { $stmt->close(); return ['success' => false, 'message' => 'Producto no encontrado']; }
            $producto = $result->fetch_assoc();
            $stmt->close();

            $stock_anterior = intval($producto['stock_actual']);
            $stock_nuevo = $stock_anterior + $cantidad;

            $conn->begin_transaction();

            $stmt = $conn->prepare("UPDATE productos SET stock_actual = ? WHERE id = ?");
            $stmt->bind_param("ii", $stock_nuevo, $id);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, 'entrada', ?, ?, ?, ?)");
            $stmt->bind_param("iiiss", $id, $cantidad, $stock_anterior, $stock_nuevo, $justificacion);
            $stmt->execute();
            $stmt->close();

            $conn->commit();
            
            $this->limpiarCache();

            return [
                'success' => true,
                'message' => "Stock actualizado — {$producto['nombre']}: {$stock_anterior} → {$stock_nuevo}",
                'stock_anterior' => $stock_anterior,
                'stock_nuevo' => $stock_nuevo,
                'producto_nombre' => $producto['nombre']
            ];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en incrementarStock: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al actualizar stock: ' . $e->getMessage()];
        }
    }

    public function registrar($datos) {
        global $conn;
        try {
            $codigo_barras = substr(trim($datos['codigo_barras'] ?? ''), 0, 50);
            $nombre = substr(trim($datos['nombre'] ?? ''), 0, 100);
            $descripcion = substr(trim($datos['descripcion'] ?? ''), 0, 65535);
            $categoria = $datos['categoria'] ?? 'Todas';
            $precio = filter_var($datos['precio'] ?? 0, FILTER_VALIDATE_FLOAT);
            $stock_minimo = filter_var($datos['stock_minimo'] ?? 0, FILTER_VALIDATE_INT);
            $stock_actual = filter_var($datos['stock_actual'] ?? 0, FILTER_VALIDATE_INT);

            if (empty($codigo_barras)) return ['success' => false, 'message' => 'El código de barras es requerido'];
            if (empty($nombre)) return ['success' => false, 'message' => 'El nombre es requerido'];
            if ($precio === false || $precio < 0) return ['success' => false, 'message' => 'Precio inválido'];

            $categorias_validas = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];
            if (!in_array($categoria, $categorias_validas)) $categoria = 'Todas';

            if ($stock_minimo === false || $stock_minimo < 0) $stock_minimo = 0;
            if ($stock_actual === false || $stock_actual < 0) $stock_actual = 0;

            $stmt = $conn->prepare("SELECT id FROM productos WHERE codigo_barras = ? LIMIT 1");
            $stmt->bind_param("s", $codigo_barras);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) { $stmt->close(); return ['success' => false, 'message' => 'El código de barras ya está registrado']; }
            $stmt->close();

            $conn->begin_transaction();

            $stmt = $conn->prepare("INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("ssssdii", $codigo_barras, $nombre, $descripcion, $categoria, $precio, $stock_minimo, $stock_actual);

            if ($stmt->execute()) {
                $producto_id = $conn->insert_id;
                $stmt->close();

                if ($stock_actual > 0) {
                    $justificacion = "Registro inicial de producto";
                    $stmt2 = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, 'entrada', ?, 0, ?, ?)");
                    $stmt2->bind_param("iiis", $producto_id, $stock_actual, $stock_actual, $justificacion);
                    $stmt2->execute();
                    $stmt2->close();
                }

                $conn->commit();
                $this->limpiarCache();
                return ['success' => true, 'message' => 'Producto registrado exitosamente', 'id' => $producto_id];
            }

            $conn->rollback();
            $stmt->close();
            return ['success' => false, 'message' => 'Error al registrar producto'];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en registrar: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al registrar producto: ' . $e->getMessage()];
        }
    }

    public function actualizar($id, $datos) {
        global $conn;
        try {
            $id = filter_var($id, FILTER_VALIDATE_INT);
            if (!$id || $id <= 0) return ['success' => false, 'message' => 'ID inválido'];

            $stmt = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ? LIMIT 1");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 0) { $stmt->close(); return ['success' => false, 'message' => 'Producto no encontrado']; }
            $producto_actual = $result->fetch_assoc();
            $stock_anterior = $producto_actual['stock_actual'];
            $stmt->close();

            $codigo_barras = substr(trim($datos['codigo_barras'] ?? ''), 0, 50);
            $nombre = substr(trim($datos['nombre'] ?? ''), 0, 100);
            $descripcion = substr(trim($datos['descripcion'] ?? ''), 0, 65535);
            $categoria = $datos['categoria'] ?? 'Todas';
            $precio = filter_var($datos['precio'] ?? 0, FILTER_VALIDATE_FLOAT);
            $stock_minimo = filter_var($datos['stock_minimo'] ?? 0, FILTER_VALIDATE_INT);
            $stock_actual = filter_var($datos['stock_actual'] ?? 0, FILTER_VALIDATE_INT);

            if (empty($codigo_barras)) return ['success' => false, 'message' => 'El código de barras es requerido'];
            if (empty($nombre)) return ['success' => false, 'message' => 'El nombre es requerido'];
            if ($precio === false || $precio < 0) return ['success' => false, 'message' => 'Precio inválido'];

            $categorias_validas = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];
            if (!in_array($categoria, $categorias_validas)) $categoria = 'Todas';

            if ($stock_minimo === false || $stock_minimo < 0) $stock_minimo = 0;
            if ($stock_actual === false || $stock_actual < 0) $stock_actual = 0;

            $stmt = $conn->prepare("SELECT id FROM productos WHERE codigo_barras = ? AND id != ? LIMIT 1");
            $stmt->bind_param("si", $codigo_barras, $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) { $stmt->close(); return ['success' => false, 'message' => 'El código de barras ya está registrado en otro producto']; }
            $stmt->close();

            $conn->begin_transaction();

            $stmt = $conn->prepare("UPDATE productos SET codigo_barras=?, nombre=?, descripcion=?, categoria=?, precio=?, stock_minimo=?, stock_actual=? WHERE id=?");
            $stmt->bind_param("ssssdiii", $codigo_barras, $nombre, $descripcion, $categoria, $precio, $stock_minimo, $stock_actual, $id);

            if ($stmt->execute()) {
                $stmt->close();

                if ($stock_actual != $stock_anterior) {
                    $diferencia = $stock_actual - $stock_anterior;
                    $tipo = $diferencia > 0 ? 'entrada' : 'salida';
                    $justificacion = "Actualización manual de inventario";
                    $stmt = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, ?, ?, ?, ?, ?)");
                    $stmt->bind_param("isiiis", $id, $tipo, abs($diferencia), $stock_anterior, $stock_actual, $justificacion);
                    $stmt->execute();
                    $stmt->close();
                }

                $conn->commit();
                $this->limpiarCache();
                return ['success' => true, 'message' => 'Producto actualizado exitosamente'];
            }

            $conn->rollback();
            $stmt->close();
            return ['success' => false, 'message' => 'Error al actualizar producto'];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en actualizar: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al actualizar producto: ' . $e->getMessage()];
        }
    }

    public function eliminar($id) {
        global $conn;
        try {
            $id = filter_var($id, FILTER_VALIDATE_INT);
            if (!$id || $id <= 0) return ['success' => false, 'message' => 'ID inválido'];

            $stmt = $conn->prepare("SELECT nombre FROM productos WHERE id = ? LIMIT 1");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 0) { $stmt->close(); return ['success' => false, 'message' => 'Producto no encontrado']; }
            $producto = $result->fetch_assoc();
            $nombre_producto = $producto['nombre'];
            $stmt->close();

            $conn->begin_transaction();

            $stmt = $conn->prepare("DELETE FROM movimientos_inventario WHERE producto_id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("DELETE FROM productos WHERE id = ?");
            $stmt->bind_param("i", $id);

            if ($stmt->execute()) {
                $stmt->close();
                $conn->commit();
                $this->limpiarCache();
                return ['success' => true, 'message' => "Producto \"{$nombre_producto}\" eliminado exitosamente"];
            }

            $conn->rollback();
            $stmt->close();
            return ['success' => false, 'message' => 'Error al eliminar producto'];
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en eliminar: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al eliminar producto: ' . $e->getMessage()];
        }
    }

    public function buscar($termino, $categoria = null) {
        global $conn;
        try {
            $termino = substr(trim($termino), 0, 100);
            $termino = preg_replace('/[^a-zA-Z0-9áéíóúñÑ\s\-]/u', '', $termino);
            $termino_like = "%$termino%";
            $sql = "SELECT * FROM productos WHERE (nombre LIKE ? OR codigo_barras LIKE ?)";
            $params = [$termino_like, $termino_like];
            $types = "ss";

            if ($categoria && $categoria !== 'Todas') {
                $categorias_validas = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];
                if (in_array($categoria, $categorias_validas)) {
                    $sql .= " AND categoria = ?";
                    $params[] = $categoria;
                    $types .= "s";
                }
            }

            $sql .= " ORDER BY nombre LIMIT 50";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $result = $stmt->get_result();
            $productos = [];
            while ($row = $result->fetch_assoc()) $productos[] = $row;
            $stmt->close();
            return ['success' => true, 'productos' => $productos];
        } catch (Exception $e) {
            error_log("Error en buscar: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al buscar productos'];
        }
    }

    public function obtenerEstadisticas() {
        global $conn;
        try {
            $stats = ['total_productos' => 0, 'stock_bajo' => 0, 'sin_stock' => 0, 'valor_inventario' => 0];
            $stats['total_productos'] = (int)$conn->query("SELECT COUNT(*) as total FROM productos")->fetch_assoc()['total'];
            $stats['stock_bajo'] = (int)$conn->query("SELECT COUNT(*) as total FROM productos WHERE stock_actual <= stock_minimo AND stock_actual > 0")->fetch_assoc()['total'];
            $stats['sin_stock'] = (int)$conn->query("SELECT COUNT(*) as total FROM productos WHERE stock_actual = 0")->fetch_assoc()['total'];
            $stats['valor_inventario'] = floatval($conn->query("SELECT SUM(stock_actual * precio) as valor FROM productos")->fetch_assoc()['valor'] ?? 0);
            return ['success' => true, 'estadisticas' => $stats];
        } catch (Exception $e) {
            error_log("Error en obtenerEstadisticas: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener estadísticas'];
        }
    }

    public function obtenerCategoriasConConteo() {
        global $conn;
        try {
            $categorias = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];
            $resultado = [];
            foreach ($categorias as $cat) {
                $stmt = $conn->prepare("SELECT COUNT(*) as total FROM productos WHERE categoria = ?");
                $stmt->bind_param("s", $cat);
                $stmt->execute();
                $count = $stmt->get_result()->fetch_assoc()['total'];
                $stmt->close();
                $resultado[] = ['nombre' => $cat, 'total' => intval($count)];
            }
            return ['success' => true, 'categorias' => $resultado];
        } catch (Exception $e) {
            error_log("Error en obtenerCategoriasConConteo: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener categorías'];
        }
    }

    public function importarExcel(array $archivo): array {
        global $conn;

        $categoriasValidas = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];

        require_once __DIR__ . '/xlsx_reader.php';

        try {
            $reader = new XlsxReader($archivo['tmp_name']);
            $filas = $reader->getRows();
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error al leer el archivo: ' . $e->getMessage()];
        }

        if (empty($filas)) return ['success' => false, 'message' => 'El archivo está vacío'];

        $encabezados = array_map(fn($h) => strtolower(trim((string)$h)), $filas[0]);
        $requeridos = ['codigo_barras','nombre','descripcion','categoria','precio','stock_minimo','stock_actual'];

        foreach ($requeridos as $campo) {
            if (!in_array($campo, $encabezados, true))
                return ['success' => false, 'message' => "Falta la columna requerida: {$campo}"];
        }

        $mapa = array_flip($encabezados);
        $totalFilas = 0;
        $importados = 0;
        $errores = [];
        $advertencias = [];

        $conn->begin_transaction();

        try {
            for ($i = 1; $i < count($filas); $i++) {
                $fila = $filas[$i];
                $numFila = $i + 1;

                $get = function(string $col) use ($fila, $mapa): string {
                    $idx = $mapa[$col] ?? -1;
                    return trim((string)($fila[$idx] ?? ''));
                };

                $codigoBarras = substr($get('codigo_barras'), 0, 50);
                $nombre = substr($get('nombre'), 0, 100);
                $descripcion = substr($get('descripcion'), 0, 65535);
                $categoria = $get('categoria');
                $precioStr = $get('precio');
                $stockMinStr = $get('stock_minimo');
                $stockActStr = $get('stock_actual');

                if (empty($codigoBarras) && empty($nombre) && empty($precioStr)) continue;

                $totalFilas++;

                if (empty($codigoBarras)) { $errores[] = ['fila' => $numFila, 'mensaje' => 'El código de barras es requerido']; continue; }
                if (!preg_match('/^[a-zA-Z0-9\-]+$/', $codigoBarras)) { $errores[] = ['fila' => $numFila, 'mensaje' => "Código de barras inválido: {$codigoBarras}"]; continue; }
                if (empty($nombre)) { $errores[] = ['fila' => $numFila, 'mensaje' => 'El nombre es requerido']; continue; }
                if (!is_numeric($precioStr) || (float)$precioStr < 0) { $errores[] = ['fila' => $numFila, 'mensaje' => "Precio inválido: {$precioStr}"]; continue; }

                $precio = (float)$precioStr;
                $stockMinimo = (is_numeric($stockMinStr) && (int)$stockMinStr >= 0) ? (int)$stockMinStr : 0;
                $stockActual = (is_numeric($stockActStr) && (int)$stockActStr >= 0) ? (int)$stockActStr : 0;

                $categoriaMapeada = 'Todas';
                foreach ($categoriasValidas as $catValida) {
                    if (mb_strtolower(trim($categoria), 'UTF-8') === mb_strtolower($catValida, 'UTF-8')) {
                        $categoriaMapeada = $catValida;
                        break;
                    }
                }
                $categoria = $categoriaMapeada;

                $stmt = $conn->prepare("SELECT id FROM productos WHERE codigo_barras = ? LIMIT 1");
                $stmt->bind_param("s", $codigoBarras);
                $stmt->execute();
                $stmt->store_result();
                $existe = $stmt->num_rows > 0;
                $stmt->close();

                if ($existe) { $advertencias[] = ['fila' => $numFila, 'mensaje' => "Código {$codigoBarras} ya existe, se omitió"]; continue; }

                $stmt = $conn->prepare("INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt->bind_param("ssssdii", $codigoBarras, $nombre, $descripcion, $categoria, $precio, $stockMinimo, $stockActual);

                if ($stmt->execute()) {
                    $productoId = $conn->insert_id;
                    $stmt->close();

                    if ($stockActual > 0) {
                        $just = "Importación masiva desde Excel";
                        $stmt2 = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, 'entrada', ?, 0, ?, ?)");
                        $stmt2->bind_param("iiis", $productoId, $stockActual, $stockActual, $just);
                        $stmt2->execute();
                        $stmt2->close();
                    }

                    $importados++;
                } else {
                    $stmt->close();
                    $errores[] = ['fila' => $numFila, 'mensaje' => "Error al insertar {$codigoBarras}"];
                }
            }

            $conn->commit();
            $this->limpiarCache();
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en importarExcel: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error durante la importación: ' . $e->getMessage()];
        }

        return [
            'success' => true,
            'total_filas' => $totalFilas,
            'importados' => $importados,
            'errores' => $errores,
            'advertencias' => $advertencias,
            'message' => "{$importados} producto(s) importados de {$totalFilas} fila(s) procesadas"
        ];
    }
    
    private function limpiarCache() {
        $cacheFiles = [
            sys_get_temp_dir() . '/pos_productos_cache.json',
            sys_get_temp_dir() . '/pos_productos_admin_cache.json'
        ];
        foreach ($cacheFiles as $file) {
            if (file_exists($file)) {
                @unlink($file);
            }
        }
        array_map('unlink', glob(sys_get_temp_dir() . '/pos_cache_*.json'));
        array_map('unlink', glob(sys_get_temp_dir() . '/pos_resumen_inventario_cache.json'));
        array_map('unlink', glob(sys_get_temp_dir() . '/pos_alertas_inventario_cache.json'));
    }
}
?>