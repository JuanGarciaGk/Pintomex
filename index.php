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
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
    <meta name="referrer" content="strict-origin-when-cross-origin">

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
            --warning: #F39C12;
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

        .sistema-pos.carrito-oculto {
            grid-template-columns: 250px 1fr;
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

        .modulo-inventario { padding: 1.5rem; overflow-y: auto; height: 100%; }
        .inventario-container { max-width: 1100px; margin: 0 auto; }
        .inventario-header {
            display: flex; justify-content: space-between; align-items: center;
            flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;
        }
        .inventario-header h2 { color: var(--primary); font-size: 1.5rem; display: flex; align-items: center; gap: .5rem; }
        .inv-header-actions { display: flex; gap: .75rem; flex-wrap: wrap; }
        .btn-inv-entrada, .btn-inv-ajuste {
            padding: .6rem 1.1rem; border: none; border-radius: var(--radius-md);
            cursor: pointer; font-weight: 600; font-size: .9rem;
            display: inline-flex; align-items: center; gap: .4rem; transition: all .2s;
        }
        .btn-inv-entrada { background: var(--success); color: #fff; }
        .btn-inv-entrada:hover { background: #1e8449; transform: translateY(-1px); }
        .btn-inv-ajuste  { background: var(--warning); color: #fff; }
        .btn-inv-ajuste:hover  { background: #d68910; transform: translateY(-1px); }

        .inv-tabs {
            display: flex; gap: .5rem; flex-wrap: wrap;
            border-bottom: 2px solid var(--light); margin-bottom: 1.5rem; padding-bottom: 0;
        }
        .inv-tab {
            padding: .65rem 1.2rem; border: none; background: none; cursor: pointer;
            font-size: .9rem; font-weight: 500; color: var(--gray); border-radius: var(--radius-md) var(--radius-md) 0 0;
            border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all .2s;
            display: inline-flex; align-items: center; gap: .4rem;
        }
        .inv-tab:hover  { color: var(--primary); background: rgba(46,33,104,.05); }
        .inv-tab.active { color: var(--primary); border-bottom-color: var(--primary); background: #fff; font-weight: 700; }

        .inv-tab-content { min-height: 200px; }
        .inv-loading { text-align: center; padding: 3rem; color: var(--gray); font-size: 1.1rem; }
        .inv-error   { text-align: center; padding: 2rem; color: var(--danger); font-size: 1rem; }

        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 1rem; margin-bottom: 2rem;
        }
        .kpi-card {
            background: #fff; border-radius: var(--radius-lg);
            padding: 1.2rem 1rem; display: flex; align-items: center; gap: 1rem;
            box-shadow: var(--shadow-sm); border: 1px solid var(--light); transition: box-shadow .2s;
        }
        .kpi-card:hover { box-shadow: var(--shadow-md); }
        .kpi-card.kpi-warning { border-left: 4px solid var(--warning); }
        .kpi-card.kpi-danger  { border-left: 4px solid var(--danger);  }
        .kpi-icon {
            width: 46px; height: 46px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.2rem;
        }
        .kpi-info  { display: flex; flex-direction: column; }
        .kpi-value { font-size: 1.6rem; font-weight: 800; color: var(--primary); line-height: 1; }
        .kpi-label { font-size: .8rem; color: var(--gray); margin-top: .2rem; }

        .inv-seccion-titulo {
            font-size: 1rem; font-weight: 700; color: var(--primary);
            margin: 1.5rem 0 .75rem; display: flex; align-items: center; gap: .5rem;
        }
        .btn-link-inv {
            margin-left: auto; background: none; border: none; color: var(--secondary);
            cursor: pointer; font-weight: 600; font-size: .9rem;
        }
        .btn-link-inv:hover { text-decoration: underline; }

        .inv-filtros {
            display: flex; flex-wrap: wrap; gap: .75rem;
            margin-bottom: 1.25rem; align-items: center;
        }
        .inv-input, .inv-select {
            padding: .5rem .8rem; border: 1px solid var(--light);
            border-radius: var(--radius-md); font-size: .9rem; outline: none; background: #fff;
        }
        .inv-input:focus, .inv-select:focus { border-color: var(--primary); }
        .btn-inv-filtrar {
            padding: .5rem 1rem; background: var(--primary); color: #fff;
            border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;
            display: inline-flex; align-items: center; gap: .4rem;
        }
        .btn-inv-filtrar:hover { background: var(--primary-light); }
        .btn-inv-limpiar {
            padding: .5rem .8rem; background: var(--danger); color: #fff;
            border: none; border-radius: var(--radius-md); cursor: pointer;
        }

        .inv-tabla-wrap { overflow-x: auto; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
        .inv-tabla { width: 100%; border-collapse: collapse; background: #fff; min-width: 600px; }
        .inv-tabla th {
            background: var(--primary); color: #fff; padding: .85rem 1rem;
            text-align: left; font-weight: 600; font-size: .88rem; white-space: nowrap;
        }
        .inv-tabla td { padding: .8rem 1rem; border-bottom: 1px solid var(--light); font-size: .88rem; vertical-align: middle; }
        .inv-tabla tr:last-child td { border-bottom: none; }
        .inv-tabla tr:hover td { background: rgba(46,33,104,.03); }

        .badge-tipo {
            display: inline-block; padding: .25rem .65rem; border-radius: 20px;
            font-size: .78rem; font-weight: 600; white-space: nowrap;
        }
        .badge-tipo--entrada    { background: rgba(39,174,96,.12);  color: #1e8449; }
        .badge-tipo--salida     { background: rgba(231,76,60,.12);   color: #c0392b; }
        .badge-tipo--ajuste     { background: rgba(243,156,18,.12);  color: #d68910; }
        .badge-tipo--merma      { background: rgba(243,156,18,.12);  color: #d68910; }
        .badge-tipo--danio      { background: rgba(231,76,60,.12);   color: #c0392b; }
        .badge-tipo--derrame    { background: rgba(52,152,219,.12);  color: #2980b9; }
        .badge-tipo--devolucion { background: rgba(155,89,182,.12);  color: #8e44ad; }

        .badge-alerta { display: inline-block; padding: .25rem .65rem; border-radius: 20px; font-size: .78rem; font-weight: 600; }
        .badge-critico   { background: rgba(231,76,60,.15);  color: #c0392b; }
        .badge-bajo      { background: rgba(243,156,18,.15); color: #d68910; }
        .badge-precaucion{ background: rgba(52,152,219,.15); color: #2980b9; }
        .badge-normal    { background: rgba(39,174,96,.15);  color: #1e8449; }

        .inv-paginacion { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: 1rem; justify-content: center; }
        .btn-pag {
            width: 36px; height: 36px; border: 1px solid var(--light);
            border-radius: var(--radius-md); background: #fff; cursor: pointer; font-size: .88rem; font-weight: 500;
        }
        .btn-pag:hover      { background: var(--primary); color: #fff; }
        .btn-pag--active    { background: var(--primary); color: #fff; border-color: var(--primary); }
        .inv-paginacion-info { text-align: right; font-size: .82rem; color: var(--gray); margin-top: .5rem; }

        .inv-periodo-selector { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .btn-periodo {
            padding: .45rem 1rem; border: 2px solid var(--light);
            border-radius: 20px; background: #fff; cursor: pointer; font-size: .88rem; font-weight: 500; transition: all .2s;
        }
        .btn-periodo:hover  { border-color: var(--primary); color: var(--primary); }
        .btn-periodo.active { background: var(--primary); color: #fff; border-color: var(--primary); }

        .tendencias-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        @media (max-width: 700px) { .tendencias-grid { grid-template-columns: 1fr; } }
        .tendencia-col { background: #fff; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
        .tendencia-col-header {
            padding: 1rem 1.25rem; font-size: 1rem; font-weight: 700;
            display: flex; align-items: center; gap: .5rem;
        }
        .tendencia-col-header--top { background: linear-gradient(135deg,#fff8e1,#fff3cd); color: #b7770d; }
        .tendencia-col-header--low { background: linear-gradient(135deg,#e8f4fd,#d6eaf8); color: #1a5276; }
        .tendencia-item {
            display: flex; align-items: center; gap: .75rem;
            padding: .75rem 1.25rem; border-bottom: 1px solid var(--light);
        }
        .tendencia-item:last-child { border-bottom: none; }
        .tendencia-rank {
            width: 28px; height: 28px; border-radius: 50%; background: var(--light);
            display: flex; align-items: center; justify-content: center;
            font-size: .8rem; font-weight: 700; color: var(--primary); flex-shrink: 0;
        }
        .tendencia-info { flex: 1; min-width: 0; }
        .tendencia-nombre { font-weight: 600; font-size: .9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tendencia-cat  { font-size: .75rem; color: var(--gray); }
        .tendencia-barra { height: 4px; background: var(--light); border-radius: 2px; margin-top: .35rem; }
        .tendencia-barra-fill { height: 100%; background: var(--secondary); border-radius: 2px; transition: width .6s ease; }
        .tendencia-stat { text-align: right; flex-shrink: 0; }
        .tendencia-cantidad    { font-size: 1.2rem; font-weight: 800; color: var(--primary); }
        .tendencia-stat-label  { font-size: .72rem; color: var(--gray); }

        .modal-inv { max-width: 520px; width: 100%; }
        .modal-header {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;
        }
        .modal-header h3 { color: var(--primary); display: flex; align-items: center; gap: .5rem; font-size: 1.1rem; }
        .cerrar-modal { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: var(--gray); line-height: 1; }
        .cerrar-modal:hover { color: var(--danger); }
        .inv-form .form-group { margin-bottom: 1rem; }
        .inv-form label { display: block; font-weight: 600; margin-bottom: .35rem; font-size: .9rem; color: var(--primary); }
        .inv-form input, .inv-form select, .inv-form textarea {
            width: 100%; padding: .6rem .8rem; border: 1px solid var(--light);
            border-radius: var(--radius-md); font-size: .95rem; outline: none; transition: border .2s;
        }
        .inv-form input:focus, .inv-form select:focus, .inv-form textarea:focus { border-color: var(--primary); }
        .form-actions { display: flex; gap: .75rem; margin-top: 1.5rem; }
        .btn-guardar {
            flex: 1; padding: .8rem; background: var(--success); color: #fff;
            border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 700;
            display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
        }
        .btn-guardar:hover { background: #1e8449; }
        .btn-cancelar {
            flex: 1; padding: .8rem; background: var(--danger); color: #fff;
            border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 700;
            display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
        }
        .btn-cancelar:hover { background: #a93226; }

        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(40px); }
            to   { opacity: 1; transform: translateX(0); }
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

    <link rel="preload" href="css/modulo-reportes.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="css/modulo-reportes.css"></noscript>
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
                if (banner)   banner.style.display  = 'block';
                if (statusEl) statusEl.textContent   = 'Sin conexión';
                if (dot)      dot.style.background   = '#E74C3C';
            } else {
                if (banner)   banner.style.display  = 'none';
                if (statusEl) statusEl.textContent   = 'En línea';
                if (dot)      dot.style.background   = '#27AE60';
            }
        }

        window.addEventListener('online',  actualizarEstadoRed);
        window.addEventListener('offline', actualizarEstadoRed);
        actualizarEstadoRed();

        const categorias       = ['Acrílicas', 'Esmaltes', 'Selladores', 'Barniz', 'Aerosol', 'Impermeabilizante', 'Complementos'];
        const filtrosContainer = document.getElementById('filtrosCategoria');
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
    <script src="js/modulo-reportes.js" defer></script>
</body>
</html>