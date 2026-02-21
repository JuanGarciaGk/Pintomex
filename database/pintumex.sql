CREATE DATABASE IF NOT EXISTS pintumex_pos;
USE pintumex_pos;

-- Tabla de productos
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    categoria ENUM(
        'Todas', 
        'Acrílicas', 
        'Esmaltes', 
        'Selladores', 
        'Barniz', 
        'Aerosol', 
        'Impermeabilizante', 
        'Complementos'
    ) DEFAULT 'Todas',
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
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia') NOT NULL,
    efectivo_recibido DECIMAL(10,2) NULL,
    cambio DECIMAL(10,2) NULL,
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
('7501234567891', 'Pintura Blanca Mate', 'Blanco, 19L', 'Acrílicas', 'Comex', 350.50, 450.50, 5, 20),
('7501234567892', 'Rodillo Pro 9"', 'Alta calidad', 'Complementos', 'Wooster', 60.00, 89.90, 3, 15),
('7501234567893', 'Pintura Azul Cielo', 'Azul cielo, 4L', 'Acrílicas', 'Berel', 180.00, 250.00, 5, 8),
('7501234567894', 'Esmalte Blanco Brillante', 'Blanco brillante, 4L', 'Esmaltes', 'Comex', 280.00, 380.00, 5, 6),
('7501234567895', 'Sellador Acrílico', 'Sellador para interiores, 19L', 'Selladores', 'Berel', 320.00, 420.00, 5, 12),
('7501234567896', 'Barniz Marino', 'Barniz para exteriores, 4L', 'Barniz', 'Vínimex', 380.00, 550.00, 5, 4),
('7501234567897', 'Aerosol Negro Mate', 'Pintura en aerosol, 400ml', 'Aerosol', 'Aeropak', 45.00, 85.50, 10, 25),
('7501234567898', 'Impermeabilizante Acrílico', 'Impermeabilizante blanco, 19L', 'Impermeabilizante', 'Fester', 650.00, 890.00, 5, 3),
('7501234567899', 'Cinta de Enmascarar', '24mm x 50m', 'Complementos', '3M', 25.00, 45.50, 10, 25),
('7501234567900', 'Esmalte Negro Brillante', 'Negro brillante, 1L', 'Esmaltes', 'Vínimex', 90.00, 150.00, 5, 15);