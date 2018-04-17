
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



/// This probably wont be used anymore if the endpoints work correctly

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
