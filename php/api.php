<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (ob_get_length()) ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Error interno del servidor']);
        exit;
    }
});

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/productos.php';
require_once __DIR__ . '/carrito.php';
require_once __DIR__ . '/caja.php';
require_once __DIR__ . '/productos_admin.php';
require_once __DIR__ . '/inventario.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('X-Content-Type-Options: nosniff');

if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    ob_start('ob_gzhandler');
}

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

$acciones_limpiar_cache = [
    'procesarVenta', 'cancelarVenta', 'registrarEntradaMercancia', 
    'registrarAjusteInventario', 'incrementarStock', 'actualizarProducto',
    'registrarProducto', 'eliminarProducto', 'importarProductosExcel'
];

if ($metodo === 'POST' && in_array($accion, $acciones_limpiar_cache)) {
    $temp_dir = sys_get_temp_dir();
    foreach (glob($temp_dir . '/pos_cache_*.json') as $file) {
        @unlink($file);
    }
    foreach (glob($temp_dir . '/pos_productos_cache.json') as $file) {
        @unlink($file);
    }
    foreach (glob($temp_dir . '/pos_productos_admin_cache.json') as $file) {
        @unlink($file);
    }
}

if ($metodo === 'POST') {
    $rateKey    = 'rate_' . ($accion ?: 'unknown');
    $rateLimit  = 60;
    $rateWindow = 60;

    if (!isset($_SESSION[$rateKey])) {
        $_SESSION[$rateKey] = ['count' => 0, 'window_start' => time()];
    }

    $rate = &$_SESSION[$rateKey];
    if (time() - $rate['window_start'] > $rateWindow) {
        $rate = ['count' => 0, 'window_start' => time()];
    }

    $rate['count']++;
    if ($rate['count'] > $rateLimit) {
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Demasiadas solicitudes. Intente más tarde.']);
        exit;
    }
}

if (!isset($conn) || !$conn) {
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit;
}

$origen = $_SERVER['HTTP_REFERER'] ?? '';
if (!empty($origen) && strpos($origen, $_SERVER['HTTP_HOST']) === false) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Origen no válido']);
    exit;
}

$acciones_sin_csrf = [
    'getProductos', 'buscarProductos', 'getProductosPorCategoria',
    'buscarPorCodigo', 'getCarrito', 'getEstadoCaja',
    'getHistorialCaja', 'getDetalleCorte', 'getCsrfToken',
    'getProductosAdmin', 'getProducto', 'buscarProductosAdmin',
    'getProductosEstadisticas', 'getCategoriasConConteo',
    'buscarVentaPorFolio', 'obtenerDetallesVenta',
    'verificarCodigoBarras',
    'getResumenInventario', 'getMovimientosInventario', 'getAlertasInventario',
    'getProductosMasVendidos', 'getProductosMenosVendidos', 'getProductosEstancados'
];

if ($metodo === 'POST' && !in_array($accion, $acciones_sin_csrf)) {
    $csrfToken = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!validarCsrfToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Token de seguridad inválido']);
        exit;
    }
}

$productos      = new Productos();
$carrito        = new Carrito();
$caja           = new Caja();
$inventario     = new Inventario();
$productosAdmin = class_exists('ProductosAdmin') ? new ProductosAdmin() : null;

try {
    switch ($accion) {

        case 'getCsrfToken':
            $response = ['success' => true, 'token' => generarCsrfToken()];
            break;

        case 'getProductos':
            $response = $productos->todos(true); // Forzar refresco
            break;

        case 'buscarProductos':
            $termino  = $_GET['termino'] ?? '';
            $termino  = substr(preg_replace('/[^a-zA-Z0-9áéíóúñÑ\s\-]/u', '', $termino), 0, 100);
            $response = $productos->buscar($termino);
            break;

        case 'getProductosPorCategoria':
            $categorias_valid = ['Todas','Acrílicas','Esmaltes','Selladores','Barniz','Aerosol','Impermeabilizante','Complementos'];
            $categoria        = in_array($_GET['categoria'] ?? '', $categorias_valid) ? $_GET['categoria'] : 'Todas';
            $response         = $productos->porCategoria($categoria);
            break;

        case 'buscarPorCodigo':
            $codigo   = substr(preg_replace('/[^a-zA-Z0-9\-]/', '', $_GET['codigo'] ?? ''), 0, 50);
            $response = $productos->buscarPorCodigo($codigo);
            break;

        case 'verificarCodigoBarras':
            $codigo   = substr(preg_replace('/[^a-zA-Z0-9\-]/', '', $_GET['codigo'] ?? ''), 0, 50);
            $response = $productosAdmin
                ? $productosAdmin->verificarCodigo($codigo)
                : ['success' => false, 'message' => 'Módulo no disponible'];
            break;

        case 'incrementarStock':
            $id            = filter_var($_POST['id']       ?? 0, FILTER_VALIDATE_INT);
            $cantidad      = filter_var($_POST['cantidad'] ?? 0, FILTER_VALIDATE_INT);
            $justificacion = isset($_POST['justificacion']) ? substr(sanitize($_POST['justificacion']), 0, 255) : 'Entrada de mercancía';
            if (!$id       || $id <= 0)       { $response = ['success' => false, 'message' => 'ID inválido'];       break; }
            if (!$cantidad || $cantidad <= 0) { $response = ['success' => false, 'message' => 'Cantidad inválida']; break; }
            $response = $productosAdmin
                ? $productosAdmin->incrementarStock($id, $cantidad, $justificacion)
                : ['success' => false, 'message' => 'Módulo no disponible'];
            break;

        case 'agregarCarrito':
            if (!isset($_POST['producto_id'])) { $response = ['success' => false, 'message' => 'ID requerido']; break; }
            $producto_id = filter_var($_POST['producto_id'], FILTER_VALIDATE_INT);
            $cantidad    = filter_var($_POST['cantidad'] ?? 1, FILTER_VALIDATE_INT);
            if (!$producto_id || $producto_id <= 0) { $response = ['success' => false, 'message' => 'ID de producto inválido']; break; }
            if (!$cantidad    || $cantidad <= 0)    $cantidad = 1;
            $response = $carrito->agregar($producto_id, $cantidad);
            break;

        case 'modificarCarrito':
            if (!isset($_POST['producto_id'], $_POST['cantidad'])) { $response = ['success' => false, 'message' => 'Datos incompletos']; break; }
            $producto_id = filter_var($_POST['producto_id'], FILTER_VALIDATE_INT);
            $cantidad    = filter_var($_POST['cantidad'],    FILTER_VALIDATE_INT);
            if (!$producto_id || $producto_id <= 0)  { $response = ['success' => false, 'message' => 'ID inválido'];       break; }
            if ($cantidad === false || $cantidad < 0) { $response = ['success' => false, 'message' => 'Cantidad inválida']; break; }
            $response = $carrito->modificar($producto_id, $cantidad);
            break;

        case 'eliminarCarrito':
            $producto_id = filter_var($_POST['producto_id'] ?? 0, FILTER_VALIDATE_INT);
            if (!$producto_id || $producto_id <= 0) { $response = ['success' => false, 'message' => 'ID inválido']; break; }
            $response = $carrito->eliminar($producto_id);
            break;

        case 'getCarrito':
            $response = $carrito->obtener();
            break;

        case 'vaciarCarrito':
            $response = $carrito->vaciar();
            break;

        case 'procesarVenta':
            if (!isset($_POST['metodo_pago'])) { $response = ['success' => false, 'message' => 'Método de pago requerido']; break; }
            $metodo_pago     = sanitize($_POST['metodo_pago']);
            $metodos_validos = ['Efectivo', 'Tarjeta', 'Transferencia'];
            if (!in_array($metodo_pago, $metodos_validos)) { $response = ['success' => false, 'message' => 'Método de pago inválido']; break; }
            $efectivo = isset($_POST['efectivo_recibido']) ? filter_var($_POST['efectivo_recibido'], FILTER_VALIDATE_FLOAT) : null;
            $cambio   = isset($_POST['cambio'])            ? filter_var($_POST['cambio'],            FILTER_VALIDATE_FLOAT) : null;
            $response = $carrito->procesarVenta($metodo_pago, $efectivo, $cambio);
            break;

        case 'buscarVentaPorFolio':
            $termino  = substr(preg_replace('/[^a-zA-Z0-9\-]/', '', $_GET['folio'] ?? $_GET['termino'] ?? ''), 0, 50);
            if (empty($termino)) { $response = ['success' => false, 'message' => 'Ingrese un folio para buscar']; break; }
            $response = $carrito->buscarVentaPorFolio($termino);
            break;

        case 'obtenerDetallesVenta':
            $venta_id = filter_var($_GET['venta_id'] ?? 0, FILTER_VALIDATE_INT);
            if (!$venta_id || $venta_id <= 0) { $response = ['success' => false, 'message' => 'ID de venta inválido']; break; }
            $response = $carrito->obtenerDetallesVenta($venta_id);
            break;

        case 'cancelarVenta':
            $folio  = substr(preg_replace('/[^a-zA-Z0-9\-]/', '', $_POST['folio'] ?? ''), 0, 30);
            $motivo = isset($_POST['motivo']) ? substr(sanitize($_POST['motivo']), 0, 255) : 'Sin motivo';
            if (empty($folio)) { $response = ['success' => false, 'message' => 'Folio inválido']; break; }
            $response = $carrito->cancelarVenta($folio, $motivo);
            break;

        case 'getEstadoCaja':
            $response = $caja->obtenerEstado();
            break;

        case 'abrirCaja':
            $monto_inicial = filter_var($_POST['monto_inicial'] ?? 0, FILTER_VALIDATE_FLOAT);
            if ($monto_inicial === false || $monto_inicial < 0) { $response = ['success' => false, 'message' => 'Monto inicial inválido']; break; }
            $response = $caja->abrirCaja($monto_inicial);
            break;

        case 'cerrarCaja':
            $monto_final   = filter_var($_POST['monto_final'] ?? 0, FILTER_VALIDATE_FLOAT);
            $observaciones = isset($_POST['observaciones']) ? substr(sanitize($_POST['observaciones']), 0, 500) : '';
            if ($monto_final === false || $monto_final < 0) { $response = ['success' => false, 'message' => 'Monto final inválido']; break; }
            $response = $caja->cerrarCaja($monto_final, $observaciones);
            break;

        case 'agregarGasto':
            $concepto   = isset($_POST['concepto'])   ? substr(sanitize($_POST['concepto']),   0, 255) : '';
            $monto      = filter_var($_POST['monto'] ?? 0, FILTER_VALIDATE_FLOAT);
            $referencia = isset($_POST['referencia']) ? substr(sanitize($_POST['referencia']), 0, 100) : '';
            if (empty($concepto))                { $response = ['success' => false, 'message' => 'Concepto requerido']; break; }
            if ($monto === false || $monto <= 0) { $response = ['success' => false, 'message' => 'Monto inválido'];    break; }
            $response = $caja->agregarGasto($concepto, $monto, $referencia);
            break;

        case 'getHistorialCaja':
            $fecha_inicio = isset($_GET['fecha_inicio']) ? sanitize($_GET['fecha_inicio']) : null;
            $fecha_fin    = isset($_GET['fecha_fin'])    ? sanitize($_GET['fecha_fin'])    : null;
            $response     = $caja->obtenerHistorial($fecha_inicio, $fecha_fin);
            break;

        case 'getDetalleCorte':
            $corte_id = filter_var($_GET['corte_id'] ?? 0, FILTER_VALIDATE_INT);
            if (!$corte_id || $corte_id <= 0) { $response = ['success' => false, 'message' => 'ID de corte inválido']; break; }
            $response = $caja->obtenerDetalleCorte($corte_id);
            break;

        case 'getProductosAdmin':
            if ($productosAdmin) {
                $response = $productosAdmin->obtenerTodos(true);
            } else {
                $response = ['success' => false, 'message' => 'Módulo no disponible'];
            }
            break;

        case 'getProducto':
            $id       = filter_var($_GET['id'] ?? 0, FILTER_VALIDATE_INT);
            $response = $productosAdmin
                ? $productosAdmin->obtenerPorId($id)
                : ['success' => false, 'message' => 'Módulo no disponible'];
            break;

        case 'registrarProducto':
            $response = $productosAdmin
                ? $productosAdmin->registrar($_POST)
                : ['success' => false, 'message' => 'Módulo no disponible'];
            break;

        case 'actualizarProducto':
            $id       = filter_var($_POST['id'] ?? 0, FILTER_VALIDATE_INT);
            $response = $productosAdmin
                ? $productosAdmin->actualizar($id, $_POST)
                : ['success' => false, 'message' => 'Módulo no disponible'];
            break;

        case 'eliminarProducto':
            $id       = filter_var($_POST['id'] ?? 0, FILTER_VALIDATE_INT);
            $response = $productosAdmin
                ? $productosAdmin->eliminar($id)
                : ['success' => false, 'message' => 'Módulo no disponible'];
            break;

        case 'buscarProductosAdmin':
            $termino   = $_GET['termino']   ?? '';
            $categoria = $_GET['categoria'] ?? null;
            $response  = $productosAdmin
                ? $productosAdmin->buscar($termino, $categoria)
                : ['success' => false, 'message' => 'Módulo no disponible'];
            break;

        case 'getProductosEstadisticas':
            if ($productosAdmin) {
                $response = $productosAdmin->obtenerEstadisticas();
            } else {
                $response = ['success' => false, 'message' => 'Módulo no disponible'];
            }
            break;

        case 'getCategoriasConConteo':
            if ($productosAdmin) {
                $response = $productosAdmin->obtenerCategoriasConConteo();
            } else {
                $response = ['success' => false, 'message' => 'Módulo no disponible'];
            }
            break;

        case 'importarProductosExcel':
            if (!$productosAdmin) { $response = ['success' => false, 'message' => 'Módulo no disponible']; break; }
            if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) { $response = ['success' => false, 'message' => 'No se recibió ningún archivo válido']; break; }
            $archivo  = $_FILES['archivo'];
            $maxBytes = 5 * 1024 * 1024;
            if ($archivo['size'] > $maxBytes) { $response = ['success' => false, 'message' => 'El archivo no puede superar 5MB']; break; }
            $ext = strtolower(pathinfo($archivo['name'], PATHINFO_EXTENSION));
            if ($ext !== 'xlsx') { $response = ['success' => false, 'message' => 'Solo se aceptan archivos .xlsx']; break; }
            $finfo       = new finfo(FILEINFO_MIME_TYPE);
            $mime        = $finfo->file($archivo['tmp_name']);
            $mimeValidos = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/zip',
                'application/octet-stream',
            ];
            if (!in_array($mime, $mimeValidos, true)) { $response = ['success' => false, 'message' => 'Tipo de archivo no válido']; break; }
            $response = $productosAdmin->importarExcel($archivo);
            break;

        case 'getResumenInventario':
            $response = $inventario->getResumen();
            break;

        case 'getAlertasInventario':
            $response = $inventario->getAlertas();
            break;

        case 'getMovimientosInventario':
            $producto_id  = filter_var($_GET['producto_id']  ?? null, FILTER_VALIDATE_INT) ?: null;
            $tipo         = $_GET['tipo']         ?? null;
            $subtipo      = $_GET['subtipo']      ?? null;
            $fecha_inicio = isset($_GET['fecha_inicio']) ? sanitize($_GET['fecha_inicio']) : null;
            $fecha_fin    = isset($_GET['fecha_fin'])    ? sanitize($_GET['fecha_fin'])    : null;
            $limite       = filter_var($_GET['limite'] ?? 100, FILTER_VALIDATE_INT) ?: 100;
            $response     = $inventario->getMovimientos($producto_id, $tipo, $subtipo, $fecha_inicio, $fecha_fin, $limite);
            break;

        case 'getProductosMasVendidos':
            $periodo  = in_array($_GET['periodo'] ?? '', ['semana','mes','año']) ? $_GET['periodo'] : 'semana';
            $response = $inventario->getMasVendidos($periodo);
            break;

        case 'getProductosMenosVendidos':
            $periodo  = in_array($_GET['periodo'] ?? '', ['semana','mes','año']) ? $_GET['periodo'] : 'semana';
            $response = $inventario->getMenosVendidos($periodo);
            break;

        case 'getProductosEstancados':
            $periodo  = in_array($_GET['periodo'] ?? '', ['semana','mes','año']) ? $_GET['periodo'] : 'semana';
            $response = $inventario->getEstancados($periodo);
            break;

        case 'registrarEntradaMercancia':
            $producto_id = filter_var($_POST['producto_id'] ?? 0, FILTER_VALIDATE_INT);
            $cantidad    = filter_var($_POST['cantidad']    ?? 0, FILTER_VALIDATE_INT);
            $subtipo     = sanitize($_POST['subtipo']       ?? '');
            $notas       = isset($_POST['notas']) ? substr(sanitize($_POST['notas']), 0, 500) : '';
            if (!$producto_id || $producto_id <= 0) { $response = ['success' => false, 'message' => 'Producto inválido']; break; }
            if (!$cantidad    || $cantidad <= 0)    { $response = ['success' => false, 'message' => 'Cantidad inválida'];  break; }
            $response = $inventario->registrarEntrada($producto_id, $cantidad, $subtipo, $notas);
            break;

        case 'registrarAjusteInventario':
            $producto_id = filter_var($_POST['producto_id'] ?? 0, FILTER_VALIDATE_INT);
            $cantidad    = filter_var($_POST['cantidad']    ?? 0, FILTER_VALIDATE_INT);
            $subtipo     = sanitize($_POST['subtipo']       ?? '');
            $notas       = isset($_POST['notas']) ? substr(sanitize($_POST['notas']), 0, 500) : '';
            if (!$producto_id || $producto_id <= 0) { $response = ['success' => false, 'message' => 'Producto inválido']; break; }
            if (!$cantidad    || $cantidad <= 0)    { $response = ['success' => false, 'message' => 'Cantidad inválida'];  break; }
            $response = $inventario->registrarAjuste($producto_id, $cantidad, $subtipo, $notas);
            break;

        default:
            http_response_code(400);
            $response = ['success' => false, 'error' => 'Acción no válida'];
    }

} catch (Exception $e) {
    error_log("Error en API [{$accion}]: " . $e->getMessage());
    $response = ['success' => false, 'message' => 'Error interno del servidor'];
}

if (!is_array($response)) {
    $response = ['success' => false, 'message' => 'Respuesta inválida del servidor'];
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);

if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    ob_end_flush();
}
