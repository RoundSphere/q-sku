const extListingsDropdown = function( value ){
    return `
        <option>${value}</option>
    `;
};

const extMasterSku = function( item, optionsString ){
    return `
        <div class="masterItem">
            <div class="ext-flex masterItemRow" data-masterid="${item.id}">
                <div class="ext-flex-item"><a data-itemid="${item.id}" href="#" class="createNew">Split</a></div>
                <div class="ext-flex-item--full">${item.masterSku}</div>
                <div class="ext-flex-item hide-on-create"><input type="checkbox" /></div>
                <div class="ext-flex-item--full hide-on-create">
                    <select>
                        ${optionsString}
                    </select>
                </div>
                <div class="ext-flex-item">${item.masterQty}</div>
                <div class="ext-flex-item hide-on-create"><input type="checkbox" /></div>
            </div>
            <div class="listings-container">
                ${item.listings.map( listing => extListingSku( listing, optionsString ) ).join('')}
            </div>
        </div>

    `;
};

const extListingSku = function( item, optionsString ){
    return `
        <div class="ext-flex listingSku" data-masterid="${item.parent}">
            <div class="ext-flex-item"><a data-listingid="${item.id}" data-itemid="${item.parent}" href="#" class="deleteRow">Remove</a></div>
            <div class="ext-flex-item--full">+  ${item.id}</div>
            <div class="ext-flex-item"><input type="checkbox" /></div>
            <div class="ext-flex-item--full">
                <select>
                    ${optionsString}
                </select>
            </div>
            <div class="ext-flex-item"><input type="text" value="${item.listingQty}" /></div>
            <div class="ext-flex-item"><input type="checkbox" /></div>
        </div>
    `;
};

const extModalTable = function( data ){
    return `
        <p><strong>PO #: </strong> - ${data.id}</p>
        <div class="ext-flex">
            <div class="ext-flex-item"></div>
            <div class="ext-flex-item--full">Master SKU</div>
            <div class="ext-flex-item">Send to FBA?</div>
            <div class="ext-flex-item--full">Listing SKU</div>
            <div class="ext-flex-item">Quantity</div>
            <div class="ext-flex-item">LTL?</div>
        </div>
        <div class="master-sku-container"></div>
        <div class="ext-btn-container">
            <a href="#" class="ext-btn" id="savePoDetails">Save</a>
        </div>
    `;
};

const extModalTemplate = function(){
    return `
        <div id="ext-modal__inner">
            <span class="ext-modal-close">Close</span>
            <div class="modal__content"></div>
        </div>
    `;
};

const extInternalNoteMsg = function(){
    return `
        <p class="ext-notice">Internal Notes has been disabled. Please use the Manage button to add notes.</p>
    `;
};

const extButton = function(){
    return `
        <button id="managePoItem" style="margin-bottom: 5px; width:70px;"
            class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-icon-primary" role="button">
            <span class="ui-button-icon-primary ui-icon" style="background-position: -112px -80px;"></span>
            <span class="ui-button-text">Manage</span>
        </button>
    `;
};
