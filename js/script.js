class POSSystem {
    constructor() {
        this.carrito = [];
        this.productos = [];
        this.categoriaActiva = 'Todas';
        this.metodoPagoActivo = null;
        this.cargando = false;
        this.apiUrl = 'php/api.php';
        this.verificandoCaja = false;
        this.debounceTimer = null;
        this.cache = new Map();
        this.metrics = {};
        this.scannerBuffer = '';
        this.scannerTimeout = null;
        this.scannerActive = true;
        this.observer = null;
        this.categorias = ['Acrílicas', 'Esmaltes', 'Selladores', 'Barniz', 'Aerosol', 'Impermeabilizante', 'Complementos'];
        this.onlineStatus = true;
        this.reconnectInterval = null;
        this.requestTimings = [];
    }

    async init() {
        this.startMeasure('init');
        this.cargarEventos();
        this.initResponsive();
        this.initPerformanceOptimizations();
        this.initScanner();
        this.iniciarCategorias();
        this.initDisponibilidad();

        await Promise.all([
            this.verificarConexionBD(),
            this.cargarProductosDesdeBD(),
            this.actualizarCarrito()
        ]);

        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                this.agregarRippleEffect();
                this.iniciarBuscadorPredictivo();
                this.initModulos();
                this.iniciarActualizacionAutomatica();
                this.configurarAtajosTeclado();
                document.getElementById('codigoBarras')?.focus();
            });
        } else {
            setTimeout(() => {
                this.agregarRippleEffect();
                this.iniciarBuscadorPredictivo();
                this.initModulos();
                this.iniciarActualizacionAutomatica();
                this.configurarAtajosTeclado();
                document.getElementById('codigoBarras')?.focus();
            }, 100);
        }

        window.addEventListener('productos-actualizados', () => {
            this.recargarProductos();
        });

        window.addEventListener('inventario-actualizado', () => {
            this.recargarProductos();
        });

        this.endMeasure('init');
    }

    startMeasure(label) {
        this.metrics[label] = performance.now();
    }

    endMeasure(label) {
        const end = performance.now();
        const start = this.metrics[label];
        if (start) {
            const duration = end - start;
            console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
            if (duration > 3000) {
                console.warn(`⚠️ Operación lenta detectada: ${label} tardó ${duration.toFixed(0)}ms`);
                this.mostrarNotificacion(`⚠️ Operación lenta detectada (${duration.toFixed(0)}ms)`, 'warning');
            }
            this.requestTimings.push({ label, duration, timestamp: Date.now() });
            if (this.requestTimings.length > 50) this.requestTimings.shift();
            delete this.metrics[label];
        }
    }

    async fetchConTimeout(url, options = {}, timeout = 3000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const inicio = performance.now();
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            const duracion = performance.now() - inicio;
            if (duracion > 2500) console.warn(`⚠️ Petición lenta: ${url} - ${duracion.toFixed(0)}ms`);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') throw new Error('Tiempo de espera agotado (>3s). Verifique su conexión.');
            throw error;
        }
    }

    initPerformanceOptimizations() {
        const setVH = () => {
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        };
        setVH();

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(setVH, 150);
        });

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.documentElement.classList.add('reduce-animations');
        }

        this.setupLazyLoading();
        this.precargarRecursosCriticos();
    }

    precargarRecursosCriticos() {
        ['getProductos', 'getCarrito'].forEach(accion => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = `${this.apiUrl}?accion=${accion}`;
            document.head.appendChild(link);
        });
    }

    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.dataset.loaded = 'true';
                        this.observer?.unobserve(entry.target);
                    }
                });
            }, { rootMargin: '50px' });
        }
    }

    initDisponibilidad() {
        this.actualizarIndicadorOnline(navigator.onLine);

        window.addEventListener('online', () => {
            this.onlineStatus = true;
            this.actualizarIndicadorOnline(true);
            this.mostrarNotificacion('✅ Conexión restaurada', 'success');
            if (this.reconnectInterval) { clearInterval(this.reconnectInterval); this.reconnectInterval = null; }
            this.verificarConexionBD();
        });

        window.addEventListener('offline', () => {
            this.onlineStatus = false;
            this.actualizarIndicadorOnline(false);
            this.mostrarNotificacion('⚠️ Sin conexión a Internet', 'warning');
            this.iniciarReconexionAutomatica();
        });

        setInterval(() => this.verificarPingServidor(), 60000);
    }

    async verificarPingServidor() {
        try {
            const inicio = performance.now();
            const response = await this.fetchConTimeout(`${this.apiUrl}?accion=getCsrfToken`, {}, 5000);
            const duracion = performance.now() - inicio;
            if (response.ok) {
                if (!this.onlineStatus) {
                    this.onlineStatus = true;
                    this.actualizarIndicadorOnline(true);
                    this.mostrarNotificacion('✅ Servidor disponible', 'success');
                }
                if (duracion > 2000) this.actualizarIndicadorOnline(true, 'lento');
            }
        } catch {
            if (this.onlineStatus) {
                this.onlineStatus = false;
                this.actualizarIndicadorOnline(false);
                this.mostrarNotificacion('❌ Servidor no disponible', 'error');
                this.iniciarReconexionAutomatica();
            }
        }
    }

    iniciarReconexionAutomatica() {
        if (this.reconnectInterval) return;
        let intentos = 0;
        this.reconnectInterval = setInterval(async () => {
            intentos++;
            try {
                const response = await fetch(`${this.apiUrl}?accion=getCsrfToken`);
                if (response.ok) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                    this.onlineStatus = true;
                    this.actualizarIndicadorOnline(true);
                    this.mostrarNotificacion('✅ Reconexión exitosa', 'success');
                    await this.cargarProductosDesdeBD();
                }
            } catch {
                if (intentos >= 10) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                    this.mostrarNotificacion('❌ No se pudo reconectar. Recargue la página.', 'error');
                }
            }
        }, 15000);
    }

    actualizarIndicadorOnline(online, estado = null) {
        const dot = document.querySelector('.online-dot');
        const texto = document.querySelector('.online-indicator span:last-child');
        if (!dot || !texto) return;

        if (online && estado !== 'lento') {
            dot.style.background = '#27AE60';
            dot.style.boxShadow = '0 0 0 2px rgba(39,174,96,0.3)';
            texto.textContent = 'En línea';
        } else if (online && estado === 'lento') {
            dot.style.background = '#F39C12';
            dot.style.boxShadow = '0 0 0 2px rgba(243,156,18,0.3)';
            texto.textContent = 'Lento';
        } else {
            dot.style.background = '#E74C3C';
            dot.style.boxShadow = '0 0 0 2px rgba(231,76,60,0.3)';
            texto.textContent = 'Sin conexión';
        }
    }

    async obtenerCsrfToken() {
        const tokenMeta = document.querySelector('meta[name="csrf-token"]');
        if (tokenMeta) return tokenMeta.getAttribute('content');
        try {
            const response = await this.fetchConTimeout(this.apiUrl + '?accion=getCsrfToken');
            const data = await response.json();
            if (data.success && data.token) return data.token;
        } catch (error) {
            console.error('Error obteniendo CSRF token:', error);
        }
        return '';
    }

    async postWithCsrf(url, formData) {
        const csrfToken = await this.obtenerCsrfToken();
        formData.append('csrf_token', csrfToken);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') throw new Error('Tiempo de espera agotado (>10s)');
            throw error;
        }
    }

    sanitizarEntrada(texto, maxLength = 255) {
        if (!texto) return '';
        return String(texto).trim().substring(0, maxLength);
    }

    validarEnteroPositivo(valor) {
        const num = parseInt(valor, 10);
        return !isNaN(num) && num > 0 ? num : null;
    }

    validarFlotantePositivo(valor) {
        const num = parseFloat(valor);
        return !isNaN(num) && num >= 0 ? num : null;
    }

    async cachedFetch(url, options = {}, ttl = 30000) {
        const key = url + JSON.stringify(options);
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < ttl) return cached.data;
        try {
            const response = await this.fetchConTimeout(url, options);
            const data = await response.json();
            this.cache.set(key, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error('Error en cachedFetch:', error);
            throw error;
        }
    }

    limpiarTodaCache() {
        this.cache.clear();
        const cacheKeys = [
            this.apiUrl + '?accion=getProductos',
            this.apiUrl + '?accion=getProductosAdmin',
            this.apiUrl + '?accion=getResumenInventario',
            this.apiUrl + '?accion=getAlertasInventario'
        ];
        cacheKeys.forEach(key => this.cache.delete(key));
    }

    iniciarCategorias() {
        const filtrosContainer = document.getElementById('filtrosCategoria');
        if (!filtrosContainer) return;

        const existingButtons = filtrosContainer.querySelectorAll('.filtro-btn');
        if (existingButtons.length === 1) {
            this.categorias.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'filtro-btn';
                btn.textContent = cat;
                btn.setAttribute('data-categoria', cat);
                btn.setAttribute('aria-label', `Filtrar por categoría ${cat}`);
                filtrosContainer.appendChild(btn);
            });
        }
    }

    initScanner() {
        let lastKeyTime = 0;

        document.addEventListener('keypress', (e) => {
            if (!this.scannerActive) return;

            const moduloActivo = document.querySelector('.menu-item.active')?.dataset?.modulo;
            if (moduloActivo !== 'puntoventa') return;
            if (e.target && e.target.tagName === 'INPUT' && e.target.id === 'codigoBarras') return;

            const now = Date.now();
            const timeDiff = now - lastKeyTime;

            if (timeDiff > 100 && this.scannerBuffer.length > 0) this.scannerBuffer = '';

            lastKeyTime = now;

            if (e.key.length === 1 && (e.key.match(/[a-zA-Z0-9]/) || e.key === '-')) {
                this.scannerBuffer += e.key;
                if (this.scannerTimeout) clearTimeout(this.scannerTimeout);
                this.scannerTimeout = setTimeout(async () => {
                    if (this.scannerBuffer.length >= 4) await this.buscarPorCodigoEscanner(this.scannerBuffer);
                    this.scannerBuffer = '';
                }, 100);
            }

            if (e.key === 'Enter' && this.scannerBuffer.length > 0) {
                e.preventDefault();
                if (this.scannerTimeout) clearTimeout(this.scannerTimeout);
                this.buscarPorCodigoEscanner(this.scannerBuffer);
                this.scannerBuffer = '';
            }
        });
    }

    async buscarPorCodigoEscanner(codigo) {
        if (!codigo || this.cargando) return;

        const codigoSanitizado = this.sanitizarEntrada(codigo, 50);
        const inputBusqueda = document.getElementById('codigoBarras');
        if (inputBusqueda) inputBusqueda.value = codigoSanitizado;

        this.startMeasure('escanner_' + codigoSanitizado);

        try {
            const response = await this.fetchConTimeout(
                this.apiUrl + '?accion=buscarPorCodigo&codigo=' + encodeURIComponent(codigoSanitizado)
            );
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const producto = await response.json();

            if (producto && producto.id) {
                await this.agregarAlCarrito(producto.id, 1);
                if (inputBusqueda) { inputBusqueda.value = ''; inputBusqueda.focus(); }
                this.agregarEfectoFeedback('success');
            } else {
                this.mostrarNotificacion('❌ Producto no encontrado: ' + codigoSanitizado, 'warning');
                if (inputBusqueda) {
                    inputBusqueda.classList.add('error');
                    setTimeout(() => inputBusqueda.classList.remove('error'), 500);
                }
                this.agregarEfectoFeedback('error');
            }
        } catch (error) {
            console.error('Error escáner:', error);
            this.mostrarNotificacion('Error en la búsqueda: ' + error.message, 'error');
        } finally {
            this.endMeasure('escanner_' + codigoSanitizado);
        }
    }

    agregarEfectoFeedback(tipo) {
        const feedback = document.createElement('div');
        feedback.className = `scanner-feedback scanner-${tipo}`;
        feedback.innerHTML = tipo === 'success'
            ? '<i class="fas fa-check-circle" aria-hidden="true"></i> Producto agregado'
            : '<i class="fas fa-times-circle" aria-hidden="true"></i> Producto no encontrado';
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'polite');
        document.body.appendChild(feedback);

        setTimeout(() => {
            feedback.classList.add('show');
            setTimeout(() => {
                feedback.classList.remove('show');
                setTimeout(() => { if (document.body.contains(feedback)) document.body.removeChild(feedback); }, 300);
            }, 1500);
        }, 10);
    }

    configurarAtajosTeclado() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                if (this.carrito.length > 0 && this.metodoPagoActivo) this.procesarVenta();
            }
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                if (this.carrito.length > 0 && confirm('¿Está seguro de vaciar el carrito?')) this.vaciarCarrito();
            }
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                document.getElementById('codigoBarras')?.focus();
            }
            if (e.key === 'Escape') {
                const input = document.getElementById('codigoBarras');
                if (input === document.activeElement) {
                    input.value = '';
                    document.getElementById('sugerencias')?.classList.remove('active');
                }
            }
            if (e.key === 'F1') { e.preventDefault(); this.mostrarAyudaAtajos(); }
        });
    }

    mostrarAyudaAtajos() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Atajos de teclado');
        modal.innerHTML = `
            <div class="modal-contenido" style="max-width:500px;">
                <h3 style="color:var(--primary);margin-bottom:1.5rem;">
                    <i class="fas fa-keyboard" aria-hidden="true"></i> Atajos de Teclado
                </h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div><strong>Enter</strong> en búsqueda</div><div>Agregar producto</div>
                    <div><strong>Ctrl + P</strong></div><div>Procesar venta</div>
                    <div><strong>Ctrl + L</strong></div><div>Limpiar carrito</div>
                    <div><strong>Ctrl + B</strong></div><div>Enfocar búsqueda</div>
                    <div><strong>Escape</strong></div><div>Limpiar búsqueda</div>
                    <div><strong>Flechas ↑↓</strong></div><div>Navegar sugerencias</div>
                    <div><strong>F1</strong></div><div>Mostrar ayuda</div>
                </div>
                <div style="margin-top:2rem;padding:1rem;background:var(--light);border-radius:var(--radius-md);">
                    <p><i class="fas fa-info-circle" aria-hidden="true"></i>
                    El escáner funciona únicamente en el módulo <strong>Punto de Venta</strong>.</p>
                </div>
                <button class="btn-cerrar-atajos"
                    style="width:100%;margin-top:1.5rem;padding:1rem;background:var(--primary);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;">
                    <i class="fas fa-check" aria-hidden="true"></i> Cerrar
                </button>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector('.btn-cerrar-atajos')?.addEventListener('click', () => modal.remove());
    }

    iniciarActualizacionAutomatica() {
        setInterval(() => {
            const menuActivo = document.querySelector('.menu-item.active');
            if (menuActivo?.dataset.modulo === 'caja' && window.moduloCaja) {
                window.moduloCaja.verificarEstadoCaja();
            }
        }, 30000);
    }

    async verificarCajaAntesDeVender() {
        if (this.verificandoCaja) return false;
        this.verificandoCaja = true;
        try {
            const data = await this.cachedFetch(this.apiUrl + '?accion=getEstadoCaja', {}, 5000);
            if (data.success) {
                if (!data.caja_abierta) {
                    this.mostrarNotificacion('Debe abrir la caja antes de realizar ventas', 'warning');
                    document.querySelector('.menu-item[data-modulo="caja"]')?.click();
                    return false;
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error verificando caja:', error);
            return false;
        } finally {
            this.verificandoCaja = false;
        }
    }

    _mostrarCarrito() {
        const carritoPanel = document.querySelector('.carrito-panel');
        const sistemaPos = document.getElementById('sistemaPos');
        if (carritoPanel) { carritoPanel.style.display = ''; carritoPanel.style.visibility = ''; }
        if (sistemaPos) sistemaPos.classList.remove('carrito-oculto');
        const toggle = document.querySelector('.toggle-carrito-mobile');
        if (toggle) toggle.style.display = '';
    }

    _ocultarCarrito() {
        const carritoPanel = document.querySelector('.carrito-panel');
        const sistemaPos = document.getElementById('sistemaPos');
        if (carritoPanel) { carritoPanel.classList.remove('visible'); carritoPanel.style.display = 'none'; }
        if (sistemaPos) sistemaPos.classList.add('carrito-oculto');
        const toggle = document.querySelector('.toggle-carrito-mobile');
        if (toggle) toggle.style.display = 'none';
    }

    initModulos() {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const modulo = e.currentTarget.dataset.modulo;

                this.scannerBuffer = '';
                if (this.scannerTimeout) clearTimeout(this.scannerTimeout);

                document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                e.currentTarget.classList.add('active');

                document.querySelectorAll('.contenido-principal > section').forEach(s => s.style.display = 'none');

                if (modulo !== 'productos' && modulo !== 'inventario' && modulo !== 'reportes') {
                    this._mostrarCarrito();
                }

                if (modulo === 'caja') {
                    this._ocultarCarrito();
                    if (window.moduloCaja) window.moduloCaja.mostrarModulo();

                } else if (modulo === 'puntoventa') {
                    const posSection = document.getElementById('seccionPuntoVenta');
                    if (posSection) {
                        posSection.style.display = 'block';
                        this.verificarCajaAntesDeVender();
                        setTimeout(() => document.getElementById('codigoBarras')?.focus(), 100);
                    }

                } else if (modulo === 'productos') {
                    this._ocultarCarrito();
                    if (window.moduloProductos) window.moduloProductos.mostrarModulo();

                } else if (modulo === 'inventario') {
                    this._ocultarCarrito();
                    if (window.moduloInventario) {
                        window.moduloInventario.mostrarModulo();
                    } else {
                        window.moduloInventario = new ModuloInventario();
                        window.moduloInventario.init().then(() => {
                            window.moduloInventario.mostrarModulo();
                        });
                    }

                } else if (modulo === 'reportes') {
                    this._ocultarCarrito();
                    if (window.moduloReportes) {
                        window.moduloReportes.mostrarModulo();
                    } else {
                        window.moduloReportes = new ModuloReportes();
                        window.moduloReportes.init().then(() => {
                            window.moduloReportes.mostrarModulo();
                        });
                    }
                }
            });

            item.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') e.currentTarget.click();
            });
        });
    }

    async verificarConexionBD() {
        this.startMeasure('verificarConexionBD');
        try {
            const response = await this.fetchConTimeout(this.apiUrl + '?accion=getProductos');
            if (!response.ok) throw new Error('Error de conexión');
            const data = await response.json();
            console.log('✅ Conexión exitosa a la BD, productos cargados:', data.length);
        } catch (error) {
            console.error('❌ Error conectando a la BD:', error);
            this.mostrarNotificacion('Error de conexión con la base de datos', 'error');
        } finally {
            this.endMeasure('verificarConexionBD');
        }
    }

    async cargarProductosDesdeBD(forceRefresh = false) {
        this.startMeasure('cargarProductos');
        this.mostrarCargando(true);
        try {
            const url = this.apiUrl + '?accion=getProductos&_t=' + (forceRefresh ? Date.now() : Date.now());
            const response = await this.fetchConTimeout(url, {}, 3000);
            const data = await response.json();
            this.productos = data;
            
            this.cache.set(this.apiUrl + '?accion=getProductos', { data, timestamp: Date.now() });
            
            requestAnimationFrame(() => {
                this.mostrarProductos(this.productos);
            });
        } catch (error) {
            console.error('Error cargando productos:', error);
            this.mostrarNotificacion('Error al cargar productos: ' + error.message, 'error');
        } finally {
            this.mostrarCargando(false);
            this.endMeasure('cargarProductos');
        }
    }

    async recargarProductos() {
        try {
            const url = this.apiUrl + '?accion=getProductos&_t=' + Date.now();
            const response = await this.fetchConTimeout(url, {}, 5000);
            const data = await response.json();
            this.productos = data;

            this.cache.set(this.apiUrl + '?accion=getProductos', { data, timestamp: Date.now() });

            const seccionPuntoVenta = document.getElementById('seccionPuntoVenta');
            if (seccionPuntoVenta && seccionPuntoVenta.style.display !== 'none') {
                await this.filtrarProductos();
            } else {
                this.mostrarProductos(this.productos);
            }

            const categoriaActivaActual = this.categoriaActiva;
            document.querySelectorAll('.filtro-btn').forEach(btn => {
                btn.classList.toggle('active', btn.textContent === categoriaActivaActual);
            });

            if (this.carrito?.length > 0) {
                for (const item of this.carrito) {
                    const productoActualizado = this.productos.find(p => p.id === item.id);
                    if (productoActualizado && item.cantidad > productoActualizado.stock_actual) {
                        await this.modificarCantidad(item.id, productoActualizado.stock_actual);
                        this.mostrarNotificacion(
                            `⚠️ Stock de "${productoActualizado.nombre}" reducido a ${productoActualizado.stock_actual}`,
                            'warning'
                        );
                    } else if (productoActualizado && item.stock !== productoActualizado.stock_actual) {
                        item.stock = productoActualizado.stock_actual;
                    }
                }
                const subtotal = this.carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0);
                this.renderizarCarrito({ items: this.carrito, subtotal: subtotal, total: subtotal });
            }

            if (window.moduloProductos) {
                await window.moduloProductos.cargarProductos(true);
            }

            if (window.moduloInventario) {
                await window.moduloInventario.cargarListaProductos();
                if (document.getElementById('moduloInventario')?.style.display === 'block') {
                    if (window.moduloInventario.tabActiva === 'resumen') {
                        await window.moduloInventario.cargarResumen();
                    } else if (window.moduloInventario.tabActiva === 'alertas') {
                        await window.moduloInventario.cargarAlertas();
                    }
                }
            }
        } catch (error) {
            console.error('Error recargando productos:', error);
        }
    }

    async actualizarStockGlobal() {
        this.limpiarTodaCache();
        
        await this.recargarProductos();
        
        if (window.moduloProductos) {
            await window.moduloProductos.cargarProductos(true);
        }
        
        if (window.moduloInventario) {
            await window.moduloInventario.cargarListaProductos();
            const inventarioVisible = document.getElementById('moduloInventario')?.style.display === 'block';
            if (inventarioVisible) {
                if (window.moduloInventario.tabActiva === 'resumen') {
                    await window.moduloInventario.cargarResumen();
                } else if (window.moduloInventario.tabActiva === 'alertas') {
                    await window.moduloInventario.cargarAlertas();
                } else if (window.moduloInventario.tabActiva === 'tendencias') {
                    await window.moduloInventario.cargarTendencias(window.moduloInventario.periodoTendencia);
                }
                window.moduloInventario.cacheTendencias.clear();
            }
        }
        
        window.dispatchEvent(new CustomEvent('productos-actualizados'));
        window.dispatchEvent(new CustomEvent('inventario-actualizado'));
        
        this.categoriaActiva = 'Todas';
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === 'Todas');
        });
        await this.filtrarProductos();
    }

    mostrarCargando(mostrar) {
        const grid = document.getElementById('productosGrid');
        if (!grid) return;

        if (mostrar) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:3rem;">
                    <div class="spinner"></div>
                    <p style="margin-top:1rem;color:var(--gray);">Cargando productos...</p>
                </div>`;

            if (!document.getElementById('spinner-style')) {
                const style = document.createElement('style');
                style.id = 'spinner-style';
                style.textContent = `
                    .spinner { width:50px;height:50px;border:5px solid var(--light);
                        border-top-color:var(--secondary);border-radius:50%;
                        animation:spin 1s linear infinite;margin:0 auto; }
                    @keyframes spin { to { transform:rotate(360deg); } }`;
                document.head.appendChild(style);
            }
        }
    }

    async agregarAlCarrito(productoId, cantidad = 1) {
        const cajaAbierta = await this.verificarCajaAntesDeVender();
        if (!cajaAbierta) return;
        if (this.cargando) return;
        this.cargando = true;
        this.startMeasure('agregarAlCarrito');

        try {
            const idValido = this.validarEnteroPositivo(productoId);
            const cantidadValida = this.validarEnteroPositivo(cantidad) || 1;

            if (!idValido) { this.mostrarNotificacion('ID de producto inválido', 'error'); return; }

            const formData = new FormData();
            formData.append('accion', 'agregarCarrito');
            formData.append('producto_id', idValido);
            formData.append('cantidad', cantidadValida);

            const response = await this.postWithCsrf(this.apiUrl, formData);
            const data = await response.json();

            if (data.success) {
                this.carrito = data.carrito.items;
                requestAnimationFrame(() => this.renderizarCarrito(data.carrito));
                this.mostrarNotificacion('✅ Producto agregado al carrito', 'success');
                document.getElementById('codigoBarras')?.focus();
            } else {
                this.mostrarNotificacion(`❌ ${data.message || 'Error al agregar producto'}`, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('❌ Error de conexión: ' + error.message, 'error');
        } finally {
            this.cargando = false;
            this.endMeasure('agregarAlCarrito');
            const sugerencias = document.getElementById('sugerencias');
            if (sugerencias) { sugerencias.classList.remove('active'); sugerencias.innerHTML = ''; }
            const input = document.getElementById('codigoBarras');
            if (input) input.value = '';
        }
    }

    async buscarSugerencias(termino) {
        const sugerenciasDiv = document.getElementById('sugerencias');
        if (!sugerenciasDiv) return;

        if (termino.length < 2) {
            sugerenciasDiv.classList.remove('active');
            sugerenciasDiv.innerHTML = '';
            return;
        }

        try {
            const terminoSanitizado = this.sanitizarEntrada(termino, 100);
            const response = await this.fetchConTimeout(
                this.apiUrl + '?accion=buscarProductos&termino=' + encodeURIComponent(terminoSanitizado)
            );
            const productos = await response.json();

            if (productos.length === 0) {
                sugerenciasDiv.innerHTML = '<div class="sugerencia-item" style="justify-content:center;">No se encontraron productos</div>';
                sugerenciasDiv.classList.add('active');
                return;
            }

            const fragment = document.createDocumentFragment();
            productos.slice(0, 8).forEach(producto => {
                const item = document.createElement('div');
                item.className = 'sugerencia-item';
                item.dataset.id = producto.id;
                item.tabIndex = 0;
                item.role = 'option';
                item.setAttribute('aria-label', `${producto.nombre} - $${parseFloat(producto.precio).toFixed(2)}`);
                item.innerHTML = `
                    <div class="sugerencia-info">
                        <div class="sugerencia-nombre">${this.escapeHTML(producto.nombre)}</div>
                        <div class="sugerencia-descripcion">
                            <span class="sugerencia-codigo">${this.escapeHTML(producto.codigo_barras)}</span>
                            <span>${this.escapeHTML(producto.descripcion || '')}</span>
                        </div>
                        <div class="sugerencia-stock ${producto.stock_actual <= producto.stock_minimo ? 'stock-bajo-sugerencia' : ''}">
                            <i class="fas fa-box" aria-hidden="true"></i> Stock: ${producto.stock_actual}
                        </div>
                    </div>
                    <div class="sugerencia-precio">$${parseFloat(producto.precio).toFixed(2)}</div>`;
                fragment.appendChild(item);
            });

            sugerenciasDiv.innerHTML = '';
            sugerenciasDiv.appendChild(fragment);
            sugerenciasDiv.classList.add('active');

            sugerenciasDiv.querySelectorAll('.sugerencia-item').forEach(item => {
                item.addEventListener('click', () => {
                    if (item.dataset.id) this.agregarAlCarrito(parseInt(item.dataset.id));
                });
                item.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && item.dataset.id) this.agregarAlCarrito(parseInt(item.dataset.id));
                });
            });
        } catch (error) {
            console.error('Error en sugerencias:', error);
        }
    }

    escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async actualizarCarrito() {
        try {
            const response = await this.fetchConTimeout(this.apiUrl + '?accion=getCarrito');
            const data = await response.json();
            this.carrito = data.items;
            this.renderizarCarrito(data);
        } catch (error) {
            console.error('Error actualizando carrito:', error);
        }
    }

    async modificarCantidad(productoId, cantidad) {
        if (this.cargando) return;
        this.cargando = true;
        try {
            const formData = new FormData();
            formData.append('accion', 'modificarCarrito');
            formData.append('producto_id', productoId);
            formData.append('cantidad', cantidad);

            const response = await this.postWithCsrf(this.apiUrl, formData);
            const data = await response.json();

            if (data.success === false && data.message?.includes('Stock insuficiente')) {
                this.mostrarNotificacion(`❌ ${data.message}`, 'error');
                this.cargando = false;
                return;
            }

            this.carrito = data.items;
            this.renderizarCarrito(data);
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error al modificar: ' + error.message, 'error');
        } finally {
            this.cargando = false;
            document.getElementById('codigoBarras')?.focus();
        }
    }

    async eliminarDelCarrito(productoId) {
        if (this.cargando) return;
        this.cargando = true;
        try {
            const formData = new FormData();
            formData.append('accion', 'eliminarCarrito');
            formData.append('producto_id', productoId);

            const response = await this.postWithCsrf(this.apiUrl, formData);
            const data = await response.json();
            this.carrito = data.items;
            this.renderizarCarrito(data);
            this.mostrarNotificacion('Producto eliminado', 'success');
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error al eliminar: ' + error.message, 'error');
        } finally {
            this.cargando = false;
            document.getElementById('codigoBarras')?.focus();
        }
    }

    async vaciarCarrito() {
        if (this.cargando) return;
        this.cargando = true;
        try {
            const formData = new FormData();
            formData.append('accion', 'vaciarCarrito');

            const response = await this.postWithCsrf(this.apiUrl, formData);
            const data = await response.json();
            this.carrito = data.items;
            this.renderizarCarrito(data);
            this.mostrarNotificacion('Carrito vaciado', 'success');
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error al vaciar carrito: ' + error.message, 'error');
        } finally {
            this.cargando = false;
        }
    }

    async filtrarProductos() {
        this.startMeasure('filtrarProductos');
        this.mostrarCargando(true);
        try {
            const response = await this.fetchConTimeout(
                this.apiUrl + '?accion=getProductosPorCategoria&categoria=' + encodeURIComponent(this.categoriaActiva)
            );
            const productos = await response.json();
            requestAnimationFrame(() => this.mostrarProductos(productos));
        } catch (error) {
            console.error('Error filtrando:', error);
            this.mostrarNotificacion('Error al filtrar: ' + error.message, 'error');
        } finally {
            this.mostrarCargando(false);
            this.endMeasure('filtrarProductos');
        }
    }

    mostrarProductos(productos) {
        const grid = document.getElementById('productosGrid');
        if (!grid) return;

        if (productos.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--gray);">No hay productos disponibles</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        productos.forEach(producto => {
            const card = document.createElement('div');
            card.className = 'producto-card';
            card.dataset.id = producto.id;
            card.tabIndex = 0;
            card.role = 'button';
            card.setAttribute('aria-label', `${producto.nombre} - $${parseFloat(producto.precio).toFixed(2)} - Stock: ${producto.stock_actual}`);

            let stockClass = 'stock';
            let stockText = `${producto.stock_actual} disponibles`;

            if (producto.stock_actual <= 0) {
                stockClass += ' stock-agotado';
                stockText = '❌ AGOTADO';
                card.style.opacity = '0.5';
                card.style.cursor = 'not-allowed';
                card.setAttribute('aria-disabled', 'true');
            } else if (producto.stock_actual <= producto.stock_minimo) {
                stockClass += ' stock-bajo';
                stockText = `⚠️ Quedan ${producto.stock_actual}`;
            }

            card.innerHTML = `
                <h3>${this.escapeHTML(producto.nombre)}</h3>
                <div class="precio">$${parseFloat(producto.precio).toFixed(2)}</div>
                <div class="${stockClass}">
                    <i class="fas fa-box" aria-hidden="true"></i> ${stockText}
                </div>
                <small>${this.escapeHTML(producto.descripcion || '')}</small>`;
            fragment.appendChild(card);
        });

        grid.innerHTML = '';
        grid.appendChild(fragment);

        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.producto-card');
            if (card?.dataset.id && card.getAttribute('aria-disabled') !== 'true') {
                const producto = this.productos.find(p => p.id == card.dataset.id);
                if (producto && producto.stock_actual > 0) {
                    this.agregarAlCarrito(parseInt(card.dataset.id));
                } else if (producto) {
                    this.mostrarNotificacion('❌ No hay stock disponible de este producto', 'error');
                }
            }
        });

        grid.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const card = e.target.closest('.producto-card');
                if (card?.dataset.id && card.getAttribute('aria-disabled') !== 'true') {
                    const producto = this.productos.find(p => p.id == card.dataset.id);
                    if (producto && producto.stock_actual > 0) this.agregarAlCarrito(parseInt(card.dataset.id));
                }
            }
        });

        if (this.observer) {
            grid.querySelectorAll('.producto-card').forEach(card => this.observer.observe(card));
        }
    }

    renderizarCarrito(data) {
        const container = document.getElementById('carritoItems');
        if (!container) return;

        const subtotal = parseFloat(data.subtotal) || 0;
        const total = parseFloat(data.total) || 0;

        if (!data.items || data.items.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:2rem;color:var(--gray);">
                    <i class="fas fa-shopping-cart" style="font-size:3rem;margin-bottom:1rem;opacity:.3;" aria-hidden="true"></i>
                    <p>Carrito vacío</p>
                    <p style="font-size:.9rem;margin-top:.5rem;">Agregue productos para comenzar</p>
                </div>`;

            const btnVaciar = document.querySelector('.btn-vaciar-carrito');
            if (btnVaciar) btnVaciar.style.display = 'none';

            const subtotalEl = document.getElementById('subtotal');
            const totalEl = document.getElementById('total');
            if (subtotalEl) subtotalEl.textContent = '$0.00';
            if (totalEl) totalEl.textContent = '$0.00';

            const btnProcesar = document.getElementById('btnProcesar');
            if (btnProcesar) { btnProcesar.disabled = true; btnProcesar.setAttribute('aria-disabled', 'true'); }
            return;
        }

        const fragment = document.createDocumentFragment();
        data.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'carrito-item';
            itemDiv.setAttribute('aria-label', `${item.nombre} - ${item.cantidad} unidades - $${parseFloat(item.subtotal).toFixed(2)}`);
            itemDiv.innerHTML = `
                <div class="item-info">
                    <h4>${this.escapeHTML(item.nombre)}</h4>
                    <p>${this.escapeHTML(item.descripcion || '')}</p>
                    <div class="cantidad-control">
                        <button class="btn-decrement" data-id="${item.id}" data-cantidad="${item.cantidad - 1}"
                            ${item.cantidad <= 1 ? 'disabled' : ''} aria-label="Disminuir cantidad">
                            <i class="fas fa-minus" aria-hidden="true"></i>
                        </button>
                        <input type="number" value="${item.cantidad}" min="1" max="${item.stock}"
                            class="cantidad-input" data-id="${item.id}" aria-label="Cantidad de ${this.escapeHTML(item.nombre)}">
                        <button class="btn-increment" data-id="${item.id}" data-cantidad="${item.cantidad + 1}"
                            ${item.cantidad >= item.stock ? 'disabled' : ''} aria-label="Aumentar cantidad">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                <div class="item-precio">
                    <div class="precio">$${parseFloat(item.precio).toFixed(2)}</div>
                    <small>$${parseFloat(item.subtotal).toFixed(2)}</small>
                    <button class="btn-eliminar" data-id="${item.id}" aria-label="Eliminar ${this.escapeHTML(item.nombre)}">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </div>`;
            fragment.appendChild(itemDiv);
        });

        container.innerHTML = '';
        container.appendChild(fragment);

        const subtotalEl = document.getElementById('subtotal');
        const totalEl = document.getElementById('total');
        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

        const btnProcesar = document.getElementById('btnProcesar');
        if (btnProcesar) { btnProcesar.disabled = false; btnProcesar.setAttribute('aria-disabled', 'false'); }

        const btnVaciar = document.querySelector('.btn-vaciar-carrito');
        if (btnVaciar) btnVaciar.style.display = 'flex';

        this.calcularCambio();

        container.querySelectorAll('.btn-decrement, .btn-increment, .btn-eliminar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (btn.classList.contains('btn-decrement')) this.modificarCantidad(id, parseInt(btn.dataset.cantidad));
                else if (btn.classList.contains('btn-increment')) this.modificarCantidad(id, parseInt(btn.dataset.cantidad));
                else if (btn.classList.contains('btn-eliminar')) this.eliminarDelCarrito(id);
            });
        });

        container.querySelectorAll('.cantidad-input').forEach(input => {
            input.addEventListener('change', () => {
                const id = parseInt(input.dataset.id);
                const cantidad = parseInt(input.value) || 1;
                this.modificarCantidad(id, cantidad);
            });
        });
    }

    async procesarVenta() {
        const cajaAbierta = await this.verificarCajaAntesDeVender();
        if (!cajaAbierta) return;

        if (this.carrito.length === 0) { this.mostrarNotificacion('❌ El carrito está vacío', 'warning'); return; }
        if (!this.metodoPagoActivo) { this.mostrarNotificacion('❌ Seleccione un método de pago', 'warning'); return; }

        this.startMeasure('procesarVenta');

        if (this.metodoPagoActivo === 'Efectivo') {
            const efectivoInput = document.getElementById('efectivoRecibido');
            const efectivo = parseFloat(efectivoInput?.value);
            const total = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);

            if (!efectivoInput?.value || efectivoInput.value.trim() === '') {
                this.mostrarNotificacion('⚠️ Ingrese la cantidad de efectivo recibido', 'warning');
                efectivoInput?.focus();
                if (efectivoInput) {
                    efectivoInput.style.borderColor = 'var(--danger)';
                    setTimeout(() => { efectivoInput.style.borderColor = 'var(--light)'; }, 2000);
                }
                return;
            }

            if (isNaN(efectivo) || efectivo <= 0) {
                this.mostrarNotificacion('❌ La cantidad de efectivo no es válida', 'error');
                if (efectivoInput) {
                    efectivoInput.focus();
                    efectivoInput.style.borderColor = 'var(--danger)';
                    efectivoInput.value = '';
                    setTimeout(() => { efectivoInput.style.borderColor = 'var(--light)'; }, 2000);
                }
                return;
            }

            if (efectivo < total) {
                this.mostrarNotificacion(`❌ Efectivo insuficiente. Faltan: $${(total - efectivo).toFixed(2)}`, 'error');
                if (efectivoInput) {
                    efectivoInput.focus();
                    efectivoInput.style.borderColor = 'var(--danger)';
                    setTimeout(() => { efectivoInput.style.borderColor = 'var(--light)'; }, 2000);
                }
                return;
            }
        }

        this.cargando = true;

        try {
            const subtotal = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
            const total = subtotal;

            let efectivoRecibido = null;
            let cambio = null;

            if (this.metodoPagoActivo === 'Efectivo') {
                efectivoRecibido = parseFloat(document.getElementById('efectivoRecibido')?.value);
                cambio = efectivoRecibido - total;
            }

            const formData = new FormData();
            formData.append('accion', 'procesarVenta');
            formData.append('metodo_pago', this.metodoPagoActivo);
            if (efectivoRecibido !== null) formData.append('efectivo_recibido', efectivoRecibido);
            if (cambio !== null) formData.append('cambio', cambio);

            const response = await this.postWithCsrf(this.apiUrl, formData);
            const data = await response.json();

            if (data.success) {
                const venta = {
                    folio: data.folio,
                    fecha: new Date().toLocaleString(),
                    items: [...this.carrito],
                    subtotal: parseFloat(total),
                    total: parseFloat(total),
                    metodo_pago: this.metodoPagoActivo,
                    efectivo_recibido: efectivoRecibido ? parseFloat(efectivoRecibido) : null,
                    cambio: cambio ? parseFloat(cambio) : null
                };

                if (window.ticketPrinter) {
                    await window.ticketPrinter.printTicket(venta, true);
                } else {
                    this.mostrarTicket(venta);
                }

                if (this.metodoPagoActivo === 'Efectivo') {
                    this.mostrarNotificacion(
                        cambio > 0 ? `✅ Venta procesada. Cambio: $${cambio.toFixed(2)}` : '✅ Venta procesada con pago exacto',
                        'success'
                    );
                } else {
                    this.mostrarNotificacion(`✅ Venta procesada con ${this.metodoPagoActivo}`, 'success');
                }

                await this.actualizarStockGlobal();

                this.carrito = [];
                const vaciarFD = new FormData();
                vaciarFD.append('accion', 'vaciarCarrito');
                await this.postWithCsrf(this.apiUrl, vaciarFD);

                this.renderizarCarrito({ items: [], subtotal: 0, total: 0 });

                this.metodoPagoActivo = null;
                document.querySelectorAll('.metodo-pago-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-checked', 'false');
                });

                const efectivoSection = document.getElementById('efectivoSection');
                if (efectivoSection) efectivoSection.style.display = 'none';

                const efectivoRecibidoInput = document.getElementById('efectivoRecibido');
                if (efectivoRecibidoInput) efectivoRecibidoInput.value = '';

                const cambioSpan = document.getElementById('cambio');
                if (cambioSpan) { cambioSpan.textContent = '$0.00'; cambioSpan.style.color = 'var(--gray)'; }

                const subtotalEl = document.getElementById('subtotal');
                const totalEl = document.getElementById('total');
                if (subtotalEl) subtotalEl.textContent = '$0.00';
                if (totalEl) totalEl.textContent = '$0.00';

                const btnProcesar = document.getElementById('btnProcesar');
                if (btnProcesar) { btnProcesar.disabled = true; btnProcesar.setAttribute('aria-disabled', 'true'); }

                const btnVaciar = document.querySelector('.btn-vaciar-carrito');
                if (btnVaciar) btnVaciar.style.display = 'none';

                if (window.moduloCaja) {
                    window.moduloCaja.verificarEstadoCaja();
                    if (document.querySelector('.menu-item.active')?.dataset.modulo === 'caja') {
                        window.moduloCaja.actualizarUI();
                    }
                }

                const inputBusqueda = document.getElementById('codigoBarras');
                if (inputBusqueda) { inputBusqueda.value = ''; inputBusqueda.focus(); }

            } else {
                this.mostrarNotificacion(`❌ ${data.message || 'Error al procesar venta'}`, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('❌ Error de conexión: ' + error.message, 'error');
        } finally {
            this.cargando = false;
            this.endMeasure('procesarVenta');
        }
    }

    cargarEventos() {
        const inputCodigo = document.getElementById('codigoBarras');
        if (inputCodigo) {
            inputCodigo.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const sugerencias = document.getElementById('sugerencias');
                    const activeItem = sugerencias?.querySelector('.sugerencia-item.active');
                    if (activeItem) {
                        if (activeItem.dataset.id) this.agregarAlCarrito(parseInt(activeItem.dataset.id));
                    } else {
                        this.buscarPorCodigo(e.target.value);
                    }
                }
            });
        }

        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.categoriaActiva = e.target.textContent;
                this.filtrarProductos();
            });
        });

        document.querySelectorAll('.metodo-pago-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const metodo = e.currentTarget.dataset.metodo;

                document.querySelectorAll('.metodo-pago-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-checked', 'false');
                });
                e.currentTarget.classList.add('active');
                e.currentTarget.setAttribute('aria-checked', 'true');
                this.metodoPagoActivo = metodo;

                const efectivoSection = document.getElementById('efectivoSection');
                if (efectivoSection) {
                    efectivoSection.style.display = metodo === 'Efectivo' ? 'block' : 'none';
                    if (metodo === 'Efectivo') setTimeout(() => document.getElementById('efectivoRecibido')?.focus(), 100);
                }

                const btnProcesar = document.getElementById('btnProcesar');
                if (btnProcesar) btnProcesar.disabled = this.carrito.length === 0;

                this.mostrarNotificacion(`Método de pago: ${metodo}`, 'success');
            });
        });

        const efectivoInput = document.getElementById('efectivoRecibido');
        if (efectivoInput) {
            efectivoInput.addEventListener('input', () => this.calcularCambio());
            efectivoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.procesarVenta(); });
        }

        const btnProcesar = document.getElementById('btnProcesar');
        if (btnProcesar) btnProcesar.addEventListener('click', () => this.procesarVenta());

        const btnVaciar = document.createElement('button');
        btnVaciar.className = 'btn-vaciar-carrito';
        btnVaciar.innerHTML = '<i class="fas fa-trash-alt" aria-hidden="true"></i> Vaciar';
        btnVaciar.setAttribute('aria-label', 'Vaciar carrito completo');
        btnVaciar.style.display = 'none';

        const carritoHeader = document.querySelector('.carrito-header');
        if (carritoHeader) {
            carritoHeader.style.position = 'relative';
            carritoHeader.appendChild(btnVaciar);
            btnVaciar.addEventListener('click', () => {
                if (this.carrito.length > 0 && confirm('¿Está seguro de vaciar el carrito?')) this.vaciarCarrito();
            });
        }

        this.initResponsive();
    }

    async buscarPorCodigo(termino) {
        if (!termino || this.cargando) return;
        const terminoSanitizado = this.sanitizarEntrada(termino, 50);
        try {
            const response = await this.fetchConTimeout(
                this.apiUrl + '?accion=buscarPorCodigo&codigo=' + encodeURIComponent(terminoSanitizado)
            );
            const producto = await response.json();
            if (producto && producto.id) {
                await this.agregarAlCarrito(producto.id, 1);
            } else {
                await this.buscarSugerencias(terminoSanitizado);
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error en la búsqueda: ' + error.message, 'error');
        }
    }

    initResponsive() {
        document.querySelectorAll('.toggle-carrito-mobile, .toggle-menu-mobile').forEach(el => el.remove());

        const toggleCarrito = document.createElement('button');
        toggleCarrito.className = 'toggle-carrito-mobile';
        toggleCarrito.innerHTML = '<i class="fas fa-shopping-cart" aria-hidden="true"></i> <span>Ver Carrito</span>';
        toggleCarrito.setAttribute('aria-label', 'Abrir carrito de compras');
        document.body.appendChild(toggleCarrito);
        toggleCarrito.addEventListener('click', () => {
            document.querySelector('.carrito-panel')?.classList.add('visible');
        });

        const toggleMenu = document.createElement('button');
        toggleMenu.className = 'toggle-menu-mobile';
        toggleMenu.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i> <span>Menú</span>';
        toggleMenu.setAttribute('aria-label', 'Abrir menú');
        document.body.appendChild(toggleMenu);
        toggleMenu.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.toggle('mobile-visible');
        });

        document.addEventListener('click', (e) => {
            const carrito = document.querySelector('.carrito-panel');
            const toggle = document.querySelector('.toggle-carrito-mobile');
            if (carrito?.classList.contains('visible')) {
                if (!carrito.contains(e.target) && toggle && !toggle.contains(e.target)) {
                    carrito.classList.remove('visible');
                }
            }
        });

        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 992) {
                    document.querySelector('.sidebar')?.classList.remove('mobile-visible');
                }
            });
        });
    }

    agregarRippleEffect() {
        document.querySelectorAll('.metodo-pago-btn, .filtro-btn, .btn-procesar').forEach(button => {
            button.addEventListener('click', function (e) {
                if (getComputedStyle(this).position !== 'relative') {
                    this.style.position = 'relative';
                    this.style.overflow = 'hidden';
                }

                let ripple = this.querySelector('.ripple-effect');
                if (!ripple) {
                    ripple = document.createElement('span');
                    ripple.className = 'ripple-effect';
                    Object.assign(ripple.style, {
                        position: 'absolute',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.6)',
                        transform: 'scale(0)',
                        opacity: '1',
                        pointerEvents: 'none',
                        transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s linear'
                    });
                    this.appendChild(ripple);
                }

                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.offsetHeight;
                ripple.style.transform = 'scale(4)';
                ripple.style.opacity = '0';

                setTimeout(() => {
                    if (ripple?.parentNode) {
                        ripple.style.transform = 'scale(0)';
                        ripple.style.opacity = '1';
                    }
                }, 500);
            });
        });
    }

    iniciarBuscadorPredictivo() {
        const inputBusqueda = document.getElementById('codigoBarras');
        const sugerenciasDiv = document.getElementById('sugerencias');
        if (!inputBusqueda || !sugerenciasDiv) return;

        inputBusqueda.addEventListener('input', (e) => {
            const termino = e.target.value.trim();
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            if (termino.length < 2) {
                sugerenciasDiv.classList.remove('active');
                sugerenciasDiv.innerHTML = '';
                return;
            }
            this.debounceTimer = setTimeout(() => this.buscarSugerencias(termino), 300);
        });

        document.addEventListener('click', (e) => {
            if (!inputBusqueda.contains(e.target) && !sugerenciasDiv.contains(e.target)) {
                sugerenciasDiv.classList.remove('active');
            }
        });

        inputBusqueda.addEventListener('keydown', (e) => {
            const items = sugerenciasDiv.querySelectorAll('.sugerencia-item');
            if (items.length === 0) return;
            const activeItem = sugerenciasDiv.querySelector('.sugerencia-item.active');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!activeItem) { items[0].classList.add('active'); items[0].focus(); }
                else {
                    const next = activeItem.nextElementSibling;
                    if (next) { activeItem.classList.remove('active'); next.classList.add('active'); next.focus(); }
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!activeItem) { items[items.length - 1].classList.add('active'); items[items.length - 1].focus(); }
                else {
                    const prev = activeItem.previousElementSibling;
                    if (prev) { activeItem.classList.remove('active'); prev.classList.add('active'); prev.focus(); }
                }
            }
        });
    }

    calcularCambio() {
        const efectivoInput = document.getElementById('efectivoRecibido');
        const cambioEl = document.getElementById('cambio');
        if (!efectivoInput || !cambioEl) return;

        if (!efectivoInput.value) {
            cambioEl.textContent = '$0.00';
            cambioEl.style.color = 'var(--gray)';
            return;
        }

        const efectivo = parseFloat(efectivoInput.value) || 0;
        const totalEl = document.getElementById('total');
        const total = parseFloat(totalEl?.textContent.replace('$', '')) || 0;
        const cambio = efectivo - total;

        cambioEl.textContent = `$${cambio.toFixed(2)}`;
        if (efectivo <= 0) cambioEl.style.color = 'var(--gray)';
        else if (cambio >= 0) cambioEl.style.color = cambio === 0 ? 'var(--gray)' : 'var(--success)';
        else cambioEl.style.color = 'var(--danger)';
    }

    mostrarTicket(venta) {
        const modal = document.getElementById('modalTicket');
        const contenido = document.getElementById('ticketContenido');
        if (!modal || !contenido) return;

        const itemsHTML = venta.items.map(item => `
            <div class="ticket-item">
                <span>${item.cantidad}x ${this.escapeHTML(item.nombre)}</span>
                <span>$${parseFloat(item.subtotal).toFixed(2)}</span>
            </div>`).join('');

        let pagoHTML = '';
        if (venta.metodo_pago === 'Efectivo' && venta.efectivo_recibido) {
            pagoHTML = `
                <div class="ticket-item"><span>Efectivo:</span><span>$${venta.efectivo_recibido.toFixed(2)}</span></div>
                <div class="ticket-item"><span>Cambio:</span><span>$${(venta.cambio || 0).toFixed(2)}</span></div>`;
        }

        contenido.innerHTML = `
            <div style="font-family:monospace;font-size:.9rem;line-height:1.6;">
                <div style="text-align:center;font-weight:bold;margin-bottom:1rem;font-size:1.1rem;">
                    🎨 PINTUMEX<br>Punto de Venta
                </div>
                <div style="border-top:1px dashed #ccc;margin:.5rem 0;"></div>
                <div>Folio: <strong>${this.escapeHTML(venta.folio)}</strong></div>
                <div>Fecha: ${venta.fecha}</div>
                <div>Método: ${this.escapeHTML(venta.metodo_pago)}</div>
                <div style="border-top:1px dashed #ccc;margin:.5rem 0;"></div>
                ${itemsHTML}
                <div style="border-top:1px dashed #ccc;margin:.5rem 0;"></div>
                <div class="ticket-item" style="font-weight:bold;font-size:1.1rem;">
                    <span>TOTAL:</span><span>$${venta.total.toFixed(2)}</span>
                </div>
                ${pagoHTML}
                <div style="border-top:1px dashed #ccc;margin:.5rem 0;"></div>
                <div style="text-align:center;margin-top:1rem;color:var(--gray);">¡Gracias por su compra!</div>
            </div>`;

        modal.style.display = 'flex';
    }

    mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.createElement('div');
        const colores = { success: '#27AE60', error: '#E74C3C', warning: '#F39C12' };
        const iconos = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };

        notificacion.style.cssText = `
            position:fixed;top:20px;right:20px;padding:1rem 1.5rem;
            background:${colores[tipo] || '#333'};color:white;border-radius:8px;
            box-shadow:0 4px 20px rgba(0,0,0,.2);z-index:3000;
            animation:slideInRight .3s;display:flex;align-items:center;
            gap:1rem;font-weight:500;max-width:400px;min-width:300px;`;

        notificacion.innerHTML = `
            <i class="fas ${iconos[tipo] || 'fa-info-circle'}"></i>
            <span>${mensaje}</span>
            <button style="background:none;border:none;color:white;cursor:pointer;margin-left:auto;font-size:1.2rem;"
                aria-label="Cerrar">×</button>`;

        document.body.appendChild(notificacion);
        notificacion.querySelector('button')?.addEventListener('click', () => notificacion.remove());
        setTimeout(() => { if (notificacion.parentNode) notificacion.remove(); }, 4000);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pos = new POSSystem();
        window.pos.init();
    });
} else {
    window.pos = new POSSystem();
    window.pos.init();
}