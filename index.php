<?php
require_once 'php/config.php';

if (isset($_SERVER['HTTP_IF_MODIFIED_SINCE'])) {
    header('HTTP/1.1 304 Not Modified');
    exit;
}

header('Cache-Control: public, max-age=3600');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Pintumex</title>
    <link rel="icon" href="img/pintumex-icon.png" type="image/png">
    <link rel="apple-touch-icon" href="img/pintumex-icon.png">    
    <meta name="csrf-token" content="<?php echo generarCsrfToken(); ?>">
    <meta name="theme-color" content="#2E2168">

    <script>
        if (!('IntersectionObserver' in window)) {
            document.write('<script src="https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver"><\/script>');
        }
        if (!('requestIdleCallback' in window)) {
            window.requestIdleCallback = function(cb) { return setTimeout(cb, 1); };
            window.cancelIdleCallback  = clearTimeout;
        }
        if (!('Promise' in window)) {
            document.write('<script src="https://polyfill.io/v3/polyfill.min.js?features=Promise,fetch"><\/script>');
        }
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="dns-prefetch" href="https://fonts.gstatic.com">

    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --primary: #2E2168;
            --primary-light: #3d2d8a;
            --secondary: #e67e22;
            --secondary-dark: #d35400;
            --success: #27AE60;
            --danger: #E74C3C;
            --gray: #64748b;
            --light: #e2e8f0;
            --shadow-sm: 0 1px 3px rgba(0,0,0,.1);
            --shadow-md: 0 4px 6px rgba(0,0,0,.1);
            --shadow-lg: 0 10px 15px rgba(0,0,0,.1);
            --radius-md: 8px;
            --radius-lg: 12px;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .sistema-pos {
            display: -ms-grid;
            display: grid;
            -ms-grid-columns: 250px 1fr 350px;
            grid-template-columns: 250px 1fr 350px;
            height: 100vh;
            overflow: hidden;
        }

        @supports not (display: grid) {
            .sistema-pos { display: flex; }
            .sidebar { width: 250px; flex-shrink: 0; }
            .contenido-principal { flex: 1; }
            .carrito-panel { width: 350px; flex-shrink: 0; }
        }

        .sidebar {
            background: #2E2168;
            color: #fff;
            height: 100vh;
            overflow-y: auto;
            overflow-y: overlay;
        }

        .logo {
            text-align: center;
            padding: 1rem;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .logo img {
            max-width: 180px;
            width: 100%;
            height: auto;
            display: block;
            margin: 0 auto 0.3rem;
            mix-blend-mode: screen;
        }

        .logo p {
            color: rgba(255,255,255,0.85);
            font-size: 0.85rem;
            margin-top: 0.2rem;
        }

        .carrito-panel {
            background: #fff;
            border-left: 2px solid rgba(0,0,0,0.05);
            height: 100vh;
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-orient: vertical;
            -webkit-box-direction: normal;
            -ms-flex-direction: column;
            flex-direction: column;
            overflow: hidden;
        }

        .loading-spinner {
            position: fixed;
            top: 50%;
            left: 50%;
            -webkit-transform: translate(-50%, -50%);
            transform: translate(-50%, -50%);
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top-color: #2b7c30;
            border-radius: 50%;
            -webkit-animation: spin 1s linear infinite;
            animation: spin 1s linear infinite;
            z-index: 9999;
        }

        .hidden { display: none; }

        @-webkit-keyframes spin { to { -webkit-transform: translate(-50%,-50%) rotate(360deg); transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes spin        { to { transform: translate(-50%,-50%) rotate(360deg); } }

        .visually-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            margin: -1px;
            padding: 0;
            overflow: hidden;
            clip: rect(0,0,0,0);
            border: 0;
            white-space: nowrap;
        }

        .skip-link {
            position: absolute;
            top: -40px;
            left: 0;
            background: #2b7c30;
            color: white;
            padding: 8px;
            z-index: 100;
            text-decoration: none;
            border-radius: 0 0 4px 0;
        }

        .skip-link:focus { top: 0; }

        :focus-visible {
            outline: 3px solid #2b7c30;
            outline-offset: 2px;
            border-radius: 4px;
        }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                -webkit-animation-duration: .01ms !important;
                animation-duration: .01ms !important;
                -webkit-transition-duration: .01ms !important;
                transition-duration: .01ms !important;
            }
        }

        @media (max-width: 992px) {
            .sistema-pos {
                -ms-grid-columns: 1fr;
                grid-template-columns: 1fr;
            }
            .sidebar { display: none; }
            .carrito-panel {
                position: fixed;
                right: 0;
                top: 0;
                width: min(350px, 90vw);
                -webkit-transform: translateX(100%);
                transform: translateX(100%);
                z-index: 1000;
                -webkit-transition: -webkit-transform 0.3s ease;
                transition: transform 0.3s ease;
            }
            .carrito-panel.visible {
                -webkit-transform: translateX(0);
                transform: translateX(0);
            }
        }

        .escanner-input { position: relative; }

        #codigoBarras {
            font-size: 1.1rem;
            letter-spacing: 1px;
            padding-right: 40px;
        }

        #codigoBarras:focus {
            border-color: #e67e22;
            -webkit-box-shadow: 0 0 0 4px rgba(230,126,34,0.4);
            box-shadow: 0 0 0 4px rgba(230,126,34,0.4);
        }

        #offlineBanner {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #E74C3C;
            color: white;
            text-align: center;
            padding: 8px;
            z-index: 10000;
            font-weight: 600;
            font-size: 0.9rem;
        }
    </style>

    <link rel="preload" href="css/fontawesome/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="css/fontawesome/css/all.min.css"></noscript>

    <link rel="preload" href="css/estilo.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="css/estilo.css"></noscript>

    <link rel="preload" href="css/modulo-caja.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="css/modulo-caja.css"></noscript>

    <link rel="preload" href="css/modulo-productos.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="css/modulo-productos.css"></noscript>

    <link rel="preload" href="css/modulo-inventario.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="css/modulo-inventario.css"></noscript>
</head>
<body>
    <div id="offlineBanner" role="alert" aria-live="assertive">
        <i class="fas fa-wifi"></i> Sin conexión — Algunas funciones no están disponibles
    </div>

    <a href="#contenido-principal" class="skip-link">Saltar al contenido principal</a>
    <div id="loadingSpinner" class="loading-spinner" role="status" aria-label="Cargando sistema"></div>

    <div class="sistema-pos" id="sistemaPos" style="display: none;">
        <aside class="sidebar">
            <div class="logo">
                <img src="img/pintumex-logo.png" alt="Pintumex logo">
            </div>

            <nav aria-label="Menú principal">
                <ul class="menu">
                    <li class="menu-item active" data-modulo="caja" role="button" tabindex="0" aria-label="Módulo de caja">
                        <i class="fas fa-cash-register" aria-hidden="true"></i>
                        <span>Caja</span>
                    </li>
                    <li class="menu-item" data-modulo="puntoventa" role="button" tabindex="0" aria-label="Módulo punto de venta">
                        <i class="fas fa-shopping-cart" aria-hidden="true"></i>
                        <span>Punto de Venta</span>
                    </li>
                    <li class="menu-item" data-modulo="productos" role="button" tabindex="0" aria-label="Módulo de productos">
                        <i class="fas fa-box" aria-hidden="true"></i>
                        <span>Productos</span>
                    </li>
                    <li class="menu-item" data-modulo="inventario" role="button" tabindex="0" aria-label="Módulo de inventario">
                        <i class="fas fa-warehouse" aria-hidden="true"></i>
                        <span>Inventario</span>
                    </li>
                    <li class="menu-item" data-modulo="reportes" role="button" tabindex="0" aria-label="Módulo de reportes">
                        <i class="fas fa-chart-bar" aria-hidden="true"></i>
                        <span>Reportes</span>
                    </li>
                </ul>
            </nav>
        </aside>

        <main class="contenido-principal" id="contenido-principal">
            <section class="escanner-section" id="seccionPuntoVenta" style="display: block;">
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
                               aria-label="Campo de búsqueda de productos">
                        <button class="btn-escanner" style="display: none;" id="btnEscannerOculto" aria-hidden="true" tabindex="-1">
                            <i class="fas fa-barcode" aria-hidden="true"></i>
                            Buscar
                        </button>
                    </div>
                    <div id="sugerencias" class="sugerencias-lista" role="listbox" aria-label="Sugerencias de productos"></div>
                </div>

                <nav aria-label="Filtros por categoría">
                    <h3 class="visually-hidden">Categorías de productos</h3>
                    <div class="filtros-categoria" id="filtrosCategoria">
                        <button class="filtro-btn active" data-categoria="Todas" aria-label="Filtrar por categoría Todas" aria-pressed="true">Todas</button>
                    </div>
                </nav>

                <div class="productos-grid" id="productosGrid" role="list" aria-label="Lista de productos disponibles"></div>
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
                <div class="carrito-items" id="carritoItems" aria-label="Productos en el carrito" aria-live="polite"></div>
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
                    <button class="metodo-pago-btn" data-metodo="Efectivo" role="radio" aria-checked="false" aria-label="Pagar con efectivo">
                        <i class="fas fa-money-bill" aria-hidden="true"></i>
                        Efectivo
                    </button>
                    <button class="metodo-pago-btn" data-metodo="Tarjeta" role="radio" aria-checked="false" aria-label="Pagar con tarjeta">
                        <i class="fas fa-credit-card" aria-hidden="true"></i>
                        Tarjeta
                    </button>
                    <button class="metodo-pago-btn" data-metodo="Transferencia" role="radio" aria-checked="false" aria-label="Pagar con transferencia">
                        <i class="fas fa-university" aria-hidden="true"></i>
                        Transferencia
                    </button>
                </div>
            </div>

            <div class="btn-procesar-container">
                <button class="btn-procesar" id="btnProcesar" disabled aria-disabled="true" aria-label="Procesar venta">
                    <i class="fas fa-check-circle" aria-hidden="true"></i>
                    Procesar Venta
                </button>
            </div>
        </aside>

        <div class="usuario-info" aria-label="Información de usuario">
            <div class="online-indicator">
                <span class="online-dot" aria-hidden="true"></span>
                <span id="onlineStatus">En línea</span>
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

    <script>
        window.addEventListener('load', function () {
            document.getElementById('loadingSpinner').style.display = 'none';
            document.getElementById('sistemaPos').style.display = 'grid';
        });

        function actualizarEstadoRed() {
            const banner   = document.getElementById('offlineBanner');
            const statusEl = document.getElementById('onlineStatus');
            const dot      = document.querySelector('.online-dot');

            if (!navigator.onLine) {
                if (banner)   banner.style.display   = 'block';
                if (statusEl) statusEl.textContent    = 'Sin conexión';
                if (dot)      dot.style.background    = '#E74C3C';
            } else {
                if (banner)   banner.style.display   = 'none';
                if (statusEl) statusEl.textContent    = 'En línea';
                if (dot)      dot.style.background    = '#27AE60';
            }
        }

        window.addEventListener('online',  actualizarEstadoRed);
        window.addEventListener('offline', actualizarEstadoRed);
        actualizarEstadoRed();

        const categorias        = ['Acrílicas', 'Esmaltes', 'Selladores', 'Barniz', 'Aerosol', 'Impermeabilizante', 'Complementos'];
        const filtrosContainer  = document.getElementById('filtrosCategoria');
        categorias.forEach(function (cat) {
            const btn = document.createElement('button');
            btn.className = 'filtro-btn';
            btn.textContent = cat;
            btn.setAttribute('data-categoria', cat);
            btn.setAttribute('aria-label', 'Filtrar por categoría ' + cat);
            btn.setAttribute('aria-pressed', 'false');
            filtrosContainer.appendChild(btn);
        });
    </script>

    <script src="js/ticket-printer.js" defer></script>
    <script src="js/script.js" defer></script>
    <script src="js/modulo-caja.js" defer></script>
    <script src="js/modulo-productos.js" defer></script>
    <script src="js/modulo-inventario.js" defer></script>
</body>
</html>