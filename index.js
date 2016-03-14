module.exports = function(api_endpoint){

    /* load required libs */
    var colors = require("colors");
    var async = require("async");
    var Client = require('node-rest-client').Client;

    /**
     * Holds the API endpoint root url
     * @type String
     */
    var apiEndpoint;
    
    /* if api_endpoint arg was not supplied, we set it to default */
    if(typeof api_endpoint === 'undefined'){
        apiEndpoint = "https://www.vegvesen.no/nvdb/api";
    }else{
        apiEndpoint = api_endpoint;
    }
    
    /*
     * A reference variable to 'this'
     * @type module.exports
     */
    var _this = this;

    /**
     * Local node-rest-client variable
     * @type module.exports.Client
     */
    var client = new Client();
    
    /**
     * Header object
     * @type object
     */
    var headers = {
        "Accept": "application/vnd.vegvesen.nvdb-v1+json", 
        "Content-Type": "application/vnd.vegvesen.nvdb-v1+json; charset=utf-8"
    };
    
    /**
     * fetches a resource from API endpoint, then runs callback function
     * @param string root
     * @param function callback
     */    
    function _getResources(root, callback){
        
        var callback = callback;
        
        var args = {
            headers: headers
        };

        client.get(apiEndpoint + root, args, function(data, response){
            try{
                var data = JSON.parse(data);
                callback(data);
            }catch(e){
                console.log(colors.inverse(colors.red('Could not parse ' + apiEndpoint + root + ', error: ' + e.message)));
                return;
            }
        }).on('error', function (err) {
            console.log(colors.inverse(colors.red('[Error] something went wrong on the request')));
        });

    };
    
    /*
     * Converts strings with dash to camelCase
     * @param string str
     * @returns string
     */
    function _toCamelCase(str){
        return str.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase()});
    }
    
    /**
     * Encodes variables to string
     * @param mixed str
     * @returns string
     */
    function _strEncode(str){
        switch(typeof str){
            case 'object':
                return JSON.stringify(str);
            case 'number':
                return str.toString();
            case 'array':
                throw 'Parameter cannot be Array';
            case 'string':
                return str;
            default:
                return str.toString();
        };
    }
    
    /**
     * Fetches child nodes of every resource from the API endpoint
     * and binds function handlers to each child to this
     * @param string key
     */
    function getChildNodes(key){
        if(typeof _this[key].url !== 'undefined'){
            _getResources(_this[key].url, function(child){
                if(typeof child.ressurser !== 'undefined'){
                    for(var i = 0; i < child.ressurser.length; i++){
                        (function(index){
                            var childNode = _toCamelCase(child.ressurser[i].rel);
                            var url = child.ressurser[index].uri;

                            var functionName = key + "." + childNode + "()";
                            var deprecationMsg = colors.inverse(colors.cyan(functionName + " is deprecated"));

                            var deprecated = false;

                            if(typeof child.ressurser[i].status !== 'undefined'){
                                if(child.ressurser[i].status === 'utgår'){
                                    deprecated = true;
                                }
                            }

                            if(/{.+?}/g.test(url)){
                                _this[key][childNode] = function(params, callback){
                                    if(deprecated){
                                        console.log(deprecationMsg);
                                    }
                                    if(url.match(/{.+?}/g).length === 1){
                                        url = url.replace(/{.+?}/g, function(){
                                            return encodeURIComponent(_strEncode(params));
                                        });
                                    }else{
                                        if(typeof params !== 'array' && typeof params !== 'object'){
                                            console.log(colors.inverse(colors.yellow(functionName + ": multiple params must be array")));
                                            return;
                                        }
                                        if(params.length < url.match(/{.+?}/g).length){
                                            console.log(colors.inverse(colors.yellow(functionName + ": " + (url.match(/{.+?}/g).length - params.length) + " paramter(s) missing")));
                                            return;
                                        }
                                        url.replace(/{.+?}/g, function(){
                                            return encodeURIComponent(_strEncode(params.shift())); 
                                        });    
                                    }

                                    _getResources(url, callback);
                                };

                            }else{
                                _this[key][childNode] = function(callback){
                                    if(deprecated){
                                        console.log(deprecationMsg);
                                    }
                                    _getResources(url, callback);
                                };
                            }
                            delete _this[key].url;
                        })(i);
                    };
                };
            });
        };  
    }
    
    /**
     * Connect to the API endpoint, and fetch resources
     * @param function callback
     */
    this.connect = function(callback){
               
        _getResources('/', function(root){
            if(typeof root.ressurser !== 'undefined'){
                (function(){
                    for(var i = 0; i < root.ressurser.length; i++){
                        var rootNode = _toCamelCase(root.ressurser[i].rel);
                        var rootUrl = root.ressurser[i].uri;
                        _this[rootNode] = {};
                        _this[rootNode].url = rootUrl;
                        getChildNodes(rootNode);
                    };    
                })();
                callback();
            }else{
                throw colors.inverse(colors.red('Could not fetch resources from API endpoint'));;
            };
        });
    };
    
};