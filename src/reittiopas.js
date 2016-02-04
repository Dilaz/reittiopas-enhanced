'use strict';

var Q = require('q');
var $ = require('jquery');

const TRAIN_IMAGE_NAME = '/images/resultSummary/pict_juna.gif';
const CURRENT_TIME = new Date();
const TOMORROW_TIME = new Date(CURRENT_TIME.getTime() + 24 * 3600 * 1000);

// URLS
const STATIONS_URL = 'http://rata.digitraffic.fi/api/v1/metadata/stations';
const LIVE_TRAINS_URL = 'http://rata.digitraffic.fi/api/v1//live-trains?departing_trains=100&station=';

const REPLACE_TABLE = {
	'Pasilan asema, L.': 'Pasila asema',
	'Helsinki, Lait.': 'Helsinki asema',
	'Helsinki': 'Helsinki asema',
	'Tikkurilan ase.': 'Tikkurila asema',
	'Ilmala': 'Ilmala asema',
	'Kauklahti': 'Kauklahti asema',
	'Järvenpää': 'Järvenpää asema',
	'Riihimäki': 'Riihimäki asema',
	'Keravan asema, L.': 'Kerava asema',

};

/**
 * Checks if 2 dates are the same day
 * @param  Date date1
 * @param  Date date2
 * @return boolean
 */
function matchDate(date1, date2) {
	return date1.getFullYear() === date2.getFullYear() &&
	date1.getMonth() === date2.getMonth() &&
	date1.getDate() === date2.getDate();

}

/**
 * Checks if 2 dates are the same day & same time
 * @param  Date date1
 * @param  Date date2
 * @return boolean
 */
function matchDateAndTime(date1, date2) {
	return matchDate(date1, date2) &&
	date1.getHours() === date2.getHours() &&
	date1.getMinutes() === date2.getMinutes();
}

function timeToDate(time) {
	let hours = parseInt(time.split(':')[0], 10);
	let minutes = parseInt(time.split(':')[1], 10);
	let date = null;

	if (hours < CURRENT_TIME.getHours() ||
		(hours === CURRENT_TIME.getHours() && minutes < CURRENT_TIME.getMinutes())) {
		date = new Date(TOMORROW_TIME);
	}
	else {
		date = new Date(CURRENT_TIME);
	}

	date.setHours(hours);
	date.setMinutes(minutes);

	return date;
}


function dateToTime(date) {
	let hours = ('0' + date.getHours().toString()).slice(-2);
	let minutes = ('0' + date.getMinutes().toString()).slice(-2);

	return [hours, minutes].join(':');
}

function resetArriveTime(obj) {
	obj
	.css({
		color: 'black',
		'vertical-align': 'center',
		'text-align': 'left',
		'padding-top': '0',
	});
}


function getRealDepartureTime(trainObj) {
	// Reset all extra data from the train objects
	trainObj = trainObj.map(function(train) {
		delete train.cancelled;
		delete train.differenceInMinutes;
		delete train.found;
		delete train.delayed;
		delete train.actualTime;

		return train;
	});

	return Q.all(
		// Get station shortcodes
		trainObj.map(function(train) {
			return train.shortCode;
		})
		// Filter duplicates
		.filter(function(value, index, self) {
			return self.indexOf(value) === index;
		})
		// Make these into promises
		.map(function(station) {
			return Q.promise(function(resolve, reject) {
				$.getJSON(LIVE_TRAINS_URL + station, function(data) {
					resolve({
						shortCode: station,
						data: data,
					});
				}, reject);
			});
		})
	)
	.then(function(stations) {
		// Turn into object with shortcode as key
		let obj = {};
		stations.forEach(function(station) {
			obj[station.shortCode] = station.data;
		});

		return obj;
	})
	.then(function(stations) {
		// Go through the trains again
		return trainObj.map(function(train) {
			// Get the station object
			let station = stations[train.shortCode];

			// Try to match the train type & schedule time
			station.forEach(function(stationTrain) {
				if (stationTrain.commuterLineID !== train.type) {
					return;
				}

				stationTrain.timeTableRows.forEach(function(stationTime) {
					let scheduleTime = new Date(stationTime.scheduledTime);
					let actualTime = new Date(stationTime.liveEstimateTime);

					if (stationTime.type === 'DEPARTURE' &&
					stationTime.stationShortCode === train.shortCode &&
					matchDateAndTime(scheduleTime, train.departDate)) {
						train.found = true;
						train.cancelled = stationTime.cancelled || stationTrain.cancelled;
						if (stationTime.differenceInMinutes &&
						stationTime.differenceInMinutes > 0) {
							train.delayed = true;
							train.actualTime = actualTime;
							train.differenceInMinutes = parseInt(stationTime.differenceInMinutes, 10);
						}
					}
				});
			});

			return train;
		});
	})
	.then(function(trains) {
		trains.forEach(function(train) {
			if (train.cancelled) {
				train.nameObj.text('Peruttu')
				.css({
					'font-weight': 700,
					color: 'red',
					'text-transform': 'uppercase',
				});
			}
			else if (train.delayed) {
				let actualTime = train.actualTime;
				let arriveTime = new Date(train.arriveDate.getTime() +
					train.differenceInMinutes * 60 * 1000);

				train.departTimeObj.text(
					'+' + train.differenceInMinutes.toString() + 'min ' +
					dateToTime(actualTime)
				)
				.css({
					color: 'red',
					'vertical-align': 'top',
					'text-align': 'center',
					'padding-top': '3px',
				});

				train.arriveTimeObj.text(dateToTime(arriveTime))
				.css({
					color: 'red',
				});
			}
			else if (train.found) {
				train.departTimeObj.text(train.departTime).css({
					color: 'green',
					'vertical-align': 'center',
					'text-align': 'left',
					'padding-top': '0',
				});
				resetArriveTime(train.arriveTimeObj);
			}
			else {
				train.departTimeObj.text(train.departTime).css({
					color: 'black',
					'vertical-align': 'center',
					'text-align': 'left',
					'padding-top': '0',
				});

				resetArriveTime(train.arriveTimeObj);
			}
		});
	});
}



$(function() {

	// Make sure these are routes for today
	if (!$('#date_cb_today')[0].checked) {
		return;
	}

	let currentHours = parseInt($('#hour').val(), 10);
	let currentMinutes = parseInt($('input[name="minute"]').val(), 10);

	if (isNaN(currentHours + currentMinutes) ||
	currentHours < CURRENT_TIME.getHours() ||
	(currentHours === CURRENT_TIME.getHours() && currentMinutes < CURRENT_TIME.getMinutes())) {
		// return;
	}


	let results = $('#resultSummary');

	if (!results) {
		return;
	}


	let departingTrains = [];

	// Try to find trains by icon
	results.find('.lineIcon img')
	.filter(function() {
		return $(this).attr('src') === TRAIN_IMAGE_NAME;
	}).each(function() {
			let nameObj = $(this).siblings('.code');
			let name = nameObj.text();
			let stationObj = $(this).closest('.rLeg').children('.locName');
			let station = stationObj.text();
			let departTimeObj = $(this).closest('.rLeg').find('.routeGraphTime:first-child');
			let departTime = departTimeObj.text();
			let arriveTimeObj = $(this).closest('.rLeg').find('.routeGraphTime:last-child');
			let arriveTime = arriveTimeObj.text();

			let departDate = timeToDate(departTime);
			let arriveDate = timeToDate(arriveTime);

			if (REPLACE_TABLE[station]) {
				station = REPLACE_TABLE[station];
			}

			departingTrains.push({
				name: name,
				nameObj: nameObj,
				type: name.split('-')[0],
				station: station,
				stationObj: stationObj,
				departTime: departTime,
				departDate: departDate,
				departTimeObj: departTimeObj,
				arriveTimeObj: arriveTimeObj,
				arriveDate: arriveDate,
			});
	});

	// If no trains were found, just end here
	if (!departingTrains) {
		return;
	}

	// Get the stations from digitraffic
	Q.promise(function(resolve, reject) {
		$.getJSON(STATIONS_URL, function(data) {
			return resolve(data);
		}, reject);
	})
	.then(function(data) {
		// Transform the data into object with station name as key
		// and shortcode as value
		let obj = {};

		data.forEach(function(station) {
			obj[station.stationName] = station.stationShortCode;
		});

		return obj;
	})
	.then(function(stations) {
		// Go through each train and add station shortcode
		return departingTrains.map(function(train) {
			train.shortCode = stations[train.station];
			return train;
		});
	})
	.then(function(trains) {
		// Get the trains leaving from the stations given
		getRealDepartureTime(trains);

		setInterval(function() {
			getRealDepartureTime(trains);
		}, 60 * 1000);
	});
});
