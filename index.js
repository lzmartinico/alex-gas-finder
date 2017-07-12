'use strict';

//Internal imports 
const AlexaDeviceAddressClient = require('./AlexaDeviceAddressClient');

// External imports
const Alexa = require('alexa-sdk');
// Constants
const APP_ID = "amzn1.ask.skill.ab22de31-4213-4b65-b744-bcb159f2ad31";

const ALL_ADDRESS_PERMISSION = "read::alexa:device:all:address";

const PERMISSIONS = [ALL_ADDRESS_PERMISSION];

// Messages

const WELCOME = "Welcome to Gas Finder. Ask me to find you the closest gas station to you, or to give you the cheapest gas prices!";

const NOTIFY_MISSING_PERMISSIONS = "Please enable Location permissions in the Amazon Alexa app.";

const NO_ADDRESS = "It looks like you don't have an address set. You can set your address from the companion app.";

const ADDRESS_AVAILABLE = "Here is your full address: ";

const ERROR = "Uh Oh. Looks like something went wrong.";

const LOCATION_FAILURE = "There was an error with the Device Address API. Please try again.";

const GOODBYE = "Bye, safe driving!";

const UNHANDLED = "I am not sure how to do that. Please ask me what the closest gas station is, or to give you the cheapest gas prices.";

const Messages = {
    "WELCOME": WELCOME,
    "NOTIFY_MISSING_PERMISSIONS": NOTIFY_MISSING_PERMISSIONS,
    "NO_ADDRESS": NO_ADDRESS,
    "ADDRESS_AVAILABLE": ADDRESS_AVAILABLE,
    "ERROR": ERROR,
    "LOCATION_FAILURE": LOCATION_FAILURE,
    "GOODBYE": GOODBYE,
    "UNHANDLED": UNHANDLED,
   // "HELP": HELP,
   // "STOP": STOP
};

const getAddress = function(callback) {
    console.info("Starting getAddressHandler()");

    const consentToken = this.event.context.System.user.permissions.consentToken;

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
                console.log("Address successfully retrieved, now responding to user.");
                const address = addressResponse.address;

                const ADDRESS_MESSAGE = Messages.ADDRESS_AVAILABLE +
                    `${address['addressLine1']}, ${address['stateOrRegion']}, ${address['postalCode']}`;

                this.emit(":tell", ADDRESS_MESSAGE);
                callback();
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

        console.info("Ending getAddressHandler()");
    });

    deviceAddressRequest.catch((error) => {
        this.emit(":tell", Messages.ERROR);
        console.error(error);
        console.info("Ending getAddressHandler()");
    });
};

const getStations = function(addressline, stateorregion, postcode) {
    // GET Coordinates from address
    // GET station for coordinates
    // RETURN JSON object
}

const findClosestHandler = function() {
   getAddress(() => {
        //GET list of gas stations
        //FIND smallest distance
   }); 
}

const findCheapestHandler = function() {
   getAddress(() => {
        //GET list of gas stations
        //SORT by price
        //FIND distance
   }); 
}

const findCheapestHandler = function() {}

const newSessionHandler = function() {
    this.emit(":tell", Messages.WELCOME);
}

const unhandledRequestHandler = function() {
    console.info("Starting unhandledRequestHandler()");
    this.emit(":ask", Messages.UNHANDLED);
    console.info("Ending unhandledRequestHandler()");
};

exports.handler = (event, context, callback) => {
    let alexa  = Alexa.handler(event, context);
    
    alexa.appId = APP_ID;
    alexa.registerHandlers({
        'FindClosestStation': findClosestHandler,
        'NewSession': newSessionHandler,
        'Unhandled': unhandledRequestHandler
    });
    
    alexa.execute();
};
