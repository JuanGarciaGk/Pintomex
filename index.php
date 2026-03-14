<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pintumex - Punto de Venta</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎨</text></svg>">
    <link rel="stylesheet" href="css/fontawesome/css/all.min.css">
    <link rel="preload" href="css/estilo.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="css/estilo.css"></noscript>
    <style>
        .escanner-input { position: relative; }
        #codigoBarras {
            font-size: 1.1rem;
            letter-spacing: 1px;
            padding-right: 40px;
        }
        #codigoBarras:focus {
            border-color: #e67e22;
            box-shadow: 0 0 0 4px rgba(230, 126, 34, 0.4);
        }
        .escanner-input::after {
            content: '\f02a';
            font-family: 'Font Awesome 6 Free';
            font-weight: 900;
            position: absolute;
            right: 130px;
            top: 50%;
            transform: translateY(-50%);
            color: #e67e22;
            font-size: 1.2rem;
            opacity: 0.9;
            pointer-events: none;
            animation: parpadeo 1.5s infinite;
        }
        @keyframes parpadeo {
            0% { opacity: 0.9; }
            50% { opacity: 0.5; }
            100% { opacity: 0.9; }
        }
        @media (max-width: 768px) {
            .escanner-input::after { right: 15px; }
        }
    </style>
</head>
<body>
    <div class="sistema-pos">
        <aside class="sidebar">
            <div class="logo">
                <h1>Pintumex</h1>
                <p>Punto de Venta</p>
            </div>
            
            <nav aria-label="Menú principal">
                <ul class="menu">
                    <li class="menu-item active">
                        <i class="fas fa-shopping-cart" aria-hidden="true"></i>
                        <span>Punto de Venta</span>
                    </li>
                    <li class="menu-item">
                        <i class="fas fa-box" aria-hidden="true"></i>
                        <span>Productos</span>
                    </li>
                    <li class="menu-item">
                        <i class="fas fa-warehouse" aria-hidden="true"></i>
                        <span>Inventario</span>
                    </li>
                    <li class="menu-item">
                        <i class="fas fa-chart-bar" aria-hidden="true"></i>
                        <span>Reportes</span>
                    </li>
                </ul>
            </nav>
        </aside>
        
        <main class="contenido-principal">
            <section class="escanner-section" aria-labelledby="escanner-titulo">
                <h2 id="escanner-titulo" class="visually-hidden">Buscador de productos</h2>
                <div class="buscador-container">
                    <div class="escanner-input">
                        <label for="codigoBarras" class="visually-hidden">Buscar por código o nombre</label>
                        <input type="text" 
                               id="codigoBarras" 
                               placeholder="Buscar por código, nombre..." 
                               autofocus 
                               autocomplete="off"
                               spellcheck="false"
                               aria-label="Campo de búsqueda">
                        <button class="btn-escanner" style="display: none;" id="btnEscannerOculto">
                            <i class="fas fa-barcode" aria-hidden="true"></i>
                            Buscar
                        </button>
                    </div>
                    <div id="sugerencias" class="sugerencias-lista" role="listbox" aria-label="Sugerencias de productos"></div>
                </div>
                
                <nav aria-label="Filtros por categoría">
                    <h3 class="visually-hidden">Categorías de productos</h3>
                    <div class="filtros-categoria">
                        <button class="filtro-btn active" aria-pressed="true">Todas</button>
                        <button class="filtro-btn" aria-pressed="false">Acrílicas</button>
                        <button class="filtro-btn" aria-pressed="false">Esmaltes</button>
                        <button class="filtro-btn" aria-pressed="false">Selladores</button>
                        <button class="filtro-btn" aria-pressed="false">Barniz</button>
                        <button class="filtro-btn" aria-pressed="false">Aerosol</button>
                        <button class="filtro-btn" aria-pressed="false">Impermeabilizante</button>
                        <button class="filtro-btn" aria-pressed="false">Complementos</button>
                    </div>
                </nav>
                
                <div class="productos-grid" id="productosGrid" aria-label="Lista de productos disponibles"></div>
            </section>
        </main>
        
        <aside class="carrito-panel" aria-labelledby="carrito-titulo">
            <div class="carrito-header">
                <h2 id="carrito-titulo">
                    <i class="fas fa-shopping-basket" aria-hidden="true"></i>
                    Carrito de Venta
                </h2>
            </div>
            
            <div class="carrito-items-container">
                <div class="carrito-items" id="carritoItems" aria-label="Productos en el carrito"></div>
            </div>
            
            <div class="carrito-totales" aria-label="Resumen de la compra">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span id="subtotal" aria-live="polite">$0.00</span>
                </div>
                
                <div id="efectivoSection" style="display: none;">
                    <div class="total-row">
                        <label for="efectivoRecibido">Efectivo recibido:</label>
                        <span>
                            <input type="number" 
                                   id="efectivoRecibido" 
                                   min="0" 
                                   step="0.01" 
                                   placeholder="0.00" 
                                   aria-label="Cantidad de efectivo recibido"
                                   style="width: 100px; padding: 0.2rem; border: 1px solid #d1d5db; border-radius: 4px; text-align: right;">
                        </span>
                    </div>
                    <div class="total-row">
                        <span>Cambio:</span>
                        <span id="cambio" aria-live="polite">$0.00</span>
                    </div>
                </div>
                
                <div class="total-row grande">
                    <span>Total:</span>
                    <span id="total" aria-live="polite">$0.00</span>
                </div>
            </div>
            
            <div class="metodos-pago-container">
                <h3 class="visually-hidden">Métodos de pago</h3>
                <div class="metodos-pago" role="radiogroup" aria-label="Seleccione método de pago">
                    <button class="metodo-pago-btn" data-metodo="Efectivo" role="radio" aria-checked="false">
                        <i class="fas fa-money-bill" aria-hidden="true"></i>
                        Efectivo
                    </button>
                    <button class="metodo-pago-btn" data-metodo="Tarjeta" role="radio" aria-checked="false">
                        <i class="fas fa-credit-card" aria-hidden="true"></i>
                        Tarjeta
                    </button>
                    <button class="metodo-pago-btn" data-metodo="Transferencia" role="radio" aria-checked="false">
                        <i class="fas fa-university" aria-hidden="true"></i>
                        Transferencia
                    </button>
                </div>
            </div>
            
            <div class="btn-procesar-container">
                <button class="btn-procesar" id="btnProcesar" disabled aria-disabled="true">
                    <i class="fas fa-check-circle" aria-hidden="true"></i>
                    Procesar Venta
                </button>
            </div>
        </aside>
        
        <div class="usuario-info" aria-label="Información de usuario">
            <div class="online-indicator">
                <span class="online-dot" aria-hidden="true"></span>
                <span>En línea</span>
            </div>
            <i class="fas fa-user-circle" aria-hidden="true"></i>
            <span>Administrador</span>
        </div>
        
        <div class="modal" id="modalTicket" role="dialog" aria-labelledby="ticket-titulo" aria-modal="true">
            <div class="modal-contenido">
                <h3 id="ticket-titulo" class="visually-hidden">Ticket de venta</h3>
                <div id="ticketContenido"></div>
                <button onclick="document.getElementById('modalTicket').style.display='none'" 
                        style="margin-top: 1rem; padding: 0.5rem; width: 100%; background: #2E2168; color: white; border: none; border-radius: 4px; cursor: pointer;"
                        aria-label="Cerrar ticket">
                    Cerrar
                </button>
            </div>
        </div>
    </div>
    
    <style>
        .visually-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            margin: -1px;
            padding: 0;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            border: 0;
        }
    </style>
    
    <script src="js/script.js" async></script>
</body>
</html>