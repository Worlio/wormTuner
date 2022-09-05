/* == wormTuner == */
/* The Icecast Radio JS Tuner */

const nameJs = "wormTuner";
const version = "0.3.1";

const statusJson = "/status-json.xsl";

// 'mimetype': 'icon-path'
const mimeIcons = {
//    'audio/aac':'/mime/aac.png',
};

const options = {
    'json-timer': 2500, // Time (in ms) for each stream update
    'visualizers': true, // whether to support visualizers
    'video-support': true, // whether to support video streams
    'character-overflow': 38, // character count needed to put in marquee.
    'replace-url': false, // fellow lazies please stand up
    'url-replacement': ['',''],
    'crossorigin': true
};

var ajax = new XMLHttpRequest();
var sources = [];

var isFancy = true;
var castContainer;
var currentStation = "";

var audioPlayer = document.createElement('video');
var audioContext;
var audioAnalyser;
var visualizer;
var visMode = 0;

var videoMode = false;

// Timers
var volTimer;
var visTimer;

function updateJSON() {
    ajax.open('GET', statusJson, true);
    ajax.send();
}

function processListenURL(url) {
    if (!options['replace-url'] || !url) return url;
    // Add Date.now() to prevent browser caching. Cache-Control isn't reliable IME
    return url.replace(options['url-replacement'][0], options['url-replacement'][1])+"?"+Date.now();
}

function setSource(source) {
    if (!source) return;
    currentStation = source.listenurl.substr(23);
    window.location.hash = "#"+currentStation;
    
    if (options['video-support'] && source.server_type.substr(0, source.server_type.indexOf('/')) == 'video') {
        visMode = -1;
    } else if (visMode < 0) visMode = 0;
    
    audioPlayer.src = processListenURL(source.listenurl);
    audioPlayer.type = source.server_type;
    
    if (isFancy) {
        if (!audioContext || !audioAnalyser) {
            audioContext = new AudioContext();
            audioAnalyser = createVisualizer(audioPlayer, audioContext);
        }
        setVisualizer(visualizer, audioAnalyser, visMode);
    } else audioPlayer = document.querySelector("video");
    
    audioPlayer.play();
    document.body.scrollTop = 0;
    updateJSON();
}

function handleVolume(event) {
    event.preventDefault();
    var volMeter = document.querySelector('.vol');
    volMeter.classList.remove('hidden');
    var volInc = 0.05;
    
    if (event.deltaY < 0) {
        if (audioPlayer.volume+volInc > 1) audioPlayer.volume=1;
        else audioPlayer.volume+=volInc;
    }
    else if (event.deltaY > 0) {
        if (audioPlayer.volume-volInc < 0) audioPlayer.volume=0;
        else audioPlayer.volume-=volInc;
    }
    
    volMeter.innerText = "VOL ["+'='.repeat(((audioPlayer.volume / 1) * 20)).padEnd(20, ' ') + "] "+(Math.round(audioPlayer.volume * 100)+'').padStart(3, ' ')+"%";
    
    window.clearTimeout(volTimer)
    volTimer = setTimeout(function(){
        volMeter.classList.add('hidden');
    }, 5000);
}

function switchMode() {
    if (videoMode) return;
    if (!isFancy) return;
    if (visMode == modes.length - 1) // - 1 if we count empty.
        visMode = 0;
    else visMode++;
    
    var visCounter = document.querySelector('.vismode');
    visCounter.classList.remove('hidden');
    
    visCounter.innerText = modes[visMode]+' '+visMode+'/'+(modes.length - 1);
    
    setVisualizer(visualizer, audioAnalyser, visMode);
    
    window.clearTimeout(visTimer)
    visTimer = setTimeout(function(){
        visCounter.classList.add('hidden');
    }, 5000);
    
    audioPlayer.play();
}

function newEntry(source, i) {
    var entryContainer = document.createElement('div');
    entryContainer.classList.add('station');
    
    entryContainer.name = source.listenurl.substr(23);
    
    var titlebar = document.createElement('div'),
        infoBar = document.createElement('div'),
        descBox = document.createElement('div');
        
    titlebar.classList.add('titlebar');
    infoBar.classList.add('infobar');
    descBox.classList.add('descbox');
        
    var titleTxt = document.createElement('b'),
        listenerBox = document.createElement('div');
    
    titleTxt.innerText = source.server_name;
    titlebar.appendChild(titleTxt);
    
    var stationLineHeight = 24;
    var grower = document.createElement('div');
    grower.style.flexGrow = "1";
    titlebar.appendChild(grower);
    
    var listenerImg = document.createElement('img'),
        listenerTxt = document.createElement('a');
        
    
    listenerImg.src = "users.png";
    listenerImg.width = listenerImg.height = stationLineHeight;
    listenerTxt.innerText = source.listeners;
    
    listenerBox.title = source.listeners+" listener"+(source.listeners != 1 ? 's' : '')+" (peak "+source.listener_peak+")";
    listenerBox.appendChild(listenerImg);
    listenerBox.appendChild(listenerTxt);
    titlebar.appendChild(listenerBox);
    
    entryContainer.appendChild(titlebar);
    
    entryContainer.appendChild(document.createElement('hr'));
    
    var bitrateTxt = document.createElement('a'),
        urlTxt = document.createElement('a'),
        urlImg = document.createElement('img'),
        dirTxt = document.createElement('a'),
        dirImg = document.createElement('img');
        
    bitrateTxt.classList.add('bitrate');
    listenerBox.classList.add('listeners');
    
    if (mimeIcons[source.server_type]) {
        var formatImg = document.createElement('img');
        formatImg.classList.add('format');
        formatImg.height = stationLineHeight;
        formatImg.alt = formatImg.title = source.server_type.substr(source.server_type.indexOf('/') + 1);
        formatImg.src = mimeIcons[source.server_type];
        infoBar.appendChild(formatImg);
    } else {
        var formatTxt = document.createElement('a');
        formatTxt.classList.add('format');
        formatTxt.innerText = formatTxt.title = source.server_type.substr(source.server_type.indexOf('/') + 1).toUpperCase();
        infoBar.appendChild(formatTxt);
    }
    
    var btr = source.bitrate;
    if (!source.bitrate && source.audio_bitrate) btr = source.audio_bitrate / 1000;
    else if (!source.audio_bitrate && !source.bitrate) btr = "???";
    bitrateTxt.innerHTML = btr + "<font size='1'>kbps</font>";
    infoBar.appendChild(bitrateTxt);
    
    if (source.server_url) {
        urlTxt.href = source.server_url;
        urlTxt.target = "_blank";
        urlImg.src = "url.png";
        urlImg.height = stationLineHeight;
        urlTxt.appendChild(urlImg);
        infoBar.appendChild(urlTxt);
    }
    
    dirTxt.href = processListenURL(source.listenurl);
    dirTxt.target = "_blank";
    dirImg.src = "dir.png";
    dirImg.height = stationLineHeight;
    dirTxt.appendChild(dirImg);
    infoBar.appendChild(dirTxt);
    
    entryContainer.appendChild(infoBar);
    
    var descTxt = document.createElement('p');
    descTxt.innerHTML = source.server_description + " <i>(Genre: "+source.genre+")</i>";
    descBox.appendChild(descTxt);
    
    entryContainer.appendChild(descBox);
    
    if (source.listenurl.substr(23) == currentStation) entryContainer.classList.add("selected");
    entryContainer.onclick = function() {
        setSource(sources[i]);
        this.classList.add("selected");
    }
    
    return entryContainer;
}

function setMaybeOverflow(elem, txt) {
    if (!txt) return;
    var limit = options['character-overflow'];
    if (elem.innerText == txt) return;
    if (txt.length > limit)
        elem.innerHTML = "<marquee>"+txt+"</marquee>";
    else if (txt.length <= limit)
        elem.innerHTML = txt;
    
}

function updateStreamInfo(source) {
    var stationName = document.querySelector(".textainer .station"),
        title = document.querySelector(".textainer .track"),
        genre = document.querySelector(".textainer .genre");
    if (source) {
        setMaybeOverflow(stationName,source.server_name);
        if (source.artist)
            setMaybeOverflow(title,source.artist+" - "+source.title);
        else 
            setMaybeOverflow(title,source.title);
        setMaybeOverflow(genre,source.genre);
    } else stationName.innerText = title.innerText = genre.innerText = "";
}

ajax.onload = function() {
    // Clear Container for new stuff.
    while(castContainer.childElementCount > 0) {
        castContainer.removeChild(castContainer.lastChild);
    }
    
    if (ajax.status == 200) { // OK
        if (ajax.response.icestats.source) {
            if (ajax.response.icestats.source.length > 0) sources = ajax.response.icestats.source;
            else sources = [ ajax.response.icestats.source ];
        } else sources = [];
        var index = -1;
        for (let i = 0; i < sources.length; i++) {
            castContainer.appendChild(newEntry(sources[i], i));
            if (sources[i].listenurl.substr(23) == currentStation) index = i;
        }
        if (index != -1) updateStreamInfo(sources[index]);
        if (audioPlayer.paused && currentStation.length > 0)
            setSource(sources[index]);
    }
}

window.addEventListener('DOMContentLoaded', (event) => {
    castContainer = document.querySelector(".broadcasts");
    ajax.responseType = 'json';
    updateJSON();
    
    visualizer = document.querySelector('canvas.vis');
    isFancy = isFancy && (visualizer != null);
    
    // Detect Visualizer and initialize events
    if (isFancy) {
        visualizer.addEventListener('click', (event) => {
            switchMode();
        });
        visualizer.addEventListener('wheel', handleVolume);
    }
    
    // #my-stream.ogg -> listenurl: /my-stream.ogg
    if (window.location.hash.length > 2) currentStation = window.location.hash.substr(1);
    
    // Handle name and versioning
    var _nameElem = document.querySelector('.about .name');
    if (_nameElem) _nameElem.innerText = nameJs;
    var _versElem = document.querySelector('.about .vers');
    if (_versElem) _versElem.innerText = 'v'+version;
    
    setInterval(function() {
        updateJSON();
    }, options['json-timer']);
    
    if (options['crossorigin']) audioPlayer.setAttribute('crossorigin','anonymous');
    audioPlayer.onended = function () {
        currentStation = "";
        console.log("Stream over");
        updateStreamInfo(null);
    };
});
