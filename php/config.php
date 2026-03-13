<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '157390');
define('DB_NAME', 'pintumex_pos');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    $conn->set_charset("utf8mb4");
} catch (mysqli_sql_exception $e) {
    error_log("Error de conexión: " . $e->getMessage());
    die("Error de conexión a la base de datos");
}

function generarFolio() {
    return 'VENTA-' . date('Ymd') . '-' . str_pad(random_int(1, 99999), 5, '0', STR_PAD_LEFT);
}

session_start();
if (!isset($_SESSION['carrito'])) {
    $_SESSION['carrito'] = [];
}

function sanitize($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}
?>