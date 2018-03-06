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
        let fake = Object.assign( {}, listingOpts );
        fake.qty = "600";
        this.listings = [];
        this.listings.push( new ListingObject( listingOpts ), new ListingObject( fake ) );
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
            callback: () => this.updateDetails(),
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
            result.unshift( {listingSku: item.id}, {listingSku: `${item.id}-second`} );
            result.push( {listingSku: `${item.id}-third`} );
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
    // renderMaster( master, optionsString ){
    //     let el = $('.master-sku-container');
    //     el.append( extMasterSku( master, optionsString ) ).find('.masterItemRow select').select2({
    //         dropdownParent: $('.masterItemRow')
    //     });
    //     this.renderListing( master, optionsString );
    // }
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

        // if( master.listings.length > 1 ){
        //     listingContainer.show();
        //     masterRow.find( '.hide-on-create' ).css( 'opacity', 0);
        // } else {
        //     masterRow.find( '.hide-on-create' ).css( 'opacity', 1);
        // }
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

    // So far, this should only be for editing an exiting PO. Will need to edit this, rebuild for new POs
    updateDetails( summary ){
        waitFor( '#poItemsGrid' ).then( (container) => {
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
}

let injectScript = new InjectScript();
//# sourceMappingURL=inject.js.map
