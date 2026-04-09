<?php
// Habilitar reporte de errores para depuración (desactivar en producción)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Capturar errores fatales para devolver JSON
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
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
    'buscarVentaPorFolio'
];

$productos = new Productos();
$carrito = new Carrito();
$caja = new Caja();

$productosAdmin = null;
if (class_exists('ProductosAdmin')) {
    $productosAdmin = new ProductosAdmin();
}

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';

// Limpiar caché cuando se modifican productos o se cancela una venta
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array($accion, [
    'registrarProducto', 'actualizarProducto', 'eliminarProducto', 'cancelarVenta'
])) {
    $cache_files = glob(sys_get_temp_dir() . '/pos_cache_*getProductos*');
    foreach ($cache_files as $file) {
        @unlink($file);
    }
}

// Cache para consultas GET frecuentes
$cache_ttl = [
    'getProductos'           => 300,
    'getProductosPorCategoria' => 300,
    'getEstadoCaja'          => 30,
    'getCarrito'             => 10,
    'getProductosAdmin'      => 300,
    'getProductosEstadisticas' => 60,
    'getCategoriasConConteo' => 300
];

$cache_key  = md5($_SERVER['REQUEST_URI']);
$cache_file = sys_get_temp_dir() . '/pos_cache_' . $cache_key . '.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($cache_ttl[$accion])) {
    if (file_exists($cache_file) && (time() - filemtime($cache_file)) < $cache_ttl[$accion]) {
        readfile($cache_file);
        exit;
    }
}

function cacheResponse($data, $cache_file) {
    file_put_contents($cache_file, json_encode($data));
}

// Switch de acciones
$response = null;

try {
    switch ($accion) {

        // ── CSRF ─────────────────────────────────────────────────────────────
        case 'getCsrfToken':
            $response = ['success' => true, 'token' => generarCsrfToken()];
            break;

        // ── PRODUCTOS (lectura) ───────────────────────────────────────────────
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

        // ── CARRITO ───────────────────────────────────────────────────────────
        case 'agregarCarrito':
            if (!isset($_POST['producto_id'])) {
                $response = ['success' => false, 'message' => 'ID requerido'];
                break;
            }
            $producto_id = filter_var($_POST['producto_id'], FILTER_VALIDATE_INT);
            $cantidad    = isset($_POST['cantidad']) ? filter_var($_POST['cantidad'], FILTER_VALIDATE_INT) : 1;

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
            $cantidad    = filter_var($_POST['cantidad'], FILTER_VALIDATE_INT);

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

        // ── VENTA ─────────────────────────────────────────────────────────────
        case 'procesarVenta':
            if (!isset($_POST['metodo_pago'])) {
                $response = ['success' => false, 'message' => 'Método de pago requerido'];
                break;
            }
            $metodo_pago    = sanitize($_POST['metodo_pago']);
            $metodos_validos = ['Efectivo', 'Tarjeta', 'Transferencia'];

            if (!in_array($metodo_pago, $metodos_validos)) {
                $response = ['success' => false, 'message' => 'Método de pago inválido'];
                break;
            }
            $efectivo = isset($_POST['efectivo_recibido']) ? filter_var($_POST['efectivo_recibido'], FILTER_VALIDATE_FLOAT) : null;
            $cambio   = isset($_POST['cambio'])            ? filter_var($_POST['cambio'],            FILTER_VALIDATE_FLOAT) : null;

            $response = $carrito->procesarVenta($metodo_pago, $efectivo, $cambio);
            break;

        // ── CANCELAR TICKET ───────────────────────────────────────────────────
        case 'buscarVentaPorFolio':
            $folio = $_GET['folio'] ?? '';
            $folio = substr(preg_replace('/[^a-zA-Z0-9\-]/', '', $folio), 0, 20);
            if (empty($folio)) {
                $response = ['success' => false, 'message' => 'Folio requerido'];
                break;
            }
            $response = $carrito->buscarVentaPorFolio($folio);
            break;

        case 'cancelarVenta':
            if (!isset($_POST['folio'])) {
                $response = ['success' => false, 'message' => 'Folio requerido'];
                break;
            }
            $folio  = substr(preg_replace('/[^a-zA-Z0-9\-]/', '', $_POST['folio']), 0, 20);
            $motivo = isset($_POST['motivo']) ? substr(sanitize($_POST['motivo']), 0, 255) : 'Sin motivo';

            if (empty($folio)) {
                $response = ['success' => false, 'message' => 'Folio inválido'];
                break;
            }
            $response = $carrito->cancelarVenta($folio, $motivo);

            // Limpiar caché de productos porque el stock cambió
            if ($response['success']) {
                $cache_files = glob(sys_get_temp_dir() . '/pos_cache_*.json');
                foreach ($cache_files as $cf) {
                    @unlink($cf);
                }
            }
            break;

        // ── CAJA ──────────────────────────────────────────────────────────────
        case 'getEstadoCaja':
            $response = $caja->obtenerEstado();
            break;

        case 'abrirCaja':
            $monto_inicial = isset($_POST['monto_inicial'])
                ? filter_var($_POST['monto_inicial'], FILTER_VALIDATE_FLOAT)
                : 0;
            if ($monto_inicial === false || $monto_inicial < 0) {
                $response = ['success' => false, 'message' => 'Monto inicial inválido'];
                break;
            }
            $response = $caja->abrirCaja($monto_inicial);
            break;

        case 'cerrarCaja':
            $monto_final   = isset($_POST['monto_final'])
                ? filter_var($_POST['monto_final'], FILTER_VALIDATE_FLOAT)
                : 0;
            $observaciones = isset($_POST['observaciones'])
                ? substr(sanitize($_POST['observaciones']), 0, 500)
                : '';
            if ($monto_final === false || $monto_final < 0) {
                $response = ['success' => false, 'message' => 'Monto final inválido'];
                break;
            }
            $response = $caja->cerrarCaja($monto_final, $observaciones);
            break;

        case 'agregarGasto':
            $concepto  = isset($_POST['concepto'])   ? substr(sanitize($_POST['concepto']),   0, 255) : '';
            $monto     = isset($_POST['monto'])       ? filter_var($_POST['monto'], FILTER_VALIDATE_FLOAT) : 0;
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
            $fecha_fin    = isset($_GET['fecha_fin'])    ? sanitize($_GET['fecha_fin'])    : null;
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

        // ── MÓDULO DE PRODUCTOS (admin) ───────────────────────────────────────
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
            $termino  = $_GET['termino']  ?? '';
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

        // ── DEFAULT ───────────────────────────────────────────────────────────
        default:
            http_response_code(400);
            $response = ['error' => 'Acción no válida: ' . htmlspecialchars($accion)];
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

// Limpiar caché antiguo periódicamente (1 % de probabilidad)
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