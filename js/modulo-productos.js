// modulo-productos.js - Módulo de administración de productos

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
    }
    
    async init() {
        await this.cargarProductos();
        this.cargarEventos();
    }
    
    async cargarProductos() {
        if (this.cargando) return;
        this.cargando = true;
        
        try {
            const response = await fetch(`${this.apiUrl}?accion=getProductosAdmin&_t=${Date.now()}`);
            const data = await response.json();
            
            if (data.success) {
                this.productos = data.productos;
                await this.cargarEstadisticas();
                
                const moduloVisible = document.getElementById('moduloProductos')?.style.display === 'block';
                if (moduloVisible) {
                    this.renderizarTabla();
                    this.renderizarEstadisticas();
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
                if (moduloVisible) {
                    this.renderizarEstadisticas();
                }
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }
    
    async buscarProductos() {
        const terminoInput = document.getElementById('buscarProductoInput');
        const categoriaSelect = document.getElementById('categoriaFiltro');
        
        const termino = terminoInput ? terminoInput.value : '';
        const categoria = categoriaSelect ? categoriaSelect.value : 'Todas';
        
        this.terminoBusqueda = termino;
        this.categoriaFiltro = categoria;
        
        try {
            let url = `${this.apiUrl}?accion=buscarProductosAdmin&_t=${Date.now()}`;
            if (termino) {
                url += `&termino=${encodeURIComponent(termino)}`;
            }
            if (categoria && categoria !== 'Todas') {
                url += `&categoria=${encodeURIComponent(categoria)}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                this.productos = data.productos;
                this.renderizarTabla();
            }
        } catch (error) {
            console.error('Error buscando productos:', error);
            this.mostrarNotificacion('Error al buscar', 'error');
        }
    }
    
    renderizarEstadisticas() {
        if (!this.estadisticas) return;
        
        const container = document.getElementById('productosStats');
        if (!container) return;
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-boxes"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${this.estadisticas.total_productos}</span>
                        <span class="stat-label">Total Productos</span>
                    </div>
                </div>
                <div class="stat-card ${this.estadisticas.stock_bajo > 0 ? 'warning' : ''}">
                    <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${this.estadisticas.stock_bajo}</span>
                        <span class="stat-label">Stock Bajo</span>
                    </div>
                </div>
                <div class="stat-card ${this.estadisticas.sin_stock > 0 ? 'danger' : ''}">
                    <div class="stat-icon"><i class="fas fa-times-circle"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${this.estadisticas.sin_stock}</span>
                        <span class="stat-label">Sin Stock</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderizarTabla() {
        const container = document.getElementById('productosTableBody');
        if (!container) return;
        
        if (this.productos.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 3rem;">
                        <i class="fas fa-box-open" style="font-size: 3rem; color: var(--gray); opacity: 0.5;"></i>
                        <p style="margin-top: 1rem;">No hay productos registrados</p>
                        <button class="btn-agregar-producto" style="margin-top: 1rem; background: var(--secondary); color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer;">
                            <i class="fas fa-plus"></i> Agregar Producto
                        </button>
                    </td>
                </tr>
            `;
            
            const btnAgregar = container.querySelector('.btn-agregar-producto');
            if (btnAgregar) {
                btnAgregar.addEventListener('click', () => this.mostrarModalFormulario());
            }
            return;
        }
        
        let html = '';
        
        for (const producto of this.productos) {
            const stockClass = producto.stock_actual <= 0 ? 'stock-critico' : 
                              (producto.stock_actual <= producto.stock_minimo ? 'stock-bajo' : 'stock-normal');
            
            const tieneVentas = (producto.ventas_asociadas && producto.ventas_asociadas > 0);
            const puedeEliminar = !tieneVentas;
            
            html += `
                <tr data-id="${producto.id}">
                    <td style="vertical-align: middle;">
                        <span class="codigo-barras">${this.escapeHTML(producto.codigo_barras)}</span>
                    </td>
                    <td style="vertical-align: middle;">
                        <div style="font-weight: 600; margin-bottom: 4px;">${this.escapeHTML(producto.nombre)}</div>
                        ${producto.descripcion ? `<div style="font-size: 0.8rem; color: var(--gray);">${this.escapeHTML(producto.descripcion)}</div>` : ''}
                    </td>
                    <td style="vertical-align: middle;">
                        <span class="categoria-badge">${producto.categoria}</span>
                    </td>
                    <td style="vertical-align: middle; font-weight: bold; color: var(--secondary-dark);">
                        $${parseFloat(producto.precio).toFixed(2)}
                    </td>
                    <td style="vertical-align: middle; text-align: center;">
                        <span class="stock-indicator ${stockClass}" style="display: inline-block; font-weight: bold; font-size: 1.1rem;">
                            ${producto.stock_actual}
                        </span>
                        <div style="font-size: 0.7rem; color: var(--gray);">Mín: ${producto.stock_minimo}</div>
                    </td>
                    <td style="vertical-align: middle; white-space: nowrap;">
                        <button class="btn-editar" data-id="${producto.id}" title="Editar" style="background: var(--primary); color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; margin-right: 8px; transition: all 0.2s;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-eliminar" data-id="${producto.id}" title="Eliminar" ${!puedeEliminar ? 'disabled' : ''} style="background: var(--danger); color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: ${!puedeEliminar ? 'not-allowed' : 'pointer'}; opacity: ${!puedeEliminar ? '0.5' : '1'}; transition: all 0.2s;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
        
        container.innerHTML = html;
        
        container.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this.editarProducto(id);
            });
            btn.addEventListener('mouseenter', (e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
            });
            btn.addEventListener('mouseleave', (e) => {
                e.currentTarget.style.transform = 'scale(1)';
            });
        });
        
        container.querySelectorAll('.btn-eliminar:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this.confirmarEliminar(id);
            });
            btn.addEventListener('mouseenter', (e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
            });
            btn.addEventListener('mouseleave', (e) => {
                e.currentTarget.style.transform = 'scale(1)';
            });
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
        
        const categoriasOptions = this.categorias.map(cat => `
            <option value="${cat}" ${producto && producto.categoria === cat ? 'selected' : ''}>${cat}</option>
        `).join('');
        
        modal.innerHTML = `
            <div class="modal-contenido modal-producto">
                <div class="modal-header">
                    <h3>
                        <i class="fas ${producto ? 'fa-edit' : 'fa-plus-circle'}" style="color: var(--secondary);"></i>
                        ${producto ? 'Editar Producto' : 'Nuevo Producto'}
                    </h3>
                    <button class="cerrar-modal" aria-label="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="productoForm" class="producto-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="codigo_barras">
                                <i class="fas fa-barcode"></i> Código de Barras *
                            </label>
                            <input type="text" id="codigo_barras" name="codigo_barras" 
                                   value="${producto ? this.escapeHTML(producto.codigo_barras) : ''}"
                                   required maxlength="50" placeholder="Código de barras">
                        </div>
                        
                        <div class="form-group">
                            <label for="nombre">
                                <i class="fas fa-tag"></i> Nombre *
                            </label>
                            <input type="text" id="nombre" name="nombre" 
                                   value="${producto ? this.escapeHTML(producto.nombre) : ''}"
                                   required maxlength="100" placeholder="Nombre del producto">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="descripcion">
                            <i class="fas fa-align-left"></i> Descripción
                        </label>
                        <textarea id="descripcion" name="descripcion" rows="3" 
                                  placeholder="Descripción del producto">${producto ? this.escapeHTML(producto.descripcion || '') : ''}</textarea>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="categoria">
                                <i class="fas fa-layer-group"></i> Categoría
                            </label>
                            <select id="categoria" name="categoria">
                                ${categoriasOptions}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="precio">
                                <i class="fas fa-dollar-sign"></i> Precio *
                            </label>
                            <input type="number" id="precio" name="precio" 
                                   value="${producto ? producto.precio : ''}"
                                   step="0.01" min="0" required placeholder="0.00">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="stock_minimo">
                                <i class="fas fa-flag-checkered"></i> Stock Mínimo
                            </label>
                            <input type="number" id="stock_minimo" name="stock_minimo" 
                                   value="${producto ? producto.stock_minimo : '5'}"
                                   min="0" placeholder="Stock mínimo">
                        </div>
                        
                        <div class="form-group">
                            <label for="stock_actual">
                                <i class="fas fa-box"></i> Stock Actual
                            </label>
                            <input type="number" id="stock_actual" name="stock_actual" 
                                   value="${producto ? producto.stock_actual : '0'}"
                                   min="0" placeholder="Stock actual">
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn-guardar">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                        <button type="button" class="btn-cancelar">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        this.modalActual = modal;
        document.body.appendChild(modal);
        
        modal.querySelector('.cerrar-modal').addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-cancelar').addEventListener('click', () => this.cerrarModalActual());
        
        const form = modal.querySelector('#productoForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarProducto();
        });
        
        modal.querySelector('#codigo_barras')?.focus();
    }
    
    async guardarProducto() {
        const form = document.getElementById('productoForm');
        if (!form) return;
        
        const datos = {
            codigo_barras: form.querySelector('#codigo_barras').value.trim(),
            nombre: form.querySelector('#nombre').value.trim(),
            descripcion: form.querySelector('#descripcion').value,
            categoria: form.querySelector('#categoria').value,
            precio: parseFloat(form.querySelector('#precio').value),
            stock_minimo: parseInt(form.querySelector('#stock_minimo').value) || 0,
            stock_actual: parseInt(form.querySelector('#stock_actual').value) || 0
        };
        
        if (!datos.codigo_barras) {
            this.mostrarNotificacion('El código de barras es requerido', 'warning');
            return;
        }
        
        if (!datos.nombre) {
            this.mostrarNotificacion('El nombre es requerido', 'warning');
            return;
        }
        
        if (isNaN(datos.precio) || datos.precio < 0) {
            this.mostrarNotificacion('El precio debe ser un valor válido', 'warning');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('accion', this.editandoId ? 'actualizarProducto' : 'registrarProducto');
            if (this.editandoId) {
                formData.append('id', this.editandoId);
            }
            formData.append('codigo_barras', datos.codigo_barras);
            formData.append('nombre', datos.nombre);
            formData.append('descripcion', datos.descripcion);
            formData.append('categoria', datos.categoria);
            formData.append('precio', datos.precio);
            formData.append('stock_minimo', datos.stock_minimo);
            formData.append('stock_actual', datos.stock_actual);
            
            const csrfToken = await this.obtenerCsrfToken();
            formData.append('csrf_token', csrfToken);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.cerrarModalActual();
                this.mostrarNotificacion(data.message, 'success');
                await this.cargarProductos();
                
                if (window.pos && window.pos.cache) {
                    window.pos.cache.delete(window.pos.apiUrl + '?accion=getProductos');
                }
                
                this.notificarActualizacionProductos();
                
                const terminoInput = document.getElementById('buscarProductoInput');
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
        
        if (producto.ventas_asociadas && producto.ventas_asociadas > 0) {
            this.mostrarNotificacion(`No se puede eliminar "${producto.nombre}" porque tiene ${producto.ventas_asociadas} venta(s) asociada(s)`, 'error');
            return;
        }
        
        const confirmacion = confirm(`¿Está seguro de eliminar el producto "${producto.nombre}"?\nEsta acción no se puede deshacer.`);
        
        if (confirmacion) {
            try {
                const formData = new FormData();
                formData.append('accion', 'eliminarProducto');
                formData.append('id', id);
                
                const csrfToken = await this.obtenerCsrfToken();
                formData.append('csrf_token', csrfToken);
                
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.mostrarNotificacion(data.message, 'success');
                    await this.cargarProductos();
                    
                    if (window.pos && window.pos.cache) {
                        window.pos.cache.delete(window.pos.apiUrl + '?accion=getProductos');
                    }
                    
                    this.notificarActualizacionProductos();
                } else {
                    this.mostrarNotificacion(data.message || 'Error al eliminar', 'error');
                }
            } catch (error) {
                console.error('Error eliminando producto:', error);
                this.mostrarNotificacion('Error de conexión', 'error');
            }
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
    
    cargarEventos() {
        const btnAgregar = document.getElementById('btnAgregarProducto');
        if (btnAgregar) {
            const newBtn = btnAgregar.cloneNode(true);
            btnAgregar.parentNode.replaceChild(newBtn, btnAgregar);
            newBtn.addEventListener('click', () => {
                this.mostrarModalFormulario();
            });
        }
        
        const buscarInput = document.getElementById('buscarProductoInput');
        if (buscarInput) {
            const newInput = buscarInput.cloneNode(true);
            buscarInput.parentNode.replaceChild(newInput, buscarInput);
            
            newInput.addEventListener('input', (e) => {
                if (this.buscarTimeout) clearTimeout(this.buscarTimeout);
                this.buscarTimeout = setTimeout(() => {
                    this.buscarProductos();
                }, 500);
            });
            
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.buscarTimeout) clearTimeout(this.buscarTimeout);
                    this.buscarProductos();
                }
            });
        }
        
        const categoriaSelect = document.getElementById('categoriaFiltro');
        if (categoriaSelect) {
            const newSelect = categoriaSelect.cloneNode(true);
            categoriaSelect.parentNode.replaceChild(newSelect, categoriaSelect);
            
            newSelect.addEventListener('change', () => {
                this.buscarProductos();
            });
        }
        
        const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
        if (btnLimpiar) {
            const newBtn = btnLimpiar.cloneNode(true);
            btnLimpiar.parentNode.replaceChild(newBtn, btnLimpiar);
            
            newBtn.addEventListener('click', () => {
                const buscarInputElement = document.getElementById('buscarProductoInput');
                const categoriaSelectElement = document.getElementById('categoriaFiltro');
                
                if (buscarInputElement) buscarInputElement.value = '';
                if (categoriaSelectElement) categoriaSelectElement.value = 'Todas';
                
                this.terminoBusqueda = '';
                this.categoriaFiltro = 'Todas';
                this.cargarProductos();
            });
        }
        
        document.querySelectorAll('.menu-item[data-modulo="productos"]').forEach(item => {
            item.removeEventListener('click', this.menuClickHandler);
            this.menuClickHandler = () => this.mostrarModulo();
            item.addEventListener('click', this.menuClickHandler);
        });
    }
    
    mostrarModulo() {
        document.querySelectorAll('.contenido-principal > section').forEach(s => {
            s.style.display = 'none';
        });
        
        const carritoPanel = document.querySelector('.carrito-panel');
        if (carritoPanel && window.innerWidth <= 992) {
            carritoPanel.classList.remove('visible');
        }
        
        let moduloProductos = document.getElementById('moduloProductos');
        if (!moduloProductos) {
            moduloProductos = document.createElement('section');
            moduloProductos.id = 'moduloProductos';
            moduloProductos.className = 'modulo-productos';
            moduloProductos.innerHTML = this.renderModuloHTML();
            document.querySelector('.contenido-principal').appendChild(moduloProductos);
        }
        
        moduloProductos.style.display = 'block';
        
        setTimeout(() => {
            this.cargarProductos();
            this.cargarEventos();
        }, 50);
    }
    
    renderModuloHTML() {
        const categoriasOptions = this.categorias.map(cat => 
            `<option value="${cat}">${cat}</option>`
        ).join('');
        
        return `
            <div class="productos-container">
                <div class="productos-header">
                    <h2>
                        <i class="fas fa-box" style="color: var(--secondary);"></i>
                        Administración de Productos
                    </h2>
                    <button id="btnAgregarProducto" class="btn-agregar">
                        <i class="fas fa-plus"></i> Nuevo Producto
                    </button>
                </div>
                
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
                </div>
                
                <div class="productos-tabla-container">
                    <table class="productos-tabla">
                        <thead>
                            <tr>
                                <th style="width: 15%;">Código</th>
                                <th style="width: 30%;">Producto</th>
                                <th style="width: 15%;">Categoría</th>
                                <th style="width: 12%;">Precio</th>
                                <th style="width: 13%;">Stock</th>
                                <th style="width: 15%;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="productosTableBody">
                            <tr><td colspan="6" style="text-align: center; padding: 2rem;">Cargando productos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    cerrarModalActual() {
        if (this.modalActual && this.modalActual.parentNode) {
            this.modalActual.remove();
            this.modalActual = null;
        }
    }
    
    actualizarUI() {
        if (document.getElementById('moduloProductos')?.style.display === 'block') {
            this.renderizarTabla();
            this.renderizarEstadisticas();
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
        notificacion.className = `notificacion notificacion-${tipo}`;
        
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
        
        notificacion.innerHTML = `
            <i class="fas ${iconos[tipo]}" style="font-size: 1.2rem;"></i>
            <span>${mensaje}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; margin-left: auto;">×</button>
        `;
        
        document.body.appendChild(notificacion);
        
        setTimeout(() => {
            if (notificacion.parentNode) notificacion.remove();
        }, 3000);
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
    document.addEventListener('DOMContentLoaded', () => {
        window.moduloProductos = new ModuloProductos();
        window.moduloProductos.init();
    });
} else {
    window.moduloProductos = new ModuloProductos();
    window.moduloProductos.init();
}

window.addEventListener('beforeunload', () => {
    if (window.moduloProductos) {
        window.moduloProductos.destroy();
    }
});