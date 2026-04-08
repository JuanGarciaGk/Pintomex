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
    }

    async init() {
        console.log('Inicializando POSSystem...');
        this.startMeasure('init');
        this.cargarEventos();
        this.initResponsive();
        this.initPerformanceOptimizations();
        this.initScanner();
        this.iniciarCategorias();
        
        await this.cargarProductosDesdeBD();
        await this.actualizarCarrito();
        await this.verificarConexionBD();
        
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
            delete this.metrics[label];
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
    }

    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const card = entry.target;
                        if (card.dataset.loaded !== 'true') {
                            card.dataset.loaded = 'true';
                        }
                        this.observer?.unobserve(card);
                    }
                });
            }, { rootMargin: '50px' });
        }
    }

    iniciarCategorias() {
        const filtrosContainer = document.getElementById('filtrosCategoria');
        if (!filtrosContainer) return;
        
        filtrosContainer.innerHTML = '';
        
        const btnTodas = document.createElement('button');
        btnTodas.className = 'filtro-btn active';
        btnTodas.textContent = 'Todas';
        btnTodas.setAttribute('data-categoria', 'Todas');
        filtrosContainer.appendChild(btnTodas);
        
        this.categorias.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filtro-btn';
            btn.textContent = cat;
            btn.setAttribute('data-categoria', cat);
            btn.setAttribute('aria-label', `Filtrar por categoría ${cat}`);
            filtrosContainer.appendChild(btn);
        });
        
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.categoriaActiva = e.target.textContent;
                this.filtrarProductos();
            });
        });
    }

    initScanner() {
        let lastKeyTime = 0;
        
        document.addEventListener('keypress', (e) => {
            if (!this.scannerActive) return;
            if (e.target && e.target.tagName === 'INPUT' && e.target.id === 'codigoBarras') return;
            
            const now = Date.now();
            const timeDiff = now - lastKeyTime;
            
            if (timeDiff > 100 && this.scannerBuffer.length > 0) {
                this.scannerBuffer = '';
            }
            
            lastKeyTime = now;
            
            if (e.key.length === 1 && (e.key.match(/[a-zA-Z0-9]/) || e.key === '-')) {
                this.scannerBuffer += e.key;
                
                if (this.scannerTimeout) clearTimeout(this.scannerTimeout);
                
                this.scannerTimeout = setTimeout(async () => {
                    if (this.scannerBuffer.length >= 4) {
                        await this.buscarPorCodigoEscanner(this.scannerBuffer);
                    }
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
        
        const inputBusqueda = document.getElementById('codigoBarras');
        if (inputBusqueda) {
            inputBusqueda.value = codigo;
        }
        
        try {
            const response = await fetch(this.apiUrl + '?accion=buscarPorCodigo&codigo=' + encodeURIComponent(codigo));
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const producto = await response.json();
            
            if (producto && producto.id) {
                await this.agregarAlCarrito(producto.id, 1);
                if (inputBusqueda) {
                    inputBusqueda.value = '';
                    inputBusqueda.focus();
                }
                this.agregarEfectoFeedback('success');
            } else {
                this.mostrarNotificacion('❌ Producto no encontrado: ' + codigo, 'warning');
                if (inputBusqueda) {
                    inputBusqueda.classList.add('error');
                    setTimeout(() => inputBusqueda.classList.remove('error'), 500);
                }
                this.agregarEfectoFeedback('error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error en la búsqueda: ' + error.message, 'error');
        }
    }

    agregarEfectoFeedback(tipo) {
        const feedback = document.createElement('div');
        feedback.className = `scanner-feedback scanner-${tipo}`;
        feedback.innerHTML = tipo === 'success' ? 
            '<i class="fas fa-check-circle" aria-hidden="true"></i> Producto agregado' : 
            '<i class="fas fa-times-circle" aria-hidden="true"></i> Producto no encontrado';
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'polite');
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.classList.add('show');
            setTimeout(() => {
                feedback.classList.remove('show');
                setTimeout(() => {
                    if (document.body.contains(feedback)) {
                        document.body.removeChild(feedback);
                    }
                }, 300);
            }, 1500);
        }, 10);
    }

    async cachedFetch(url, options = {}, ttl = 30000) {
        const key = url + JSON.stringify(options);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            this.cache.set(key, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('Error en cachedFetch:', error);
            throw error;
        }
    }

    async obtenerCsrfToken() {
        const tokenMeta = document.querySelector('meta[name="csrf-token"]');
        if (tokenMeta) {
            return tokenMeta.getAttribute('content');
        }
        
        try {
            const response = await fetch(this.apiUrl + '?accion=getCsrfToken');
            const data = await response.json();
            if (data.success && data.token) {
                return data.token;
            }
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
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Timeout en la petición');
            }
            throw error;
        }
    }

    configurarAtajosTeclado() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                if (this.carrito.length > 0 && this.metodoPagoActivo) {
                    this.procesarVenta();
                }
            }
            
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                if (this.carrito.length > 0) {
                    if (confirm('¿Está seguro de vaciar el carrito?')) {
                        this.vaciarCarrito();
                    }
                }
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
            
            if (e.key === 'F1') {
                e.preventDefault();
                this.mostrarAyudaAtajos();
            }
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
            <div class="modal-contenido" style="max-width: 500px;">
                <h3 style="color: var(--primary); margin-bottom: 1.5rem;">
                    <i class="fas fa-keyboard" aria-hidden="true"></i> Atajos de Teclado
                </h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><strong>Enter</strong> en búsqueda</div><div>Agregar producto</div>
                    <div><strong>Ctrl + P</strong></div><div>Procesar venta</div>
                    <div><strong>Ctrl + L</strong></div><div>Limpiar carrito</div>
                    <div><strong>Ctrl + B</strong></div><div>Enfocar búsqueda</div>
                    <div><strong>Escape</strong></div><div>Limpiar búsqueda</div>
                    <div><strong>Flechas ↑↓</strong></div><div>Navegar sugerencias</div>
                    <div><strong>F1</strong></div><div>Mostrar ayuda</div>
                </div>
                
                <div style="margin-top: 2rem; padding: 1rem; background: var(--light); border-radius: var(--radius-md);">
                    <p><i class="fas fa-info-circle" aria-hidden="true"></i> También puedes hacer clic en los productos para agregarlos al carrito</p>
                </div>
                
                <button class="btn-cerrar-atajos" 
                        style="width: 100%; margin-top: 1.5rem; padding: 1rem; background: var(--primary); color: white; border: none; border-radius: var(--radius-md); cursor: pointer;">
                    <i class="fas fa-check" aria-hidden="true"></i> Cerrar
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.btn-cerrar-atajos').addEventListener('click', () => {
            modal.remove();
        });
    }

    iniciarActualizacionAutomatica() {
        setInterval(() => {
            const menuActivo = document.querySelector('.menu-item.active');
            if (menuActivo && menuActivo.dataset.modulo === 'caja' && window.moduloCaja) {
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
                    const cajaMenuItem = document.querySelector('.menu-item[data-modulo="caja"]');
                    if (cajaMenuItem) {
                        cajaMenuItem.click();
                    }
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

    initModulos() {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const modulo = e.currentTarget.dataset.modulo;
                
                document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                document.querySelectorAll('.contenido-principal > section').forEach(s => s.style.display = 'none');
                
                if (modulo === 'caja') {
                    if (window.moduloCaja) {
                        window.moduloCaja.mostrarModulo();
                    }
                    this.actualizarPanelLateral('caja');
                } else if (modulo === 'puntoventa') {
                    const posSection = document.querySelector('.escanner-section');
                    if (posSection) {
                        posSection.style.display = 'block';
                        this.verificarCajaAntesDeVender();
                        this.recargarProductos();
                        setTimeout(() => {
                            document.getElementById('codigoBarras')?.focus();
                        }, 100);
                    }
                    this.actualizarPanelLateral('puntoventa');
<<<<<<< HEAD
                    this.mostrarProductos(this.productos);
=======
>>>>>>> 0dc2d518a8ffa91d73824a41643e9a1605017af2
                } else if (modulo === 'productos') {
                    if (window.moduloProductos) {
                        window.moduloProductos.mostrarModulo();
                    }
                    this.actualizarPanelLateral('productos');
                }
            });
            
            item.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.click();
                }
            });
        });
    }

    actualizarPanelLateral(modulo) {
        const panelContent = document.getElementById('panelContent');
        if (!panelContent) return;
        
        if (modulo === 'puntoventa') {
            panelContent.innerHTML = `
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
            `;
            
            this.cargarEventosCarrito();
            this.actualizarCarrito();
            
        } else if (modulo === 'productos') {
            if (window.moduloCambios) {
                window.moduloCambios.mostrarModulo();
            }
        }
    }

    cargarEventosCarrito() {
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
                    
                    if (metodo === 'Efectivo') {
                        setTimeout(() => {
                            document.getElementById('efectivoRecibido')?.focus();
                        }, 100);
                    }
                }
                
                const btnProcesar = document.getElementById('btnProcesar');
                if (btnProcesar) {
                    btnProcesar.disabled = this.carrito.length === 0;
                }
                
                this.mostrarNotificacion(`Método de pago: ${metodo}`, 'success');
            });
        });
        
        const efectivoInput = document.getElementById('efectivoRecibido');
        if (efectivoInput) {
            efectivoInput.addEventListener('input', () => {
                this.calcularCambio();
            });
            
            efectivoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.procesarVenta();
                }
            });
        }
        
        const btnProcesar = document.getElementById('btnProcesar');
        if (btnProcesar) {
            btnProcesar.addEventListener('click', () => {
                this.procesarVenta();
            });
        }
        
        const btnVaciar = document.querySelector('.btn-vaciar-carrito');
        if (btnVaciar) {
            btnVaciar.addEventListener('click', () => {
                if (this.carrito.length > 0) {
                    if (confirm('¿Está seguro de vaciar el carrito?')) {
                        this.vaciarCarrito();
                    }
                }
            });
        }
    }

    async verificarConexionBD() {
        try {
            const response = await fetch(this.apiUrl + '?accion=getProductos');
            if (!response.ok) throw new Error('Error de conexión');
            const data = await response.json();
            console.log('✅ Conexión exitosa a la BD, productos cargados:', data.length);
        } catch (error) {
            console.error('❌ Error conectando a la BD:', error);
            this.mostrarNotificacion('Error de conexión con la base de datos', 'error');
        }
    }

    async cargarProductosDesdeBD() {
        this.startMeasure('cargarProductos');
        this.mostrarCargando(true);
        
        try {
            const url = this.apiUrl + '?accion=getProductos&_t=' + Date.now();
            const response = await fetch(url);
            const data = await response.json();
            
            console.log('Productos recibidos:', data);
            
            if (data && Array.isArray(data)) {
                this.productos = data;
            } else if (data && data.success && Array.isArray(data.productos)) {
                this.productos = data.productos;
            } else if (data && data.success && data.data && Array.isArray(data.data)) {
                this.productos = data.data;
            } else {
                this.productos = [];
                console.error('Formato de respuesta inesperado:', data);
            }
            
            requestAnimationFrame(() => {
                this.mostrarCargando(false);
                this.mostrarProductos(this.productos);
                if (this.productos.length > 0) {
                    this.mostrarNotificacion(`📦 ${this.productos.length} productos cargados`, 'success');
                } else {
                    this.mostrarNotificacion('⚠️ No hay productos en la base de datos', 'warning');
                }
            });
            
        } catch (error) {
            console.error('Error cargando productos:', error);
            this.mostrarNotificacion('Error al cargar productos: ' + error.message, 'error');
            this.mostrarCargando(false);
            const grid = document.getElementById('productosGrid');
            if (grid) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--danger);">❌ Error al cargar productos. Verifique la conexión.</div>';
            }
        } finally {
            this.endMeasure('cargarProductos');
        }
    }

<<<<<<< HEAD
    actualizarVistaProductos() {
        const seccionPuntoVenta = document.getElementById('seccionPuntoVenta');
        const moduloVisible = seccionPuntoVenta && seccionPuntoVenta.style.display !== 'none';
        
        if (moduloVisible && this.productos.length > 0) {
            if (this.categoriaActiva && this.categoriaActiva !== 'Todas') {
                const productosFiltrados = this.productos.filter(p => p.categoria === this.categoriaActiva);
                this.mostrarProductos(productosFiltrados);
            } else {
                this.mostrarProductos(this.productos);
=======
    async recargarProductos() {
        try {
            const url = this.apiUrl + '?accion=getProductos&_t=' + Date.now();
            const response = await fetch(url);
            const data = await response.json();
            
            this.productos = data;
            
            const categoriaActivaActual = this.categoriaActiva;
            const moduloVisible = document.getElementById('seccionPuntoVenta')?.style.display === 'block';
            
            if (moduloVisible) {
                await this.filtrarProductos();
                this.categoriaActiva = categoriaActivaActual;
                
                const filtros = document.querySelectorAll('.filtro-btn');
                filtros.forEach(btn => {
                    if (btn.textContent === categoriaActivaActual) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
            
            const carritoActual = this.carrito;
            if (carritoActual && carritoActual.length > 0) {
                for (const item of carritoActual) {
                    const productoActualizado = this.productos.find(p => p.id === item.id);
                    if (productoActualizado) {
                        const cantidadCarrito = item.cantidad;
                        if (cantidadCarrito > productoActualizado.stock_actual) {
                            await this.modificarCantidad(item.id, productoActualizado.stock_actual);
                            this.mostrarNotificacion(`⚠️ Stock de "${productoActualizado.nombre}" reducido a ${productoActualizado.stock_actual}`, 'warning');
                        }
                    }
                }
>>>>>>> 0dc2d518a8ffa91d73824a41643e9a1605017af2
            }
            
            if (window.moduloProductos) {
                window.moduloProductos.cargarProductos();
            }
        } catch (error) {
            console.error('Error recargando productos:', error);
        }
    }
<<<<<<< HEAD

    async recargarProductos() {
        try {
            const url = this.apiUrl + '?accion=getProductos&_t=' + Date.now();
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && Array.isArray(data)) {
                this.productos = data;
            } else if (data && data.success && Array.isArray(data.productos)) {
                this.productos = data.productos;
            } else if (data && data.success && data.data && Array.isArray(data.data)) {
                this.productos = data.data;
            } else {
                this.productos = [];
            }
            
            this.actualizarVistaProductos();
            
            const carritoActual = this.carrito;
            if (carritoActual && carritoActual.length > 0) {
                let carritoModificado = false;
                for (const item of carritoActual) {
                    const productoActualizado = this.productos.find(p => p.id === item.id);
                    if (productoActualizado) {
                        const cantidadCarrito = item.cantidad;
                        if (cantidadCarrito > productoActualizado.stock_actual) {
                            await this.modificarCantidad(item.id, productoActualizado.stock_actual);
                            this.mostrarNotificacion(`⚠️ Stock de "${productoActualizado.nombre}" reducido a ${productoActualizado.stock_actual}`, 'warning');
                            carritoModificado = true;
                        }
                        if (window.pos && window.pos.carrito) {
                            const carritoItem = window.pos.carrito.find(i => i.id === item.id);
                            if (carritoItem) {
                                carritoItem.stock = productoActualizado.stock_actual;
                            }
                        }
                    }
                }
                if (!carritoModificado) {
                    await this.actualizarCarrito();
                }
            }
            
            if (window.moduloProductos) {
                window.moduloProductos.cargarProductos();
            }
            
            const cacheKey = this.apiUrl + '?accion=getProductos';
            this.cache.delete(cacheKey);
            
        } catch (error) {
            console.error('Error recargando productos:', error);
        }
    }
=======
>>>>>>> 0dc2d518a8ffa91d73824a41643e9a1605017af2

    mostrarCargando(mostrar) {
        const grid = document.getElementById('productosGrid');
        if (!grid) return;
        
        if (mostrar) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <div class="spinner"></div>
                    <p style="margin-top: 1rem; color: var(--gray);">Cargando productos...</p>
                </div>
            `;
            
            if (!document.getElementById('spinner-style')) {
                const style = document.createElement('style');
                style.id = 'spinner-style';
                style.textContent = `
                    .spinner {
                        width: 50px;
                        height: 50px;
                        border: 5px solid var(--light);
                        border-top-color: var(--secondary);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `;
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
            const productoActualizado = this.productos.find(p => p.id === productoId);
            if (!productoActualizado) {
                this.mostrarNotificacion('❌ Producto no encontrado', 'error');
                this.cargando = false;
                return;
            }
            
            if (productoActualizado.stock_actual < cantidad) {
                this.mostrarNotificacion(`❌ Stock insuficiente. Disponible: ${productoActualizado.stock_actual}`, 'error');
                this.cargando = false;
                return;
            }
            
            const formData = new FormData();
            formData.append('accion', 'agregarCarrito');
            formData.append('producto_id', productoId);
            formData.append('cantidad', cantidad);
            
            const response = await this.postWithCsrf(this.apiUrl, formData);
            const data = await response.json();
            
            if (data.success) {
                this.carrito = data.carrito.items;
                requestAnimationFrame(() => {
                    this.renderizarCarrito(data.carrito);
                });
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
            if (sugerencias) {
                sugerencias.classList.remove('active');
                sugerencias.innerHTML = '';
            }
            
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
            const response = await fetch(this.apiUrl + '?accion=buscarProductos&termino=' + encodeURIComponent(termino));
            const productos = await response.json();
            
            if (productos.length === 0) {
                sugerenciasDiv.innerHTML = '<div class="sugerencia-item" style="justify-content: center;">No se encontraron productos</div>';
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
                    <div class="sugerencia-precio">$${parseFloat(producto.precio).toFixed(2)}</div>
                `;
                
                fragment.appendChild(item);
            });
            
            sugerenciasDiv.innerHTML = '';
            sugerenciasDiv.appendChild(fragment);
            sugerenciasDiv.classList.add('active');
            
            sugerenciasDiv.querySelectorAll('.sugerencia-item').forEach(item => {
                item.addEventListener('click', () => {
                    const productoId = item.dataset.id;
                    if (productoId) {
                        this.agregarAlCarrito(parseInt(productoId));
                    }
                });
                
                item.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const productoId = item.dataset.id;
                        if (productoId) {
                            this.agregarAlCarrito(parseInt(productoId));
                        }
                    }
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
            const response = await fetch(this.apiUrl + '?accion=getCarrito');
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
            
            if (data.success === false && data.message && data.message.includes('Stock insuficiente')) {
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
            const url = this.apiUrl + '?accion=getProductosPorCategoria&categoria=' + encodeURIComponent(this.categoriaActiva) + '&_t=' + Date.now();
            const response = await fetch(url);
            const productos = await response.json();
            
            requestAnimationFrame(() => {
                this.mostrarCargando(false);
                this.mostrarProductos(productos);
            });
            
        } catch (error) {
            console.error('Error filtrando:', error);
            this.mostrarNotificacion('Error al filtrar: ' + error.message, 'error');
            this.mostrarCargando(false);
        } finally {
            this.endMeasure('filtrarProductos');
        }
    }

    mostrarProductos(productos) {
        const grid = document.getElementById('productosGrid');
        if (!grid) return;
        
        if (!productos || productos.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--gray);">No hay productos disponibles</div>';
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
                <small>${this.escapeHTML(producto.descripcion || '')}</small>
            `;
            
            fragment.appendChild(card);
        });
        
        grid.innerHTML = '';
        grid.appendChild(fragment);
        
        grid.querySelectorAll('.producto-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const productoId = card.dataset.id;
                if (productoId && card.getAttribute('aria-disabled') !== 'true') {
                    const producto = this.productos.find(p => p.id == productoId);
                    if (producto && producto.stock_actual > 0) {
                        this.agregarAlCarrito(parseInt(productoId));
                    } else if (producto) {
                        this.mostrarNotificacion('❌ No hay stock disponible de este producto', 'error');
                    }
                }
            });
            
            card.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const productoId = card.dataset.id;
                    if (productoId && card.getAttribute('aria-disabled') !== 'true') {
                        const producto = this.productos.find(p => p.id == productoId);
                        if (producto && producto.stock_actual > 0) {
                            this.agregarAlCarrito(parseInt(productoId));
                        }
                    }
                }
            });
        });
        
        if (this.observer) {
            grid.querySelectorAll('.producto-card').forEach(card => {
                this.observer.observe(card);
            });
        }
    }

    renderizarCarrito(data) {
        const container = document.getElementById('carritoItems');
        if (!container) return;
        
        const subtotal = parseFloat(data.subtotal) || 0;
        const total = parseFloat(data.total) || 0;
        
        if (!data.items || data.items.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--gray);">
                    <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;" aria-hidden="true"></i>
                    <p>Carrito vacío</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Agregue productos para comenzar</p>
                </div>
            `;
            
            const btnVaciar = document.querySelector('.btn-vaciar-carrito');
            if (btnVaciar) btnVaciar.style.display = 'none';
            
            const subtotalSpan = document.getElementById('subtotal');
            if (subtotalSpan) subtotalSpan.textContent = '$0.00';
            
            const totalSpan = document.getElementById('total');
            if (totalSpan) totalSpan.textContent = '$0.00';
            
            const btnProcesar = document.getElementById('btnProcesar');
            if (btnProcesar) {
                btnProcesar.disabled = true;
                btnProcesar.setAttribute('aria-disabled', 'true');
            }
            
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
                        <button class="btn-decrement" data-id="${item.id}" data-cantidad="${item.cantidad - 1}" ${item.cantidad <= 1 ? 'disabled' : ''} aria-label="Disminuir cantidad">
                            <i class="fas fa-minus" aria-hidden="true"></i>
                        </button>
                        <input type="number" value="${item.cantidad}" min="1" max="${item.stock}" class="cantidad-input" data-id="${item.id}" aria-label="Cantidad de ${item.nombre}">
                        <button class="btn-increment" data-id="${item.id}" data-cantidad="${item.cantidad + 1}" ${item.cantidad >= item.stock ? 'disabled' : ''} aria-label="Aumentar cantidad">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                <div class="item-precio">
                    <div class="precio">$${parseFloat(item.precio).toFixed(2)}</div>
                    <small>$${parseFloat(item.subtotal).toFixed(2)}</small>
                    <button class="btn-eliminar" data-id="${item.id}" aria-label="Eliminar producto">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </div>
            `;
            fragment.appendChild(itemDiv);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
        const subtotalSpan = document.getElementById('subtotal');
        if (subtotalSpan) subtotalSpan.textContent = `$${subtotal.toFixed(2)}`;
        
        const totalSpan = document.getElementById('total');
        if (totalSpan) totalSpan.textContent = `$${total.toFixed(2)}`;
        
        const btnProcesar = document.getElementById('btnProcesar');
        if (btnProcesar) {
            btnProcesar.disabled = false;
            btnProcesar.setAttribute('aria-disabled', 'false');
        }
        
        const btnVaciar = document.querySelector('.btn-vaciar-carrito');
        if (btnVaciar) btnVaciar.style.display = 'flex';
        
        this.calcularCambio();
        
        container.querySelectorAll('.btn-decrement, .btn-increment, .btn-eliminar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (btn.classList.contains('btn-decrement')) {
                    this.modificarCantidad(id, parseInt(btn.dataset.cantidad));
                } else if (btn.classList.contains('btn-increment')) {
                    this.modificarCantidad(id, parseInt(btn.dataset.cantidad));
                } else if (btn.classList.contains('btn-eliminar')) {
                    this.eliminarDelCarrito(id);
                }
            });
        });
        
        container.querySelectorAll('.cantidad-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = parseInt(input.dataset.id);
                const cantidad = parseInt(input.value) || 1;
                this.modificarCantidad(id, cantidad);
            });
        });
    }

    async procesarVenta() {
        const cajaAbierta = await this.verificarCajaAntesDeVender();
        if (!cajaAbierta) return;
        
        if (this.carrito.length === 0) {
            this.mostrarNotificacion('❌ El carrito está vacío', 'warning');
            return;
        }
        
        if (!this.metodoPagoActivo) {
            this.mostrarNotificacion('❌ Seleccione un método de pago', 'warning');
            return;
        }
        
        this.startMeasure('procesarVenta');
        
        if (this.metodoPagoActivo === 'Efectivo') {
            const efectivoInput = document.getElementById('efectivoRecibido');
            const efectivo = parseFloat(efectivoInput?.value);
            const total = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
            
            if (!efectivoInput?.value || efectivoInput.value.trim() === '') {
                this.mostrarNotificacion('⚠️ Ingrese la cantidad de efectivo recibido', 'warning');
                efectivoInput.focus();
                efectivoInput.style.borderColor = 'var(--danger)';
                setTimeout(() => {
                    efectivoInput.style.borderColor = 'var(--light)';
                }, 2000);
                return;
            }
            
            if (isNaN(efectivo) || efectivo <= 0) {
                this.mostrarNotificacion('❌ La cantidad de efectivo no es válida', 'error');
                efectivoInput.focus();
                efectivoInput.style.borderColor = 'var(--danger)';
                efectivoInput.value = '';
                setTimeout(() => {
                    efectivoInput.style.borderColor = 'var(--light)';
                }, 2000);
                return;
            }
            
            if (efectivo < total) {
                const faltante = total - efectivo;
                this.mostrarNotificacion(`❌ Efectivo insuficiente. Faltan: $${faltante.toFixed(2)}`, 'error');
                efectivoInput.focus();
                efectivoInput.style.borderColor = 'var(--danger)';
                setTimeout(() => {
                    efectivoInput.style.borderColor = 'var(--light)';
                }, 2000);
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
                    if (cambio > 0) {
                        this.mostrarNotificacion(`✅ Venta procesada. Cambio: $${cambio.toFixed(2)}`, 'success');
                    } else {
                        this.mostrarNotificacion('✅ Venta procesada con pago exacto', 'success');
                    }
                } else {
                    this.mostrarNotificacion(`✅ Venta procesada con ${this.metodoPagoActivo}`, 'success');
                }
                
                const cacheKey = this.apiUrl + '?accion=getProductos';
                this.cache.delete(cacheKey);
                
                await this.cargarProductosDesdeBD();
                
                this.carrito = [];
                
                const vaciarFormData = new FormData();
                vaciarFormData.append('accion', 'vaciarCarrito');
                await this.postWithCsrf(this.apiUrl, vaciarFormData);
                
                const carritoVacio = { items: [], subtotal: 0, total: 0 };
                this.renderizarCarrito(carritoVacio);
                
                this.metodoPagoActivo = null;
                document.querySelectorAll('.metodo-pago-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-checked', 'false');
                });
                
                const efectivoSection = document.getElementById('efectivoSection');
                if (efectivoSection) {
                    efectivoSection.style.display = 'none';
                }
                
                const efectivoRecibidoInput = document.getElementById('efectivoRecibido');
                if (efectivoRecibidoInput) {
                    efectivoRecibidoInput.value = '';
                }
                
                const cambioSpan = document.getElementById('cambio');
                if (cambioSpan) {
                    cambioSpan.textContent = '$0.00';
                    cambioSpan.style.color = 'var(--gray)';
                }
                
                const subtotalSpan = document.getElementById('subtotal');
                if (subtotalSpan) {
                    subtotalSpan.textContent = '$0.00';
                }
                
                const totalSpan = document.getElementById('total');
                if (totalSpan) {
                    totalSpan.textContent = '$0.00';
                }
                
                const btnProcesar = document.getElementById('btnProcesar');
                if (btnProcesar) {
                    btnProcesar.disabled = true;
                    btnProcesar.setAttribute('aria-disabled', 'true');
                }
                
                const btnVaciar = document.querySelector('.btn-vaciar-carrito');
                if (btnVaciar) {
                    btnVaciar.style.display = 'none';
                }
                
                if (window.moduloCaja) {
                    window.moduloCaja.verificarEstadoCaja();
                    if (document.querySelector('.menu-item.active')?.dataset.modulo === 'caja') {
                        window.moduloCaja.actualizarUI();
                    }
                }
                
                const inputBusqueda = document.getElementById('codigoBarras');
                if (inputBusqueda) {
                    inputBusqueda.value = '';
                    inputBusqueda.focus();
                }
                
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
                        const productoId = activeItem.dataset.id;
                        if (productoId) {
                            this.agregarAlCarrito(parseInt(productoId));
                        }
                    } else {
                        this.buscarPorCodigo(e.target.value);
                    }
                }
            });
        }
        
<<<<<<< HEAD
=======
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.categoriaActiva = e.target.textContent;
                this.filtrarProductos();
            });
        });
        
>>>>>>> 0dc2d518a8ffa91d73824a41643e9a1605017af2
        this.initResponsive();
    }

    async buscarPorCodigo(termino) {
        if (!termino || this.cargando) return;
        
        try {
            const response = await fetch(this.apiUrl + '?accion=buscarPorCodigo&codigo=' + encodeURIComponent(termino));
            const producto = await response.json();
            
            if (producto && producto.id) {
                await this.agregarAlCarrito(producto.id, 1);
            } else {
                await this.buscarSugerencias(termino);
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
            document.querySelector('.carrito-panel').classList.add('visible');
        });
        
        const toggleMenu = document.createElement('button');
        toggleMenu.className = 'toggle-menu-mobile';
        toggleMenu.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i> <span>Menú</span>';
        toggleMenu.setAttribute('aria-label', 'Abrir menú');
        document.body.appendChild(toggleMenu);
        
        toggleMenu.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('mobile-visible');
        });
        
        document.addEventListener('click', (e) => {
            const carrito = document.querySelector('.carrito-panel');
            const toggle = document.querySelector('.toggle-carrito-mobile');
            
            if (carrito && carrito.classList.contains('visible')) {
                if (!carrito.contains(e.target) && !toggle.contains(e.target)) {
                    carrito.classList.remove('visible');
                }
            }
        });
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 992) {
                    document.querySelector('.sidebar').classList.remove('mobile-visible');
                }
            });
        });
    }

    agregarRippleEffect() {
        document.querySelectorAll('.metodo-pago-btn, .filtro-btn, .btn-procesar').forEach(button => {
            button.addEventListener('click', function(e) {
                if (getComputedStyle(this).position !== 'relative') {
                    this.style.position = 'relative';
                    this.style.overflow = 'hidden';
                }

                let ripple = this.querySelector('.ripple-effect');
                if (!ripple) {
                    ripple = document.createElement('span');
                    ripple.className = 'ripple-effect';
                    ripple.style.position = 'absolute';
                    ripple.style.borderRadius = '50%';
                    ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
                    ripple.style.transform = 'scale(0)';
                    ripple.style.opacity = '1';
                    ripple.style.pointerEvents = 'none';
                    ripple.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s linear';
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
                    if (ripple && ripple.parentNode) {
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
            
            this.debounceTimer = setTimeout(() => {
                this.buscarSugerencias(termino);
            }, 300);
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
                if (!activeItem) {
                    items[0].classList.add('active');
                    items[0].focus();
                } else {
                    const next = activeItem.nextElementSibling;
                    if (next) {
                        activeItem.classList.remove('active');
                        next.classList.add('active');
                        next.focus();
                    }
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!activeItem) {
                    items[items.length - 1].classList.add('active');
                    items[items.length - 1].focus();
                } else {
                    const prev = activeItem.previousElementSibling;
                    if (prev) {
                        activeItem.classList.remove('active');
                        prev.classList.add('active');
                        prev.focus();
                    }
                }
            }
        });
    }

    calcularCambio() {
        const efectivoInput = document.getElementById('efectivoRecibido');
        if (!efectivoInput) return;
        
        if (!efectivoInput.value || efectivoInput.value === '') {
            const cambioEl = document.getElementById('cambio');
            if (cambioEl) {
                cambioEl.textContent = '$0.00';
                cambioEl.style.color = 'var(--gray)';
            }
            return;
        }
        
        const efectivo = parseFloat(efectivoInput.value) || 0;
        const total = parseFloat(document.getElementById('total')?.textContent.replace('$', '')) || 0;
        const cambio = efectivo - total;
        
        const cambioEl = document.getElementById('cambio');
        if (cambioEl) {
            if (cambio >= 0 && efectivo > 0) {
                cambioEl.textContent = `$${cambio.toFixed(2)}`;
                cambioEl.style.color = cambio === 0 ? 'var(--gray)' : 'var(--success)';
            } else if (efectivo > 0) {
                cambioEl.textContent = `$${cambio.toFixed(2)}`;
                cambioEl.style.color = 'var(--danger)';
            } else {
                cambioEl.textContent = '$0.00';
                cambioEl.style.color = 'var(--gray)';
            }
        }
    }

    mostrarTicket(venta) {
        const modal = document.getElementById('modalTicket');
        const contenido = document.getElementById('ticketContenido');
        
        if (!modal || !contenido) return;
        
        const itemsHTML = venta.items.map(item => `
            <div class="ticket-item">
                <span>${item.cantidad}x ${this.escapeHTML(item.nombre)}</span>
                <span>$${parseFloat(item.subtotal).toFixed(2)}</span>
            </div>
        `).join('');
        
        let pagoHTML = '';
        if (venta.metodo_pago === 'Efectivo' && venta.efectivo_recibido) {
            pagoHTML = `
                <div class="ticket-item">
                    <span>Efectivo recibido:</span>
                    <span>$${parseFloat(venta.efectivo_recibido).toFixed(2)}</span>
                </div>
                <div class="ticket-item">
                    <span>Cambio:</span>
                    <span>$${parseFloat(venta.cambio).toFixed(2)}</span>
                </div>
            `;
        }
        
        contenido.innerHTML = `
            <div class="ticket">
                <div class="ticket-header">
                    <h2>🏪 Pintumex</h2>
                    <p>Punto de Venta</p>
                    <p>${venta.fecha}</p>
                    <p><strong>Folio: ${venta.folio}</strong></p>
                </div>
                <div class="ticket-body">
                    ${itemsHTML}
                </div>
                <div class="ticket-totales">
                    <div class="ticket-item">
                        <span>Subtotal:</span>
                        <span>$${parseFloat(venta.subtotal).toFixed(2)}</span>
                    </div>
                    ${pagoHTML}
                    <div class="ticket-item">
                        <span>Método de pago:</span>
                        <span>${venta.metodo_pago}</span>
                    </div>
                    <div class="ticket-item total">
                        <span>TOTAL:</span>
                        <span>$${parseFloat(venta.total).toFixed(2)}</span>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 2px dashed #ccc;">
                    <p>¡Gracias por su compra!</p>
                    <p style="font-size: 0.9rem; color: #666;">Vuelva pronto</p>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        const btnImprimir = document.createElement('button');
        btnImprimir.innerHTML = '<i class="fas fa-print" aria-hidden="true"></i> Imprimir';
        btnImprimir.style.cssText = `
            margin-top: 1rem;
            padding: 0.8rem;
            width: 100%;
            background: var(--secondary);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        `;
        btnImprimir.setAttribute('aria-label', 'Imprimir ticket');
        
        btnImprimir.onclick = () => {
            window.print();
        };
        
        contenido.appendChild(btnImprimir);
    }

    mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion notificacion-${tipo}`;
        notificacion.setAttribute('role', 'alert');
        notificacion.setAttribute('aria-live', 'assertive');
        
        let icono = '';
        if (tipo === 'success') icono = 'fa-check-circle';
        else if (tipo === 'error') icono = 'fa-exclamation-circle';
        else if (tipo === 'warning') icono = 'fa-exclamation-triangle';
        
        notificacion.innerHTML = `
            <i class="fas ${icono}" aria-hidden="true"></i>
            <span style="flex: 1;">${mensaje}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; opacity: 0.7; margin-left: 0.5rem;" aria-label="Cerrar notificación">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        `;
        
        const colores = {
            success: '#27AE60',
            error: '#E74C3C',
            warning: '#F39C12'
        };
        
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${colores[tipo] || '#333'};
            color: white;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            z-index: 3000;
            animation: slideInRight 0.3s;
            display: flex;
            align-items: center;
            gap: 1rem;
            font-weight: 500;
            max-width: 400px;
            min-width: 300px;
            border-left: 5px solid ${tipo === 'success' ? '#1e8449' : tipo === 'error' ? '#c0392b' : '#e67e22'};
        `;
        
        document.body.appendChild(notificacion);
        
        setTimeout(() => {
            if (document.body.contains(notificacion)) {
                notificacion.style.animation = 'fadeOut 0.3s';
                setTimeout(() => {
                    if (document.body.contains(notificacion)) {
                        document.body.removeChild(notificacion);
                    }
                }, 300);
            }
        }, 3000);
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.cache.clear();
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

window.addEventListener('beforeunload', () => {
    if (window.pos) {
        window.pos.destroy();
    }
});