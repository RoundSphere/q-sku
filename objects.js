class PoObject {
    constructor( options ) {
        let items   = options.items;
        this.id     = options.id || '';
        this.items  = items ? items.map( item => new ItemObject( item ) ) : [];
        this.additionalNotes = options.additionalNotes || '';
    }
    create( token ){
        console.log( this.id, 'create' );
        let settings = {
            url         : 'https://da-dev.us/quantum/newpo',
            method      : "POST",
            headers: {
                'Authorization': `Bearer ${token}`
            },
            data        : JSON.stringify( this ),
            contentType : "application/json"
        };
        return ajax( settings );
    }
    update( token ){
        console.log( this, 'update' );
        $( '#updatePoDetails' ).trigger( 'click' );
        let settings = {
            url     : 'https://da-dev.us/quantum/changepo',
            method  : "PUT",
            data        : JSON.stringify( this ),
            contentType : "application/json",
            headers: {
                'Authorization': `Bearer ${token}`
            },
        };
        ajax( settings );
    }
    getId( token, qSkuId ){
        let settings = {
            url: "https://app.skubana.com/service/v1/purchaseorders",
            data: {
                limit: 5,
                status: 'AWAITING_AUTHORIZATION',
                productSku: this.items[0].masterSku
            },
            headers: {
                Authorization : "Bearer " + token
            }
        };
        let getPoId = async ( settings ) => {
            let openPOs = await ajax( settings );
            let findPo = openPOs.find( po => po.internalNotes.indexOf( qSkuId ) > -1 );
            return findPo.number;
        }
        return getPoId( settings );
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

async function getPO( id, token ){
    let settings = {
        url     : 'https://da-dev.us/quantum/getpo/' + id,
        method  : "GET",
        headers: {
            'Authorization': `Bearer ${token}`
        },
        dataType: 'json'
    };
    let result = await ajax( settings );
    return await result;
}

async function deletePO( id, token ){
    let settings = {
        url     : 'https://da-dev.us/quantum/rmpo/' + id,
        method  : "DELETE",
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
    let result = await ajax( settings );
    return await result;
}
