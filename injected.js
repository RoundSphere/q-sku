class PoObject {
    constructor( options ) {
        let items  = options.items;
        this.id    = options.id || '';
        this.items = items ? items.map( item => new ItemObject( item ) ) : [];
        this.additionalNotes = options.additionalNotes || '';
    }
}
class ItemObject {
    constructor( options ){
        // console.log("> Item Object Created");
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
            callback: (summary) => this.handleSummary(summary),
            queries: [{ element: '#poItemsGrid' }, { element: '#newPoItemsGrid' }]
        });
    }
    handleSummary( summary ){
        if( summary[1].added.length ){
            this.poCreated();
            return;
        }
        if( summary[0].added.length ){
            this.poLoaded();
            return;
        }
    }
    registerEventHandlers() {
        // Open Manage PO Modal
        $(document).on('click', '#managePoItems', (e) => {
            e.preventDefault();
            this.openManageModal();
        });

        // Open Manage New PO Modal
        $(document).on('click', '#newManagePoItems', (e) => {
            e.preventDefault();
            let tableValues = this.getNewTableValues( '#newPoItemsGrid' );
            this.data = this.checkNotes('', '.ui-dialog' );
            this.data.items = $.extend( tableValues, this.data.items );
            $(e.currentTarget).closest( '.ui-dialog' ).append( '<div class="modal__content" />' );
            this.setupListingsForMaster( true );
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
        $(document).on('change', '.modal__content input[data-details], #modal__content select[data-details]', e => {
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
                this.validateInputs();
            }
        });
        $(document).on('change', 'textarea[data-details]', e => {
            this.tempData.additionalNotes = $( e.currentTarget ).val();
        });

        $(document).on('click', '#savePoDetails', (e) => {
            e.preventDefault();
            if( $( e.currentTarget ).hasClass( 'ext-disabled' ) ){
                return;
            }
            this.data = this.tempData;
            this.savePoDetails({ isModal: true, scope: '#poDetailsPane' });
        });
        $(document).on('click', '#savePoDetails-new', (e) => {
            e.preventDefault();
            if( $( e.currentTarget ).hasClass( 'ext-disabled' ) ){
                return;
            }
            this.data = this.tempData;
            this.savePoDetails({ isModal: true, isNewPo: true, scope: '#newPoForm' });
        });
        // Close Manage PO Modal
        $(document).on('click', '.ext-modal-close', e => {
            e.preventDefault();
            delete this.tempData;
            if( $('#ext-modal').length ){
                $('#ext-modal').remove();
            } else {
                $('.modal__content').remove();
            }
        });
    }
    validateInputs(){
        let valid = true;
        let masterItems = this.tempData.items;
        masterItems.forEach( item => {
            let masterValid = true;
            let masterContainer = $(`.master__container[data-masterid=${item.id}]`);
            let inputs = $(`.listingSku[data-masterid=${item.id}] input[data-details=listingQty]`);

            let listingsQtys = item.listings.map( listing => listing.listingQty );
            let listingsTotal = listingsQtys.reduce( ( total, value ) => parseInt( total ) + parseInt( value ) );
            // TODO validate for no zeros
            if( parseInt( item.masterQty ) != listingsTotal ){
                valid = false;
                masterValid = false;
            }
            masterContainer[ masterValid ? 'removeClass' : 'addClass' ]( 'ext-error' );
            inputs[ masterValid ? 'removeClass' : 'addClass' ]( 'ext-error--input' );
        });
        $('#savePoDetails')[ valid ? 'removeClass' : 'addClass' ]( 'ext-disabled' );
    }
    openManageModal() {
        $('body').append('<div id="ext-modal"></div>' );
        $('#ext-modal').html( extModalTemplate());
        this.setupListingsForMaster();
    }
    setupListingsForMaster( isNewPo ){
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
            self.renderTable( isNewPo );
        }
        this.tempData = new PoObject( JSON.parse( JSON.stringify( this.data ) ) );
        processMasters( this.tempData.items );
    }
    renderTable( isNewPo ){
        let el = $('.modal__content');
        if( el.length ){
            // Render table
            el.html( extModalTable( this.tempData, isNewPo ) );
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
            this.validateInputs();
            return extListingSku( item, optionsString( item ), master.listings.length );
        });
        let masterRow = $(`.master__container[data-masterid=${master.id}]`);
        let listingContainer = masterRow.find( '.listings-container' );
        listingContainer.html( rows.join('') );
        listingContainer.find('select').select2({
            dropdownParent: listingContainer
        });
    }
    setUpNotes( scope ){
        // Diable #internalNotes
        let notes = $(`${scope} #internalNotes`);
        // $('#internalNotes').attr( 'readonly', true ).hide();
        notes.removeAttr( 'maxlength' );
        notes.before( extInternalNoteMsg() );
    }
    checkNotes( poId, scope ){
        let notesVal = $(`${scope} #internalNotes`).val();
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
            $('#addPoItemHolder').before( '<div id="ext-managePoItem" />' );
            $('#ext-managePoItem').html(extButton('managePoItems'));

            let poId = $('#poDetailsPane').find('ul > span').text().split('#')[1];

            this.setUpNotes('#poDetailsPane');
            this.data = this.checkNotes( poId, '#poDetailsPane' );

            let tableValues = this.getTableValues( container );
            this.checkPoForUpdate( tableValues );
        });
    }

    poCreated(){
        waitFor( '#newPoItemsGrid' ).then( container => {
            $('.ui-dialog-buttonset').find( 'button' ).first().after( extButton( 'newManagePoItems') );
            $('.ui-dialog-buttonset').find( 'button' ).first().hide();
        });
    }

    getTableValues( container ){
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
    getNewTableValues( container ){
        let rows = Array.from( $( container ).find( 'tr' ) ).filter( (row, idx) => idx > 0 );
        let masterSkusFromTable = rows.map( item => {
            function getCell( value ){
                return $( item ).find( `td[aria-describedby=newPoItemsGrid_${value}]` );
            }
            let qtyCell = getCell( 'itemQuantity' );
            let qtyCellVal = qtyCell.text();
            let qtyCellInput = qtyCell.find( 'input' );
            if( qtyCellInput.length > 0 ){
                qtyCellVal = qtyCellInput.val();
            }
            return {
                id: getCell( 'productId' ).text(),
                masterSku: getCell( 'productSkuAndName' ).text().split( ' - ' )[0],
                masterQty: qtyCellVal
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
            added.forEach( item => dataset.push( new ItemObject( item ) ) );
        }
        if( removed.length ){
            somethingChanged = true;
            removed.forEach( item => {
                let index = dataset.indexOf( item );
                if( index > -1 ){
                    dataset.splice( index, 1 );
                }
            });
        }

        // Check quantities
        let listingNeedsUpdating = false;
        tableValues.forEach( value => {
            let datasetItem = dataset.find( item => item.id === value.id );
            if( value.masterQty != datasetItem.masterQty ){
                somethingChanged = true;
                datasetItem.masterQty = value.masterQty;
                // Master Qty was changed. If there are multiple listings, need to launch modal to update listings. If not, update listing
                if( datasetItem.listings.length > 1 ){
                    listingNeedsUpdating = true;
                } else {
                    datasetItem.listings[0].listingQty = datasetItem.masterQty;
                }
            }
        });

        if( somethingChanged ){
            this.savePoDetails({ listingNeedsUpdating: listingNeedsUpdating, scope: '#poDetailsPane' });
        }
    }

    savePoDetails( options ){
        var confirmUpdate = confirm( 'You are about to change the notes. Are you sure?');
        if( confirmUpdate ){
            $(`${options.scope} #internalNotes`).val( JSON.stringify( this.data ) ) ;
        }
        let really = confirm( 'This should actually save the details. Are you really sure? This can\'t be undone.' );
        if( really ){
            $('button#updatePoDetails').trigger( 'click' );
        }
        if( options.isModal ){
            let modal = $('#ext-modal');
            let innerModal = $('.modal__content' );
            if( innerModal.length ){
                if( modal.length ){
                    modal.remove();
                } else {
                    innerModal.remove();
                }
                delete this.tempData;
            }
            if( options.isNewPo ){
                let save = $('.ui-dialog-buttonset').find( 'button' ).first();
                save.trigger('click');
            }
        }
        if( options.listingNeedsUpdating ){
            this.openManageModal();
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
