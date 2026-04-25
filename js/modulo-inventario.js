class ModuloInventario {
    constructor() {
        this.apiUrl        = 'php/api.php';
        this.tabActiva     = 'resumen';
        this.modalActual   = null;
        this.historialFiltros = {
            tipo: '', producto_id: '', fecha_inicio: '', fecha_fin: '', page: 1
        };
        this.cargando    = false;
        this.diasVendidos = 7;
    }

    init() {
        document.querySelectorAll('.menu-item[data-modulo="inventario"]').forEach(item => {
            item.addEventListener('click', () => this.mostrarModulo());
        });

        window.addEventListener('productos-actualizados', () => {
            if (document.getElementById('moduloInventario')?.style.display === 'block') {
                this.cargarResumen();
                this.cargarAlertas();
            }
        });
    }

    mostrarModulo() {
        document.querySelectorAll('.contenido-principal > section').forEach(s => {
            s.style.display = 'none';
        });
        this._ocultarCarrito();

        const contenidoPrincipal = document.querySelector('.contenido-principal');
        if (!contenidoPrincipal) {
            console.error('No se encontró .contenido-principal en el DOM');
            return;
        }

        let modulo = document.getElementById('moduloInventario');
        if (!modulo) {
            modulo = document.createElement('section');
            modulo.id        = 'moduloInventario';
            modulo.className = 'modulo-inventario';
            modulo.innerHTML = this.renderModuloHTML();
            contenidoPrincipal.appendChild(modulo);
        }
        modulo.style.display = 'block';
        this.cambiarTab('resumen');
    }

    renderModuloHTML() {
        return `
        <div class="inventario-container">
            <div class="inventario-header">
                <h2><i class="fas fa-warehouse"></i> Módulo de Inventario</h2>
            </div>

            <div class="inventario-tabs">
                <button class="inv-tab-btn" id="tabInvResumen">
                    <i class="fas fa-chart-pie"></i> Resumen
                </button>
                <button class="inv-tab-btn" id="tabInvEntradas">
                    <i class="fas fa-arrow-down"></i> Entradas
                </button>
                <button class="inv-tab-btn" id="tabInvSalidas">
                    <i class="fas fa-arrow-up"></i> Salidas/Ajustes
                </button>
                <button class="inv-tab-btn" id="tabInvHistorial">
                    <i class="fas fa-history"></i> Historial
                </button>
                <button class="inv-tab-btn" id="tabInvAlertas">
                    <i class="fas fa-bell"></i> Alertas
                </button>
                <button class="inv-tab-btn" id="tabInvVendidos">
                    <i class="fas fa-trophy"></i> Más/Menos Vendidos
                </button>
            </div>

            <div id="invResumenContent"  style="display:none;"></div>
            <div id="invEntradasContent" style="display:none;"></div>
            <div id="invSalidasContent"  style="display:none;"></div>
            <div id="invHistorialContent" style="display:none;"></div>
            <div id="invAlertasContent"  style="display:none;"></div>
            <div id="invVendidosContent" style="display:none;"></div>
        </div>`;
    }

    // ─── Tab management ────────────────────────────────────────────────────────
    cambiarTab(tab) {
        this.tabActiva = tab;

        const tabs = {
            resumen:   'tabInvResumen',
            entradas:  'tabInvEntradas',
            salidas:   'tabInvSalidas',
            historial: 'tabInvHistorial',
            alertas:   'tabInvAlertas',
            vendidos:  'tabInvVendidos'
        };

        const contents = {
            resumen:   'invResumenContent',
            entradas:  'invEntradasContent',
            salidas:   'invSalidasContent',
            historial: 'invHistorialContent',
            alertas:   'invAlertasContent',
            vendidos:  'invVendidosContent'
        };

        // Actualizar botones
        Object.entries(tabs).forEach(([key, id]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            if (key === tab) {
                btn.classList.add('activa');
            } else {
                btn.classList.remove('activa');
            }
        });

        // Mostrar/ocultar contenidos
        Object.entries(contents).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = (key === tab) ? 'block' : 'none';
        });

        // Registrar listener en cada tab button (una sola vez usando dataset flag)
        Object.entries(tabs).forEach(([key, id]) => {
            const btn = document.getElementById(id);
            if (btn && !btn.dataset.listenerAdded) {
                btn.dataset.listenerAdded = '1';
                btn.addEventListener('click', () => this.cambiarTab(key));
            }
        });

        // Cargar contenido de la tab activa
        const loaders = {
            resumen:   () => this.cargarResumen(),
            entradas:  () => this.cargarEntradas(),
            salidas:   () => this.cargarSalidas(),
            historial: () => this.cargarHistorial(),
            alertas:   () => this.cargarAlertas(),
            vendidos:  () => this.cargarVendidos()
        };
        loaders[tab]?.();
    }

    // ─── Resumen ────────────────────────────────────────────────────────────────
    async cargarResumen() {
        const el = document.getElementById('invResumenContent');
        if (!el) return;
        el.innerHTML = '<div class="inv-loading"><i class="fas fa-spinner fa-spin"></i> Cargando resumen…</div>';

        try {
            const [resData, alertData] = await Promise.all([
                fetch(`${this.apiUrl}?accion=getResumenInventario&_t=${Date.now()}`).then(r => r.json()),
                fetch(`${this.apiUrl}?accion=getAlertasStock&_t=${Date.now()}`).then(r => r.json())
            ]);

            if (!resData.success) { el.innerHTML = this._errorHTML(resData.message); return; }

            const valor = parseFloat(resData.valor_total_inventario || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

            el.innerHTML = `
                <div class="inventario-stats-grid">
                    <div class="inv-stat-card">
                        <h3><i class="fas fa-boxes" style="color:var(--secondary);"></i> Total Productos</h3>
                        <div class="cantidad">${resData.total_productos}</div>
                        <div class="subtexto">productos registrados</div>
                    </div>
                    <div class="inv-stat-card">
                        <h3><i class="fas fa-dollar-sign" style="color:var(--success);"></i> Valor Total Inventario</h3>
                        <div class="cantidad" style="font-size:1.5rem;">${valor}</div>
                        <div class="subtexto">precio × stock</div>
                    </div>
                    <div class="inv-stat-card">
                        <h3><i class="fas fa-exchange-alt" style="color:var(--primary);"></i> Movimientos Hoy</h3>
                        <div class="cantidad">${resData.total_movimientos_hoy}</div>
                        <div class="subtexto">movimientos registrados hoy</div>
                    </div>
                    <div class="inv-stat-card">
                        <h3><i class="fas fa-arrow-down" style="color:var(--success);"></i> Entradas Hoy</h3>
                        <div class="cantidad" style="color:var(--success);">${resData.entradas_hoy}</div>
                        <div class="subtexto">ingresos al inventario</div>
                    </div>
                    <div class="inv-stat-card">
                        <h3><i class="fas fa-arrow-up" style="color:var(--danger);"></i> Salidas Hoy</h3>
                        <div class="cantidad" style="color:var(--danger);">${resData.salidas_hoy}</div>
                        <div class="subtexto">ajustes y salidas</div>
                    </div>
                </div>

                ${alertData.success ? `
                <div class="inv-alertas-mini">
                    <div class="inv-alerta-mini-card sin-stock">
                        <h4><i class="fas fa-times-circle"></i> Sin Stock</h4>
                        <div class="alerta-count">${alertData.total_sin_stock}</div>
                        <span style="font-size:.85rem;color:var(--gray);">productos sin existencia</span>
                        ${alertData.total_sin_stock > 0 ? `<button onclick="window.moduloInventario?.cambiarTab('alertas')"><i class="fas fa-eye"></i> Ver detalles</button>` : ''}
                    </div>
                    <div class="inv-alerta-mini-card stock-bajo">
                        <h4><i class="fas fa-exclamation-triangle"></i> Stock Bajo</h4>
                        <div class="alerta-count">${alertData.total_stock_bajo}</div>
                        <span style="font-size:.85rem;color:var(--gray);">productos por debajo del mínimo</span>
                        ${alertData.total_stock_bajo > 0 ? `<button onclick="window.moduloInventario?.cambiarTab('alertas')"><i class="fas fa-eye"></i> Ver detalles</button>` : ''}
                    </div>
                </div>` : ''}`;
        } catch (err) {
            console.error('Error cargando resumen:', err);
            el.innerHTML = this._errorHTML('Error de conexión');
        }
    }

    // ─── Entradas ────────────────────────────────────────────────────────────────
    cargarEntradas(prefillProductoId = null, prefillNombre = null) {
        const el = document.getElementById('invEntradasContent');
        if (!el) return;

        el.innerHTML = `
            <div class="inv-form-container">
                <h3><i class="fas fa-arrow-down"></i> Registrar Entrada de Mercancía</h3>
                <form id="formEntrada" class="inv-form" autocomplete="off">
                    <div class="inv-form-group">
                        <label><i class="fas fa-box"></i> Producto</label>
                        <div class="inv-producto-search">
                            <input type="text" id="entradaProductoBuscar"
                                   placeholder="Buscar producto por nombre o código…"
                                   autocomplete="off">
                            <div class="inv-sugerencias" id="entradaSugerencias" style="display:none;"></div>
                        </div>
                        <input type="hidden" id="entradaProductoId">
                        <div id="entradaStockInfo" class="inv-stock-info" style="display:none;"></div>
                    </div>
                    <div class="inv-form-group">
                        <label><i class="fas fa-sort-numeric-up"></i> Cantidad</label>
                        <input type="number" id="entradaCantidad" min="1" max="9999"
                               placeholder="0" required>
                    </div>
                    <div class="inv-form-group">
                        <label><i class="fas fa-tag"></i> Tipo de Entrada</label>
                        <select id="entradaTipo" required>
                            <option value="">— Seleccionar —</option>
                            <option value="compra">Compra de mercancía</option>
                            <option value="devolucion_cliente">Devolución de cliente</option>
                        </select>
                    </div>
                    <div class="inv-form-group">
                        <label><i class="fas fa-comment-alt"></i> Justificación <span style="color:var(--gray);font-weight:400;">(opcional)</span></label>
                        <textarea id="entradaJustificacion" maxlength="255"
                                  placeholder="Motivo o comentario adicional…"></textarea>
                    </div>
                    <button type="submit" class="inv-btn-submit" id="btnSubmitEntrada">
                        <i class="fas fa-check"></i> Registrar Entrada
                    </button>
                </form>
            </div>`;

        this._initProductoAutocomplete(
            'entradaProductoBuscar', 'entradaProductoId',
            'entradaSugerencias', 'entradaStockInfo'
        );

        if (prefillProductoId && prefillNombre) {
            const hiddenEl = document.getElementById('entradaProductoId');
            const inputEl  = document.getElementById('entradaProductoBuscar');
            if (hiddenEl) hiddenEl.value = prefillProductoId;
            if (inputEl)  inputEl.value  = prefillNombre;
        }

        document.getElementById('formEntrada')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.procesarEntrada();
        });
    }

    async procesarEntrada() {
        const producto_id    = document.getElementById('entradaProductoId')?.value;
        const cantidad       = document.getElementById('entradaCantidad')?.value;
        const tipo_entrada   = document.getElementById('entradaTipo')?.value;
        const justificacion  = document.getElementById('entradaJustificacion')?.value || '';

        if (!producto_id) { this.mostrarNotificacion('Seleccione un producto', 'warning'); return; }
        if (!cantidad || parseInt(cantidad) <= 0) { this.mostrarNotificacion('Ingrese una cantidad válida', 'warning'); return; }
        if (!tipo_entrada) { this.mostrarNotificacion('Seleccione el tipo de entrada', 'warning'); return; }

        const btn = document.getElementById('btnSubmitEntrada');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando…'; }

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const body = new URLSearchParams({
                accion: 'registrarEntrada',
                csrf_token: csrfToken,
                producto_id,
                cantidad,
                tipo_entrada,
                justificacion
            });

            const res  = await fetch(this.apiUrl, { method: 'POST', body });
            const data = await res.json();

            if (data.success) {
                this.mostrarNotificacion(data.message || 'Entrada registrada exitosamente', 'success');
                document.getElementById('formEntrada')?.reset();
                const hiddenEl = document.getElementById('entradaProductoId');
                const stockEl  = document.getElementById('entradaStockInfo');
                if (hiddenEl) hiddenEl.value  = '';
                if (stockEl)  stockEl.style.display = 'none';
                this.cargarResumen();
            } else {
                this.mostrarNotificacion(data.message || 'Error al registrar entrada', 'error');
            }
        } catch (err) {
            console.error('Error procesarEntrada:', err);
            this.mostrarNotificacion('Error de conexión', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Registrar Entrada'; }
        }
    }

    // ─── Salidas/Ajustes ────────────────────────────────────────────────────────
    cargarSalidas() {
        const el = document.getElementById('invSalidasContent');
        if (!el) return;

        el.innerHTML = `
            <div class="inv-form-container">
                <h3><i class="fas fa-arrow-up" style="color:var(--danger);"></i> Registrar Salida / Ajuste</h3>
                <form id="formSalida" class="inv-form" autocomplete="off">
                    <div class="inv-form-group">
                        <label><i class="fas fa-box"></i> Producto</label>
                        <div class="inv-producto-search">
                            <input type="text" id="salidaProductoBuscar"
                                   placeholder="Buscar producto por nombre o código…"
                                   autocomplete="off">
                            <div class="inv-sugerencias" id="salidaSugerencias" style="display:none;"></div>
                        </div>
                        <input type="hidden" id="salidaProductoId">
                        <div id="salidaStockInfo" class="inv-stock-info" style="display:none;"></div>
                    </div>
                    <div class="inv-form-group">
                        <label><i class="fas fa-sort-numeric-up"></i> Cantidad</label>
                        <input type="number" id="salidaCantidad" min="1"
                               placeholder="0" required>
                    </div>
                    <div class="inv-form-group">
                        <label><i class="fas fa-tag"></i> Tipo de Ajuste</label>
                        <select id="salidaTipo" required>
                            <option value="">— Seleccionar —</option>
                            <option value="ajuste_derrame">Derrame</option>
                            <option value="ajuste_danio">Daño</option>
                            <option value="ajuste_merma">Merma</option>
                        </select>
                    </div>
                    <div class="inv-form-group">
                        <label><i class="fas fa-comment-alt"></i> Justificación <span style="color:var(--gray);font-weight:400;">(opcional)</span></label>
                        <textarea id="salidaJustificacion" maxlength="255"
                                  placeholder="Descripción del incidente o motivo…"></textarea>
                    </div>
                    <button type="submit" class="inv-btn-submit inv-btn-salida" id="btnSubmitSalida">
                        <i class="fas fa-check"></i> Registrar Salida
                    </button>
                </form>
            </div>`;

        this._initProductoAutocomplete(
            'salidaProductoBuscar', 'salidaProductoId',
            'salidaSugerencias', 'salidaStockInfo'
        );

        document.getElementById('formSalida')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.procesarSalida();
        });
    }

    async procesarSalida() {
        const producto_id   = document.getElementById('salidaProductoId')?.value;
        const cantidad      = document.getElementById('salidaCantidad')?.value;
        const tipo_salida   = document.getElementById('salidaTipo')?.value;
        const justificacion = document.getElementById('salidaJustificacion')?.value || '';

        if (!producto_id) { this.mostrarNotificacion('Seleccione un producto', 'warning'); return; }
        if (!cantidad || parseInt(cantidad) <= 0) { this.mostrarNotificacion('Ingrese una cantidad válida', 'warning'); return; }
        if (!tipo_salida) { this.mostrarNotificacion('Seleccione el tipo de ajuste', 'warning'); return; }

        const btn = document.getElementById('btnSubmitSalida');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando…'; }

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const body = new URLSearchParams({
                accion: 'registrarSalida',
                csrf_token: csrfToken,
                producto_id,
                cantidad,
                tipo_salida,
                justificacion
            });

            const res  = await fetch(this.apiUrl, { method: 'POST', body });
            const data = await res.json();

            if (data.success) {
                this.mostrarNotificacion(data.message || 'Salida registrada exitosamente', 'success');
                document.getElementById('formSalida')?.reset();
                const hiddenEl = document.getElementById('salidaProductoId');
                const stockEl  = document.getElementById('salidaStockInfo');
                if (hiddenEl) hiddenEl.value  = '';
                if (stockEl)  stockEl.style.display = 'none';
                this.cargarResumen();
            } else {
                this.mostrarNotificacion(data.message || 'Error al registrar salida', 'error');
            }
        } catch (err) {
            console.error('Error procesarSalida:', err);
            this.mostrarNotificacion('Error de conexión', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Registrar Salida'; }
        }
    }

    // ─── Historial ───────────────────────────────────────────────────────────────
    cargarHistorial() {
        const el = document.getElementById('invHistorialContent');
        if (!el) return;

        const f = this.historialFiltros;
        el.innerHTML = `
            <div class="historial-filtros">
                <select id="histFiltroTipo">
                    <option value="">Todos los tipos</option>
                    <option value="entrada" ${f.tipo === 'entrada' ? 'selected' : ''}>Entradas</option>
                    <option value="salida"  ${f.tipo === 'salida'  ? 'selected' : ''}>Salidas/Ajustes</option>
                </select>
                <input type="date" id="histFiltroFechaInicio" value="${this.escapeHTML(f.fecha_inicio)}"
                       placeholder="Fecha inicio">
                <input type="date" id="histFiltroFechaFin" value="${this.escapeHTML(f.fecha_fin)}"
                       placeholder="Fecha fin">
                <button class="btn-buscar-hist" id="btnBuscarHist">
                    <i class="fas fa-search"></i> Buscar
                </button>
                <button class="btn-limpiar-hist" id="btnLimpiarHist">
                    <i class="fas fa-times"></i> Limpiar
                </button>
            </div>
            <div id="historialTablaWrap"></div>
            <div id="historialPaginacion" class="inv-paginacion"></div>`;

        document.getElementById('btnBuscarHist')?.addEventListener('click', () => {
            this.historialFiltros.tipo         = document.getElementById('histFiltroTipo')?.value        || '';
            this.historialFiltros.fecha_inicio = document.getElementById('histFiltroFechaInicio')?.value || '';
            this.historialFiltros.fecha_fin    = document.getElementById('histFiltroFechaFin')?.value    || '';
            this.historialFiltros.page = 1;
            this._renderHistorialData();
        });

        document.getElementById('btnLimpiarHist')?.addEventListener('click', () => {
            this.historialFiltros = { tipo: '', producto_id: '', fecha_inicio: '', fecha_fin: '', page: 1 };
            const tipoSel = document.getElementById('histFiltroTipo');
            const fiEl    = document.getElementById('histFiltroFechaInicio');
            const ffEl    = document.getElementById('histFiltroFechaFin');
            if (tipoSel) tipoSel.value = '';
            if (fiEl)    fiEl.value    = '';
            if (ffEl)    ffEl.value    = '';
            this._renderHistorialData();
        });

        this._renderHistorialData();
    }

    async _renderHistorialData() {
        const wrap = document.getElementById('historialTablaWrap');
        const pag  = document.getElementById('historialPaginacion');
        if (!wrap) return;

        wrap.innerHTML = '<div class="inv-loading"><i class="fas fa-spinner fa-spin"></i> Cargando…</div>';
        if (pag) pag.innerHTML = '';

        const f = this.historialFiltros;
        let url = `${this.apiUrl}?accion=getHistorialInventario&_t=${Date.now()}`;
        if (f.tipo)         url += `&tipo=${encodeURIComponent(f.tipo)}`;
        if (f.producto_id)  url += `&producto_id=${encodeURIComponent(f.producto_id)}`;
        if (f.fecha_inicio) url += `&fecha_inicio=${encodeURIComponent(f.fecha_inicio)}`;
        if (f.fecha_fin)    url += `&fecha_fin=${encodeURIComponent(f.fecha_fin)}`;
        url += `&page=${f.page}&per_page=50`;

        try {
            const res  = await fetch(url);
            const data = await res.json();

            if (!data.success) { wrap.innerHTML = this._errorHTML(data.message); return; }

            if (data.movimientos.length === 0) {
                wrap.innerHTML = `<div class="inv-empty">
                    <i class="fas fa-history"></i>
                    <p>No se encontraron movimientos con los filtros seleccionados.</p>
                </div>`;
                return;
            }

            const rows = data.movimientos.map(m => {
                const rowClass = m.tipo === 'entrada' ? 'fila-entrada'
                               : m.tipo === 'salida'  ? 'fila-salida' : 'fila-ajuste';
                const badgeClass = m.tipo === 'entrada' ? 'badge-entrada'
                                 : m.tipo === 'salida'  ? 'badge-salida' : 'badge-ajuste';
                const detalle = m.tipo_detalle
                    ? this.escapeHTML(m.tipo_detalle.replace(/_/g, ' '))
                    : '—';
                const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es-MX') : '—';
                return `<tr class="${rowClass}">
                    <td style="white-space:nowrap;">${this.escapeHTML(fecha)}</td>
                    <td>${this.escapeHTML(m.nombre || '')}</td>
                    <td><code>${this.escapeHTML(m.codigo_barras || '')}</code></td>
                    <td><span class="badge-tipo ${badgeClass}">${this.escapeHTML(m.tipo)}</span></td>
                    <td>${detalle}</td>
                    <td style="text-align:center;font-weight:700;">${m.cantidad}</td>
                    <td style="text-align:center;">${m.stock_anterior}</td>
                    <td style="text-align:center;font-weight:700;">${m.stock_nuevo}</td>
                    <td style="color:var(--gray);font-size:.85rem;">${this.escapeHTML(m.justificacion || '')}</td>
                </tr>`;
            }).join('');

            wrap.innerHTML = `
                <div class="historial-tabla-wrap">
                    <table class="historial-tabla">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Producto</th>
                                <th>Código</th>
                                <th>Tipo</th>
                                <th>Detalle</th>
                                <th>Cantidad</th>
                                <th>Stock Ant.</th>
                                <th>Stock Nuevo</th>
                                <th>Justificación</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;

            if (pag && data.total_pages > 1) {
                const prev = data.page > 1;
                const next = data.page < data.total_pages;
                pag.innerHTML = `
                    <button id="btnHistPrev" ${prev ? '' : 'disabled'}>
                        <i class="fas fa-chevron-left"></i> Anterior
                    </button>
                    <span>Página ${data.page} de ${data.total_pages} (${data.total} registros)</span>
                    <button id="btnHistNext" ${next ? '' : 'disabled'}>
                        Siguiente <i class="fas fa-chevron-right"></i>
                    </button>`;

                document.getElementById('btnHistPrev')?.addEventListener('click', () => {
                    if (this.historialFiltros.page > 1) {
                        this.historialFiltros.page--;
                        this._renderHistorialData();
                    }
                });
                document.getElementById('btnHistNext')?.addEventListener('click', () => {
                    if (this.historialFiltros.page < data.total_pages) {
                        this.historialFiltros.page++;
                        this._renderHistorialData();
                    }
                });
            }
        } catch (err) {
            console.error('Error cargando historial:', err);
            wrap.innerHTML = this._errorHTML('Error de conexión');
        }
    }

    // ─── Alertas ─────────────────────────────────────────────────────────────────
    async cargarAlertas() {
        const el = document.getElementById('invAlertasContent');
        if (!el) return;
        el.innerHTML = '<div class="inv-loading"><i class="fas fa-spinner fa-spin"></i> Cargando alertas…</div>';

        try {
            const res  = await fetch(`${this.apiUrl}?accion=getAlertasStock&_t=${Date.now()}`);
            const data = await res.json();

            if (!data.success) { el.innerHTML = this._errorHTML(data.message); return; }

            let html = '';

            // Sin Stock
            html += `<div class="inv-alertas-section-title">
                <i class="fas fa-times-circle" style="color:var(--danger);"></i>
                Sin Stock <span style="font-weight:400;font-size:.9rem;color:var(--gray);">(${data.total_sin_stock} productos)</span>
            </div>`;
            if (data.sin_stock.length === 0) {
                html += `<div class="inv-empty" style="padding:1rem;">
                    <i class="fas fa-check-circle" style="color:var(--success);opacity:1;"></i>
                    <p style="color:var(--success);">¡Todos los productos tienen existencia!</p>
                </div>`;
            } else {
                html += '<div class="alertas-grid">';
                data.sin_stock.forEach(p => {
                    html += `<div class="alerta-card sin-stock">
                        <div class="alerta-nombre">${this.escapeHTML(p.nombre)}</div>
                        <div class="alerta-cat">${this.escapeHTML(p.categoria || '')}
                            &nbsp;·&nbsp; Mín: ${p.stock_minimo}</div>
                        <div class="alerta-stock-info">
                            Stock actual: <span class="stock-cero">0</span>
                        </div>
                        <button class="btn-registrar-entrada-alerta"
                            data-id="${p.id}" data-nombre="${this.escapeHTML(p.nombre)}">
                            <i class="fas fa-plus"></i> Registrar Entrada
                        </button>
                    </div>`;
                });
                html += '</div>';
            }

            // Stock Bajo
            html += `<div class="inv-alertas-section-title">
                <i class="fas fa-exclamation-triangle" style="color:var(--secondary);"></i>
                Stock Bajo <span style="font-weight:400;font-size:.9rem;color:var(--gray);">(${data.total_stock_bajo} productos)</span>
            </div>`;
            if (data.stock_bajo.length === 0) {
                html += `<div class="inv-empty" style="padding:1rem;">
                    <i class="fas fa-check-circle" style="color:var(--success);opacity:1;"></i>
                    <p style="color:var(--success);">¡Todo el stock está sobre el mínimo!</p>
                </div>`;
            } else {
                html += '<div class="alertas-grid">';
                data.stock_bajo.forEach(p => {
                    html += `<div class="alerta-card stock-bajo">
                        <div class="alerta-nombre">${this.escapeHTML(p.nombre)}</div>
                        <div class="alerta-cat">${this.escapeHTML(p.categoria || '')}</div>
                        <div class="alerta-stock-info">
                            Stock: <span class="stock-bajo-val">${p.stock_actual}</span>
                            &nbsp;/&nbsp; Mínimo: <span>${p.stock_minimo}</span>
                        </div>
                        <button class="btn-registrar-entrada-alerta"
                            data-id="${p.id}" data-nombre="${this.escapeHTML(p.nombre)}">
                            <i class="fas fa-plus"></i> Registrar Entrada
                        </button>
                    </div>`;
                });
                html += '</div>';
            }

            el.innerHTML = html;

            // Bind entrada buttons
            el.querySelectorAll('.btn-registrar-entrada-alerta').forEach(btn => {
                btn.addEventListener('click', () => {
                    const pid    = btn.dataset.id;
                    const nombre = btn.dataset.nombre;
                    this.cambiarTab('entradas');
                    setTimeout(() => this.cargarEntradas(pid, nombre), 50);
                });
            });
        } catch (err) {
            console.error('Error cargando alertas:', err);
            el.innerHTML = this._errorHTML('Error de conexión');
        }
    }

    // ─── Vendidos ─────────────────────────────────────────────────────────────────
    cargarVendidos() {
        const el = document.getElementById('invVendidosContent');
        if (!el) return;

        el.innerHTML = `
            <div class="periodo-btns">
                <button data-dias="7"  class="${this.diasVendidos === 7  ? 'activo' : ''}">7 días</button>
                <button data-dias="30" class="${this.diasVendidos === 30 ? 'activo' : ''}">30 días</button>
                <button data-dias="90" class="${this.diasVendidos === 90 ? 'activo' : ''}">90 días</button>
            </div>
            <div id="vendidosTablas"></div>`;

        el.querySelectorAll('.periodo-btns button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.diasVendidos = parseInt(btn.dataset.dias);
                el.querySelectorAll('.periodo-btns button').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');
                this._renderVendidosData();
            });
        });

        this._renderVendidosData();
    }

    async _renderVendidosData() {
        const wrap = document.getElementById('vendidosTablas');
        if (!wrap) return;
        wrap.innerHTML = '<div class="inv-loading"><i class="fas fa-spinner fa-spin"></i> Cargando datos…</div>';

        const dias = this.diasVendidos;
        try {
            const [masData, menosData] = await Promise.all([
                fetch(`${this.apiUrl}?accion=getProductosMasVendidos&dias=${dias}&_t=${Date.now()}`).then(r => r.json()),
                fetch(`${this.apiUrl}?accion=getProductosMenosVendidos&dias=${dias}&_t=${Date.now()}`).then(r => r.json())
            ]);

            const renderTabla = (productos, titulo, esMasVendido) => {
                if (!productos || productos.length === 0) {
                    return `<div class="inv-empty">
                        <i class="fas fa-chart-bar"></i>
                        <p>Sin datos de ventas en los últimos ${dias} días.</p>
                    </div>`;
                }
                const rows = productos.map((p, i) => `
                    <tr>
                        <td class="rank">${i + 1}</td>
                        <td>${this.escapeHTML(p.nombre)}</td>
                        <td>${this.escapeHTML(p.categoria || '')}</td>
                        <td style="text-align:center;font-weight:700;">${p.total_vendido}</td>
                        <td style="text-align:right;">${parseFloat(p.total_ingresos || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td>
                    </tr>`).join('');

                const iconClass = esMasVendido ? 'fa-arrow-trend-up mas' : 'fa-arrow-trend-down menos';
                return `<div class="vendidos-tabla-titulo">
                    <i class="fas ${iconClass}"></i>
                    ${titulo}
                </div>
                <div class="vendidos-tabla-wrap">
                    <table class="vendidos-tabla">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Producto</th>
                                <th>Categoría</th>
                                <th>Unidades</th>
                                <th>Ingresos</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            };

            wrap.innerHTML = `<div class="vendidos-grid">
                <div>${renderTabla(masData.success ? masData.productos : [], 'Más Vendidos', true)}</div>
                <div>${renderTabla(menosData.success ? menosData.productos : [], 'Menos Vendidos', false)}</div>
            </div>`;
        } catch (err) {
            console.error('Error cargando vendidos:', err);
            wrap.innerHTML = this._errorHTML('Error de conexión');
        }
    }

    // ─── Autocomplete helper ──────────────────────────────────────────────────────
    _initProductoAutocomplete(inputId, hiddenId, sugId, stockInfoId) {
        const input    = document.getElementById(inputId);
        const hidden   = document.getElementById(hiddenId);
        const sug      = document.getElementById(sugId);
        const stockDiv = document.getElementById(stockInfoId);

        if (!input || !hidden || !sug) return;

        let timeout = null;

        input.addEventListener('input', () => {
            const termino = input.value.trim();
            if (hidden) hidden.value = '';
            if (stockDiv) stockDiv.style.display = 'none';

            if (!termino) { sug.style.display = 'none'; sug.innerHTML = ''; return; }

            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                try {
                    const res  = await fetch(
                        `${this.apiUrl}?accion=buscarProductosAdmin&termino=${encodeURIComponent(termino)}&_t=${Date.now()}`
                    );
                    const data = await res.json();
                    const lista = data.success ? (data.productos || []) : [];

                    if (lista.length === 0) {
                        sug.innerHTML = '<div class="inv-sug-item" style="color:var(--gray);cursor:default;">Sin resultados</div>';
                        sug.style.display = 'block';
                        return;
                    }

                    sug.innerHTML = lista.slice(0, 8).map(p => `
                        <div class="inv-sug-item"
                             data-id="${p.id}"
                             data-nombre="${this.escapeHTML(p.nombre)}"
                             data-stock="${p.stock_actual}"
                             data-codigo="${this.escapeHTML(p.codigo_barras || '')}">
                            <div>
                                <div class="inv-sug-nombre">${this.escapeHTML(p.nombre)}</div>
                                <div class="inv-sug-info">${this.escapeHTML(p.codigo_barras || '')} · ${this.escapeHTML(p.categoria || '')}</div>
                            </div>
                            <div class="inv-sug-info">Stock: <strong>${p.stock_actual}</strong></div>
                        </div>`).join('');
                    sug.style.display = 'block';
                } catch (_) { /* silencioso */ }
            }, 300);
        });

        sug.addEventListener('click', (e) => {
            const item = e.target.closest('.inv-sug-item[data-id]');
            if (!item) return;
            const pid    = item.dataset.id;
            const nombre = item.dataset.nombre;
            const stock  = item.dataset.stock;

            input.value = nombre;
            if (hidden)   hidden.value = pid;
            sug.style.display = 'none';
            sug.innerHTML     = '';

            if (stockDiv) {
                stockDiv.textContent = `Stock actual: ${stock} unidades`;
                stockDiv.style.display = 'block';
            }
        });

        document.addEventListener('click', (e) => {
            if (!sug.contains(e.target) && e.target !== input) {
                sug.style.display = 'none';
            }
        });
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────
    mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.createElement('div');
        const colores = { success: '#27AE60', error: '#E74C3C', warning: '#F39C12' };
        const iconos  = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
        notificacion.style.cssText = `
            position:fixed;top:20px;right:20px;padding:1rem 1.5rem;background:${colores[tipo] || '#333'};
            color:white;border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:3000;
            animation:slideInRight .3s;display:flex;align-items:center;gap:1rem;font-weight:500;
            max-width:400px;min-width:300px;
            border-left:5px solid ${tipo === 'success' ? '#1e8449' : tipo === 'error' ? '#c0392b' : '#e67e22'};`;
        notificacion.innerHTML = `
            <i class="fas ${iconos[tipo] || 'fa-info-circle'}" style="font-size:1.2rem;"></i>
            <span>${mensaje}</span>
            <button onclick="this.parentElement.remove()"
                style="background:none;border:none;color:white;cursor:pointer;margin-left:auto;">×</button>`;
        document.body.appendChild(notificacion);
        setTimeout(() => { if (notificacion.parentNode) notificacion.remove(); }, 3000);
    }

    cerrarModalActual() {
        if (this.modalActual && this.modalActual.parentNode) {
            this.modalActual.remove();
            this.modalActual = null;
        }
    }

    escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    _errorHTML(msg) {
        return `<div class="inv-empty" style="color:var(--danger);">
            <i class="fas fa-exclamation-circle" style="color:var(--danger);opacity:1;"></i>
            <p>${this.escapeHTML(msg || 'Error desconocido')}</p>
        </div>`;
    }

    _ocultarCarrito() {
        const carritoPanel = document.querySelector('.carrito-panel');
        const sistemaPos   = document.getElementById('sistemaPos');
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
        const sistemaPos   = document.getElementById('sistemaPos');
        if (carritoPanel) carritoPanel.style.display = carritoPanel.dataset.prevDisplay || '';
        if (sistemaPos) sistemaPos.classList.remove('carrito-oculto');
        const toggleCarrito = document.querySelector('.toggle-carrito-mobile');
        if (toggleCarrito) toggleCarrito.style.display = '';
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

window.addEventListener('beforeunload', () => {
    if (window.moduloInventario) window.moduloInventario.destroy();
});
