<?php
require_once 'config.php';
require_once 'productos.php';
require_once 'carrito.php';
require_once 'caja.php';

// Headers de caché optimizados
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

// Compresión gzip si está disponible
if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    ob_start('ob_gzhandler');
}

$origen = $_SERVER['HTTP_REFERER'] ?? '';
if (strpos($origen, $_SERVER['HTTP_HOST']) === false && $origen != '') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Origen no válido']);
    exit;
}

// Lista de acciones que NO requieren validación CSRF (solo consultas GET)
$acciones_sin_csrf = ['getProductos', 'buscarProductos', 'getProductosPorCategoria', 
                       'buscarPorCodigo', 'getCarrito', 'getEstadoCaja', 
                       'getHistorialCaja', 'getDetalleCorte', 'getCsrfToken'];

$productos = new Productos();
$carrito = new Carrito();
$caja = new Caja();

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';

// Validar CSRF para acciones POST que modifican datos
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !in_array($accion, $acciones_sin_csrf)) {
    $csrf_token = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    
    if (!validarCsrfToken($csrf_token)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Token CSRF inválido']);
        exit;
    }
}

// Cache para consultas GET frecuentes
$cache_ttl = [
    'getProductos' => 300,           // 5 minutos
    'getProductosPorCategoria' => 300,
    'getEstadoCaja' => 30,           // 30 segundos
    'getCarrito' => 10,              // 10 segundos
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

// Switch de acciones
$response = null;

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
        
    default:
        http_response_code(400);
        $response = ['error' => 'Acción no válida'];
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);

// Limpiar caché antiguo periódicamente (1% de probabilidad)
if (rand(1, 100) === 1) {
    $cache_files = glob(sys_get_temp_dir() . '/pos_cache_*.json');
    $now = time();
    foreach ($cache_files as $file) {
        if ($now - filemtime($file) > 3600) { // Mayor a 1 hora
            @unlink($file);
        }
    }
}

if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    ob_end_flush();
}