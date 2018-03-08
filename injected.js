console.clear();
console.log( '***** Content Script ******' );

class PoObject {
    constructor( options ) {
        let items  = options.items;
        this.id    = options.id;
        this.items = items ? items.map( item => new ItemObject( item ) ) : [];
        this.additionalNotes = options.additionalNotes || '';
    }
}
class ItemObject {
    constructor( options ){
        console.log("> Item Object Created");
        this.id        = options.id;
        this.masterSku = options.masterSku;
        this.masterQty = options.masterQty;

        let listingOpts = {
            masterSku  : options.masterSku,
            listingQty : options.masterQty,
            parent     : options.id
        };
        let listings  = options.listings;
        this.listings = listings ? listings.map( listing => new ListingObject( listing ) ) : [ new ListingObject( listingOpts ) ];
    }
    addListing(){
        let newListing = new ListingObject({ masterSku: this.masterSku, listingQty: "0", parent: this.id });
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
        // console.log("Listing Object Created");
        this.id         = options.id || options.parent + '_' + Date.now();
        this.masterSku  = options.masterSku;
        this.listingSku = options.listingSku || options.masterSku;
        this.listingQty = options.listingQty;
        this.sendToFBA  = options.sendToFBA || true;
        this.ltl        = options.ltl || true;
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
            // console.log( 'a thing was clicked' );
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
            let masterItem = this.tempData.items.find( item => item.id === id );
            let newMasterItem = masterItem.addListing();

            this.renderListing( newMasterItem, this.listingsForMaster[id] );
        });
        $(document).on('click', '.deleteRow', (e) => {
            e.preventDefault();
            let el = $( e.currentTarget );
            let id = el.data( 'itemid' ).toString();
            let masterItem = this.tempData.items.find( item => item.id === id );
            let listingId = el.data( 'listingid' ).toString();
            let newMasterItem = masterItem.removeListing( listingId );

            this.renderListing( newMasterItem, this.listingsForMaster[id] );
        });

        // Modal saves and validation

        $(document).on('change', '#ext-modal input[data-details], #ext-modal select[data-details]', e => {
            let input = $( e.currentTarget );
            let listingContainer = input.closest( '.listingSku' );
            let itemId = listingContainer.data( 'listingid' );
            let masterId = listingContainer.data( 'masterid' );
            let field = input.data( 'details' );
            let value = input.val();
            console.log( itemId, masterId, field, value );
            this.validateInputs();
        });


        $(document).on('click', '#savePoDetails', (e) => {
            e.preventDefault();
            if( this.tempData ){
                this.data = this.tempData;
                delete this.tempData;
            }
            this.savePoDetails();
        });
        // Close Manage PO Modal
        $(document).on('click', '.ext-modal-close', e => {
            e.preventDefault();
            delete this.tempData;
            $('#ext-modal').remove();
        });
    }
    validateInputs(){
        // let listingsTotal = datasetItem.listings.map( listing => listing.listingQty ).reduce((total, value) => parseInt( total ) + parseInt( value ) );
        // if( listingsTotal != parseInt( datasetItem.masterQty ) ){
        //     console.log( `>>> the master quantity of ${datasetItem.id} (${datasetItem.masterSku}) was changed. Now the listing quantities are wrong.` );
        // }
        console.log( 'validate inputs on changed fields and parent' );
    }
    openManageModal() {
        $('body').append('<div id="ext-modal"></div>' );
        $('#ext-modal').html( extModalTemplate());
        this.listingsForMaster = {};
        let self = this;

        async function getListingsForMaster( item ){
            let result = await ajax(item.masterSku);
            self.listingsForMaster[item.id] = result;
            self.listingsForMaster[item.id].push( {listingSku: 'a test', salesChannelId: 'with stuff'} );
            self.listingsForMaster[item.id].push( {listingSku: 'another test', salesChannelId: 'with more stuff'} );
        }
        async function processMasters( array ){
            const promises = array.map( getListingsForMaster );
            await Promise.all( promises );
            self.renderTable();
        }
        this.tempData = new PoObject( JSON.parse( JSON.stringify( this.data ) ) );
        processMasters( this.tempData.items );
    }
    renderTable(){
        let el = $('.modal__content');
        if( el.length ){
            // Render table
            el.html( extModalTable( this.tempData ) );
            let templates = this.tempData.items.map( item => extMasterSku( item ) );
            el.find('.master-sku-container').html( templates.join('') );

            this.tempData.items.forEach( item => this.renderListing( item ) );

            el.find( 'select' ).select2({
                dropdownParent: el
            });
        }
    }
    renderListing( master ){
        let optionValue = listing => `${listing.listingSku} - ${listing.salesChannelId}`;
        let optionsString = item => this.listingsForMaster[item.parent].map( listing => extListingsDropdown( optionValue( listing ) ) ).join( '' );
        let rows = master.listings.map( item => extListingSku( item, optionsString( item ), master.listings.length )).join('');
        let masterRow = $(`.master__container[data-masterid=${master.id}]`);
        let listingContainer = masterRow.find( '.listings-container' );
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
    checkNotes( poId ){
        let notesVal = $('#internalNotes').val();
        let data = {};
        if( notesVal ){
            let validJson = tryParseJSON( notesVal );
            if( validJson ){
                data = validateJson( validJson );
            } else {
                console.log( 'notes were not json' );
                data = { id: poId, additionalNotes: notesVal };
            }
        } else {
            console.log( 'no notes. create them' );
            data = { id: poId };
        }

        return new PoObject( data );
    }
    poLoaded(){
        waitFor( '#poItemsGrid' ).then( (container) => {
            console.log( 'poItemsGrid has been (re)rendered' );
            $('#addPoItemHolder').before( '<div id="ext-managePoItem" />' );
            $('#ext-managePoItem').html(extButton());

            let poId = $('#poDetailsPane').find('ul > span').text().split('#')[1];

            this.setUpNotes();
            this.data = this.checkNotes( poId );

            let tableValues = this.getTableValues( container );
            this.checkPoForUpdate( tableValues );

            console.log( this.data );
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
                masterQty: getCell( 'itemQuantity' ).replace( ',', '' )
            };
        });
        return masterSkusFromTable;
    }
    checkPoForUpdate( tableValues ){
        let dataset = this.data.items;
        let added = tableValues.filter( table => dataset.map( item => item.id ).indexOf( table.id ) === -1 );
        let removed = dataset.filter( data => tableValues.map( item => item.id ).indexOf( data.id ) === -1 );
        let somethingChanged = false;

        if( added.length ){
            somethingChanged = true;
            console.log( '> an item has been added -> add to dataset' );
            added.forEach( item => dataset.push( new ItemObject( item ) ) );
        }
        if( removed.length ){
            somethingChanged = true;
            console.log( '> an item has been deleted -> remove from dataset');
            removed.forEach( item => {
                let index = dataset.indexOf( item );
                if( index > -1 ){
                    dataset.splice( index, 1 );
                }
            });
        }

        // Check quantities
        let quantitiesCorrect = true;
        tableValues.forEach( value => {
            let datasetItem = dataset.find( item => item.id === value.id );
            if( value.masterQty != datasetItem.masterQty ){
                quantitiesCorrect = false;
                somethingChanged = true;
                console.log(  `> quantities dont match for ${value.id} -> update qty in dataset` );
                datasetItem.masterQty = value.masterQty;
                console.log( '>> quantity has been updated -> check for listings.' );
                if( datasetItem.listings.length > 1 ){
                    console.log( `>>> the master quantity of ${datasetItem.id} (${datasetItem.masterSku}) was changed. Now the listing quantities are wrong.` );
                    this.openManageModal();
                } else {
                    datasetItem.listings[0].listingQty = datasetItem.masterQty;
                }
            }
        });
        if( quantitiesCorrect ){
            console.log( '>>> all qtys are correct');
        }

        if( somethingChanged ){
            this.savePoDetails();
        }
    }

    savePoDetails(){
        var confirmUpdate = confirm( 'You are about to change the notes. Are you sure?');
        if( confirmUpdate ){
            $('#internalNotes').val( JSON.stringify( this.data ) ) ;
        }
        let really = confirm( 'This should actually save the details. Are really sure? This can\'t be undone.' );
        if( really ){
            $('button#updatePoDetails').trigger( 'click' );
        }
    }
}

let injectScript = new InjectScript();
//# sourceMappingURL=inject.js.map
