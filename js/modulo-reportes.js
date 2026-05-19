class ModuloReportes {
    constructor() {
        this.apiUrl = 'php/api.php';
        this.tabActiva = 'cortes';
        this.periodoFinanciero = 'dia';
        const hoy = this.fechaLocal();
        this.filtrosCortes = { fecha_inicio: hoy, fecha_fin: hoy, busqueda: '' };
        this.modalActual = null;
        this.cache = new Map();
    }

    fechaLocal(fecha = new Date()) {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async init() {
        this.configurarActualizacionTiempoReal();
    }

    configurarActualizacionTiempoReal() {
        if (this.eventosConfigurados) return;
        this.eventosConfigurados = true;
        const actualizar = () => this.actualizarSiVisible();
        window.addEventListener('venta-procesada', actualizar);
        window.addEventListener('ticket-cancelado', actualizar);
        window.addEventListener('inventario-actualizado', actualizar);
        window.addEventListener('productos-actualizados', actualizar);
        window.addEventListener('tendencias-actualizadas', actualizar);
    }

    async actualizarSiVisible() {
        this.cache.clear();
        const moduloVisible = document.getElementById('moduloReportes')?.style.display === 'block';
        if (!moduloVisible) return;
        if (this.tabActiva === 'cortes') await this.cargarCortes(true);
        else await this.cargarFinanzas(true);
    }

    mostrarModulo() {
        document.querySelectorAll('.contenido-principal > section').forEach(s => s.style.display = 'none');
        this.ocultarCarrito();
        const cp = document.querySelector('.contenido-principal');
        if (!cp) return;
        let modulo = document.getElementById('moduloReportes');
        if (!modulo) {
            modulo = document.createElement('section');
            modulo.id = 'moduloReportes';
            modulo.className = 'escanner-section modulo-reportes-section';
            modulo.innerHTML = this.renderModuloHTML();
            cp.appendChild(modulo);
        }
        modulo.style.display = 'block';
        this.bindEventos();
        this.cambiarTab(this.tabActiva || 'cortes');
    }

    ocultarCarrito() {
        const carritoPanel = document.querySelector('.carrito-panel');
        const sistemaPos = document.getElementById('sistemaPos');
        if (carritoPanel) {
            carritoPanel.classList.remove('visible');
            carritoPanel.style.display = 'none';
        }
        if (sistemaPos) sistemaPos.classList.add('carrito-oculto');
        const toggle = document.querySelector('.toggle-carrito-mobile');
        if (toggle) toggle.style.display = 'none';
    }

    renderModuloHTML() {
        return `
            <div class="reportes-container">
                <div class="reportes-header">
                    <div>
                        <h2><i class="fas fa-chart-bar"></i> Módulo de Reportes</h2>
                        <p>Consulta cortes, ventas, egresos, cancelaciones y rendimiento financiero del negocio.</p>
                    </div>
                    <button id="btnActualizarReportes" class="btn-reportes-refresh"><i class="fas fa-sync-alt"></i> Actualizar</button>
                </div>
                <div class="reportes-tabs">
                    <button class="reportes-tab-btn active" data-tab="cortes"><i class="fas fa-cash-register"></i> Corte de Caja</button>
                    <button class="reportes-tab-btn" data-tab="finanzas"><i class="fas fa-chart-line"></i> Ganancias y Pérdidas</button>
                </div>
                <div id="reportesContenido" class="reportes-contenido"></div>
            </div>`;
    }

    bindEventos() {
        const modulo = document.getElementById('moduloReportes');
        if (!modulo) return;
        modulo.querySelectorAll('.reportes-tab-btn').forEach(btn => {
            btn.onclick = () => this.cambiarTab(btn.dataset.tab);
        });
        const btnActualizar = modulo.querySelector('#btnActualizarReportes');
        if (btnActualizar) btnActualizar.onclick = () => this.actualizarSiVisible();
    }

    cambiarTab(tab) {
        this.tabActiva = tab;
        const modulo = document.getElementById('moduloReportes');
        if (!modulo) return;
        modulo.querySelectorAll('.reportes-tab-btn').forEach(btn => {
            const activo = btn.dataset.tab === tab;
            btn.classList.toggle('active', activo);
        });
        const cont = document.getElementById('reportesContenido');
        if (cont) cont.innerHTML = this.renderLoading('Cargando reportes...');
        if (tab === 'cortes') this.renderCortes();
        else this.renderFinanzas();
    }

    renderCortes() {
        const cont = document.getElementById('reportesContenido');
        if (!cont) return;
        cont.innerHTML = `
            <div class="reportes-panel">
                <div class="reportes-section-title">
                    <div><h3><i class="fas fa-history"></i> Historial de Cortes</h3><p>Consulta cualquier corte de caja por día o rango de fechas.</p></div>
                </div>
                <div class="reportes-filtros">
                    <div class="reportes-field"><label>Fecha inicio</label><input type="date" id="repFechaInicio" value="${this.filtrosCortes.fecha_inicio}"></div>
                    <div class="reportes-field"><label>Fecha fin</label><input type="date" id="repFechaFin" value="${this.filtrosCortes.fecha_fin}"></div>
                    <div class="reportes-field reportes-field-grow"><label>Buscar</label><input type="text" id="repBusquedaCorte" placeholder="ID de corte u observación" value="${this.escapeHTML(this.filtrosCortes.busqueda)}"></div>
                    <button id="btnFiltrarCortes" class="btn-reportes-primary"><i class="fas fa-search"></i> Buscar</button>
                    <button id="btnHoyCortes" class="btn-reportes-light"><i class="fas fa-calendar-day"></i> Hoy</button>
                </div>
                <div id="reportesCortesResultado">${this.renderLoading('Cargando cortes...')}</div>
            </div>`;
        document.getElementById('btnFiltrarCortes')?.addEventListener('click', () => {
            this.filtrosCortes = {
                fecha_inicio: document.getElementById('repFechaInicio')?.value || '',
                fecha_fin: document.getElementById('repFechaFin')?.value || '',
                busqueda: document.getElementById('repBusquedaCorte')?.value || ''
            };
            this.cargarCortes(true);
        });
        document.getElementById('btnHoyCortes')?.addEventListener('click', () => {
            const hoy = this.fechaLocal();
            this.filtrosCortes = { fecha_inicio: hoy, fecha_fin: hoy, busqueda: '' };
            this.renderCortes();
        });
        this.cargarCortes();
    }

    async cargarCortes(force = false) {
        const wrap = document.getElementById('reportesCortesResultado');
        if (!wrap) return;
        const f = this.filtrosCortes;
        const key = `cortes_${f.fecha_inicio}_${f.fecha_fin}_${f.busqueda}`;
        if (!force && this.cache.has(key)) {
            this.renderCortesData(wrap, this.cache.get(key));
            return;
        }
        wrap.innerHTML = this.renderLoading('Cargando cortes...');
        try {
            let url = `${this.apiUrl}?accion=getReportesCortes&fecha_inicio=${encodeURIComponent(f.fecha_inicio)}&fecha_fin=${encodeURIComponent(f.fecha_fin)}&_t=${Date.now()}`;
            if (f.busqueda) url += `&busqueda=${encodeURIComponent(f.busqueda)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Error al obtener cortes');
            this.cache.set(key, data);
            this.renderCortesData(wrap, data);
        } catch (e) {
            wrap.innerHTML = this.renderError(e.message);
        }
    }

    renderCortesData(wrap, data) {
        const cortes = data.cortes || [];
        const totalVendido = cortes.reduce((s, c) => s + this.num(c.total_vendido), 0);
        const efectivo = cortes.reduce((s, c) => s + this.num(c.total_efectivo), 0);
        const ventas = cortes.reduce((s, c) => s + parseInt(c.ventas_realizadas || 0), 0);
        const cancelados = cortes.reduce((s, c) => s + parseInt(c.tickets_cancelados || 0), 0);
        const dif = cortes.reduce((s, c) => s + this.num(c.diferencia), 0);
        wrap.innerHTML = `
            <div class="reportes-kpi-grid">
                ${this.kpi('Total vendido', this.money(totalVendido), 'fa-dollar-sign', 'success')}
                ${this.kpi('Efectivo recibido', this.money(efectivo), 'fa-money-bill-wave', 'primary')}
                ${this.kpi('Ventas realizadas', ventas, 'fa-receipt', 'info')}
                ${this.kpi('Tickets cancelados', cancelados, 'fa-ban', 'danger')}
                ${this.kpi('Diferencia de caja', this.money(dif), 'fa-balance-scale', dif < 0 ? 'danger' : 'warning')}
            </div>
            ${cortes.length === 0 ? this.renderEmpty('No se encontraron cortes con los filtros seleccionados.') : `
            <div class="reportes-table-wrap">
                <table class="reportes-table">
                    <thead><tr><th>Corte</th><th>Periodo</th><th>Total vendido</th><th>Métodos de pago</th><th>Ventas</th><th>Cancelados</th><th>Diferencia</th><th>Acción</th></tr></thead>
                    <tbody>${cortes.map(c => this.renderFilaCorte(c)).join('')}</tbody>
                </table>
            </div>`}`;
        wrap.querySelectorAll('.btn-ver-corte').forEach(btn => btn.addEventListener('click', () => this.verDetalleCorte(btn.dataset.id)));
    }

    renderFilaCorte(c) {
        const diferencia = this.num(c.diferencia);
        const claseDif = diferencia < 0 ? 'negativo' : diferencia > 0 ? 'positivo' : 'neutro';
        return `<tr>
            <td><strong>#${c.id}</strong><br><span class="muted">${this.escapeHTML(c.estado)}</span></td>
            <td>${this.fecha(c.fecha_apertura)}<br><span class="muted">${c.fecha_cierre ? this.fecha(c.fecha_cierre) : 'Abierta'}</span></td>
            <td><strong>${this.money(this.num(c.total_vendido))}</strong><br><span class="muted">Gastos: ${this.money(this.num(c.total_gastos))}</span></td>
            <td><div class="pay-chips"><span>Efectivo ${this.money(c.total_efectivo)}</span><span>Tarjeta ${this.money(c.total_tarjeta)}</span><span>Transf. ${this.money(c.total_transferencia)}</span></div></td>
            <td><span class="badge success">${parseInt(c.ventas_realizadas || 0)}</span></td>
            <td><span class="badge danger">${parseInt(c.tickets_cancelados || 0)}</span></td>
            <td><span class="monto-${claseDif}">${this.money(diferencia)}</span></td>
            <td><button class="btn-ver-corte" data-id="${c.id}"><i class="fas fa-eye"></i></button></td>
        </tr>`;
    }

    async verDetalleCorte(id) {
        this.cerrarModal();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `<div class="modal-contenido modal-reporte"><div class="modal-header"><h3><i class="fas fa-cash-register"></i> Detalle del corte #${id}</h3><button class="cerrar-modal"><i class="fas fa-times"></i></button></div><div id="detalleCorteReporte">${this.renderLoading('Cargando detalle...')}</div></div>`;
        document.body.appendChild(modal);
        this.modalActual = modal;
        modal.querySelector('.cerrar-modal')?.addEventListener('click', () => this.cerrarModal());
        try {
            const res = await fetch(`${this.apiUrl}?accion=getReporteDetalleCorte&corte_id=${encodeURIComponent(id)}&_t=${Date.now()}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Error al cargar detalle');
            modal.querySelector('#detalleCorteReporte').innerHTML = this.renderDetalleCorte(data);
        } catch (e) {
            modal.querySelector('#detalleCorteReporte').innerHTML = this.renderError(e.message);
        }
    }

    renderDetalleCorte(data) {
        const c = data.corte;
        const ventas = data.ventas || [];
        const movimientos = data.movimientos || [];
        const activas = ventas.filter(v => v.estado === 'activa').reduce((s, v) => s + this.num(v.total), 0);
        const canceladas = ventas.filter(v => v.estado === 'cancelada').reduce((s, v) => s + this.num(v.total), 0);
        return `
            <div class="detalle-grid">
                ${this.kpi('Monto inicial', this.money(c.monto_inicial), 'fa-coins', 'primary')}
                ${this.kpi('Ventas activas', this.money(activas), 'fa-check-circle', 'success')}
                ${this.kpi('Cancelaciones', this.money(canceladas), 'fa-ban', 'danger')}
                ${this.kpi('Diferencia', this.money(c.diferencia), 'fa-balance-scale', this.num(c.diferencia) < 0 ? 'danger' : 'warning')}
            </div>
            <h4 class="subtitulo-reporte">Ventas del corte</h4>
            <div class="reportes-table-wrap compact"><table class="reportes-table"><thead><tr><th>Folio</th><th>Fecha</th><th>Método</th><th>Total</th><th>Estado</th></tr></thead><tbody>
            ${ventas.map(v => `<tr><td>${this.escapeHTML(v.folio)}</td><td>${this.fecha(v.fecha)}</td><td>${this.escapeHTML(v.metodo_pago)}</td><td>${this.money(v.total)}</td><td><span class="badge ${v.estado === 'activa' ? 'success' : 'danger'}">${this.escapeHTML(v.estado)}</span></td></tr>`).join('') || `<tr><td colspan="5">Sin ventas registradas.</td></tr>`}
            </tbody></table></div>
            <h4 class="subtitulo-reporte">Movimientos de caja</h4>
            <div class="reportes-table-wrap compact"><table class="reportes-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th>Referencia</th></tr></thead><tbody>
            ${movimientos.map(m => `<tr><td>${this.fecha(m.fecha)}</td><td><span class="badge ${m.tipo === 'egreso' ? 'danger' : 'success'}">${this.escapeHTML(m.tipo)}</span></td><td>${this.escapeHTML(m.concepto)}</td><td>${this.money(m.monto)}</td><td>${this.escapeHTML(m.referencia || '—')}</td></tr>`).join('') || `<tr><td colspan="5">Sin movimientos registrados.</td></tr>`}
            </tbody></table></div>`;
    }

    renderFinanzas() {
        const cont = document.getElementById('reportesContenido');
        if (!cont) return;
        cont.innerHTML = `
            <div class="reportes-panel">
                <div class="reportes-section-title"><div><h3><i class="fas fa-chart-line"></i> Ganancias y Pérdidas</h3><p>Analiza ingresos, egresos, cancelaciones y productos que afectan el rendimiento financiero.</p></div></div>
                <div class="reportes-periodos">
                    <span>Periodo:</span>
                    <button class="btn-periodo-reporte ${this.periodoFinanciero === 'dia' ? 'active' : ''}" data-periodo="dia">Día</button>
                    <button class="btn-periodo-reporte ${this.periodoFinanciero === 'semana' ? 'active' : ''}" data-periodo="semana">Semana</button>
                    <button class="btn-periodo-reporte ${this.periodoFinanciero === 'mes' ? 'active' : ''}" data-periodo="mes">Mes</button>
                </div>
                <div id="reportesFinanzasResultado">${this.renderLoading('Cargando análisis financiero...')}</div>
            </div>`;
        cont.querySelectorAll('.btn-periodo-reporte').forEach(btn => {
            btn.addEventListener('click', () => {
                this.periodoFinanciero = btn.dataset.periodo;
                this.renderFinanzas();
            });
        });
        this.cargarFinanzas();
    }

    async cargarFinanzas(force = false) {
        const wrap = document.getElementById('reportesFinanzasResultado');
        if (!wrap) return;
        const key = `finanzas_${this.periodoFinanciero}`;
        if (!force && this.cache.has(key)) {
            this.renderFinanzasData(wrap, this.cache.get(key));
            return;
        }
        try {
            const res = await fetch(`${this.apiUrl}?accion=getReporteFinanciero&periodo=${encodeURIComponent(this.periodoFinanciero)}&_t=${Date.now()}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Error al cargar finanzas');
            this.cache.set(key, data);
            this.renderFinanzasData(wrap, data);
        } catch (e) {
            wrap.innerHTML = this.renderError(e.message);
        }
    }

    renderFinanzasData(wrap, data) {
        const r = data.resumen || {};
        wrap.innerHTML = `
            <div class="reportes-rango"><i class="fas fa-calendar-check"></i> Del ${this.fechaCorta(data.periodo.inicio)} al ${this.fechaCorta(data.periodo.fin)}</div>
            <div class="reportes-kpi-grid financiero">
                ${this.kpi('Ingresos', this.money(r.ingresos), 'fa-arrow-trend-up', 'success')}
                ${this.kpi('Egresos', this.money(r.egresos), 'fa-arrow-trend-down', 'warning')}
                ${this.kpi('Cancelaciones', this.money(r.cancelaciones), 'fa-ban', 'danger')}
                ${this.kpi('Resultado estimado', this.money(r.utilidad), 'fa-scale-balanced', r.utilidad >= 0 ? 'success' : 'danger')}
                ${this.kpi('Valor estancado', this.money(r.valor_estancado), 'fa-box-open', 'danger')}
            </div>
            <div class="comparativa-card">
                <h4><i class="fas fa-wallet"></i> Comparativa de ingresos y egresos</h4>
                <div class="comparativa-row"><span>Ingresos por ventas</span><strong>${this.money(r.ingresos)}</strong></div>
                <div class="bar"><div style="width:100%" class="bar-fill success"></div></div>
                <div class="comparativa-row"><span>Egresos registrados</span><strong>${this.money(r.egresos)}</strong></div>
                <div class="bar"><div style="width:${this.porcentaje(r.egresos, r.ingresos)}%" class="bar-fill warning"></div></div>
                <div class="comparativa-row"><span>Pérdidas por cancelaciones</span><strong>${this.money(r.cancelaciones)}</strong></div>
                <div class="bar"><div style="width:${this.porcentaje(r.cancelaciones, r.ingresos)}%" class="bar-fill danger"></div></div>
            </div>
            <div class="reportes-finanzas-grid">
                ${this.renderListaProductos('Productos con mayor ganancia', 'Alta contribución al ingreso.', data.productos_mayor_ganancia, 'success', 'fa-trophy')}
                ${this.renderListaProductos('Productos con menor rendimiento', 'Baja venta o poca participación.', data.productos_menor_rendimiento, 'warning', 'fa-triangle-exclamation')}
                ${this.renderListaEstancados(data.productos_estancados || [])}
            </div>`;
    }

    renderListaProductos(titulo, subtitulo, productos, tipo, icono) {
        productos = productos || [];
        return `<div class="fin-card ${tipo}"><div class="fin-card-header"><i class="fas ${icono}"></i><div><h4>${titulo}</h4><p>${subtitulo}</p></div></div><div class="fin-lista">
            ${productos.length ? productos.map((p, i) => `<div class="fin-item"><span class="rank">${i + 1}</span><div class="fin-info"><strong>${this.escapeHTML(p.nombre)}</strong><span>${this.escapeHTML(p.categoria || '')} · ${parseInt(p.unidades || 0)} unidades</span></div><div class="fin-monto">${this.money(p.ingreso)}</div></div>`).join('') : this.renderEmpty('Sin información en este periodo.')}
        </div></div>`;
    }

    renderListaEstancados(productos) {
        return `<div class="fin-card danger"><div class="fin-card-header"><i class="fas fa-box-open"></i><div><h4>Productos estancados</h4><p>Inventario sin ventas ni movimientos; puede generar pérdidas.</p></div></div><div class="fin-lista">
            ${productos.length ? productos.map((p, i) => `<div class="fin-item"><span class="rank">${i + 1}</span><div class="fin-info"><strong>${this.escapeHTML(p.nombre)}</strong><span>${this.escapeHTML(p.categoria || '')} · Stock ${parseInt(p.stock_actual || 0)}</span></div><div class="fin-monto danger-text">${this.money(p.valor_detenido)}</div></div>`).join('') : this.renderEmpty('No hay productos estancados en este periodo.')}
        </div></div>`;
    }

    kpi(label, value, icon, type) {
        return `<div class="reporte-kpi ${type}"><div class="reporte-kpi-icon"><i class="fas ${icon}"></i></div><div><strong>${value}</strong><span>${label}</span></div></div>`;
    }

    renderLoading(text) { return `<div class="reportes-loading"><i class="fas fa-spinner fa-spin"></i><span>${text}</span></div>`; }
    renderError(text) { return `<div class="reportes-error"><i class="fas fa-exclamation-circle"></i><span>${this.escapeHTML(text)}</span></div>`; }
    renderEmpty(text) { return `<div class="reportes-empty"><i class="fas fa-inbox"></i><span>${text}</span></div>`; }
    cerrarModal() { if (this.modalActual) { this.modalActual.remove(); this.modalActual = null; } }
    num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
    money(v) { return `$${this.num(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
    porcentaje(v, total) { total = this.num(total); if (total <= 0) return 0; return Math.min(100, Math.round((this.num(v) / total) * 100)); }
    fecha(v) { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? v : d.toLocaleString('es-MX'); }
    fechaCorta(v) { if (!v) return '—'; const d = new Date(v + 'T00:00:00'); return isNaN(d.getTime()) ? v : d.toLocaleDateString('es-MX'); }
    escapeHTML(text) { const div = document.createElement('div'); div.textContent = text == null ? '' : String(text); return div.innerHTML; }
}
