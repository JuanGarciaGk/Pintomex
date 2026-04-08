CREATE DATABASE IF NOT EXISTS pintumex_pos;
USE pintumex_pos;

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
    precio DECIMAL(10,2) NOT NULL,
    stock_minimo INT DEFAULT 5,
    stock_actual INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(20) UNIQUE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia') NOT NULL,
    efectivo_recibido DECIMAL(10,2) NULL,
    cambio DECIMAL(10,2) NULL,
    corte_caja_id INT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE cortes_caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha_apertura DATETIME NOT NULL,
    fecha_cierre DATETIME NULL,
    monto_inicial DECIMAL(10,2) NOT NULL,
    monto_final DECIMAL(10,2) NULL,
    total_ventas DECIMAL(10,2) NULL,
    diferencia DECIMAL(10,2) NULL,
    estado ENUM('abierta', 'cerrada') DEFAULT 'abierta',
    observaciones TEXT,
    usuario VARCHAR(100) DEFAULT 'Administrador',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE movimientos_caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    corte_caja_id INT NOT NULL,
    tipo ENUM('ingreso', 'egreso') NOT NULL,
    concepto VARCHAR(255) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    referencia VARCHAR(100),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (corte_caja_id) REFERENCES cortes_caja(id)
);

ALTER TABLE ventas ADD FOREIGN KEY (corte_caja_id) REFERENCES cortes_caja(id);

INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual) VALUES
('7501357071482', 'Pintura Blanca Mate', 'Blanco, 19L', 'Acrílicas', 450.50, 5, 20),
('7501234567892', 'Rodillo Pro 9"', 'Alta calidad', 'Complementos', 89.90, 3, 15),
('7501234567893', 'Pintura Azul Cielo', 'Azul cielo, 4L', 'Acrílicas', 250.00, 5, 8),
('7501234567894', 'Esmalte Blanco Brillante', 'Blanco brillante, 4L', 'Esmaltes', 380.00, 5, 6),
('7501234567895', 'Sellador Acrílico', 'Sellador para interiores, 19L', 'Selladores', 420.00, 5, 12),
('7501234567896', 'Barniz Marino', 'Barniz para exteriores, 4L', 'Barniz', 550.00, 5, 4),
('7501234567897', 'Aerosol Negro Mate', 'Pintura en aerosol, 400ml', 'Aerosol', 85.50, 10, 25),
('7501234567898', 'Impermeabilizante Acrílico', 'Impermeabilizante blanco, 19L', 'Impermeabilizante', 890.00, 5, 3),
('7501234567899', 'Cinta de Enmascarar', '24mm x 50m', 'Complementos', 45.50, 10, 25),
('7501234567900', 'Esmalte Negro Brillante', 'Negro brillante, 1L', 'Esmaltes', 150.00, 5, 15);