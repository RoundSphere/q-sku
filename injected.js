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

function tryParseJSON (jsonString){
    try {
        var o = JSON.parse(jsonString);
        if (o && typeof o === "object") {
            return o;
        }
    }
    catch (e) { }
    return false;
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
        $(document).on('click', '#createNew', (e) => {
            // Proof of concept - just splitting the first item
            this.data.items[0].allocate();
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
    setUpNotes(){
        // Diable #internalNotes
        // $('#internalNotes').attr( 'readonly', true ).hide();
        $('#internalNotes').removeAttr( 'maxlength' );

        $('#internalNotes').before( extInternalNoteMsg() );
        // This is probably just for dev. Probably remove before deploy
        let currentNotesString = `<p style="width: 200px; max-height: 50px; overflow: auto; line-height: 1;">`;
            currentNotesString += `Current Notes: ${$('#internalNotes').val()}</p>`;
        $('#internalNotes').before( currentNotesString );
    }
    checkNotes(){
        let notesVal = $('#internalNotes').val();
        let validJson = tryParseJSON( notesVal );
        if( validJson ){
            return this.validateJson( validJson );
        } else {
            let msg = 'the internal notes were not valid json.';
                msg += 'Value of #internalNotes will be added to this.data.additionalNotes.';
            if( ! notesVal ){
                msg = 'Notes were empty. They need to be created for the first time';
            }
            alert( msg );
            return false;
        }
    }
    validateJson( value ){
        let errors = [];

        if( ! value.hasOwnProperty( 'id' ) ){
            errors.push( 'id is broken' );
        } else {
            if( typeof value.id != 'string' ){
                errors.push( 'id is not a string' );
            }
        }

        if( ! value.hasOwnProperty( 'items' ) ){
            errors.push( 'items is broken' );
        } else {
            if( ! Array.isArray( value.items ) ){
                errors.push( 'items is not an array' );
            } else {
                value.items.forEach((item, idx) => {
                    if( ! item.hasOwnProperty( 'id' ) ){
                        errors.push( '-item ' + idx + ' is missing id' );
                    }
                    if( ! item.hasOwnProperty( 'vendorSku' ) ){
                        errors.push( '-item ' + idx + ' is missing vendorSku' );
                    }
                    if( ! item.hasOwnProperty( 'masterQty' ) ){
                        errors.push( '-item ' + idx + ' is missing masterQty' );
                    }
                    if( ! item.hasOwnProperty( 'listings' ) ){
                        errors.push( '-item ' + idx + ' is missing listings' );
                    } else {
                        if( ! Array.isArray( item.listings ) ){
                            errors.push( '-item ' + idx + ' is not an array' );
                        } else {
                            item.listings.forEach((listing, key) => {
                                if( ! listing.hasOwnProperty( 'listingSku' ) ){
                                    errors.push( '-- ' + key + ' is missing listingSku' );
                                }
                                if( ! listing.hasOwnProperty( 'listingQty' ) ){
                                    errors.push( '-- ' + key + ' is missing listingQty' );
                                }
                                if( ! listing.hasOwnProperty( 'sendToFBA' ) ){
                                    errors.push( '-- ' + key + ' is missing sendToFBA' );
                                }
                                if( ! listing.hasOwnProperty( 'ltl' ) ){
                                    errors.push( '-- ' + key + ' is missing ltl' );
                                }

                            });
                        }
                    }
                });
            }
        }

        if( ! value.hasOwnProperty( 'additionalNotes' ) ){
            errors.push( 'additionalNotes is broken' );
        }

        if( errors.length > 0 ){
            alert( 'Something is wrong: \n-' + errors.join( '\n-' ) );
        } else {
            console.log( 'the json from the notes is valid and ready to be updated' );
            return value;
        }
    }
    // So far, this should only be for editing an exiting PO. Will need to edit this, rebuild for new POs
    updateDetails( summary ){
        this.waitFor( '#poItemsGrid' ).then( (container) => {
            console.log( 'poItemsGrid has been (re)rendered' );
            this.setUpNotes();
            this.data = this.checkNotes();

            if( ! this.data ){
                this.data = new PoObject();
            }

            $('#addPoItemHolder').before( '<div id="ext-managePoItem" />' );
            $('#ext-managePoItem').html(extButton());

            let rows = $( container ).find( 'tr' );
            function getCell( value ){
                return $( rows[i] ).find( '[aria-describedby=poItemsGrid_' + value + ']' ).text();
            }
            for( var i = 1, rowLength = rows.length; i<rowLength; i++ ){
                let cells = rows[i].cells;
                let options = {
                    id: getCell( 'itemId' ),
                    masterSku: getCell( 'productSkuAndName' ).split( ' :: ' )[0],
                    vendorSku: getCell( 'vendorSku' ),
                    masterQty: getCell( 'itemQuantity' )
                };
                this.data.items.push( new ItemObject( options ) );
            }

            console.log( JSON.stringify( this.data, null, 4 ));

            // var confirmUpdate = confirm( 'You are about to change the notes. Are you sure?');
            // if( confirmUpdate ){
            //     console.log( 'Update confirmed' );
            //     $('#internalNotes').val( JSON.stringify( this.data ) ) ;
            // }
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
class PoObject {
    constructor() {
        console.log("PO Object Created");
        this.id = $('#poDetailsPane').find('ul > span').text().split('#')[1];
        this.items = [];
        this.additionalNotes = '';
    }
}
class ItemObject {
    constructor( options ){
        console.log("Item Object Created");
        this.id        = options.id;
        this.masterSku = options.masterSku;
        this.masterQty = options.masterQty;

        let listingOpts = {
            sku: options.masterSku,
            qty: options.masterQty
        };
        this.listings = [];
        this.listings.push( new ListingObject( listingOpts ) );
    }
    allocate(){
        this.listings.push( new ListingObject({ sku: this.masterSku, qty: "0" }) );
    }
}
class ListingObject{
    constructor( options ){
        console.log("Listing Object Created");
        this.masterSku  = options.sku;
        this.listingSku = options.sku;
        this.listingQty = options.qty;
        this.sendToFBA  = true;
        this.ltl        = true;
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

const extInternalNoteMsg = function(){
    return `
        <p class="ext-notice">Internal Notes has been disabled. Please use the Manage button to add notes.</p>
    `;
};

function extModalTemplate( data ){
    return `
        <div id="ext-modal__inner">
            <span class="ext-modal-close">Close</span>
            <p><strong>PO #: </strong> - ${data.id}</p>
            ${data.items.map( item => `<p>${item.id} - ${item.masterSku} - ${item.masterQty}</p>`).join('')}
            <div id="createNew">Create a new listing</div>
        </div>
    `;
}
function extButton(){
    return `
        <button id="managePoItem" style="margin-bottom: 5px; width:70px;"
            class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-icon-primary" role="button">
            <span class="ui-button-icon-primary ui-icon" style="background-position: -112px -80px;"></span>
            <span class="ui-button-text">Manage</span>
        </button>
    `;
}

let injectScript = new InjectScript();
//# sourceMappingURL=inject.js.map
