CREATE DATABASE IF NOT EXISTS pintumex_pos
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE pintumex_pos;

CREATE TABLE IF NOT EXISTS productos (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50)  UNIQUE NOT NULL,
    nombre        VARCHAR(100) NOT NULL,
    descripcion   TEXT,
    categoria     ENUM(
                      'Todas',
                      'Acrílicas',
                      'Esmaltes',
                      'Selladores',
                      'Barniz',
                      'Aerosol',
                      'Impermeabilizante',
                      'Complementos'
                  ) DEFAULT 'Todas',
    precio        DECIMAL(10,2) NOT NULL,
    stock_minimo  INT           DEFAULT 5,
    stock_actual  INT           DEFAULT 0,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cortes_caja (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    fecha_apertura DATETIME      NOT NULL,
    fecha_cierre   DATETIME      NULL,
    monto_inicial  DECIMAL(10,2) NOT NULL,
    monto_final    DECIMAL(10,2) NULL,
    total_ventas   DECIMAL(10,2) NULL,
    diferencia     DECIMAL(10,2) NULL,
    estado         ENUM('abierta','cerrada') DEFAULT 'abierta',
    observaciones  TEXT,
    usuario        VARCHAR(100)  DEFAULT 'Administrador',
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ventas (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    folio             VARCHAR(20)   UNIQUE NOT NULL,
    subtotal          DECIMAL(10,2) NOT NULL,
    total             DECIMAL(10,2) NOT NULL,
    metodo_pago       ENUM('Efectivo','Tarjeta','Transferencia') NOT NULL,
    efectivo_recibido DECIMAL(10,2) NULL,
    cambio            DECIMAL(10,2) NULL,
    corte_caja_id     INT           NULL,
    estado            ENUM('activa','cancelada') DEFAULT 'activa',
    fecha             TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ventas_corte
        FOREIGN KEY (corte_caja_id) REFERENCES cortes_caja(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- producto_id acepta NULL para que al eliminar un producto
-- los detalles de ventas históricas se conserven con NULL en ese campo.
CREATE TABLE IF NOT EXISTS detalles_venta (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    venta_id         INT           NOT NULL,
    producto_id      INT           NULL,
    cantidad         INT           NOT NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    subtotal         DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_detalles_venta
        FOREIGN KEY (venta_id)    REFERENCES ventas(id)    ON DELETE CASCADE,
    CONSTRAINT fk_detalles_producto
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    producto_id    INT  NOT NULL,
    tipo           ENUM('entrada','salida','ajuste') NOT NULL,
    cantidad       INT  NOT NULL,
    stock_anterior INT  NOT NULL,
    stock_nuevo    INT  NOT NULL,
    justificacion  TEXT,
    fecha          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movinv_producto
        FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimientos_caja (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    corte_caja_id  INT           NOT NULL,
    tipo           ENUM('ingreso','egreso') NOT NULL,
    concepto       VARCHAR(255)  NOT NULL,
    monto          DECIMAL(10,2) NOT NULL,
    referencia     VARCHAR(100),
    fecha          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movcaja_corte
        FOREIGN KEY (corte_caja_id) REFERENCES cortes_caja(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cancelaciones_venta (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    venta_id        INT           NOT NULL,
    folio_venta     VARCHAR(20)   NOT NULL,
    motivo          VARCHAR(255)  NOT NULL DEFAULT 'Sin motivo',
    monto_cancelado DECIMAL(10,2) NOT NULL,
    cancelado_por   VARCHAR(100)  DEFAULT 'Administrador',
    fecha           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cancelacion_venta
        FOREIGN KEY (venta_id) REFERENCES ventas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS migrar_fk_detalles_producto;

DELIMITER $$

CREATE PROCEDURE migrar_fk_detalles_producto()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE table_schema = DATABASE()
          AND table_name   = 'detalles_venta'
          AND column_name  = 'producto_id'
          AND is_nullable  = 'NO'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE table_schema    = DATABASE()
              AND table_name      = 'detalles_venta'
              AND constraint_name = 'fk_detalles_producto'
              AND constraint_type = 'FOREIGN KEY'
        ) THEN
            ALTER TABLE detalles_venta DROP FOREIGN KEY fk_detalles_producto;
        END IF;

        ALTER TABLE detalles_venta
            MODIFY COLUMN producto_id INT NULL;

        ALTER TABLE detalles_venta
            ADD CONSTRAINT fk_detalles_producto
                FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL;
    END IF;
END$$

DELIMITER ;

CALL migrar_fk_detalles_producto();
DROP PROCEDURE IF EXISTS migrar_fk_detalles_producto;
-- ─────────────────────────────────────────────────────────────────────────────

DROP PROCEDURE IF EXISTS crear_indices;

DELIMITER $$

CREATE PROCEDURE crear_indices()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'productos' AND index_name = 'idx_productos_nombre'
    ) THEN
        ALTER TABLE productos ADD INDEX idx_productos_nombre (nombre);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'productos' AND index_name = 'idx_productos_categoria'
    ) THEN
        ALTER TABLE productos ADD INDEX idx_productos_categoria (categoria);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'ventas' AND index_name = 'idx_ventas_fecha'
    ) THEN
        ALTER TABLE ventas ADD INDEX idx_ventas_fecha (fecha);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'ventas' AND index_name = 'idx_ventas_estado'
    ) THEN
        ALTER TABLE ventas ADD INDEX idx_ventas_estado (estado);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'ventas' AND index_name = 'idx_ventas_corte_estado'
    ) THEN
        ALTER TABLE ventas ADD INDEX idx_ventas_corte_estado (corte_caja_id, estado);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'ventas' AND index_name = 'idx_ventas_folio'
    ) THEN
        ALTER TABLE ventas ADD INDEX idx_ventas_folio (folio);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'movimientos_inventario' AND index_name = 'idx_movinv_producto'
    ) THEN
        ALTER TABLE movimientos_inventario ADD INDEX idx_movinv_producto (producto_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'movimientos_caja' AND index_name = 'idx_movcaja_corte'
    ) THEN
        ALTER TABLE movimientos_caja ADD INDEX idx_movcaja_corte (corte_caja_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE() AND table_name = 'cancelaciones_venta' AND index_name = 'idx_cancelaciones_venta'
    ) THEN
        ALTER TABLE cancelaciones_venta ADD INDEX idx_cancelaciones_venta (venta_id);
    END IF;
END$$

DELIMITER ;

CALL crear_indices();
DROP PROCEDURE IF EXISTS crear_indices;

-- ─── Migración: columna tipo_detalle en movimientos_inventario ───────────────
DROP PROCEDURE IF EXISTS agregar_tipo_detalle_inv;

DELIMITER $$

CREATE PROCEDURE agregar_tipo_detalle_inv()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE table_schema = DATABASE()
          AND table_name   = 'movimientos_inventario'
          AND column_name  = 'tipo_detalle'
    ) THEN
        ALTER TABLE movimientos_inventario
            ADD COLUMN tipo_detalle VARCHAR(50) NULL AFTER tipo;
    END IF;
END$$

DELIMITER ;

CALL agregar_tipo_detalle_inv();
DROP PROCEDURE IF EXISTS agregar_tipo_detalle_inv;

-- ─── Migración: índice de fecha en movimientos_inventario ────────────────────
DROP PROCEDURE IF EXISTS crear_indices_inventario;

DELIMITER $$

CREATE PROCEDURE crear_indices_inventario()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE()
          AND table_name   = 'movimientos_inventario'
          AND index_name   = 'idx_movinv_fecha'
    ) THEN
        ALTER TABLE movimientos_inventario ADD INDEX idx_movinv_fecha (fecha);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE()
          AND table_name   = 'movimientos_inventario'
          AND index_name   = 'idx_movinv_tipo'
    ) THEN
        ALTER TABLE movimientos_inventario ADD INDEX idx_movinv_tipo (tipo);
    END IF;
END$$

DELIMITER ;

CALL crear_indices_inventario();
DROP PROCEDURE IF EXISTS crear_indices_inventario;

INSERT INTO productos
    (codigo_barras, nombre, descripcion, categoria, precio, stock_minimo, stock_actual)
VALUES
    ('7501357071482', 'Pintura Blanca Mate',       'Blanco, 19L',                   'Acrílicas',         450.50,  5, 20),
    ('7501234567892', 'Rodillo Pro 9"',             'Alta calidad',                  'Complementos',       89.90,  3, 15),
    ('7501234567893', 'Pintura Azul Cielo',         'Azul cielo, 4L',                'Acrílicas',         250.00,  5,  8),
    ('7501234567894', 'Esmalte Blanco Brillante',   'Blanco brillante, 4L',          'Esmaltes',          380.00,  5,  6),
    ('7501234567895', 'Sellador Acrílico',          'Sellador para interiores, 19L', 'Selladores',        420.00,  5, 12),
    ('7501234567896', 'Barniz Marino',              'Barniz para exteriores, 4L',    'Barniz',            550.00,  5,  4),
    ('7501234567897', 'Aerosol Negro Mate',         'Pintura en aerosol, 400ml',     'Aerosol',            85.50, 10, 25),
    ('7501234567898', 'Impermeabilizante Acrílico', 'Impermeabilizante blanco, 19L', 'Impermeabilizante', 890.00,  5,  3),
    ('7501234567899', 'Cinta de Enmascarar',        '24mm x 50m',                    'Complementos',       45.50, 10, 25),
    ('7501234567900', 'Esmalte Negro Brillante',    'Negro brillante, 1L',           'Esmaltes',          150.00,  5, 15);