class POSSystem {
    constructor() {
        this.carrito = [];
        this.productos = [];
        this.categoriaActiva = 'Todas';
        this.metodoPagoActivo = null;
        this.cargando = false;
        this.apiUrl = 'php/api.php'; // Ruta correcta
        this.init();
    }
    
    async init() {
        this.cargarEventos();
        await this.cargarProductosDesdeBD();
        this.actualizarCarrito();
        this.initResponsive();
        this.agregarRippleEffect();
        this.iniciarBuscadorPredictivo();
        
        setTimeout(() => {
            document.getElementById('codigoBarras').focus();
        }, 500);
    }
    
    async cargarProductosDesdeBD() {
        this.mostrarCargando(true);
        try {
            // CORREGIDO: this.apiUrl + ?accion=
            const response = await fetch(this.apiUrl + '?accion=getProductos');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.productos = data;
            this.mostrarProductos(this.productos);
        } catch (error) {
            console.error('Error cargando productos:', error);
            this.mostrarNotificacion('Error al cargar productos: ' + error.message, 'error');
        } finally {
            this.mostrarCargando(false);
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
        if (this.cargando) return;
        this.cargando = true;
        
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
                this.renderizarCarrito(data.carrito);
                this.mostrarNotificacion('Producto agregado al carrito', 'success');
            } else {
                this.mostrarNotificacion(data.message || 'Error al agregar producto', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error de conexión: ' + error.message, 'error');
        } finally {
            this.cargando = false;
            
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
            // CORREGIDO
            const response = await fetch(this.apiUrl + '?accion=buscarPorCodigo&codigo=' + encodeURIComponent(termino));
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const producto = await response.json();
            
            if (producto) {
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
            // CORREGIDO
            const response = await fetch(this.apiUrl + '?accion=buscarProductos&termino=' + encodeURIComponent(termino));
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const productos = await response.json();
            
            if (productos.length === 0) {
                sugerenciasDiv.classList.remove('active');
                sugerenciasDiv.innerHTML = '';
                return;
            }
            
            sugerenciasDiv.innerHTML = productos.slice(0, 8).map(producto => `
                <div class="sugerencia-item" data-id="${producto.id}">
                    <div class="sugerencia-info">
                        <div class="sugerencia-nombre">${producto.nombre}</div>
                        <div class="sugerencia-descripcion">
                            <span class="sugerencia-codigo">${producto.codigo_barras}</span>
                            <span>${producto.descripcion || ''}</span>
                        </div>
                        <div class="sugerencia-stock ${producto.stock_actual <= producto.stock_minimo ? 'stock-bajo-sugerencia' : ''}">
                            <i class="fas fa-box"></i> Stock: ${producto.stock_actual}
                        </div>
                    </div>
                    <div class="sugerencia-precio">$${parseFloat(producto.precio_venta).toFixed(2)}</div>
                </div>
            `).join('');
            
            sugerenciasDiv.classList.add('active');
            
            sugerenciasDiv.querySelectorAll('.sugerencia-item').forEach(item => {
                item.addEventListener('click', () => {
                    const productoId = item.dataset.id;
                    if (productoId) {
                        this.agregarAlCarrito(parseInt(productoId));
                    }
                });
            });
            
        } catch (error) {
            console.error('Error en sugerencias:', error);
        }
    }
    
    async actualizarCarrito() {
        try {
            // CORREGIDO
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
        }
    }
    
    async filtrarProductos() {
        this.mostrarCargando(true);
        try {
            // CORREGIDO
            const response = await fetch(this.apiUrl + '?accion=getProductosPorCategoria&categoria=' + encodeURIComponent(this.categoriaActiva));
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const productos = await response.json();
            this.mostrarProductos(productos);
        } catch (error) {
            console.error('Error filtrando:', error);
            this.mostrarNotificacion('Error al filtrar: ' + error.message, 'error');
        } finally {
            this.mostrarCargando(false);
        }
    }
    
    async procesarVenta() {
        if (this.carrito.length === 0) {
            this.mostrarNotificacion('El carrito está vacío', 'warning');
            return;
        }
        
        if (!this.metodoPagoActivo) {
            this.mostrarNotificacion('Seleccione un método de pago', 'warning');
            return;
        }
        
        if (this.metodoPagoActivo === 'Efectivo') {
            const efectivoInput = document.getElementById('efectivoRecibido');
            const efectivo = parseFloat(efectivoInput?.value);
            const total = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
            
            if (!efectivoInput?.value || efectivoInput.value === '') {
                this.mostrarNotificacion('Ingrese la cantidad de efectivo', 'warning');
                efectivoInput.focus();
                return;
            }
            
            if (isNaN(efectivo) || efectivo <= 0 || efectivo < total) {
                this.mostrarNotificacion('Efectivo insuficiente', 'error');
                efectivoInput.focus();
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
            if (efectivoRecibido) formData.append('efectivo_recibido', efectivoRecibido);
            if (cambio) formData.append('cambio', cambio);
            
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
                await this.cargarProductosDesdeBD();
                
                this.carrito = [];
                this.renderizarCarrito({ items: [], subtotal: 0, total: 0 });
                
                this.mostrarNotificacion('Venta procesada exitosamente', 'success');
                
                this.metodoPagoActivo = null;
                document.querySelectorAll('.metodo-pago-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('efectivoSection').style.display = 'none';
                if (document.getElementById('efectivoRecibido')) {
                    document.getElementById('efectivoRecibido').value = '';
                }
            } else {
                this.mostrarNotificacion(data.message || 'Error al procesar venta', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarNotificacion('Error de conexión: ' + error.message, 'error');
        } finally {
            this.cargando = false;
        }
    }
    
    mostrarProductos(productos) {
        const grid = document.getElementById('productosGrid');
        if (!grid) return;
        
        if (productos.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--gray);">No hay productos disponibles</div>';
            return;
        }
        
        grid.innerHTML = productos.map(producto => `
            <div class="producto-card" data-id="${producto.id}">
                <h3>${producto.nombre}</h3>
                <div class="precio">$${parseFloat(producto.precio_venta).toFixed(2)}</div>
                <div class="stock ${producto.stock_actual <= producto.stock_minimo ? 'stock-bajo' : ''}">
                    <i class="fas fa-box"></i> ${producto.stock_actual} disponibles
                </div>
                <small>${producto.descripcion || ''}</small>
            </div>
        `).join('');
        
        grid.querySelectorAll('.producto-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                if (id) this.agregarAlCarrito(parseInt(id));
            });
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
                </div>
            `;
        } else {
            container.innerHTML = data.items.map(item => `
                <div class="carrito-item">
                    <div class="item-info">
                        <h4>${item.nombre}</h4>
                        <p>${item.descripcion || ''}</p>
                        <div class="cantidad-control">
                            <button onclick="pos.modificarCantidad(${item.id}, ${item.cantidad - 1})">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" value="${item.cantidad}" min="1" max="${item.stock}" 
                                   onchange="pos.modificarCantidad(${item.id}, parseInt(this.value) || 1)">
                            <button onclick="pos.modificarCantidad(${item.id}, ${item.cantidad + 1})">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="item-precio">
                        <div class="precio">$${parseFloat(item.precio).toFixed(2)}</div>
                        <small>$${parseFloat(item.subtotal).toFixed(2)}</small>
                        <button onclick="pos.eliminarDelCarrito(${item.id})" 
                                style="background: none; border: none; color: var(--danger); cursor: pointer; margin-top: 0.3rem;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
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
        }
        
        const btnProcesar = document.getElementById('btnProcesar');
        if (btnProcesar) {
            btnProcesar.addEventListener('click', () => {
                this.procesarVenta();
            });
        }
        
        this.initResponsive();
    }
    
    initResponsive() {
        if (!document.querySelector('.toggle-carrito-mobile')) {
            const toggleCarrito = document.createElement('button');
            toggleCarrito.className = 'toggle-carrito-mobile';
            toggleCarrito.innerHTML = '<i class="fas fa-shopping-cart"></i> Ver Carrito';
            document.body.appendChild(toggleCarrito);
            
            toggleCarrito.addEventListener('click', () => {
                document.querySelector('.carrito-panel').classList.add('visible');
            });
        }
        
        if (!document.querySelector('.toggle-menu-mobile')) {
            const toggleMenu = document.createElement('button');
            toggleMenu.className = 'toggle-menu-mobile';
            toggleMenu.innerHTML = '<i class="fas fa-bars"></i> Menú';
            document.body.appendChild(toggleMenu);
            
            toggleMenu.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('mobile-visible');
            });
        }
    }
    
    agregarRippleEffect() {
        document.querySelectorAll('.metodo-pago-btn, .filtro-btn, .btn-procesar').forEach(button => {
            button.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                ripple.classList.add('ripple');
                
                const rect = button.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                
                const existingRipple = button.querySelector('.ripple');
                if (existingRipple) existingRipple.remove();
                
                button.appendChild(ripple);
                
                setTimeout(() => {
                    if (ripple && ripple.parentNode) ripple.remove();
                }, 600);
            });
        });
    }
    
    iniciarBuscadorPredictivo() {
        const inputBusqueda = document.getElementById('codigoBarras');
        const sugerenciasDiv = document.getElementById('sugerencias');
        
        if (!inputBusqueda || !sugerenciasDiv) return;
        
        let timeoutId = null;
        
        inputBusqueda.addEventListener('input', (e) => {
            const termino = e.target.value.trim();
            
            if (timeoutId) clearTimeout(timeoutId);
            
            if (termino.length < 2) {
                sugerenciasDiv.classList.remove('active');
                sugerenciasDiv.innerHTML = '';
                return;
            }
            
            timeoutId = setTimeout(() => {
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
                } else {
                    const next = activeItem.nextElementSibling;
                    if (next) {
                        activeItem.classList.remove('active');
                        next.classList.add('active');
                    }
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!activeItem) {
                    items[items.length - 1].classList.add('active');
                } else {
                    const prev = activeItem.previousElementSibling;
                    if (prev) {
                        activeItem.classList.remove('active');
                        prev.classList.add('active');
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
                cambioEl.style.color = 'var(--success)';
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
                <span>${item.cantidad}x ${item.nombre}</span>
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
                    <div class="ticket-item">
                        <span>TOTAL:</span>
                        <span>$${parseFloat(venta.total).toFixed(2)}</span>
                    </div>
                </div>
                <div>
                    <p>¡Gracias por su compra!</p>
                    <p>Vuelva pronto</p>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
    
    mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion notificacion-${tipo}`;
        notificacion.innerHTML = `
            <i class="fas ${tipo === 'success' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
            ${mensaje}
        `;
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${tipo === 'success' ? '#27AE60' : tipo === 'error' ? '#E74C3C' : '#F39C12'};
            color: white;
            border-radius: 12px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            z-index: 3000;
            animation: slideInRight 0.3s;
            display: flex;
            align-items: center;
            gap: 0.8rem;
            font-weight: 500;
            max-width: 350px;
        `;
        
        document.body.appendChild(notificacion);
        
        setTimeout(() => {
            notificacion.style.animation = 'fadeOut 0.3s';
            setTimeout(() => {
                if (document.body.contains(notificacion)) {
                    document.body.removeChild(notificacion);
                }
            }, 300);
        }, 2700);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.pos = new POSSystem();
});