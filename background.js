console.log( "*** Background page ***" );

chrome.webRequest.onCompleted.addListener(
    function( details ){
        if( details && details.statusCode === 200 ){
            console.log( 'successful request to submitnewpo' );
            console.log( 'details' );
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage( tabs[0].id, { newPoSuccess: true } );
            });
        }

    },
    {urls: ["*://app.skubana.com/work/po/submitnewpo"]},
    []
);
