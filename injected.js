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
            // TODO This is broken and I'm stupid. Do better
            // Consider walking away from observer and moving to specified onClick events
            this.observeChanges( $('#centerSouthPanel' )[0], this.listListener );
        });
    }
    listListener( array, self ){
        let items = array.filter((item) => {
            return item.target === $('#poItemsGrid')[0] && item.addedNodes.length;
        });
        if( items.length ){
            self.updateDetails( items );
        }
    }
    observeChanges(element, callback) {
        let observer = new MutationObserver((mutations) => {
             callback( mutations, this );
        });
        let observerConfig = {
            childList: true,
            subtree: true
        };
        observer.observe(element, observerConfig);
    }
    updateDetails(mutations){
        console.log( 'poItemsGrid has been (re)rendered' );
        console.log( mutations );

        this.waitFor( '#poItemsGrid' ).then( (container) => {
            this.data = [];
            let rows = $( container ).find( 'tr' );
            for( var i = 1, rowLength = rows.length; i<rowLength; i++ ){
                let cells = rows[i].cells;
                this.data.push({
                    id: cells[1].innerText
                });
            }
            console.log( rows[1].cells );

            console.log( this.data );
        });
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
