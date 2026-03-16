class ModuloCaja {
    constructor() {
        this.apiUrl = 'php/api.php';
        this.cajaAbierta = false;
        this.datosCaja = null;
        this.inicializado = false;
        this.cache = new Map();
    }

    async init() {
        console.log('Inicializando módulo de caja...');
        await this.verificarEstadoCaja();
        this.cargarEventos();
        
        // Verificar si es el módulo activo al cargar la página
        setTimeout(() => {
            const menuActivo = document.querySelector('.menu-item.active');
            if (menuActivo && menuActivo.dataset.modulo === 'caja') {
                this.mostrarModulo();
            }
        }, 500);
        
        this.inicializado = true;
    }

    async verificarEstadoCaja() {
        try {
            const response = await fetch(this.apiUrl + '?accion=getEstadoCaja');
            const data = await response.json();
            
            if (data.success) {
                this.cajaAbierta = data.caja_abierta;
                this.datosCaja = data.caja_abierta ? data.caja : null;
                
                // Convertir valores a número si existen
                if (this.datosCaja) {
                    this.datosCaja.monto_inicial = parseFloat(this.datosCaja.monto_inicial) || 0;
                    this.datosCaja.total_ventas_hoy = parseFloat(data.total_ventas_hoy) || 0;
                    this.datosCaja.total_electronico = parseFloat(data.total_electronico) || 0;
                    this.datosCaja.total_gastos = parseFloat(data.total_gastos) || 0;
                    this.datosCaja.ventas_hoy = parseInt(data.ventas_hoy) || 0;
                    this.datosCaja.ventas_efectivo = parseInt(data.ventas_efectivo) || 0;
                }
                
                // Actualizar UI si el módulo está visible
                if (document.getElementById('moduloCaja')?.style.display === 'block') {
                    this.actualizarUI();
                }
            }
        } catch (error) {
            console.error('Error verificando caja:', error);
        }
    }

    actualizarUI() {
        const contenedor = document.getElementById('moduloCajaContent');
        if (!contenedor) return;

        if (this.cajaAbierta) {
            contenedor.innerHTML = this.renderCajaAbierta();
        } else {
            contenedor.innerHTML = this.renderCajaCerrada();
        }

        this.cargarEventosInternos();
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
                    <div class="accion-card" onclick="moduloCaja.mostrarModalApertura()">
                        <i class="fas fa-door-open"></i>
                        <h4>Abrir Caja</h4>
                        <p>Iniciar operaciones del día</p>
                    </div>
                    <div class="accion-card" onclick="moduloCaja.mostrarHistorial()">
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
        // Asegurar que los valores sean números
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
                    <div class="accion-card" onclick="moduloCaja.mostrarModalCierre()">
                        <i class="fas fa-door-closed"></i>
                        <h4>Cerrar Caja</h4>
                        <p>Finalizar operaciones y cuadrar caja</p>
                    </div>
                    <div class="accion-card" onclick="moduloCaja.mostrarModalGasto()">
                        <i class="fas fa-minus-circle"></i>
                        <h4>Registrar Gasto</h4>
                        <p>Agregar un egreso de caja</p>
                    </div>
                    <div class="accion-card" onclick="moduloCaja.mostrarHistorial()">
                        <i class="fas fa-history"></i>
                        <h4>Historial</h4>
                        <p>Ver cortes anteriores</p>
                    </div>
                </div>
                
                <div id="historialContainer"></div>
            </div>
        `;
    }

    mostrarModalApertura() {
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
                    <button onclick="this.closest('.modal').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
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
                    <button onclick="moduloCaja.procesarApertura()" 
                            class="btn-modal btn-primary">
                        <i class="fas fa-check"></i> 
                        Abrir Caja
                    </button>
                    <button onclick="this.closest('.modal').remove()" 
                            class="btn-modal btn-secondary">
                        <i class="fas fa-times"></i> 
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById('montoInicial')?.focus();
    }

    async procesarApertura() {
        const monto = document.getElementById('montoInicial')?.value;
        
        if (!monto || parseFloat(monto) < 0) {
            window.pos.mostrarNotificacion('Ingrese un monto válido', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('accion', 'abrirCaja');
            formData.append('monto_inicial', monto);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('modalAperturaCaja')?.remove();
                window.pos.mostrarNotificacion('✅ Caja abierta exitosamente', 'success');
                await this.verificarEstadoCaja();
                this.actualizarUI();
            } else {
                window.pos.mostrarNotificacion(data.message, 'error');
            }
        } catch (error) {
            window.pos.mostrarNotificacion('Error al abrir caja', 'error');
            console.error(error);
        }
    }

    mostrarModalCierre() {
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
                    <button onclick="this.closest('.modal').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
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
                        <span style="font-weight: bold; color: #2b7c30;">-$${totalGastos.toFixed(2)}</span>
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
                    <button onclick="moduloCaja.procesarCierre()" 
                            class="btn-modal btn-primary">
                        <i class="fas fa-check"></i> 
                        Cerrar Caja
                    </button>
                    <button onclick="this.closest('.modal').remove()" 
                            class="btn-modal btn-secondary">
                        <i class="fas fa-times"></i> 
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById('montoFinal')?.focus();
    }

    async procesarCierre() {
        const montoFinal = document.getElementById('montoFinal')?.value;
        const observaciones = document.getElementById('observacionesCierre')?.value || '';

        if (!montoFinal || parseFloat(montoFinal) < 0) {
            window.pos.mostrarNotificacion('Ingrese un monto válido', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('accion', 'cerrarCaja');
            formData.append('monto_final', montoFinal);
            formData.append('observaciones', observaciones);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            // Verificar si la respuesta es JSON válido
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Respuesta no JSON:', text);
                window.pos.mostrarNotificacion('Error del servidor: ' + text.substring(0, 100), 'error');
                return;
            }
            
            if (data.success) {
                document.getElementById('modalCierreCaja')?.remove();
                
                // Mostrar resultado del corte
                this.mostrarResultadoCorte(data.datos);
                
                window.pos.mostrarNotificacion('✅ Caja cerrada exitosamente', 'success');
                await this.verificarEstadoCaja();
                this.actualizarUI();
            } else {
                window.pos.mostrarNotificacion(data.message || 'Error al cerrar caja', 'error');
            }
        } catch (error) {
            window.pos.mostrarNotificacion('Error al cerrar caja: ' + error.message, 'error');
            console.error(error);
        }
    }

    mostrarResultadoCorte(datos) {
        // Asegurar que los valores sean números
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
                    <button onclick="this.closest('.modal').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
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
                        <span style="font-weight: bold; color: #2b7c30;">-$${gastos.toFixed(2)}</span>
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
                    <button onclick="window.print()" 
                            class="btn-modal btn-primary" style="background: var(--secondary);">
                        <i class="fas fa-print"></i> 
                        Imprimir
                    </button>
                    <button onclick="this.closest('.modal').remove()" 
                            class="btn-modal btn-secondary">
                        <i class="fas fa-check"></i> 
                        Aceptar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    mostrarModalGasto() {
        if (!this.cajaAbierta) {
            window.pos.mostrarNotificacion('No hay caja abierta', 'warning');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalGasto';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-contenido modal-caja">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-minus-circle" style="color: #2b7c30;"></i> 
                        Registrar Gasto
                    </h3>
                    <button onclick="this.closest('.modal').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
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
                    <button onclick="moduloCaja.procesarGasto()" 
                            class="btn-modal" style="background: #e67e22;">
                        <i class="fas fa-save"></i> 
                        Guardar Gasto
                    </button>
                    <button onclick="this.closest('.modal').remove()" 
                            class="btn-modal btn-secondary">
                        <i class="fas fa-times"></i> 
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async procesarGasto() {
        const concepto = document.getElementById('conceptoGasto')?.value;
        const monto = document.getElementById('montoGasto')?.value;
        const referencia = document.getElementById('referenciaGasto')?.value || '';

        if (!concepto) {
            window.pos.mostrarNotificacion('Ingrese un concepto', 'warning');
            return;
        }

        if (!monto || parseFloat(monto) <= 0) {
            window.pos.mostrarNotificacion('Ingrese un monto válido', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('accion', 'agregarGasto');
            formData.append('concepto', concepto);
            formData.append('monto', monto);
            formData.append('referencia', referencia);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Respuesta no JSON:', text);
                window.pos.mostrarNotificacion('Error del servidor: ' + text.substring(0, 100), 'error');
                return;
            }
            
            if (data.success) {
                document.getElementById('modalGasto')?.remove();
                window.pos.mostrarNotificacion('✅ Gasto registrado', 'success');
                await this.verificarEstadoCaja();
                this.actualizarUI();
            } else {
                window.pos.mostrarNotificacion(data.message || 'Error al registrar gasto', 'error');
            }
        } catch (error) {
            window.pos.mostrarNotificacion('Error al registrar gasto: ' + error.message, 'error');
            console.error(error);
        }
    }

    async mostrarHistorial() {
        try {
            const response = await fetch(this.apiUrl + '?accion=getHistorialCaja');
            const data = await response.json();
            
            if (data.success) {
                const container = document.getElementById('historialContainer');
                if (!container) return;
                
                if (data.historial.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 3rem; color: var(--gray);">
                            <i class="fas fa-history" style="font-size: 4rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                            <p style="font-size: 1.2rem;">No hay cortes de caja registrados</p>
                            <p style="margin-top: 0.5rem;">Los cortes aparecerán aquí cuando se cierren</p>
                        </div>
                    `;
                    return;
                }
                
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
                                                <button onclick="moduloCaja.verDetalleCorte(${corte.id})" 
                                                        class="btn-accion" 
                                                        title="Ver detalles del corte">
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
                
                // Agregar estilos para la tabla responsiva y botones
                this.agregarEstilosHistorial();
            }
        } catch (error) {
            console.error('Error cargando historial:', error);
            window.pos.mostrarNotificacion('Error al cargar historial', 'error');
        }
    }

    agregarEstilosHistorial() {
        // Verificar si ya existen los estilos
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
                min-width: 1000px;
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
            
            .tabla-historial th:first-child {
                border-top-left-radius: var(--radius-lg);
            }
            
            .tabla-historial th:last-child {
                border-top-right-radius: var(--radius-lg);
            }
            
            .tabla-historial td {
                padding: 1rem;
                border-bottom: 1px solid var(--light);
                font-size: 0.9rem;
                vertical-align: middle;
            }
            
            .tabla-historial tr {
                transition: all 0.3s ease;
            }
            
            .tabla-historial tr:hover {
                background: rgba(230, 126, 34, 0.05);
            }
            
            .tabla-historial tr:last-child td {
                border-bottom: none;
            }
            
            .btn-accion {
                background: var(--primary);
                color: white;
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            
            .btn-accion:hover {
                background: var(--secondary);
                transform: translateY(-2px) scale(1.1);
                box-shadow: 0 4px 10px rgba(230, 126, 34, 0.4);
            }
            
            .btn-accion i {
                font-size: 1rem;
                transition: transform 0.3s ease;
            }
            
            .btn-accion:hover i {
                transform: scale(1.1);
            }
            
            .diferencia-positiva {
                color: var(--success);
                font-weight: bold;
            }
            
            .diferencia-negativa {
                color: var(--danger);
                font-weight: bold;
            }
            
            .diferencia-cero {
                color: var(--gray);
                font-weight: bold;
            }
            
            .btn-modal {
                flex: 1;
                padding: 1rem;
                border: none;
                border-radius: var(--radius-md);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .btn-primary {
                background: var(--success);
                color: white;
            }
            
            .btn-primary:hover {
                background: var(--success-dark);
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(39, 174, 96, 0.3);
            }
            
            .btn-secondary {
                background: var(--danger);
                color: white;
            }
            
            .btn-secondary:hover {
                background: #a04545;
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(197, 48, 48, 0.3);
            }
            
            @media (max-width: 768px) {
                .tabla-historial th,
                .tabla-historial td {
                    padding: 0.8rem;
                    font-size: 0.85rem;
                }
                
                .btn-accion {
                    width: 32px;
                    height: 32px;
                }
                
                .btn-accion i {
                    font-size: 0.9rem;
                }
            }
            
            @media (max-width: 576px) {
                .tabla-historial th,
                .tabla-historial td {
                    padding: 0.6rem;
                    font-size: 0.8rem;
                }
                
                .btn-accion {
                    width: 28px;
                    height: 28px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    async verDetalleCorte(corteId) {
        try {
            const response = await fetch(this.apiUrl + '?accion=getDetalleCorte&corte_id=' + corteId);
            const data = await response.json();
            
            if (data.success) {
                this.mostrarModalDetalle(data);
            }
        } catch (error) {
            console.error('Error cargando detalle:', error);
            window.pos.mostrarNotificacion('Error al cargar detalle', 'error');
        }
    }

    mostrarModalDetalle(data) {
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
            <div class="modal-contenido" style="max-width: 800px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-file-invoice" style="color: var(--secondary);"></i> 
                        Detalle del Corte #${corte.id}
                    </h3>
                    <button onclick="this.closest('.modal').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">
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
                
                <h4 style="margin: 1.5rem 0 1rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-shopping-cart"></i> Ventas del Corte
                    <span style="background: var(--secondary); color: white; padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                        ${data.ventas.length} ventas
                    </span>
                </h4>
                <div style="max-height: 300px; overflow-y: auto; border: 2px solid var(--light); border-radius: var(--radius-md);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: var(--primary); color: white; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 0.8rem; text-align: left;">Folio</th>
                                <th style="padding: 0.8rem; text-align: left;">Método</th>
                                <th style="padding: 0.8rem; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.ventas.map(venta => `
                                <tr style="border-bottom: 1px solid var(--light);">
                                    <td style="padding: 0.8rem;">
                                        <i class="fas fa-receipt" style="color: var(--secondary); margin-right: 0.5rem;"></i>
                                        ${venta.folio}
                                    </td>
                                    <td style="padding: 0.8rem;">
                                        <span style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.8rem; border-radius: 20px; 
                                                   background: ${venta.metodo_pago === 'Efectivo' ? 'rgba(39, 174, 96, 0.1)' : 
                                                              (venta.metodo_pago === 'Tarjeta' ? 'rgba(52, 152, 219, 0.1)' : 'rgba(155, 89, 182, 0.1)')};
                                                   color: ${venta.metodo_pago === 'Efectivo' ? 'var(--success)' : 
                                                           (venta.metodo_pago === 'Tarjeta' ? '#3498db' : '#9b59b6')};">
                                            <i class="fas ${venta.metodo_pago === 'Efectivo' ? 'fa-money-bill' : 
                                                             (venta.metodo_pago === 'Tarjeta' ? 'fa-credit-card' : 'fa-university')}"></i>
                                            ${venta.metodo_pago}
                                        </span>
                                    </td>
                                    <td style="padding: 0.8rem; text-align: right; font-weight: bold;">$${parseFloat(venta.total).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <h4 style="margin: 1.5rem 0 1rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-exchange-alt"></i> Movimientos de Caja
                    <span style="background: var(--secondary); color: white; padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.8rem;">
                        ${data.movimientos.length} movimientos
                    </span>
                </h4>
                <div style="max-height: 200px; overflow-y: auto; border: 2px solid var(--light); border-radius: var(--radius-md);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: var(--primary); color: white; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 0.8rem; text-align: left;">Tipo</th>
                                <th style="padding: 0.8rem; text-align: left;">Concepto</th>
                                <th style="padding: 0.8rem; text-align: right;">Monto</th>
                                <th style="padding: 0.8rem; text-align: left;">Referencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.movimientos.map(mov => `
                                <tr style="border-bottom: 1px solid var(--light);">
                                    <td style="padding: 0.8rem;">
                                        <span style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.8rem; border-radius: 20px; 
                                                   background: ${mov.tipo === 'ingreso' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)'};
                                                   color: ${mov.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)'};">
                                            <i class="fas ${mov.tipo === 'ingreso' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                                            ${mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                                        </span>
                                    </td>
                                    <td style="padding: 0.8rem;">${mov.concepto}</td>
                                    <td style="padding: 0.8rem; text-align: right; font-weight: bold; color: ${mov.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)'};">
                                        ${mov.tipo === 'ingreso' ? '+' : '-'}$${parseFloat(mov.monto).toFixed(2)}
                                    </td>
                                    <td style="padding: 0.8rem;">
                                        ${mov.referencia ? `<span style="background: var(--light); padding: 0.2rem 0.5rem; border-radius: 4px;">${mov.referencia}</span>` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button onclick="window.print()" 
                            class="btn-modal" style="flex: 1; background: var(--secondary); color: white;">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                    <button onclick="this.closest('.modal').remove()" 
                            class="btn-modal" style="flex: 1; background: var(--primary); color: white;">
                        <i class="fas fa-check"></i> Cerrar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    cargarEventos() {
        document.querySelectorAll('.menu-item[data-modulo="caja"]').forEach(item => {
            item.addEventListener('click', () => {
                this.mostrarModulo();
            });
        });
    }

    cargarEventosInternos() {
        // Eventos específicos del módulo
    }

    mostrarModulo() {
        console.log('Mostrando módulo de caja');
        
        // Ocultar otros módulos
        document.querySelectorAll('.contenido-principal > section').forEach(s => {
            s.style.display = 'none';
        });
        
        // Mostrar o crear el módulo de caja
        let moduloCaja = document.getElementById('moduloCaja');
        if (!moduloCaja) {
            moduloCaja = document.createElement('section');
            moduloCaja.id = 'moduloCaja';
            moduloCaja.className = 'escanner-section';
            moduloCaja.innerHTML = '<div id="moduloCajaContent"></div>';
            document.querySelector('.contenido-principal').appendChild(moduloCaja);
        }
        
        moduloCaja.style.display = 'block';
        
        // Actualizar contenido
        this.actualizarUI();
        
        // Cargar historial si está visible
        setTimeout(() => this.mostrarHistorial(), 100);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.moduloCaja = new ModuloCaja();
        window.moduloCaja.init();
    });
} else {
    window.moduloCaja = new ModuloCaja();
    window.moduloCaja.init();
}