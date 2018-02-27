console.clear();
console.log( '***** Content Script ******' );

function makeRequest (method, url, done) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onload = function () {
        done(null, xhr.response);
    };
    xhr.onerror = function () {
        done(xhr.response);
    };
    xhr.send();
}

class InjectScript {
    constructor() {
        console.log("InjectScript loaded");
        this.registerEventHandlers();
        this.observer = new MutationSummary({
            callback: () => this.updateDetails(),
            queries: [{ element: '#poItemsGrid' }]
        });
    }
    registerEventHandlers() {
        // Click on an invoice in ordersGrid
        $(document).on('click', '#ordersGrid', (e) => {
            console.log( 'a thing was clicked' );
        });
        // Click on Save in modal while adding item to existing PO or editing
        // $(document).on('click', 'div[aria-describedby=poItemDialog] button:contains(Save)', (e) => {
        //     console.log( 'the button in the dialog box was clicked' );
        //     this.checkGridStatus();
        // });
        // Open Manage PO Modal
        $(document).on('click', '#managePoItem', (e) => {
            this.manageModal();
        });
        // Close Manage PO Modal
        $(document).on('click', '.ext-modal-close', e => {
            e.preventDefault();
            $('#ext-modal').remove();
        });
    }
    manageModal() {
        console.log( this.data );
        $('body').append('<div id="ext-modal"></div>' );
        $('#ext-modal').html( extModalTemplate( this.data ));
    }
    updateDetails( summary ){
        this.waitFor( '#poItemsGrid' ).then( (container) => {
            // Diable #internalNotes
            $('#internalNotes').attr( 'readonly', true );
            $('#internalNotes').before('<p style="width: 200px; font-size: 11px; line-height: 1.1; margin: 0; color: #e44;">Internal Notes has been disabled. Please use the Manage button to add notes.</p>');

            $('#addPoItemHolder').before( '<div id="ext-managePoItem" />' );
            $('#ext-managePoItem').html(extButton());
            console.log( 'poItemsGrid has been (re)rendered' );
            this.data = {
                id: $('#poDetailsPane').find('ul > span').text().split('#')[1],
                items: []
            };
            let rows = $( container ).find( 'tr' );
            function getCell( value ){
                return $( rows[i] ).find( '[aria-describedby=poItemsGrid_' + value + ']' ).text();
            }
            for( var i = 1, rowLength = rows.length; i<rowLength; i++ ){
                let cells = rows[i].cells;
                this.data.items.push({
                    id: getCell( 'itemId' ),
                    vendorSku: getCell( 'vendorSku' ),
                    qty: getCell( 'itemQuantity' )
                });
            }
            $('#internalNotes').val( JSON.stringify( this.data ) ) ;
            console.log( this.data );
        });
    }
    waitFor(selector) {
        return new Promise((resolve) => {
            let resolved = false;
            let element = $(selector, document).get(0);
            if (element) {
                resolve(element);
            }
            else {
                let observer = new MutationObserver(function () {
                    if (resolved === false) {
                        element = $(selector, document).get(0);
                        if (element) {
                            resolve(element);
                            observer.disconnect();
                            resolved = true;
                        }
                    }
                });
                observer.observe(document, {
                    childList: true,
                    subtree: true,
                });
            }
        });
    }
    wait(time) {
        return new Promise((resolve) => {
            setTimeout(resolve, time);
        });
    }
}

function formatMoney(val) {
    return `$${commafy(val)}`;
}
function parseMoney(val) {
    return parseInt(val.replace("$", "").replace(/,/g, ""));
}
function commafy(num) {
    if (!num) {
        return "0";
    }
    let str = num.toString().split('.');
    if (str[0].length >= 5) {
        str[0] = str[0].replace(/(\d)(?=(\d{3})+$)/g, '$1,');
    }
    if (str[1] && str[1].length >= 5) {
        str[1] = str[1].replace(/(\d{3})/g, '$1 ');
    }
    return str.join('.');
}

function extModalTemplate( data ){
    return `
        <div id="ext-modal__inner">
            <span class="ext-modal-close">Close</span>
            <p><strong>PO #: </strong> - ${data.id}</p>
            ${data.items.map( item => `<p>${item.id} - ${item.vendorSku} - ${item.qty}</p>`).join('')}
        </div>
    `;
}
function extButton(){
    return `
        <button id="managePoItem" style="margin-bottom: 5px; width:70px;" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-icon-primary" role="button">
            <span class="ui-button-icon-primary ui-icon" style="background-position: -112px -80px;"></span>
            <span class="ui-button-text">Manage</span>
        </button>
    `;
}

let injectScript = new InjectScript();
//# sourceMappingURL=inject.js.map
