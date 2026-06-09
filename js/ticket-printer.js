class TicketPrinter {
    constructor() {
        this.printerConnected = false;
        this.printIframe = null;
        this.initHiddenIframe();
    }

    initHiddenIframe() {
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

    formatearFecha(valor) {
        if (typeof valor === 'string') {
            const d = new Date(valor);
            if (isNaN(d.getTime())) return valor;
            return `${d.toLocaleDateString('es-MX')} ${d.toLocaleTimeString('es-MX')}`;
        }
        if (valor instanceof Date && !isNaN(valor.getTime())) {
            return `${valor.toLocaleDateString('es-MX')} ${valor.toLocaleTimeString('es-MX')}`;
        }
        const ahora = new Date();
        return `${ahora.toLocaleDateString('es-MX')} ${ahora.toLocaleTimeString('es-MX')}`;
    }

    generateTicketHTML(venta) {
        const fechaFormateada = this.formatearFecha(venta.fecha);

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
                        size: 58mm 297mm;
                        margin: 0;
                    }
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Courier New', 'Lucida Sans Typewriter', monospace;
                        font-size: 11px;
                        font-weight: bold;
                        width: 58mm;
                        margin: 0 auto;
                        padding: 2mm;
                        background: white;
                    }
                    .ticket { width: 100%; }
                    .header {
                        text-align: center;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 5px;
                        margin-bottom: 5px;
                    }
                    .header h1 {
                        font-size: 14px;
                        font-weight: bold;
                        margin-bottom: 3px;
                    }
                    .header p {
                        font-size: 9px;
                        font-weight: bold;
                        margin: 2px 0;
                    }
                    .header .rfc {
                        font-size: 10px;
                        font-weight: bold;
                        margin: 4px 0 2px;
                    }
                    .header .direccion {
                        font-size: 9px;
                        font-weight: bold;
                        line-height: 1.4;
                        margin-bottom: 4px;
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
                        font-weight: bold;
                    }
                    .items {
                        margin: 8px 0;
                        width: 100%;
                    }
                    .ticket-line {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                        font-size: 10px;
                        font-weight: bold;
                    }
                    .item-name {
                        flex: 2;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        font-weight: bold;
                    }
                    .item-qty {
                        width: 30px;
                        text-align: center;
                        font-weight: bold;
                    }
                    .item-price {
                        width: 45px;
                        text-align: right;
                        font-weight: bold;
                    }
                    .item-subtotal {
                        width: 50px;
                        text-align: right;
                        font-weight: bold;
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
                        font-size: 12px;
                    }
                    .aviso {
                        margin-top: 10px;
                        padding: 8px 4px;
                        border: 1px solid #000;
                        border-radius: 2px;
                        text-align: center;
                    }
                    .aviso-texto {
                        font-size: 10px;
                        font-weight: bold;
                        letter-spacing: 1px;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 10px;
                        padding-top: 5px;
                        border-top: 1px dashed #000;
                        font-size: 9px;
                        font-weight: bold;
                    }
                    hr {
                        border: none;
                        border-top: 1px dashed #000;
                        margin: 5px 0;
                    }
                    span {
                        font-weight: bold;
                    }
                    div {
                        font-weight: bold;
                    }
                    strong {
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h1>🏪 PINTUMEX</h1>
                        <p class="rfc">RFC: RAZD961230NS9</p>
                        <p class="direccion">
                            Calle Negrete Poniente 210<br>
                            Barrio del Centro<br>
                            75200 Tepeaca, Puebla
                        </p>
                        <p>${fechaFormateada}</p>
                    </div>

                    <div class="info">
                        <div class="info-line">
                            <span>FOLIO:</span>
                            <span><strong>${venta.folio || ''}</strong></span>
                        </div>
                        <div class="info-line">
                            <span>CAJERO:</span>
                            <span>Pintumex Tepeaca</span>
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

                    <div class="aviso">
                        <div class="aviso-texto">⚠️ NO HAY CAMBIOS NI DEVOLUCIONES ⚠️</div>
                    </div>

                    <div class="footer">
                        <hr>
                        <p>¡Gracias por su compra!</p>
                        <p>Vuelva pronto</p>
                        <hr>
                        <p style="font-size: 8px;">https://pintumex.com.mx</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    printThermalSilent(ticketHtml) {
        try {
            if (!this.printIframe) {
                this.initHiddenIframe();
            }
            const iframeDoc = this.printIframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(ticketHtml);
            iframeDoc.close();
            setTimeout(() => {
                try {
                    this.printIframe.contentWindow.focus();
                    this.printIframe.contentWindow.print();
                    setTimeout(() => {
                        if (iframeDoc.body) iframeDoc.body.innerHTML = '';
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
            setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 100);
    }

    truncate(str, maxLength) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 2) + '..';
    }
}

window.ticketPrinter = new TicketPrinter();