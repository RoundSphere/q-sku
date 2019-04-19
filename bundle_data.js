function getApidata(){
    backgroundAjax({
        url: 'https://api.airtable.com/v0/appzVvw2EEvwkrlgA/Bundles (Not Automated)',
        type: 'GET',
        dataType: 'json',
        headers: {
            'Authorization': 'Bearer keyXQlwLzb69roBOM',
        },
        contentType: 'application/json; charset=utf-8'
    })
    .then((response) => {
        var obj = response.records;
        if(obj){
            allBundled = [];
            $.each(obj, function(key,value) {
                var listingSku = value.fields['Master SKU'];
                var bundleItem = value.fields['Bundled Items'];
                replaceString = bundleItem.replace(/\{.*?\}/g, '&');
                data = replaceString.split("&");

                $.each(data, function(key, value){
                    var trimStr = jQuery.trim(value);
                    if(value.length > 1){
                        item = {}
                        item ["masterSku"] = trimStr;
                        item ["listingSku"] = listingSku;
                        allBundled.push(item);
                    }
                });
            });
        }
        // console.log(allBundled);

        let allBundledSkus = JSON.stringify(allBundled);
        localStorage.setItem('allSkus', allBundledSkus);
        // console.log(allBundledSkus);
    })
    .catch((response) => {
        console.log(response);
    });
}