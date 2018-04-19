console.log( "*** Background page ***" );

chrome.webRequest.onCompleted.addListener(
    function( details ){
        if( details && details.statusCode === 200 ){
            console.log( 'successful request to submitnewpo or cancel' );
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if( details.url.indexOf( 'submitnewpo' ) > -1 ){
                    chrome.tabs.sendMessage( tabs[0].id, { newPoSuccess: true } );
                }
                if( details.url.indexOf( 'cancel' ) > -1 ){
                    chrome.tabs.sendMessage( tabs[0].id, { cancelPoSuccess: true } );
                }
            });
        }

    },
    {urls: ["*://app.skubana.com/work/po/submitnewpo", "*://app.skubana.com/work/po/cancel"]},
    []
);
