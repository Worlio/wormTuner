const tuner_settings = {
	tuner_name: "wormTuner",
	icecast_status: "/stream/status-json.xsl",
	update_interval: 0 // in milliseconds (ms). 0 means no update
};

var tuner_mem = {
	xhr: null
};

// VISUALIZER VARS START
var visualizer = {
	canvas: null,
	mode: 1,
	drawRequest: 0,
	renderInterval: null,
	startTime: new Date()
};
const vis_modes = [
	"None",
	"Bars",
	"Scope",
	"Multi-Scope",
	"Spectrogram",
	"Hyperdrive",
	"Nixie Bars",
	"Wire Meters",
	"VU Bars",
	"Stereo Diff"
];
// VISUALIZER VARS END

var tuner = {
	player: null,
	playing: true,
	volume: 100,
	canvas: {
		element: null,
		drawRequest: 0
	},
	html_elements: {
		title: null,
		station: null
	},
	analysers: null,
	context: null,
	splitter: null,
	merger: null,
	history_container: null,
	station_container: null,
	favorites_container: null
};

var station = null;

var track_favorites = {
};

var track_history = [
];

// Updates tuner_mem.xhr
function updateXHR() {
	tuner_mem.xhr.open('GET', tuner_settings.icecast_status, true);
	tuner_mem.xhr.send();
}

// Fixes listen_url to return a proper proxied address.
function fixURL(url) {
	return url.replace('http://example.com:8000/', '/stream/');
}

function startStation(new_station) {
	station = new_station;
	updateMetadata(null); // Avoid HUGE ROCK STATION playing Seasame Street theme text.
	if (tuner.player != null) tuner.player.stop();
	// Start player using IcecastMetadataPlayer for the metadata.
	// Use ?+date for avoiding problems with cache.
	tuner.player = new IcecastMetadataPlayer(new_station.listen_url+"?"+Date.now(), {
		onMetadata: (metadata) => {updateMetadata(metadata.StreamTitle);},
		metadataTypes: ["icy"]
	});

	// Start new context with analysers
	// Check if channels is only 1. If not, we assume stereo.
	tuner.context = new AudioContext();
	tuner.analysers = createVisualizer(tuner.player.audioElement, tuner.context, new_station.channels != 1);
	setVisualizer(tuner.analysers, visualizer.mode);

	// Properly set volume value.
	tuner.player.audioElement.volume = tuner.volume/100;
	play();
}

function searchStations(query) {
	var stations = document.querySelectorAll("stations > station");
	for(let f = 0; f < stations.length; f++) {
		var station = stations[f];
		var name = station.querySelector(':scope > station-name').innerText;
		var description = station.querySelector(':scope > description').innerText;
		var meta = station.querySelector(':scope > track-meta').innerText;

		if (name.toLowerCase().includes(query.toLowerCase()) || description.toLowerCase().includes(query.toLowerCase()) || meta.toLowerCase().includes(query.toLowerCase()))
			station.style.display = '';
		else
			station.style.display = 'none';
	}
}

function play() {
	tuner.player.play();
	document.querySelector('.play').classList.add('active');
}

function stop() {
	tuner.player.stop();
	document.querySelector('.play').classList.remove('active');
	station = null;
	updateMetadata('');
}

function updateMetadata(track) {
	var line_data = [
		{
			'index': 0,
			'timer': new Date()
		}
	];
	var load_str = [ // Fuck off.
		'==-'.padStart(0, ' '),
		'--==-'.padStart(4, ' '),
		'--==-'.padStart(8, ' '),
		'--==-'.padStart(12, ' '),
		'--==-'.padStart(16, ' '),
		'--==-'.padStart(20, ' '),
		'--==-'.padStart(24, ' '),
		'--==-'.padStart(28, ' '),
		'--==-'.padStart(32, ' '),
		'-=='.padStart(36, ' '),
		'-==--'.padStart(32, ' '),
		'-==--'.padStart(28, ' '),
		'-==--'.padStart(24, ' '),
		'-==--'.padStart(20, ' '),
		'-==--'.padStart(16, ' '),
		'-==--'.padStart(12, ' '),
		'-==--'.padStart(8, ' '),
		'-==--'.padStart(4, ' ')
	];
	var max_chars = 36;
	function marqueeify(line, x, y, e) {
		if (!line_data[e]) line_data[e] = { 'index': 0,'timer': new Date() };
		if (line != null && line.length >= max_chars) {
			var txt = line.concat('	    ').concat(line);
			if (line_data[e].index - 4 > line.length) {line_data[e].index = 0;}
			ctx.fillText(txt.substr(line_data[e].index,max_chars), x,y);
			var now = new Date();
			if (now >= new Date(line_data[e].timer.getTime() + 250)) {
				line_data[e].timer = now;
				line_data[e].index++;
			}
		} else if (line == null || line.length == 0) {
			if (line_data[e].index >= load_str.length) line_data[e].index = 0;
			ctx.fillText(load_str[line_data[e].index], x, y);
			var now = new Date();
			if (now >= new Date(line_data[e].timer.getTime() + 50)) {
				line_data[e].timer = now;
				line_data[e].index++;
			}
		} else ctx.fillText(line,x,y);
	}

	if (track != null) {
		addHistory(station, track);
		updateFavStatus(isFavorite(station.listen_url, track));
	}
	
	station.title = track;
	if (tuner.canvas.element) {
		var ctx = tuner.canvas.element.getContext("2d",{antialias: false,alpha: false});

		var WIDTH = tuner.canvas.element.width;
		var HEIGHT = tuner.canvas.element.height;

		window.cancelAnimationFrame(tuner.canvas.drawRequest);
		function drawMeta() {
			tuner.canvas.drawRequest = window.requestAnimationFrame(drawMeta);

			ctx.clearRect(0,0,WIDTH,HEIGHT);
			if (station != null) {
				let quality_text = station.bitrate ? station.bitrate+'kbps' : station.quality;

				ctx.font = "16px hack,monospace";
				ctx.fillStyle = "#FFF";
				ctx.textAlign = "justify";

				ctx.font = "bold 16px hack,monospace";
				marqueeify(station.name,6,20,0);
				ctx.font = "16px hack,monospace";
				marqueeify(track,8,36,1);
			}
		}
		drawMeta();
	}
}

function setTab(i) {
	var tabbuttons = document.querySelectorAll('tablist button');
	var tabboxes = document.querySelectorAll('tabbox');
	for (let t = 0; t < tabboxes.length; t++) {
		var tabbox = tabboxes[t];
		var tabbutton = tabbuttons[t];
		if (t != i) {
			tabbox.classList.remove('active');
			tabbutton.classList.remove('active');
		} else {
			tabbox.classList.add('active');
			tabbutton.classList.add('active');
		}
	}
}

function addHistory(station, track = null) {
	if (station == null) return;
	var track = track??station.title;

	if (track_history.length > 0 && (track_history[0].station_id == station.listen_url && track_history[0].title == track)) return;
	
	console.log(station.name.concat(' > ').concat(track));
	var trackContainer = document.createElement('div'),
		favButton      = document.createElement('button'),
		favImg         = document.createElement('img'),
		trackTitle     = document.createElement('a');

	let station_url    = station.listen_url;
	let station_track  = track;

	favButton.classList.add('fav-button');
		
	favButton.onclick  = function() {
		let status = favoriteTrack(station_url, station_track);
		updateFavStatus(status)
		favButton.classList.toggle('fav', status);
	};
	favImg.src         = 'heart.png';
	if (isFavorite(station_url, station_track)) favButton.classList.add('fav');

	trackTitle.innerText = track;

	favButton.appendChild(favImg);

	trackContainer.appendChild(trackTitle);
	trackContainer.appendChild(favButton);
	trackContainer.classList.add('track');
		
	if (track_history[0] == null || track_history[0].station_id != station.listen_url) {
		tuner.history_container.insertBefore(trackContainer, tuner.history_container.childNodes[0]);
	
		var statCont = document.createElement('div'),
			statText = document.createElement('b');

		statText.innerText = station.name;
		statCont.appendChild(statText);
		statCont.classList.add('station-header');

		tuner.history_container.insertBefore(statCont, tuner.history_container.childNodes[0]);
	} else {
		tuner.history_container.insertBefore(trackContainer, tuner.history_container.childNodes[1]);
	}

	var history_entry = {
		station_id: station.listen_url,
		title: track
	};

	track_history.unshift(history_entry);
}

function isFavorite(track_station, title) {
	return track_favorites[track_station] != null && track_favorites[track_station].includes(title);
}

function favoriteCurrentTrack() {
	updateFavStatus(favoriteTrack(station.listen_url, station.title));
}

function favoriteTrack(track_station, track) {
	if (track_favorites[track_station] == null)
		track_favorites[track_station] = [];

	var result = false;
	if (track_favorites[track_station].includes(track)) {
		track_favorites[track_station].splice(track_favorites[track_station].indexOf(track), 1);
	} else {
		track_favorites[track_station].unshift(track);
		result = true;
	}
	const d = new Date();
	d.setTime(d.getTime() + (99983090*24*60*60*1000));
	let expires = "expires=" + d.toUTCString();
	document.cookie = "favorites="+JSON.stringify(track_favorites)+";"+expires+";SameSite=None;secure=1;";

	populateFavorites();
	return result;
}

function updateFavStatus(isFav = false) {
	var favButton = document.querySelector('button.fav-button');
	if (isFav) {
		favButton.classList.add('fav');
	} else {
		favButton.classList.remove('fav');
	}
}

function exportFavorites() {
	var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(track_favorites, null, 2));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "worlio_station_favorites.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function populateFavorites() {
	while (tuner.favorites_container.hasChildNodes()) {
		tuner.favorites_container.lastElementChild.remove();
	}
	for (var key in track_favorites) {
		var statCont = document.createElement('div'),
			statText = document.createElement('b');

		statText.innerText = key;
		statCont.appendChild(statText);
		statCont.classList.add('station-header');

		tuner.favorites_container.append(statCont);

		var value = track_favorites[key];
		for (let t = 0; t < value.length; t++) {
			var track = value[t];

			var trackContainer = document.createElement('div'),
				favButton      = document.createElement('button'),
				favImg         = document.createElement('img'),
				trackTitle     = document.createElement('a');

			let station_url    = key;
			let station_track  = track;

			favButton.classList.add('fav-button');
				
			favButton.onclick  = function() {
				let status = favoriteTrack(station_url, station_track);
				updateFavStatus(status)
				favButton.classList.toggle('fav', status);
			};
			favImg.src         = 'heart.png';
			if (isFavorite(station_url, station_track)) favButton.classList.add('fav');

			trackTitle.innerText = track;

			favButton.appendChild(favImg);

			trackContainer.appendChild(trackTitle);
			trackContainer.appendChild(favButton);
			trackContainer.classList.add('track');

			tuner.favorites_container.append(trackContainer);
		}
	}
}

function searchFavorites(query) {
	var tracks = document.querySelectorAll("favorites > .track");
	for(let f = 0; f < tracks.length; f++) {
		var track = tracks[f];
		var title = track.querySelector(':scope > a');

		if (!title.innerText.toLowerCase().includes(query.toLowerCase()))
			track.style.display = 'none';
		else
			track.style.display = '';
	}
}

function volChange(e) {
	tuner.player.audioElement.volume=e.value/100;
	e.parentNode.title = e.value+'%';
	tuner.volume = e.value;
}

function setVisMode(i) {
	if (i > vis_modes.length) visualizer.mode = 1;
	else visualizer.mode = i;
	setVisualizer(tuner.analysers, visualizer.mode);
}

function createVisualizer(player, context, stereo = true) {
	var audioSrc = context.createMediaElementSource(player);
	if (stereo) {
		tuner.splitter = context.createChannelSplitter(2);
		audioSrc.connect(tuner.splitter);
		tuner.merger = context.createChannelMerger(2);

		var analysers = {
			left: tuner.context.createAnalyser(),
			right: tuner.context.createAnalyser()
		};

		tuner.splitter.connect(analysers.left, 0);
		tuner.splitter.connect(analysers.right, 1);
		
		analysers.left.connect(tuner.merger, 0, 0);
		analysers.right.connect(tuner.merger, 0, 1);
		
		tuner.merger.connect(context.destination);
	} else {
		var analy = context.createAnalyser();
		audioSrc.connect(analy);
		analy.connect(context.destination);
		var analysers = {
			left: analy,
			right: analy
		};
	}
	setVisualizer(analysers, 0);

	return analysers;
};

function setVisualizer(analysers, mode = 0) {
	var canvas = visualizer.canvas;
	if (!analysers) return;
	clearInterval(visualizer.renderInverval);
	var ctx = canvas.getContext("2d",{antialias: false,alpha: false});

	var HEIGHT;
	var WIDTH = canvas.width;
	
	// Set the "defaults"
	analysers.left.smoothingTimeConstant = 0.8;
	analysers.left.fftSize = 2048;

	analysers.right.smoothingTimeConstant = 0.8;
	analysers.right.fftSize = 2048;

	var analyser = analysers.right;

	ctx.clearRect(0, 0, WIDTH, HEIGHT);
	window.cancelAnimationFrame(visualizer.drawRequest);
	if (mode == 0 || mode > vis_modes.length) {
		HEIGHT = canvas.height = 96;
		function drawVis() {
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);
		}
		drawVis();
	} else if (mode == 1) { // BAR
		HEIGHT = canvas.height = 96;
		analysers.right.fftSize = analysers.left.fftSize = 256;
		var bufferLength = analyser.frequencyBinCount;
		var dataArrayL = new Uint8Array(bufferLength)
		var dataArrayR = new Uint8Array(bufferLength)
	
		function drawVis() {
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);
	
			analysers.left.getByteFrequencyData(dataArrayL);
			analysers.right.getByteFrequencyData(dataArrayR);
			ctx.fillStyle = "#FFF";
	
			var x = 0;
	
			ctx.beginPath();
			for (var i = 0; i < bufferLength; i++) {
				var value = (dataArrayL[i] + dataArrayR[i]) / 2;
				barHeight = (value / 256) * HEIGHT;
				ctx.fillRect(x, HEIGHT - barHeight, WIDTH / bufferLength, barHeight);
				x += (WIDTH / bufferLength) + 1;
			}
			ctx.closePath();
		}
		drawVis();
	} else if (mode == 2) { // SCOPE
		HEIGHT = canvas.height = 96;
		analysers.left.smoothingTimeConstant = analysers.right.smoothingTimeConstant = 0;
		var dataArrayL = new Uint8Array(analysers.left.fftSize)
		var dataArrayR = new Uint8Array(analysers.right.fftSize)
	
		function drawVis() {
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);
	
			analysers.left.getByteTimeDomainData(dataArrayL);
			analysers.right.getByteTimeDomainData(dataArrayR);
	
			const step = WIDTH / dataArrayL.length;
	
			ctx.strokeStyle = "#0F0";
	
			ctx.beginPath();
			for (let i = 0; i < dataArrayL.length; i += 2) {
				var percent = (dataArrayL[i] + dataArrayR[i]) / 512;
				ctx.lineTo(i * step, HEIGHT * percent);
			}
			ctx.stroke();
		}
		drawVis();
	} else if (mode == 3) { // MULTI SCOPE
		HEIGHT = canvas.height = 96;
		analysers.left.smoothingTimeConstant = analysers.right.smoothingTimeConstant = 0;
		var dataArrayL = new Uint8Array(analysers.left.fftSize)
		var dataArrayR = new Uint8Array(analysers.right.fftSize)
	
		function drawVis() {
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);
	
			analysers.left.getByteTimeDomainData(dataArrayL);
			analysers.right.getByteTimeDomainData(dataArrayR);
	
			const step = WIDTH / dataArrayL.length;
	
			ctx.strokeStyle = "#0F0";
	
			ctx.beginPath();
			for (let i = 0; i < dataArrayL.length; i += 2) {
				var percentL = dataArrayL[i] / 512;
				ctx.lineTo(i * step, HEIGHT * percentL);
			}
			ctx.stroke();
			ctx.beginPath();
			for (let i = 0; i < dataArrayR.length; i += 2) {
				var percentR = dataArrayR[i] / 512;
				ctx.lineTo(i * step, (HEIGHT * percentR) + HEIGHT/2);
			}
			ctx.stroke();
		}
		drawVis();
	} else if (mode == 4) { // SPECTROGRAM
		HEIGHT = canvas.height = 128;
		analysers.left.smoothingTimeConstant = analysers.right.smoothingTimeConstant = 0;
	
		var tempCanvas = document.createElement("canvas"),
			tempCtx = tempCanvas.getContext("2d");
		tempCanvas.width = WIDTH;
		tempCanvas.height = HEIGHT;
	
		analysers.left.fftSize = analysers.right.fftSize = Math.pow(2, Math.ceil(Math.log(WIDTH)/Math.log(2)));
	
		var bufferLength = analyser.frequencyBinCount;
		var dataArrayL = new Uint8Array(bufferLength);
		var dataArrayR = new Uint8Array(bufferLength);
	
		var startTime = new Date();
		function drawVis() {
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);
	
			analysers.left.getByteFrequencyData(dataArrayL);
			analysers.right.getByteFrequencyData(dataArrayR);
			var barHeight = WIDTH/analysers.left.fftSize;
	
			var now = new Date();
			if (now < new Date(startTime.getTime() + 20)) { return; }
			startTime = now;
	
			tempCtx.drawImage(ctx.canvas, 0, 0, WIDTH, HEIGHT);
	
			for (var i = 0; i < bufferLength; i++) {
				var value = (dataArrayL[i]/2)+(dataArrayR[i]/2);
				ctx.fillStyle = 'rgb('+((value > 190) ? 255 : value)+', '+ ((value > 220) ? 255 : value-100) +', 0)';
				ctx.fillRect(WIDTH - 1, HEIGHT - i*barHeight, 1, barHeight);
			}
			ctx.translate(-1, 0);
			ctx.drawImage(tempCanvas, 0, 0, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
		}
		drawVis();
	} else if (mode == 5) { // LASER RAIN
		HEIGHT = canvas.height = 64;
		analysers.left.smoothingTimeConstant = analysers.right.smoothingTimeConstant = 0;
		var bufferLength = analysers.left.frequencyBinCount;
		var dataArrayL = new Uint8Array(bufferLength);
		var dataArrayR = new Uint8Array(bufferLength);
	
		//ctx.clearRect(0,0,WIDTH,HEIGHT);
		function drawVis() {
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);
	
			analysers.left.getByteFrequencyData(dataArrayL);
			analysers.right.getByteFrequencyData(dataArrayR);
	
			ctx.clearRect(0,0,WIDTH,HEIGHT);
			for (var i = 0; i < bufferLength; i++) {
				if (dataArrayL[i] != 0) {
					ctx.fillStyle = 'rgb('+dataArrayL[i]/4+','+dataArrayL[i]/2+','+dataArrayL[i]+')';
					ctx.fillRect((WIDTH / 2)-(i+1), 0, 1, HEIGHT);
				}
				
				if (dataArrayR[i] != 0) {
					ctx.fillStyle = 'rgb('+dataArrayR[i]/4+','+dataArrayR[i]/2+','+dataArrayR[i]+')';
					ctx.fillRect((WIDTH / 2)+i, 0, 1, HEIGHT);
				}
			}
		}
		drawVis();
	} else if (mode == 6) { // HEATBARS
		HEIGHT = canvas.height = 96;
		analysers.left.fftSize = 256;
		analysers.right.fftSize = 256;
		var bufferLength = analyser.frequencyBinCount;
		var dataArray = new Uint8Array(bufferLength);
		var dataArrayL = new Uint8Array(bufferLength);
		var dataArrayR = new Uint8Array(bufferLength);
	
		function drawVis() {
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);

			analyser.getByteFrequencyData(dataArray);
			analysers.left.getByteFrequencyData(dataArrayL);
			analysers.right.getByteFrequencyData(dataArrayR);
	
			for (let i = 0; i < bufferLength; i++) {
				ctx.beginPath();
				ctx.fillStyle = 'rgb(255,'+dataArray[i]+',0)';
				ctx.ellipse((i*3), ((HEIGHT)-(dataArrayL[i]-dataArrayR[i])/4)/2, 1, dataArray[i] / 5, 0, 0, 2 * Math.PI);
				ctx.fill();
				ctx.closePath();
			}
		}
		drawVis();
	} else if (mode == 7) { // VU METERS
		HEIGHT = canvas.height = 96;
		analysers.left.fftSize = 256;
		analysers.right.fftSize = 256;
		var bufferLength = analyser.frequencyBinCount;
		var dataArrayL = new Uint8Array(bufferLength);
		var dataArrayR = new Uint8Array(bufferLength);
	
		function drawVis() {
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);

			analysers.left.getByteFrequencyData(dataArrayL);
			analysers.right.getByteFrequencyData(dataArrayR);

			var dataL = dataArrayL.reduce(function(a,b){ return a+b; });
			var dataR = dataArrayR.reduce(function(a,b){ return a+b; });

			function drawChannel(data, x) {
				ctx.beginPath();
				ctx.arc(x, HEIGHT, HEIGHT-24, 1*Math.PI, 0, false);
				ctx.strokeStyle = "white";
				ctx.stroke();
				ctx.closePath();
	
				ctx.beginPath();
				
				ctx.arc(x, HEIGHT, HEIGHT-32, 1.3*Math.PI, (1.3*Math.PI)+(data/12000), false);
				ctx.strokeStyle = "transparent";
				ctx.stroke();
				
				ctx.lineTo(x, HEIGHT);
				ctx.strokeStyle = "red";
				ctx.stroke();
				ctx.closePath();
				
			}

			drawChannel(dataL, (WIDTH/4));
			drawChannel(dataR, (WIDTH/4)*3);
		}
		drawVis();
	} else if (mode == 8) { // VU BARS
		tuner.analysers.left.smoothingTimeConstant = tuner.analysers.right.smoothingTimeConstant = 0.2;
		HEIGHT = canvas.height = 32;
		analysers.left.fftSize = 256;
		analysers.right.fftSize = 256;
		var dataArrayL = new Uint8Array(analysers.left.frequencyBinCount);
		var dataArrayR = new Uint8Array(analysers.right.frequencyBinCount);
	
		function drawVis() {
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);

			analysers.left.getByteFrequencyData(dataArrayL);
			analysers.right.getByteFrequencyData(dataArrayR);

			var dataL = dataArrayL.reduce(function(a,b){ return a+b; });
			var dataR = dataArrayR.reduce(function(a,b){ return a+b; });
	
			ctx.beginPath();
			for (let l = 0; l < Math.min(Math.max(Math.round(dataL / 1270), 0), 31); l++) {
				if (l > 16) ctx.fillStyle = "rgb(255,0,0)";
				else if (l > 10) ctx.fillStyle = "rgb(255,255,0)";
				else ctx.fillStyle = "rgb(0,255,0)";
				ctx.fillRect(2+(l*14), (HEIGHT/2)-6, 12, 4);
			}
			ctx.closePath();

			ctx.beginPath();
			for (let r = 0; r < Math.min(Math.max(Math.round(dataR / 1270), 0), 31); r++) {
				if (r > 16) ctx.fillStyle = "rgb(255,0,0)";
				else if (r > 10) ctx.fillStyle = "rgb(255,255,0)";
				else ctx.fillStyle = "rgb(0,255,0)";
				ctx.fillRect(2+(r*14), (HEIGHT/2)+2, 12, 4);
			}
			ctx.closePath();
		}
		drawVis();
	} else if (mode == 9) { // STEREO DIFFERENCE
		HEIGHT = canvas.height = 128;
		analysers.left.smoothingTimeConstant = analysers.right.smoothingTimeConstant = 0;
	
		var tempCanvas = document.createElement("canvas"),
			tempCtx = tempCanvas.getContext("2d");
		tempCanvas.width = WIDTH;
		tempCanvas.height = HEIGHT;
	
		analysers.left.fftSize = analysers.right.fftSize = Math.pow(2, Math.ceil(Math.log(WIDTH)/Math.log(2)));
	
		var bufferLength = analyser.frequencyBinCount;
		var dataArrayL = new Uint8Array(bufferLength);
		var dataArrayR = new Uint8Array(bufferLength);
	
		var startTime = new Date();
		function drawVis() {
			visualizer.drawRequest = window.requestAnimationFrame(drawVis);
	
			analysers.left.getByteFrequencyData(dataArrayL);
			analysers.right.getByteFrequencyData(dataArrayR);
			var barHeight = WIDTH/analysers.left.fftSize;
	
			var now = new Date();
			if (now < new Date(startTime.getTime() + 20)) { return; }
			startTime = now;
	
			tempCtx.drawImage(ctx.canvas, 0, 0, WIDTH, HEIGHT);
	
			for (var i = 0; i < bufferLength; i++) {
				var value = dataArrayL[i] - dataArrayR[i];
				// LEFT
				if (value > 0) ctx.fillStyle = 'rgb('+value+', 0, 0)';
				// RIGHT
				else if (value < 0) ctx.fillStyle = 'rgb(0, 0, '+((value*-1)*4)+')';
				else ctx.fillStyle = 'rgb(0, 0, 0)';
				ctx.fillRect(WIDTH - 1, HEIGHT - i*barHeight, 1, barHeight);
			}
			ctx.translate(-1, 0);
			ctx.drawImage(tempCanvas, 0, 0, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
		}
		drawVis();
	}
}

window.addEventListener('DOMContentLoaded', (event) => {
	visualizer.canvas = document.querySelector('canvas.vis');
	
	tuner.canvas.element = document.querySelector('canvas.metadata');
	tuner.history_container = document.querySelector('history');
	tuner.station_container = document.querySelector('stations');
	tuner.favorites_container = document.querySelector('favorites');

	var fav_cookie = getCookie('favorites');
	if (fav_cookie != null && fav_cookie.length > 0) track_favorites = JSON.parse(getCookie('favorites'));
	populateFavorites();

	var visModeChanger = document.querySelector('select[name="visModes"]');
	for (let v = 0; v < vis_modes.length; v++) {
		var option = document.createElement('option');
		option.innerText = vis_modes[v];
		option.value = v;
		visModeChanger.appendChild(option);
	}
	visModeChanger.selectedIndex = visualizer.mode;

	tuner_mem.xhr = new XMLHttpRequest();
	tuner_mem.xhr.responseType = 'json';
	tuner_mem.xhr.onload = function() {
		var xhr = tuner_mem.xhr;

		while (tuner.station_container.hasChildNodes()) {
			tuner.station_container.lastElementChild.remove();
		}
		
		if (xhr.response) {
			var stations = xhr.response.icestats.source;
			for(let s = 0; s < stations.length; s++) {
				let st = stations[s];

				var stationContainer = document.createElement('station'),
					stationName = document.createElement('station-name'),
					stationURLs = document.createElement('station-urls'),
					stationDesc = document.createElement('description'),
					stationMeta = document.createElement('track-meta');

				stationName.innerText = st.server_name;
				stationDesc.innerText = st.server_description;

				let urls = [];
				urls.push('<a href="'+fixURL(st.listenurl)+'">Direct</a>');
				if (st.server_url) urls.push('<a href="'+st.server_url+'">Site</a>');
				stationURLs.innerHTML = urls.join(' - ');

				let meta = [];
				meta.push(st.server_type.substr(st.server_type.indexOf('/')+1).toUpperCase());
				if (st.bitrate) meta.push(st.bitrate+"kbps");
				else if (st.quality) meta.push(st.quality);
				else meta.push('???kbps');
				if (st.channels) meta.push(st.channels+'ch');
				else meta.push('?ch');
				if (st.samplerate) meta.push((st.samplerate / 1000)+'hz');
				else meta.push('????hz');
				meta.push(st.genre);
				meta.push(st.listeners+" Listening");
				stationMeta.innerText = meta.join(' - ');

				stationContainer.appendChild(stationName);
				stationContainer.appendChild(stationURLs);
				stationContainer.appendChild(stationDesc);
				stationContainer.appendChild(stationMeta);

				let nstat = {
					name: st.server_name,
					listen_url: fixURL(st.listenurl),
					channels: st.channels,
					bitrate: st.bitrate,
					quality: st.quality,
					listeners: st.listeners,
					genre: st.genre,
					samplerate: st.samplerate,
					description: st.server_description,
					type: st.server_type,
					site_url: st.server_url
				};

				if (station != null && fixURL(st.listenurl) == station.listen_url) {
					stationContainer.classList.add('active');
				}

				stationContainer.addEventListener('click', (e) => {
					startStation(nstat);
					var stationboxes = document.querySelectorAll('stations station');
					for (let s = 0; s < stationboxes.length; s++) {
						stationboxes[s].classList.remove('active');
					}
					e.currentTarget.classList.add('active');
				});
				
				tuner.station_container.appendChild(stationContainer);
			}
		}
	}

	updateXHR();
});

function getCookie(cName) {
    const name = cName + "=";
    const cDecoded = decodeURIComponent(document.cookie); //to be careful
    const cArr = cDecoded .split('; ');
    let res;
    cArr.forEach(val => {
        if (val.indexOf(name) === 0) res = val.substring(name.length);
    })
    return res;
}