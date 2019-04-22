function ajax(settings) {
    return new Promise(function(resolve, reject) {
        settings.success = response => resolve( response );
        settings.error = ( response, error, msg ) => {
            console.log( response, error, msg );
            reject( response );
        }
        $.ajax(settings);
    });
}

function backgroundAjax(settings) {
    settings.action = 'ajax';
    return new Promise(function(resolve, reject) {
        chrome.runtime.sendMessage(settings, (response) => {
            if (response.success) {
                console.log('ajax() accepted', response.payload);
                resolve(response.payload);
            } else {
                console.log('ajax() rejected', response.payload);
                reject(response.payload);
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
    console.log( 'wait started' );
    return new Promise((resolve) => {
        setTimeout(function(){
            console.log( 'waits over' );
            return resolve();
        }, time);
    });
}
