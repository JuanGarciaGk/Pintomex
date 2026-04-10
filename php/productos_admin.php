<?php
require_once 'config.php';

class ProductosAdmin {

    public function obtenerTodos() {
        global $conn;

        try {
            $stmt = $conn->prepare("SELECT * FROM productos ORDER BY nombre");
            $stmt->execute();
            $result = $stmt->get_result();

            $productos = [];
            while ($row = $result->fetch_assoc()) {
                $productos[] = $row;
            }
            $stmt->close();

            return ['success' => true, 'productos' => $productos];
        } catch (Exception $e) {
            error_log("Error en obtenerTodos: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener productos'];
        }
    }

    public function obtenerPorId($id) {
        global $conn;

        try {
            $id = filter_var($id, FILTER_VALIDATE_INT);
            if (!$id || $id <= 0) {
                return ['success' => false, 'message' => 'ID inválido'];
            }

            $stmt = $conn->prepare("SELECT * FROM productos WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows === 0) {
                $stmt->close();
                return ['success' => false, 'message' => 'Producto no encontrado'];
            }

            $producto = $result->fetch_assoc();
            $stmt->close();

            return ['success' => true, 'producto' => $producto];
        } catch (Exception $e) {
            error_log("Error en obtenerPorId: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener producto'];
        }
    }

    public function registrar($datos) {
        global $conn;

        try {
            $codigo_barras = substr(trim($datos['codigo_barras'] ?? ''), 0, 50);
            $nombre        = substr(trim($datos['nombre']        ?? ''), 0, 100);
            $descripcion   = substr(trim($datos['descripcion']   ?? ''), 0, 65535);
            $categoria     = $datos['categoria'] ?? 'Todas';
            $precio        = filter_var($datos['precio']       ?? 0, FILTER_VALIDATE_FLOAT);
            $stock_minimo  = filter_var($datos['stock_minimo'] ?? 0, FILTER_VALIDATE_INT);
            $stock_actual  = filter_var($datos['stock_actual'] ?? 0, FILTER_VALIDATE_INT);

            if (empty($codigo_barras)) {
                return ['success' => false, 'message' => 'El código de barras es requerido'];
            }
            if (empty($nombre)) {
                return ['success' => false, 'message' => 'El nombre es requerido'];
            }
            if ($precio === false || $precio < 0) {
                return ['success' => false, 'message' => 'Precio inválido'];
            }

            $categorias_validas = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];
            if (!in_array($categoria, $categorias_validas)) {
                $categoria = 'Todas';
            }

            if ($stock_minimo === false || $stock_minimo < 0) $stock_minimo = 0;
            if ($stock_actual === false || $stock_actual < 0) $stock_actual = 0;

            $stmt = $conn->prepare("SELECT id FROM productos WHERE codigo_barras = ?");
            $stmt->bind_param("s", $codigo_barras);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $stmt->close();
                return ['success' => false, 'message' => 'El código de barras ya está registrado'];
            }
            $stmt->close();

            $conn->begin_transaction();

            $stmt = $conn->prepare(
                "INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->bind_param("ssssdii", $codigo_barras, $nombre, $descripcion, $categoria, $precio, $stock_minimo, $stock_actual);

            if ($stmt->execute()) {
                $producto_id = $conn->insert_id;
                $stmt->close();

                if ($stock_actual > 0) {
                    $justificacion = "Registro inicial de producto";
                    $stmt = $conn->prepare(
                        "INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion)
                         VALUES (?, 'entrada', ?, 0, ?, ?)"
                    );
                    $stmt->bind_param("iiis", $producto_id, $stock_actual, $stock_actual, $justificacion);
                    $stmt->execute();
                    $stmt->close();
                }

                $conn->commit();
                return ['success' => true, 'message' => 'Producto registrado exitosamente', 'id' => $producto_id];
            } else {
                $conn->rollback();
                $stmt->close();
                return ['success' => false, 'message' => 'Error al registrar producto'];
            }

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
            if (!$id || $id <= 0) {
                return ['success' => false, 'message' => 'ID inválido'];
            }

            $stmt = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 0) {
                $stmt->close();
                return ['success' => false, 'message' => 'Producto no encontrado'];
            }
            $producto_actual = $result->fetch_assoc();
            $stock_anterior  = $producto_actual['stock_actual'];
            $stmt->close();

            $codigo_barras = substr(trim($datos['codigo_barras'] ?? ''), 0, 50);
            $nombre        = substr(trim($datos['nombre']        ?? ''), 0, 100);
            $descripcion   = substr(trim($datos['descripcion']   ?? ''), 0, 65535);
            $categoria     = $datos['categoria'] ?? 'Todas';
            $precio        = filter_var($datos['precio']       ?? 0, FILTER_VALIDATE_FLOAT);
            $stock_minimo  = filter_var($datos['stock_minimo'] ?? 0, FILTER_VALIDATE_INT);
            $stock_actual  = filter_var($datos['stock_actual'] ?? 0, FILTER_VALIDATE_INT);

            if (empty($codigo_barras)) {
                return ['success' => false, 'message' => 'El código de barras es requerido'];
            }
            if (empty($nombre)) {
                return ['success' => false, 'message' => 'El nombre es requerido'];
            }
            if ($precio === false || $precio < 0) {
                return ['success' => false, 'message' => 'Precio inválido'];
            }

            $categorias_validas = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];
            if (!in_array($categoria, $categorias_validas)) {
                $categoria = 'Todas';
            }

            if ($stock_minimo === false || $stock_minimo < 0) $stock_minimo = 0;
            if ($stock_actual === false || $stock_actual < 0) $stock_actual = 0;

            $stmt = $conn->prepare("SELECT id FROM productos WHERE codigo_barras = ? AND id != ?");
            $stmt->bind_param("si", $codigo_barras, $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $stmt->close();
                return ['success' => false, 'message' => 'El código de barras ya está registrado en otro producto'];
            }
            $stmt->close();

            $conn->begin_transaction();

            $stmt = $conn->prepare(
                "UPDATE productos SET
                    codigo_barras = ?,
                    nombre        = ?,
                    descripcion   = ?,
                    categoria     = ?,
                    precio        = ?,
                    stock_minimo  = ?,
                    stock_actual  = ?
                 WHERE id = ?"
            );
            $stmt->bind_param("ssssdiii", $codigo_barras, $nombre, $descripcion, $categoria, $precio, $stock_minimo, $stock_actual, $id);

            if ($stmt->execute()) {
                $stmt->close();

                if ($stock_actual != $stock_anterior) {
                    $diferencia    = $stock_actual - $stock_anterior;
                    $tipo          = $diferencia > 0 ? 'entrada' : 'salida';
                    $justificacion = "Actualización manual de inventario";

                    $stmt = $conn->prepare(
                        "INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion)
                         VALUES (?, ?, ?, ?, ?, ?)"
                    );
                    $stmt->bind_param("isiiis", $id, $tipo, abs($diferencia), $stock_anterior, $stock_actual, $justificacion);
                    $stmt->execute();
                    $stmt->close();
                }

                $conn->commit();
                return ['success' => true, 'message' => 'Producto actualizado exitosamente'];
            } else {
                $conn->rollback();
                $stmt->close();
                return ['success' => false, 'message' => 'Error al actualizar producto'];
            }

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
            if (!$id || $id <= 0) {
                return ['success' => false, 'message' => 'ID inválido'];
            }

            // Solo verificar que el producto existe
            $stmt = $conn->prepare("SELECT nombre FROM productos WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows === 0) {
                $stmt->close();
                return ['success' => false, 'message' => 'Producto no encontrado'];
            }

            $producto        = $result->fetch_assoc();
            $nombre_producto = $producto['nombre'];
            $stmt->close();

            $conn->begin_transaction();

            // Eliminar movimientos de inventario del producto
            $stmt = $conn->prepare("DELETE FROM movimientos_inventario WHERE producto_id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $stmt->close();

            // Eliminar el producto.
            // Gracias al CONSTRAINT fk_detalles_producto ON DELETE SET NULL,
            // los detalles de ventas históricas conservan sus datos con producto_id = NULL.
            $stmt = $conn->prepare("DELETE FROM productos WHERE id = ?");
            $stmt->bind_param("i", $id);

            if ($stmt->execute()) {
                $stmt->close();
                $conn->commit();
                return ['success' => true, 'message' => "Producto \"{$nombre_producto}\" eliminado exitosamente"];
            } else {
                $conn->rollback();
                $stmt->close();
                return ['success' => false, 'message' => 'Error al eliminar producto'];
            }

        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error en eliminar: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al eliminar producto: ' . $e->getMessage()];
        }
    }

    public function buscar($termino, $categoria = null) {
        global $conn;

        try {
            $termino      = substr(trim($termino), 0, 100);
            $termino      = preg_replace('/[^a-zA-Z0-9áéíóúñÑ\s\-]/u', '', $termino);
            $termino_like = "%$termino%";

            $sql    = "SELECT * FROM productos WHERE (nombre LIKE ? OR codigo_barras LIKE ?)";
            $params = [$termino_like, $termino_like];
            $types  = "ss";

            if ($categoria && $categoria !== 'Todas') {
                $categorias_validas = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];
                if (in_array($categoria, $categorias_validas)) {
                    $sql    .= " AND categoria = ?";
                    $params[] = $categoria;
                    $types  .= "s";
                }
            }

            $sql .= " ORDER BY nombre LIMIT 50";

            $stmt = $conn->prepare($sql);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $result = $stmt->get_result();

            $productos = [];
            while ($row = $result->fetch_assoc()) {
                $productos[] = $row;
            }
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
            $stats = [
                'total_productos'  => 0,
                'stock_bajo'       => 0,
                'sin_stock'        => 0,
                'valor_inventario' => 0
            ];

            $result = $conn->query("SELECT COUNT(*) as total FROM productos");
            $stats['total_productos'] = $result->fetch_assoc()['total'];

            $result = $conn->query("SELECT COUNT(*) as total FROM productos WHERE stock_actual <= stock_minimo AND stock_actual > 0");
            $stats['stock_bajo'] = $result->fetch_assoc()['total'];

            $result = $conn->query("SELECT COUNT(*) as total FROM productos WHERE stock_actual = 0");
            $stats['sin_stock'] = $result->fetch_assoc()['total'];

            $result = $conn->query("SELECT SUM(stock_actual * precio) as valor FROM productos");
            $stats['valor_inventario'] = floatval($result->fetch_assoc()['valor'] ?? 0);

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
            $resultado  = [];

            foreach ($categorias as $cat) {
                $stmt = $conn->prepare("SELECT COUNT(*) as total FROM productos WHERE categoria = ?");
                $stmt->bind_param("s", $cat);
                $stmt->execute();
                $result = $stmt->get_result();
                $count  = $result->fetch_assoc()['total'];
                $stmt->close();

                $resultado[] = ['nombre' => $cat, 'total' => intval($count)];
            }

            return ['success' => true, 'categorias' => $resultado];

        } catch (Exception $e) {
            error_log("Error en obtenerCategoriasConConteo: " . $e->getMessage());
            return ['success' => false, 'message' => 'Error al obtener categorías'];
        }
    }
}
?>