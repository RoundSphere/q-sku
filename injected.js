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

        let defaults = {
            masterSku  : options.masterSku,
            listingQty : options.masterQty,
            parent     : options.id,
            sendToFBA  : true
        };
        let listings  = options.listings;
        this.listings = listings ? listings.map( listing => new ListingObject( listing ) ) : [ new ListingObject( defaults ) ];
    }
    addListing(){
        let newListing = new ListingObject({ masterSku: this.masterSku, listingQty: "0", parent: this.id, sendToFBA: true });
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
        this.sendToFBA  = options.sendToFBA;
        this.ltl        = options.ltl;
        this.parent     = options.parent;
    }
}

class InjectScript {
    constructor() {
        console.clear();
        console.log( '***** Content Script ******' );
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
            let listingId = listingContainer.data( 'listingid' ).toString();
            let masterId = listingContainer.data( 'masterid' ).toString();
            let field = input.data( 'details' );
            let value = input.val();
            if( input.attr('type') === 'checkbox' ){
                value = input[0].checked;
            }
            let masterItem = this.tempData.items.find( item => item.id === masterId );
            if( masterItem ){
                let listingItem = masterItem.listings.find( listing => listing.id === listingId );
                if( listingItem ){
                    listingItem[field] = value;
                }
                this.validateInputs(masterItem, listingItem);
            }

        });

        $(document).on('click', '#savePoDetails', (e) => {
            // TODO only allows savings if all masters are validated
            e.preventDefault();
            if( $( e.currentTarget ).hasClass( 'ext-disabled' ) ){
                return;
            }
            this.data = this.tempData;
            this.savePoDetails();
        });
        // Close Manage PO Modal
        $(document).on('click', '.ext-modal-close', e => {
            e.preventDefault();
            delete this.tempData;
            $('#ext-modal').remove();
        });
    }
    validateInputs(masterItem, listingItem){
        let valid = true;
        let listings = masterItem.listings.map( listing => listing.listingQty );
        let listingsTotal = listings.reduce((total, value) => parseInt( total ) + parseInt( value ) );
        let masterContainer = $(`.master__container[data-masterid=${masterItem.id}]`);
        let input = $(`.listingSku[data-listingid=${listingItem.id}] input[data-details=listingQty]`);
        let saveBtn = $('#savePoDetails');

        if( listingsTotal != parseInt( masterItem.masterQty ) ){
            valid = false;
        }
        if( ! valid ){
            masterContainer.addClass( 'ext-error' );
            input.addClass( 'ext-error--input' );
            saveBtn.addClass( 'ext-disabled' );
        } else {
            masterContainer.removeClass( 'ext-error' );
            input.removeClass( 'ext-error--input' );
            saveBtn.removeClass( 'ext-disabled' );
        }
    }
    openManageModal() {
        $('body').append('<div id="ext-modal"></div>' );
        $('#ext-modal').html( extModalTemplate());
        this.listingsForMaster = {};
        let self = this;

        async function getListingsForMaster( item ){
            let result = await ajax(item.masterSku, self.authToken);
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
        let rows = master.listings.map( item => {
            this.validateInputs( master, item );
            return extListingSku( item, optionsString( item ), master.listings.length );
        });
        let masterRow = $(`.master__container[data-masterid=${master.id}]`);
        let listingContainer = masterRow.find( '.listings-container' );
        listingContainer.html( rows.join('') );
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
        let modal = $('#ext-modal');
        if( modal.length ){
            delete this.tempData;
            modal.remove();
        }
    }
}

let authTokenFromStorage = chrome.storage.sync.get('authToken', item => {
    checkToken( item.authToken );
    return item.authToken;
});

function checkToken( authToken, response ){
    let msg = '';
    if( authToken ){
        testAuth( authToken );
    } else {
        if( response ){
            msg = `That token didn't work. You entered: \n\n      ${response} \n\nTry again. `;
        }
        let auth = prompt( `${msg}Enter the token to access the Skubana API:` );
        if( auth ){
            testAuth( auth );
        } else {
            alert('In order to use this Chrome Extension, you will need the token to access the Skubana API. \n\nThe Manage button is not available.');
        }
    }
}

function testAuth( token ){
    $.ajax({
        url: `https://app.skubana.com/service/v1/listings`,
        headers: {
            'Authorization': `Bearer ${token}`
        },
        data: {
            'limit': 1
        },
        success: function( response ){
            chrome.storage.sync.set({ 'authToken': token });
            let injectScript = new InjectScript();
            injectScript.authToken = token;
        },
        error: function( response ){
            chrome.storage.sync.remove('authToken');
            checkToken( null, token );
        }
    });
}
