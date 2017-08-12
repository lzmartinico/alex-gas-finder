'use strict';

//Internal imports 
const AlexaDeviceAddressClient = require('./AlexaDeviceAddressClient');
const http = require('http');

// External imports
const Alexa = require('alexa-sdk');
// Constants
const APP_ID = "amzn1.ask.skill.ab22de31-4213-4b65-b744-bcb159f2ad31";

const ALL_ADDRESS_PERMISSION = "read::alexa:device:all:address";

const PERMISSIONS = [ALL_ADDRESS_PERMISSION];

const GMAPS_API_URL = "maps.googleapis.com"
const GMAPS_API_GEOCODE = "/maps/api/geocode/json?address="
const GMAPS_API_KEY = "AIzaSyD0XnBV0iy_KYq_Uj59JF3CeLVa3o_FGTE"

const GASFEED_API_URL = "devapi.mygasfeed.com" 
const GASFEED_API_STATIONS = "/stations/radius/"
const GASFEED_API_KEY = "rfej9napna"
// Messages

const WELCOME = "Welcome to Gas Finder. Ask me to find you the closest gas station to you, or to give you the cheapest gas prices!";

const NOTIFY_MISSING_PERMISSIONS = "Please enable Location permissions in the Amazon Alexa app.";

const NO_ADDRESS = "It looks like you don't have an address set. You can set your address from the companion app.";

const ADDRESS_AVAILABLE = "Here is your full address: ";

const ERROR = "Uh Oh. Looks like something went wrong.";

const LOCATION_FAILURE = "There was an error with the Device Address API. Please try again.";

const COORDINATE_FAILURE = "No gas station could be found within 5 miles from your address. Try setting a different address"

const GOODBYE = "Bye, safe driving!";

const UNHANDLED = "I am not sure how to do that. Please ask me what the closest gas station is, or to give you the cheapest gas prices.";

const CLOSEST_STATION_FOUND = "The closest gas station to your device location is "

const CLOSEST_STATION_CARD_TITLE = "Your closest gas station: "

const CHEAPEST_STATION_FOUND = "The cheapest gas station within a 5 mile radius to your device location is "

const CHEAPEST_STATION_CARD_TITLE = "Cheapest gas station: "

const HELP_MESSAGE = "You can ask me what the closest gas station is, or to give you the cheapest gas prices.";

const Messages = {
    "WELCOME": WELCOME,
    "NOTIFY_MISSING_PERMISSIONS": NOTIFY_MISSING_PERMISSIONS,
    "NO_ADDRESS": NO_ADDRESS,
    "ADDRESS_AVAILABLE": ADDRESS_AVAILABLE,
    "ERROR": ERROR,
    "LOCATION_FAILURE": LOCATION_FAILURE,
    "COORDINATE_FAILURE": COORDINATE_FAILURE,
    "GOODBYE": GOODBYE,
    "UNHANDLED": UNHANDLED,
    "CLOSEST_STATION_FOUND": CLOSEST_STATION_FOUND,
    "CHEAPEST_STATION_FOUND": CHEAPEST_STATION_FOUND,
    "CHEAPEST_STATION_CARD_TITLE": CHEAPEST_STATION_CARD_TITLE,
    "CLOSEST_STATION_CARD_TITLE": CLOSEST_STATION_CARD_TITLE,
    "HELP": HELP_MESSAGE,
   // "STOP": STOP
};

const getAddress = function(callback) {
    const consentToken = this.event.context.System.user.permissions.consentToken;
    console.info("Starting getAddressHandler()");
    let geolong, geolat = ""
    // If we have not been provided with a consent token, this means that the user has not
    // authorized your skill to access this information. In this case, you should prompt them
    // that you don't have permissions to retrieve their address.
    if(!consentToken) {
        this.emit(":tellWithPermissionCard", Messages.NOTIFY_MISSING_PERMISSIONS, PERMISSIONS);

        // Lets terminate early since we can't do anything else.
        console.log("User did not give us permissions to access their address.");
        console.info("Ending getAddressHandler()");
        return;
    }

    const deviceId = this.event.context.System.device.deviceId;
    const apiEndpoint = this.event.context.System.apiEndpoint;

    const alexaDeviceAddressClient = new AlexaDeviceAddressClient(apiEndpoint, deviceId, consentToken);
    let deviceAddressRequest = alexaDeviceAddressClient.getFullAddress();

    deviceAddressRequest.then((addressResponse) => {
        switch(addressResponse.statusCode) {
            case 200:
                const address = addressResponse.address; //{'addressLine1': "410 Terry Ave N, Seattle", 'stateOrRegion': 'California', 'postalCode': '98102'}
                const address_string = address['addressLine1'] + "+" + address['stateOrRegion'] + "+" + address['postalCode']; 
                let options = {
                   host: GMAPS_API_URL, 
                    port: 80,
                    path: GMAPS_API_GEOCODE + address_string.split(" ").join("+") // + "&key=" + GMAPS_API_KEY
                }
                http.get(options, (res) => {
                    res.on('data',(body) => {
                        let parsed = JSON.parse(body)
                        geolong = parsed['results'][0]['geometry']['location']['lng']
                        geolat = parsed["results"][0]["geometry"]["location"]["lat"]
                        callback(geolong, geolat);
                    })
                }).on('error', function(e) {
                      this.emit(":tell", "Got error: " + e.message);
                })
                /*const ADDRESS_MESSAGE = Messages.ADDRESS_AVAILABLE +
                    `${address['addressLine1']}, ${address['stateOrRegion']}, ${address['postalCode']}`;

                this.emit(":tell", ADDRESS_MESSAGE);*/
                break;
            case 204:
                // This likely means that the user didn't have their address set via the companion app.
                console.log("Successfully requested from the device address API, but no address was returned.");
                this.emit(":tell", Messages.NO_ADDRESS);
                break;
            case 403:
                console.log("The consent token we had wasn't authorized to access the user's address.");
                this.emit(":tellWithPermissionCard", Messages.NOTIFY_MISSING_PERMISSIONS, PERMISSIONS);
                break;
            default:
                this.emit(":ask", Messages.LOCATION_FAILURE, Messages.LOCATION_FAILURE);
        }

    }).catch((error) => {
        console.log(error)
    });

    deviceAddressRequest.catch((error) => {
        this.emit(":tell", Messages.ERROR);
        console.error(error);
        console.info("Ending getAddressHandler()");
    });
};

const getStations = function(geolong, geolat, radius, sort, fuelType, callback) {
    let options = {
        host: GASFEED_API_URL, 
        path: GASFEED_API_STATIONS +  geolat + "/" + geolong + "/" + radius + "/"  + fuelType + "/" + sort + "/" + GASFEED_API_KEY + ".json",
		headers: {  
			'Content-Type': 'application/json' 
		}  
    }
    http.get(options, (res) => {
        res.on('data',(body) => {
            let string = body.toString('utf-8')
            let JSONre = /^\{"status":/;
            let payloadRE = /APP\/webroot\/index\.php, line 83\&lt\;\/pre\&gt\;\&lt\;\/div\&gt\;\&lt\;\/pre\&gt\;(\{.+})"/;
            let match = payloadRE.exec(string)
            let parsed = {}
            if (JSONre.test(string)) {
                parsed = JSON.parse(string) //TODO: fix this
            } else if (match) {
                var literal = match[1].replace(/&quot;/g, '"');
                console.log(literal)
                parsed = JSON.parse(literal)
            } 
            if (!parsed.stations) {
               getStations(geolong, geolat, radius*2, sort, fuelType, callback)
            } else {
                callback(parsed.stations)
            }
        })
    }).on('error', function(e) {
            console.log("error: ", e);
            this.emit(":tell", "Got error: " + e.message);
    })
}

const findClosestHandler = function() {
   getAddress.call(this,(geolong, geolat) => {
        //GET list of gas stations
        getStations(geolong, geolat,0.2, "Distance", "reg", (stations) => {
            let best = stations[0];
            if (best) {
                let message = Messages.CLOSEST_STATION_FOUND + best.station + " at address " + best.address
                this.emit(":tellWithCard", message, Messages.CLOSEST_STATION_CARD_TITLE + best.station, best.address) //TODO: add price based on user choice
            } else {
                this.emit(":tell", Messages.COORDINATE_FAILURE)
            }
       })
 });
}

const findCheapestHandler = function() {
   getAddress.call(this,(geolong, geolat) => {
        getStations(geolong, geolat,0.2, "Distance", "reg", (stations) => {
            console.log("stations are " + stations)
            let best = stations[0];
            if (best) {
                let message = Messages.CHEAPEST_STATION_FOUND + best.station + " at address " + best.address
                if (best.reg_price != "N/A") {
                    message = message + " for " + best.reg_price + " dollars" // TODO: change price
                }
                this.emit(":tellWithCard", message, Messages.CHEAPEST_STATION_CARD_TITLE + best.station + "($" + best.reg_price + ")", best.address) //TODO: add price based on user choice
            } else {
                this.emit(":tell", Messages.COORDINATE_FAILURE)
            } 
        })
   }); 
}

const helpHandler = function() {
    this.emit(":ask", Messages.HELP);
}

const cancelHandler = function() {
    this.emit(":tell", Messages.GOODBYE);
}

const newSessionHandler = function() {
    this.emit(":ask", Messages.WELCOME);
}

const unhandledRequestHandler = function() {
    console.info("Starting unhandledRequestHandler()");
    this.emit(":ask", Messages.UNHANDLED);
    console.info("Ending unhandledRequestHandler()");
};

exports.handler = (event, context, callback) => {
    let alexa  = Alexa.handler(event, context);
    
    alexa.appId = APP_ID;
    if(event.context && event.context.System.application.applicationId == 'applicationId'){
        event.context.System.application.applicationId = event.session.application.applicationId;
    }

    alexa.registerHandlers({
        'FindClosestStation': findClosestHandler,
        'FindCheapestStation': findCheapestHandler,
        'LaunchRequest': newSessionHandler,
        'AMAZON.HelpIntent': helpHandler,
        'AMAZON.StopIntent': cancelHandler,
        'AMAZON.CancelIntent': cancelHandler,
        'Unhandled': unhandledRequestHandler
    });
    
    alexa.execute();
};
