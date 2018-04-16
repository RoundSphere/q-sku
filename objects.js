class PoObject {
    constructor( options ) {
        let items   = options.items;
        this.id     = options.id || '';
        this.qSkuId = options.qSkuId || '';
        this.items  = items ? items.map( item => new ItemObject( item ) ) : [];
        this.additionalNotes = options.additionalNotes || '';
    }
    hydrateFromAirtable( options ){
        let groupedItems = [];
        let items = new Set( options.records.map( record => record.fields["QSkuMasterSku"] ) );
        items.forEach( item => {
            let listings = options.records.filter( listing => listing.fields["QSkuMasterSku"] === item );
            let masterValues = listings.map( listing => listing.fields["Outgoing Stock or listingQty"] );
            let masterTotal = masterValues.reduce( ( total, listingValue ) => parseInt( total ) + parseInt( listingValue ), 0);
            groupedItems.push(
                {
                    id        : item.trim().replace( /\s/g, '-' ).toLowerCase(),
                    masterSku : item,
                    masterQty : masterTotal,
                    listings  : listings.map( listing => new ListingObject( parseListing( listing ) ) )
                }
            );
        });
        this.items = groupedItems.map( item => new ItemObject( item ) );
        return this;
    }
    postToAirtable(){
        let listings = [].concat.apply( [], this.items.map( item => item.listings ) );
        let qSkuId = this.qSkuId;
        if( ! qSkuId ){
            qSkuId = Math.round( ( new Date() ).getTime() / 1000 );
        }
        async function postToAT( listing ){
            let data = {
                "fields" : {
                    "Listing SKU"   : listing.listingSku,
                    "Outgoing Stock or listingQty" : listing.listingQty,
                    "sendToFBA"     : listing.sendToFBA,
                    "LTL warning"   : "needs to be set up",
                    "QSkuId"        : qSkuId.toString(),
                    "QSkuMasterSku" : listing.masterSku
                }
            };
            let settings = {
                url     : 'https://api.airtable.com/v0/appzVvw2EEvwkrlgA/allocations_test',
                method  : "POST",
                headers : {
                    Authorization : "Bearer key6WCg4VxCEwTlw4",
                },
                contentType: "application/json",
                dataType: "json",
                data : JSON.stringify( data )
            };
            let result = await ajax( settings );
            // console.log( result );
            return await result;
        }

        listings.forEach( async listing => {
            await wait( 200 );
            postToAT( listing );
        });
    }
}

class ItemObject {
    constructor( options ){
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
        this.id         = options.id || options.parent + '_' + Date.now();
        this.masterSku  = options.masterSku;
        this.listingSku = options.listingSku || options.masterSku;
        this.listingQty = options.listingQty;
        this.sendToFBA  = options.sendToFBA;
        this.ltl        = options.ltl;
        this.parent     = options.parent;
    }
}
