console.log("*** Background pagesss ***");
// 10080
const regularInterval = 10080;
const dismissedInterval = 60;
var allBundled = [];

chrome.alarms.create("check", {
    when: Date.now() + 100,
    periodInMinutes: regularInterval
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "check") {
        if (alarm.periodInMinutes === dismissedInterval) {
            chrome.alarms.create("check", {
                periodInMinutes: regularInterval
            });
        }
        getApidata2();
    }
});

chrome.runtime.onMessage.addListener( ( request, sender, sendResponse ) => {
    switch (request.action) {
        case "ajax":
            request.success = (response) => {
                console.log("[ajax ok]", request.url, '\n', response);
                sendResponse({
                    success: true,
                    payload: response
                });
            };
            request.error = (response) => {
                console.log("[ajax error]", request.url, '\n', response);
                sendResponse({
                    success: false,
                    payload: response
                });
            };
            $.ajax(request);
            break;
    }
    return true;
});

chrome.webRequest.onCompleted.addListener(
    function (details) {
        if (details && details.statusCode === 200) {
            console.log('successful request to submitnewpo or cancel');
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (details.url.indexOf('submitnewpo') > -1) {
                    chrome.tabs.sendMessage(tabs[0].id, { newPoSuccess: true });
                }
                if (details.url.indexOf('cancel') > -1) {
                    chrome.tabs.sendMessage(tabs[0].id, { cancelPoSuccess: true });
                }
            });
        }

    },
    { urls: ["*://app.skubana.com/work/po/submitnewpo", "*://app.skubana.com/work/po/cancel"] },
    []
);

function getApidata2() {
    $.ajax({
        url: 'https://api.airtable.com/v0/appzVvw2EEvwkrlgA/Bundles (Not Automated)',
        type: 'GET',
        dataType: 'json',
        headers: {
            'Authorization': 'Bearer keyXQlwLzb69roBOM',
        },
        contentType: 'application/json; charset=utf-8',
        success: function (result) {
            var obj = result.records;
            var SKUoffset = result.offset;

            nextPagedata(SKUoffset);

        },
        error: function (error) {
            console.log(result.records);
        }
    });
}

// ## Function to get next page data.
// @dataSrc: API Data
// @nextLink: Offset fields data
//
function nextPagedata(nextLink) {
    if (nextLink) {
        $.ajax({
            url: 'https://api.airtable.com/v0/appzVvw2EEvwkrlgA/Bundles (Not Automated)?offset=' + nextLink + '',
            type: 'GET',
            dataType: 'json',
            headers: {
                'Authorization': 'Bearer keyXQlwLzb69roBOM',
            },
            contentType: 'application/json; charset=utf-8',
            success: function (result) {
                var obj = result.records;
                var SKUoffset = result.offset;
                if (obj) {
                    console.log(obj);
                    $.each(obj, function (key, value) {
                        var listingSku = value.fields['Master SKU'];
                        var bundleItem = value.fields['Bundled Items'];
                        replaceString = bundleItem.replace(/\{.*?\}/g, '&');
                        data = replaceString.split("&");
                        $.each(data, function (key, value) {
                            var trimStr = jQuery.trim(value);
                            if (value.length > 1) {
                                item = {}
                                item["masterSku"] = trimStr;
                                item["listingSku"] = listingSku;
                                allBundled.push(item);
                            }
                        });
                    });

                }


                if (obj.length < 100) {
                    console.log(allBundled);
                    let allBundledSkusdat = JSON.stringify(allBundled);
                    chrome.storage.local.set({ 'bundleSku': allBundledSkusdat }, function () {
                        console.log('Value is set to ');
                    });
                }
                nextPagedata(SKUoffset);

            },
            error: function (error) {
                console.log(result.records);
            }
        });
    }
}
