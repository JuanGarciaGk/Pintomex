// js/ticket-printer.js
class TicketPrinter {
    constructor() {
        this.printerConnected = false;
        this.printIframe = null;
        this.initHiddenIframe();
    }

    initHiddenIframe() {
        // Crear un iframe oculto que reutilizaremos para todas las impresiones
        if (!this.printIframe) {
            this.printIframe = document.createElement('iframe');
            this.printIframe.style.position = 'absolute';
            this.printIframe.style.width = '0';
            this.printIframe.style.height = '0';
            this.printIframe.style.border = 'none';
            this.printIframe.style.visibility = 'hidden';
            this.printIframe.style.top = '-1000px';
            this.printIframe.style.left = '-1000px';
            document.body.appendChild(this.printIframe);
        }
    }

    async printTicket(venta, autoPrint = true) {
        const ticketHtml = this.generateTicketHTML(venta);
        
        if (autoPrint) {
            this.printThermalSilent(ticketHtml);
        }
        
        return ticketHtml;
    }

    generateTicketHTML(venta) {
        const fecha = new Date(venta.fecha);
        const fechaFormateada = `${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}`;
        
        const itemsHTML = venta.items.map(item => {
            const precio = parseFloat(item.precio) || 0;
            const subtotal = parseFloat(item.subtotal) || 0;
            const cantidad = parseInt(item.cantidad) || 0;
            const nombre = item.nombre || '';
            
            return `
                <div class="ticket-line">
                    <span class="item-name">${this.truncate(nombre, 28)}</span>
                    <span class="item-qty">${cantidad}x</span>
                    <span class="item-price">$${precio.toFixed(2)}</span>
                    <span class="item-subtotal">$${subtotal.toFixed(2)}</span>
                </div>
            `;
        }).join('');
        
        let pagoHTML = '';
        if (venta.metodo_pago === 'Efectivo' && venta.efectivo_recibido) {
            const efectivoRecibido = parseFloat(venta.efectivo_recibido) || 0;
            const cambio = parseFloat(venta.cambio) || 0;
            pagoHTML = `
                <div class="ticket-line">
                    <span>Efectivo recibido:</span>
                    <span>$${efectivoRecibido.toFixed(2)}</span>
                </div>
                <div class="ticket-line">
                    <span>Cambio:</span>
                    <span>$${cambio.toFixed(2)}</span>
                </div>
            `;
        }
        
        const subtotal = parseFloat(venta.subtotal) || 0;
        const total = parseFloat(venta.total) || 0;
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Ticket ${venta.folio}</title>
                <style>
                    @page {
                        size: 80mm 297mm;
                        margin: 0;
                    }
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Courier New', 'Lucida Sans Typewriter', monospace;
                        font-size: 12px;
                        width: 80mm;
                        margin: 0 auto;
                        padding: 2mm;
                        background: white;
                    }
                    .ticket {
                        width: 100%;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 5px;
                        margin-bottom: 5px;
                    }
                    .header h1 {
                        font-size: 16px;
                        margin-bottom: 3px;
                    }
                    .header p {
                        font-size: 10px;
                        margin: 2px 0;
                    }
                    .info {
                        margin: 8px 0;
                        padding: 5px 0;
                        border-bottom: 1px dotted #000;
                    }
                    .info-line {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                    }
                    .items {
                        margin: 8px 0;
                        width: 100%;
                    }
                    .ticket-line {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                        font-size: 11px;
                    }
                    .item-name {
                        flex: 2;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .item-qty {
                        width: 35px;
                        text-align: center;
                    }
                    .item-price {
                        width: 55px;
                        text-align: right;
                    }
                    .item-subtotal {
                        width: 60px;
                        text-align: right;
                    }
                    .totales {
                        border-top: 1px dashed #000;
                        margin-top: 5px;
                        padding-top: 5px;
                    }
                    .total-line {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                        font-weight: bold;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 10px;
                        padding-top: 5px;
                        border-top: 1px dashed #000;
                        font-size: 10px;
                    }
                    hr {
                        border: none;
                        border-top: 1px dashed #000;
                        margin: 5px 0;
                    }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h1>🏪 PINTUMEX</h1>
                        <p>Punto de Venta</p>
                        <p>${fechaFormateada}</p>
                    </div>
                    
                    <div class="info">
                        <div class="info-line">
                            <span>FOLIO:</span>
                            <span><strong>${venta.folio || ''}</strong></span>
                        </div>
                        <div class="info-line">
                            <span>CAJERO:</span>
                            <span>Administrador</span>
                        </div>
                    </div>
                    
                    <div class="items">
                        <div class="ticket-line" style="border-bottom: 1px dotted #000; margin-bottom: 3px;">
                            <span class="item-name">PRODUCTO</span>
                            <span class="item-qty">CANT</span>
                            <span class="item-price">P.UNIT</span>
                            <span class="item-subtotal">SUBT</span>
                        </div>
                        ${itemsHTML}
                    </div>
                    
                    <div class="totales">
                        <div class="ticket-line">
                            <span>SUBTOTAL:</span>
                            <span>$${subtotal.toFixed(2)}</span>
                        </div>
                        ${pagoHTML}
                        <div class="total-line">
                            <span>TOTAL:</span>
                            <span>$${total.toFixed(2)}</span>
                        </div>
                        <div class="ticket-line" style="margin-top: 5px;">
                            <span>MÉTODO PAGO:</span>
                            <span>${venta.metodo_pago || ''}</span>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <hr>
                        <p>¡Gracias por su compra!</p>
                        <p>Vuelva pronto</p>
                        <hr>
                        <p style="font-size: 9px;">https://localhost/pintumex_pos/</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    printThermalSilent(ticketHtml) {
        try {
            // Reutilizar el iframe oculto
            if (!this.printIframe) {
                this.initHiddenIframe();
            }
            
            // Escribir el contenido en el iframe
            const iframeDoc = this.printIframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(ticketHtml);
            iframeDoc.close();
            
            // Pequeña pausa para asegurar que el contenido se cargó
            setTimeout(() => {
                try {
                    this.printIframe.contentWindow.focus();
                    this.printIframe.contentWindow.print();
                    
                    // Limpiar el iframe después de imprimir para liberar memoria
                    setTimeout(() => {
                        if (iframeDoc.body) {
                            iframeDoc.body.innerHTML = '';
                        }
                    }, 500);
                } catch (printError) {
                    console.error('Error al imprimir:', printError);
                    this.printFallback(ticketHtml);
                }
            }, 100);
            
        } catch (error) {
            console.error('Error en impresión silenciosa:', error);
            this.printFallback(ticketHtml);
        }
    }

    printFallback(ticketHtml) {
        // Fallback: usar un iframe temporal si el principal falla
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(ticketHtml);
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        }, 100);
    }

    truncate(str, maxLength) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 2) + '..';
    }
}

// Inicializar el printer
window.ticketPrinter = new TicketPrinter();