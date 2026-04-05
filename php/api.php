<?php
// Habilitar reporte de errores para depuración (desactivar en producción)
error_reporting(E_ALL);
ini_set('display_errors', 0); // No mostrar errores en pantalla, mejor log
ini_set('log_errors', 1);

// Capturar errores fatales para devolver JSON
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        // Limpiar cualquier salida previa
        if (ob_get_length()) ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false, 
            'message' => 'Error interno del servidor: ' . $error['message']
        ]);
        exit;
    }
});

require_once 'config.php';
require_once 'productos.php';
require_once 'carrito.php';
require_once 'caja.php';
require_once 'productos_admin.php';

// Headers de caché optimizados
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

// Compresión gzip si está disponible
if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    ob_start('ob_gzhandler');
}

// Verificar conexión a la base de datos antes de continuar
if (!isset($conn) || !$conn) {
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit;
}

$origen = $_SERVER['HTTP_REFERER'] ?? '';
if (strpos($origen, $_SERVER['HTTP_HOST']) === false && $origen != '') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Origen no válido']);
    exit;
}

// Lista de acciones que NO requieren validación CSRF (solo consultas GET)
$acciones_sin_csrf = [
    'getProductos', 'buscarProductos', 'getProductosPorCategoria', 
    'buscarPorCodigo', 'getCarrito', 'getEstadoCaja', 
    'getHistorialCaja', 'getDetalleCorte', 'getCsrfToken',
    'getProductosAdmin', 'getProducto', 'buscarProductosAdmin',
    'getProductosEstadisticas', 'getCategoriasConConteo',
    'buscarVentas', 'getVentaDetalle'
];

$productos = new Productos();
$carrito = new Carrito();
$caja = new Caja();

// Instanciar productosAdmin solo si la clase existe
$productosAdmin = null;
if (class_exists('ProductosAdmin')) {
    $productosAdmin = new ProductosAdmin();
}

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array($accion, ['registrarProducto', 'actualizarProducto', 'eliminarProducto', 'realizarCambio'])) {
    $cache_files = glob(sys_get_temp_dir() . '/pos_cache_*getProductos*');
    foreach ($cache_files as $file) {
        @unlink($file);
    }
}

// Cache para consultas GET frecuentes
$cache_ttl = [
    'getProductos' => 300,
    'getProductosPorCategoria' => 300,
    'getEstadoCaja' => 30,
    'getCarrito' => 10,
    'getProductosAdmin' => 300,
    'getProductosEstadisticas' => 60,
    'getCategoriasConConteo' => 300
];

$cache_key = md5($_SERVER['REQUEST_URI']);
$cache_file = sys_get_temp_dir() . '/pos_cache_' . $cache_key . '.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($cache_ttl[$accion])) {
    if (file_exists($cache_file) && (time() - filemtime($cache_file)) < $cache_ttl[$accion]) {
        readfile($cache_file);
        exit;
    }
}

// Función para guardar en caché
function cacheResponse($data, $cache_file) {
    file_put_contents($cache_file, json_encode($data));
}

// Función para generar folio de cambio
function generarFolioCambio($conn) {
    $fecha = date('Ymd');
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM cambios_productos WHERE folio_cambio LIKE ?");
    $like = "CAMBIO-{$fecha}-%";
    $stmt->bind_param("s", $like);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $consecutivo = str_pad($row['total'] + 1, 5, '0', STR_PAD_LEFT);
    $stmt->close();
    
    return "CAMBIO-{$fecha}-{$consecutivo}";
}

// Switch de acciones
$response = null;

try {
    switch ($accion) {
        case 'getCsrfToken':
            $response = ['success' => true, 'token' => generarCsrfToken()];
            break;
            
        case 'getProductos':
            $response = $productos->todos();
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                cacheResponse($response, $cache_file);
            }
            break;
            
        case 'buscarProductos':
            $termino = $_GET['termino'] ?? '';
            $termino = substr(preg_replace('/[^a-zA-Z0-9áéíóúñÑ\s\-]/u', '', $termino), 0, 100);
            $response = $productos->buscar($termino);
            break;
            
        case 'getProductosPorCategoria':
            $categoria = $_GET['categoria'] ?? 'Todas';
            $categorias_validas = ['Todas', 'Acrílicas', 'Esmaltes', 'Selladores', 'Barniz', 'Aerosol', 'Impermeabilizante', 'Complementos'];
            $categoria = in_array($categoria, $categorias_validas) ? $categoria : 'Todas';
            $response = $productos->porCategoria($categoria);
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                cacheResponse($response, $cache_file);
            }
            break;
            
        case 'buscarPorCodigo':
            $codigo = $_GET['codigo'] ?? '';
            $codigo = substr(preg_replace('/[^a-zA-Z0-9\-]/', '', $codigo), 0, 50);
            $response = $productos->buscarPorCodigo($codigo);
            break;
        
        case 'agregarCarrito':
            if (!isset($_POST['producto_id'])) {
                $response = ['success' => false, 'message' => 'ID requerido'];
                break;
            }
            $producto_id = filter_var($_POST['producto_id'], FILTER_VALIDATE_INT);
            $cantidad = isset($_POST['cantidad']) ? filter_var($_POST['cantidad'], FILTER_VALIDATE_INT) : 1;
            
            if (!$producto_id || $producto_id <= 0) {
                $response = ['success' => false, 'message' => 'ID de producto inválido'];
                break;
            }
            
            if (!$cantidad || $cantidad <= 0) {
                $cantidad = 1;
            }
            
            $response = $carrito->agregar($producto_id, $cantidad);
            break;
            
        case 'modificarCarrito':
            if (!isset($_POST['producto_id']) || !isset($_POST['cantidad'])) {
                $response = ['success' => false, 'message' => 'Datos incompletos'];
                break;
            }
            $producto_id = filter_var($_POST['producto_id'], FILTER_VALIDATE_INT);
            $cantidad = filter_var($_POST['cantidad'], FILTER_VALIDATE_INT);
            
            if (!$producto_id || $producto_id <= 0) {
                $response = ['success' => false, 'message' => 'ID de producto inválido'];
                break;
            }
            
            if ($cantidad === false || $cantidad < 0) {
                $response = ['success' => false, 'message' => 'Cantidad inválida'];
                break;
            }
            
            $response = $carrito->modificar($producto_id, $cantidad);
            break;
            
        case 'eliminarCarrito':
            if (!isset($_POST['producto_id'])) {
                $response = ['success' => false, 'message' => 'ID requerido'];
                break;
            }
            $producto_id = filter_var($_POST['producto_id'], FILTER_VALIDATE_INT);
            
            if (!$producto_id || $producto_id <= 0) {
                $response = ['success' => false, 'message' => 'ID de producto inválido'];
                break;
            }
            
            $response = $carrito->eliminar($producto_id);
            break;
            
        case 'getCarrito':
            $response = $carrito->obtener();
            break;
            
        case 'vaciarCarrito':
            $response = $carrito->vaciar();
            break;
            
        case 'procesarVenta':
            if (!isset($_POST['metodo_pago'])) {
                $response = ['success' => false, 'message' => 'Método de pago requerido'];
                break;
            }
            
            $metodo_pago = sanitize($_POST['metodo_pago']);
            $metodos_validos = ['Efectivo', 'Tarjeta', 'Transferencia'];
            
            if (!in_array($metodo_pago, $metodos_validos)) {
                $response = ['success' => false, 'message' => 'Método de pago inválido'];
                break;
            }
            
            $efectivo = isset($_POST['efectivo_recibido']) ? filter_var($_POST['efectivo_recibido'], FILTER_VALIDATE_FLOAT) : null;
            $cambio = isset($_POST['cambio']) ? filter_var($_POST['cambio'], FILTER_VALIDATE_FLOAT) : null;
            
            $response = $carrito->procesarVenta($metodo_pago, $efectivo, $cambio);
            break;

        case 'getEstadoCaja':
            $response = $caja->obtenerEstado();
            break;

        case 'abrirCaja':
            $monto_inicial = isset($_POST['monto_inicial']) ? filter_var($_POST['monto_inicial'], FILTER_VALIDATE_FLOAT) : 0;
            
            if ($monto_inicial === false || $monto_inicial < 0) {
                $response = ['success' => false, 'message' => 'Monto inicial inválido'];
                break;
            }
            
            $response = $caja->abrirCaja($monto_inicial);
            break;

        case 'cerrarCaja':
            $monto_final = isset($_POST['monto_final']) ? filter_var($_POST['monto_final'], FILTER_VALIDATE_FLOAT) : 0;
            $observaciones = isset($_POST['observaciones']) ? substr(sanitize($_POST['observaciones']), 0, 500) : '';
            
            if ($monto_final === false || $monto_final < 0) {
                $response = ['success' => false, 'message' => 'Monto final inválido'];
                break;
            }
            
            $response = $caja->cerrarCaja($monto_final, $observaciones);
            break;

        case 'agregarGasto':
            $concepto = isset($_POST['concepto']) ? substr(sanitize($_POST['concepto']), 0, 255) : '';
            $monto = isset($_POST['monto']) ? filter_var($_POST['monto'], FILTER_VALIDATE_FLOAT) : 0;
            $referencia = isset($_POST['referencia']) ? substr(sanitize($_POST['referencia']), 0, 100) : '';
            
            if (empty($concepto)) {
                $response = ['success' => false, 'message' => 'Concepto requerido'];
                break;
            }
            
            if ($monto === false || $monto <= 0) {
                $response = ['success' => false, 'message' => 'Monto inválido'];
                break;
            }
            
            $response = $caja->agregarGasto($concepto, $monto, $referencia);
            break;

        case 'getHistorialCaja':
            $fecha_inicio = isset($_GET['fecha_inicio']) ? sanitize($_GET['fecha_inicio']) : null;
            $fecha_fin = isset($_GET['fecha_fin']) ? sanitize($_GET['fecha_fin']) : null;
            $response = $caja->obtenerHistorial($fecha_inicio, $fecha_fin);
            break;

        case 'getDetalleCorte':
            $corte_id = isset($_GET['corte_id']) ? filter_var($_GET['corte_id'], FILTER_VALIDATE_INT) : 0;
            
            if (!$corte_id || $corte_id <= 0) {
                $response = ['success' => false, 'message' => 'ID de corte inválido'];
                break;
            }
            
            $response = $caja->obtenerDetalleCorte($corte_id);
            break;
        
        // ==================== MÓDULO DE PRODUCTOS ====================
        
        case 'getProductosAdmin':
            if ($productosAdmin) {
                $response = $productosAdmin->obtenerTodos();
                if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                    cacheResponse($response, $cache_file);
                }
            } else {
                $response = ['success' => false, 'message' => 'Módulo de productos no disponible'];
            }
            break;
        
        case 'getProducto':
            $id = $_GET['id'] ?? 0;
            if ($productosAdmin) {
                $response = $productosAdmin->obtenerPorId($id);
            } else {
                $response = ['success' => false, 'message' => 'Módulo de productos no disponible'];
            }
            break;
        
        case 'registrarProducto':
            if ($productosAdmin) {
                $response = $productosAdmin->registrar($_POST);
            } else {
                $response = ['success' => false, 'message' => 'Módulo de productos no disponible'];
            }
            break;
        
        case 'actualizarProducto':
            $id = $_POST['id'] ?? 0;
            if ($productosAdmin) {
                $response = $productosAdmin->actualizar($id, $_POST);
            } else {
                $response = ['success' => false, 'message' => 'Módulo de productos no disponible'];
            }
            break;
        
        case 'eliminarProducto':
            $id = $_POST['id'] ?? 0;
            if ($productosAdmin) {
                $response = $productosAdmin->eliminar($id);
            } else {
                $response = ['success' => false, 'message' => 'Módulo de productos no disponible'];
            }
            break;
        
        case 'buscarProductosAdmin':
            $termino = $_GET['termino'] ?? '';
            $categoria = $_GET['categoria'] ?? null;
            if ($productosAdmin) {
                $response = $productosAdmin->buscar($termino, $categoria);
            } else {
                $response = ['success' => false, 'message' => 'Módulo de productos no disponible'];
            }
            break;
        
        case 'getProductosEstadisticas':
            if ($productosAdmin) {
                $response = $productosAdmin->obtenerEstadisticas();
                if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                    cacheResponse($response, $cache_file);
                }
            } else {
                $response = ['success' => false, 'message' => 'Módulo de productos no disponible'];
            }
            break;
        
        case 'getCategoriasConConteo':
            if ($productosAdmin) {
                $response = $productosAdmin->obtenerCategoriasConConteo();
                if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                    cacheResponse($response, $cache_file);
                }
            } else {
                $response = ['success' => false, 'message' => 'Módulo de productos no disponible'];
            }
            break;
        
        // ==================== MÓDULO DE CAMBIOS ====================
        
        case 'buscarVentas':
            $termino = $_GET['termino'] ?? '';
            $termino = substr(preg_replace('/[^a-zA-Z0-9\-]/', '', $termino), 0, 50);
            
            try {
                $stmt = $conn->prepare("SELECT id, folio, total, metodo_pago, fecha FROM ventas WHERE folio LIKE ? ORDER BY fecha DESC LIMIT 10");
                $termino_like = "%$termino%";
                $stmt->bind_param("s", $termino_like);
                $stmt->execute();
                $result = $stmt->get_result();
                
                $ventas = [];
                while ($row = $result->fetch_assoc()) {
                    $ventas[] = $row;
                }
                $stmt->close();
                
                $response = ['success' => true, 'ventas' => $ventas];
            } catch (Exception $e) {
                error_log("Error en buscarVentas: " . $e->getMessage());
                $response = ['success' => false, 'message' => 'Error al buscar ventas'];
            }
            break;

        case 'getVentaDetalle':
            $id = filter_var($_GET['id'] ?? 0, FILTER_VALIDATE_INT);
            
            if (!$id || $id <= 0) {
                $response = ['success' => false, 'message' => 'ID inválido'];
                break;
            }
            
            try {
                $stmt = $conn->prepare("SELECT dv.*, p.nombre, p.codigo_barras FROM detalles_venta dv JOIN productos p ON dv.producto_id = p.id WHERE dv.venta_id = ?");
                $stmt->bind_param("i", $id);
                $stmt->execute();
                $result = $stmt->get_result();
                
                $detalles = [];
                while ($row = $result->fetch_assoc()) {
                    $detalles[] = $row;
                }
                $stmt->close();
                
                $response = ['success' => true, 'detalles' => $detalles];
            } catch (Exception $e) {
                error_log("Error en getVentaDetalle: " . $e->getMessage());
                $response = ['success' => false, 'message' => 'Error al obtener detalles'];
            }
            break;

        case 'realizarCambio':
            $venta_id = filter_var($_POST['venta_id'] ?? 0, FILTER_VALIDATE_INT);
            $producto_original_id = filter_var($_POST['producto_original_id'] ?? 0, FILTER_VALIDATE_INT);
            $producto_nuevo_id = filter_var($_POST['producto_nuevo_id'] ?? 0, FILTER_VALIDATE_INT);
            $cantidad = filter_var($_POST['cantidad'] ?? 0, FILTER_VALIDATE_INT);
            $motivo = isset($_POST['motivo']) ? substr(sanitize($_POST['motivo']), 0, 500) : 'Cambio solicitado por cliente';
            
            if (!$venta_id || $venta_id <= 0) {
                $response = ['success' => false, 'message' => 'ID de venta inválido'];
                break;
            }
            
            if (!$producto_original_id || $producto_original_id <= 0) {
                $response = ['success' => false, 'message' => 'ID de producto original inválido'];
                break;
            }
            
            if (!$producto_nuevo_id || $producto_nuevo_id <= 0) {
                $response = ['success' => false, 'message' => 'ID de producto nuevo inválido'];
                break;
            }
            
            if (!$cantidad || $cantidad <= 0) {
                $response = ['success' => false, 'message' => 'Cantidad inválida'];
                break;
            }
            
            try {
                $conn->begin_transaction();
                
                // 1. Verificar que la venta existe
                $stmt = $conn->prepare("SELECT id, folio, total FROM ventas WHERE id = ?");
                $stmt->bind_param("i", $venta_id);
                $stmt->execute();
                $result = $stmt->get_result();
                $venta = $result->fetch_assoc();
                $stmt->close();
                
                if (!$venta) {
                    throw new Exception("Venta no encontrada");
                }
                
                // 2. Verificar que el detalle de venta existe y tiene suficiente cantidad
                $stmt = $conn->prepare("SELECT dv.*, p.nombre, p.precio FROM detalles_venta dv JOIN productos p ON dv.producto_id = p.id WHERE dv.venta_id = ? AND dv.producto_id = ?");
                $stmt->bind_param("ii", $venta_id, $producto_original_id);
                $stmt->execute();
                $result = $stmt->get_result();
                $detalle_original = $result->fetch_assoc();
                $stmt->close();
                
                if (!$detalle_original) {
                    throw new Exception("Producto no encontrado en la venta");
                }
                
                if ($detalle_original['cantidad'] < $cantidad) {
                    throw new Exception("No hay suficiente cantidad para cambiar. Disponible: {$detalle_original['cantidad']}");
                }
                
                // 3. Verificar stock del producto nuevo
                $stmt = $conn->prepare("SELECT id, nombre, stock_actual, precio FROM productos WHERE id = ?");
                $stmt->bind_param("i", $producto_nuevo_id);
                $stmt->execute();
                $result = $stmt->get_result();
                $producto_nuevo = $result->fetch_assoc();
                $stmt->close();
                
                if (!$producto_nuevo) {
                    throw new Exception("Producto nuevo no encontrado");
                }
                
                if ($producto_nuevo['stock_actual'] < $cantidad) {
                    throw new Exception("Stock insuficiente del producto nuevo. Disponible: {$producto_nuevo['stock_actual']}");
                }
                
                // 4. Obtener precios
                $precio_original = floatval($detalle_original['precio_unitario']);
                $precio_nuevo = floatval($producto_nuevo['precio']);
                
                // CALCULAR LA DIFERENCIA CORRECTAMENTE
                // Si el nuevo producto es más caro: diferencia POSITIVA (cliente paga)
                // Si el nuevo producto es más barato: diferencia NEGATIVA (se devuelve dinero)
                $diferencia_por_unidad = $precio_nuevo - $precio_original;
                $diferencia_total = $diferencia_por_unidad * $cantidad;
                
                // 5. Generar folio de cambio
                $folio_cambio = generarFolioCambio($conn);
                
                // 6. Insertar registro en cambios_productos
                $stmt = $conn->prepare("INSERT INTO cambios_productos (venta_id, folio_cambio, producto_original_id, producto_nuevo_id, cantidad, precio_original, precio_nuevo, diferencia_precio, motivo, usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $usuario = 'Administrador';
                $stmt->bind_param("isiiidddss", $venta_id, $folio_cambio, $producto_original_id, $producto_nuevo_id, $cantidad, $precio_original, $precio_nuevo, $diferencia_total, $motivo, $usuario);
                $stmt->execute();
                $cambio_id = $conn->insert_id;
                $stmt->close();
                
                // 7. Registrar en auditoría de cambios
                $datos_cambio = json_encode([
                    'venta_id' => $venta_id,
                    'folio_venta' => $venta['folio'],
                    'producto_original' => $detalle_original['nombre'],
                    'producto_nuevo' => $producto_nuevo['nombre'],
                    'cantidad' => $cantidad,
                    'precio_original' => $precio_original,
                    'precio_nuevo' => $precio_nuevo,
                    'diferencia_por_unidad' => $diferencia_por_unidad,
                    'diferencia_total' => $diferencia_total
                ]);
                
                $stmt = $conn->prepare("INSERT INTO auditoria_cambios (cambio_id, accion, datos_nuevos, usuario) VALUES (?, 'creado', ?, ?)");
                $stmt->bind_param("iss", $cambio_id, $datos_cambio, $usuario);
                $stmt->execute();
                $stmt->close();
                
                // 8. Actualizar o eliminar el detalle original
                if ($detalle_original['cantidad'] > $cantidad) {
                    $nueva_cantidad = $detalle_original['cantidad'] - $cantidad;
                    $nuevo_subtotal = $nueva_cantidad * $precio_original;
                    
                    $stmt = $conn->prepare("UPDATE detalles_venta SET cantidad = ?, subtotal = ? WHERE id = ?");
                    $stmt->bind_param("idi", $nueva_cantidad, $nuevo_subtotal, $detalle_original['id']);
                    $stmt->execute();
                    $stmt->close();
                } else {
                    $stmt = $conn->prepare("DELETE FROM detalles_venta WHERE id = ?");
                    $stmt->bind_param("i", $detalle_original['id']);
                    $stmt->execute();
                    $stmt->close();
                }
                
                // 9. Agregar el nuevo producto al detalle de venta
                $nuevo_subtotal = $cantidad * $precio_nuevo;
                $stmt = $conn->prepare("INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal, fue_cambiado, cambio_id) VALUES (?, ?, ?, ?, ?, 1, ?)");
                $stmt->bind_param("iiiddi", $venta_id, $producto_nuevo_id, $cantidad, $precio_nuevo, $nuevo_subtotal, $cambio_id);
                $stmt->execute();
                $stmt->close();
                
                // 10. Actualizar stock de productos
                // Devolver stock del producto original (lo que el cliente devuelve)
                $stmt = $conn->prepare("UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?");
                $stmt->bind_param("ii", $cantidad, $producto_original_id);
                $stmt->execute();
                $stmt->close();
                
                // Reducir stock del producto nuevo (lo que el cliente recibe)
                $stmt = $conn->prepare("UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?");
                $stmt->bind_param("ii", $cantidad, $producto_nuevo_id);
                $stmt->execute();
                $stmt->close();
                
                // 11. Registrar movimientos de inventario
                // Movimiento para el producto original (entrada por devolución)
                $justificacion = "Devolución por cambio - Folio: $folio_cambio";
                $stmt = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ?");
                $stmt->bind_param("i", $producto_original_id);
                $stmt->execute();
                $result = $stmt->get_result();
                $stock_original_actual = $result->fetch_assoc()['stock_actual'];
                $stock_original_anterior = $stock_original_actual - $cantidad;
                $stmt->close();
                
                $stmt = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, 'entrada', ?, ?, ?, ?)");
                $stmt->bind_param("iiiss", $producto_original_id, $cantidad, $stock_original_anterior, $stock_original_actual, $justificacion);
                $stmt->execute();
                $stmt->close();
                
                // Movimiento para el producto nuevo (salida por cambio)
                $stmt = $conn->prepare("SELECT stock_actual FROM productos WHERE id = ?");
                $stmt->bind_param("i", $producto_nuevo_id);
                $stmt->execute();
                $result = $stmt->get_result();
                $stock_nuevo_actual = $result->fetch_assoc()['stock_actual'];
                $stock_nuevo_anterior = $stock_nuevo_actual + $cantidad;
                $stmt->close();
                
                $stmt = $conn->prepare("INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, justificacion) VALUES (?, 'salida', ?, ?, ?, ?)");
                $stmt->bind_param("iiiss", $producto_nuevo_id, $cantidad, $stock_nuevo_anterior, $stock_nuevo_actual, $justificacion);
                $stmt->execute();
                $stmt->close();
                
                // 12. Recalcular el total de la venta
                $stmt = $conn->prepare("SELECT SUM(subtotal) as suma_detalles FROM detalles_venta WHERE venta_id = ?");
                $stmt->bind_param("i", $venta_id);
                $stmt->execute();
                $result = $stmt->get_result();
                $suma_detalles = floatval($result->fetch_assoc()['suma_detalles']);
                $stmt->close();
                
                // El nuevo total de la venta = suma de todos los detalles
                $nuevo_total = $suma_detalles;
                
                // Actualizar el total de la venta
                $stmt = $conn->prepare("UPDATE ventas SET total = ?, cambios_realizados = 1 WHERE id = ?");
                $stmt->bind_param("di", $nuevo_total, $venta_id);
                $stmt->execute();
                $stmt->close();
                
                $conn->commit();
                
                // Preparar mensaje de respuesta con la información correcta de la diferencia
                $mensaje_diferencia = "";
                if ($diferencia_total > 0) {
                    $mensaje_diferencia = " El cliente debe pagar $" . number_format($diferencia_total, 2);
                } else if ($diferencia_total < 0) {
                    $mensaje_diferencia = " Se debe devolver al cliente $" . number_format(abs($diferencia_total), 2);
                }
                
                $response = [
                    'success' => true, 
                    'message' => '✅ Cambio realizado exitosamente.' . $mensaje_diferencia,
                    'folio_cambio' => $folio_cambio,
                    'cambio_id' => $cambio_id,
                    'datos' => [
                        'folio_venta' => $venta['folio'],
                        'producto_original' => $detalle_original['nombre'],
                        'producto_nuevo' => $producto_nuevo['nombre'],
                        'cantidad' => $cantidad,
                        'precio_original' => $precio_original,
                        'precio_nuevo' => $precio_nuevo,
                        'diferencia_por_unidad' => $diferencia_por_unidad,
                        'diferencia_total' => $diferencia_total,
                        'mensaje_diferencia' => $mensaje_diferencia
                    ]
                ];
                
            } catch (Exception $e) {
                $conn->rollback();
                error_log("Error en realizarCambio: " . $e->getMessage());
                $response = ['success' => false, 'message' => 'Error al realizar el cambio: ' . $e->getMessage()];
            }
            break;
            
        default:
            http_response_code(400);
            $response = ['error' => 'Acción no válida: ' . $accion];
    }
} catch (Exception $e) {
    error_log("Error en API: " . $e->getMessage());
    $response = ['success' => false, 'message' => 'Error interno: ' . $e->getMessage()];
}

// Asegurar que la respuesta sea siempre un array
if (!is_array($response)) {
    $response = ['success' => false, 'message' => 'Respuesta inválida del servidor'];
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);

// Limpiar caché antiguo periódicamente (1% de probabilidad)
if (rand(1, 100) === 1) {
    $cache_files = glob(sys_get_temp_dir() . '/pos_cache_*.json');
    $now = time();
    foreach ($cache_files as $file) {
        if ($now - filemtime($file) > 3600) {
            @unlink($file);
        }
    }
}

if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    ob_end_flush();
}
?>