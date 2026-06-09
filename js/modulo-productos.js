class ModuloProductos {
    constructor() {
        this.apiUrl = 'php/api.php';
        this.productos = [];
        this.categoriaFiltro = 'Todas';
        this.terminoBusqueda = '';
        this.modalActual = null;
        this.editandoId = null;
        this.estadisticas = null;
        this.categorias = ['Acrílicas', 'Esmaltes', 'Selladores', 'Barniz', 'Aerosol', 'Impermeabilizante', 'Complementos'];
        this.cargando = false;
        this.buscarTimeout = null;
        this.tabActiva = 'productos';
        this.filtroStock = null;
        this.productosOcultos = true;
    }

    async init() {
        await this.cargarEstadisticas();
        this.cargarEventos();
    }

    _ocultarCarrito() {
        const carritoPanel = document.querySelector('.carrito-panel');
        const sistemaPos = document.getElementById('sistemaPos');
        if (carritoPanel) {
            carritoPanel.dataset.prevDisplay = carritoPanel.style.display || '';
            carritoPanel.style.display = 'none';
        }
        if (sistemaPos) sistemaPos.classList.add('carrito-oculto');
        const toggleCarrito = document.querySelector('.toggle-carrito-mobile');
        if (toggleCarrito) toggleCarrito.style.display = 'none';
    }

    _mostrarCarrito() {
        const carritoPanel = document.querySelector('.carrito-panel');
        const sistemaPos = document.getElementById('sistemaPos');
        if (carritoPanel) carritoPanel.style.display = carritoPanel.dataset.prevDisplay || '';
        if (sistemaPos) sistemaPos.classList.remove('carrito-oculto');
        const toggleCarrito = document.querySelector('.toggle-carrito-mobile');
        if (toggleCarrito) toggleCarrito.style.display = '';
    }

    async cargarProductos(forceRefresh = false, mostrarTodos = false) {
        if (this.cargando) return;

        if (!mostrarTodos && this.productosOcultos) {
            this.productos = [];
            await this.cargarEstadisticas();
            const moduloVisible = document.getElementById('moduloProductos')?.style.display === 'block';
            if (moduloVisible) {
                this.renderizarEstadisticas();
                this.renderizarTabla([]);
                this.actualizarBotonOcultarProductos();
            }
            return;
        }

        this.cargando = true;
        this.productosOcultos = false;
        try {
            const url = `${this.apiUrl}?accion=getProductosAdmin&_t=${Date.now()}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                this.productos = data.productos;
                await this.cargarEstadisticas();
                const moduloVisible = document.getElementById('moduloProductos')?.style.display === 'block';
                if (moduloVisible) {
                    this.renderizarTabla();
                    this.renderizarEstadisticas();
                    this.actualizarBotonOcultarProductos();
                }
            } else {
                this.mostrarNotificacion(data.message || 'Error al cargar productos', 'error');
            }
        } catch (error) {
            console.error('Error cargando productos:', error);
            this.mostrarNotificacion('Error de conexión', 'error');
        } finally {
            this.cargando = false;
        }
    }

    async cargarEstadisticas() {
        try {
            const response = await fetch(`${this.apiUrl}?accion=getProductosEstadisticas&_t=${Date.now()}`);
            const data = await response.json();
            if (data.success) {
                this.estadisticas = data.estadisticas;
                const moduloVisible = document.getElementById('moduloProductos')?.style.display === 'block';
                if (moduloVisible) this.renderizarEstadisticas();
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    async buscarProductos() {
        const terminoInput    = document.getElementById('buscarProductoInput');
        const categoriaSelect = document.getElementById('categoriaFiltro');
        const termino   = terminoInput    ? terminoInput.value.trim()   : '';
        const categoria = categoriaSelect ? categoriaSelect.value : 'Todas';
        this.terminoBusqueda = termino;
        this.categoriaFiltro = categoria;
        this.filtroStock = null;

        if (!termino && (!categoria || categoria === 'Todas')) {
            this.productosOcultos = true;
            this.productos = [];
            this.renderizarEstadisticas();
            this.renderizarTabla([]);
            this.actualizarBotonOcultarProductos();
            return;
        }

        this.cargando = true;
        this.productosOcultos = false;
        this.renderizarTablaCargando('Buscando productos...');
        try {
            let url = `${this.apiUrl}?accion=buscarProductosAdmin&_t=${Date.now()}`;
            if (termino)                            url += `&termino=${encodeURIComponent(termino)}`;
            if (categoria && categoria !== 'Todas') url += `&categoria=${encodeURIComponent(categoria)}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                this.productos = data.productos || [];
                this.renderizarEstadisticas();
                this.renderizarTabla();
                this.actualizarBotonOcultarProductos();
            } else {
                this.mostrarNotificacion(data.message || 'Error al buscar productos', 'error');
            }
        } catch (error) {
            console.error('Error buscando productos:', error);
            this.mostrarNotificacion('Error al buscar', 'error');
        } finally {
            this.cargando = false;
        }
    }


    renderizarTablaCargando(mensaje = 'Cargando productos...') {
        const container = document.getElementById('productosTableBody');
        if (!container) return;
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:2rem;color:var(--gray);">
                    <i class="fas fa-spinner fa-spin" style="font-size:1.6rem;margin-bottom:.6rem;color:var(--secondary);"></i>
                    <div>${mensaje}</div>
                </td>
            </tr>`;
    }

    ocultarProductos() {
        this.productosOcultos = true;
        this.productos = [];
        this.filtroStock = null;
        this.renderizarTabla([]);
        this.renderizarEstadisticas();
        this.actualizarBotonOcultarProductos();
    }

    async mostrarTodosLosProductos() {
        const buscarInput = document.getElementById('buscarProductoInput');
        const categoriaSelect = document.getElementById('categoriaFiltro');
        if (buscarInput) buscarInput.value = '';
        if (categoriaSelect) categoriaSelect.value = 'Todas';
        this.terminoBusqueda = '';
        this.categoriaFiltro = 'Todas';
        this.filtroStock = null;
        this.productosOcultos = false;
        this.renderizarTablaCargando('Cargando todos los productos...');
        await this.cargarProductos(true, true);
    }

    actualizarBotonOcultarProductos() {
        const btn = document.getElementById('btnToggleProductosVisibles');
        if (!btn) return;
        if (this.productosOcultos) {
            btn.innerHTML = '<i class="fas fa-eye"></i> Mostrar todos';
            btn.title = 'Mostrar todos los productos';
        } else {
            btn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar productos';
            btn.title = 'Ocultar la tabla para mejorar el rendimiento';
        }
    }

    aplicarFiltroStock(tipo) {
        this.filtroStock = (this.filtroStock === tipo) ? null : tipo;
        this.renderizarEstadisticas();

        let lista = this.productos;

        const categoriaSelect = document.getElementById('categoriaFiltro');
        const categoria = categoriaSelect ? categoriaSelect.value : 'Todas';
        if (categoria && categoria !== 'Todas') {
            lista = lista.filter(p => p.categoria === categoria);
        }

        if (this.filtroStock === 'sin_stock') {
            lista = lista.filter(p => parseInt(p.stock_actual) <= 0);
        } else if (this.filtroStock === 'bajo') {
            lista = lista.filter(p => parseInt(p.stock_actual) > 0 && parseInt(p.stock_actual) <= parseInt(p.stock_minimo));
        }

        this.renderizarTabla(lista);
    }

    renderizarEstadisticas() {
        if (!this.estadisticas) return;
        const container = document.getElementById('productosStats');
        if (!container) return;

        const activoBajo     = this.filtroStock === 'bajo';
        const activoSinStock = this.filtroStock === 'sin_stock';

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-boxes"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${this.estadisticas.total_productos}</span>
                        <span class="stat-label">Total Productos</span>
                    </div>
                </div>
                <div class="stat-card clickable ${this.estadisticas.stock_bajo > 0 ? 'warning' : ''} ${activoBajo ? 'filtro-activo filtro-warning' : ''}"
                     id="statStockBajo"
                     title="${activoBajo ? 'Quitar filtro de stock bajo' : 'Filtrar por stock bajo'}">
                    <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${this.estadisticas.stock_bajo}</span>
                        <span class="stat-label">Stock Bajo${activoBajo ? ' ✓' : ''}</span>
                    </div>
                </div>
                <div class="stat-card clickable ${this.estadisticas.sin_stock > 0 ? 'danger' : ''} ${activoSinStock ? 'filtro-activo filtro-danger' : ''}"
                     id="statSinStock"
                     title="${activoSinStock ? 'Quitar filtro sin stock' : 'Filtrar por sin stock'}">
                    <div class="stat-icon"><i class="fas fa-times-circle"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${this.estadisticas.sin_stock}</span>
                        <span class="stat-label">Sin Stock${activoSinStock ? ' ✓' : ''}</span>
                    </div>
                </div>
            </div>`;

        container.querySelector('#statStockBajo')?.addEventListener('click', () => this.aplicarFiltroStock('bajo'));
        container.querySelector('#statSinStock')?.addEventListener('click', () => this.aplicarFiltroStock('sin_stock'));
    }

    renderizarTabla(lista = null) {
        const container = document.getElementById('productosTableBody');
        if (!container) return;

        if (this.productosOcultos) {
            const tableContainer = container.closest('.productos-tabla-container');
            const bannerExistente = tableContainer?.querySelector('.filtro-stock-banner');
            if (bannerExistente) bannerExistente.remove();
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;padding:3rem;color:var(--gray);">
                        <i class="fas fa-eye-slash" style="font-size:3rem;opacity:.45;margin-bottom:1rem;color:var(--secondary);"></i>
                        <h3 style="color:var(--primary);margin-bottom:.5rem;">Productos ocultos para mejorar el rendimiento</h3>
                        <p style="margin-bottom:1rem;">Busca por nombre, código de barras o selecciona una categoría para mostrar solo los productos necesarios.</p>
                        <button id="btnMostrarTodosDesdeTabla" class="btn-agregar-producto" style="background:var(--secondary);color:white;border:none;padding:.7rem 1.2rem;border-radius:var(--radius-md);cursor:pointer;font-weight:600;">
                            <i class="fas fa-list"></i> Mostrar todos los productos
                        </button>
                    </td>
                </tr>`;
            container.querySelector('#btnMostrarTodosDesdeTabla')?.addEventListener('click', () => this.mostrarTodosLosProductos());
            return;
        }

        const productos = lista !== null ? lista : this.productos;

        const tableContainer = container.closest('.productos-tabla-container');
        const bannerExistente = tableContainer?.querySelector('.filtro-stock-banner');
        if (bannerExistente) bannerExistente.remove();

        if (this.filtroStock && tableContainer) {
            const banner = document.createElement('div');
            banner.className = `filtro-stock-banner filtro-stock-banner--${this.filtroStock === 'bajo' ? 'warning' : 'danger'}`;

            const etiqueta = this.filtroStock === 'bajo' ? 'stock bajo' : 'sin stock';
            banner.innerHTML = `
                <i class="fas fa-filter"></i>
                Mostrando <strong>${productos.length}</strong> producto(s) con ${etiqueta}
                &nbsp;—&nbsp;
                <button class="btn-quitar-filtro-stock">Quitar filtro</button>`;
            tableContainer.insertBefore(banner, tableContainer.firstChild);

            banner.querySelector('.btn-quitar-filtro-stock')?.addEventListener('click', () => this.aplicarFiltroStock(this.filtroStock));
        }

        if (productos.length === 0) {
            const msgFiltro = this.filtroStock
                ? `No hay productos con ${this.filtroStock === 'bajo' ? 'stock bajo' : 'sin stock'}.`
                : 'No hay productos registrados';
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;padding:3rem;">
                        <i class="fas fa-box-open" style="font-size:3rem;color:var(--gray);opacity:.5;"></i>
                        <p style="margin-top:1rem;">${msgFiltro}</p>
                        ${!this.filtroStock ? `<button class="btn-agregar-producto" style="margin-top:1rem;background:var(--secondary);color:white;border:none;padding:.5rem 1rem;border-radius:var(--radius-md);cursor:pointer;">
                            <i class="fas fa-plus"></i> Agregar Producto
                        </button>` : ''}
                    </td>
                </tr>`;
            if (!this.filtroStock) {
                container.querySelector('.btn-agregar-producto')?.addEventListener('click', () => this.mostrarModalFormulario());
            }
            return;
        }

        let html = '';
        for (const p of productos) {
            const stockClass = p.stock_actual <= 0 ? 'stock-critico' : p.stock_actual <= p.stock_minimo ? 'stock-bajo' : 'stock-normal';
            html += `
                <tr data-id="${p.id}">
                    <td style="vertical-align:middle;"><span class="codigo-barras">${this.escapeHTML(p.codigo_barras)}</span></td>
                    <td style="vertical-align:middle;">
                        <div style="font-weight:600;margin-bottom:4px;">${this.escapeHTML(p.nombre)}</div>
                        ${p.descripcion ? `<div style="font-size:.8rem;color:var(--gray);">${this.escapeHTML(p.descripcion)}</div>` : ''}
                    </td>
                    <td style="vertical-align:middle;"><span class="categoria-badge">${p.categoria}</span></td>
                    <td style="vertical-align:middle;font-weight:bold;color:var(--secondary-dark);">$${parseFloat(p.precio).toFixed(2)}</td>
                    <td style="vertical-align:middle;text-align:center;">
                        <span class="stock-indicator ${stockClass}" style="display:inline-block;font-weight:bold;font-size:1.1rem;">${p.stock_actual}</span>
                        <div style="font-size:.7rem;color:var(--gray);">Mín: ${p.stock_minimo}</div>
                    </td>
                    <td style="vertical-align:middle;white-space:nowrap;">
                        <button class="btn-editar" data-id="${p.id}" title="Editar" style="background:var(--primary);color:white;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;margin-right:8px;transition:all .2s;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-eliminar" data-id="${p.id}" title="Eliminar" style="background:var(--danger);color:white;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;transition:all .2s;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        }
        container.innerHTML = html;

        container.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); this.editarProducto(parseInt(btn.dataset.id)); });
            btn.addEventListener('mouseenter', e => e.currentTarget.style.transform = 'scale(1.1)');
            btn.addEventListener('mouseleave', e => e.currentTarget.style.transform = 'scale(1)');
        });
        container.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); this.confirmarEliminar(parseInt(btn.dataset.id)); });
            btn.addEventListener('mouseenter', e => e.currentTarget.style.transform = 'scale(1.1)');
            btn.addEventListener('mouseleave', e => e.currentTarget.style.transform = 'scale(1)');
        });
    }

    async editarProducto(id) {
        try {
            const response = await fetch(`${this.apiUrl}?accion=getProducto&id=${id}&_t=${Date.now()}`);
            const data = await response.json();
            if (data.success) {
                this.mostrarModalFormulario(data.producto);
            } else {
                this.mostrarNotificacion(data.message || 'Error al cargar producto', 'error');
            }
        } catch (error) {
            console.error('Error cargando producto:', error);
            this.mostrarNotificacion('Error de conexión', 'error');
        }
    }

    mostrarModalFormulario(producto = null) {
        this.cerrarModalActual();
        this.editandoId = producto ? producto.id : null;
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalProductoForm';
        modal.style.display = 'flex';
        const categoriasOptions = this.categorias.map(cat =>
            `<option value="${cat}" ${producto && producto.categoria === cat ? 'selected' : ''}>${cat}</option>`
        ).join('');
        modal.innerHTML = `
            <div class="modal-contenido modal-producto">
                <div class="modal-header">
                    <h3>
                        <i class="fas ${producto ? 'fa-edit' : 'fa-plus-circle'}" style="color:var(--secondary);"></i>
                        ${producto ? 'Editar Producto' : 'Nuevo Producto'}
                    </h3>
                    <button class="cerrar-modal" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                </div>
                <form id="productoForm" class="producto-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="codigo_barras"><i class="fas fa-barcode"></i> Código de Barras *</label>
                            <input type="text" id="codigo_barras" name="codigo_barras" value="${producto ? this.escapeHTML(producto.codigo_barras) : ''}" required maxlength="50" placeholder="Código de barras">
                        </div>
                        <div class="form-group">
                            <label for="nombre"><i class="fas fa-tag"></i> Nombre *</label>
                            <input type="text" id="nombre" name="nombre" value="${producto ? this.escapeHTML(producto.nombre) : ''}" required maxlength="100" placeholder="Nombre del producto">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="descripcion"><i class="fas fa-align-left"></i> Descripción</label>
                        <textarea id="descripcion" name="descripcion" rows="3" placeholder="Descripción del producto">${producto ? this.escapeHTML(producto.descripcion || '') : ''}</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="categoria"><i class="fas fa-layer-group"></i> Categoría</label>
                            <select id="categoria" name="categoria">${categoriasOptions}</select>
                        </div>
                        <div class="form-group">
                            <label for="precio"><i class="fas fa-dollar-sign"></i> Precio *</label>
                            <input type="number" id="precio" name="precio" value="${producto ? producto.precio : ''}" step="0.01" min="0" required placeholder="0.00">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="stock_minimo"><i class="fas fa-flag-checkered"></i> Stock Mínimo</label>
                            <input type="number" id="stock_minimo" name="stock_minimo" value="${producto ? producto.stock_minimo : '5'}" min="0" placeholder="Stock mínimo">
                        </div>
                        <div class="form-group">
                            <label for="stock_actual"><i class="fas fa-box"></i> Stock Actual</label>
                            <input type="number" id="stock_actual" name="stock_actual" value="${producto ? producto.stock_actual : '0'}" min="0" placeholder="Stock actual">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-guardar"><i class="fas fa-save"></i> Guardar</button>
                        <button type="button" class="btn-cancelar"><i class="fas fa-times"></i> Cancelar</button>
                    </div>
                </form>
            </div>`;
        this.modalActual = modal;
        document.body.appendChild(modal);

        const cerrarBtn = modal.querySelector('.cerrar-modal');
        const cancelarBtn = modal.querySelector('.btn-cancelar');
        const form = modal.querySelector('#productoForm');
        const codigoInput = modal.querySelector('#codigo_barras');

        if (cerrarBtn) cerrarBtn.addEventListener('click', () => this.cerrarModalActual());
        if (cancelarBtn) cancelarBtn.addEventListener('click', () => this.cerrarModalActual());
        if (form) form.addEventListener('submit', e => { e.preventDefault(); this.guardarProducto(); });
        if (codigoInput) codigoInput.focus();
    }

    async guardarProducto() {
        const form = document.getElementById('productoForm');
        if (!form) return;
        const datos = {
            codigo_barras: form.querySelector('#codigo_barras')?.value.trim()  || '',
            nombre:        form.querySelector('#nombre')?.value.trim()         || '',
            descripcion:   form.querySelector('#descripcion')?.value           || '',
            categoria:     form.querySelector('#categoria')?.value             || 'Todas',
            precio:        parseFloat(form.querySelector('#precio')?.value     || 0),
            stock_minimo:  parseInt(form.querySelector('#stock_minimo')?.value || 0) || 0,
            stock_actual:  parseInt(form.querySelector('#stock_actual')?.value  || 0) || 0
        };
        if (!datos.codigo_barras) { this.mostrarNotificacion('El código de barras es requerido', 'warning'); return; }
        if (!datos.nombre) { this.mostrarNotificacion('El nombre es requerido', 'warning'); return; }
        if (isNaN(datos.precio) || datos.precio < 0) { this.mostrarNotificacion('El precio debe ser un valor válido', 'warning'); return; }
        try {
            const formData = new FormData();
            formData.append('accion', this.editandoId ? 'actualizarProducto' : 'registrarProducto');
            if (this.editandoId) formData.append('id', this.editandoId);
            Object.entries(datos).forEach(([k, v]) => formData.append(k, v));
            formData.append('csrf_token', await this.obtenerCsrfToken());
            const response = await fetch(this.apiUrl, { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) {
                this.cerrarModalActual();
                this.mostrarNotificacion(data.message, 'success');
                this.filtroStock = null;
                await this.cargarProductos(true);
                if (window.pos?.cache) window.pos.cache.delete(window.pos.apiUrl + '?accion=getProductos');
                this.notificarActualizacionProductos();
                const terminoInput    = document.getElementById('buscarProductoInput');
                const categoriaSelect = document.getElementById('categoriaFiltro');
                if ((terminoInput && terminoInput.value) || (categoriaSelect && categoriaSelect.value !== 'Todas')) {
                    this.buscarProductos();
                } else {
                    this.renderizarTabla();
                    this.renderizarEstadisticas();
                }
            } else {
                this.mostrarNotificacion(data.message || 'Error al guardar', 'error');
            }
        } catch (error) {
            console.error('Error guardando producto:', error);
            this.mostrarNotificacion('Error de conexión', 'error');
        }
    }

    async confirmarEliminar(id) {
        const producto = this.productos.find(p => p.id === id);
        if (!producto) return;
        if (!confirm(`¿Está seguro de eliminar el producto "${producto.nombre}"?\n\nEsta acción no se puede deshacer.\nLas ventas históricas que incluyan este producto permanecerán intactas.`)) return;
        try {
            const formData = new FormData();
            formData.append('accion', 'eliminarProducto');
            formData.append('id', id);
            formData.append('csrf_token', await this.obtenerCsrfToken());
            const response = await fetch(this.apiUrl, { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) {
                this.mostrarNotificacion(data.message, 'success');
                this.filtroStock = null;
                await this.cargarProductos(true);
                if (window.pos?.cache) window.pos.cache.delete(window.pos.apiUrl + '?accion=getProductos');
                this.notificarActualizacionProductos();
            } else {
                this.mostrarNotificacion(data.message || 'Error al eliminar', 'error');
            }
        } catch (error) {
            console.error('Error eliminando producto:', error);
            this.mostrarNotificacion('Error de conexión', 'error');
        }
    }

    renderizarCancelarTicket() {
        const container = document.getElementById('cancelarTicketContent');
        if (!container) return;
        container.innerHTML = `
            <div class="cancelar-ticket-container">
                <div style="background:#fff8e1;border-left:4px solid #f39c12;border-radius:var(--radius-md);padding:1rem 1.5rem;margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:.8rem;">
                    <i class="fas fa-exclamation-triangle" style="color:#f39c12;margin-top:2px;"></i>
                    <div>
                        <strong>Cancelación de Ticket</strong>
                        <p style="margin-top:.3rem;font-size:.9rem;color:var(--gray);">Al cancelar un ticket el stock de los productos será revertido automáticamente. Esta acción <strong>no se puede deshacer</strong>.</p>
                    </div>
                </div>
                <div class="buscar-ticket-box" style="background:white;border-radius:var(--radius-lg);border:2px solid var(--light);padding:1.5rem;margin-bottom:1rem;box-shadow:var(--shadow-sm);">
                    <label style="font-weight:600;color:var(--primary);display:block;margin-bottom:.8rem;">
                        <i class="fas fa-search" style="color:var(--secondary);"></i> Buscar Ticket por Folio
                    </label>
                    <div style="display:flex;gap:.8rem;flex-wrap:wrap;align-items:flex-start;">
                        <div style="flex:1;min-width:200px;">
                            <input type="text" id="folioInput" placeholder="Ej: 71827 · VENTA-20260409-71827 · 20260409"
                                style="width:100%;padding:.8rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;transition:all .3s;outline:none;"
                                autocomplete="off" spellcheck="false">
                            <p style="margin-top:.4rem;font-size:.78rem;color:var(--gray);">
                                <i class="fas fa-info-circle"></i> Puede ingresar el folio completo, los últimos 5 dígitos, la fecha (20260409) o cualquier parte del folio.
                            </p>
                        </div>
                        <button id="btnBuscarTicket" style="background:var(--primary);color:white;border:none;padding:.8rem 1.5rem;border-radius:var(--radius-md);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:.5rem;transition:all .3s;white-space:nowrap;">
                            <i class="fas fa-search"></i> Buscar
                        </button>
                    </div>
                </div>
                <div id="ticketResultado"></div>
            </div>`;

        const folioInput = container.querySelector('#folioInput');
        const btnBuscarTicket = container.querySelector('#btnBuscarTicket');

        if (folioInput) {
            folioInput.addEventListener('focus', () => {
                folioInput.style.borderColor = 'var(--secondary)';
                folioInput.style.boxShadow   = '0 0 0 3px rgba(43,124,48,.2)';
            });
            folioInput.addEventListener('blur', () => {
                folioInput.style.borderColor = 'var(--light)';
                folioInput.style.boxShadow   = 'none';
            });
            folioInput.addEventListener('keypress', e => { if (e.key === 'Enter') this.buscarTicket(); });
            folioInput.focus();
        }

        if (btnBuscarTicket) {
            btnBuscarTicket.addEventListener('click', () => this.buscarTicket());
        }
    }

    async buscarTicket() {
        const folioInput = document.getElementById('folioInput');
        const resultado  = document.getElementById('ticketResultado');
        if (!folioInput || !resultado) return;
        const termino = folioInput.value.trim().toUpperCase();
        if (!termino) { this.mostrarNotificacion('Ingrese un folio o parte de él', 'warning'); folioInput.focus(); return; }
        resultado.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--gray);"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><p style="margin-top:.8rem;">Buscando ticket...</p></div>`;
        try {
            const response = await fetch(`${this.apiUrl}?accion=buscarVentaPorFolio&folio=${encodeURIComponent(termino)}`);
            const data = await response.json();
            if (!data.success) {
                resultado.innerHTML = `<div style="text-align:center;padding:2rem;background:#fef2f2;border-radius:var(--radius-md);border:1px solid #fecaca;"><i class="fas fa-times-circle" style="font-size:3rem;color:var(--danger);opacity:.6;"></i><p style="margin-top:1rem;font-weight:600;color:var(--danger);">${this.escapeHTML(data.message)}</p></div>`;
                return;
            }
            if (data.unico) { this.renderizarTicketEncontrado(data.venta, data.detalles); }
            else { this.renderizarListaTickets(data.ventas); }
        } catch (error) {
            console.error('Error buscando ticket:', error);
            resultado.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--danger);"><i class="fas fa-exclamation-circle" style="font-size:2rem;"></i><p style="margin-top:.8rem;">Error de conexión. Intente de nuevo.</p></div>`;
        }
    }

    renderizarListaTickets(ventas) {
        const resultado = document.getElementById('ticketResultado');
        if (!resultado) return;
        const filas = ventas.map(v => {
            const fecha  = new Date(v.fecha).toLocaleString();
            const total  = parseFloat(v.total).toFixed(2);
            const estado = v.estado === 'cancelada'
                ? '<span style="color:var(--danger);font-weight:600;">Cancelado</span>'
                : '<span style="color:var(--success);font-weight:600;">Activo</span>';
            return `
                <tr style="border-bottom:1px solid var(--light);cursor:pointer;">
                    <td style="padding:.7rem 1rem;font-weight:600;">${this.escapeHTML(v.folio)}</td>
                    <td style="padding:.7rem 1rem;">${fecha}</td>
                    <td style="padding:.7rem 1rem;">${this.escapeHTML(v.metodo_pago)}</td>
                    <td style="padding:.7rem 1rem;font-weight:bold;color:var(--secondary-dark);">$${total}</td>
                    <td style="padding:.7rem 1rem;">${estado}</td>
                    <td style="padding:.7rem 1rem;">
                        <button class="btn-seleccionar-ticket" data-id="${v.id}" style="background:var(--primary);color:white;border:none;padding:.4rem .9rem;border-radius:var(--radius-md);cursor:pointer;font-size:.85rem;display:flex;align-items:center;gap:.4rem;">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                    </td>
                </tr>`;
        }).join('');
        resultado.innerHTML = `
            <div style="background:white;border-radius:var(--radius-lg);border:2px solid var(--light);overflow:hidden;box-shadow:var(--shadow-md);">
                <div style="background:var(--primary);color:white;padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:600;"><i class="fas fa-list"></i> Se encontraron ${ventas.length} ticket(s)</span>
                    <span style="font-size:.85rem;opacity:.8;">Seleccione el que desea cancelar</span>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;min-width:500px;">
                        <thead>
                            <tr style="background:#f8fafc;border-bottom:2px solid var(--light);">
                                <th style="padding:.7rem 1rem;text-align:left;font-size:.85rem;color:var(--gray);">Folio</th>
                                <th style="padding:.7rem 1rem;text-align:left;font-size:.85rem;color:var(--gray);">Fecha</th>
                                <th style="padding:.7rem 1rem;text-align:left;font-size:.85rem;color:var(--gray);">Método</th>
                                <th style="padding:.7rem 1rem;text-align:left;font-size:.85rem;color:var(--gray);">Total</th>
                                <th style="padding:.7rem 1rem;text-align:left;font-size:.85rem;color:var(--gray);">Estado</th>
                                <th style="padding:.7rem 1rem;text-align:left;font-size:.85rem;color:var(--gray);">Acción</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            </div>`;
        resultado.querySelectorAll('.btn-seleccionar-ticket').forEach(btn => {
            btn.addEventListener('click', async () => await this.cargarDetallesYMostrar(parseInt(btn.dataset.id)));
        });
    }

    async cargarDetallesYMostrar(ventaId) {
        const resultado = document.getElementById('ticketResultado');
        if (!resultado) return;
        resultado.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--gray);"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><p style="margin-top:.8rem;">Cargando detalles...</p></div>`;
        try {
            const response = await fetch(`${this.apiUrl}?accion=obtenerDetallesVenta&venta_id=${ventaId}`);
            const data = await response.json();
            if (data.success) { this.renderizarTicketEncontrado(data.venta, data.detalles); }
            else { this.mostrarNotificacion(data.message || 'Error al cargar detalles', 'error'); resultado.innerHTML = ''; }
        } catch (error) {
            console.error('Error cargando detalles:', error);
            this.mostrarNotificacion('Error de conexión', 'error');
            resultado.innerHTML = '';
        }
    }

    renderizarTicketEncontrado(venta, detalles) {
        const resultado = document.getElementById('ticketResultado');
        if (!resultado) return;
        const fecha       = new Date(venta.fecha).toLocaleString();
        const total       = parseFloat(venta.total).toFixed(2);
        const esCancelado = venta.estado === 'cancelada';
        const detallesHTML = detalles.map(d => `
            <tr>
                <td style="padding:.6rem 1rem;">${this.escapeHTML(d.producto_nombre || '(producto eliminado)')}</td>
                <td style="padding:.6rem 1rem;text-align:center;">${d.cantidad}</td>
                <td style="padding:.6rem 1rem;text-align:right;">$${parseFloat(d.precio_unitario).toFixed(2)}</td>
                <td style="padding:.6rem 1rem;text-align:right;font-weight:bold;">$${parseFloat(d.subtotal).toFixed(2)}</td>
            </tr>`).join('');
        resultado.innerHTML = `
            <div style="background:white;border-radius:var(--radius-lg);border:2px solid ${esCancelado ? '#fecaca' : 'var(--light)'};overflow:hidden;box-shadow:var(--shadow-md);">
                <div style="background:${esCancelado ? '#ef4444' : 'linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%)'};color:white;padding:1.2rem 1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;">
                    <div><div style="font-size:.85rem;opacity:.8;">Folio</div><div style="font-size:1.3rem;font-weight:bold;">${this.escapeHTML(venta.folio)}</div></div>
                    <div style="text-align:right;"><div style="font-size:.85rem;opacity:.8;">Fecha</div><div style="font-weight:600;">${fecha}</div></div>
                </div>
                ${esCancelado ? `<div style="background:#fef2f2;border-bottom:2px solid #fecaca;padding:.8rem 1.5rem;text-align:center;color:#ef4444;font-weight:600;"><i class="fas fa-ban"></i> Este ticket ya está CANCELADO — no puede cancelarse de nuevo.</div>` : ''}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;background:var(--light);">
                    <div style="background:white;padding:.8rem 1rem;text-align:center;"><div style="font-size:.75rem;color:var(--gray);margin-bottom:.2rem;">TOTAL</div><div style="font-size:1.3rem;font-weight:bold;color:var(--secondary-dark);">$${total}</div></div>
                    <div style="background:white;padding:.8rem 1rem;text-align:center;"><div style="font-size:.75rem;color:var(--gray);margin-bottom:.2rem;">MÉTODO DE PAGO</div><div style="font-weight:600;color:var(--primary);">${this.escapeHTML(venta.metodo_pago)}</div></div>
                    <div style="background:white;padding:.8rem 1rem;text-align:center;"><div style="font-size:.75rem;color:var(--gray);margin-bottom:.2rem;">PRODUCTOS</div><div style="font-weight:600;color:var(--primary);">${detalles.length} artículo(s)</div></div>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;min-width:400px;">
                        <thead><tr style="background:#f8fafc;border-bottom:2px solid var(--light);">
                            <th style="padding:.6rem 1rem;text-align:left;font-size:.85rem;color:var(--gray);">Producto</th>
                            <th style="padding:.6rem 1rem;text-align:center;font-size:.85rem;color:var(--gray);">Cant.</th>
                            <th style="padding:.6rem 1rem;text-align:right;font-size:.85rem;color:var(--gray);">P. Unit.</th>
                            <th style="padding:.6rem 1rem;text-align:right;font-size:.85rem;color:var(--gray);">Subtotal</th>
                        </tr></thead>
                        <tbody>${detallesHTML}</tbody>
                    </table>
                </div>
                ${!esCancelado ? `
                <div style="padding:1.2rem 1.5rem;border-top:2px solid var(--light);background:#fafafa;">
                    <label style="font-weight:600;color:var(--primary);display:block;margin-bottom:.5rem;"><i class="fas fa-comment-alt" style="color:#f39c12;"></i> Motivo de cancelación *</label>
                    <textarea id="motivoCancelacion" rows="2" placeholder="Ingrese el motivo de la cancelación..."
                        style="width:100%;padding:.8rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;resize:vertical;transition:all .3s;font-family:inherit;outline:none;"></textarea>
                    <div style="display:flex;gap:1rem;margin-top:1rem;flex-wrap:wrap;">
                        <button id="btnConfirmarCancelacion" style="flex:1;min-width:160px;padding:.9rem;background:var(--danger);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:600;font-size:1rem;display:flex;align-items:center;justify-content:center;gap:.5rem;transition:all .3s;">
                            <i class="fas fa-ban"></i> Cancelar Ticket
                        </button>
                        <button id="btnDescartarBusqueda" style="flex:1;min-width:140px;padding:.9rem;background:var(--gray);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:600;font-size:1rem;display:flex;align-items:center;justify-content:center;gap:.5rem;transition:all .3s;">
                            <i class="fas fa-arrow-left"></i> Volver
                        </button>
                    </div>
                </div>` : `
                <div style="padding:1rem 1.5rem;border-top:2px solid var(--light);">
                    <button id="btnDescartarBusqueda" style="width:100%;padding:.9rem;background:var(--primary);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:.5rem;">
                        <i class="fas fa-arrow-left"></i> Buscar otro ticket
                    </button>
                </div>`}
            </div>`;

        const motivoTA = resultado.querySelector('#motivoCancelacion');
        const btnConfirmar = resultado.querySelector('#btnConfirmarCancelacion');
        const btnDescartar = resultado.querySelector('#btnDescartarBusqueda');

        if (motivoTA) {
            motivoTA.addEventListener('focus', () => {
                motivoTA.style.borderColor = 'var(--secondary)';
                motivoTA.style.boxShadow   = '0 0 0 3px rgba(43,124,48,.2)';
            });
            motivoTA.addEventListener('blur', () => {
                motivoTA.style.borderColor = 'var(--light)';
                motivoTA.style.boxShadow   = 'none';
            });
        }

        if (btnConfirmar) {
            btnConfirmar.addEventListener('click', () => this.confirmarCancelacionTicket(venta.folio));
        }

        if (btnDescartar) {
            btnDescartar.addEventListener('click', () => {
                resultado.innerHTML = '';
                const folioInput = document.getElementById('folioInput');
                if (folioInput) { folioInput.value = ''; folioInput.focus(); }
            });
        }
    }

    async confirmarCancelacionTicket(folio) {
        const motivoTA = document.getElementById('motivoCancelacion');
        const motivo   = motivoTA ? motivoTA.value.trim() : '';
        if (!motivo) { this.mostrarNotificacion('Ingrese el motivo de cancelación', 'warning'); motivoTA?.focus(); return; }
        if (!confirm(`¿Está seguro de cancelar el ticket "${folio}"?\n\nEsta acción revertirá el stock de los productos y NO se puede deshacer.`)) return;
        const btnConfirmar = document.getElementById('btnConfirmarCancelacion');
        if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelando...'; }
        try {
            const formData = new FormData();
            formData.append('accion', 'cancelarVenta');
            formData.append('folio', folio);
            formData.append('motivo', motivo);
            formData.append('csrf_token', await this.obtenerCsrfToken());
            const response = await fetch(this.apiUrl, { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) {
                const resultado = document.getElementById('ticketResultado');
                if (resultado) {
                    resultado.innerHTML = `
                        <div style="text-align:center;padding:2.5rem;background:#f0fdf4;border-radius:var(--radius-lg);border:2px solid #86efac;">
                            <i class="fas fa-check-circle" style="font-size:4rem;color:var(--success);margin-bottom:1rem;"></i>
                            <h3 style="color:var(--success);margin-bottom:.5rem;">Ticket Cancelado Exitosamente</h3>
                            <p style="color:var(--gray);margin-bottom:.5rem;">${this.escapeHTML(data.message)}</p>
                            <p style="color:var(--gray);font-size:.9rem;">Monto cancelado: <strong>$${parseFloat(data.monto_cancelado).toFixed(2)}</strong></p>
                            <button id="btnNuevaBusqueda" style="margin-top:1.5rem;background:var(--primary);color:white;border:none;padding:.8rem 2rem;border-radius:var(--radius-md);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:.5rem;">
                                <i class="fas fa-search"></i> Buscar otro ticket
                            </button>
                        </div>`;

                    const btnNueva = resultado.querySelector('#btnNuevaBusqueda');
                    if (btnNueva) {
                        btnNueva.addEventListener('click', () => {
                            resultado.innerHTML = '';
                            const folioInput = document.getElementById('folioInput');
                            if (folioInput) { folioInput.value = ''; folioInput.focus(); }
                        });
                    }
                }
                this.mostrarNotificacion('✅ ' + data.message, 'success');
                await this.cargarProductos(true);
                this.notificarActualizacionProductos();
            } else {
                this.mostrarNotificacion(data.message || 'Error al cancelar', 'error');
                if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.innerHTML = '<i class="fas fa-ban"></i> Cancelar Ticket'; }
            }
        } catch (error) {
            console.error('Error cancelando ticket:', error);
            this.mostrarNotificacion('Error de conexión', 'error');
            if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.innerHTML = '<i class="fas fa-ban"></i> Cancelar Ticket'; }
        }
    }

    mostrarModalImportacion() {
        this.cerrarModalActual();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalImportacion';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-contenido modal-importacion">
                <div class="modal-header">
                    <h3><i class="fas fa-file-excel" style="color:#217346;"></i> Importar Productos desde Excel</h3>
                    <button class="cerrar-modal" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                </div>
                <div style="background:#f0fdf4;border-left:4px solid #217346;border-radius:var(--radius-md);padding:1rem 1.2rem;margin-bottom:1.2rem;">
                    <p style="font-size:.9rem;color:#166534;margin-bottom:.6rem;"><i class="fas fa-info-circle"></i> Descarga la plantilla, rellena los datos y sube el archivo <strong>.xlsx</strong>.</p>
                    <a href="php/plantilla_excel.php" class="btn-plantilla" target="_blank"><i class="fas fa-download"></i> Descargar Plantilla</a>
                </div>
                <div class="drop-zone" id="dropZone">
                    <input type="file" id="archivoExcel" accept=".xlsx" style="display:none;">
                    <i class="fas fa-cloud-upload-alt" style="font-size:3rem;color:var(--gray);opacity:.5;margin-bottom:.8rem;"></i>
                    <p style="color:var(--gray);margin-bottom:.5rem;">Arrastra tu archivo <strong>.xlsx</strong> aquí</p>
                    <p style="color:var(--gray);font-size:.85rem;margin-bottom:1rem;">o</p>
                    <button class="btn-seleccionar-archivo" id="btnSeleccionarArchivo"><i class="fas fa-folder-open"></i> Seleccionar archivo</button>
                    <p id="archivoNombre" style="margin-top:.8rem;font-size:.85rem;color:var(--gray);"></p>
                </div>
                <div id="resultadoImportacion" class="resultado-importacion" style="display:none;"></div>
                <div style="display:flex;gap:1rem;margin-top:1.2rem;">
                    <button class="btn-guardar" id="btnIniciarImportacion" disabled><i class="fas fa-upload"></i> Importar</button>
                    <button class="btn-cancelar" id="btnCancelarImportacion"><i class="fas fa-times"></i> Cancelar</button>
                </div>
            </div>`;
        this.modalActual = modal;
        document.body.appendChild(modal);
        this._initDropZone(modal);

        const cerrarBtn = modal.querySelector('.cerrar-modal');
        const cancelarBtn = modal.querySelector('#btnCancelarImportacion');
        const importarBtn = modal.querySelector('#btnIniciarImportacion');

        if (cerrarBtn) cerrarBtn.addEventListener('click', () => this.cerrarModalActual());
        if (cancelarBtn) cancelarBtn.addEventListener('click', () => this.cerrarModalActual());
        if (importarBtn) importarBtn.addEventListener('click', () => this.procesarImportacion());
    }

    _initDropZone(modal) {
        const dropZone = modal.querySelector('#dropZone');
        const fileInput = modal.querySelector('#archivoExcel');
        const btnSel = modal.querySelector('#btnSeleccionarArchivo');
        const nombreEl = modal.querySelector('#archivoNombre');
        const btnImport = modal.querySelector('#btnIniciarImportacion');

        if (!dropZone || !fileInput || !btnSel || !nombreEl || !btnImport) return;

        btnSel.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files[0]) this._setArchivoSeleccionado(fileInput.files[0], nombreEl, btnImport);
        });
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) { fileInput.files = e.dataTransfer.files; this._setArchivoSeleccionado(file, nombreEl, btnImport); }
        });
    }

    _setArchivoSeleccionado(file, nombreEl, btnImport) {
        if (!file.name.toLowerCase().endsWith('.xlsx')) { this.mostrarNotificacion('Solo se aceptan archivos .xlsx', 'warning'); return; }
        if (file.size > 5 * 1024 * 1024) { this.mostrarNotificacion('El archivo no puede superar 5MB', 'warning'); return; }
        if (nombreEl) nombreEl.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        if (btnImport) btnImport.disabled = false;
    }

    async procesarImportacion() {
        const fileInput = document.getElementById('archivoExcel');
        const btnImport = document.getElementById('btnIniciarImportacion');
        const resultado = document.getElementById('resultadoImportacion');
        if (!fileInput?.files[0]) { this.mostrarNotificacion('Seleccione un archivo primero', 'warning'); return; }
        if (btnImport) { btnImport.disabled = true; btnImport.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...'; }
        if (resultado) resultado.style.display = 'none';
        try {
            const formData = new FormData();
            formData.append('accion', 'importarProductosExcel');
            formData.append('archivo', fileInput.files[0]);
            formData.append('csrf_token', await this.obtenerCsrfToken());
            const response = await fetch(this.apiUrl, { method: 'POST', body: formData });
            const data = await response.json();
            if (resultado) { resultado.style.display = 'block'; resultado.innerHTML = this._renderResultadoImportacion(data); }
            if (data.success && data.importados > 0) {
                this.mostrarNotificacion(`✅ ${data.importados} producto(s) importados`, 'success');
                await this.cargarProductos(true);
                this.notificarActualizacionProductos();
            } else if (!data.success) {
                this.mostrarNotificacion(data.message || 'Error al importar', 'error');
            }
        } catch (error) {
            console.error('Error importando:', error);
            this.mostrarNotificacion('Error de conexión', 'error');
        } finally {
            if (btnImport) { btnImport.disabled = false; btnImport.innerHTML = '<i class="fas fa-upload"></i> Importar'; }
        }
    }

    _renderResultadoImportacion(data) {
        if (!data.success) {
            return `<div class="resultado-error-general"><i class="fas fa-times-circle"></i> ${this.escapeHTML(data.message)}</div>`;
        }
        const erroresHTML = (data.errores || []).map(e =>
            `<li><strong>Fila ${e.fila}:</strong> ${this.escapeHTML(e.mensaje)}</li>`
        ).join('');
        const advertenciasHTML = (data.advertencias || []).map(a =>
            `<li><strong>Fila ${a.fila}:</strong> ${this.escapeHTML(a.mensaje)}</li>`
        ).join('');
        return `
            <div class="resumen-importacion">
                <div class="chip-resultado chip-info"><i class="fas fa-table"></i> ${data.total_filas} filas procesadas</div>
                <div class="chip-resultado chip-success"><i class="fas fa-check-circle"></i> ${data.importados} importados</div>
                ${(data.errores||[]).length > 0 ? `<div class="chip-resultado chip-error"><i class="fas fa-exclamation-circle"></i> ${data.errores.length} errores</div>` : ''}
                ${(data.advertencias||[]).length > 0 ? `<div class="chip-resultado chip-warning"><i class="fas fa-exclamation-triangle"></i> ${data.advertencias.length} duplicados omitidos</div>` : ''}
            </div>
            ${erroresHTML ? `<div class="detalle-errores"><strong style="color:var(--danger);"><i class="fas fa-times-circle"></i> Errores:</strong><ul>${erroresHTML}</ul></div>` : ''}
            ${advertenciasHTML ? `<div class="detalle-advertencias"><strong style="color:#b45309;"><i class="fas fa-exclamation-triangle"></i> Duplicados omitidos:</strong><ul>${advertenciasHTML}</ul></div>` : ''}`;
    }

    async obtenerCsrfToken() {
        const tokenMeta = document.querySelector('meta[name="csrf-token"]');
        if (tokenMeta) return tokenMeta.getAttribute('content');
        try {
            const response = await fetch(this.apiUrl + '?accion=getCsrfToken');
            const data = await response.json();
            if (data.success && data.token) return data.token;
        } catch (error) {
            console.error('Error obteniendo CSRF token:', error);
        }
        return '';
    }

    cargarEventos() {
        const btnAgregar = document.getElementById('btnAgregarProducto');
        if (btnAgregar && btnAgregar.parentNode) {
            const nb = btnAgregar.cloneNode(true);
            btnAgregar.parentNode.replaceChild(nb, btnAgregar);
            nb.addEventListener('click', () => this.mostrarModalFormulario());
        }

        const btnImportar = document.getElementById('btnImportarExcel');
        if (btnImportar && btnImportar.parentNode) {
            const nb = btnImportar.cloneNode(true);
            btnImportar.parentNode.replaceChild(nb, btnImportar);
            nb.addEventListener('click', () => this.mostrarModalImportacion());
        }

        const btnToggleProductos = document.getElementById('btnToggleProductosVisibles');
        if (btnToggleProductos && btnToggleProductos.parentNode) {
            const nb = btnToggleProductos.cloneNode(true);
            btnToggleProductos.parentNode.replaceChild(nb, btnToggleProductos);
            nb.addEventListener('click', () => {
                if (this.productosOcultos) this.mostrarTodosLosProductos();
                else this.ocultarProductos();
            });
            this.actualizarBotonOcultarProductos();
        }

        const buscarInput = document.getElementById('buscarProductoInput');
        if (buscarInput && buscarInput.parentNode) {
            const ni = buscarInput.cloneNode(true);
            buscarInput.parentNode.replaceChild(ni, buscarInput);
            ni.addEventListener('input', () => {
                if (this.buscarTimeout) clearTimeout(this.buscarTimeout);
                this.buscarTimeout = setTimeout(() => this.buscarProductos(), 500);
            });
            ni.addEventListener('keypress', e => {
                if (e.key === 'Enter') { e.preventDefault(); if (this.buscarTimeout) clearTimeout(this.buscarTimeout); this.buscarProductos(); }
            });
        }

        const categoriaSelect = document.getElementById('categoriaFiltro');
        if (categoriaSelect && categoriaSelect.parentNode) {
            const ns = categoriaSelect.cloneNode(true);
            categoriaSelect.parentNode.replaceChild(ns, categoriaSelect);
            ns.addEventListener('change', () => {
                this.filtroStock = null;
                this.buscarProductos();
            });
        }

        const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
        if (btnLimpiar && btnLimpiar.parentNode) {
            const nb = btnLimpiar.cloneNode(true);
            btnLimpiar.parentNode.replaceChild(nb, btnLimpiar);
            nb.addEventListener('click', () => {
                const bi = document.getElementById('buscarProductoInput');
                const cs = document.getElementById('categoriaFiltro');
                if (bi) bi.value = '';
                if (cs) cs.value = 'Todas';
                this.terminoBusqueda = '';
                this.categoriaFiltro = 'Todas';
                this.filtroStock = null;
                this.ocultarProductos();
            });
        }

        const tabProductos = document.getElementById('tabProductos');
        const tabCancelar = document.getElementById('tabCancelarTicket');
        if (tabProductos) tabProductos.addEventListener('click', () => this.cambiarTab('productos'));
        if (tabCancelar) tabCancelar.addEventListener('click', () => this.cambiarTab('cancelar'));

        document.querySelectorAll('.menu-item[data-modulo="productos"]').forEach(item => {
            item.removeEventListener('click', this.menuClickHandler);
            this.menuClickHandler = () => this.mostrarModulo();
            item.addEventListener('click', this.menuClickHandler);
        });
    }

    cambiarTab(tab) {
        this.tabActiva = tab;
        const tabProductos = document.getElementById('tabProductos');
        const tabCancelar = document.getElementById('tabCancelarTicket');
        const contentProductos = document.getElementById('productosContent');
        const contentCancelar = document.getElementById('cancelarTicketContent');
        if (tab === 'productos') {
            if (tabProductos) { tabProductos.style.color = 'var(--primary)'; tabProductos.style.borderBottomColor = 'var(--secondary)'; }
            if (tabCancelar) { tabCancelar.style.color = 'var(--gray)'; tabCancelar.style.borderBottomColor = 'transparent'; }
            if (contentProductos) contentProductos.style.display = 'block';
            if (contentCancelar) contentCancelar.style.display = 'none';
        } else {
            if (tabCancelar) { tabCancelar.style.color = 'var(--primary)'; tabCancelar.style.borderBottomColor = 'var(--secondary)'; }
            if (tabProductos) { tabProductos.style.color = 'var(--gray)'; tabProductos.style.borderBottomColor = 'transparent'; }
            if (contentProductos) contentProductos.style.display = 'none';
            if (contentCancelar) contentCancelar.style.display = 'block';
            this.renderizarCancelarTicket();
        }
    }

    mostrarModulo() {
        document.querySelectorAll('.contenido-principal > section').forEach(s => s.style.display = 'none');
        this._ocultarCarrito();

        const contenidoPrincipal = document.querySelector('.contenido-principal');
        if (!contenidoPrincipal) {
            console.error('No se encontró .contenido-principal en el DOM');
            return;
        }

        let moduloProductos = document.getElementById('moduloProductos');
        if (!moduloProductos) {
            moduloProductos = document.createElement('section');
            moduloProductos.id = 'moduloProductos';
            moduloProductos.className = 'escanner-section modulo-productos-section';
            moduloProductos.innerHTML = this.renderModuloHTML();
            contenidoPrincipal.appendChild(moduloProductos);
        }
        moduloProductos.style.display = 'block';
        this.tabActiva = 'productos';
        setTimeout(async () => { await this.cargarEstadisticas(); this.renderizarTabla([]); this.renderizarEstadisticas(); this.cargarEventos(); }, 50);
    }

    ocultarModulo() {
        this._mostrarCarrito();
    }

    renderModuloHTML() {
        const categoriasOptions = this.categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        return `
            <div class="productos-container">
                <div class="productos-header">
                    <h2><i class="fas fa-box" style="color:var(--secondary);"></i> Administración de Productos</h2>
                    <div style="display:flex;gap:.8rem;flex-wrap:wrap;">
                        <button id="btnImportarExcel" class="btn-importar">
                            <i class="fas fa-file-excel"></i> Importar Excel
                        </button>
                        <button id="btnAgregarProducto" class="btn-agregar">
                            <i class="fas fa-plus"></i> Nuevo Producto
                        </button>
                    </div>
                </div>
                <div style="display:flex;gap:0;border-bottom:2px solid var(--light);margin-bottom:1.5rem;">
                    <button id="tabProductos" style="padding:.8rem 1.5rem;border:none;border-bottom:3px solid var(--secondary);margin-bottom:-2px;background:none;cursor:pointer;font-weight:600;font-size:.95rem;color:var(--primary);display:flex;align-items:center;gap:.5rem;transition:all .2s;">
                        <i class="fas fa-boxes"></i> Productos
                    </button>
                    <button id="tabCancelarTicket" style="padding:.8rem 1.5rem;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;background:none;cursor:pointer;font-weight:600;font-size:.95rem;color:var(--gray);display:flex;align-items:center;gap:.5rem;transition:all .2s;">
                        <i class="fas fa-ban"></i> Cancelar Ticket
                    </button>
                </div>
                <div id="productosContent">
                    <div id="productosStats" class="stats-container"></div>
                    <div class="productos-filtros">
                        <div class="busqueda-container">
                            <i class="fas fa-search"></i>
                            <input type="text" id="buscarProductoInput" placeholder="Buscar por nombre o código de barras...">
                        </div>
                        <div class="filtro-categoria">
                            <i class="fas fa-layer-group"></i>
                            <select id="categoriaFiltro">
                                <option value="Todas">Todas las categorías</option>
                                ${categoriasOptions}
                            </select>
                        </div>
                        <button id="btnLimpiarBusqueda" class="btn-limpiar" title="Limpiar búsqueda">
                            <i class="fas fa-times"></i>
                        </button>
                        <button id="btnToggleProductosVisibles" class="btn-limpiar" title="Mostrar todos los productos" style="width:auto;padding:0 1rem;gap:.5rem;display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-eye"></i> Mostrar todos
                        </button>
                    </div>
                    <div class="productos-tabla-container">
                        <table class="productos-tabla">
                            <thead>
                                <tr>
                                    <th style="width:15%;">Código</th>
                                    <th style="width:30%;">Producto</th>
                                    <th style="width:15%;">Categoría</th>
                                    <th style="width:12%;">Precio</th>
                                    <th style="width:13%;">Stock</th>
                                    <th style="width:15%;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="productosTableBody">
                                <tr><td colspan="6" style="text-align:center;padding:2rem;">Productos ocultos. Use la búsqueda, categoría o el botón “Mostrar todos”.<\/td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div id="cancelarTicketContent" style="display:none;"></div>
            </div>`;
    }

    cerrarModalActual() {
        if (this.modalActual && this.modalActual.parentNode) { this.modalActual.remove(); this.modalActual = null; }
    }

    actualizarUI() {
        if (document.getElementById('moduloProductos')?.style.display === 'block') {
            this.renderizarTabla();
            this.renderizarEstadisticas();
            this.actualizarBotonOcultarProductos();
        }
    }

    escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.createElement('div');
        const colores = { success: '#27AE60', error: '#E74C3C', warning: '#F39C12' };
        const iconos = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
        notificacion.style.cssText = `
            position:fixed;top:20px;right:20px;padding:1rem 1.5rem;background:${colores[tipo] || '#333'};
            color:white;border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:3000;
            animation:slideInRight .3s;display:flex;align-items:center;gap:1rem;font-weight:500;
            max-width:400px;min-width:300px;
            border-left:5px solid ${tipo === 'success' ? '#1e8449' : tipo === 'error' ? '#c0392b' : '#e67e22'};`;
        notificacion.innerHTML = `
            <i class="fas ${iconos[tipo] || 'fa-info-circle'}" style="font-size:1.2rem;"></i>
            <span>${mensaje}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;margin-left:auto;">×</button>`;
        document.body.appendChild(notificacion);
        setTimeout(() => { if (notificacion.parentNode) notificacion.remove(); }, 3000);
    }

    notificarActualizacionProductos() {
        window.dispatchEvent(new CustomEvent('productos-actualizados'));
    }

    destroy() {
        this.cerrarModalActual();
        if (this.buscarTimeout) clearTimeout(this.buscarTimeout);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.moduloProductos = new ModuloProductos(); window.moduloProductos.init(); });
} else {
    window.moduloProductos = new ModuloProductos();
    window.moduloProductos.init();
}

window.addEventListener('beforeunload', () => { if (window.moduloProductos) window.moduloProductos.destroy(); });