// Clase principal del POS - VERSIÓN MEJORADA
class POSSystem {
    constructor() {
        this.carrito = [];
        this.productos = [];
        this.categoriaActiva = 'Todos';
        this.metodoPagoActivo = null;
        this.init();
    }
    
    async init() {
        this.cargarEventos();
        this.cargarProductos();
        this.actualizarCarrito();
        this.initResponsive();
        
        // Enfocar input de escáner automáticamente
        setTimeout(() => {
            document.getElementById('codigoBarras').focus();
        }, 500);
    }
    
    initResponsive() {
        // Crear botones para móvil si no existen
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
        
        // Cerrar sidebar al hacer clic fuera en móvil
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992) {
                const sidebar = document.querySelector('.sidebar');
                const toggleMenu = document.querySelector('.toggle-menu-mobile');
                
                if (!sidebar.contains(e.target) && !toggleMenu.contains(e.target)) {
                    sidebar.classList.remove('mobile-visible');
                }
            }
        });
    }
    
    cargarEventos() {
        // Escáner de código de barras
        const inputCodigo = document.getElementById('codigoBarras');
        if (inputCodigo) {
            inputCodigo.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.buscarPorCodigo(e.target.value);
                    e.target.value = '';
                }
            });
        }
        
        // Botón de escáner
        const btnScanner = document.querySelector('.btn-escanner');
        if (btnScanner) {
            btnScanner.addEventListener('click', () => {
                const input = document.getElementById('codigoBarras');
                this.buscarPorCodigo(input.value);
                input.value = '';
                input.focus();
            });
        }
        
        // Filtros de categoría
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.categoriaActiva = e.target.textContent;
                this.filtrarProductos();
            });
        });
        
        // Métodos de pago
        document.querySelectorAll('.metodo-pago-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.metodo-pago-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.metodoPagoActivo = e.target.dataset.metodo;
            });
        });
        
        // Botón procesar venta
        const btnProcesar = document.getElementById('btnProcesar');
        if (btnProcesar) {
            btnProcesar.addEventListener('click', () => {
                this.procesarVenta();
            });
        }
        
        // Cerrar carrito al hacer clic fuera en móvil
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992) {
                const carritoPanel = document.querySelector('.carrito-panel');
                const toggleCarrito = document.querySelector('.toggle-carrito-mobile');
                
                if (!carritoPanel.contains(e.target) && !toggleCarrito.contains(e.target) && carritoPanel.classList.contains('visible')) {
                    carritoPanel.classList.remove('visible');
                }
            }
        });
    }
    
    async cargarProductos() {
        try {
            // Simulación de carga de productos (en producción usarías fetch a tu PHP)
            this.productos = [
                { id: 1, codigo_barras: '7501234567891', nombre: 'Pintura Blanca Mate', descripcion: 'Blanco, 19L', categoria: 'Interiores', marca: 'Comex', precio_venta: 450.50, stock_actual: 20, stock_minimo: 5 },
                { id: 2, codigo_barras: '7501234567892', nombre: 'Rodillo Pro 9"', descripcion: 'Alta calidad', categoria: 'Todos', marca: 'Wooster', precio_venta: 89.90, stock_actual: 15, stock_minimo: 3 },
                { id: 3, codigo_barras: '7501234567893', nombre: 'Pintura Azul Cielo', descripcion: 'Azul cielo, 4L', categoria: 'Interiores', marca: 'Berel', precio_venta: 250.00, stock_actual: 8, stock_minimo: 5 },
                { id: 4, codigo_barras: '7501234567894', nombre: 'Pintura Exterior Blanca', descripcion: 'Blanco exterior, 19L', categoria: 'Exteriores', marca: 'Comex', precio_venta: 520.00, stock_actual: 6, stock_minimo: 5 },
                { id: 5, codigo_barras: '7501234567895', nombre: 'Brocha Plana 3"', descripcion: 'Cerda sintética', categoria: 'Todos', marca: 'Wooster', precio_venta: 75.00, stock_actual: 12, stock_minimo: 5 },
                { id: 6, codigo_barras: '7501234567896', nombre: 'Pintura Verde Olivo', descripcion: 'Verde olivo, 4L', categoria: 'Exteriores', marca: 'Berel', precio_venta: 280.00, stock_actual: 4, stock_minimo: 5 },
                { id: 7, codigo_barras: '7501234567897', nombre: 'Cinta de Enmascarar', descripcion: '24mm x 50m', categoria: 'Todos', marca: '3M', precio_venta: 45.50, stock_actual: 25, stock_minimo: 10 }
            ];
            this.mostrarProductos(this.productos);
        } catch (error) {
            console.error('Error cargando productos:', error);
            this.mostrarNotificacion('Error al cargar productos', 'error');
        }
    }
    
    mostrarProductos(productos) {
        const grid = document.getElementById('productosGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        if (productos.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--gray);">No hay productos disponibles</div>';
            return;
        }
        
        productos.forEach(producto => {
            const card = document.createElement('div');
            card.className = 'producto-card';
            card.innerHTML = `
                <h3>${producto.nombre}</h3>
                <div class="precio">$${producto.precio_venta.toFixed(2)}</div>
                <div class="stock ${producto.stock_actual <= producto.stock_minimo ? 'stock-bajo' : ''}">
                    <i class="fas fa-box"></i> ${producto.stock_actual} disponibles
                </div>
                <small>${producto.descripcion}</small>
            `;
            
            card.addEventListener('click', () => {
                this.agregarAlCarrito(producto.id);
            });
            
            grid.appendChild(card);
        });
    }
    
    filtrarProductos() {
        if (this.categoriaActiva === 'Todos') {
            this.mostrarProductos(this.productos);
        } else {
            const filtrados = this.productos.filter(p => 
                p.categoria === this.categoriaActiva || p.categoria === 'Todos'
            );
            this.mostrarProductos(filtrados);
        }
    }
    
    async buscarPorCodigo(codigo) {
        if (!codigo) return;
        
        // Simulación de búsqueda (en producción usarías fetch)
        const producto = this.productos.find(p => 
            p.codigo_barras === codigo || p.nombre.toLowerCase().includes(codigo.toLowerCase())
        );
        
        if (producto) {
            this.agregarAlCarrito(producto.id);
            this.mostrarNotificacion(`${producto.nombre} agregado al carrito`, 'success');
        } else {
            this.mostrarNotificacion('Producto no encontrado', 'error');
        }
    }
    
    async agregarAlCarrito(productoId, cantidad = 1) {
        const producto = this.productos.find(p => p.id === productoId);
        
        if (!producto) {
            this.mostrarNotificacion('Producto no encontrado', 'error');
            return;
        }
        
        const itemExistente = this.carrito.find(item => item.id === productoId);
        
        if (itemExistente) {
            const nuevaCantidad = itemExistente.cantidad + cantidad;
            if (nuevaCantidad > producto.stock_actual) {
                this.mostrarNotificacion('Stock insuficiente', 'error');
                return;
            }
            itemExistente.cantidad = nuevaCantidad;
            itemExistente.subtotal = itemExistente.cantidad * itemExistente.precio;
        } else {
            if (cantidad > producto.stock_actual) {
                this.mostrarNotificacion('Stock insuficiente', 'error');
                return;
            }
            this.carrito.push({
                id: producto.id,
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                precio: producto.precio_venta,
                cantidad: cantidad,
                stock: producto.stock_actual,
                subtotal: cantidad * producto.precio_venta
            });
        }
        
        this.actualizarCarrito();
    }
    
    actualizarCarrito() {
        const subtotal = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
        const impuestos = subtotal * 0.16;
        const total = subtotal + impuestos;
        
        this.renderizarCarrito({
            items: this.carrito,
            subtotal: subtotal,
            impuestos: impuestos,
            total: total
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
                        <p>${item.descripcion}</p>
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
                        <div class="precio">$${item.precio.toFixed(2)}</div>
                        <small>$${item.subtotal.toFixed(2)}</small>
                        <button onclick="pos.eliminarDelCarrito(${item.id})" 
                                style="background: none; border: none; color: var(--danger); cursor: pointer; margin-top: 0.3rem;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        this.actualizarTotales(data);
    }
    
    actualizarTotales(data) {
        const subtotalEl = document.getElementById('subtotal');
        const impuestosEl = document.getElementById('impuestos');
        const totalEl = document.getElementById('total');
        const btnProcesar = document.getElementById('btnProcesar');
        
        if (subtotalEl) subtotalEl.textContent = `$${data.subtotal.toFixed(2)}`;
        if (impuestosEl) impuestosEl.textContent = `$${data.impuestos.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${data.total.toFixed(2)}`;
        if (btnProcesar) btnProcesar.disabled = data.items.length === 0;
    }
    
    modificarCantidad(productoId, cantidad) {
        if (cantidad < 1) {
            this.eliminarDelCarrito(productoId);
            return;
        }
        
        const item = this.carrito.find(i => i.id === productoId);
        if (!item) return;
        
        if (cantidad > item.stock) {
            this.mostrarNotificacion('Stock insuficiente', 'error');
            return;
        }
        
        item.cantidad = cantidad;
        item.subtotal = item.cantidad * item.precio;
        this.actualizarCarrito();
    }
    
    eliminarDelCarrito(productoId) {
        this.carrito = this.carrito.filter(item => item.id !== productoId);
        this.actualizarCarrito();
        this.mostrarNotificacion('Producto eliminado del carrito', 'success');
    }
    
    procesarVenta() {
        if (this.carrito.length === 0) {
            this.mostrarNotificacion('El carrito está vacío', 'warning');
            return;
        }
        
        if (!this.metodoPagoActivo) {
            this.mostrarNotificacion('Seleccione un método de pago', 'warning');
            return;
        }
        
        const subtotal = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
        const impuestos = subtotal * 0.16;
        const total = subtotal + impuestos;
        
        const venta = {
            folio: 'VENTA-' + new Date().getTime(),
            fecha: new Date().toLocaleString(),
            items: [...this.carrito],
            subtotal: subtotal,
            impuestos: impuestos,
            total: total,
            metodo_pago: this.metodoPagoActivo
        };
        
        this.mostrarTicket(venta);
        
        // Actualizar stock
        this.carrito.forEach(item => {
            const producto = this.productos.find(p => p.id === item.id);
            if (producto) {
                producto.stock_actual -= item.cantidad;
            }
        });
        
        // Vaciar carrito
        this.carrito = [];
        this.actualizarCarrito();
        this.mostrarProductos(this.productos);
        this.mostrarNotificacion('Venta procesada exitosamente', 'success');
        
        // Resetear método de pago
        this.metodoPagoActivo = null;
        document.querySelectorAll('.metodo-pago-btn').forEach(b => b.classList.remove('active'));
    }
    
    mostrarTicket(venta) {
        const modal = document.getElementById('modalTicket');
        const contenido = document.getElementById('ticketContenido');
        
        if (!modal || !contenido) return;
        
        const itemsHTML = venta.items.map(item => `
            <div class="ticket-item">
                <span>${item.cantidad}x ${item.nombre}</span>
                <span>$${item.subtotal.toFixed(2)}</span>
            </div>
        `).join('');
        
        contenido.innerHTML = `
            <div class="ticket">
                <div class="ticket-header">
                    <h2>Pintumex</h2>
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
                        <span>$${venta.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="ticket-item">
                        <span>IVA 16%:</span>
                        <span>$${venta.impuestos.toFixed(2)}</span>
                    </div>
                    <div class="ticket-item">
                        <span>Método de pago:</span>
                        <span>${venta.metodo_pago}</span>
                    </div>
                    <div class="ticket-item" style="font-weight: bold; font-size: 1.1rem; margin-top: 0.5rem;">
                        <span>Total:</span>
                        <span>$${venta.total.toFixed(2)}</span>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 1.5rem; font-size: 0.8rem;">
                    <p>¡Gracias por su compra!</p>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // Cerrar modal al hacer clic fuera
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

// Inicializar sistema cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.pos = new POSSystem();
});