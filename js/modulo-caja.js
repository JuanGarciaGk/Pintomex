class ModuloCaja {
    constructor() {
        this.apiUrl = 'php/api.php';
        this.cajaAbierta = false;
        this.datosCaja = null;
        this.inicializado = false;
        this.cache = new Map();
        this.refreshInterval = null;
        this.isUpdating = false;
        this.modalActual = null;
    }

    async init() {
        console.log('Inicializando módulo de caja...');
        await this.verificarEstadoCaja();
        this.cargarEventos();
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                const menuActivo = document.querySelector('.menu-item.active');
                if (menuActivo && menuActivo.dataset.modulo === 'caja') {
                    this.mostrarModulo();
                }
            });
        } else {
            setTimeout(() => {
                const menuActivo = document.querySelector('.menu-item.active');
                if (menuActivo && menuActivo.dataset.modulo === 'caja') {
                    this.mostrarModulo();
                }
            }, 500);
        }
        
        this.inicializado = true;
        
        this.refreshInterval = setInterval(() => {
            if (this.cajaAbierta && document.getElementById('moduloCaja')?.style.display === 'block') {
                this.verificarEstadoCaja();
            }
        }, 30000);
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

    async fetchWithCsrf(url, options = {}) {
        const csrfToken = await this.obtenerCsrfToken();
        
        if (!options.headers) {
            options.headers = {};
        }
        
        if (options.body instanceof FormData) {
            options.body.append('csrf_token', csrfToken);
        } else if (options.body && typeof options.body === 'object') {
            options.body.csrf_token = csrfToken;
            options.body = JSON.stringify(options.body);
            options.headers['Content-Type'] = 'application/json';
        }
        
        options.headers['X-CSRF-Token'] = csrfToken;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        options.signal = controller.signal;
        
        try {
            const response = await fetch(url, options);
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

    async verificarEstadoCaja() {
        if (this.isUpdating) return;
        this.isUpdating = true;
        
        try {
            const response = await this.fetchWithCsrf(this.apiUrl + '?accion=getEstadoCaja');
            const data = await response.json();
            
            if (data.success) {
                this.cajaAbierta = data.caja_abierta;
                this.datosCaja = data.caja_abierta ? data.caja : null;
                
                if (this.datosCaja) {
                    this.datosCaja.monto_inicial = parseFloat(this.datosCaja.monto_inicial) || 0;
                    this.datosCaja.total_ventas_hoy = parseFloat(data.total_ventas_hoy) || 0;
                    this.datosCaja.total_electronico = parseFloat(data.total_electronico) || 0;
                    this.datosCaja.total_gastos = parseFloat(data.total_gastos) || 0;
                    this.datosCaja.ventas_hoy = parseInt(data.ventas_hoy) || 0;
                    this.datosCaja.ventas_efectivo = parseInt(data.ventas_efectivo) || 0;
                }
                
                if (document.getElementById('moduloCaja')?.style.display === 'block') {
                    this.actualizarUI();
                }
            }
        } catch (error) {
            console.error('Error verificando caja:', error);
        } finally {
            this.isUpdating = false;
        }
    }

    actualizarUI() {
        const contenedor = document.getElementById('moduloCajaContent');
        if (!contenedor) return;

        requestAnimationFrame(() => {
            if (this.cajaAbierta) {
                contenedor.innerHTML = this.renderCajaAbierta();
            } else {
                contenedor.innerHTML = this.renderCajaCerrada();
            }
            this.cargarEventosInternos();
            this.mostrarHistorial();
        });
    }

    renderCajaCerrada() {
        return `
            <div class="modulo-caja">
                <div class="caja-header">
                    <h2>
                        <i class="fas fa-cash-register" style="color: var(--secondary);"></i> 
                        Módulo de Caja
                    </h2>
                    <div class="estado-caja cerrada">
                        <i class="fas fa-times-circle"></i> 
                        Caja Cerrada
                    </div>
                </div>
                
                <div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); border-radius: var(--radius-lg); margin-bottom: 2rem;">
                    <i class="fas fa-door-closed" style="font-size: 4rem; color: var(--gray); opacity: 0.5; margin-bottom: 1rem;"></i>
                    <h3 style="color: var(--primary); margin-bottom: 0.5rem;">No hay caja abierta</h3>
                    <p style="color: var(--gray);">Para comenzar a operar, abra una nueva caja</p>
                </div>
                
                <div class="caja-acciones">
                    <div class="accion-card" data-accion="abrir">
                        <i class="fas fa-door-open"></i>
                        <h4>Abrir Caja</h4>
                        <p>Iniciar operaciones del día</p>
                    </div>
                    <div class="accion-card" data-accion="historial">
                        <i class="fas fa-history"></i>
                        <h4>Historial de Cortes</h4>
                        <p>Ver cortes de caja anteriores</p>
                    </div>
                </div>
                
                <div id="historialContainer"></div>
            </div>
        `;
    }

    renderCajaAbierta() {
        const montoInicial = this.datosCaja?.monto_inicial || 0;
        const totalVentasEfectivo = this.datosCaja?.total_ventas_hoy || 0;
        const totalElectronico = this.datosCaja?.total_electronico || 0;
        const totalGastos = this.datosCaja?.total_gastos || 0;
        const ventasHoy = this.datosCaja?.ventas_hoy || 0;
        const ventasEfectivo = this.datosCaja?.ventas_efectivo || 0;
        const esperado = montoInicial + totalVentasEfectivo - totalGastos;
        const fechaApertura = this.datosCaja?.fecha_apertura ? new Date(this.datosCaja.fecha_apertura).toLocaleString() : '';

        return `
            <div class="modulo-caja">
                <div class="caja-header">
                    <h2>
                        <i class="fas fa-cash-register" style="color: var(--secondary);"></i> 
                        Módulo de Caja
                    </h2>
                    <div class="estado-caja abierta">
                        <i class="fas fa-check-circle"></i> 
                        Caja Abierta
                    </div>
                </div>
                
                <div class="caja-info-bar" style="background: var(--primary); color: white; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <i class="fas fa-clock"></i> 
                        Abierta desde: <strong>${fechaApertura}</strong>
                    </div>
                    <div>
                        <i class="fas fa-shopping-cart"></i> 
                        Ventas hoy: <strong>${ventasHoy}</strong>
                    </div>
                </div>
                
                <div class="caja-resumen">
                    <div class="resumen-card">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <div style="width: 40px; height: 40px; background: rgba(230, 126, 34, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-coins" style="color: var(--secondary);"></i>
                            </div>
                            <h3 style="margin: 0;">Monto Inicial</h3>
                        </div>
                        <div class="cantidad">$${montoInicial.toFixed(2)}</div>
                    </div>
                    
                    <div class="resumen-card">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <div style="width: 40px; height: 40px; background: rgba(39, 174, 96, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-money-bill-wave" style="color: var(--success);"></i>
                            </div>
                            <h3 style="margin: 0;">Ventas Efectivo</h3>
                        </div>
                        <div class="cantidad" style="color: var(--success);">$${totalVentasEfectivo.toFixed(2)}</div>
                        <div class="subtexto">${ventasEfectivo} transacciones</div>
                    </div>
                    
                    <div class="resumen-card">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <div style="width: 40px; height: 40px; background: rgba(52, 152, 219, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-credit-card" style="color: #3498db;"></i>
                            </div>
                            <h3 style="margin: 0;">Ventas Electrónicas</h3>
                        </div>
                        <div class="cantidad" style="color: #3498db;">$${totalElectronico.toFixed(2)}</div>
                        <div class="subtexto">Tarjeta/Transferencia</div>
                    </div>
                    
                    <div class="resumen-card">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <div style="width: 40px; height: 40px; background: rgba(230, 126, 34, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-minus-circle" style="color: #e67e22;"></i>
                            </div>
                            <h3 style="margin: 0;">Gastos del Día</h3>
                        </div>
                        <div class="cantidad" style="color: #e67e22;">-$${totalGastos.toFixed(2)}</div>
                        <div class="subtexto">Egresos registrados</div>
                    </div>
                    
                    <div class="resumen-card" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; border: none;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-cash-register" style="color: white;"></i>
                            </div>
                            <h3 style="margin: 0; color: white;">Total en Caja</h3>
                        </div>
                        <div class="cantidad" style="color: white;">$${esperado.toFixed(2)}</div>
                        <div class="subtexto" style="color: rgba(255,255,255,0.8);">Inicial + Efectivo - Gastos</div>
                    </div>
                </div>
                
                <div class="caja-acciones">
                    <div class="accion-card" data-accion="cerrar">
                        <i class="fas fa-door-closed"></i>
                        <h4>Cerrar Caja</h4>
                        <p>Finalizar operaciones y cuadrar caja</p>
                    </div>
                    <div class="accion-card" data-accion="gasto">
                        <i class="fas fa-minus-circle"></i>
                        <h4>Registrar Gasto</h4>
                        <p>Agregar un egreso de caja</p>
                    </div>
                    <div class="accion-card" data-accion="historial">
                        <i class="fas fa-history"></i>
                        <h4>Historial</h4>
                        <p>Ver cortes anteriores</p>
                    </div>
                </div>
                
                <div id="historialContainer"></div>
            </div>
        `;
    }

    cargarEventosInternos() {
        const contenedor = document.getElementById('moduloCajaContent');
        if (!contenedor) return;
        
        contenedor.querySelectorAll('.accion-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const accion = card.dataset.accion;
                if (accion === 'abrir') {
                    this.mostrarModalApertura();
                } else if (accion === 'cerrar') {
                    this.mostrarModalCierre();
                } else if (accion === 'gasto') {
                    this.mostrarModalGasto();
                } else if (accion === 'historial') {
                    this.mostrarHistorial();
                }
            });
        });
    }

    mostrarModalApertura() {
        this.cerrarModalActual();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalAperturaCaja';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-contenido modal-caja">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-door-open" style="color: var(--secondary);"></i> 
                        Abrir Caja
                    </h3>
                    <button class="cerrar-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
                    <p style="margin-bottom: 0.5rem; color: var(--gray);">
                        <i class="fas fa-info-circle" style="color: var(--secondary);"></i>
                        Ingrese el monto con el que inicia la caja
                    </p>
                </div>
                
                <div class="form-group">
                    <label>
                        <i class="fas fa-dollar-sign"></i> 
                        Monto Inicial
                    </label>
                    <input type="number" id="montoInicial" min="0" step="0.01" placeholder="0.00" autofocus>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button class="btn-confirmar" style="flex: 1; padding: 1rem; background: var(--success); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i class="fas fa-check"></i> 
                        Abrir Caja
                    </button>
                    <button class="btn-cancelar" style="flex: 1; padding: 1rem; background: var(--danger); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i class="fas fa-times"></i> 
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        this.modalActual = modal;
        document.body.appendChild(modal);
        
        modal.querySelector('.cerrar-modal')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-cancelar')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-confirmar')?.addEventListener('click', () => this.procesarApertura());
        
        document.getElementById('montoInicial')?.focus();
    }

    async procesarApertura() {
        const monto = document.getElementById('montoInicial')?.value;
        
        if (!monto || parseFloat(monto) < 0) {
            this.mostrarNotificacion('Ingrese un monto válido', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('accion', 'abrirCaja');
            formData.append('monto_inicial', monto);

            const response = await this.fetchWithCsrf(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.cerrarModalActual();
                this.mostrarNotificacion('✅ Caja abierta exitosamente', 'success');
                await this.verificarEstadoCaja();
                this.actualizarUI();
            } else {
                this.mostrarNotificacion(data.message || 'Error al abrir caja', 'error');
            }
        } catch (error) {
            this.mostrarNotificacion('Error al abrir caja: ' + error.message, 'error');
            console.error(error);
        }
    }

    mostrarModalCierre() {
        if (!this.cajaAbierta) {
            this.mostrarNotificacion('No hay caja abierta', 'warning');
            return;
        }
        
        this.cerrarModalActual();
        
        const montoInicial = this.datosCaja?.monto_inicial || 0;
        const totalVentasEfectivo = this.datosCaja?.total_ventas_hoy || 0;
        const totalElectronico = this.datosCaja?.total_electronico || 0;
        const totalGastos = this.datosCaja?.total_gastos || 0;
        const esperado = montoInicial + totalVentasEfectivo - totalGastos;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalCierreCaja';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-contenido modal-caja">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-door-closed" style="color: var(--secondary);"></i> 
                        Cerrar Caja
                    </h3>
                    <button class="cerrar-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="resumen-cierre" style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
                    <h4 style="color: var(--primary); margin-bottom: 1rem;">Resumen del día</h4>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                        <span>Monto Inicial:</span>
                        <span style="font-weight: bold;">$${montoInicial.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                        <span>Ventas en Efectivo:</span>
                        <span style="font-weight: bold; color: var(--success);">+$${totalVentasEfectivo.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                        <span>Ventas Electrónicas:</span>
                        <span style="font-weight: bold; color: #3498db;">$${totalElectronico.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <span>Gastos del Día:</span>
                        <span style="font-weight: bold; color: #e67e22;">-$${totalGastos.toFixed(2)}</span>
                    </div>
                    
                    <div style="border-top: 2px dashed var(--light); padding-top: 1rem; margin-top: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; font-size: 1.2rem;">
                            <span style="font-weight: bold;">Esperado en Efectivo:</span>
                            <span style="font-weight: bold; color: var(--primary);">$${esperado.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>
                        <i class="fas fa-money-bill"></i> 
                        Monto Final en Caja (Efectivo Físico)
                    </label>
                    <input type="number" id="montoFinal" min="0" step="0.01" placeholder="0.00" autofocus>
                </div>
                
                <div class="form-group">
                    <label>
                        <i class="fas fa-comment"></i> 
                        Observaciones
                    </label>
                    <textarea id="observacionesCierre" rows="3" placeholder="Notas adicionales..."></textarea>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button class="btn-confirmar" style="flex: 1; padding: 1rem; background: var(--success); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i class="fas fa-check"></i> 
                        Cerrar Caja
                    </button>
                    <button class="btn-cancelar" style="flex: 1; padding: 1rem; background: var(--danger); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i class="fas fa-times"></i> 
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        this.modalActual = modal;
        document.body.appendChild(modal);
        
        modal.querySelector('.cerrar-modal')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-cancelar')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-confirmar')?.addEventListener('click', () => this.procesarCierre());
        
        document.getElementById('montoFinal')?.focus();
    }

    async procesarCierre() {
        const montoFinal = document.getElementById('montoFinal')?.value;
        const observaciones = document.getElementById('observacionesCierre')?.value || '';

        if (!montoFinal || parseFloat(montoFinal) < 0) {
            this.mostrarNotificacion('Ingrese un monto válido', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('accion', 'cerrarCaja');
            formData.append('monto_final', montoFinal);
            formData.append('observaciones', observaciones);

            const response = await this.fetchWithCsrf(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Respuesta no JSON:', text);
                this.mostrarNotificacion('Error del servidor', 'error');
                return;
            }
            
            if (data.success) {
                this.cerrarModalActual();
                this.mostrarResultadoCorte(data.datos);
                this.mostrarNotificacion('✅ Caja cerrada exitosamente', 'success');
                await this.verificarEstadoCaja();
                this.actualizarUI();
            } else {
                this.mostrarNotificacion(data.message || 'Error al cerrar caja', 'error');
            }
        } catch (error) {
            this.mostrarNotificacion('Error al cerrar caja: ' + error.message, 'error');
            console.error(error);
        }
    }

    mostrarResultadoCorte(datos) {
        const inicial = parseFloat(datos.inicial) || 0;
        const ventasEfectivo = parseFloat(datos.ventas_efectivo) || 0;
        const ventasElectronico = parseFloat(datos.ventas_electronico) || 0;
        const gastos = parseFloat(datos.gastos) || 0;
        const esperado = parseFloat(datos.esperado) || 0;
        const final = parseFloat(datos.final) || 0;
        const diferencia = parseFloat(datos.diferencia) || 0;
        
        const claseDiferencia = diferencia === 0 ? 'diferencia-cero' : 
                                (diferencia > 0 ? 'diferencia-positiva' : 'diferencia-negativa');
        
        const mensaje = diferencia === 0 ? '✅ TODO CUADRA PERFECTAMENTE' :
                        (diferencia > 0 ? `💰 SOBRÓ: $${Math.abs(diferencia).toFixed(2)}` : 
                                            `⚠️ FALTÓ: $${Math.abs(diferencia).toFixed(2)}`);

        this.cerrarModalActual();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-contenido modal-caja">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-clipboard-check" style="color: var(--secondary);"></i> 
                        Resultado del Corte
                    </h3>
                    <button class="cerrar-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                        <span>Inicial:</span>
                        <span style="font-weight: bold;">$${inicial.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                        <span>Ventas Efectivo:</span>
                        <span style="font-weight: bold; color: var(--success);">+$${ventasEfectivo.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                        <span>Ventas Electrónicas:</span>
                        <span style="font-weight: bold; color: #3498db;">$${ventasElectronico.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                        <span>Gastos:</span>
                        <span style="font-weight: bold; color: #e67e22;">-$${gastos.toFixed(2)}</span>
                    </div>
                    
                    <div style="border-top: 2px solid var(--light); padding-top: 0.8rem; margin-top: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                            <span>Esperado en Efectivo:</span>
                            <span style="font-weight: bold;">$${esperado.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                            <span>Final (Efectivo Físico):</span>
                            <span style="font-weight: bold;">$${final.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div style="border-top: 2px dashed var(--light); padding-top: 1rem; margin-top: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; font-size: 1.3rem;">
                            <span style="font-weight: bold;">Diferencia:</span>
                            <span style="font-weight: bold;" class="${claseDiferencia}">
                                ${diferencia > 0 ? '+' : ''}$${diferencia.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 1rem; background: ${diferencia === 0 ? 'var(--success)' : (diferencia > 0 ? '#27AE60' : '#E74C3C')}; color: white; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 1.3rem; font-weight: bold;">
                    ${mensaje}
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button class="btn-imprimir" style="flex: 1; padding: 1rem; background: var(--secondary); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i class="fas fa-print"></i> 
                        Imprimir
                    </button>
                    <button class="btn-cerrar" style="flex: 1; padding: 1rem; background: var(--primary); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i class="fas fa-check"></i> 
                        Aceptar
                    </button>
                </div>
            </div>
        `;
        
        this.modalActual = modal;
        document.body.appendChild(modal);
        
        modal.querySelector('.cerrar-modal')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-cerrar')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-imprimir')?.addEventListener('click', () => window.print());
    }

    mostrarModalGasto() {
        if (!this.cajaAbierta) {
            this.mostrarNotificacion('No hay caja abierta', 'warning');
            return;
        }

        this.cerrarModalActual();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalGasto';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-contenido modal-caja">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-minus-circle" style="color: #e67e22;"></i> 
                        Registrar Gasto
                    </h3>
                    <button class="cerrar-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="form-group">
                    <label>
                        <i class="fas fa-tag"></i> 
                        Concepto
                    </label>
                    <input type="text" id="conceptoGasto" placeholder="Ej: Pago de servicios, compras...">
                </div>
                
                <div class="form-group">
                    <label>
                        <i class="fas fa-dollar-sign"></i> 
                        Monto
                    </label>
                    <input type="number" id="montoGasto" min="0.01" step="0.01" placeholder="0.00">
                </div>
                
                <div class="form-group">
                    <label>
                        <i class="fas fa-hashtag"></i> 
                        Referencia (opcional)
                    </label>
                    <input type="text" id="referenciaGasto" placeholder="Número de factura, proveedor...">
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button class="btn-confirmar" style="flex: 1; padding: 1rem; background: #e67e22; color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i class="fas fa-save"></i> 
                        Guardar Gasto
                    </button>
                    <button class="btn-cancelar" style="flex: 1; padding: 1rem; background: var(--danger); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i class="fas fa-times"></i> 
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        this.modalActual = modal;
        document.body.appendChild(modal);
        
        modal.querySelector('.cerrar-modal')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-cancelar')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-confirmar')?.addEventListener('click', () => this.procesarGasto());
    }

    async procesarGasto() {
        const concepto = document.getElementById('conceptoGasto')?.value;
        const monto = document.getElementById('montoGasto')?.value;
        const referencia = document.getElementById('referenciaGasto')?.value || '';

        if (!concepto) {
            this.mostrarNotificacion('Ingrese un concepto', 'warning');
            return;
        }

        if (!monto || parseFloat(monto) <= 0) {
            this.mostrarNotificacion('Ingrese un monto válido', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('accion', 'agregarGasto');
            formData.append('concepto', concepto);
            formData.append('monto', monto);
            formData.append('referencia', referencia);

            const response = await this.fetchWithCsrf(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.cerrarModalActual();
                this.mostrarNotificacion('✅ Gasto registrado', 'success');
                await this.verificarEstadoCaja();
                this.actualizarUI();
            } else {
                this.mostrarNotificacion(data.message || 'Error al registrar gasto', 'error');
            }
        } catch (error) {
            this.mostrarNotificacion('Error al registrar gasto: ' + error.message, 'error');
            console.error(error);
        }
    }

    async mostrarHistorial() {
        try {
            const response = await this.fetchWithCsrf(this.apiUrl + '?accion=getHistorialCaja');
            const data = await response.json();
            
            const container = document.getElementById('historialContainer');
            if (!container) return;
            
            if (data.success && data.historial.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: var(--gray);">
                        <i class="fas fa-history" style="font-size: 4rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                        <p style="font-size: 1.2rem;">No hay cortes de caja registrados</p>
                        <p style="margin-top: 0.5rem;">Los cortes aparecerán aquí cuando se cierren</p>
                    </div>
                `;
                return;
            }
            
            if (data.success) {
                container.innerHTML = `
                    <div style="margin: 2rem 0 1rem;">
                        <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-history"></i> Historial de Cortes
                            <span style="background: var(--secondary); color: white; padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.9rem; margin-left: 1rem;">
                                ${data.historial.length} registros
                            </span>
                        </h3>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="tabla-historial">
                            <thead>
                                <tr>
                                    <th>Fecha Apertura</th>
                                    <th>Fecha Cierre</th>
                                    <th>Inicial</th>
                                    <th>Ventas Efectivo</th>
                                    <th>Gastos</th>
                                    <th>Final</th>
                                    <th>Diferencia</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.historial.map(corte => {
                                    const montoInicial = parseFloat(corte.monto_inicial) || 0;
                                    const totalVentas = parseFloat(corte.total_ventas || 0) || 0;
                                    const totalGastos = parseFloat(corte.total_gastos || 0) || 0;
                                    const montoFinal = parseFloat(corte.monto_final || 0) || 0;
                                    const diferencia = parseFloat(corte.diferencia || 0) || 0;
                                    
                                    const claseDif = diferencia === 0 ? 'diferencia-cero' : 
                                                    (diferencia > 0 ? 'diferencia-positiva' : 'diferencia-negativa');
                                    const fechaApertura = new Date(corte.fecha_apertura).toLocaleString();
                                    const fechaCierre = corte.fecha_cierre ? new Date(corte.fecha_cierre).toLocaleString() : 'Pendiente';
                                    
                                    return `
                                        <tr>
                                            <td><i class="fas fa-calendar-alt" style="color: var(--primary); margin-right: 0.3rem;"></i> ${fechaApertura}</td>
                                            <td><i class="fas fa-clock" style="color: var(--gray); margin-right: 0.3rem;"></i> ${fechaCierre}</td>
                                            <td><strong>$${montoInicial.toFixed(2)}</strong></td>
                                            <td style="color: var(--success);">$${totalVentas.toFixed(2)}</td>
                                            <td style="color: #e67e22;">$${totalGastos.toFixed(2)}</td>
                                            <td><strong>$${montoFinal.toFixed(2)}</strong></td>
                                            <td class="${claseDif}">
                                                ${diferencia > 0 ? '+' : ''}$${diferencia.toFixed(2)}
                                            </td>
                                            <td>
                                                <span style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.8rem; border-radius: 20px; 
                                                           background: ${corte.estado === 'abierta' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(100, 116, 139, 0.1)'};
                                                           color: ${corte.estado === 'abierta' ? 'var(--success)' : 'var(--gray)'};
                                                           font-weight: 500; font-size: 0.85rem;">
                                                    <i class="fas ${corte.estado === 'abierta' ? 'fa-door-open' : 'fa-door-closed'}"></i>
                                                    ${corte.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                                                </span>
                                            </td>
                                            <td>
                                                <button class="btn-ver-detalle" data-id="${corte.id}" 
                                                        style="background: var(--primary); color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; transition: all 0.3s;">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                
                this.agregarEstilosHistorial();
                
                container.querySelectorAll('.btn-ver-detalle').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = parseInt(btn.dataset.id);
                        this.verDetalleCorte(id);
                    });
                });
            }
        } catch (error) {
            console.error('Error cargando historial:', error);
            this.mostrarNotificacion('Error al cargar historial', 'error');
        }
    }

    agregarEstilosHistorial() {
        if (document.getElementById('historial-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'historial-styles';
        style.textContent = `
            .table-responsive {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                margin: 1rem 0;
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-md);
            }
            
            .tabla-historial {
                width: 100%;
                border-collapse: collapse;
                background: white;
                min-width: 800px;
            }
            
            .tabla-historial th {
                background: var(--primary);
                color: white;
                padding: 1rem;
                text-align: left;
                font-weight: 600;
                font-size: 0.9rem;
                white-space: nowrap;
            }
            
            .tabla-historial td {
                padding: 1rem;
                border-bottom: 1px solid var(--light);
                font-size: 0.9rem;
                vertical-align: middle;
            }
            
            .tabla-historial tr:hover {
                background: rgba(230, 126, 34, 0.05);
            }
            
            .btn-ver-detalle:hover {
                background: var(--secondary) !important;
                transform: translateY(-2px);
            }
            
            .diferencia-positiva { color: var(--success); font-weight: bold; }
            .diferencia-negativa { color: var(--danger); font-weight: bold; }
            .diferencia-cero { color: var(--gray); font-weight: bold; }
        `;
        
        document.head.appendChild(style);
    }

    async verDetalleCorte(corteId) {
        try {
            const response = await this.fetchWithCsrf(this.apiUrl + '?accion=getDetalleCorte&corte_id=' + corteId);
            const data = await response.json();
            
            if (data.success) {
                this.mostrarModalDetalle(data);
            }
        } catch (error) {
            console.error('Error cargando detalle:', error);
            this.mostrarNotificacion('Error al cargar detalle', 'error');
        }
    }

    mostrarModalDetalle(data) {
        this.cerrarModalActual();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const corte = data.corte;
        const montoInicial = parseFloat(corte.monto_inicial) || 0;
        const totalVentas = parseFloat(corte.total_ventas || 0) || 0;
        const montoFinal = parseFloat(corte.monto_final || 0) || 0;
        const diferencia = parseFloat(corte.diferencia || 0) || 0;
        
        const claseDif = diferencia === 0 ? 'diferencia-cero' : 
                        (diferencia > 0 ? 'diferencia-positiva' : 'diferencia-negativa');
        
        modal.innerHTML = `
            <div class="modal-contenido" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-file-invoice" style="color: var(--secondary);"></i> 
                        Detalle del Corte #${corte.id}
                    </h3>
                    <button class="cerrar-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md);">
                        <div style="font-size: 0.9rem; color: var(--gray); margin-bottom: 0.3rem;">
                            <i class="fas fa-calendar-alt" style="color: var(--primary);"></i> Apertura
                        </div>
                        <strong>${new Date(corte.fecha_apertura).toLocaleString()}</strong>
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md);">
                        <div style="font-size: 0.9rem; color: var(--gray); margin-bottom: 0.3rem;">
                            <i class="fas fa-clock" style="color: var(--primary);"></i> Cierre
                        </div>
                        <strong>${corte.fecha_cierre ? new Date(corte.fecha_cierre).toLocaleString() : 'Pendiente'}</strong>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div style="text-align: center; padding: 1rem; background: white; border-radius: var(--radius-md); border: 2px solid var(--light);">
                        <div style="font-size: 0.9rem; color: var(--gray);">Inicial</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">$${montoInicial.toFixed(2)}</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: white; border-radius: var(--radius-md); border: 2px solid var(--light);">
                        <div style="font-size: 0.9rem; color: var(--gray);">Ventas</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--success);">$${totalVentas.toFixed(2)}</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: white; border-radius: var(--radius-md); border: 2px solid var(--light);">
                        <div style="font-size: 0.9rem; color: var(--gray);">Final</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">$${montoFinal.toFixed(2)}</div>
                    </div>
                </div>
                
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 1.2rem; font-weight: bold;">Diferencia:</span>
                        <span style="font-size: 1.5rem; font-weight: bold;" class="${claseDif}">
                            ${diferencia > 0 ? '+' : ''}$${diferencia.toFixed(2)}
                        </span>
                    </div>
                    <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: var(--radius-md);">
                        <i class="fas fa-comment" style="color: var(--gray); margin-right: 0.5rem;"></i>
                        <strong>Observaciones:</strong> ${corte.observaciones || 'Sin observaciones'}
                    </div>
                </div>
                
                <h4 style="margin: 1rem 0; color: var(--primary);">Ventas del Corte (${data.ventas.length})</h4>
                <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--light); border-radius: var(--radius-md); margin-bottom: 1.5rem;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: var(--primary); color: white; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 0.5rem; text-align: left;">Folio</th>
                                <th style="padding: 0.5rem; text-align: left;">Método</th>
                                <th style="padding: 0.5rem; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.ventas.map(venta => `
                                <tr style="border-bottom: 1px solid var(--light);">
                                    <td style="padding: 0.5rem;">${venta.folio}</td>
                                    <td style="padding: 0.5rem;">${venta.metodo_pago}</td>
                                    <td style="padding: 0.5rem; text-align: right;">$${parseFloat(venta.total).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <h4 style="margin: 1rem 0; color: var(--primary);">Movimientos (${data.movimientos.length})</h4>
                <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--light); border-radius: var(--radius-md);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: var(--primary); color: white; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 0.5rem; text-align: left;">Tipo</th>
                                <th style="padding: 0.5rem; text-align: left;">Concepto</th>
                                <th style="padding: 0.5rem; text-align: right;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.movimientos.map(mov => `
                                <tr style="border-bottom: 1px solid var(--light);">
                                    <td style="padding: 0.5rem;">
                                        <span style="color: ${mov.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)'}">
                                            ${mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                                        </span>
                                    </td>
                                    <td style="padding: 0.5rem;">${mov.concepto}</td>
                                    <td style="padding: 0.5rem; text-align: right; color: ${mov.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)'}">
                                        ${mov.tipo === 'ingreso' ? '+' : '-'}$${parseFloat(mov.monto).toFixed(2)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button class="btn-imprimir" style="flex: 1; padding: 0.8rem; background: var(--secondary); color: white; border: none; border-radius: var(--radius-md); cursor: pointer;">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                    <button class="btn-cerrar" style="flex: 1; padding: 0.8rem; background: var(--primary); color: white; border: none; border-radius: var(--radius-md); cursor: pointer;">
                        <i class="fas fa-check"></i> Cerrar
                    </button>
                </div>
            </div>
        `;
        
        this.modalActual = modal;
        document.body.appendChild(modal);
        
        modal.querySelector('.cerrar-modal')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-cerrar')?.addEventListener('click', () => this.cerrarModalActual());
        modal.querySelector('.btn-imprimir')?.addEventListener('click', () => window.print());
    }

    cerrarModalActual() {
        if (this.modalActual && this.modalActual.parentNode) {
            this.modalActual.remove();
            this.modalActual = null;
        }
    }

    cargarEventos() {
        document.querySelectorAll('.menu-item[data-modulo="caja"]').forEach(item => {
            item.addEventListener('click', () => {
                this.mostrarModulo();
            });
        });
    }

    mostrarModulo() {
        console.log('Mostrando módulo de caja');
        
        document.querySelectorAll('.contenido-principal > section').forEach(s => {
            s.style.display = 'none';
        });
        
        let moduloCaja = document.getElementById('moduloCaja');
        if (!moduloCaja) {
            moduloCaja = document.createElement('section');
            moduloCaja.id = 'moduloCaja';
            moduloCaja.className = 'escanner-section';
            moduloCaja.innerHTML = '<div id="moduloCajaContent"></div>';
            document.querySelector('.contenido-principal').appendChild(moduloCaja);
        }
        
        moduloCaja.style.display = 'block';
        this.actualizarUI();
    }

    mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion notificacion-${tipo}`;
        
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
        `;
        
        notificacion.innerHTML = `
            <i class="fas ${tipo === 'success' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
            <span>${mensaje}</span>
            <button style="background: none; border: none; color: white; cursor: pointer; margin-left: auto;">×</button>
        `;
        
        document.body.appendChild(notificacion);
        
        notificacion.querySelector('button').addEventListener('click', () => notificacion.remove());
        
        setTimeout(() => {
            if (notificacion.parentNode) notificacion.remove();
        }, 3000);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.cerrarModalActual();
        this.cache.clear();
    }
}

// Inicialización
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.moduloCaja = new ModuloCaja();
        window.moduloCaja.init();
    });
} else {
    window.moduloCaja = new ModuloCaja();
    window.moduloCaja.init();
}

window.addEventListener('beforeunload', () => {
    if (window.moduloCaja) {
        window.moduloCaja.destroy();
    }
});