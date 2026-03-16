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
    }

    async init() {
        console.log('Inicializando POSSystem...');
        
        this.startMeasure('init');
        
        this.cargarEventos();
        this.initResponsive();
        this.agregarRippleEffect();
        this.iniciarBuscadorPredictivo();
        this.initModulos();
        this.iniciarActualizacionAutomatica();
        this.configurarAtajosTeclado();
        this.initPerformanceOptimizations();

        await Promise.all([
            this.verificarConexionBD(),
            this.cargarProductosDesdeBD(),
            this.actualizarCarrito()
        ]);

        setTimeout(() => {
            document.getElementById('codigoBarras')?.focus();
        }, 100);

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
                console.warn(`⚠️ Operación lenta: ${label} tomó ${duration.toFixed(2)}ms`);
            }
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

        if (window.innerWidth <= 768 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.documentElement.classList.add('reduce-animations');
        }

        this.cache = new Map();
    }

    async cachedFetch(url, options = {}, ttl = 30000) {
        const key = url + JSON.stringify(options);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }

        const response = await fetch(url, options);
        const data = await response.json();
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        return data;
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
            
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                document.getElementById('codigoBarras')?.focus();
            }
        });
    }

    mostrarAyudaAtajos() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-contenido" style="max-width: 500px;">
                <h3 style="color: var(--primary); margin-bottom: 1.5rem;">
                    <i class="fas fa-keyboard"></i> Atajos de Teclado
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
                    <p><i class="fas fa-info-circle"></i> También puedes hacer clic en los productos para agregarlos al carrito</p>
                </div>
                
                <button onclick="this.closest('.modal').remove()" 
                        style="width: 100%; margin-top: 1.5rem; padding: 1rem; background: var(--primary); color: white; border: none; border-radius: var(--radius-md); cursor: pointer;">
                    <i class="fas fa-check"></i> Cerrar
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
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
                
                if (window.moduloCaja) {
                    window.moduloCaja.datosCaja = {
                        ...window.moduloCaja.datosCaja,
                        total_ventas_hoy: data.total_ventas_hoy,
                        ventas_hoy: data.ventas_hoy
                    };
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
                } else if (modulo === 'puntoventa') {
                    const posSection = document.querySelector('.escanner-section');
                    if (posSection) {
                        posSection.style.display = 'block';
                        this.verificarCajaAntesDeVender();
                        setTimeout(() => {
                            document.getElementById('codigoBarras')?.focus();
                        }, 100);
                    }
                }
            });
        });
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
            const response = await fetch(this.apiUrl + '?accion=getProductos');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.productos = data;
            
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
            const formData = new FormData();
            formData.append('accion', 'agregarCarrito');
            formData.append('producto_id', productoId);
            formData.append('cantidad', cantidad);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.carrito = data.carrito.items;
                
                requestAnimationFrame(() => {
                    this.renderizarCarrito(data.carrito);
                });
                
                this.mostrarNotificacion('✅ Producto agregado al carrito', 'success');
                
                document.getElementById('codigoBarras')?.focus();
            } else {
                if (data.message) {
                    if (data.message.includes('Stock insuficiente')) {
                        this.mostrarNotificacion(`❌ ${data.message}`, 'error');
                    } else {
                        this.mostrarNotificacion(`❌ ${data.message}`, 'error');
                    }
                } else {
                    this.mostrarNotificacion('❌ Error al agregar producto', 'error');
                }
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
            
            document.getElementById('codigoBarras').value = '';
        }
    }

    async buscarPorCodigo(termino) {
        if (!termino || this.cargando) return;
        
        try {
            const response = await fetch(this.apiUrl + '?accion=buscarPorCodigo&codigo=' + encodeURIComponent(termino));
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
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
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
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
                
                item.innerHTML = `
                    <div class="sugerencia-info">
                        <div class="sugerencia-nombre">${this.escapeHTML(producto.nombre)}</div>
                        <div class="sugerencia-descripcion">
                            <span class="sugerencia-codigo">${this.escapeHTML(producto.codigo_barras)}</span>
                            <span>${this.escapeHTML(producto.descripcion || '')}</span>
                        </div>
                        <div class="sugerencia-stock ${producto.stock_actual <= producto.stock_minimo ? 'stock-bajo-sugerencia' : ''}">
                            <i class="fas fa-box"></i> Stock: ${producto.stock_actual}
                        </div>
                    </div>
                    <div class="sugerencia-precio">$${parseFloat(producto.precio_venta).toFixed(2)}</div>
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
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
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
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
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
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
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
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
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
            const response = await fetch(this.apiUrl + '?accion=getProductosPorCategoria&categoria=' + encodeURIComponent(this.categoriaActiva));
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const productos = await response.json();
            
            requestAnimationFrame(() => {
                this.mostrarProductos(productos);
            });
            
        } catch (error) {
            console.error('Error filtrando:', error);
            this.mostrarNotificacion('Error al filtrar: ' + error.message, 'error');
        } finally {
            this.mostrarCargando(false);
            this.endMeasure('filtrarProductos');
        }
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
            
            if (efectivo === total) {
                this.mostrarNotificacion('💰 Pago exacto, cambio: $0.00', 'success');
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
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                const venta = {
                    folio: data.folio,
                    fecha: new Date().toLocaleString(),
                    items: [...this.carrito],
                    subtotal: total,
                    total: total,
                    metodo_pago: this.metodoPagoActivo,
                    efectivo_recibido: efectivoRecibido,
                    cambio: cambio
                };
                
                this.mostrarTicket(venta);
                
                if (this.metodoPagoActivo === 'Efectivo') {
                    if (cambio > 0) {
                        this.mostrarNotificacion(`✅ Venta procesada. Cambio: $${cambio.toFixed(2)}`, 'success');
                    } else {
                        this.mostrarNotificacion('✅ Venta procesada con pago exacto', 'success');
                    }
                } else {
                    this.mostrarNotificacion(`✅ Venta procesada con ${this.metodoPagoActivo}`, 'success');
                }
                
                setTimeout(() => {
                    this.cargarProductosDesdeBD();
                }, 100);
                
                this.carrito = [];
                this.renderizarCarrito({ items: [], subtotal: 0, total: 0 });
                
                this.metodoPagoActivo = null;
                document.querySelectorAll('.metodo-pago-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('efectivoSection').style.display = 'none';
                if (document.getElementById('efectivoRecibido')) {
                    document.getElementById('efectivoRecibido').value = '';
                }
                
                if (window.moduloCaja) {
                    window.moduloCaja.verificarEstadoCaja();
                    if (document.querySelector('.menu-item.active')?.dataset.modulo === 'caja') {
                        window.moduloCaja.actualizarUI();
                    }
                }
                
                document.getElementById('codigoBarras')?.focus();
            } else {
                if (data.message) {
                    if (data.message.includes('Stock insuficiente')) {
                        this.mostrarNotificacion(`❌ ${data.message}`, 'error');
                    } else {
                        this.mostrarNotificacion(`❌ ${data.message}`, 'error');
                    }
                } else {
                    this.mostrarNotificacion('❌ Error al procesar venta', 'error');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('❌ Error de conexión: ' + error.message, 'error');
        } finally {
            this.cargando = false;
            this.endMeasure('procesarVenta');
        }
    }

    mostrarProductos(productos) {
        const grid = document.getElementById('productosGrid');
        if (!grid) return;
        
        if (productos.length === 0) {
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
            
            let stockClass = 'stock';
            let stockText = `${producto.stock_actual} disponibles`;
            
            if (producto.stock_actual <= 0) {
                stockClass += ' stock-agotado';
                stockText = '❌ AGOTADO';
            } else if (producto.stock_actual <= producto.stock_minimo) {
                stockClass += ' stock-bajo';
                stockText = `⚠️ Quedan ${producto.stock_actual}`;
            }
            
            card.innerHTML = `
                <h3>${this.escapeHTML(producto.nombre)}</h3>
                <div class="precio">$${parseFloat(producto.precio_venta).toFixed(2)}</div>
                <div class="${stockClass}">
                    <i class="fas fa-box"></i> ${stockText}
                </div>
                <small>${this.escapeHTML(producto.descripcion || '')}</small>
            `;
            
            if (producto.stock_actual <= 0) {
                card.style.opacity = '0.5';
                card.style.cursor = 'not-allowed';
                card.title = 'Producto sin stock';
            }
            
            fragment.appendChild(card);
        });
        
        grid.innerHTML = '';
        grid.appendChild(fragment);
        
        grid.querySelectorAll('.producto-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const producto = productos.find(p => p.id == id);
                
                if (producto && producto.stock_actual <= 0) {
                    this.mostrarNotificacion('❌ No hay stock disponible de este producto', 'error');
                    return;
                }
                
                if (id) this.agregarAlCarrito(parseInt(id));
            });
            
            card.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const id = card.dataset.id;
                    const producto = productos.find(p => p.id == id);
                    
                    if (producto && producto.stock_actual <= 0) {
                        this.mostrarNotificacion('❌ No hay stock disponible de este producto', 'error');
                        return;
                    }
                    
                    if (id) this.agregarAlCarrito(parseInt(id));
                }
            });
            
            card.addEventListener('touchstart', () => {
                card.style.transform = 'scale(0.98)';
            }, { passive: true });
            
            card.addEventListener('touchend', () => {
                card.style.transform = '';
            }, { passive: true });
        });
    }

    renderizarCarrito(data) {
        const container = document.getElementById('carritoItems');
        if (!container) return;
        
        if (data.items.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--gray);">
                    <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>Carrito vacío</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Agregue productos para comenzar</p>
                </div>
            `;
            
            const btnVaciar = document.querySelector('.btn-vaciar-carrito');
            if (btnVaciar) btnVaciar.style.display = 'none';
        } else {
            const fragment = document.createDocumentFragment();
            
            data.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'carrito-item';
                
                itemDiv.innerHTML = `
                    <div class="item-info">
                        <h4>${this.escapeHTML(item.nombre)}</h4>
                        <p>${this.escapeHTML(item.descripcion || '')}</p>
                        <div class="cantidad-control">
                            <button onclick="pos.modificarCantidad(${item.id}, ${item.cantidad - 1})" 
                                    ${item.cantidad <= 1 ? 'disabled' : ''}
                                    aria-label="Disminuir cantidad">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" value="${item.cantidad}" min="1" max="${item.stock}" 
                                   onchange="pos.modificarCantidad(${item.id}, parseInt(this.value) || 1)"
                                   aria-label="Cantidad">
                            <button onclick="pos.modificarCantidad(${item.id}, ${item.cantidad + 1})" 
                                    ${item.cantidad >= item.stock ? 'disabled' : ''}
                                    aria-label="Aumentar cantidad">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="item-precio">
                        <div class="precio">$${parseFloat(item.precio).toFixed(2)}</div>
                        <small>$${parseFloat(item.subtotal).toFixed(2)}</small>
                        <button onclick="pos.eliminarDelCarrito(${item.id})" 
                                style="background: none; border: none; color: var(--danger); cursor: pointer; margin-top: 0.3rem;"
                                aria-label="Eliminar producto">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                fragment.appendChild(itemDiv);
            });
            
            container.innerHTML = '';
            container.appendChild(fragment);
            
            const btnVaciar = document.querySelector('.btn-vaciar-carrito');
            if (btnVaciar) btnVaciar.style.display = 'flex';
        }
        
        document.getElementById('subtotal').textContent = `$${parseFloat(data.subtotal).toFixed(2)}`;
        document.getElementById('total').textContent = `$${parseFloat(data.total).toFixed(2)}`;
        
        const btnProcesar = document.getElementById('btnProcesar');
        if (btnProcesar) {
            btnProcesar.disabled = data.items.length === 0;
        }
        
        this.calcularCambio();
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
                });
                
                e.currentTarget.classList.add('active');
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
        
        const btnVaciar = document.createElement('button');
        btnVaciar.className = 'btn-vaciar-carrito';
        btnVaciar.innerHTML = '<i class="fas fa-trash-alt"></i> Vaciar';
        
        const carritoHeader = document.querySelector('.carrito-header');
        if (carritoHeader) {
            carritoHeader.style.position = 'relative';
            carritoHeader.appendChild(btnVaciar);
            
            btnVaciar.addEventListener('click', () => {
                if (this.carrito.length > 0) {
                    if (confirm('¿Está seguro de vaciar el carrito?')) {
                        this.vaciarCarrito();
                    }
                }
            });
        }
        
        this.initResponsive();
    }

    initResponsive() {
        document.querySelectorAll('.toggle-carrito-mobile, .toggle-menu-mobile').forEach(el => el.remove());
        
        const toggleCarrito = document.createElement('button');
        toggleCarrito.className = 'toggle-carrito-mobile';
        toggleCarrito.innerHTML = '<i class="fas fa-shopping-cart"></i> <span>Ver Carrito</span>';
        document.body.appendChild(toggleCarrito);
        
        toggleCarrito.addEventListener('click', () => {
            document.querySelector('.carrito-panel').classList.add('visible');
        });
        
        const toggleMenu = document.createElement('button');
        toggleMenu.className = 'toggle-menu-mobile';
        toggleMenu.innerHTML = '<i class="fas fa-bars"></i> <span>Menú</span>';
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
        btnImprimir.innerHTML = '<i class="fas fa-print"></i> Imprimir';
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
        
        btnImprimir.onclick = () => {
            window.print();
        };
        
        contenido.appendChild(btnImprimir);
    }

    mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion notificacion-${tipo}`;
        
        let icono = '';
        if (tipo === 'success') icono = 'fa-check-circle';
        else if (tipo === 'error') icono = 'fa-exclamation-circle';
        else if (tipo === 'warning') icono = 'fa-exclamation-triangle';
        
        notificacion.innerHTML = `
            <i class="fas ${icono}"></i>
            <span style="flex: 1;">${mensaje}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; opacity: 0.7; margin-left: 0.5rem;">
                <i class="fas fa-times"></i>
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
            animation: slideInRight 0.3s, pulse 2s infinite;
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
        }, 2000);
    }
}

class PerformanceOptimizer {
    constructor() {
        this.init();
    }
    
    init() {
        this.initLazyLoading();
        this.initMemoryManagement();
        this.initScrollOptimization();
    }
    
    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
    
    initMemoryManagement() {
        window.addEventListener('beforeunload', () => {
            if (window.pos) {
                window.pos = null;
            }
            if (window.moduloCaja) {
                window.moduloCaja = null;
            }
        });
    }
    
    initScrollOptimization() {
        let ticking = false;
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pos = new POSSystem();
        window.pos.init();
        window.performanceOptimizer = new PerformanceOptimizer();
    });
} else {
    window.pos = new POSSystem();
    window.pos.init();
    window.performanceOptimizer = new PerformanceOptimizer();
}

setTimeout(() => {
    const menuActivo = document.querySelector('.menu-item.active');
    if (menuActivo && menuActivo.dataset.modulo === 'caja' && window.moduloCaja) {
        window.moduloCaja.mostrarModulo();
    }
}, 600);