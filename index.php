<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pintumex - Punto de Venta</title>
    <link rel="stylesheet" href="css/estilo.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="sistema-pos">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="logo">
                <h1>Pintumex</h1>
                <p>Punto de Venta</p>
            </div>
            
            <nav>
                <ul class="menu">
                    <li class="menu-item active">
                        <i class="fas fa-shopping-cart"></i>
                        Punto de Venta
                    </li>
                    <li class="menu-item">
                        <i class="fas fa-box"></i>
                        Productos
                    </li>
                    <li class="menu-item">
                        <i class="fas fa-warehouse"></i>
                        Inventario
                    </li>
                    <li class="menu-item">
                        <i class="fas fa-chart-bar"></i>
                        Reportes
                    </li>
                </ul>
            </nav>
        </aside>
        
        <!-- Contenido principal -->
        <main class="contenido-principal">
            <!-- Sección de escáner -->
            <section class="escanner-section">
                <div class="escanner-input">
                    <input type="text" id="codigoBarras" placeholder="Escanear código de barras o escribir para buscar..." autofocus>
                    <button class="btn-escanner">
                        <i class="fas fa-barcode"></i>
                        Escanear
                    </button>
                </div>
                
                <div class="filtros-categoria">
                    <button class="filtro-btn active">Todos</button>
                    <button class="filtro-btn">Interiores</button>
                    <button class="filtro-btn">Exteriores</button>
                </div>
                
                <!-- Grid de productos -->
                <div class="productos-grid" id="productosGrid">
                    <!-- Productos se cargarán dinámicamente -->
                </div>
            </section>
        </main>
        
        <!-- Panel del carrito -->
        <aside class="carrito-panel">
            <div class="carrito-header">
                <h2>
                    <i class="fas fa-shopping-basket"></i>
                    Carrito de Venta
                </h2>
            </div>
            
            <div class="carrito-items-container">
                <div class="carrito-items" id="carritoItems">
                    <!-- Items del carrito se cargarán dinámicamente -->
                </div>
            </div>
            
            <div class="carrito-totales">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span id="subtotal">$0.00</span>
                </div>
                
                <!-- Sección de efectivo (oculta por defecto) -->
                <div id="efectivoSection" style="display: none;">
                    <div class="total-row">
                        <span>Efectivo recibido:</span>
                        <span>
                            <input type="number" id="efectivoRecibido" min="0" step="0.01" value="0.00" 
                                   style="width: 100px; padding: 0.2rem; border: 1px solid var(--light); border-radius: 4px; text-align: right;">
                        </span>
                    </div>
                    <div class="total-row">
                        <span>Cambio:</span>
                        <span id="cambio">$0.00</span>
                    </div>
                </div>
                
                <div class="total-row grande">
                    <span>Total:</span>
                    <span id="total">$0.00</span>
                </div>
            </div>
            
            <div class="metodos-pago-container">
                <div class="metodos-pago">
                    <button class="metodo-pago-btn" data-metodo="Efectivo">
                        <i class="fas fa-money-bill"></i>
                        Efectivo
                    </button>
                    <button class="metodo-pago-btn" data-metodo="Tarjeta">
                        <i class="fas fa-credit-card"></i>
                        Tarjeta
                    </button>
                    <button class="metodo-pago-btn" data-metodo="Transferencia">
                        <i class="fas fa-university"></i>
                        Transferencia
                    </button>
                </div>
            </div>
            
            <div class="btn-procesar-container">
                <button class="btn-procesar" id="btnProcesar" disabled>
                    <i class="fas fa-check-circle"></i>
                    Procesar Venta
                </button>
            </div>
        </aside>
        
        <div class="usuario-info">
            <div class="online-indicator">
                <span class="online-dot"></span>
                <span>En línea</span>
            </div>
            <i class="fas fa-user-circle"></i>
            <span>Administrador</span>
        </div>
        
        <!-- Modal para ticket -->
        <div class="modal" id="modalTicket">
            <div class="modal-contenido">
                <div id="ticketContenido"></div>
                <button onclick="document.getElementById('modalTicket').style.display='none'" 
                        style="margin-top: 1rem; padding: 0.5rem; width: 100%; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Cerrar
                </button>
            </div>
        </div>
    </div>
    
    <script src="js/script.js"></script>
</body>
</html>