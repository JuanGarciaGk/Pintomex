class ModuloCaja {
    constructor() {
        this.apiUrl = 'php/api.php';
        this.cajaAbierta = false;
        this.datosCaja = null;
        this.inicializado = false;
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
                    this.datosCaja.ventas_hoy = parseInt(data.ventas_hoy) || 0;
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
                    <h2><i class="fas fa-cash-register"></i> Módulo de Caja</h2>
                    <div class="estado-caja cerrada">
                        <i class="fas fa-times-circle"></i> Caja Cerrada
                    </div>
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
        const totalVentas = this.datosCaja?.total_ventas_hoy || 0;
        const ventasHoy = this.datosCaja?.ventas_hoy || 0;
        const esperado = montoInicial + totalVentas;
        const fechaApertura = this.datosCaja?.fecha_apertura ? new Date(this.datosCaja.fecha_apertura).toLocaleString() : '';

        return `
            <div class="modulo-caja">
                <div class="caja-header">
                    <h2><i class="fas fa-cash-register"></i> Módulo de Caja</h2>
                    <div class="estado-caja abierta">
                        <i class="fas fa-check-circle"></i> Caja Abierta
                    </div>
                </div>
                
                <div class="caja-resumen">
                    <div class="resumen-card">
                        <h3>Monto Inicial</h3>
                        <div class="cantidad">$${montoInicial.toFixed(2)}</div>
                        <div class="subtexto">Apertura: ${fechaApertura}</div>
                    </div>
                    
                    <div class="resumen-card">
                        <h3>Ventas del Día</h3>
                        <div class="cantidad">$${totalVentas.toFixed(2)}</div>
                        <div class="subtexto">${ventasHoy} transacciones</div>
                    </div>
                    
                    <div class="resumen-card">
                        <h3>Esperado en Caja</h3>
                        <div class="cantidad">$${esperado.toFixed(2)}</div>
                        <div class="subtexto">Inicial + Ventas</div>
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
                <h3 style="color: var(--primary); margin-bottom: 1.5rem;">
                    <i class="fas fa-door-open"></i> Abrir Caja
                </h3>
                
                <div class="form-group">
                    <label>Monto Inicial</label>
                    <input type="number" id="montoInicial" min="0" step="0.01" placeholder="0.00" autofocus>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button onclick="moduloCaja.procesarApertura()" 
                            style="flex: 1; padding: 1rem; background: var(--success); color: white; border: none; border-radius: 12px; cursor: pointer;">
                        <i class="fas fa-check"></i> Abrir Caja
                    </button>
                    <button onclick="this.closest('.modal').remove()" 
                            style="flex: 1; padding: 1rem; background: var(--danger); color: white; border: none; border-radius: 12px; cursor: pointer;">
                        <i class="fas fa-times"></i> Cancelar
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
                window.pos.mostrarNotificacion('Caja abierta exitosamente', 'success');
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
        const totalVentas = this.datosCaja?.total_ventas_hoy || 0;
        const esperado = montoInicial + totalVentas;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'modalCierreCaja';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-contenido modal-caja">
                <h3 style="color: var(--primary); margin-bottom: 1.5rem;">
                    <i class="fas fa-door-closed"></i> Cerrar Caja
                </h3>
                
                <div style="background: #f8fafc; padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Monto Inicial:</span>
                        <span>$${montoInicial.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Ventas del Día:</span>
                        <span>$${totalVentas.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 2px dashed var(--light); padding-top: 0.5rem;">
                        <span>Esperado:</span>
                        <span>$${esperado.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Monto Final en Caja</label>
                    <input type="number" id="montoFinal" min="0" step="0.01" placeholder="0.00" autofocus>
                </div>
                
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea id="observacionesCierre" rows="3" placeholder="Notas adicionales..."></textarea>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button onclick="moduloCaja.procesarCierre()" 
                            style="flex: 1; padding: 1rem; background: var(--success); color: white; border: none; border-radius: 12px; cursor: pointer;">
                        <i class="fas fa-check"></i> Cerrar Caja
                    </button>
                    <button onclick="this.closest('.modal').remove()" 
                            style="flex: 1; padding: 1rem; background: var(--danger); color: white; border: none; border-radius: 12px; cursor: pointer;">
                        <i class="fas fa-times"></i> Cancelar
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
            
            window.pos.mostrarNotificacion('Caja cerrada exitosamente', 'success');
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
        const ventas = parseFloat(datos.ventas) || 0;
        const esperado = parseFloat(datos.esperado) || 0;
        const final = parseFloat(datos.final) || 0;
        const diferencia = parseFloat(datos.diferencia) || 0;
        
        const claseDiferencia = diferencia === 0 ? 'diferencia-cero' : 
                               (diferencia > 0 ? 'diferencia-positiva' : 'diferencia-negativa');
        
        const mensaje = diferencia === 0 ? '✅ TODO CUADRA' :
                       (diferencia > 0 ? `💰 SOBRÓ: $${Math.abs(diferencia).toFixed(2)}` : 
                                         `⚠️ FALTÓ: $${Math.abs(diferencia).toFixed(2)}`);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-contenido modal-caja">
                <h3 style="color: var(--primary); margin-bottom: 1.5rem;">
                    <i class="fas fa-clipboard-check"></i> Resultado del Corte
                </h3>
                
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Inicial:</span>
                        <span>$${inicial.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Ventas:</span>
                        <span>$${ventas.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: bold; border-top: 2px solid var(--light); padding-top: 0.5rem;">
                        <span>Esperado:</span>
                        <span>$${esperado.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Final:</span>
                        <span>$${final.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 1.3rem; font-weight: bold; margin-top: 1rem; padding-top: 1rem; border-top: 2px solid var(--light);">
                        <span>Diferencia:</span>
                        <span class="${claseDiferencia}">$${diferencia.toFixed(2)}</span>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 1rem; background: ${diferencia === 0 ? 'var(--success)' : (diferencia > 0 ? '#27AE60' : '#E74C3C')}; color: white; border-radius: 12px; margin-bottom: 1.5rem; font-size: 1.3rem;">
                    ${mensaje}
                </div>
                
                <button onclick="this.closest('.modal').remove()" 
                        style="width: 100%; padding: 1rem; background: var(--primary); color: white; border: none; border-radius: 12px; cursor: pointer;">
                    <i class="fas fa-check"></i> Aceptar
                </button>
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
                <h3 style="color: var(--primary); margin-bottom: 1.5rem;">
                    <i class="fas fa-minus-circle"></i> Registrar Gasto
                </h3>
                
                <div class="form-group">
                    <label>Concepto</label>
                    <input type="text" id="conceptoGasto" placeholder="Ej: Pago de servicios, compras...">
                </div>
                
                <div class="form-group">
                    <label>Monto</label>
                    <input type="number" id="montoGasto" min="0.01" step="0.01" placeholder="0.00">
                </div>
                
                <div class="form-group">
                    <label>Referencia (opcional)</label>
                    <input type="text" id="referenciaGasto" placeholder="Número de factura, proveedor...">
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button onclick="moduloCaja.procesarGasto()" 
                            style="flex: 1; padding: 1rem; background: var(--warning); color: white; border: none; border-radius: 12px; cursor: pointer;">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                    <button onclick="this.closest('.modal').remove()" 
                            style="flex: 1; padding: 1rem; background: var(--danger); color: white; border: none; border-radius: 12px; cursor: pointer;">
                        <i class="fas fa-times"></i> Cancelar
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
            window.pos.mostrarNotificacion('Gasto registrado', 'success');
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
                    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray);">No hay cortes de caja registrados</p>';
                    return;
                }
                
                container.innerHTML = `
                    <h3 style="color: var(--primary); margin: 2rem 0 1rem;">
                        <i class="fas fa-history"></i> Historial de Cortes
                    </h3>
                    
                    <table class="tabla-historial">
                        <thead>
                            <tr>
                                <th>Fecha Apertura</th>
                                <th>Fecha Cierre</th>
                                <th>Inicial</th>
                                <th>Ventas</th>
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
                                const montoFinal = parseFloat(corte.monto_final || 0) || 0;
                                const diferencia = parseFloat(corte.diferencia || 0) || 0;
                                
                                const claseDif = diferencia === 0 ? 'diferencia-cero' : 
                                                (diferencia > 0 ? 'diferencia-positiva' : 'diferencia-negativa');
                                const fechaApertura = new Date(corte.fecha_apertura).toLocaleString();
                                const fechaCierre = corte.fecha_cierre ? new Date(corte.fecha_cierre).toLocaleString() : 'Pendiente';
                                
                                return `
                                    <tr>
                                        <td>${fechaApertura}</td>
                                        <td>${fechaCierre}</td>
                                        <td>$${montoInicial.toFixed(2)}</td>
                                        <td>$${totalVentas.toFixed(2)}</td>
                                        <td>$${montoFinal.toFixed(2)}</td>
                                        <td class="${claseDif}">$${diferencia.toFixed(2)}</td>
                                        <td>
                                            <span style="color: ${corte.estado === 'abierta' ? 'var(--success)' : 'var(--gray)'}">
                                                ${corte.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                                            </span>
                                        </td>
                                        <td>
                                            <button onclick="moduloCaja.verDetalleCorte(${corte.id})" 
                                                    class="btn-detalle">
                                                <i class="fas fa-eye"></i> Ver
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            }
        } catch (error) {
            console.error('Error cargando historial:', error);
            window.pos.mostrarNotificacion('Error al cargar historial', 'error');
        }
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
                <h3 style="color: var(--primary); margin-bottom: 1.5rem;">
                    <i class="fas fa-file-invoice"></i> Detalle del Corte #${corte.id}
                </h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 12px;">
                        <strong>Apertura:</strong> ${new Date(corte.fecha_apertura).toLocaleString()}
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 12px;">
                        <strong>Cierre:</strong> ${corte.fecha_cierre ? new Date(corte.fecha_cierre).toLocaleString() : 'Pendiente'}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div style="text-align: center; padding: 1rem; background: white; border-radius: 12px; border: 2px solid var(--light);">
                        <div style="font-size: 0.9rem; color: var(--gray);">Inicial</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">$${montoInicial.toFixed(2)}</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: white; border-radius: 12px; border: 2px solid var(--light);">
                        <div style="font-size: 0.9rem; color: var(--gray);">Ventas</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">$${totalVentas.toFixed(2)}</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: white; border-radius: 12px; border: 2px solid var(--light);">
                        <div style="font-size: 0.9rem; color: var(--gray);">Final</div>
                        <div style="font-size: 1.5rem; font-weight: bold;">$${montoFinal.toFixed(2)}</div>
                    </div>
                </div>
                
                <div style="background: #f8fafc; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 1.2rem; font-weight: bold;">Diferencia:</span>
                        <span style="font-size: 1.5rem; font-weight: bold;" class="${claseDif}">
                            $${diferencia.toFixed(2)}
                        </span>
                    </div>
                    <div style="margin-top: 1rem; padding: 0.5rem; background: white; border-radius: 8px;">
                        <strong>Observaciones:</strong> ${corte.observaciones || 'Sin observaciones'}
                    </div>
                </div>
                
                <h4 style="margin: 1rem 0;">Ventas del Corte</h4>
                <div style="max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--light);">
                                <th style="padding: 0.5rem;">Folio</th>
                                <th style="padding: 0.5rem;">Método</th>
                                <th style="padding: 0.5rem;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.ventas.map(venta => `
                                <tr>
                                    <td style="padding: 0.5rem; text-align: center;">${venta.folio}</td>
                                    <td style="padding: 0.5rem; text-align: center;">${venta.metodo_pago}</td>
                                    <td style="padding: 0.5rem; text-align: right;">$${parseFloat(venta.total).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <button onclick="this.closest('.modal').remove()" 
                        style="width: 100%; margin-top: 2rem; padding: 1rem; background: var(--primary); color: white; border: none; border-radius: 12px; cursor: pointer;">
                    <i class="fas fa-times"></i> Cerrar
                </button>
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