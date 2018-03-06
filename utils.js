function makeRequest (method, url, done, error) {
    var xhr = new XMLHttpRequest();

    xhr.open(method, url);
    xhr.setRequestHeader( 'Authorization', 'Bearer e576fdbf-81b2-4c9b-9e03-3f97d67a');
    xhr.onload = function () {
        done(xhr.response);
    };
    xhr.onerror = function () {
        error(xhr.response);
    };
    xhr.send();
}

function ajax(sku) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: `https://app.skubana.com/service/v1/listings`,
            headers: {
                'Authorization': 'Bearer e576fdbf-81b2-4c9b-9e03-3f97d67a'
            },
            data: { masterSku: sku },
            success: function( response ){
                resolve( response );
            },
            error: function( response ){
                reject( response );
            }
        });
    });
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

function validateJson( value ){
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

function waitFor(selector) {
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
function wait(time) {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}
