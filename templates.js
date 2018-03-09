const extListingsDropdown = function( value ){
    return `
        <option>${value}</option>
    `;
};

const extMasterSku = function( item ){
    return `
        <div class="masterItem master__container" data-masterid="${item.id}">
            <div class="ext-title"><strong>${item.masterSku} :: Qty: ${item.masterQty}</strong></div>
            <div class="ext-flex">
                <div class="ext-flex-item"><a data-itemid="${item.id}" href="#" class="createNew">Split</a></div>
                <div class="ext-flex-item--full">Listing SKU</div>
                <div class="ext-flex-item">Quantity</div>
                <div class="ext-flex-item">Send to FBA?</div>
                <div class="ext-flex-item">LTL?</div>
            </div>
            <div class="listings-container"></div>
        </div>
    `;
};

const extListingSku = function( item, optionsString, listingsLength ){
    let removeBtn = `<a data-listingid="${item.id}" data-itemid="${item.parent}" href="#" class="deleteRow">Remove</a>`;
    return `
        <div class="ext-flex listingSku" data-masterid="${item.parent}" data-listingid="${item.id}">
            <div class="ext-flex-item">${ listingsLength > 1 ? removeBtn : ''}</div>
            <div class="ext-flex-item--full">
                <select data-details="listingSku">
                    ${optionsString}
                </select>
            </div>
            <div class="ext-flex-item"><input data-details="listingQty" type="text" value="${item.listingQty}" /></div>
            <div class="ext-flex-item"><input data-details="sendToFBA" type="checkbox" ${item.sendToFBA ? 'checked' : ''} /></div>
            <div class="ext-flex-item"><input data-details="ltl" type="checkbox" ${item.ltl ? 'checked' : ''} /></div>
        </div>
    `;
};

const extModalTable = function( data ){
    return `
        <p><strong>PO #: </strong> - ${data.id}</p>
        <div class="master-sku-container"></div>
        <div class="ext-additional-notes">
            <label>Additional Notes</label>
            <textarea data-details="additionalNotes">${data.additionalNotes}</textarea>
        <div class="ext-btn-container">
            <a href="#" class="ext-btn ext-btn-cancel ext-modal-close">Close</a>
            <a href="#" class="ext-btn" id="savePoDetails">Save</a>
        </div>
    `;
};

const extModalTemplate = function(){
    return `
        <div id="ext-modal__inner">
            <!--span class="ext-modal-close ext-modal-close-icon">Close</span-->
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
