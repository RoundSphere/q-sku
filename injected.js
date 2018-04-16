function parseListing( data ){
    let fData = data;
    if( data.fields ){
        let response = data.fields;
        fData = {
            listingSku    : response["Listing SKU"],
            listingQty    : response["Outgoing Stock or listingQty"],
            sendToFBA     : response["sendToFBA"],
            ltl           : response["LTL warning"],
            qSkuId        : response["QSkuId"],
            qSkuMasterSku : response["QSkuMasterSku"],
            parent        : response["QSkuMasterSku"].trim().replace( /\s/g, '-' ).toLowerCase()
        }
    }
    return fData;
}

async function getListingsFromAirtable( id ){
    let settings = {
        url     : 'https://api.airtable.com/v0/appzVvw2EEvwkrlgA/allocations_test',
        method  : "GET",
        headers : {
            Authorization : "Bearer key6WCg4VxCEwTlw4"
        },
        data: {
            filterByFormula: `{QSkuId} = ${ id }`
        }
    };
    let result = await ajax( settings );
    return await result;
}

class InjectScript {
    constructor() {
        console.clear();
        console.log( '***** Content Script ******' );
        console.log("InjectScript loaded");
        this.registerEventHandlers();
        this.observer = new MutationSummary({
            callback: (summary) => this.handleSummary(summary),
            queries: [{ element: '#poItemsGrid' }, { element: '#newPoForm' }]
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
        // Open Manage Modal for existing PO
        $(document).on('click', '#managePoItems', async e => {
            e.preventDefault();
            await this.openManageModal();
            // this.listingsForMaster = await this.setupListingsForMaster();
            // let testData = await getListingsFromAirtable( this.data.qSkuId );
            // this.data = await this.data.hydrateFromAirtable( testData );
            // this.tempData = this.data;

            // this.renderTable({ isNewPo: false });
        });

        // Open Manage Modal for new PO
        $(document).on('click', '#newManagePoItems', async e => {
            e.preventDefault();
            $(e.currentTarget).closest( '.ui-dialog' ).append( '<div class="modal__content" />' );
            let tableValues = await this.getNewTableValues( '#newPoItemsGrid' );
            this.data = await this.checkNotes( '.ui-dialog' );
            this.data.items = $.extend( tableValues, this.data.items );
            this.listingsForMaster = await this.setupListingsForMaster();
            // this.tempData = new PoObject( JSON.parse( JSON.stringify( this.data ) ) );

            this.renderTable({ isNewPo: true });
        });

        // Creates new listing in modal
        $(document).on('click', '.createNew', (e) => {
            e.preventDefault();
            let el = $( e.currentTarget );
            let id = el.data( 'itemid' ).toString();
            let masterItem = this.tempData.items.find( item => item.id === id );
            let newMasterItem = masterItem.addListing();

            this.renderListing( newMasterItem, this.listingsForMaster[id] );
        });

        // Deletes listing in modal
        $(document).on('click', '.deleteRow', (e) => {
            e.preventDefault();
            let el = $( e.currentTarget );
            let id = el.data( 'itemid' ).toString();
            let masterItem = this.tempData.items.find( item => item.id === id );
            let listingId = el.data( 'listingid' ).toString();
            let newMasterItem = masterItem.removeListing( listingId );

            this.renderListing( newMasterItem, this.listingsForMaster[id] );
        });

        // Validates inputs on change in modal
        $(document).on('change', '.modal__content input[data-details], .modal__content select[data-details]', e => {
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

        // Adds notes to PO
        $(document).on('change', 'textarea[data-details]', e => {
            this.tempData.additionalNotes = $( e.currentTarget ).val();
        });

        // Save Listings on previously created po
        $(document).on('click', '#savePoDetails', (e) => {
            e.preventDefault();
            if( $( e.currentTarget ).hasClass( 'ext-disabled' ) ){
                return;
            }
            this.data = this.tempData;
            this.savePoDetails({ isModal: true, scope: '#poDetailsPane' });
        });

        // Save Listings for new PO
        $(document).on('click', '#savePoDetails-new', (e) => {
            e.preventDefault();
            if( $( e.currentTarget ).hasClass( 'ext-disabled' ) ){
                return;
            }
            this.data = this.tempData;
            this.savePoDetails({ isModal: true, isNewPo: true, scope: '#newPoForm' });
        });

        // Listener for successful submitnewpo request
        chrome.runtime.onMessage.addListener( async request => {
            if( request.newPoSuccess ){
                let settings = {
                    url: "https://app.skubana.com/service/v1/purchaseorders",
                    data: {
                        limit: 5,
                        status: 'AWAITING_AUTHORIZATION',
                        productSku: this.data.items[0].masterSku
                    },
                    headers: {
                        Authorization : "Bearer " + this.authToken
                    }
                };
                let openPOs = await ajax( settings );
                let findPo = openPOs.find( po => po.internalNotes.indexOf( this.data.qSkuId ) > -1 );
                this.data.id = findPo.number;
                this.data.postToAirtable();
            }
        });

        // Close Manage PO Modal
        $(document).on('click', '.ext-modal-close', e => {
            e.preventDefault();
            // delete this.tempData;
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
            let noZeros = true;
            let masterContainer = $(`.master__container[data-masterid="${item.id}"]`);
            let inputs = $(`.listingSku[data-masterid="${item.id}"] input[data-details=listingQty]`);

            let listingsQtys = item.listings.map( listing => listing.listingQty );
            let listingsTotal = listingsQtys.reduce( ( total, value ) => parseInt( total ) + parseInt( value ) );
            if( parseInt( item.masterQty ) != listingsTotal ){
                valid = false;
                masterValid = false;
            }
            if( listingsQtys.indexOf( "0" ) > -1 ){
                valid = false;
                masterValid = false;
                noZeros = false;
            }
            masterContainer[ masterValid ? 'removeClass' : 'addClass' ]( 'ext-error' );
            masterContainer[ noZeros ? 'removeClass' : 'addClass' ]( 'ext-error--zeros' );
            inputs[ masterValid ? 'removeClass' : 'addClass' ]( 'ext-error--input' );
        });
        $('#savePoDetails')[ valid ? 'removeClass' : 'addClass' ]( 'ext-disabled' );
    }
    openManageModal() {
        $('body').append('<div id="ext-modal"></div>' );
        $('#ext-modal').html( extModalTemplate() );
        // let self = this;
        async function getDataForModal( self ){
            self.listingsForMaster = await self.setupListingsForMaster();
            self.tempData = new PoObject( self.data );
            self.renderTable({ isNewPo: false });
        }
        getDataForModal( this );
    }
    setupListingsForMaster(){
        async function getListingsForMaster( masters, authToken  ){
            let data, result, listingsForMaster;
            data = {
                url: "https://app.skubana.com/service/v1/listings",
                data: {
                    masterSku: masters.map( item => item.masterSku ).join( ',' ),
                    limit: 500,
                    salesChannelId: 5394
                },
                headers: {
                    Authorization : "Bearer " + authToken
                }
            };
            result = await ajax( data );
            listingsForMaster = {};
            masters.forEach( master => {
                // Get bundled skus from allBundledSkus const in bundled-skus.js
                let bundledSkus = allBundledSkus.filter( bundleSku => master.masterSku == bundleSku.masterSku );
                let filteredListings = result.filter( listing => listing.masterSku === master.masterSku );
                let custom = master.listings.map( listing => {
                    return {
                        masterSku: listing.masterSku,
                        listingSku: listing.listingSku
                    }
                });
                let combo = filteredListings.concat( bundledSkus, custom );
                listingsForMaster[master.id] = combo;
            });
            return await listingsForMaster;
        }

        this.tempData = new PoObject( JSON.parse( JSON.stringify( this.data ) ) );
        return getListingsForMaster( this.tempData.items, this.authToken );
    }
    renderTable( options ){
        this.tempData = new PoObject( JSON.parse( JSON.stringify( this.data ) ) );

        let el = $('.modal__content');
        if( el.length ){
            // Render table
            el.html( extModalTable( this.tempData, options.isNewPo ) );
            let templates = this.tempData.items.map( item => extMasterSku( item ) );
            el.find('.master-sku-container').html( templates.join('') );

            this.tempData.items.forEach( item => this.renderListing( item ) );

            el.find( 'select' ).select2({
                dropdownParent: el,
                tags: true
            });
        }
    }
    renderListing( master ){
        let optionsString = item => this.listingsForMaster[item.parent].map( listing => {
            return extListingsDropdown( listing.listingSku, item.listingSku );
        });
        let rows = master.listings.map( item => {
            this.validateInputs();
            let optionsArray = [];
            if( this.listingsForMaster[item.parent] ){
                optionsArray = optionsString( item );
            } else {
                optionsArray = [ extListingsDropdown( 'No Master SKU', 'No Master SKU') ];
            }
            return extListingSku( item, optionsArray.join( '' ), master.listings.length );
        });
        let masterRow = $(`.master__container[data-masterid="${master.id}"]`);
        let listingContainer = masterRow.find( '.listings-container' );
        listingContainer.html( rows.join('') );
        listingContainer.find('select').select2({
            dropdownParent: listingContainer,
            tags: true
        });
    }
    setUpNotes( scope ){
        // Diable #internalNotes
        let notes = $(`${scope} #internalNotes`);
        // notes.attr( 'readonly', true ).hide();
        notes.attr( 'readonly', true );
        notes.removeAttr( 'maxlength' );
        notes.before( extInternalNoteMsg() );
    }
    checkNotes( scope ){
        let notesVal = $(`${scope} #internalNotes`).val();
        let qSkuId = Math.round( ( new Date() ).getTime() / 1000 );
        let qSkuIdString = '*** q-SKU PO ID: ';
        let qSkuIdPos = notesVal.indexOf( qSkuIdString );
        let qSkuIdStart = qSkuIdPos + qSkuIdString.length
        if( qSkuIdPos > -1 ){
            qSkuId = notesVal.slice( qSkuIdStart, notesVal.indexOf( '***', qSkuIdStart ) ).trim();
        }
        let qSkuIdLookup = `${ qSkuIdString + qSkuId } ***`;
        $(`${scope} #internalNotes` ).val( qSkuIdLookup );

        let data = {};
        if( notesVal ){
            let validJson = tryParseJSON( notesVal );
            if( validJson ){
                data = validateJson( validJson );
                data.qSkuId = qSkuId;
                data.airTableLookup = qSkuIdLookup;
            } else {
                data = { additionalNotes: notesVal, qSkuId: qSkuId, airTableLookup: qSkuIdLookup };
            }
        } else {
            data = { qSkuId: qSkuId, airTableLookup: qSkuIdLookup };
        }
        let poObject = new PoObject( data );
        return poObject;
    }
    poLoaded(){
        waitFor( '#poItemsGrid' ).then( async (container) => {
            $('#addPoItemHolder').before( '<div id="ext-managePoItem" />' );
            $('#ext-managePoItem').html(extButton('managePoItems'));

            this.setUpNotes('#poDetailsPane');
            this.data = this.checkNotes( '#poDetailsPane' );
            this.data.id = $('#poDetailsPane').find('ul > span').text().split('#')[1];
            let tableValues = this.getTableValues( container );
            getListingsFromAirtable( this.data.qSkuId ).then( data => {
                this.data.hydrateFromAirtable( data );
                this.checkPoForUpdate( tableValues )
            })
        });
    }

    poCreated(){
        waitFor( '#newPoItemsGrid' ).then( container => {
            $('.ui-dialog-buttonset').find( 'button' ).first().after( extButton( 'newManagePoItems') );
            $('.ui-dialog-buttonset').find( 'button' ).first().hide();
            this.setUpNotes( '#newPoForm' );
        });
    }

    getTableValues( container ){
        let rows = Array.from( $( container ).find( 'tr' ) ).filter( (row, idx) => idx > 0 );
        let masterSkusFromTable = rows.map( item => {
            function getCell( value ){
                return $( item ).find( `td[aria-describedby=poItemsGrid_${value}]` ).text();
            }
            return {
                id: getCell( 'productSkuAndName' ).split( ' :: ' )[0].trim().replace( /\s/g, '-' ).toLowerCase(),
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
                id: getCell( 'productSkuAndName' ).text().split( ' - ' )[0].trim().replace( /\s/g, '-' ).toLowerCase(),
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
            // console.log( 'the data doesn\'t match the request.' );
            // console.log( 'an item from the notes field has been added' );
            added.forEach( item => dataset.push( new ItemObject( item ) ) );
        }
        if( removed.length ){
            somethingChanged = true;
            removed.forEach( item => {
                let index = dataset.indexOf( item );
                if( index > -1 ){
                    // console.log( 'the data doesn\'t match the request.' );
                    // console.log( 'an item from the notes field has been removed' );
                    dataset.splice( index, 1 );
                }
            });
        }

        // console.log( dataset, tableValues );

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
        // $(`${options.scope} #internalNotes`).val( JSON.stringify( this.data ) ) ;
        // $('button#updatePoDetails').trigger( 'click' );
        if( options.isModal ){
            if( options.isNewPo ){
                let save = $('.ui-dialog-buttonset').find( 'button' ).first();
                console.log( JSON.stringify( this.data, null, 4 ), JSON.stringify( this.tempData, null, 4 )  );
                save.trigger('click');
            }
            let modal = $('#ext-modal');
            let innerModal = $('.modal__content' );
            if( innerModal.length ){
                if( modal.length ){
                    modal.remove();
                } else {
                    innerModal.remove();
                }
                // delete this.tempData;
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
