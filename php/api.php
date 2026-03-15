<?php
require_once 'config.php';
require_once 'productos.php';
require_once 'carrito.php';
require_once 'caja.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

$origen = $_SERVER['HTTP_REFERER'] ?? '';
if (strpos($origen, $_SERVER['HTTP_HOST']) === false && $origen != '') {
    echo json_encode(['success' => false, 'message' => 'Origen no válido']);
    exit;
}

$productos = new Productos();
$carrito = new Carrito();
$caja = new Caja();

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';

switch ($accion) {
    case 'getProductos':
        echo json_encode($productos->todos());
        break;
        
    case 'buscarProductos':
        $termino = $_GET['termino'] ?? '';
        echo json_encode($productos->buscar($termino));
        break;
        
    case 'getProductosPorCategoria':
        $categoria = $_GET['categoria'] ?? 'Todas';
        echo json_encode($productos->porCategoria($categoria));
        break;
        
    case 'buscarPorCodigo':
        $codigo = $_GET['codigo'] ?? '';
        echo json_encode($productos->buscarPorCodigo($codigo));
        break;
    
    case 'agregarCarrito':
        if (!isset($_POST['producto_id'])) {
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            break;
        }
        $cantidad = isset($_POST['cantidad']) ? intval($_POST['cantidad']) : 1;
        echo json_encode($carrito->agregar($_POST['producto_id'], $cantidad));
        break;
        
    case 'modificarCarrito':
        if (!isset($_POST['producto_id']) || !isset($_POST['cantidad'])) {
            echo json_encode(['success' => false, 'message' => 'Datos incompletos']);
            break;
        }
        echo json_encode($carrito->modificar($_POST['producto_id'], $_POST['cantidad']));
        break;
        
    case 'eliminarCarrito':
        if (!isset($_POST['producto_id'])) {
            echo json_encode(['success' => false, 'message' => 'ID requerido']);
            break;
        }
        echo json_encode($carrito->eliminar($_POST['producto_id']));
        break;
        
    case 'getCarrito':
        echo json_encode($carrito->obtener());
        break;
        
    case 'vaciarCarrito':
        echo json_encode($carrito->vaciar());
        break;
        
    case 'procesarVenta':
        if (!isset($_POST['metodo_pago'])) {
            echo json_encode(['success' => false, 'message' => 'Método de pago requerido']);
            break;
        }
        $efectivo = isset($_POST['efectivo_recibido']) ? floatval($_POST['efectivo_recibido']) : null;
        $cambio = isset($_POST['cambio']) ? floatval($_POST['cambio']) : null;
        echo json_encode($carrito->procesarVenta($_POST['metodo_pago'], $efectivo, $cambio));
        break;

    case 'getEstadoCaja':
        echo json_encode($caja->obtenerEstado());
        break;

    case 'abrirCaja':
        $monto_inicial = $_POST['monto_inicial'] ?? 0;
        echo json_encode($caja->abrirCaja($monto_inicial));
        break;

    case 'cerrarCaja':
        $monto_final = $_POST['monto_final'] ?? 0;
        $observaciones = $_POST['observaciones'] ?? '';
        echo json_encode($caja->cerrarCaja($monto_final, $observaciones));
        break;

    case 'agregarGasto':
        $concepto = $_POST['concepto'] ?? '';
        $monto = $_POST['monto'] ?? 0;
        $referencia = $_POST['referencia'] ?? '';
        echo json_encode($caja->agregarGasto($concepto, $monto, $referencia));
        break;

    case 'getHistorialCaja':
        $fecha_inicio = $_GET['fecha_inicio'] ?? null;
        $fecha_fin = $_GET['fecha_fin'] ?? null;
        echo json_encode($caja->obtenerHistorial($fecha_inicio, $fecha_fin));
        break;

    case 'getDetalleCorte':
        $corte_id = $_GET['corte_id'] ?? 0;
        echo json_encode($caja->obtenerDetalleCorte($corte_id));
        break;
        
    default:
        echo json_encode(['error' => 'Acción no válida']);
}
?>