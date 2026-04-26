class ModuloInventario {
    constructor() {
        this.apiUrl = 'php/api.php';
        this.tabActiva = 'resumen';
        this.modalActual = null;
        this.historialFiltros = { tipo: '', fecha_inicio: '', fecha_fin: '', busqueda: '' };
        this.periodoTendencia = 'semana';
        this.productos = [];
        this.cargando = false;
    }

    async init() {
        await this.cargarListaProductos();
        document.querySelectorAll('.menu-item[data-modulo="inventario"]').forEach(item => {
            item.addEventListener('click', () => this.mostrarModulo());
        });
    }

    async cargarListaProductos() {
        try {
            const res = await fetch(`${this.apiUrl}?accion=getProductosAdmin&_t=${Date.now()}`);
            const data = await res.json();
            if (data.success) this.productos = data.productos;
        } catch (e) {
            console.error('Error cargando productos para inventario:', e);
        }
    }

    mostrarModulo() {
        document.querySelectorAll('.contenido-principal > section').forEach(s => s.style.display = 'none');
        this.ocultarCarrito();

        const cp = document.querySelector('.contenido-principal');
        if (!cp) return;

        let modulo = document.getElementById('moduloInventario');
        if (!modulo) {
            modulo = document.createElement('section');
            modulo.id = 'moduloInventario';
            modulo.className = 'escanner-section';
            modulo.style.padding = 'clamp(1.5rem, 5vw, 2.5rem)';
            modulo.innerHTML = this.renderModuloHTML();
            cp.appendChild(modulo);
        }
        modulo.style.display = 'block';
        this.bindEventos();
        this.cambiarTab('resumen');
    }

    renderModuloHTML() {
        return `
            <div style="max-width:1600px;margin:0 auto;width:100%;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1.5rem;margin-bottom:2rem;padding-bottom:1rem;border-bottom:2px solid var(--light);">
                    <h2 style="color:var(--primary);font-size:clamp(1.8rem, 5vw, 2.2rem);display:flex;align-items:center;gap:0.75rem;margin:0;font-weight:700;">
                        <i class="fas fa-warehouse" style="color:var(--secondary);font-size:1.8rem;"></i> 
                        Control de Inventario
                    </h2>
                    <div style="display:flex;gap:1.2rem;flex-wrap:wrap;">
                        <button id="invNuevaEntrada" class="btn-agregar" style="background:var(--success);padding:0.9rem 1.8rem;font-size:1rem;font-weight:600;border-radius:var(--radius-md);">
                            <i class="fas fa-arrow-circle-down"></i> Nueva Entrada
                        </button>
                        <button id="invNuevoAjuste" class="btn-agregar" style="background:var(--warning);padding:0.9rem 1.8rem;font-size:1rem;font-weight:600;border-radius:var(--radius-md);">
                            <i class="fas fa-tools"></i> Registrar Ajuste
                        </button>
                    </div>
                </div>

                <div style="display:flex;gap:0.5rem;border-bottom:2px solid var(--light);margin-bottom:2rem;">
                    <button class="inv-tab-btn active" data-tab="resumen" style="padding:1rem 2rem;border:none;border-bottom:3px solid var(--secondary);margin-bottom:-2px;background:none;cursor:pointer;font-weight:600;font-size:1.05rem;color:var(--primary);display:flex;align-items:center;gap:0.6rem;">
                        <i class="fas fa-tachometer-alt"></i> Resumen General
                    </button>
                    <button class="inv-tab-btn" data-tab="historial" style="padding:1rem 2rem;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;background:none;cursor:pointer;font-weight:600;font-size:1.05rem;color:var(--gray);display:flex;align-items:center;gap:0.6rem;">
                        <i class="fas fa-history"></i> Historial
                    </button>
                    <button class="inv-tab-btn" data-tab="alertas" style="padding:1rem 2rem;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;background:none;cursor:pointer;font-weight:600;font-size:1.05rem;color:var(--gray);display:flex;align-items:center;gap:0.6rem;">
                        <i class="fas fa-exclamation-triangle"></i> Alertas
                    </button>
                    <button class="inv-tab-btn" data-tab="tendencias" style="padding:1rem 2rem;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;background:none;cursor:pointer;font-weight:600;font-size:1.05rem;color:var(--gray);display:flex;align-items:center;gap:0.6rem;">
                        <i class="fas fa-chart-line"></i> Tendencias
                    </button>
                </div>

                <div id="invTabContenido" style="min-height:450px;"></div>
            </div>`;
    }

    bindEventos() {
        const modulo = document.getElementById('moduloInventario');
        if (!modulo) return;

        modulo.querySelectorAll('.inv-tab-btn').forEach(btn => {
            btn.removeEventListener('click', this.tabHandler);
            this.tabHandler = () => this.cambiarTab(btn.dataset.tab);
            btn.addEventListener('click', this.tabHandler);
        });

        const btnEntrada = modulo.querySelector('#invNuevaEntrada');
        if (btnEntrada) {
            btnEntrada.removeEventListener('click', this.entradaHandler);
            this.entradaHandler = () => this.mostrarModalEntrada();
            btnEntrada.addEventListener('click', this.entradaHandler);
        }

        const btnAjuste = modulo.querySelector('#invNuevoAjuste');
        if (btnAjuste) {
            btnAjuste.removeEventListener('click', this.ajusteHandler);
            this.ajusteHandler = () => this.mostrarModalAjuste();
            btnAjuste.addEventListener('click', this.ajusteHandler);
        }
    }

    cambiarTab(tab) {
        this.tabActiva = tab;
        const modulo = document.getElementById('moduloInventario');
        if (!modulo) return;

        modulo.querySelectorAll('.inv-tab-btn').forEach(btn => {
            const activo = btn.dataset.tab === tab;
            btn.style.color = activo ? 'var(--primary)' : 'var(--gray)';
            btn.style.borderBottomColor = activo ? 'var(--secondary)' : 'transparent';
            btn.style.fontWeight = activo ? '700' : '600';
        });

        const contenedor = document.getElementById('invTabContenido');
        if (!contenedor) return;
        contenedor.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gray);"><i class="fas fa-spinner fa-spin" style="font-size:2.5rem;"></i><p style="margin-top:1.2rem;font-size:1.1rem;">Cargando información...</p></div>';

        if (tab === 'resumen') this.cargarResumen();
        else if (tab === 'historial') this.cargarHistorial();
        else if (tab === 'alertas') this.cargarAlertas();
        else if (tab === 'tendencias') this.cargarTendencias();
    }

    async cargarResumen() {
        const contenedor = document.getElementById('invTabContenido');
        try {
            const res = await fetch(`${this.apiUrl}?accion=getResumenInventario&_t=${Date.now()}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            const r = data.resumen;
            const movHoy = parseInt(r.movimientos_hoy) || 0;
            const entSemana = parseInt(r.entradas_semana) || 0;
            const salSemana = parseInt(r.salidas_semana) || 0;

            contenedor.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;margin-bottom:2.5rem;">
                    <div class="stat-card" style="background:white;border-radius:var(--radius-lg);padding:1.5rem;display:flex;align-items:center;gap:1.2rem;box-shadow:var(--shadow-sm);border:1px solid var(--light);">
                        <div class="stat-icon" style="width:65px;height:65px;background:rgba(46,33,104,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-boxes fa-2x" style="color:var(--primary);"></i></div>
                        <div class="stat-info"><span class="stat-value" style="font-size:2.2rem;font-weight:800;color:var(--primary);display:block;">${r.total_productos}</span><span class="stat-label" style="font-size:0.95rem;color:var(--gray);">Total Productos</span></div>
                    </div>
                    <div class="stat-card" style="background:white;border-radius:var(--radius-lg);padding:1.5rem;display:flex;align-items:center;gap:1.2rem;box-shadow:var(--shadow-sm);border:1px solid var(--light);">
                        <div class="stat-icon" style="width:65px;height:65px;background:rgba(39,174,96,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-dollar-sign fa-2x" style="color:var(--success);"></i></div>
                        <div class="stat-info"><span class="stat-value" style="font-size:2rem;font-weight:800;color:var(--primary);display:block;">$${parseFloat(r.valor_inventario).toLocaleString('es-MX', {minimumFractionDigits:2,maximumFractionDigits:2})}</span><span class="stat-label" style="font-size:0.95rem;color:var(--gray);">Valor del Inventario</span></div>
                    </div>
                    <div class="stat-card" style="background:white;border-radius:var(--radius-lg);padding:1.5rem;display:flex;align-items:center;gap:1.2rem;box-shadow:var(--shadow-sm);border:1px solid var(--light);${r.stock_bajo > 0 ? 'border-left:5px solid var(--warning);' : ''}">
                        <div class="stat-icon" style="width:65px;height:65px;background:rgba(230,126,34,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-exclamation-triangle fa-2x" style="color:#e67e22;"></i></div>
                        <div class="stat-info"><span class="stat-value" style="font-size:2.2rem;font-weight:800;color:var(--primary);display:block;">${r.stock_bajo}</span><span class="stat-label" style="font-size:0.95rem;color:var(--gray);">Productos con Stock Bajo</span></div>
                    </div>
                    <div class="stat-card" style="background:white;border-radius:var(--radius-lg);padding:1.5rem;display:flex;align-items:center;gap:1.2rem;box-shadow:var(--shadow-sm);border:1px solid var(--light);${r.sin_stock > 0 ? 'border-left:5px solid var(--danger);' : ''}">
                        <div class="stat-icon" style="width:65px;height:65px;background:rgba(231,76,60,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-times-circle fa-2x" style="color:var(--danger);"></i></div>
                        <div class="stat-info"><span class="stat-value" style="font-size:2.2rem;font-weight:800;color:var(--primary);display:block;">${r.sin_stock}</span><span class="stat-label" style="font-size:0.95rem;color:var(--gray);">Productos sin Stock</span></div>
                    </div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;margin:2rem 0 1.2rem;padding-bottom:0.8rem;border-bottom:2px solid var(--light);">
                    <div style="display:flex;align-items:center;gap:0.8rem;">
                        <i class="fas fa-exclamation-circle fa-lg" style="color:#e67e22;font-size:1.2rem;"></i>
                        <span style="font-weight:700;font-size:1.15rem;color:var(--primary);">Productos con Stock Crítico o Bajo</span>
                    </div>
                    <button id="verTodasAlertas" style="background:none;border:none;color:var(--secondary);cursor:pointer;font-size:0.95rem;font-weight:600;padding:0.4rem 1rem;border-radius:var(--radius-md);">Ver todas las alertas →</button>
                </div>
                <div id="resumenAlertas"><div style="text-align:center;padding:2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:1rem;font-size:1rem;">Cargando alertas...</p></div></div>`;

            document.getElementById('verTodasAlertas')?.addEventListener('click', () => this.cambiarTab('alertas'));
            await this.cargarAlertasResumen();
        } catch (e) {
            contenedor.innerHTML = `<div style="padding:1.5rem;background:#fff5f5;border-left:5px solid var(--danger);border-radius:var(--radius-md);color:var(--danger);font-size:1rem;"><i class="fas fa-exclamation-circle"></i> ${e.message}</div>`;
        }
    }

    async cargarAlertasResumen() {
        const contenedor = document.getElementById('resumenAlertas');
        if (!contenedor) return;
        try {
            const res = await fetch(`${this.apiUrl}?accion=getAlertasInventario&_t=${Date.now()}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Error al obtener alertas');

            if (!data.alertas || data.alertas.length === 0) {
                contenedor.innerHTML = '<div style="padding:1.8rem;text-align:center;background:#f0fdf4;border-radius:var(--radius-md);color:var(--success);font-size:1rem;"><i class="fas fa-check-circle fa-lg"></i> Todos los productos tienen stock suficiente.</div>';
                return;
            }

            const filas = data.alertas.slice(0, 6).map(p => {
                let alertColor = '';
                if (p.nivel_alerta === 'critico') alertColor = 'var(--danger)';
                else if (p.nivel_alerta === 'bajo') alertColor = '#e67e22';
                else alertColor = '#3498db';
                return `
                    <tr style="border-bottom:1px solid var(--light);">
                        <td style="padding:1rem 1.2rem;"><strong style="font-size:1rem;">${this.escapeHTML(p.nombre)}</strong><br><span style="font-size:0.85rem;color:var(--gray);">${this.escapeHTML(p.codigo_barras || '')}</span></td>
                        <td style="padding:1rem 1.2rem;font-size:0.95rem;">${this.escapeHTML(p.categoria)}</td>
                        <td style="padding:1rem 1.2rem;text-align:center;font-weight:700;font-size:1.3rem;color:${alertColor};">${p.stock_actual}</td>
                        <td style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">${p.stock_minimo}</td>
                        <td style="padding:1rem 1.2rem;text-align:center;"><span class="badge-alerta" style="display:inline-block;padding:0.35rem 0.9rem;border-radius:20px;font-size:0.85rem;font-weight:600;background:rgba(0,0,0,0.05);">${this.labelAlerta(p.nivel_alerta)}</span></td>
                    </tr>
                `;
            }).join('');

            contenedor.innerHTML = `
                <div style="overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--light);box-shadow:var(--shadow-sm);">
                    <table style="width:100%;border-collapse:collapse;min-width:600px;">
                        <thead><tr style="background:var(--primary);color:white;">
                            <th style="padding:1rem 1.2rem;text-align:left;font-size:0.95rem;">Producto</th>
                            <th style="padding:1rem 1.2rem;text-align:left;font-size:0.95rem;">Categoría</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Stock Actual</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Stock Mínimo</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Nivel</th>
                        </tr></thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
                ${data.alertas.length > 6 ? `<div style="text-align:center;margin-top:1rem;font-size:0.9rem;color:var(--gray);"><i class="fas fa-ellipsis-h"></i> y ${data.alertas.length - 6} producto(s) más</div>` : ''}`;
        } catch (e) {
            contenedor.innerHTML = `<div style="color:var(--danger);padding:1rem;font-size:0.95rem;">Error: ${e.message}</div>`;
        }
    }

    async cargarHistorial() {
        const contenedor = document.getElementById('invTabContenido');
        const f = this.historialFiltros;
        contenedor.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:2rem;padding:1.5rem;background:#f8fafc;border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);">
                <input type="text" id="histBusqueda" class="inv-input" placeholder="Buscar producto por nombre o código..." value="${this.escapeHTML(f.busqueda)}" style="flex:1;min-width:200px;padding:0.9rem 1.2rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">
                <select id="histTipo" class="inv-select" style="padding:0.9rem 1.2rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;min-width:150px;">
                    <option value="">Todos los tipos</option>
                    <option value="entrada" ${f.tipo === 'entrada' ? 'selected' : ''}>📥 Entrada</option>
                    <option value="salida" ${f.tipo === 'salida' ? 'selected' : ''}>📤 Salida (Venta)</option>
                    <option value="ajuste" ${f.tipo === 'ajuste' ? 'selected' : ''}>⚙️ Ajuste</option>
                </select>
                <input type="date" id="histFechaInicio" class="inv-input" value="${f.fecha_inicio}" style="padding:0.9rem 1.2rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">
                <input type="date" id="histFechaFin" class="inv-input" value="${f.fecha_fin}" style="padding:0.9rem 1.2rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">
                <button id="btnFiltrarHist" style="padding:0.9rem 2rem;background:var(--primary);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:600;font-size:0.95rem;"><i class="fas fa-search"></i> Filtrar</button>
                <button id="btnLimpiarHist" style="padding:0.9rem 1.8rem;background:var(--danger);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-size:0.95rem;"><i class="fas fa-times"></i> Limpiar</button>
            </div>
            <div id="historialTabla"><div style="text-align:center;padding:3rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:1rem;font-size:1rem;">Cargando historial...</p></div></div>`;

        document.getElementById('btnFiltrarHist')?.addEventListener('click', () => {
            this.historialFiltros = {
                busqueda: document.getElementById('histBusqueda')?.value || '',
                tipo: document.getElementById('histTipo')?.value || '',
                fecha_inicio: document.getElementById('histFechaInicio')?.value || '',
                fecha_fin: document.getElementById('histFechaFin')?.value || ''
            };
            this.cargarHistorialTabla();
        });
        document.getElementById('btnLimpiarHist')?.addEventListener('click', () => {
            this.historialFiltros = { tipo: '', fecha_inicio: '', fecha_fin: '', busqueda: '' };
            this.cargarHistorial();
        });
        await this.cargarHistorialTabla();
    }

    async cargarHistorialTabla() {
        const wrap = document.getElementById('historialTabla');
        if (!wrap) return;
        try {
            const f = this.historialFiltros;
            let url = `${this.apiUrl}?accion=getMovimientosInventario&limite=150&_t=${Date.now()}`;
            if (f.busqueda) url += `&busqueda=${encodeURIComponent(f.busqueda)}`;
            if (f.tipo) url += `&tipo=${encodeURIComponent(f.tipo)}`;
            if (f.fecha_inicio) url += `&fecha_inicio=${encodeURIComponent(f.fecha_inicio)}`;
            if (f.fecha_fin) url += `&fecha_fin=${encodeURIComponent(f.fecha_fin)}`;

            const res = await fetch(url);
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            if (data.movimientos.length === 0) {
                wrap.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gray);"><i class="fas fa-inbox fa-3x" style="opacity:0.5;"></i><p style="margin-top:1rem;font-size:1rem;">No se encontraron movimientos con los filtros seleccionados.</p></div>';
                return;
            }

            const filas = data.movimientos.map(m => {
                const fecha = new Date(m.fecha).toLocaleString('es-MX');
                const flecha = `<span style="color:var(--gray);">${m.stock_anterior}</span> → <span style="color:var(--success);font-weight:600;">${m.stock_nuevo}</span>`;
                return `
                    <tr style="border-bottom:1px solid var(--light);">
                        <td style="padding:1rem 1.2rem;white-space:nowrap;font-size:0.95rem;"><i class="far fa-calendar-alt" style="color:var(--primary);margin-right:0.5rem;"></i>${fecha}</td>
                        <td style="padding:1rem 1.2rem;"><strong style="font-size:1rem;">${this.escapeHTML(m.producto_nombre)}</strong></td>
                        <td style="padding:1rem 1.2rem;"><span style="display:inline-block;padding:0.35rem 1rem;border-radius:20px;font-size:0.85rem;font-weight:600;background:rgba(0,0,0,0.05);">${this.labelTipo(m.tipo, m.subtipo)}</span></td>
                        <td style="padding:1rem 1.2rem;text-align:center;font-weight:700;font-size:1.1rem;">${m.cantidad}</td>
                        <td style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">${flecha}</td>
                        <td style="padding:1rem 1.2rem;font-size:0.95rem;max-width:300px;">${this.escapeHTML(m.justificacion || '—')}</td>
                    </tr>
                `;
            }).join('');

            wrap.innerHTML = `
                <div style="overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--light);box-shadow:var(--shadow-sm);">
                    <table style="width:100%;border-collapse:collapse;min-width:800px;">
                        <thead><tr style="background:var(--primary);color:white;">
                            <th style="padding:1rem 1.2rem;text-align:left;font-size:0.95rem;">Fecha</th>
                            <th style="padding:1rem 1.2rem;text-align:left;font-size:0.95rem;">Producto</th>
                            <th style="padding:1rem 1.2rem;text-align:left;font-size:0.95rem;">Tipo</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Cantidad</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Stock</th>
                            <th style="padding:1rem 1.2rem;text-align:left;font-size:0.95rem;">Justificación</th>
                        </tr></thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
                <div style="text-align:center;margin-top:1rem;font-size:0.9rem;color:var(--gray);padding:0.8rem;">Mostrando ${data.movimientos.length} movimientos</div>`;
        } catch (e) {
            wrap.innerHTML = `<div style="padding:1.5rem;background:#fff5f5;border-left:5px solid var(--danger);border-radius:var(--radius-md);color:var(--danger);font-size:0.95rem;">${e.message}</div>`;
        }
    }

    async cargarAlertas() {
        const contenedor = document.getElementById('invTabContenido');
        try {
            const res = await fetch(`${this.apiUrl}?accion=getAlertasInventario&_t=${Date.now()}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            if (!data.alertas || data.alertas.length === 0) {
                contenedor.innerHTML = `
                    <div style="text-align:center;padding:4rem 2rem;">
                        <i class="fas fa-check-circle" style="font-size:5rem;color:var(--success);opacity:0.5;"></i>
                        <p style="margin-top:1.5rem;font-size:1.1rem;color:var(--gray);">¡Excelente! Todos los productos tienen stock suficiente. ✅</p>
                    </div>`;
                return;
            }

            const filas = data.alertas.map(p => {
                let alertColor = '';
                if (p.nivel_alerta === 'critico') alertColor = 'var(--danger)';
                else if (p.nivel_alerta === 'bajo') alertColor = '#e67e22';
                else alertColor = '#3498db';
                return `
                    <tr style="border-bottom:1px solid var(--light);">
                        <td style="padding:1rem 1.2rem;">
                            <strong style="font-size:1.05rem;">${this.escapeHTML(p.nombre)}</strong><br>
                            <span style="font-size:0.85rem;color:var(--gray);"><i class="fas fa-barcode"></i> ${this.escapeHTML(p.codigo_barras || '')}</span>
                        </td>
                        <td style="padding:1rem 1.2rem;font-size:1rem;">${this.escapeHTML(p.categoria)}</td>
                        <td style="padding:1rem 1.2rem;text-align:center;font-weight:800;font-size:1.5rem;color:${alertColor};">${p.stock_actual}</td>
                        <td style="padding:1rem 1.2rem;text-align:center;font-size:1rem;">${p.stock_minimo}</td>
                        <td style="padding:1rem 1.2rem;text-align:center;"><span style="display:inline-block;padding:0.35rem 1rem;border-radius:20px;font-size:0.85rem;font-weight:600;background:rgba(0,0,0,0.05);">${this.labelAlerta(p.nivel_alerta)}</span></td>
                        <td style="padding:1rem 1.2rem;text-align:center;"><button class="btn-entrada-rapida" data-id="${p.id}" data-nombre="${this.escapeHTML(p.nombre)}" style="background:var(--success);color:white;border:none;padding:0.6rem 1.2rem;border-radius:var(--radius-md);cursor:pointer;font-size:0.9rem;font-weight:600;"><i class="fas fa-plus"></i> Registrar Entrada</button></td>
                    </tr>
                `;
            }).join('');

            contenedor.innerHTML = `
                <div style="padding:1rem 1.5rem;margin-bottom:2rem;background:#fff3cd;border-left:5px solid var(--warning);border-radius:var(--radius-md);display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                    <i class="fas fa-exclamation-triangle fa-lg" style="color:#b85e0a;"></i>
                    <strong style="color:#7d4e00;font-size:1rem;">${data.total} producto(s) requieren atención inmediata</strong>
                </div>
                <div style="overflow-x:auto;border-radius:var(--radius-md);border:1px solid var(--light);box-shadow:var(--shadow-sm);">
                    <table style="width:100%;border-collapse:collapse;min-width:700px;">
                        <thead><tr style="background:var(--primary);color:white;">
                            <th style="padding:1rem 1.2rem;text-align:left;font-size:0.95rem;">Producto</th>
                            <th style="padding:1rem 1.2rem;text-align:left;font-size:0.95rem;">Categoría</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Stock Actual</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Stock Mínimo</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Nivel</th>
                            <th style="padding:1rem 1.2rem;text-align:center;font-size:0.95rem;">Acción</th>
                        </tr></thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>`;

            contenedor.querySelectorAll('.btn-entrada-rapida').forEach(btn => {
                btn.addEventListener('click', () => this.mostrarModalEntrada(parseInt(btn.dataset.id), btn.dataset.nombre));
            });
        } catch (e) {
            contenedor.innerHTML = `<div style="padding:1.5rem;background:#fff5f5;border-left:5px solid var(--danger);border-radius:var(--radius-md);color:var(--danger);font-size:0.95rem;">${e.message}</div>`;
        }
    }

    async cargarTendencias(periodo = null) {
        if (periodo) this.periodoTendencia = periodo;
        const contenedor = document.getElementById('invTabContenido');
        contenedor.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;gap:1.2rem;margin-bottom:2rem;flex-wrap:wrap;">
                <span style="font-weight:600;color:var(--gray);font-size:1rem;">Período de análisis:</span>
                <button class="btn-periodo ${this.periodoTendencia === 'semana' ? 'active' : ''}" data-periodo="semana" style="padding:0.7rem 1.8rem;border:2px solid var(--light);background:${this.periodoTendencia === 'semana' ? 'var(--primary)' : 'white'};color:${this.periodoTendencia === 'semana' ? 'white' : 'var(--gray)'};border-radius:30px;cursor:pointer;font-size:0.95rem;font-weight:500;">Últimos 7 días</button>
                <button class="btn-periodo ${this.periodoTendencia === 'mes' ? 'active' : ''}" data-periodo="mes" style="padding:0.7rem 1.8rem;border:2px solid var(--light);background:${this.periodoTendencia === 'mes' ? 'var(--primary)' : 'white'};color:${this.periodoTendencia === 'mes' ? 'white' : 'var(--gray)'};border-radius:30px;cursor:pointer;font-size:0.95rem;font-weight:500;">Últimos 30 días</button>
                <button class="btn-periodo ${this.periodoTendencia === 'año' ? 'active' : ''}" data-periodo="año" style="padding:0.7rem 1.8rem;border:2px solid var(--light);background:${this.periodoTendencia === 'año' ? 'var(--primary)' : 'white'};color:${this.periodoTendencia === 'año' ? 'white' : 'var(--gray)'};border-radius:30px;cursor:pointer;font-size:0.95rem;font-weight:500;">Últimos 365 días</button>
            </div>
            <div id="tendenciasContenido"><div style="text-align:center;padding:3rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:1rem;font-size:1rem;">Cargando datos de tendencias...</p></div></div>`;

        contenedor.querySelectorAll('.btn-periodo').forEach(btn => {
            btn.addEventListener('click', () => this.cargarTendencias(btn.dataset.periodo));
        });
        await this.cargarTendenciasTabla();
    }

    async cargarTendenciasTabla() {
        const wrap = document.getElementById('tendenciasContenido');
        if (!wrap) return;
        try {
            const [resMas, resMenos] = await Promise.all([
                fetch(`${this.apiUrl}?accion=getProductosMasVendidos&periodo=${this.periodoTendencia}&_t=${Date.now()}`),
                fetch(`${this.apiUrl}?accion=getProductosMenosVendidos&periodo=${this.periodoTendencia}&_t=${Date.now()}`)
            ]);
            const [dataMas, dataMenos] = await Promise.all([resMas.json(), resMenos.json()]);

            const renderLista = (productos, esMas) => {
                if (!productos || productos.length === 0) return '<div style="padding:2rem;text-align:center;color:var(--gray);font-size:1rem;">No hay datos suficientes para este período.</div>';
                const maxVendido = parseInt(productos[0]?.total_vendido) || 1;
                return productos.map((p, i) => {
                    const vendido = parseInt(p.total_vendido) || 0;
                    const porcentaje = esMas ? Math.round((vendido / maxVendido) * 100) : 0;
                    return `
                        <div style="display:flex;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid var(--light);gap:1.2rem;">
                            <div style="width:38px;height:38px;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.95rem;font-weight:bold;box-shadow:var(--shadow-sm);">${i + 1}</div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:700;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHTML(p.nombre)}</div>
                                <div style="font-size:0.85rem;color:var(--gray);margin-top:0.25rem;">${this.escapeHTML(p.categoria)}</div>
                                ${esMas ? `<div style="height:8px;background:var(--light);border-radius:4px;margin-top:0.6rem;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#e74c3c,#f39c12);border-radius:4px;width:${porcentaje}%;"></div></div>` : ''}
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:1.5rem;font-weight:800;color:var(--primary);">${vendido}</div>
                                <div style="font-size:0.8rem;color:var(--gray);">unidades</div>
                            </div>
                        </div>
                    `;
                }).join('');
            };

            wrap.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:2rem;">
                    <div style="background:white;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--light);box-shadow:var(--shadow-md);">
                        <div style="padding:1.2rem 1.5rem;background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;font-weight:700;font-size:1.1rem;"><i class="fas fa-trophy" style="margin-right:0.6rem;"></i> Productos Más Vendidos</div>
                        ${renderLista(dataMas.productos, true)}
                    </div>
                    <div style="background:white;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--light);box-shadow:var(--shadow-md);">
                        <div style="padding:1.2rem 1.5rem;background:linear-gradient(135deg,#3498db,#1a5276);color:white;font-weight:700;font-size:1.1rem;"><i class="fas fa-arrow-down" style="margin-right:0.6rem;"></i> Productos Menos Vendidos</div>
                        ${renderLista(dataMenos.productos, false)}
                    </div>
                </div>
                <div style="margin-top:1.5rem;padding:1rem;text-align:center;background:#f8fafc;border-radius:var(--radius-md);font-size:0.85rem;color:var(--gray);">
                    <i class="fas fa-chart-line"></i> Datos basados en el período seleccionado
                </div>`;
        } catch (e) {
            wrap.innerHTML = `<div style="padding:1.5rem;background:#fff5f5;border-left:5px solid var(--danger);border-radius:var(--radius-md);color:var(--danger);font-size:1rem;">Error al cargar los datos de tendencias.</div>`;
        }
    }

    mostrarModalEntrada(preseleccionId = null, preseleccionNombre = '') {
        this.cerrarModalActual();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '2000';
        modal.style.backdropFilter = 'blur(4px)';

        const opcionesProd = this.productos.map(p =>
            `<option value="${p.id}" ${p.id == preseleccionId ? 'selected' : ''}>${this.escapeHTML(p.nombre)} (Stock actual: ${p.stock_actual})</option>`
        ).join('');

        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-lg);padding:2rem;max-width:550px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:var(--shadow-xl);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid var(--light);">
                    <h3 style="color:var(--primary);font-size:1.4rem;display:flex;align-items:center;gap:0.8rem;margin:0;"><i class="fas fa-arrow-circle-down" style="color:var(--success);"></i> Registrar Entrada</h3>
                    <button class="cerrar-modal-actual" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray);"><i class="fas fa-times"></i></button>
                </div>
                <form id="formEntradaInv">
                    <div style="margin-bottom:1.2rem;">
                        <label style="display:block;font-weight:700;color:var(--primary);margin-bottom:0.5rem;font-size:0.95rem;">Producto *</label>
                        <select id="entProdId" required style="width:100%;padding:0.9rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">${opcionesProd}</select>
                    </div>
                    <div style="margin-bottom:1.2rem;">
                        <label style="display:block;font-weight:700;color:var(--primary);margin-bottom:0.5rem;font-size:0.95rem;">Tipo de Entrada *</label>
                        <select id="entTipo" required style="width:100%;padding:0.9rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">
                            <option value="compra">🛒 Compra de Mercancía</option>
                            <option value="devolucion_cliente">↩️ Devolución de Cliente</option>
                        </select>
                    </div>
                    <div style="margin-bottom:1.2rem;">
                        <label style="display:block;font-weight:700;color:var(--primary);margin-bottom:0.5rem;font-size:0.95rem;">Cantidad *</label>
                        <input type="number" id="entCantidad" min="1" max="9999" required style="width:100%;padding:0.9rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">
                    </div>
                    <div style="margin-bottom:1.2rem;">
                        <label style="display:block;font-weight:700;color:var(--primary);margin-bottom:0.5rem;font-size:0.95rem;">Notas / Justificación</label>
                        <textarea id="entNotas" rows="2" style="width:100%;padding:0.9rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;resize:vertical;"></textarea>
                    </div>
                    <div style="display:flex;gap:1rem;margin-top:2rem;">
                        <button type="submit" style="flex:1;padding:1rem;background:var(--success);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:700;font-size:1rem;"><i class="fas fa-check"></i> Guardar Entrada</button>
                        <button type="button" class="btn-cancelar-actual" style="flex:1;padding:1rem;background:var(--danger);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:700;font-size:1rem;"><i class="fas fa-times"></i> Cancelar</button>
                    </div>
                </form>
            </div>`;

        this.modalActual = modal;
        document.body.appendChild(modal);

        modal.querySelector('.cerrar-modal-actual')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-cancelar-actual')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('#formEntradaInv')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.procesarEntrada();
        });
        modal.querySelector('#entProdId')?.focus();
    }

    async procesarEntrada() {
        const prodId = document.getElementById('entProdId')?.value;
        const subtipo = document.getElementById('entTipo')?.value;
        const cantidad = document.getElementById('entCantidad')?.value;
        const notas = document.getElementById('entNotas')?.value || '';

        if (!prodId) { this.mostrarNotificacion('Seleccione un producto', 'warning'); return; }
        if (!cantidad || parseInt(cantidad) <= 0) { this.mostrarNotificacion('Ingrese una cantidad válida', 'warning'); return; }

        try {
            const fd = new FormData();
            fd.append('accion', 'registrarEntradaMercancia');
            fd.append('producto_id', prodId);
            fd.append('subtipo', subtipo);
            fd.append('cantidad', cantidad);
            fd.append('notas', notas);
            fd.append('csrf_token', await this.obtenerCsrfToken());

            const res = await fetch(this.apiUrl, { method: 'POST', body: fd });
            const data = await res.json();

            if (data.success) {
                this.cerrarModalActual();
                this.mostrarNotificacion('✅ ' + data.message, 'success');
                await this.cargarListaProductos();
                this.cambiarTab(this.tabActiva);
                window.dispatchEvent(new CustomEvent('productos-actualizados'));
            } else {
                this.mostrarNotificacion('❌ ' + (data.message || 'Error al registrar'), 'error');
            }
        } catch (e) {
            this.mostrarNotificacion('Error de conexión: ' + e.message, 'error');
        }
    }

    mostrarModalAjuste(preseleccionId = null) {
        this.cerrarModalActual();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '2000';
        modal.style.backdropFilter = 'blur(4px)';

        const opcionesProd = this.productos.map(p =>
            `<option value="${p.id}" ${p.id == preseleccionId ? 'selected' : ''}>${this.escapeHTML(p.nombre)} (Stock actual: ${p.stock_actual})</option>`
        ).join('');

        modal.innerHTML = `
            <div style="background:white;border-radius:var(--radius-lg);padding:2rem;max-width:550px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:var(--shadow-xl);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid var(--light);">
                    <h3 style="color:var(--primary);font-size:1.4rem;display:flex;align-items:center;gap:0.8rem;margin:0;"><i class="fas fa-tools" style="color:var(--warning);"></i> Registrar Ajuste</h3>
                    <button class="cerrar-modal-actual" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray);"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding:1rem 1.2rem;margin-bottom:1.5rem;background:#fff3cd;border-left:5px solid var(--warning);border-radius:var(--radius-md);font-size:0.9rem;">
                    <i class="fas fa-exclamation-triangle"></i> <strong>Atención:</strong> Un ajuste <strong>reduce</strong> el stock. Use el botón "Nueva Entrada" para incrementar stock.
                </div>
                <form id="formAjusteInv">
                    <div style="margin-bottom:1.2rem;">
                        <label style="display:block;font-weight:700;color:var(--primary);margin-bottom:0.5rem;font-size:0.95rem;">Producto *</label>
                        <select id="ajProdId" required style="width:100%;padding:0.9rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">${opcionesProd}</select>
                    </div>
                    <div style="margin-bottom:1.2rem;">
                        <label style="display:block;font-weight:700;color:var(--primary);margin-bottom:0.5rem;font-size:0.95rem;">Tipo de Ajuste *</label>
                        <select id="ajTipo" required style="width:100%;padding:0.9rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">
                            <option value="merma">🔻 Merma</option>
                            <option value="daño">💥 Daño</option>
                            <option value="derrame">💧 Derrame</option>
                            <option value="ajuste_manual">⚙️ Ajuste Manual</option>
                        </select>
                    </div>
                    <div style="margin-bottom:1.2rem;">
                        <label style="display:block;font-weight:700;color:var(--primary);margin-bottom:0.5rem;font-size:0.95rem;">Cantidad a Descontar *</label>
                        <input type="number" id="ajCantidad" min="1" max="9999" required style="width:100%;padding:0.9rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;">
                    </div>
                    <div style="margin-bottom:1.2rem;">
                        <label style="display:block;font-weight:700;color:var(--primary);margin-bottom:0.5rem;font-size:0.95rem;">Justificación *</label>
                        <textarea id="ajNotas" rows="3" required style="width:100%;padding:0.9rem 1rem;border:2px solid var(--light);border-radius:var(--radius-md);font-size:1rem;resize:vertical;"></textarea>
                    </div>
                    <div style="display:flex;gap:1rem;margin-top:2rem;">
                        <button type="submit" style="flex:1;padding:1rem;background:var(--warning);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:700;font-size:1rem;"><i class="fas fa-check"></i> Guardar Ajuste</button>
                        <button type="button" class="btn-cancelar-actual" style="flex:1;padding:1rem;background:var(--danger);color:white;border:none;border-radius:var(--radius-md);cursor:pointer;font-weight:700;font-size:1rem;"><i class="fas fa-times"></i> Cancelar</button>
                    </div>
                </form>
            </div>`;

        this.modalActual = modal;
        document.body.appendChild(modal);

        modal.querySelector('.cerrar-modal-actual')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-cancelar-actual')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('#formAjusteInv')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.procesarAjuste();
        });
        modal.querySelector('#ajProdId')?.focus();
    }

    async procesarAjuste() {
        const prodId = document.getElementById('ajProdId')?.value;
        const subtipo = document.getElementById('ajTipo')?.value;
        const cantidad = document.getElementById('ajCantidad')?.value;
        const notas = document.getElementById('ajNotas')?.value?.trim() || '';

        if (!prodId) { this.mostrarNotificacion('Seleccione un producto', 'warning'); return; }
        if (!cantidad || parseInt(cantidad) <= 0) { this.mostrarNotificacion('Ingrese una cantidad válida', 'warning'); return; }
        if (!notas) { this.mostrarNotificacion('La justificación es obligatoria', 'warning'); return; }

        try {
            const fd = new FormData();
            fd.append('accion', 'registrarAjusteInventario');
            fd.append('producto_id', prodId);
            fd.append('subtipo', subtipo);
            fd.append('cantidad', cantidad);
            fd.append('notas', notas);
            fd.append('csrf_token', await this.obtenerCsrfToken());

            const res = await fetch(this.apiUrl, { method: 'POST', body: fd });
            const data = await res.json();

            if (data.success) {
                this.cerrarModalActual();
                this.mostrarNotificacion('✅ ' + data.message, 'success');
                await this.cargarListaProductos();
                this.cambiarTab(this.tabActiva);
                window.dispatchEvent(new CustomEvent('productos-actualizados'));
            } else {
                this.mostrarNotificacion('❌ ' + (data.message || 'Error al registrar ajuste'), 'error');
            }
        } catch (e) {
            this.mostrarNotificacion('Error de conexión: ' + e.message, 'error');
        }
    }

    labelTipo(tipo, subtipo) {
        const mapa = {
            entrada: '📥 Entrada',
            compra: '🛒 Compra',
            devolucion_cliente: '↩️ Devolución',
            salida: '📤 Venta',
            ajuste: '⚙️ Ajuste',
            ajuste_manual: '⚙️ Ajuste Manual',
            merma: '🔻 Merma',
            daño: '💥 Daño',
            derrame: '💧 Derrame'
        };
        return mapa[subtipo] || mapa[tipo] || tipo;
    }

    labelAlerta(nivel) {
        const mapa = { critico: 'Sin Stock', bajo: 'Stock Bajo', precaucion: 'Precaución', normal: 'Normal' };
        return mapa[nivel] || nivel;
    }

    escapeHTML(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    async obtenerCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');
        try {
            const res = await fetch(this.apiUrl + '?accion=getCsrfToken');
            const data = await res.json();
            if (data.success && data.token) return data.token;
        } catch (e) {}
        return '';
    }

    cerrarModalActual() {
        if (this.modalActual && this.modalActual.parentNode) {
            this.modalActual.remove();
            this.modalActual = null;
        }
    }

    ocultarCarrito() {
        const panel = document.querySelector('.carrito-panel');
        const sistema = document.getElementById('sistemaPos');
        if (panel) panel.style.display = 'none';
        if (sistema) sistema.classList.add('carrito-oculto');
    }

    mostrarNotificacion(mensaje, tipo) {
        const colores = { success: '#27AE60', error: '#E74C3C', warning: '#F39C12' };
        const iconos = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
        const n = document.createElement('div');
        n.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem;
            background: ${colores[tipo] || '#333'}; color: white;
            border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
            z-index: 3000; display: flex; align-items: center; gap: 1rem; font-weight: 500;
            max-width: 400px; min-width: 300px; border-left: 5px solid rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease; font-size: 0.95rem;
        `;
        n.innerHTML = `<i class="fas ${iconos[tipo] || 'fa-info-circle'}"></i><span>${mensaje}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;margin-left:auto;font-size:1.2rem;">×</button>`;
        document.body.appendChild(n);
        setTimeout(() => { if (n.parentNode) n.remove(); }, 4500);
    }

    destroy() {
        this.cerrarModalActual();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.moduloInventario = new ModuloInventario();
        window.moduloInventario.init();
    });
} else {
    window.moduloInventario = new ModuloInventario();
    window.moduloInventario.init();
}

window.addEventListener('beforeunload', () => window.moduloInventario?.destroy());