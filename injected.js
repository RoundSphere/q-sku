console.clear();
console.log( '***** Content Script ******' );

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
            qty: options.masterQty,
            parent: options.id
        };
        this.listings = [];
        this.listings.push( new ListingObject( listingOpts ) );
    }
    addListing(){
        let newListing = new ListingObject({ sku: this.masterSku, qty: "0", parent: this.id });
        this.listings.push( newListing );
        return this;
    }
    removeListing( listingId ){
        let item = this.listings.find( listing => listing.id === listingId );
        let index = this.listings.indexOf( item );

        if( index > -1 ){
            this.listings.splice(index, 1);
        }
        return this;
    }
}
class ListingObject{
    constructor( options ){
        console.log("Listing Object Created");
        this.id         = options.parent + '_' + Date.now();
        this.masterSku  = options.sku;
        this.listingSku = options.sku;
        this.listingQty = options.qty;
        this.sendToFBA  = true;
        this.ltl        = true;
        this.parent     = options.parent;
    }
}

class InjectScript {
    constructor() {
        console.log("InjectScript loaded");
        this.registerEventHandlers();
        this.observer = new MutationSummary({
            callback: () => this.poLoaded(),
            queries: [{ element: '#poItemsGrid' }]
        });
    }
    registerEventHandlers() {
        // Click on an invoice in ordersGrid
        $(document).on('click', '#ordersGrid', (e) => {
            console.log( 'a thing was clicked' );
        });
        // Open Manage PO Modal
        $(document).on('click', '#managePoItem', (e) => {
            e.preventDefault();
            this.openManageModal();
        });
        $(document).on('click', '.createNew', (e) => {
            e.preventDefault();
            let el = $( e.currentTarget );
            let id = el.data( 'itemid' ).toString();
            let masterItem = this.data.items.find( item => item.id === id );
            let newMasterItem = masterItem.addListing();

            this.renderListing( newMasterItem, this.listingsForMaster[id] );
        });
        $(document).on('click', '.deleteRow', (e) => {
            e.preventDefault();
            let el = $( e.currentTarget );
            let id = el.data( 'itemid' ).toString();
            let masterItem = this.data.items.find( item => item.id === id );
            let listingId = el.data( 'listingid' ).toString();
            let newMasterItem = masterItem.removeListing( listingId );

            this.renderListing( newMasterItem, this.listingsForMaster[id] );
        });
        $(document).on('click', '#savePoDetails', (e) => {
            e.preventDefault();
            this.savePoDetails();
        });
        // Close Manage PO Modal
        $(document).on('click', '.ext-modal-close', e => {
            e.preventDefault();
            $('#ext-modal').remove();
        });
    }
    openManageModal() {
        $('body').append('<div id="ext-modal"></div>' );
        $('#ext-modal').html( extModalTemplate());
        this.listingsForMaster = {};
        let self = this;

        async function getListingsForMaster( item ){
            let result = await ajax(item.masterSku);
            self.listingsForMaster[item.id] = result;
        }
        async function processMasters( array ){
            const promises = array.map( getListingsForMaster );
            await Promise.all( promises );
            self.renderTable();
        }
        processMasters( this.data.items );
    }
    renderTable(){
        let el = $('.modal__content');
        if( el.length ){
            // Render table
            el.html( extModalTable( this.data ) );
            let optionValue = listing => `${listing.listingSku} - ${listing.salesChannelId}`;
            let optionsString = item => this.listingsForMaster[item.id].map( listing => extListingsDropdown( optionValue( listing ) ) ).join( '' );
            let templates = this.data.items.map( item => extMasterSku(item, optionsString( item ) ) );
            el.find('.master-sku-container').html( templates.join('') );

            el.find( 'select' ).select2({
                dropdownParent: el
            });
        }
    }
    renderListing( master ){
        let optionValue = listing => `${listing.listingSku} - ${listing.salesChannelId}`;
        let optionsString = item => this.listingsForMaster[item.parent].map( listing => extListingsDropdown( optionValue( listing ) ) ).join( '' );
        let rows = master.listings.map( item => extListingSku( item, optionsString( item ) )).join('');
        let masterRow = $(`.masterItemRow[data-masterid=${master.id}]`);
        let listingContainer = masterRow.next( '.listings-container' );
        listingContainer.html( rows );
        listingContainer.find('select').select2({
            dropdownParent: listingContainer
        });
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
            return validateJson( validJson );
        } else {
            let msg = 'the internal notes were not valid json.';
                msg += 'Value of #internalNotes will be added to this.data.additionalNotes.';
            if( ! notesVal ){
                msg = 'Notes were empty. They need to be created for the first time';
            }
            // alert( msg );
            return false;
        }
    }
    poLoaded(){
        waitFor( '#poItemsGrid' ).then( (container) => {
            console.log( 'poItemsGrid has been (re)rendered' );
            $('#addPoItemHolder').before( '<div id="ext-managePoItem" />' );
            $('#ext-managePoItem').html(extButton());

            this.setUpNotes();
            this.data = this.checkNotes();

            let tableValues = this.getTableValues( container );

            if( ! this.data ){
                this.data = new PoObject();
                this.data.items = this.createMasterSkus( tableValues );
            } else {
                this.checkPoForUpdate( tableValues );
            }
        });
    }

    getTableValues( container ){
        console.log( 'get master skus from table');
        let rows = Array.from( $( container ).find( 'tr' ) ).filter( (row, idx) => idx > 0 );
        let masterSkusFromTable = rows.map( item => {
            function getCell( value ){
                return $( item ).find( `td[aria-describedby=poItemsGrid_${value}]` ).text();
            }
            return {
                id: getCell( 'itemId' ),
                masterSku: getCell( 'productSkuAndName' ).split( ' :: ' )[0],
                masterQty: getCell( 'itemQuantity' )
            };
        });
        return masterSkusFromTable;
    }
    createMasterSkus(values){
        return values.map( item => new ItemObject( item ) );
    }
    checkPoForUpdate( tableValues ){
        let tableLength = tableValues.length;
        let dataset = this.data.items;
        let datasetLength = dataset.length;

        console.log( tableLength, datasetLength );
        console.log( dataset );
        if( tableLength > datasetLength ){
            console.log( '> an item has been added -> add to dataset' );
            let added = tableValues.filter( table => dataset.map( item => item.id ).indexOf( table.id ) === -1 );
            // TODO Alow for multiple
            dataset.push( new ItemObject( added[0] ) );
            console.log( dataset );
        } else if( datasetLength > tableLength ){
            console.log( '> an item has been deleted -> remove from dataset');
        } else {
            console.log( 'lengths are equal -> check quantities' );
        }
    }

    savePoDetails(){
        var confirmUpdate = confirm( 'You are about to change the notes. Are you sure?');
        if( confirmUpdate ){
            $('#internalNotes').val( JSON.stringify( this.data ) ) ;
        }
    }

    // So far, this should only be for editing an exiting PO. Will need to edit this, rebuild for new POs
    updateDetails(){

    }
}

let injectScript = new InjectScript();
//# sourceMappingURL=inject.js.map
