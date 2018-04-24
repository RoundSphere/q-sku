class InjectScript {
    constructor() {
        // console.clear();
        console.log( '***** Content Script ******' );
        console.log("InjectScript loaded");
        this.registerEventHandlers();
        this.observer = new MutationSummary({
            callback: (summary) => this.handleSummary(summary),
            queries: [{ element: '#poItemsGrid' }, { element: '#newPoForm' }]
        });
    }
    handleSummary( summary ){
        if( summary[0].added.length ){
            this.poLoaded();
            return;
        }
        if( summary[1].added.length ){
            this.poCreated();
            return;
        }
    }
    registerEventHandlers() {
        // Open Manage Modal
        $(document).on('click', '#managePoItems', async e => {
            e.preventDefault();
            if( this.type === 'existingPO' ){
                $('body').append('<div id="ext-modal"></div>' );
                await $('#ext-modal').html( extModalTemplate() );
            } else if( this.type === 'newPO' ){
                await $(e.currentTarget).closest( '.ui-dialog' ).append( '<div class="modal__content" />' );
            } else {
                console.log( 'Something went wrong. The type of PO was not set' );
                return;
            }

            this.openManageModal();
        });

        // Creates or deletes listing in modal
        $(document).on('click', '.addDeleteListing', e => {
            e.preventDefault();
            let el = $( e.currentTarget );
            let id = el.data( 'itemid' ).toString();
            let masterItem = this.tempData.items.find( item => item.id === id );
            let listingId = el.hasClass( 'deleteRow' ) ? el.data( 'listingid' ).toString() : '';
            let newMasterItem = masterItem[ el.hasClass( 'deleteRow' ) ? 'removeListing' : 'addListing' ]( listingId );

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

        // Save Listings
        $(document).on('click', '#savePoDetails', e => {
            e.preventDefault();
            let el = $( e.currentTarget );
            if( el.hasClass( 'ext-disabled' ) ){
                return;
            }
            this.data = this.tempData;
            this.savePoDetails();
        });

        // Listener for successful submitnewpo/cancel request
        chrome.runtime.onMessage.addListener( async request => {
            if( request.newPoSuccess ){
                this.data.id = await this.data.getId( this.authToken, this.qSkuId );
                this.data.create( this.authToken );
            }
            if( request.cancelPoSuccess ){
                this.posToCancel.forEach( async item => {
                    await deletePO( item, this.authToken );
                });
            }
        });

        // Cancel PO
        $( document ).on( 'click', '#centerCenterPanel #cancel', e => {
            let el = $( e.currentTarget );
            let container = el.closest( '#centerCenterPanel' );
            let inputs = container.find( 'td[aria-describedby="ordersGrid_cb"] input[type="checkbox"]:checked' );
            this.posToCancel = Array.from( inputs ).map( item  => {
                return $( item ).closest( 'tr' ).find( 'td[aria-describedby="ordersGrid_number"]' ).text();
            });
        });

        // Close Manage PO Modal
        $(document).on('click', '.ext-modal-close', e => {
            e.preventDefault();
            this.closeManageModal();
            // delete this.tempData;
        });
    }
    closeManageModal(){
        if( $('#ext-modal').length ){
            $('#ext-modal').remove();
        } else {
            $('.modal__content').remove();
        }
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
        var getDataForModal = async () => {
            let data = this.data;
            if( this.type === 'newPO' ){
                data.items = await this.getNewTableValues( '#newPoItemsGrid' );
            } else if( this.type !== 'existingPO' ) {
                console.log( 'Something went wrong. The type of PO was not set' );
                return;
            }
            data = new PoObject( data );
            this.listingsForMaster = await this.setupListingsForMaster( data, this.authToken );
            this.tempData = data;
            this.renderTable({ data: data });
        }
        getDataForModal();
    }
    setupListingsForMaster( data, authToken ){
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
                let filteredListings = result.filter( listing => {
                    return listing.masterSku === master.masterSku && ! listing.pushInventory;
                });
                let custom = master.listings.map( listing => {
                    return {
                        masterSku: listing.masterSku,
                        listingSku: listing.listingSku
                    }
                });

                let uniqueCustom = custom.filter( cItem => {
                    return filteredListings.map( fItem => fItem.listingSku ).indexOf( cItem.listingSku ) === -1;
                });
                let combo = filteredListings.concat( bundledSkus, uniqueCustom );
                listingsForMaster[master.id] = combo;
            });
            return await listingsForMaster;
        }

        return getListingsForMaster( data.items, authToken );
    }
    renderTable( options ){
        let data = options.data;
        let el = $('.modal__content');
        if( el.length ){
            // Render table
            el.html( extModalTable( data ) );
            let templates = data.items.map( item => extMasterSku( item ) );
            el.find('.master-sku-container').html( templates.join('') );

            data.items.forEach( item => this.renderListing( item ) );

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
            this.validateInputs( master );
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
        let value = notes.val();
        notes.attr( 'readonly', true ).hide();
        notes.removeAttr( 'maxlength' );
        notes.before( extInternalNoteMsg() );

        let data = {};
        if( value ){
            let validJson = tryParseJSON( value );
            if( validJson ){
                data = validJson;
            } else {
                data = {
                    additionalNotes: value
                };
            }
        }
        if( this.type === 'newPO' ){
            notes.val( this.checkNotes( value ) );
        }
        if( this.type === 'existingPO' ){
            notes.val( '' );
        }

        return data;

    }
    checkNotes( value ){
        let notesVal = value;
        let qSkuId = Math.round( ( new Date() ).getTime() / 1000 );
        let qSkuIdString = '*** q-SKU PO ID: ';
        let qSkuIdPos = notesVal.indexOf( qSkuIdString );
        let qSkuIdStart = qSkuIdPos + qSkuIdString.length
        if( qSkuIdPos > -1 ){
            qSkuId = notesVal.slice( qSkuIdStart, notesVal.indexOf( '***', qSkuIdStart ) ).trim();
        }
        let qSkuIdLookup = `${ qSkuIdString + qSkuId } ***`;

        this.qSkuId = qSkuId;
        this.airTableLookup = qSkuIdLookup;

        return qSkuIdLookup;
    }
    poLoaded(){
        waitFor( '#poItemsGrid' ).then( async container => {
            $('#addPoItemHolder').before( '<div id="ext-managePoItem" />' );
            $('#ext-managePoItem').html( extButton( 'existingPO' ) );
            this.type = 'existingPO';

            let data = this.setUpNotes( '#poDetailsPane' );

            data.id = $('#poDetailsPane').find('ul > span').text().split('#')[1];
            let tableValues = await this.getTableValues( container );
            let requestValues = await getPO( data.id, this.authToken );
            let comparedData = {
                items: tableValues,
                id: data.id,
                additionalNotes: data.additionalNotes || ''
            };

            let updateDetails = {};
            // If the notes field had JSON, use that to compare
            if( data.hasOwnProperty( 'items' ) ){
                updateDetails = this.checkPoForUpdate( tableValues, data.items );
                comparedData.items = updateDetails.dataset;
            }
            // If there was a successful request with data to Airtable, use that to compare
            if( requestValues.hasOwnProperty( 'id' ) ){
                updateDetails = this.checkPoForUpdate( tableValues, requestValues.items );
                comparedData.items = updateDetails.dataset;
            }

            if( updateDetails.somethingChanged ){
                this.data = new PoObject( comparedData );
                if( updateDetails.listingNeedsUpdating ){
                    this.openManageModal();
                } else {
                    this.data.update( this.authToken );
                }
                return;
            }

            this.data = comparedData;
        });
    }

    poCreated(){
        waitFor( '#newPoItemsGrid' ).then( container => {
            $('.ui-dialog-buttonset').find( 'button' ).first().hide().after( extButton( 'newPO' ) );
            this.type = 'newPO';
            this.setUpNotes( '#newPoForm' );
            this.data = {};
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
            qtyCellVal = qtyCellVal.replace( ',', '' );
            qtyCellVal = parseInt( qtyCellVal );
            return {
                id: getCell( 'productSkuAndName' ).text().split( ' - ' )[0].trim().replace( /\s/g, '-' ).toLowerCase(),
                masterSku: getCell( 'productSkuAndName' ).text().split( ' - ' )[0],
                masterQty: qtyCellVal
            };
        });
        return masterSkusFromTable;
    }
    checkPoForUpdate( tableValues, dataset ){
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

        let updateDetails = {
            somethingChanged: somethingChanged,
            listingNeedsUpdating: listingNeedsUpdating,
            dataset: dataset
        }
        return updateDetails;
    }

    savePoDetails(){
        if( this.type === 'newPO' ){
            let save = $('.ui-dialog-buttonset').find( 'button' ).first();
            save.trigger('click');
        } else if( this.type === 'existingPO' ){
            var updateDetails = async () => {
                await this.data.update( this.authToken );
                this.closeManageModal();
                delete this.data;
                delete this.tempData;
            }
            updateDetails();
        } else {
            console.log( 'Something went wrong. The type of PO was not set' );
            return;
        }
    }
}
