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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codigo_barras (codigo_barras),
    INDEX idx_categoria (categoria),
    INDEX idx_stock_actual (stock_actual)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(20) UNIQUE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia') NOT NULL,
    efectivo_recibido DECIMAL(10,2) NULL,
    cambio DECIMAL(10,2) NULL,
    corte_caja_id INT NULL,
    cambios_realizados TINYINT DEFAULT 0 COMMENT 'Indica si la venta tuvo cambios',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_folio (folio),
    INDEX idx_fecha (fecha),
    INDEX idx_metodo_pago (metodo_pago),
    INDEX idx_corte_caja_id (corte_caja_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE detalles_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    fue_cambiado TINYINT DEFAULT 0 COMMENT 'Indica si este producto fue cambiado',
    cambio_id INT NULL COMMENT 'ID del cambio relacionado',
    INDEX idx_venta_id (venta_id),
    INDEX idx_producto_id (producto_id),
    INDEX idx_fue_cambiado (fue_cambiado),
    INDEX idx_cambio_id (cambio_id),
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE movimientos_inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    tipo ENUM('entrada', 'salida', 'ajuste') NOT NULL,
    cantidad INT NOT NULL,
    stock_anterior INT NOT NULL,
    stock_nuevo INT NOT NULL,
    justificacion TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_producto_id (producto_id),
    INDEX idx_tipo (tipo),
    INDEX idx_fecha (fecha),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_estado (estado),
    INDEX idx_fecha_apertura (fecha_apertura)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE movimientos_caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    corte_caja_id INT NOT NULL,
    tipo ENUM('ingreso', 'egreso') NOT NULL,
    concepto VARCHAR(255) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    referencia VARCHAR(100),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_corte_caja_id (corte_caja_id),
    INDEX idx_tipo (tipo),
    FOREIGN KEY (corte_caja_id) REFERENCES cortes_caja(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cambios_productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    folio_cambio VARCHAR(30) UNIQUE NOT NULL,
    producto_original_id INT NOT NULL,
    producto_nuevo_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_original DECIMAL(10,2) NOT NULL,
    precio_nuevo DECIMAL(10,2) NOT NULL,
    diferencia_precio DECIMAL(10,2) NOT NULL COMMENT 'Diferencia de precio (positivo si el nuevo es más caro, negativo si es más barato)',
    motivo TEXT COMMENT 'Motivo del cambio',
    usuario VARCHAR(100) DEFAULT 'Administrador',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_venta_id (venta_id),
    INDEX idx_folio_cambio (folio_cambio),
    INDEX idx_producto_original (producto_original_id),
    INDEX idx_producto_nuevo (producto_nuevo_id),
    INDEX idx_fecha (fecha),
    INDEX idx_usuario (usuario),
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_original_id) REFERENCES productos(id),
    FOREIGN KEY (producto_nuevo_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auditoria_cambios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cambio_id INT NOT NULL,
    accion ENUM('creado', 'modificado', 'eliminado') NOT NULL,
    datos_anteriores TEXT,
    datos_nuevos TEXT,
    usuario VARCHAR(100) DEFAULT 'Administrador',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cambio_id (cambio_id),
    FOREIGN KEY (cambio_id) REFERENCES cambios_productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE ventas ADD FOREIGN KEY (corte_caja_id) REFERENCES cortes_caja(id);

DELIMITER //

CREATE FUNCTION generar_folio_cambio() 
RETURNS VARCHAR(30)
DETERMINISTIC
BEGIN
    DECLARE nuevo_folio VARCHAR(30);
    DECLARE contador INT;
    
    SET contador = (SELECT IFNULL(MAX(CAST(SUBSTRING_INDEX(folio_cambio, '-', -1) AS UNSIGNED)), 0) + 1 FROM cambios_productos);
    SET nuevo_folio = CONCAT('CAMBIO-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(contador, 5, '0'));
    
    -- Asegurar que no se repita
    WHILE (SELECT COUNT(*) FROM cambios_productos WHERE folio_cambio = nuevo_folio) > 0 DO
        SET contador = contador + 1;
        SET nuevo_folio = CONCAT('CAMBIO-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(contador, 5, '0'));
    END WHILE;
    
    RETURN nuevo_folio;
END//

DELIMITER ;

DELIMITER //

CREATE TRIGGER tr_ventas_cambios_realizados
AFTER INSERT ON cambios_productos
FOR EACH ROW
BEGIN
    UPDATE ventas SET cambios_realizados = 1 WHERE id = NEW.venta_id;
END//

DELIMITER ;

CREATE OR REPLACE VIEW vista_cambios_productos AS
SELECT 
    c.id AS cambio_id,
    c.folio_cambio,
    c.fecha AS fecha_cambio,
    v.folio AS folio_venta,
    v.fecha AS fecha_venta,
    v.total AS total_venta,
    v.metodo_pago,
    p_original.id AS producto_original_id,
    p_original.nombre AS producto_original,
    p_original.codigo_barras AS codigo_original,
    p_original.precio AS precio_original_actual,
    p_nuevo.id AS producto_nuevo_id,
    p_nuevo.nombre AS producto_nuevo,
    p_nuevo.codigo_barras AS codigo_nuevo,
    p_nuevo.precio AS precio_nuevo_actual,
    c.cantidad,
    c.precio_original,
    c.precio_nuevo,
    c.diferencia_precio,
    c.motivo,
    c.usuario,
    CASE 
        WHEN c.diferencia_precio > 0 THEN 'Pago adicional'
        WHEN c.diferencia_precio < 0 THEN 'Reembolso'
        ELSE 'Mismo precio'
    END AS tipo_cambio,
    (c.diferencia_precio * c.cantidad) AS ajuste_total
FROM cambios_productos c
INNER JOIN ventas v ON c.venta_id = v.id
INNER JOIN productos p_original ON c.producto_original_id = p_original.id
INNER JOIN productos p_nuevo ON c.producto_nuevo_id = p_nuevo.id;

INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual) VALUES
('7501357071482', 'Pintura Blanca Mate', 'Blanco mate, 19L - Ideal para interiores y exteriores', 'Acrílicas', 450.50, 5, 20),
('7501234567892', 'Rodillo Pro 9"', 'Rodillo de alta calidad para acabado profesional', 'Complementos', 89.90, 3, 15),
('7501234567893', 'Pintura Azul Cielo', 'Azul cielo, 4L - Acabado mate', 'Acrílicas', 250.00, 5, 8),
('7501234567894', 'Esmalte Blanco Brillante', 'Esmalte blanco brillante, 4L - Alta durabilidad', 'Esmaltes', 380.00, 5, 6),
('7501234567895', 'Sellador Acrílico', 'Sellador acrílico para interiores, 19L', 'Selladores', 420.00, 5, 12),
('7501234567896', 'Barniz Marino', 'Barniz para exteriores resistente a la intemperie, 4L', 'Barniz', 550.00, 5, 4),
('7501234567897', 'Aerosol Negro Mate', 'Pintura en aerosol negro mate, 400ml', 'Aerosol', 85.50, 10, 25),
('7501234567898', 'Impermeabilizante Acrílico', 'Impermeabilizante acrílico blanco, 19L', 'Impermeabilizante', 890.00, 5, 3),
('7501234567899', 'Cinta de Enmascarar', 'Cinta de enmascarar 24mm x 50m', 'Complementos', 45.50, 10, 25),
('7501234567900', 'Esmalte Negro Brillante', 'Esmalte negro brillante, 1L', 'Esmaltes', 150.00, 5, 15),
('7501234567901', 'Pintura Rojo Ferrari', 'Rojo intenso, 4L - Acabado brillante', 'Acrílicas', 320.00, 5, 10),
('7501234567902', 'Brocha Profesional 3"', 'Brocha de cerda natural, 3 pulgadas', 'Complementos', 65.00, 10, 20),
('7501234567903', 'Thinner Universal', 'Thinner para limpieza, 1L', 'Complementos', 55.00, 5, 12),
('7501234567904', 'Aerosol Blanco Mate', 'Pintura en aerosol blanco mate, 400ml', 'Aerosol', 85.50, 10, 18),
('7501234567905', 'Barniz Transparente', 'Barniz transparente brillante, 4L', 'Barniz', 480.00, 5, 7);

SELECT '✅ Base de datos creada correctamente' AS mensaje;
SELECT 'Tablas creadas:' AS info;
SHOW TABLES;

SELECT 'Cantidad de productos:' AS info, COUNT(*) FROM productos;
SELECT 'Estructura de cambios_productos:' AS info;
DESCRIBE cambios_productos;

SELECT 'Productos con stock bajo:' AS consulta;
SELECT nombre, stock_actual, stock_minimo 
FROM productos 
WHERE stock_actual <= stock_minimo;

SELECT 'Vista de cambios (vacía inicialmente):' AS consulta;
SELECT * FROM vista_cambios_productos LIMIT 5;

SELECT 'Funciones y triggers:' AS consulta;
SHOW FUNCTION STATUS WHERE Db = 'pintumex_pos';
SHOW TRIGGERS FROM pintumex_pos;