console.clear();
console.log( '***** Content Script ******' );

function makeRequest (method, url, done) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onload = function () {
        done(null, xhr.response);
    };
    xhr.onerror = function () {
        done(xhr.response);
    };
    xhr.send();
}

class InjectScript {
    constructor() {
        console.log("InjectScript loaded");
        this.registerEventHandlers();
    }
    registerEventHandlers() {
        $(document).on("click", '#ordersGrid', (e) => {
            console.log( 'a thing was clicked' );
            // Do things when a thing is clicked
            this.waitFor( '#poItemsGrid' ).then((container) => {
                // Observers are not working correctly because the entire pane is re-rendered on changes, maybe?
                // Figure out how updates work
                this.observeChanges( container, this.updateDetails );
            });
        });
    }
    observeChanges(element, callback) {
        let observer = new MutationObserver((mutations, element) => {
            mutations.forEach((mutation) => {
                callback( mutation, this );
            });
        });
        let observerConfig = {
            childList: true,
            subtree: true
        };
        observer.observe(element, observerConfig);
    }
    updateDetails(mutation, self){
        console.log( mutation );
        if( mutation.addedNodes.length ){
            mutation.addedNodes.forEach((node) => {
                console.log( mutation.target, node, 'added');

            });
        }
        if( mutation.removedNodes.length ){
            mutation.removedNodes.forEach((node) => {
                console.log( mutation.target, node, 'removed');
            });
        }
    }
    waitFor(selector) {
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
    wait(time) {
        return new Promise((resolve) => {
            setTimeout(resolve, time);
        });
    }
}

function formatMoney(val) {
    return `$${commafy(val)}`;
}
function parseMoney(val) {
    return parseInt(val
        .replace("$", "")
        .replace(/,/g, ""));
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

let injectScript = new InjectScript();
//# sourceMappingURL=inject.js.map
