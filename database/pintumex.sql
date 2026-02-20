CREATE DATABASE IF NOT EXISTS pintumex_pos;
USE pintumex_pos;

-- Tabla de productos
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    categoria ENUM('Interiores', 'Exteriores', 'Todos') DEFAULT 'Todos',
    marca VARCHAR(50),
    precio_compra DECIMAL(10,2),
    precio_venta DECIMAL(10,2) NOT NULL,
    stock_minimo INT DEFAULT 5,
    stock_actual INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de ventas
CREATE TABLE ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(20) UNIQUE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    impuestos DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia') NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de detalles de venta
CREATE TABLE detalles_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Tabla de movimientos de inventario
CREATE TABLE movimientos_inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    tipo ENUM('entrada', 'salida', 'ajuste') NOT NULL,
    cantidad INT NOT NULL,
    stock_anterior INT NOT NULL,
    stock_nuevo INT NOT NULL,
    justificacion TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Insertar datos de ejemplo
INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, marca, precio_compra, precio_venta, stock_minimo, stock_actual) VALUES
('7501234567891', 'Pintura Blanca Mate', 'Blanco, 19L', 'Interiores', 'Comex', 350.50, 450.50, 5, 20),
('7501234567892', 'Rodillo Pro 9"', 'Alta calidad', 'Todos', 'Wooster', 60.00, 89.90, 3, 15),
('7501234567893', 'Pintura Azul Cielo', 'Azul cielo, 4L', 'Interiores', 'Berel', 180.00, 250.00, 5, 8),
('7501234567894', 'Pintura Exterior Blanca', 'Blanco exterior, 19L', 'Exteriores', 'Comex', 400.00, 520.00, 5, 6),
('7501234567895', 'Brocha Plana 3"', 'Cerda sintética', 'Todos', 'Wooster', 45.00, 75.00, 5, 12);