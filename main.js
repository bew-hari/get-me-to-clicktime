var map = undefined;
var geocoder = undefined;
var myLocation = undefined;
var myMarker = undefined;
var destAddress = '282 2nd Street 4th floor, San Francisco, CA 94105';
var destLocation = undefined;

var coffeeShop = undefined;
var donutShop = undefined;

var travelMode = undefined;
var directionsDisplay;
var directionsService;

function initialize() {
  // stretch map and directions div to page height
  $('#map-canvas').css('height', $(window).height());
  $('#directions').css('height', $(window).height());

  var mapOptions = {
    // default location at NU Campus
    center: { lat: 42.055984, lng: -87.675171 },
    zoom: 18,
    zoomControl: true,
    zoomControlOptions: {
      style: google.maps.ZoomControlStyle.LARGE,
      index: 1,
      position: google.maps.ControlPosition.LEFT_TOP
    },
    streetViewControl: true,
    streetViewControlOptions: {
      position: google.maps.ControlPosition.TOP_LEFT
    }
  };
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
  
  // initialize directions service
  directionsService = new google.maps.DirectionsService();
  directionsDisplay = new google.maps.DirectionsRenderer();
  directionsDisplay.setMap(map);
  directionsDisplay.setPanel(document.getElementById('directions'));


  geocoder = new google.maps.Geocoder();
  geocoder.geocode( { 'address': destAddress}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      destLocation = results[0].geometry.location;
      findPlaces(destLocation, '1000', 'coffee');
      findPlaces(destLocation, '1000', 'donuts');
    } else {
      alert('Geocode was not successful for the following reason: ' + status);
    }
  });
  getMyLocation();
}

// update parameters
function getMyLocation() {
  // find user location with HTML5 geolocation 
  $('#progress').html('<h3>Getting your location...</h3>');
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      myLocation = new google.maps.LatLng(position.coords.latitude,
                                          position.coords.longitude);
      //travelMode = 'BICYCLING';
      $('#progress').html('<h3>Please select travel mode.</h3>');
      map.setCenter(myLocation);
      myMarker = new google.maps.Marker({
        position: myLocation,
        map: map,
        title: 'Me'
      });
      getDirections();

    }, function() {
      handleNoGeolocation(true);
    });
  } else {
    // Browser doesn't support Geolocation
    handleNoGeolocation(false);
  }

}

function handleNoGeolocation(errorFlag) {
  if (errorFlag) {
    var content = 'Error: The Geolocation service failed.';
  } else {
    var content = "Error: Your browser doesn't support geolocation.";
  }

  var options = {
    map: map,
    position: new google.maps.LatLng(42.055984, -87.675171),
    content: content
  };

  var infowindow = new google.maps.InfoWindow(options);
  map.setCenter(options.position);
}

// find nearby bakery, cafes
function findPlaces(location, radius, keyword) {
  // find places based on supplied keyword and ranked by prominence
  var request = {
    location: location,
    radius: radius,
    keyword: keyword,
    rankBy: google.maps.places.RankBy.PROMINENCE,
    types: ['bakery', 'cafe', 'store'],
    openNow: true
  };
  service = new google.maps.places.PlacesService(map);
  service.nearbySearch(request, function (results, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {

      switch(keyword) {
        case 'coffee':
          coffeeShop = results[0]; // take first result
          break;
        case 'donut':
        case 'donuts':
          donutShop = results[0]; // take first result
          break;
        default:
          coffeeShop = undefined;
          donutShop = undefined;
          $('#progress').html('<h3>Oops! Something went wrong.</h3>');
      }


      getDirections();
    } else {
      alert("Search returned status: " + status);
    }
  });
}


function getDirections() {
  // not all parameters are ready
  if (!myLocation || !coffeeShop || !donutShop || !travelMode) {
    return;
  }

  // remove user location marker since directions service will add a new one
  if (!!myMarker) {
    myMarker.setMap(null);
    myMarker = undefined;
  }


  // update on progress
  $('#progress').html('<h3>Calculating route...</h3>');

  // call appropriate function based on travel mode
  if (travelMode == 'TRANSIT') {
    calcTransitRoute();
  } else {
    calcRoute(travelMode);
  }
}

function calcRoute(travelMode) {
  // construct waypoints for request
  var waypts = [];
  waypts.push({
    location: donutShop.geometry.location,
    stopover: true
  });
  waypts.push({
    location: coffeeShop.geometry.location,
    stopover: true
  });

  var request = {
      origin: myLocation,
      destination: destAddress,
      waypoints: waypts,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode[travelMode]
  };
  directionsService.route(request, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      directionsDisplay.setDirections(response);
      $('#progress').html('<h3>Done! Have a nice trip.</h3>');
    }
  });
}

// calculate route manually for TRANSIT (sadly, no waypoints allowed)
function calcTransitRoute() {
  var request = {
    origin: myLocation,
    destination: donutShop.geometry.location,
    travelMode: google.maps.TravelMode.TRANSIT
  };

  // nest service calls for each leg of the trip
  directionsService.route(request, function(toDonutShop, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      var request = {
        origin: donutShop.geometry.location,
        destination: coffeeShop.geometry.location,
        travelMode: google.maps.TravelMode.TRANSIT
      };
      directionsService.route(request, function(toCoffeeShop, status) {
        if (status == google.maps.DirectionsStatus.OK) {
          var request = {
            origin: coffeeShop.geometry.location,
            destination: destAddress,
            travelMode: google.maps.TravelMode.TRANSIT
          };
          directionsService.route(request, function(toDest, status) {
            if (status == google.maps.DirectionsStatus.OK) {
              // combine segments of trip
              var legs = toDonutShop.routes[0].legs
                          .concat(toCoffeeShop.routes[0].legs)
                          .concat(toDest.routes[0].legs);
              var overviewPath = toDonutShop.routes[0].overview_path
                                  .concat(toCoffeeShop.routes[0].overview_path)
                                  .concat(toDest.routes[0].overview_path);
              var result = toDonutShop;
              result.routes[0].legs = legs;
              result.routes[0].overview_path = overviewPath;
              directionsDisplay.setDirections(result);
              $('#progress').html('<h3>Done! Have a nice trip.</h3>');
            }
          });
        }
      });
    }
  });
}

google.maps.event.addDomListener(window, 'load', initialize);

$('#mode li').on('click', function(e) {
  e.preventDefault();

  // add/remove active class
  $(this).parent().children().removeClass('active');
  $(this).addClass('active'); 

  travelMode = $(this).children().first().html().toUpperCase();
  getDirections();
});
