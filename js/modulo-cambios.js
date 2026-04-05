// modulo-cambios.js - Versión corregida con lógica de diferencias correcta

class ModuloCambios {
    constructor() {
        this.apiUrl = 'php/api.php';
        this.ventaSeleccionada = null;
        this.productoOriginal = null;
        this.productoCambio = null;
        this.cantidadCambio = 1;
        this.busquedaTimeout = null;
        this.sugerencias = [];
        this.modalActual = null;
    }

    async init() {
        this.cargarEventos();
        this.agregarEstilos();
        this.ajustarPanelLateral();
        console.log('✅ Módulo de cambios inicializado');
    }

    ajustarPanelLateral() {
        const panelLateral = document.querySelector('.carrito-panel');
        if (panelLateral) {
            panelLateral.style.display = 'flex';
            panelLateral.style.flexDirection = 'column';
            panelLateral.style.height = '100vh';
            panelLateral.style.overflow = 'hidden';
        }
        
        const panelContent = document.getElementById('panelContent');
        if (panelContent) {
            panelContent.style.display = 'flex';
            panelContent.style.flexDirection = 'column';
            panelContent.style.height = '100%';
            panelContent.style.overflow = 'hidden';
        }
    }

    agregarEstilos() {
        if (document.getElementById('modulo-cambios-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'modulo-cambios-styles';
        style.textContent = `
            #panelContent {
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
                background: #f8fafc;
            }
            
            .cambio-panel {
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
                background: #f8fafc;
            }
            
            .cambio-header {
                padding: 1rem;
                border-bottom: 2px solid #e5e7eb;
                background: white;
                flex-shrink: 0;
            }
            
            .cambio-header h2 {
                color: #2E2168;
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin: 0;
            }
            
            .cambio-header h2 i {
                color: #e67e22;
            }
            
            .cambio-header p {
                margin-top: 0.5rem;
                margin-bottom: 0;
                font-size: 0.85rem;
                color: #6B7280;
            }
            
            .cambio-search {
                padding: 1rem;
                background: white;
                border-bottom: 1px solid #e5e7eb;
                flex-shrink: 0;
                position: relative;
            }
            
            .cambio-search input {
                width: 100%;
                padding: 0.8rem;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                font-size: 1rem;
                transition: all 0.3s;
            }
            
            .cambio-search input:focus {
                border-color: #e67e22;
                outline: none;
                box-shadow: 0 0 0 3px rgba(230, 126, 34, 0.2);
            }
            
            .sugerencias-ventas {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                max-height: 300px;
                overflow-y: auto;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                margin-top: 4px;
            }
            
            .sugerencia-venta {
                padding: 0.8rem;
                border-bottom: 1px solid #e5e7eb;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .sugerencia-venta:hover {
                background: #fef5e8;
            }
            
            .sugerencia-venta:last-child {
                border-bottom: none;
            }
            
            .venta-seleccionada {
                background: #fff3e0;
                border-bottom: 1px solid #e5e7eb;
                flex-shrink: 0;
                padding: 0;
                max-height: none;
            }
            
            .venta-info {
                margin: 0;
                padding: 1rem;
                background: white;
                border-bottom: 1px solid #e5e7eb;
                border-left: none;
                border-radius: 0;
            }
            
            .venta-info > div {
                display: flex;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            
            .productos-venta-container {
                padding: 1rem;
                background: #fff3e0;
            }
            
            .productos-venta-container h4 {
                font-size: 0.9rem;
                margin-bottom: 0.8rem;
                color: #e67e22;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .productos-lista-scroll {
                max-height: 180px;
                overflow-y: auto;
                padding-right: 0.5rem;
            }
            
            .producto-cambio-item {
                padding: 0.8rem;
                margin-bottom: 0.5rem;
                background: white;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .producto-cambio-item:hover {
                background: #fff3e0;
                border-color: #e67e22;
                transform: translateX(4px);
            }
            
            .btn-seleccionar-cambio {
                background: #e67e22;
                color: white;
                border: none;
                padding: 0.4rem 0.8rem;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.75rem;
                transition: all 0.2s;
            }
            
            .btn-seleccionar-cambio:hover {
                background: #d35400;
                transform: scale(1.05);
            }
            
            .cambio-scroll-area {
                flex: 1;
                overflow-y: auto;
                padding: 1rem;
                min-height: 0;
                background: #f8fafc;
            }
            
            .producto-original {
                padding: 0;
                background: transparent;
                border-radius: 12px;
                margin-bottom: 1rem;
                border: none;
            }
            
            .producto-original h4 {
                font-size: 0.9rem;
                margin-bottom: 0.5rem;
                color: #e67e22;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .producto-original-content {
                padding: 0.8rem;
                background: white;
                border-radius: 12px;
                border-left: 4px solid #e67e22;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .producto-cambio {
                padding: 0;
                background: transparent;
                border-radius: 12px;
                margin-bottom: 1rem;
                border: none;
            }
            
            .producto-cambio h4 {
                font-size: 0.9rem;
                margin-bottom: 0.5rem;
                color: #2b7c30;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .producto-cambio-content {
                padding: 0.8rem;
                background: white;
                border-radius: 12px;
                border-left: 4px solid #2b7c30;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .busqueda-producto {
                margin-bottom: 0.8rem;
                position: relative;
            }
            
            .busqueda-producto input {
                width: 100%;
                padding: 0.7rem;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                font-size: 0.9rem;
                transition: all 0.3s;
            }
            
            .busqueda-producto input:focus {
                border-color: #e67e22;
                outline: none;
            }
            
            .sugerencias-productos {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                max-height: 200px;
                overflow-y: auto;
                z-index: 100;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            
            .sugerencia-producto {
                padding: 0.8rem;
                border-bottom: 1px solid #e5e7eb;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .sugerencia-producto:hover {
                background: #fef5e8;
            }
            
            .cambio-footer {
                flex-shrink: 0;
                background: white;
                border-top: 1px solid #e5e7eb;
                padding: 1rem;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
            }
            
            .btn-cambiar {
                width: 100%;
                background: #e67e22;
                color: white;
                border: none;
                padding: 1rem;
                border-radius: 12px;
                font-size: 1rem;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
            }
            
            .btn-cambiar:hover:not(:disabled) {
                background: #d35400;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(230, 126, 34, 0.3);
            }
            
            .btn-cambiar:disabled {
                background: #9ca3af;
                cursor: not-allowed;
                opacity: 0.7;
            }
            
            .form-control {
                width: 100%;
                padding: 0.7rem;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                font-size: 0.9rem;
                transition: all 0.3s;
            }
            
            .form-control:focus {
                border-color: #e67e22;
                outline: none;
                box-shadow: 0 0 0 3px rgba(230, 126, 34, 0.2);
            }
            
            label {
                display: block;
                margin-bottom: 0.3rem;
                font-weight: 500;
                font-size: 0.85rem;
                color: #4b5563;
            }
            
            label i {
                margin-right: 0.3rem;
                color: #e67e22;
            }
            
            .cambio-scroll-area::-webkit-scrollbar,
            .productos-lista-scroll::-webkit-scrollbar {
                width: 4px;
            }
            
            .cambio-scroll-area::-webkit-scrollbar-track,
            .productos-lista-scroll::-webkit-scrollbar-track {
                background: #e5e7eb;
                border-radius: 4px;
            }
            
            .cambio-scroll-area::-webkit-scrollbar-thumb,
            .productos-lista-scroll::-webkit-scrollbar-thumb {
                background: #e67e22;
                border-radius: 4px;
            }
            
            .mt-3 { margin-top: 0.75rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .text-center { text-align: center; }
            
            .exchange-icon {
                text-align: center;
                margin: 0.5rem 0;
                color: #e67e22;
                font-size: 1.2rem;
            }
            
            @media (max-width: 768px) {
                .cambio-footer {
                    padding: 0.8rem;
                }
                
                .btn-cambiar {
                    padding: 0.8rem;
                    font-size: 0.9rem;
                }
                
                .producto-cambio-item {
                    padding: 0.6rem;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    mostrarModulo() {
        const panelContent = document.getElementById('panelContent');
        if (!panelContent) return;

        this.ajustarPanelLateral();

        panelContent.innerHTML = this.renderPanelCambios();
        this.cargarEventosPanel();
        
        setTimeout(() => {
            const inputVenta = document.getElementById('buscarVenta');
            if (inputVenta) inputVenta.focus();
        }, 100);
    }

    renderPanelCambios() {
        return `
            <div class="cambio-panel">
                <div class="cambio-header">
                    <h2>
                        <i class="fas fa-exchange-alt"></i>
                        Cambio de Producto
                    </h2>
                    <p>Busque una venta para realizar un cambio</p>
                </div>
                
                <div class="cambio-search">
                    <input type="text" 
                           id="buscarVenta" 
                           placeholder="Buscar por folio de venta..." 
                           autocomplete="off">
                    <div id="sugerenciasVentas" class="sugerencias-ventas" style="display: none;"></div>
                </div>
                
                <div id="ventaSeleccionadaContainer" style="display: none;"></div>
                
                <div id="cambioSection" style="display: none;" class="cambio-scroll-area"></div>
                
                <div id="cambioFooter" class="cambio-footer" style="display: none;">
                    <button id="btnRealizarCambio" class="btn-cambiar" disabled>
                        <i class="fas fa-exchange-alt"></i> Realizar Cambio
                    </button>
                </div>
            </div>
        `;
    }

    cargarEventosPanel() {
        const inputVenta = document.getElementById('buscarVenta');
        if (!inputVenta) return;
        
        inputVenta.addEventListener('input', (e) => {
            const termino = e.target.value.trim();
            
            if (this.busquedaTimeout) clearTimeout(this.busquedaTimeout);
            
            if (termino.length < 2) {
                this.ocultarSugerenciasVentas();
                return;
            }
            
            this.busquedaTimeout = setTimeout(() => {
                this.buscarVentas(termino);
            }, 500);
        });
        
        document.addEventListener('click', (e) => {
            const sugerenciasVentas = document.getElementById('sugerenciasVentas');
            const inputVentaElem = document.getElementById('buscarVenta');
            
            if (sugerenciasVentas && inputVentaElem) {
                if (!sugerenciasVentas.contains(e.target) && e.target !== inputVentaElem) {
                    sugerenciasVentas.style.display = 'none';
                }
            }
        });
    }

    async buscarVentas(termino) {
        try {
            const response = await fetch(`${this.apiUrl}?accion=buscarVentas&termino=${encodeURIComponent(termino)}&_t=${Date.now()}`);
            const data = await response.json();
            
            if (data.success && data.ventas.length > 0) {
                this.mostrarSugerenciasVentas(data.ventas);
            } else {
                this.ocultarSugerenciasVentas();
            }
        } catch (error) {
            console.error('Error buscando ventas:', error);
            this.ocultarSugerenciasVentas();
        }
    }

    mostrarSugerenciasVentas(ventas) {
        const sugerenciasDiv = document.getElementById('sugerenciasVentas');
        if (!sugerenciasDiv) return;
        
        sugerenciasDiv.innerHTML = ventas.map(venta => `
            <div class="sugerencia-venta" data-venta='${JSON.stringify(venta)}'>
                <div style="font-weight: bold; display: flex; justify-content: space-between;">
                    <span>${this.escapeHTML(venta.folio)}</span>
                    <span style="color: #e67e22;">$${parseFloat(venta.total).toFixed(2)}</span>
                </div>
                <div style="font-size: 0.8rem; color: #6B7280; margin-top: 0.3rem;">
                    <i class="fas fa-calendar"></i> ${new Date(venta.fecha).toLocaleString()}
                    <i class="fas fa-credit-card" style="margin-left: 0.8rem;"></i> ${venta.metodo_pago}
                </div>
            </div>
        `).join('');
        
        sugerenciasDiv.style.display = 'block';
        
        sugerenciasDiv.querySelectorAll('.sugerencia-venta').forEach(el => {
            el.addEventListener('click', () => {
                const venta = JSON.parse(el.dataset.venta);
                this.seleccionarVenta(venta);
                sugerenciasDiv.style.display = 'none';
                document.getElementById('buscarVenta').value = venta.folio;
            });
        });
    }

    ocultarSugerenciasVentas() {
        const sugerenciasDiv = document.getElementById('sugerenciasVentas');
        if (sugerenciasDiv) {
            sugerenciasDiv.style.display = 'none';
        }
    }

    async seleccionarVenta(venta) {
        this.ventaSeleccionada = venta;
        this.productoOriginal = null;
        this.productoCambio = null;
        
        const container = document.getElementById('ventaSeleccionadaContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="venta-seleccionada">
                <div class="venta-info">
                    <div>Cargando detalles de la venta...</div>
                </div>
            </div>
        `;
        container.style.display = 'block';
        
        try {
            const response = await fetch(`${this.apiUrl}?accion=getVentaDetalle&id=${venta.id}&_t=${Date.now()}`);
            const data = await response.json();
            
            if (data.success) {
                this.ventaSeleccionada.detalles = data.detalles;
                this.mostrarVentaSeleccionada();
            } else {
                throw new Error(data.message || 'Error al obtener detalles');
            }
        } catch (error) {
            console.error('Error obteniendo detalle de venta:', error);
            this.mostrarNotificacion('Error al obtener detalles de la venta', 'error');
            container.innerHTML = `
                <div class="venta-seleccionada">
                    <div class="venta-info">
                        <div style="color: var(--danger);">Error al cargar los productos de la venta</div>
                    </div>
                </div>
            `;
        }
    }

    mostrarVentaSeleccionada() {
        const container = document.getElementById('ventaSeleccionadaContainer');
        if (!container) return;
        
        const venta = this.ventaSeleccionada;
        const fecha = new Date(venta.fecha);
        
        container.innerHTML = `
            <div class="venta-seleccionada">
                <div class="venta-info">
                    <div>
                        <span><strong><i class="fas fa-hashtag"></i> Folio:</strong> ${this.escapeHTML(venta.folio)}</span>
                        <span><strong><i class="fas fa-calendar"></i> Fecha:</strong> ${fecha.toLocaleString()}</span>
                    </div>
                    <div style="margin-top: 0.5rem;">
                        <span><strong><i class="fas fa-dollar-sign"></i> Total:</strong> <span style="color: #e67e22; font-weight: bold;">$${parseFloat(venta.total).toFixed(2)}</span></span>
                        <span style="margin-left: 1rem;"><strong><i class="fas fa-credit-card"></i> Método:</strong> ${venta.metodo_pago}</span>
                    </div>
                </div>
                
                <div class="productos-venta-container">
                    <h4><i class="fas fa-boxes"></i> Productos de la venta:</h4>
                    <div id="productosOriginalesLista" class="productos-lista-scroll"></div>
                </div>
            </div>
        `;
        
        const productosLista = document.getElementById('productosOriginalesLista');
        
        if (venta.detalles && venta.detalles.length > 0) {
            productosLista.innerHTML = venta.detalles.map(producto => `
                <div class="producto-cambio-item" data-producto='${JSON.stringify(producto)}'>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; color: #2E2168;">${this.escapeHTML(producto.nombre)}</div>
                            <div style="font-size: 0.75rem; color: #6B7280; margin-top: 0.2rem;">
                                <i class="fas fa-barcode"></i> ${this.escapeHTML(producto.codigo_barras || 'Sin código')}
                            </div>
                            <div style="font-size: 0.75rem; color: #6B7280;">
                                <i class="fas fa-box"></i> Cantidad: ${producto.cantidad} | 
                                <i class="fas fa-dollar-sign"></i> $${parseFloat(producto.precio_unitario).toFixed(2)} c/u
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: bold; color: #2b7c30;">
                                $${parseFloat(producto.subtotal).toFixed(2)}
                            </div>
                            <button class="btn-seleccionar-cambio" data-producto='${JSON.stringify(producto)}'>
                                <i class="fas fa-exchange-alt"></i> Cambiar
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            productosLista.querySelectorAll('.btn-seleccionar-cambio').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const producto = JSON.parse(btn.dataset.producto);
                    this.seleccionarProductoOriginal(producto);
                });
            });
            
            productosLista.querySelectorAll('.producto-cambio-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('btn-seleccionar-cambio')) {
                        const producto = JSON.parse(el.dataset.producto);
                        this.seleccionarProductoOriginal(producto);
                    }
                });
            });
        } else {
            productosLista.innerHTML = '<div style="text-align: center; padding: 2rem; color: #9ca3af;"><i class="fas fa-box-open"></i> No hay productos en esta venta</div>';
        }
        
        container.style.display = 'block';
    }

    seleccionarProductoOriginal(producto) {
        this.productoOriginal = producto;
        
        const cambioSection = document.getElementById('cambioSection');
        const cambioFooter = document.getElementById('cambioFooter');
        
        if (cambioSection) {
            cambioSection.innerHTML = this.renderCambioSection(producto);
            cambioSection.style.display = 'block';
        }
        
        if (cambioFooter) {
            cambioFooter.style.display = 'block';
        }
        
        const cantidadInput = document.getElementById('cantidadCambio');
        if (cantidadInput) {
            cantidadInput.max = producto.cantidad;
            cantidadInput.value = Math.min(1, producto.cantidad);
        }
        
        this.productoCambio = null;
        
        this.verificarPuedeCambiar();
        
        this.cargarEventosCambioSection();
    }
    
    renderCambioSection(producto) {
        return `
            <div class="producto-original">
                <h4><i class="fas fa-arrow-left"></i> Producto a cambiar</h4>
                <div class="producto-original-content">
                    <div style="font-weight: bold; font-size: 1rem;">${this.escapeHTML(producto.nombre)}</div>
                    <div style="font-size: 0.85rem; color: #6B7280; margin-top: 0.3rem;">
                        <i class="fas fa-barcode"></i> ${this.escapeHTML(producto.codigo_barras || 'Sin código')}<br>
                        <i class="fas fa-box"></i> Cantidad comprada: ${producto.cantidad}<br>
                        <i class="fas fa-dollar-sign"></i> Precio: $${parseFloat(producto.precio_unitario).toFixed(2)} c/u
                    </div>
                </div>
            </div>
            
            <div class="exchange-icon">
                <i class="fas fa-exchange-alt"></i>
            </div>
            
            <div class="producto-cambio">
                <h4><i class="fas fa-arrow-right"></i> Nuevo producto</h4>
                <div class="producto-cambio-content">
                    <div class="busqueda-producto">
                        <input type="text" 
                               id="buscarProductoCambio" 
                               placeholder="Buscar producto para cambiar..." 
                               autocomplete="off"
                               class="form-control">
                        <div id="sugerenciasProductos" class="sugerencias-productos" style="display: none;"></div>
                    </div>
                    <div id="productoCambioDisplay"></div>
                    
                    <div class="mt-3">
                        <label for="cantidadCambio">
                            <i class="fas fa-calculator"></i> Cantidad a cambiar:
                        </label>
                        <input type="number" 
                               id="cantidadCambio" 
                               min="1" 
                               value="1" 
                               class="form-control">
                    </div>
                    
                    <div class="mt-3">
                        <label for="motivoCambio">
                            <i class="fas fa-comment"></i> Motivo del cambio:
                        </label>
                        <textarea id="motivoCambio" rows="3" 
                                  class="form-control"
                                  placeholder="Ej: Producto defectuoso, cambio de color, no era el producto deseado, etc."></textarea>
                    </div>
                </div>
            </div>
        `;
    }
    
    cargarEventosCambioSection() {
        const inputProductoCambio = document.getElementById('buscarProductoCambio');
        if (inputProductoCambio) {
            inputProductoCambio.addEventListener('input', (e) => {
                const termino = e.target.value.trim();
                if (this.busquedaTimeout) clearTimeout(this.busquedaTimeout);
                
                if (termino.length < 2) {
                    this.ocultarSugerenciasProductos();
                    return;
                }
                
                this.busquedaTimeout = setTimeout(() => {
                    this.buscarProductos(termino);
                }, 500);
            });
        }
        
        const cantidadInput = document.getElementById('cantidadCambio');
        if (cantidadInput) {
            cantidadInput.addEventListener('change', () => this.verificarPuedeCambiar());
            cantidadInput.addEventListener('input', () => this.verificarPuedeCambiar());
        }
        
        const motivoInput = document.getElementById('motivoCambio');
        if (motivoInput) {
            motivoInput.addEventListener('input', () => this.verificarPuedeCambiar());
        }
        
        const btnCambiar = document.getElementById('btnRealizarCambio');
        if (btnCambiar) {
            btnCambiar.addEventListener('click', () => this.realizarCambio());
        }
    }

    async buscarProductos(termino) {
        try {
            const response = await fetch(`${this.apiUrl}?accion=buscarProductos&termino=${encodeURIComponent(termino)}&_t=${Date.now()}`);
            const productos = await response.json();
            
            if (productos.length > 0) {
                this.mostrarSugerenciasProductos(productos);
            } else {
                this.ocultarSugerenciasProductos();
            }
        } catch (error) {
            console.error('Error buscando productos:', error);
            this.ocultarSugerenciasProductos();
        }
    }

    mostrarSugerenciasProductos(productos) {
        const sugerenciasDiv = document.getElementById('sugerenciasProductos');
        if (!sugerenciasDiv) return;
        
        sugerenciasDiv.innerHTML = productos.map(producto => `
            <div class="sugerencia-producto" data-producto='${JSON.stringify(producto)}'>
                <div style="font-weight: bold; display: flex; justify-content: space-between;">
                    <span>${this.escapeHTML(producto.nombre)}</span>
                    <span style="color: #e67e22;">$${parseFloat(producto.precio).toFixed(2)}</span>
                </div>
                <div style="font-size: 0.8rem; color: #6B7280; margin-top: 0.3rem;">
                    <i class="fas fa-barcode"></i> ${this.escapeHTML(producto.codigo_barras)}
                    <span style="margin-left: 0.8rem;">
                        <i class="fas fa-box"></i> Stock: ${producto.stock_actual}
                    </span>
                </div>
            </div>
        `).join('');
        
        sugerenciasDiv.style.display = 'block';
        
        sugerenciasDiv.querySelectorAll('.sugerencia-producto').forEach(el => {
            el.addEventListener('click', () => {
                const producto = JSON.parse(el.dataset.producto);
                this.seleccionarProductoCambio(producto);
                sugerenciasDiv.style.display = 'none';
                document.getElementById('buscarProductoCambio').value = producto.nombre;
            });
        });
    }

    ocultarSugerenciasProductos() {
        const sugerenciasDiv = document.getElementById('sugerenciasProductos');
        if (sugerenciasDiv) {
            sugerenciasDiv.style.display = 'none';
        }
    }

    seleccionarProductoCambio(producto) {
        if (producto.stock_actual <= 0) {
            this.mostrarNotificacion('⚠️ Este producto no tiene stock disponible', 'warning');
            return;
        }
        
        this.productoCambio = producto;
        
        const productoCambioDisplay = document.getElementById('productoCambioDisplay');
        if (productoCambioDisplay) {
            productoCambioDisplay.innerHTML = `
                <div style="padding: 0.8rem; background: #e8f5e9; border-radius: 12px; margin-top: 0.5rem; border-left: 4px solid #2b7c30;">
                    <div style="font-weight: bold; font-size: 1rem;">${this.escapeHTML(producto.nombre)}</div>
                    <div style="font-size: 0.85rem; color: #6B7280; margin-top: 0.3rem;">
                        <i class="fas fa-barcode"></i> ${this.escapeHTML(producto.codigo_barras)}<br>
                        <i class="fas fa-box"></i> Stock disponible: ${producto.stock_actual}<br>
                        <i class="fas fa-dollar-sign"></i> Precio: $${parseFloat(producto.precio).toFixed(2)}
                    </div>
                </div>
            `;
        }
        
        this.verificarPuedeCambiar();
    }

    verificarPuedeCambiar() {
        const btnCambiar = document.getElementById('btnRealizarCambio');
        if (!btnCambiar) return;
        
        const cantidad = parseInt(document.getElementById('cantidadCambio')?.value) || 1;
        const puede = this.productoOriginal && this.productoCambio;
        
        if (!puede) {
            btnCambiar.disabled = true;
            btnCambiar.title = 'Seleccione el producto original y el nuevo producto';
            return;
        }
        
        if (cantidad > this.productoOriginal.cantidad) {
            btnCambiar.disabled = true;
            btnCambiar.title = `La cantidad no puede exceder ${this.productoOriginal.cantidad}`;
            this.mostrarNotificacion(`⚠️ La cantidad máxima a cambiar es ${this.productoOriginal.cantidad}`, 'warning');
            return;
        }
        
        if (cantidad > this.productoCambio.stock_actual) {
            btnCambiar.disabled = true;
            btnCambiar.title = `Stock insuficiente. Disponible: ${this.productoCambio.stock_actual}`;
            this.mostrarNotificacion(`⚠️ Stock insuficiente. Solo hay ${this.productoCambio.stock_actual} unidades disponibles`, 'warning');
            return;
        }
        
        btnCambiar.disabled = false;
        btnCambiar.title = '';
        
        // Calcular la diferencia correctamente
        // Si el nuevo producto es más caro: diferencia POSITIVA (cliente paga)
        // Si el nuevo producto es más barato: diferencia NEGATIVA (se devuelve dinero)
        const diferenciaPorUnidad = this.productoCambio.precio - this.productoOriginal.precio_unitario;
        const diferenciaTotal = diferenciaPorUnidad * cantidad;
        
        const diferenciaHtml = document.getElementById('diferenciaPrecioInfo');
        
        if (diferenciaTotal !== 0) {
            let mensaje = '';
            let color = '';
            
            if (diferenciaTotal > 0) {
                mensaje = `💰 El cliente DEBE PAGAR: +$${diferenciaTotal.toFixed(2)} (diferencia por cambio)`;
                color = '#e67e22';
            } else {
                mensaje = `💵 Se DEVUELVE al cliente: $${Math.abs(diferenciaTotal).toFixed(2)} (diferencia a favor)`;
                color = '#2b7c30';
            }
            
            if (!diferenciaHtml) {
                const infoDiv = document.createElement('div');
                infoDiv.id = 'diferenciaPrecioInfo';
                infoDiv.style.cssText = `margin-top: 1rem; padding: 0.8rem; background: ${color}20; border-radius: 12px; text-align: center; color: ${color}; font-weight: 500; border-left: 4px solid ${color};`;
                infoDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${mensaje}`;
                btnCambiar.parentNode.insertBefore(infoDiv, btnCambiar);
            } else {
                diferenciaHtml.style.background = `${color}20`;
                diferenciaHtml.style.color = color;
                diferenciaHtml.style.borderLeftColor = color;
                diferenciaHtml.innerHTML = `<i class="fas fa-info-circle"></i> ${mensaje}`;
            }
        } else {
            if (diferenciaHtml) diferenciaHtml.remove();
        }
    }

    async realizarCambio() {
        if (!this.productoOriginal || !this.productoCambio) {
            this.mostrarNotificacion('Seleccione el producto original y el nuevo producto', 'warning');
            return;
        }
        
        const cantidad = parseInt(document.getElementById('cantidadCambio')?.value) || 1;
        const motivo = document.getElementById('motivoCambio')?.value.trim() || 'Cambio solicitado por cliente';
        
        if (cantidad > this.productoOriginal.cantidad) {
            this.mostrarNotificacion(`⚠️ La cantidad a cambiar no puede exceder ${this.productoOriginal.cantidad}`, 'warning');
            return;
        }
        
        if (cantidad > this.productoCambio.stock_actual) {
            this.mostrarNotificacion(`⚠️ Stock insuficiente. Disponible: ${this.productoCambio.stock_actual}`, 'error');
            return;
        }
        
        // Calcular la diferencia correctamente
        const diferenciaPorUnidad = this.productoCambio.precio - this.productoOriginal.precio_unitario;
        const diferenciaTotal = diferenciaPorUnidad * cantidad;
        
        let mensajeConfirmacion = `¿Confirmar cambio de ${cantidad} unidad(es) de "${this.productoOriginal.nombre}" por "${this.productoCambio.nombre}"?\n\n`;
        
        mensajeConfirmacion += `📊 Detalle:\n`;
        mensajeConfirmacion += `• Precio original: $${this.productoOriginal.precio_unitario.toFixed(2)} c/u\n`;
        mensajeConfirmacion += `• Precio nuevo: $${this.productoCambio.precio.toFixed(2)} c/u\n`;
        mensajeConfirmacion += `• Diferencia por unidad: ${diferenciaPorUnidad > 0 ? '+' : ''}$${diferenciaPorUnidad.toFixed(2)}\n`;
        mensajeConfirmacion += `• Cantidad: ${cantidad}\n`;
        
        if (diferenciaTotal > 0) {
            mensajeConfirmacion += `\n💰 El cliente DEBE PAGAR: +$${diferenciaTotal.toFixed(2)}`;
        } else if (diferenciaTotal < 0) {
            mensajeConfirmacion += `\n💵 Se DEVUELVE al cliente: $${Math.abs(diferenciaTotal).toFixed(2)}`;
        } else {
            mensajeConfirmacion += `\n✅ Cambio sin diferencia de precio`;
        }
        
        if (!confirm(mensajeConfirmacion)) return;
        
        const btnCambiar = document.getElementById('btnRealizarCambio');
        const textoOriginal = btnCambiar.innerHTML;
        btnCambiar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        btnCambiar.disabled = true;
        
        try {
            const formData = new FormData();
            formData.append('accion', 'realizarCambio');
            formData.append('venta_id', this.ventaSeleccionada.id);
            formData.append('producto_original_id', this.productoOriginal.producto_id);
            formData.append('producto_nuevo_id', this.productoCambio.id);
            formData.append('cantidad', cantidad);
            formData.append('motivo', motivo);
            
            const csrfToken = await this.obtenerCsrfToken();
            formData.append('csrf_token', csrfToken);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.mostrarNotificacion(`✅ ${data.message}`, 'success');
                
                this.ventaSeleccionada = null;
                this.productoOriginal = null;
                this.productoCambio = null;
                
                document.getElementById('buscarVenta').value = '';
                document.getElementById('ventaSeleccionadaContainer').style.display = 'none';
                document.getElementById('cambioSection').style.display = 'none';
                document.getElementById('cambioFooter').style.display = 'none';
                
                const inputProducto = document.getElementById('buscarProductoCambio');
                if (inputProducto) inputProducto.value = '';
                document.getElementById('productoCambioDisplay').innerHTML = '';
                document.getElementById('motivoCambio').value = '';
                
                const diferenciaInfo = document.getElementById('diferenciaPrecioInfo');
                if (diferenciaInfo) diferenciaInfo.remove();
                
                if (window.pos) {
                    window.pos.recargarProductos();
                }
                if (window.moduloProductos) {
                    window.moduloProductos.cargarProductos();
                }
                if (window.moduloCaja) {
                    window.moduloCaja.verificarEstadoCaja();
                }
                
                document.getElementById('buscarVenta').focus();
            } else {
                this.mostrarNotificacion(data.message || 'Error al realizar el cambio', 'error');
            }
        } catch (error) {
            console.error('Error realizando cambio:', error);
            this.mostrarNotificacion('Error de conexión: ' + error.message, 'error');
        } finally {
            btnCambiar.innerHTML = textoOriginal;
            btnCambiar.disabled = false;
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

    escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    mostrarNotificacion(mensaje, tipo) {
        const notificacionesExistentes = document.querySelectorAll('.notificacion-temporal');
        notificacionesExistentes.forEach(notif => notif.remove());
        
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion notificacion-${tipo} notificacion-temporal`;
        
        const colores = {
            success: '#27AE60',
            error: '#E74C3C',
            warning: '#F39C12'
        };
        
        const iconos = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle'
        };
        
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${colores[tipo] || '#333'};
            color: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
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
        
        notificacion.innerHTML = `
            <i class="fas ${iconos[tipo]}" style="font-size: 1.2rem;"></i>
            <span style="flex: 1;">${mensaje}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;">×</button>
        `;
        
        document.body.appendChild(notificacion);
        
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.style.animation = 'fadeOut 0.3s';
                setTimeout(() => {
                    if (notificacion.parentNode) notificacion.remove();
                }, 300);
            }
        }, 4000);
    }

    cargarEventos() {
        document.querySelectorAll('.menu-item[data-modulo="productos"]').forEach(item => {
            item.addEventListener('click', () => {
                this.mostrarModulo();
            });
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.moduloCambios = new ModuloCambios();
        window.moduloCambios.init();
    });
} else {
    window.moduloCambios = new ModuloCambios();
    window.moduloCambios.init();
}