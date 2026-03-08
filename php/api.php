<?php
require_once 'config.php';
require_once 'productos.php';
require_once 'carrito.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

$origen = $_SERVER['HTTP_REFERER'] ?? '';
if (strpos($origen, $_SERVER['HTTP_HOST']) === false && $origen != '') {
    echo json_encode(['success' => false, 'message' => 'Origen no válido']);
    exit;
}

$productos = new Productos();
$carrito = new Carrito();

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
        
    default:
        echo json_encode(['error' => 'Acción no válida']);
}
?>