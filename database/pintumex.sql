CREATE DATABASE IF NOT EXISTS pintumex_pos;
USE pintumex_pos;

CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    categoria ENUM(
        'Acrilicas',
        'Esmaltes',
        'Selladores',
        'Barniz',
        'Aerosol',
        'Impermeabilizante',
        'Complementos'
    ) NOT NULL,
    presentacion VARCHAR(20) NOT NULL,
    marca VARCHAR(50) DEFAULT 'Pintumex',
    precio_compra DECIMAL(10,2),
    precio_venta DECIMAL(10,2) NOT NULL,
    stock_minimo INT DEFAULT 5,
    stock_actual INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_codigo_barras (codigo_barras),
    INDEX idx_categoria (categoria)
);

CREATE TABLE ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(20) UNIQUE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia') NOT NULL,
    efectivo_recibido DECIMAL(10,2) NULL,
    cambio DECIMAL(10,2) NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_fecha (fecha)
);

CREATE TABLE detalles_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id),

    INDEX idx_venta (venta_id),
    INDEX idx_producto (producto_id)
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

    FOREIGN KEY (producto_id) REFERENCES productos(id),

    INDEX idx_producto_mov (producto_id),
    INDEX idx_fecha_mov (fecha)
);

-- CONTROL DE DINERO DIARIO
CREATE TABLE control_dinero (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    dinero_inicial DECIMAL(10,2) NOT NULL,
    dinero_final DECIMAL(10,2),
    total_ventas DECIMAL(10,2),
    diferencia DECIMAL(10,2),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (fecha)
);

INSERT INTO productos 
(codigo_barras, nombre, descripcion, categoria, presentacion, marca, precio_compra, precio_venta, stock_minimo, stock_actual) 
VALUES
('7501357071482', 'Pintura Blanca Mate', 'Blanco para interiores', 'Acrilicas', '19L', 'Pintumex', 350.50, 450.50, 5, 20),
('7501234567892', 'Rodillo Pro 9"', 'Rodillo profesional de alta calidad', 'Complementos', '9"', 'Pintumex', 60.00, 89.90, 3, 15),
('7501234567893', 'Pintura Azul Cielo', 'Azul cielo para interiores', 'Acrilicas', '4L', 'Pintumex', 180.00, 250.00, 5, 8),
('7501234567894', 'Esmalte Blanco Brillante', 'Blanco brillante para metal y madera', 'Esmaltes', '4L', 'Pintumex', 280.00, 380.00, 5, 6),
('7501234567895', 'Sellador Acrilico', 'Sellador para interiores', 'Selladores', '19L', 'Pintumex', 320.00, 420.00, 5, 12),
('7501234567896', 'Barniz Marino', 'Barniz protector para exteriores', 'Barniz', '4L', 'Pintumex', 380.00, 550.00, 5, 4),
('7501234567897', 'Aerosol Negro Mate', 'Pintura en aerosol negro mate', 'Aerosol', '400ml', 'Pintumex', 45.00, 85.50, 10, 25),
('7501234567898', 'Impermeabilizante Acrilico', 'Impermeabilizante blanco', 'Impermeabilizante', '19L', 'Pintumex', 650.00, 890.00, 5, 3),
('7501234567899', 'Cinta de Enmascarar', 'Cinta para pintar', 'Complementos', '24mm x 50m', 'Pintumex', 25.00, 45.50, 10, 25),
('7501234567900', 'Esmalte Negro Brillante', 'Negro brillante para metal', 'Esmaltes', '1L', 'Pintumex', 90.00, 150.00, 5, 15);