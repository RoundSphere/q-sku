
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

async function getPO( id ){
    let settings = {
        url     : 'https://da-dev.us/quantum/getpo/' + id,
        method  : "GET"
    };
    let result = await ajax( settings );
    return await JSON.parse( result );
}

async function createPO( data ){
    let settings = {
        url         : 'https://da-dev.us/quantum/newpo',
        method      : "POST",
        data        : JSON.stringify( data ),
        contentType : "application/json",
        dataType    : "json"
    };
    let result = await ajax( settings );
    return await JSON.parse( result );
}

async function updatePO( data ){
    let settings = {
        url     : 'http://da-dev.us/quantum/changepo',
        method  : "PUT",
        data        : JSON.stringify( data ),
        contentType : "application/json",
        dataType    : "json"
    };
    let result = await ajax( settings );
    return await JSON.parse( result );
}

async function deletePO( id ){
    let settings = {
        url     : 'https://da-dev.us/quantum/rmpo/' + id,
        method  : "DELETE"
    };
    let result = await ajax( settings );
    return await JSON.parse( result );
}
